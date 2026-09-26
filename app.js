(function () {
  'use strict';

  // ============================================================
  // Firebase configuration
  // ============================================================

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyC3JRPuC-2LCs8nqiLy_LKvi72nyLLd7_U',
    authDomain: 'equipment-borrow-1303c.firebaseapp.com',
    projectId: 'equipment-borrow-1303c',
    storageBucket: 'equipment-borrow-1303c.firebasestorage.app',
    messagingSenderId: '433020378004',
    appId: '1:433020378004:web:d574cf9c4e7fafa4034d81',
    measurementId: 'G-MFWPB1GBKZ'
  };

  const FIREBASE_VERSION = '12.19.0';

  // ============================================================
  // LocalStorage Keys
  // ============================================================

  const KEYS = {
    equipment: 'equipment',
    equipmentData: 'equipment_data',
    history: 'borrow_history',
    currentUser: 'equipment_current_user',
    loggedIn: 'isLoggedIn',
    userEmail: 'userEmail',
    userName: 'userName',
    firebaseUid: 'firebaseUid',
    userRole: 'userRole'
  };

  // ============================================================
  // Default Equipment
  // ============================================================

  const DEFAULT_EQUIPMENT = [
    {
      id: 'EQ001',
      name: 'Projector Epson EB-X05',
      category: 'เครื่องฉาย',
      icon: 'projector',
      total: 10,
      available: 10,
      status: 'available',
      borrower: ''
    },

    {
      id: 'EQ002',
      name: 'กล้อง Nikon D5600',
      category: 'กล้องถ่ายภาพ',
      icon: 'camera',
      total: 5,
      available: 5,
      status: 'available',
      borrower: ''
    },

    {
      id: 'EQ003',
      name: 'ไมโครโฟนไร้สาย',
      category: 'เครื่องเสียง',
      icon: 'mic',
      total: 8,
      available: 8,
      status: 'available',
      borrower: ''
    },

    {
      id: 'EQ004',
      name: 'ลำโพง JBL',
      category: 'เครื่องเสียง',
      icon: 'speaker',
      total: 3,
      available: 3,
      status: 'available',
      borrower: ''
    }
  ];

  // ============================================================
  // Status
  // ============================================================

  const STATUS_MAP = {
    'พร้อมใช้งาน': 'available',
    'กำลังถูกยืม': 'borrowed',
    'ไม่พร้อมใช้งาน': 'unavailable',

    available: 'available',
    borrowed: 'borrowed',
    unavailable: 'unavailable'
  };

  let db = null;
  let auth = null;
  let firebaseReadyPromise = null;

  // ============================================================
  // Utility
  // ============================================================

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(
      root.querySelectorAll(selector)
    );
  }

  function escapeHtml(value) {

    return String(value ?? '').replace(
      /[&<>'"]/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[c])
    );
  }

  function parseJSON(key, fallback) {

    try {

      const value =
        localStorage.getItem(key);

      return value
        ? JSON.parse(value)
        : fallback;

    } catch (_) {

      return fallback;
    }
  }

  function saveJSON(key, value) {

    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  }

  function todayISO() {

    return new Date()
      .toISOString()
      .slice(0, 10);
  }

  function formatDate(value) {

    if (!value) {
      return '-';
    }

    const d =
      new Date(value);

    if (
      Number.isNaN(
        d.getTime()
      )
    ) {
      return value;
    }

    return d.toLocaleDateString(
      'th-TH',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }
    );
  }

  function formatDateTime(value) {

    if (!value) {
      return '-';
    }

    const d =
      new Date(value);

    if (
      Number.isNaN(
        d.getTime()
      )
    ) {
      return value;
    }

    return d.toLocaleString(
      'th-TH',
      {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    );
  }

  function makeId(prefix) {

    return (
      prefix +
      Date.now()
        .toString(36)
        .toUpperCase() +
      Math.random()
        .toString(36)
        .slice(2, 5)
        .toUpperCase()
    );
  }

  function statusToThai(status) {

    return (
      {
        available: 'พร้อมใช้งาน',
        borrowed: 'กำลังถูกยืม',
        unavailable: 'ไม่พร้อมใช้งาน'
      }[
        STATUS_MAP[status] ||
        status
      ]
    ) || status || '-';
  }

  function normalizeStatus(status) {

    return (
      STATUS_MAP[status] ||
      'available'
    );
  }

  // ============================================================
  // Normalize Equipment
  // ============================================================

  function normalizeEquipment(item) {

    const total = Math.max(
      1,
      Number(
        item.total ??
        item.quantity ??
        1
      )
    );

    let available =
      Number(item.available);

    if (
      !Number.isFinite(
        available
      )
    ) {
      available = total;
    }

    available = Math.max(
      0,
      Math.min(
        total,
        available
      )
    );

    return {

      id: String(
        item.id ??
        item.equipmentId ??
        ''
      ).trim(),

      name: String(
        item.name ??
        item.equipmentName ??
        ''
      ).trim(),

      category: String(
        item.category ??
        'ทั่วไป'
      ).trim(),

      icon:
        item.icon ||
        'package',

      total,

      available,

      status:
        normalizeStatus(
          item.status ||
          (
            available < total
              ? 'borrowed'
              : 'available'
          )
        ),

      borrower: String(
        item.borrower ??
        ''
      ).trim(),

      createdAt:
        item.createdAt ||
        new Date()
          .toISOString(),

      updatedAt:
        item.updatedAt ||
        new Date()
          .toISOString()
    };
  }

  // ============================================================
  // LocalStorage : Equipment
  // ============================================================

  function getEquipmentLocal() {

    let data =
      parseJSON(
        KEYS.equipment,
        null
      );

    if (
      !Array.isArray(data)
    ) {

      data =
        parseJSON(
          KEYS.equipmentData,
          null
        );
    }

    if (
      !Array.isArray(data)
    ) {

      data =
        DEFAULT_EQUIPMENT.map(
          x => ({ ...x })
        );
    }

    data =
      data
        .map(
          normalizeEquipment
        )
        .filter(
          x =>
            x.id &&
            x.name
        );

    if (
      !data.length
    ) {

      data =
        DEFAULT_EQUIPMENT.map(
          x => ({ ...x })
        );
    }

    return data;
  }

  function saveEquipmentLocal(data) {

    const normalized =
      data.map(
        normalizeEquipment
      );

    saveJSON(
      KEYS.equipment,
      normalized
    );

    saveJSON(
      KEYS.equipmentData,
      normalized
    );

    window.dispatchEvent(
      new CustomEvent(
        'equipmentDataChanged'
      )
    );
  }

  // ============================================================
  // LocalStorage : History
  // ============================================================

  function getHistoryLocal() {

    const data =
      parseJSON(
        KEYS.history,
        []
      );

    return Array.isArray(data)
      ? data
      : [];
  }

  function saveHistoryLocal(data) {

    saveJSON(
      KEYS.history,
      data
    );

    window.dispatchEvent(
      new CustomEvent(
        'historyDataChanged'
      )
    );
  }

  // ============================================================
  // Current User
  // ============================================================

  function getCurrentUserName() {

    const current =
      parseJSON(
        KEYS.currentUser,
        null
      );

    return (
      localStorage.getItem(
        KEYS.userName
      ) ||
      current?.name ||
      current?.email ||
      localStorage.getItem(
        KEYS.userEmail
      ) ||
      'ผู้ใช้งาน'
    );
  }

  function isLoggedIn() {

    return !!(
      auth &&
      auth.currentUser
    );
  }

  // ============================================================
  // Firebase Error
  // ============================================================

  function firebaseErrorMessage(error) {

    const code =
      error?.code || '';

    const map = {

      'auth/email-already-in-use':
        'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ',

      'auth/invalid-email':
        'รูปแบบอีเมลไม่ถูกต้อง',

      'auth/weak-password':
        'รหัสผ่านไม่ปลอดภัยเพียงพอ',

      'auth/user-not-found':
        'ไม่พบบัญชีผู้ใช้นี้',

      'auth/wrong-password':
        'อีเมลหรือรหัสผ่านไม่ถูกต้อง',

      'auth/invalid-credential':
        'อีเมลหรือรหัสผ่านไม่ถูกต้อง',

      'auth/too-many-requests':
        'มีการลองเข้าสู่ระบบหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง',

      'auth/network-request-failed':
        'ไม่สามารถเชื่อมต่อ Firebase ได้ กรุณาตรวจสอบอินเทอร์เน็ต',

      'auth/missing-password':
        'กรุณากรอกรหัสผ่าน',

      'auth/expired-action-code':
        'ลิงก์รีเซ็ตรหัสผ่านหมดอายุแล้ว',

      'auth/invalid-action-code':
        'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือถูกใช้ไปแล้ว'
    };

    return (
      map[code] ||
      error?.message ||
      'เกิดข้อผิดพลาด กรุณาลองใหม่'
    );
  }

  // ============================================================
  // Load Firebase Script
  // ============================================================

  function loadScript(src) {

    return new Promise(
      (resolve, reject) => {

        const existing =
          document.querySelector(
            `script[src="${src}"]`
          );

        if (existing) {

          if (
            existing.dataset.loaded ===
            'true'
          ) {

            return resolve();
          }

          existing.addEventListener(
            'load',
            resolve,
            { once: true }
          );

          existing.addEventListener(
            'error',
            reject,
            { once: true }
          );

          return;
        }

        const script =
          document.createElement(
            'script'
          );

        script.src = src;
        script.async = false;

        script.addEventListener(
          'load',
          () => {

            script.dataset.loaded =
              'true';

            resolve();

          },
          { once: true }
        );

        script.addEventListener(
          'error',
          () => {

            reject(
              new Error(
                'โหลด Firebase SDK ไม่สำเร็จ'
              )
            );

          },
          { once: true }
        );

        document.head.appendChild(
          script
        );
      }
    );
  }

  // ============================================================
  // Initialize Firebase
  // ============================================================

  async function initFirebase() {

    if (
      firebaseReadyPromise
    ) {

      return firebaseReadyPromise;
    }

    firebaseReadyPromise =
      (async () => {

        if (
          window.firebase?.apps?.length
        ) {

          db =
            window.firebase
              .firestore();

          auth =
            window.firebase
              .auth();

          return true;
        }

        const base =
          `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

        await loadScript(
          `${base}/firebase-app-compat.js`
        );

        await loadScript(
          `${base}/firebase-auth-compat.js`
        );

        await loadScript(
          `${base}/firebase-firestore-compat.js`
        );

        window.firebase.initializeApp(
          FIREBASE_CONFIG
        );

        db =
          window.firebase
            .firestore();

        auth =
          window.firebase
            .auth();

        return true;

      })().catch(error => {

        console.error(
          'Firebase initialization error:',
          error
        );

        return false;
      });

    return firebaseReadyPromise;
  }

  // ============================================================
  // Get User Profile
  // ============================================================

  async function getUserProfile(user) {

    if (
      !user ||
      !db
    ) {

      return null;
    }

    try {

      const snap =
        await db
          .collection('users')
          .doc(user.uid)
          .get();

      return snap.exists
        ? snap.data()
        : null;

    } catch (error) {

      console.warn(
        'อ่าน profile จาก Firestore ไม่สำเร็จ:',
        error
      );

      return null;
    }
  }

  // ============================================================
  // Seed Equipment
  // ============================================================

  async function ensureEquipmentSeed() {

    if (
      !db ||
      !auth?.currentUser
    ) {

      return;
    }

    try {

      const snapshot =
        await db
          .collection('equipment')
          .limit(1)
          .get();

      if (
        !snapshot.empty
      ) {

        return;
      }

      const batch =
        db.batch();

      DEFAULT_EQUIPMENT.forEach(
        item => {

          const doc =
            db
              .collection('equipment')
              .doc(item.id);

          batch.set(
            doc,
            {
              ...item,

              createdAt:
                new Date()
                  .toISOString(),

              updatedAt:
                new Date()
                  .toISOString()
            }
          );
        }
      );

      await batch.commit();

    } catch (error) {

      console.warn(
        'Seed equipment ไม่สำเร็จ:',
        error
      );
    }
  }

  // ============================================================
  // Load Equipment From Firebase
  // ============================================================

  async function loadEquipmentFromFirebase() {

    if (
      !db ||
      !auth?.currentUser
    ) {

      return getEquipmentLocal();
    }

    try {

      const snap =
        await db
          .collection('equipment')
          .get();

      const data =
        snap.docs.map(
          doc =>
            normalizeEquipment({
              id: doc.id,
              ...doc.data()
            })
        );

      if (
        data.length
      ) {

        saveEquipmentLocal(
          data
        );

        return data;
      }

    } catch (error) {

      console.warn(
        'อ่านอุปกรณ์จาก Firebase ไม่สำเร็จ:',
        error
      );
    }

    return getEquipmentLocal();
  }

  // ============================================================
  // Save Equipment
  // ============================================================

  async function saveEquipmentFirebase(item) {

    if (
      !db ||
      !auth?.currentUser
    ) {

      return;
    }

    const normalized =
      normalizeEquipment(item);

    await db
      .collection('equipment')
      .doc(normalized.id)
      .set(
        {
          ...normalized,

          updatedAt:
            new Date()
              .toISOString()
        },
        {
          merge: true
        }
      );
  }

  // ============================================================
  // Delete Equipment
  // ============================================================

  async function deleteEquipmentFirebase(id) {

    if (
      !db ||
      !auth?.currentUser
    ) {

      return;
    }

    await db
      .collection('equipment')
      .doc(id)
      .delete();
  }

  // ============================================================
  // Load History
  // ============================================================

  async function loadHistoryFromFirebase() {

    if (
      !db ||
      !auth?.currentUser
    ) {

      return getHistoryLocal();
    }

    try {

      const snap =
        await db
          .collection('history')
          .orderBy(
            'createdAt',
            'desc'
          )
          .get();

      const data =
        snap.docs.map(
          doc => ({
            id: doc.id,
            ...doc.data()
          })
        );

      saveHistoryLocal(
        data
      );

      return data;

    } catch (error) {

      try {

        const snap =
          await db
            .collection('history')
            .get();

        const data =
          snap.docs.map(
            doc => ({
              id: doc.id,
              ...doc.data()
            })
          );

        data.sort(
          (a, b) =>
            String(
              b.createdAt || ''
            ).localeCompare(
              String(
                a.createdAt || ''
              )
            )
        );

        saveHistoryLocal(
          data
        );

        return data;

      } catch (fallbackError) {

        console.warn(
          'อ่านประวัติจาก Firebase ไม่สำเร็จ:',
          fallbackError
        );
      }
    }

    return getHistoryLocal();
  }

  // ============================================================
  // Save History
  // ============================================================

  async function saveHistoryFirebase(record) {

    if (
      !db ||
      !auth?.currentUser
    ) {

      return;
    }

    await db
      .collection('history')
      .doc(record.id)
      .set(
        {
          ...record,

          updatedAt:
            new Date()
              .toISOString()
        },
        {
          merge: true
        }
      );
  }

  // ============================================================
  // Save Borrow
  // ============================================================

  async function saveBorrowFirebase(record) {

    if (
      !db ||
      !auth?.currentUser
    ) {

      return;
    }

    await db
      .collection('borrow')
      .doc(record.id)
      .set(
        {
          ...record,

          updatedAt:
            new Date()
              .toISOString()
        },
        {
          merge: true
        }
      );
  }

  // ============================================================
  // Update Borrow
  // ============================================================

  async function updateBorrowFirebase(record) {

    if (
      !db ||
      !auth?.currentUser
    ) {

      return;
    }

    await db
      .collection('borrow')
      .doc(record.id)
      .set(
        {
          ...record,

          updatedAt:
            new Date()
              .toISOString()
        },
        {
          merge: true
        }
      );
  }

  // ============================================================
  // ICONS
  // ============================================================

  function initIcons() {

    const icons = {

      package: `
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="2">
        </rect>

        <path d="M3 9h18"></path>

        <path d="M9 3v6"></path>
      `,

      "circle-check": `
        <circle
          cx="12"
          cy="12"
          r="9">
        </circle>

        <path
          d="m9 12 2 2 4-4">
        </path>
      `,

      "clipboard-list": `
        <rect
          x="5"
          y="4"
          width="14"
          height="17"
          rx="2">
        </rect>

        <path
          d="M9 4V3h6v1">
        </path>

        <path d="M9 9h6"></path>

        <path d="M9 13h6"></path>

        <path d="M9 17h4"></path>
      `,

      "circle-x": `
        <circle
          cx="12"
          cy="12"
          r="9">
        </circle>

        <path
          d="m9 9 6 6">
        </path>

        <path
          d="m15 9-6 6">
        </path>
      `,

      "layout-dashboard": `
        <rect
          x="3"
          y="3"
          width="7"
          height="7">
        </rect>

        <rect
          x="14"
          y="3"
          width="7"
          height="7">
        </rect>

        <rect
          x="14"
          y="14"
          width="7"
          height="7">
        </rect>

        <rect
          x="3"
          y="14"
          width="7"
          height="7">
        </rect>
      `,

      "package-search": `
        <path
          d="M3 8l9-5 9 5v8l-9 5-9-5Z">
        </path>

        <path d="M3 8h18"></path>

        <path d="M12 3v5"></path>

        <circle
          cx="16.5"
          cy="16.5"
          r="3">
        </circle>

        <path
          d="m19 19 2 2">
        </path>
      `,

      "undo-2": `
        <path
          d="M9 7 4 12l5 5">
        </path>

        <path
          d="M4 12h10a6 6 0 0 1 6 6">
        </path>
      `,

      history: `
        <path
          d="M3 12a9 9 0 1 0 3-6.7">
        </path>

        <path d="M3 4v5h5"></path>

        <path d="M12 7v5l3 2"></path>
      `,

      bell: `
        <path
          d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9">
        </path>

        <path
          d="M13.73 21a2 2 0 0 1-3.46 0">
        </path>
      `,

      "circle-user-round": `
        <circle
          cx="12"
          cy="12"
          r="10">
        </circle>

        <circle
          cx="12"
          cy="10"
          r="3">
        </circle>

        <path
          d="M6.5 19a6 6 0 0 1 11 0">
        </path>
      `,

      "log-out": `
        <path
          d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4">
        </path>

        <path
          d="m16 17 5-5-5-5">
        </path>

        <path
          d="M21 12H9">
        </path>
      `,

      plus: `
        <path d="M12 5v14"></path>
        <path d="M5 12h14"></path>
      `,

      search: `
        <circle
          cx="11"
          cy="11"
          r="7">
        </circle>

        <path
          d="m20 20-4-4">
        </path>
      `,

      edit: `
        <path
          d="M12 20h9">
        </path>

        <path
          d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z">
        </path>
      `,

      trash: `
        <path
          d="M3 6h18">
        </path>

        <path
          d="M8 6V4h8v2">
        </path>

        <path
          d="M19 6l-1 15H6L5 6">
        </path>

        <path
          d="M10 11v6">
        </path>

        <path
          d="M14 11v6">
        </path>
      `,

      check: `
        <path
          d="m5 12 4 4L19 6">
        </path>
      `,

      x: `
        <path d="m6 6 12 12"></path>
        <path d="m18 6-12 12"></path>
      `,

      "arrow-left": `
        <path d="m12 19-7-7 7-7"></path>
        <path d="M19 12H5"></path>
      `,

      save: `
        <path
          d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z">
        </path>

        <path d="M17 21v-8H7v8"></path>

        <path d="M7 3v5h8"></path>
      `,

      "eye": `
        <path
          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z">
        </path>

        <circle
          cx="12"
          cy="12"
          r="3">
        </circle>
      `
    };

    qsa(
      '[data-lucide]'
    ).forEach(
      element => {

        const name =
          element.getAttribute(
            'data-lucide'
          );

        const svg =
          icons[name];

        if (!svg) {
          return;
        }

        element.outerHTML = `
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-${name}"
            aria-hidden="true"
          >
            ${svg}
          </svg>
        `;
      }
    );
  }

  // ============================================================
  // PASSWORD TOGGLE
  // ============================================================

  function setupPasswordToggle() {

    const initializeButtons = () => {

      qsa(
        '.toggle-password'
      ).forEach(
        button => {

          const wrapper =
            button.closest(
              '.password-wrapper'
            );

          const targetId =
            button.getAttribute(
              'data-target'
            ) ||
            button.getAttribute(
              'aria-controls'
            );

          const input =
            (
              wrapper &&
              wrapper.querySelector(
                'input'
              )
            ) ||
            (
              targetId
                ? document.getElementById(
                    targetId
                  )
                : null
            );

          if (!input) {
            return;
          }

          button.type =
            'button';

          /*
           * ป้องกัน CSS เดิมซ่อนปุ่ม
           */
          button.style.display =
            'block';

          button.style.visibility =
            'visible';

          button.style.opacity =
            '1';

          button.style.pointerEvents =
            'auto';

          button.style.position =
            'absolute';

          button.style.zIndex =
            '20';

          button.textContent =
            input.type === 'text'
              ? 'ซ่อน'
              : 'แสดง';

          if (
            button.dataset
              .passwordToggleReady ===
            'true'
          ) {
            return;
          }

          button.dataset
            .passwordToggleReady =
            'true';

          button.addEventListener(
            'click',
            event => {

              event.preventDefault();

              event.stopPropagation();

              const showing =
                input.type ===
                'text';

              input.type =
                showing
                  ? 'password'
                  : 'text';

              button.textContent =
                showing
                  ? 'แสดง'
                  : 'ซ่อน';

              input.focus();
            }
          );
        }
      );
    };

    initializeButtons();

    if (
      !window.__passwordToggleObserver
    ) {

      window.__passwordToggleObserver =
        new MutationObserver(
          () => {
            initializeButtons();
          }
        );

      if (
        document.body
      ) {

        window.__passwordToggleObserver.observe(
          document.body,
          {
            childList: true,
            subtree: true
          }
        );
      }
    }
  }

  // ============================================================
  // PASSWORD VALIDATION
  // ============================================================

  function passwordValid(
    password
  ) {

    const value =
      String(
        password || ''
      );

    return (
      value.length >= 8 &&
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /[0-9]/.test(value)
    );
  }

  function updatePasswordRules(
    type,
    password
  ) {

    const value =
      String(
        password || ''
      );

    const lengthRule =
      qs(`#${type}Length`) ||
      qs('#ruleLength');

    const upperRule =
      qs(`#${type}Uppercase`) ||
      qs('#ruleUppercase');

    const lowerRule =
      qs(`#${type}Lowercase`) ||
      qs('#ruleLowercase');

    const numberRule =
      qs(`#${type}Number`) ||
      qs('#ruleNumber');

    function updateRule(
      element,
      valid
    ) {

      if (!element) {
        return;
      }

      element.classList.toggle(
        'valid',
        valid
      );

      element.classList.toggle(
        'invalid',
        !valid
      );

      element.classList.toggle(
        'rule-valid',
        valid
      );

      element.classList.toggle(
        'rule-invalid',
        !valid
      );

      const icon =
        element.querySelector(
          '.rule-icon'
        );

      if (icon) {

        icon.textContent =
          valid
            ? '✓'
            : '✕';
      }
    }

    updateRule(
      lengthRule,
      value.length >= 8
    );

    updateRule(
      upperRule,
      /[A-Z]/.test(value)
    );

    updateRule(
      lowerRule,
      /[a-z]/.test(value)
    );

    updateRule(
      numberRule,
      /[0-9]/.test(value)
    );
  }

  // ============================================================
  // LOGIN ROLE UI
  // ============================================================

  function updateLoginRoleUI() {

    const roleSelect =
      qs('#loginRole');

    const adminCodeGroup =
      qs('#adminCodeGroup');

    const adminCode =
      qs('#adminCode');

    if (
      !roleSelect ||
      !adminCodeGroup
    ) {

      return;
    }

    const isAdmin =
      roleSelect.value ===
      'admin';

    adminCodeGroup.style.display =
      isAdmin
        ? 'block'
        : 'none';

    adminCodeGroup.hidden =
      !isAdmin;

    if (adminCode) {

      adminCode.required =
        isAdmin;

      if (!isAdmin) {
        adminCode.value = '';
      }
    }
  }
  // ============================================================
  // LOGIN
  // ============================================================

  function setupLogin() {

    const form =
      qs('#loginForm');

    if (!form) {
      return;
    }

    const loginRole =
      qs('#loginRole');

    const adminCode =
      qs('#adminCode');

    const emailInput =
      qs('#email');

    const passwordInput =
      qs('#password');

    const rememberMe =
      qs('#rememberMe');

    const ADMIN_CODE =
      '24236';

    // ----------------------------------------------------------
    // Load remembered login
    // ----------------------------------------------------------

    const rememberedEmail =
      localStorage.getItem(
        'rememberedEmail'
      );

    const rememberedPassword =
      localStorage.getItem(
        'rememberedPassword'
      );

    if (
      rememberedEmail &&
      emailInput
    ) {

      emailInput.value =
        rememberedEmail;
    }

    if (
      rememberedPassword &&
      passwordInput
    ) {

      passwordInput.value =
        rememberedPassword;
    }

    if (
      rememberMe &&
      rememberedEmail
    ) {

      rememberMe.checked =
        true;
    }

    // ----------------------------------------------------------
    // Role from URL
    // ----------------------------------------------------------

    const params =
      new URLSearchParams(
        window.location.search
      );

    const urlRole =
      params.get('role');

    const savedRole =
      localStorage.getItem(
        KEYS.userRole
      );

    if (
      loginRole &&
      (
        urlRole === 'admin' ||
        urlRole === 'user'
      )
    ) {

      loginRole.value =
        urlRole;
    } else if (
      loginRole &&
      (
        savedRole === 'admin' ||
        savedRole === 'user'
      )
    ) {

      loginRole.value =
        savedRole;
    }

    updateLoginRoleUI();

    // ----------------------------------------------------------
    // Role change
    // ----------------------------------------------------------

    if (loginRole) {

      loginRole.addEventListener(
        'change',
        () => {

          updateLoginRoleUI();
        }
      );
    }

    // ----------------------------------------------------------
    // Submit Login
    // ----------------------------------------------------------

    form.addEventListener(
      'submit',
      async event => {

        event.preventDefault();

        const email =
          emailInput?.value
            ?.trim() || '';

        const password =
          passwordInput?.value ||
          '';

        const selectedRole =
          loginRole?.value ||
          'user';

        // ------------------------------------------------------
        // Basic validation
        // ------------------------------------------------------

        if (!email) {

          alert(
            'กรุณากรอกอีเมล'
          );

          emailInput?.focus();

          return;
        }

        if (!password) {

          alert(
            'กรุณากรอกรหัสผ่าน'
          );

          passwordInput?.focus();

          return;
        }

        // ------------------------------------------------------
        // Admin code
        // ------------------------------------------------------

        if (
          selectedRole ===
          'admin'
        ) {

          const code =
            adminCode?.value
              ?.trim() || '';

          if (
            !/^\d{5}$/.test(code)
          ) {

            alert(
              'กรุณากรอกรหัสผู้ดูแลระบบ 5 หลัก'
            );

            adminCode?.focus();

            return;
          }

          if (
            code !== ADMIN_CODE
          ) {

            alert(
              'รหัสผู้ดูแลระบบไม่ถูกต้อง'
            );

            adminCode?.focus();

            return;
          }
        }

        // ------------------------------------------------------
        // Firebase
        // ------------------------------------------------------

        const firebaseOK =
          await initFirebase();

        if (
          !firebaseOK ||
          !auth
        ) {

          alert(
            'ไม่สามารถเชื่อมต่อ Firebase ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
          );

          return;
        }

        const submitButton =
          form.querySelector(
            'button[type="submit"]'
          );

        const oldText =
          submitButton?.textContent ||
          'เข้าสู่ระบบ';

        if (submitButton) {

          submitButton.disabled =
            true;

          submitButton.textContent =
            'กำลังเข้าสู่ระบบ...';
        }

        try {

          // ----------------------------------------------------
          // Firebase Authentication
          // ----------------------------------------------------

          const credential =
            await auth.signInWithEmailAndPassword(
              email,
              password
            );

          const user =
            credential.user;

          // ----------------------------------------------------
          // User Profile
          // ----------------------------------------------------

          const profile =
            await getUserProfile(
              user
            );

          const actualRole =
            profile?.role ||
            'user';

          // ----------------------------------------------------
          // Check role
          // ----------------------------------------------------

          if (
            selectedRole ===
              'admin' &&
            actualRole !==
              'admin'
          ) {

            await auth.signOut();

            alert(
              'บัญชีนี้ไม่มีสิทธิ์เป็นผู้ดูแลระบบ'
            );

            return;
          }

          if (
            selectedRole ===
              'user' &&
            actualRole ===
              'admin'
          ) {

            await auth.signOut();

            alert(
              'บัญชีนี้เป็นผู้ดูแลระบบ กรุณาเลือกประเภทผู้ใช้งานเป็น "ผู้ดูแลระบบ"'
            );

            return;
          }

          // ----------------------------------------------------
          // Check disabled user
          // ----------------------------------------------------

          const accountStatus =
            profile?.status ||
            'active';

          if (
            accountStatus ===
              'disabled' ||
            accountStatus ===
              'inactive'
          ) {

            await auth.signOut();

            alert(
              'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ'
            );

            return;
          }

          // ----------------------------------------------------
          // Save current user
          // ----------------------------------------------------

          const currentUser = {

            uid:
              user.uid,

            name:
              profile?.name ||
              user.displayName ||
              email,

            email:
              user.email ||
              email,

            role:
              actualRole,

            status:
              accountStatus,

            loginAt:
              new Date()
                .toISOString()
          };

          saveJSON(
            KEYS.currentUser,
            currentUser
          );

          localStorage.setItem(
            KEYS.loggedIn,
            'true'
          );

          localStorage.setItem(
            KEYS.userEmail,
            email
          );

          localStorage.setItem(
            KEYS.userName,
            currentUser.name
          );

          localStorage.setItem(
            KEYS.firebaseUid,
            user.uid
          );

          localStorage.setItem(
            KEYS.userRole,
            actualRole
          );

          // ----------------------------------------------------
          // Remember login
          // ----------------------------------------------------

          if (
            rememberMe?.checked
          ) {

            localStorage.setItem(
              'rememberedEmail',
              email
            );

            localStorage.setItem(
              'rememberedPassword',
              password
            );

          } else {

            localStorage.removeItem(
              'rememberedEmail'
            );

            localStorage.removeItem(
              'rememberedPassword'
            );
          }

          // ----------------------------------------------------
          // Prepare equipment
          // ----------------------------------------------------

          await ensureEquipmentSeed();

          await loadEquipmentFromFirebase();

          // ----------------------------------------------------
          // Redirect
          // ----------------------------------------------------

          if (
            actualRole ===
            'admin'
          ) {

            window.location.href =
              'dashboard.html';

          } else {

            window.location.href =
              'borrow.html';
          }

        } catch (error) {

          console.error(
            'Login error:',
            error
          );

          alert(
            firebaseErrorMessage(
              error
            )
          );

        } finally {

          if (submitButton) {

            submitButton.disabled =
              false;

            submitButton.textContent =
              oldText;
          }
        }
      }
    );
  }


  // ============================================================
  // REGISTER
  // ============================================================

  function setupRegister() {

    const form =
      qs('#registerForm');

    if (!form) {
      return;
    }

    const nameInput =
      qs('#name');

    const emailInput =
      qs('#email');

    const passwordInput =
      qs('#password');

    const confirmPasswordInput =
      qs('#confirmPassword');

    const roleInputs =
      qsa(
        'input[name="userRole"]'
      );

    // ----------------------------------------------------------
    // Password rules
    // ----------------------------------------------------------

    if (passwordInput) {

      passwordInput.addEventListener(
        'input',
        () => {

          updatePasswordRules(
            'rule',
            passwordInput.value
          );
        }
      );

      updatePasswordRules(
        'rule',
        passwordInput.value
      );
    }

    // ----------------------------------------------------------
    // Submit Register
    // ----------------------------------------------------------

    form.addEventListener(
      'submit',
      async event => {

        event.preventDefault();

        const name =
          nameInput?.value
            ?.trim() || '';

        const email =
          emailInput?.value
            ?.trim() || '';

        const password =
          passwordInput?.value ||
          '';

        const confirmPassword =
          confirmPasswordInput?.value ||
          '';

        const selectedRole =
          (
            roleInputs.find(
              input =>
                input.checked
            )?.value
          ) || 'user';

        // ------------------------------------------------------
        // Validation
        // ------------------------------------------------------

        if (!name) {

          alert(
            'กรุณากรอกชื่อ-นามสกุล'
          );

          nameInput?.focus();

          return;
        }

        if (!email) {

          alert(
            'กรุณากรอกอีเมล'
          );

          emailInput?.focus();

          return;
        }

        if (!password) {

          alert(
            'กรุณากรอกรหัสผ่าน'
          );

          passwordInput?.focus();

          return;
        }

        if (
          !passwordValid(
            password
          )
        ) {

          alert(
            'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และต้องประกอบด้วยตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ พิมพ์เล็ก และตัวเลขอย่างน้อย 1 ตัว'
          );

          passwordInput?.focus();

          return;
        }

        if (
          password !==
          confirmPassword
        ) {

          alert(
            'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน'
          );

          confirmPasswordInput?.focus();

          return;
        }

        // ------------------------------------------------------
        // Firebase
        // ------------------------------------------------------

        const firebaseOK =
          await initFirebase();

        if (
          !firebaseOK ||
          !auth ||
          !db
        ) {

          alert(
            'ไม่สามารถเชื่อมต่อ Firebase ได้ กรุณาตรวจสอบอินเทอร์เน็ต'
          );

          return;
        }

        const submitButton =
          form.querySelector(
            'button[type="submit"]'
          );

        const oldText =
          submitButton?.textContent ||
          'ลงทะเบียน';

        if (submitButton) {

          submitButton.disabled =
            true;

          submitButton.textContent =
            'กำลังลงทะเบียน...';
        }

        try {

          // ----------------------------------------------------
          // Create Firebase Account
          // ----------------------------------------------------

          const credential =
            await auth.createUserWithEmailAndPassword(
              email,
              password
            );

          const user =
            credential.user;

          // ----------------------------------------------------
          // Update Firebase display name
          // ----------------------------------------------------

          try {

            await user.updateProfile({
              displayName:
                name
            });

          } catch (profileError) {

            console.warn(
              'Update displayName failed:',
              profileError
            );
          }

          // ----------------------------------------------------
          // Save user profile
          // ----------------------------------------------------

          const userData = {

            uid:
              user.uid,

            name,

            email,

            role:
              selectedRole,

            status:
              'active',

            createdAt:
              new Date()
                .toISOString(),

            updatedAt:
              new Date()
                .toISOString()
          };

          await db
            .collection('users')
            .doc(user.uid)
            .set(
              userData,
              {
                merge: true
              }
            );

          // ----------------------------------------------------
          // Save local
          // ----------------------------------------------------

          saveJSON(
            KEYS.currentUser,
            userData
          );

          localStorage.setItem(
            KEYS.userName,
            name
          );

          localStorage.setItem(
            KEYS.userEmail,
            email
          );

          localStorage.setItem(
            KEYS.firebaseUid,
            user.uid
          );

          localStorage.setItem(
            KEYS.userRole,
            selectedRole
          );

          // ----------------------------------------------------
          // Sign out after registration
          // ----------------------------------------------------

          await auth.signOut();

          alert(
            'ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ'
          );

          window.location.href =
            'index.html';

        } catch (error) {

          console.error(
            'Register error:',
            error
          );

          alert(
            firebaseErrorMessage(
              error
            )
          );

        } finally {

          if (submitButton) {

            submitButton.disabled =
              false;

            submitButton.textContent =
              oldText;
          }
        }
      }
    );
  }


  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  function setupForgotPassword() {

    const form =
      qs('#forgotPasswordForm');

    if (!form) {
      return;
    }

    const emailInput =
      qs('#forgotEmail');

    form.addEventListener(
      'submit',
      async event => {

        event.preventDefault();

        const email =
          emailInput?.value
            ?.trim() || '';

        if (!email) {

          alert(
            'กรุณากรอกอีเมล'
          );

          emailInput?.focus();

          return;
        }

        const firebaseOK =
          await initFirebase();

        if (
          !firebaseOK ||
          !auth
        ) {

          alert(
            'ไม่สามารถเชื่อมต่อ Firebase ได้'
          );

          return;
        }

        const button =
          form.querySelector(
            'button[type="submit"]'
          );

        const oldText =
          button?.textContent ||
          'ดำเนินการ';

        if (button) {

          button.disabled =
            true;

          button.textContent =
            'กำลังส่ง...';
        }

        try {

          // ----------------------------------------------------
          // Firebase Password Reset
          // ----------------------------------------------------

          await auth.sendPasswordResetEmail(
            email
          );

          alert(
            'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว กรุณาตรวจสอบกล่องจดหมายและโฟลเดอร์ Spam'
          );

          form.reset();

        } catch (error) {

          console.error(
            'Forgot password error:',
            error
          );

          alert(
            firebaseErrorMessage(
              error
            )
          );

        } finally {

          if (button) {

            button.disabled =
              false;

            button.textContent =
              oldText;
          }
        }
      }
    );
  }


  // ============================================================
  // RESET PASSWORD
  // ============================================================

  async function setupResetPassword() {

    const form =
      qs('#resetPasswordForm');

    if (!form) {
      return;
    }

    const passwordInput =
      qs('#newPassword') ||
      qs('#resetPassword') ||
      qs('#password');

    const confirmPasswordInput =
      qs('#confirmPassword');

    const codeInput =
      qs('#oobCode');

    const firebaseOK =
      await initFirebase();

    if (
      !firebaseOK ||
      !auth
    ) {

      alert(
        'ไม่สามารถเชื่อมต่อ Firebase ได้'
      );

      return;
    }

    // ----------------------------------------------------------
    // Get reset code from URL
    // ----------------------------------------------------------

    const params =
      new URLSearchParams(
        window.location.search
      );

    const oobCode =
      params.get(
        'oobCode'
      );

    if (codeInput) {

      codeInput.value =
        oobCode || '';
    }

    if (!oobCode) {

      alert(
        'ไม่พบรหัสรีเซ็ตรหัสผ่าน ลิงก์อาจไม่ถูกต้องหรือหมดอายุ'
      );

      return;
    }

    // ----------------------------------------------------------
    // Verify reset code
    // ----------------------------------------------------------

    try {

      const email =
        await auth.verifyPasswordResetCode(
          oobCode
        );

      const emailDisplay =
        qs('#resetEmail');

      if (emailDisplay) {

        emailDisplay.textContent =
          email;
      }

    } catch (error) {

      console.error(
        'Verify reset code error:',
        error
      );

      alert(
        firebaseErrorMessage(
          error
        )
      );

      return;
    }

    // ----------------------------------------------------------
    // Password rules
    // ----------------------------------------------------------

    if (passwordInput) {

      passwordInput.addEventListener(
        'input',
        () => {

          updatePasswordRules(
            'rule',
            passwordInput.value
          );
        }
      );

      updatePasswordRules(
        'rule',
        passwordInput.value
      );
    }

    // ----------------------------------------------------------
    // Submit reset
    // ----------------------------------------------------------

    form.addEventListener(
      'submit',
      async event => {

        event.preventDefault();

        const password =
          passwordInput?.value ||
          '';

        const confirmPassword =
          confirmPasswordInput?.value ||
          '';

        if (
          !passwordValid(
            password
          )
        ) {

          alert(
            'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และต้องมีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข'
          );

          passwordInput?.focus();

          return;
        }

        if (
          password !==
          confirmPassword
        ) {

          alert(
            'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน'
          );

          confirmPasswordInput?.focus();

          return;
        }

        const button =
          form.querySelector(
            'button[type="submit"]'
          );

        const oldText =
          button?.textContent ||
          'เปลี่ยนรหัสผ่าน';

        if (button) {

          button.disabled =
            true;

          button.textContent =
            'กำลังเปลี่ยนรหัสผ่าน...';
        }

        try {

          await auth.confirmPasswordReset(
            oobCode,
            password
          );

          alert(
            'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่'
          );

          window.location.href =
            'index.html';

        } catch (error) {

          console.error(
            'Reset password error:',
            error
          );

          alert(
            firebaseErrorMessage(
              error
            )
          );

        } finally {

          if (button) {

            button.disabled =
              false;

            button.textContent =
              oldText;
          }
        }
      }
    );
  }


  // ============================================================
  // LOGOUT
  // ============================================================

  async function logout() {

    try {

      if (auth) {
        await auth.signOut();
      }

    } catch (error) {

      console.warn(
        'Firebase logout error:',
        error
      );
    }

    localStorage.removeItem(
      KEYS.loggedIn
    );

    localStorage.removeItem(
      KEYS.currentUser
    );

    localStorage.removeItem(
      KEYS.firebaseUid
    );

    localStorage.removeItem(
      KEYS.userRole
    );

    localStorage.removeItem(
      KEYS.userName
    );

    localStorage.removeItem(
      KEYS.userEmail
    );

    window.location.href =
      'index.html';
  }


  // ============================================================
  // Setup Logout
  // ============================================================

  function setupLogout() {

    const buttons =
      qsa(
        '#logoutButton, .logout-button, [data-action="logout"]'
      );

    buttons.forEach(
      button => {

        if (
          button.dataset
            .logoutReady ===
          'true'
        ) {

          return;
        }

        button.dataset
          .logoutReady =
          'true';

        button.addEventListener(
          'click',
          async event => {

            event.preventDefault();

            const confirmed =
              confirm(
                'คุณต้องการออกจากระบบหรือไม่?'
              );

            if (!confirmed) {
              return;
            }

            await logout();
          }
        );
      }
    );
  }


  // ============================================================
  // Protect Pages
  // ============================================================

  async function requireLogin() {

    const firebaseOK =
      await initFirebase();

    if (
      !firebaseOK ||
      !auth
    ) {

      return false;
    }

    const user =
      auth.currentUser;

    if (!user) {

      window.location.href =
        'index.html';

      return false;
    }

    return true;
  }


  // ============================================================
  // Require Admin
  // ============================================================

  async function requireAdmin() {

    const firebaseOK =
      await initFirebase();

    if (
      !firebaseOK ||
      !auth
    ) {

      window.location.href =
        'index.html';

      return false;
    }

    const user =
      auth.currentUser;

    if (!user) {

      window.location.href =
        'index.html';

      return false;
    }

    const profile =
      await getUserProfile(
        user
      );

    if (
      profile?.role !==
      'admin'
    ) {

      alert(
        'หน้านี้สำหรับผู้ดูแลระบบเท่านั้น'
      );

      window.location.href =
        'borrow.html';

      return false;
    }

    return true;
  }


  // ============================================================
  // Set User Name
  // ============================================================

  async function setUserDisplay() {

    const elements =
      qsa(
        '#userName, [data-user-name]'
      );

    if (!elements.length) {
      return;
    }

    let name =
      getCurrentUserName();

    if (
      auth?.currentUser
    ) {

      const profile =
        await getUserProfile(
          auth.currentUser
        );

      name =
        profile?.name ||
        auth.currentUser
          .displayName ||
        auth.currentUser
          .email ||
        name;
    }

    elements.forEach(
      element => {

        element.textContent =
          name;
      }
    );
  }


  // ============================================================
  // Start Login/Register/Forgot/Reset
  // ============================================================

  async function initializeAuthenticationPages() {

    const hasAuthPage =
      qs('#loginForm') ||
      qs('#registerForm') ||
      qs('#forgotPasswordForm') ||
      qs('#resetPasswordForm');

    if (!hasAuthPage) {
      return;
    }

    await initFirebase();

    setupPasswordToggle();

    setupLogin();

    setupRegister();

    setupForgotPassword();

    await setupResetPassword();
  }
  // ============================================================
  // ADMIN DASHBOARD
  // ============================================================

  const ADMIN_CATEGORIES = [
    {
      key: 'ครุภัณฑ์',
      title: 'ครุภัณฑ์',
      icon: 'building',
      description: 'ครุภัณฑ์และสิ่งของที่ใช้ภายในหน่วยงาน'
    },

    {
      key: 'วัตถุดิบ',
      title: 'วัตถุดิบ',
      icon: 'box',
      description: 'วัตถุดิบและวัสดุสำหรับการใช้งาน'
    },

    {
      key: 'อุปกรณ์',
      title: 'อุปกรณ์',
      icon: 'package',
      description: 'อุปกรณ์สำหรับการเรียน การทำงาน และกิจกรรม'
    }
  ];


  // ============================================================
  // Category Normalize
  // ============================================================

  function normalizeCategory(category) {

    const value =
      String(
        category || ''
      ).trim();

    if (
      value === 'ครุภัณฑ์'
    ) {
      return 'ครุภัณฑ์';
    }

    if (
      value === 'วัตถุดิบ'
    ) {
      return 'วัตถุดิบ';
    }

    if (
      value === 'อุปกรณ์'
    ) {
      return 'อุปกรณ์';
    }

    return value || 'อุปกรณ์';
  }


  // ============================================================
  // Get Category Statistics
  // ============================================================

  function getCategoryStats(
    equipment,
    category
  ) {

    const items =
      equipment.filter(
        item =>
          normalizeCategory(
            item.category
          ) === category
      );

    let total = 0;
    let available = 0;
    let borrowed = 0;
    let unavailable = 0;

    items.forEach(
      item => {

        const itemTotal =
          Math.max(
            0,
            Number(
              item.total || 0
            )
          );

        const itemAvailable =
          Math.max(
            0,
            Number(
              item.available || 0
            )
          );

        total += itemTotal;

        available +=
          Math.min(
            itemTotal,
            itemAvailable
          );

        if (
          item.status ===
          'unavailable'
        ) {

          unavailable +=
            itemTotal -
            itemAvailable;

        } else {

          borrowed +=
            Math.max(
              0,
              itemTotal -
              itemAvailable
            );
        }
      }
    );

    return {
      itemCount:
        items.length,

      total,

      available,

      borrowed,

      unavailable,

      items
    };
  }


  // ============================================================
  // All Dashboard Statistics
  // ============================================================

  function getDashboardStats(
    equipment
  ) {

    const all =
      Array.isArray(
        equipment
      )
        ? equipment
        : [];

    let total = 0;
    let available = 0;
    let borrowed = 0;
    let unavailable = 0;

    all.forEach(
      item => {

        const itemTotal =
          Math.max(
            0,
            Number(
              item.total || 0
            )
          );

        const itemAvailable =
          Math.max(
            0,
            Number(
              item.available || 0
            )
          );

        total +=
          itemTotal;

        available +=
          Math.min(
            itemTotal,
            itemAvailable
          );

        if (
          item.status ===
          'unavailable'
        ) {

          unavailable +=
            Math.max(
              0,
              itemTotal -
              itemAvailable
            );

        } else {

          borrowed +=
            Math.max(
              0,
              itemTotal -
              itemAvailable
            );
        }
      }
    );

    return {
      itemCount:
        all.length,

      total,

      available,

      borrowed,

      unavailable
    };
  }


  // ============================================================
  // Category Icon
  // ============================================================

  function categoryIcon(
    category
  ) {

    if (
      category ===
      'ครุภัณฑ์'
    ) {

      return `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 21h18"></path>
          <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"></path>
          <path d="M9 7h6"></path>
          <path d="M9 11h6"></path>
          <path d="M9 15h6"></path>
        </svg>
      `;
    }

    if (
      category ===
      'วัตถุดิบ'
    ) {

      return `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
          <path d="m3.3 7 8.7 5 8.7-5"></path>
          <path d="M12 22V12"></path>
        </svg>
      `;
    }

    return `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="2"
        ></rect>
        <path d="M3 9h18"></path>
        <path d="M9 3v6"></path>
      </svg>
    `;
  }


  // ============================================================
  // Render Dashboard Categories
  // ============================================================

  function renderAdminCategories(
    equipment
  ) {

    const container =
      qs(
        '#adminCategoryCards'
      ) ||
      qs(
        '#categoryCards'
      ) ||
      qs(
        '.category-cards'
      );

    if (!container) {
      return;
    }

    container.innerHTML =
      ADMIN_CATEGORIES.map(
        category => {

          const stats =
            getCategoryStats(
              equipment,
              category.key
            );

          return `
            <div
              class="admin-category-card"
              data-category="${escapeHtml(
                category.key
              )}"
              role="button"
              tabindex="0"
            >

              <div class="admin-category-icon">
                ${categoryIcon(
                  category.key
                )}
              </div>

              <div class="admin-category-content">

                <h3>
                  ${escapeHtml(
                    category.title
                  )}
                </h3>

                <p>
                  ${escapeHtml(
                    category.description
                  )}
                </p>

                <div class="admin-category-total">
                  <strong>
                    ${stats.total}
                  </strong>
                  <span>
                    รายการทั้งหมด
                  </span>
                </div>

                <div class="admin-category-stats">

                  <div class="category-stat">
                    <span class="stat-label">
                      พร้อมใช้งาน
                    </span>

                    <strong class="stat-available">
                      ${stats.available}
                    </strong>
                  </div>

                  <div class="category-stat">
                    <span class="stat-label">
                      ถูกยืม
                    </span>

                    <strong class="stat-borrowed">
                      ${stats.borrowed}
                    </strong>
                  </div>

                  <div class="category-stat">
                    <span class="stat-label">
                      ไม่พร้อมใช้งาน
                    </span>

                    <strong class="stat-unavailable">
                      ${stats.unavailable}
                    </strong>
                  </div>

                </div>

                <button
                  type="button"
                  class="category-open-button"
                  data-category="${escapeHtml(
                    category.key
                  )}"
                >
                  ดูรายการ
                </button>

              </div>

            </div>
          `;
        }
      ).join('');

    // ----------------------------------------------------------
    // Click
    // ----------------------------------------------------------

    qsa(
      '.admin-category-card',
      container
    ).forEach(
      card => {

        const category =
          card.dataset.category;

        const open =
          () => {

            window.location.href =
              `equipment.html?category=${encodeURIComponent(
                category
              )}`;
          };

        card.addEventListener(
          'click',
          event => {

            if (
              event.target.closest(
                'button'
              )
            ) {

              event.stopPropagation();
            }

            open();
          }
        );

        card.addEventListener(
          'keydown',
          event => {

            if (
              event.key ===
                'Enter' ||
              event.key ===
                ' '
            ) {

              event.preventDefault();

              open();
            }
          }
        );
      }
    );

    qsa(
      '.category-open-button',
      container
    ).forEach(
      button => {

        button.addEventListener(
          'click',
          event => {

            event.preventDefault();
            event.stopPropagation();

            const category =
              button.dataset.category;

            window.location.href =
              `equipment.html?category=${encodeURIComponent(
                category
              )}`;
          }
        );
      }
    );
  }


  // ============================================================
  // Render Dashboard Summary
  // ============================================================

  function renderDashboardSummary(
    equipment
  ) {

    const stats =
      getDashboardStats(
        equipment
      );

    const values = {

      totalEquipment:
        stats.total,

      availableEquipment:
        stats.available,

      borrowedEquipment:
        stats.borrowed,

      unavailableEquipment:
        stats.unavailable
    };

    Object.entries(
      values
    ).forEach(
      ([id, value]) => {

        const element =
          document.getElementById(
            id
          );

        if (element) {

          element.textContent =
            value;
        }
      }
    );

    // Additional selectors
    const selectors = {

      '[data-total-equipment]':
        stats.total,

      '[data-available-equipment]':
        stats.available,

      '[data-borrowed-equipment]':
        stats.borrowed,

      '[data-unavailable-equipment]':
        stats.unavailable
    };

    Object.entries(
      selectors
    ).forEach(
      ([selector, value]) => {

        qsa(selector).forEach(
          element => {

            element.textContent =
              value;
          }
        );
      }
    );
  }


  // ============================================================
  // Admin Dashboard Main
  // ============================================================

  async function setupAdminDashboard() {

    const dashboard =
      qs(
        '#adminDashboard'
      ) ||
      qs(
        '.admin-dashboard'
      ) ||
      (
        location.pathname
          .endsWith(
            'dashboard.html'
          )
          ? document.body
          : null
      );

    if (!dashboard) {
      return;
    }

    // ----------------------------------------------------------
    // Admin protection
    // ----------------------------------------------------------

    const allowed =
      await requireAdmin();

    if (!allowed) {
      return;
    }

    // ----------------------------------------------------------
    // User name
    // ----------------------------------------------------------

    await setUserDisplay();

    // ----------------------------------------------------------
    // Load data
    // ----------------------------------------------------------

    await ensureEquipmentSeed();

    const equipment =
      await loadEquipmentFromFirebase();

    // ----------------------------------------------------------
    // Render
    // ----------------------------------------------------------

    renderDashboardSummary(
      equipment
    );

    renderAdminCategories(
      equipment
    );

    // ----------------------------------------------------------
    // Refresh when data changes
    // ----------------------------------------------------------

    if (
      !window.__dashboardRefreshReady
    ) {

      window.__dashboardRefreshReady =
        true;

      window.addEventListener(
        'equipmentDataChanged',
        async () => {

          const fresh =
            await loadEquipmentFromFirebase();

          renderDashboardSummary(
            fresh
          );

          renderAdminCategories(
            fresh
          );
        }
      );
    }
  }


  // ============================================================
  // Category page
  // ============================================================

  function getSelectedCategory() {

    const params =
      new URLSearchParams(
        window.location.search
      );

    return (
      params.get(
        'category'
      ) || ''
    ).trim();
  }


  // ============================================================
  // Render Equipment Category
  // ============================================================

  function renderCategoryEquipment(
    equipment,
    category
  ) {

    const items =
      equipment.filter(
        item =>
          !category ||
          normalizeCategory(
            item.category
          ) === category
      );

    const container =
      qs(
        '#equipmentList'
      ) ||
      qs(
        '#categoryEquipmentList'
      ) ||
      qs(
        '.equipment-list'
      );

    if (!container) {
      return;
    }

    if (!items.length) {

      container.innerHTML = `
        <div class="empty-state">
          <p>
            ไม่พบข้อมูลในหมวด
            ${escapeHtml(
              category || 'ทั้งหมด'
            )}
          </p>
        </div>
      `;

      return;
    }

    container.innerHTML =
      items.map(
        item => {

          const borrowed =
            Math.max(
              0,
              item.total -
              item.available
            );

          return `
            <div
              class="equipment-card"
              data-equipment-id="${escapeHtml(
                item.id
              )}"
            >

              <div class="equipment-card-header">

                <div class="equipment-icon">
                  ${categoryIcon(
                    normalizeCategory(
                      item.category
                    )
                  )}
                </div>

                <div>
                  <h3>
                    ${escapeHtml(
                      item.name
                    )}
                  </h3>

                  <p>
                    รหัส:
                    ${escapeHtml(
                      item.id
                    )}
                  </p>
                </div>

              </div>

              <div class="equipment-card-category">
                ${escapeHtml(
                  item.category
                )}
              </div>

              <div class="equipment-card-stats">

                <div>
                  <span>
                    ทั้งหมด
                  </span>

                  <strong>
                    ${item.total}
                  </strong>
                </div>

                <div>
                  <span>
                    พร้อมใช้
                  </span>

                  <strong>
                    ${item.available}
                  </strong>
                </div>

                <div>
                  <span>
                    ถูกยืม
                  </span>

                  <strong>
                    ${borrowed}
                  </strong>
                </div>

              </div>

              <div class="equipment-status">
                ${statusToThai(
                  item.status
                )}
              </div>

            </div>
          `;
        }
      ).join('');
  }


  // ============================================================
  // Setup Category Equipment Page
  // ============================================================

  async function setupCategoryEquipment() {

    const isEquipmentPage =
      location.pathname.endsWith(
        'equipment.html'
      );

    if (!isEquipmentPage) {
      return;
    }

    const allowed =
      await requireLogin();

    if (!allowed) {
      return;
    }

    await setUserDisplay();

    await ensureEquipmentSeed();

    const equipment =
      await loadEquipmentFromFirebase();

    const category =
      getSelectedCategory();

    const title =
      qs(
        '#categoryTitle'
      ) ||
      qs(
        '.category-title'
      );

    if (title) {

      title.textContent =
        category
          ? category
          : 'อุปกรณ์ทั้งหมด';
    }

    renderCategoryEquipment(
      equipment,
      category
    );
  }


  // ============================================================
  // Search Equipment
  // ============================================================

  function setupEquipmentSearch() {

    const input =
      qs(
        '#equipmentSearch'
      ) ||
      qs(
        '#searchEquipment'
      ) ||
      qs(
        '[data-equipment-search]'
      );

    if (!input) {
      return;
    }

    const container =
      qs(
        '#equipmentList'
      ) ||
      qs(
        '#categoryEquipmentList'
      ) ||
      qs(
        '.equipment-list'
      );

    if (!container) {
      return;
    }

    input.addEventListener(
      'input',
      async () => {

        const keyword =
          input.value
            .trim()
            .toLowerCase();

        const all =
          getEquipmentLocal();

        const category =
          getSelectedCategory();

        const filtered =
          all.filter(
            item => {

              const categoryMatch =
                !category ||
                normalizeCategory(
                  item.category
                ) === category;

              const text =
                [
                  item.id,
                  item.name,
                  item.category
                ]
                  .join(' ')
                  .toLowerCase();

              return (
                categoryMatch &&
                text.includes(
                  keyword
                )
              );
            }
          );

        renderCategoryEquipment(
          filtered,
          ''
        );
      }
    );
  }


  // ============================================================
  // Dashboard Navigation
  // ============================================================

  function setupDashboardNavigation() {

    qsa(
      '[data-category-link]'
    ).forEach(
      element => {

        if (
          element.dataset
            .categoryNavigationReady ===
          'true'
        ) {

          return;
        }

        element.dataset
          .categoryNavigationReady =
          'true';

        element.addEventListener(
          'click',
          event => {

            event.preventDefault();

            const category =
              element.dataset
                .categoryLink;

            if (!category) {
              return;
            }

            window.location.href =
              `equipment.html?category=${encodeURIComponent(
                category
              )}`;
          }
        );
      }
    );
  }


  // ============================================================
  // Admin Category Shortcut
  // ============================================================

  function setupAdminShortcuts() {

    qsa(
      '[data-admin-category]'
    ).forEach(
      element => {

        element.addEventListener(
          'click',
          event => {

            event.preventDefault();

            const category =
              element.dataset
                .adminCategory;

            if (!category) {
              return;
            }

            window.location.href =
              `equipment.html?category=${encodeURIComponent(
                category
              )}`;
          }
        );
      }
    );
  }
/* =========================================================
   PART 4/5
   ADMIN EQUIPMENT MANAGEMENT
   ========================================================= */

  const ADMIN_MANAGEMENT_SELECTORS = [
    '#equipmentManagement',
    '#adminEquipmentManagement',
    '#adminEquipmentList',
    '#equipmentTable',
    '#managementContent',
    '#adminContent'
  ];

  function getManagementContainer() {
    for (const selector of ADMIN_MANAGEMENT_SELECTORS) {
      const element = qs(selector);
      if (element) return element;
    }

    return null;
  }

  function sanitizeNumber(value, fallback = 0) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return fallback;
    }

    return Math.max(0, Math.floor(number));
  }

  function normalizeEquipmentForAdmin(item) {
    const equipment = normalizeEquipment(item);

    equipment.total = sanitizeNumber(equipment.total, 0);
    equipment.available = sanitizeNumber(equipment.available, 0);

    if (equipment.available > equipment.total) {
      equipment.available = equipment.total;
    }

    equipment.borrowedCount = Math.max(
      0,
      equipment.total - equipment.available
    );

    equipment.unavailableCount =
      sanitizeNumber(item.unavailableCount, 0);

    equipment.damagedCount =
      sanitizeNumber(item.damagedCount, 0);

    equipment.issuedCount =
      sanitizeNumber(
        item.issuedCount,
        equipment.borrowedCount
      );

    if (equipment.status === 'borrowed') {
      equipment.issuedCount = Math.max(
        equipment.issuedCount,
        1
      );
    }

    return equipment;
  }

  function getEquipmentById(id) {
    const equipment = loadEquipment();

    return equipment.find(
      item => String(item.id) === String(id)
    ) || null;
  }

  function getCategoryEquipment(category) {
    const equipment = loadEquipment();

    if (!category) {
      return equipment;
    }

    return equipment.filter(
      item => normalizeCategory(item.category) === category
    );
  }

  function createAdminEquipmentId() {
    const equipment = loadEquipment();

    let number = equipment.length + 1;

    let id = `EQ${String(number).padStart(3, '0')}`;

    while (
      equipment.some(
        item => String(item.id).toUpperCase() === id
      )
    ) {
      number++;
      id = `EQ${String(number).padStart(3, '0')}`;
    }

    return id;
  }

  function normalizeAdminEquipmentFormData(form) {
    const formData = new FormData(form);

    const name =
      String(
        formData.get('equipmentName') ||
        formData.get('name') ||
        ''
      ).trim();

    const category =
      normalizeCategory(
        formData.get('equipmentCategory') ||
        formData.get('category') ||
        getSelectedCategory() ||
        'อุปกรณ์'
      );

    const total =
      sanitizeNumber(
        formData.get('equipmentTotal') ||
        formData.get('total'),
        0
      );

    const available =
      sanitizeNumber(
        formData.get('equipmentAvailable') ||
        formData.get('available'),
        total
      );

    const status =
      normalizeStatus(
        formData.get('equipmentStatus') ||
        formData.get('status') ||
        'available'
      );

    const borrowedCount =
      sanitizeNumber(
        formData.get('borrowedCount') ||
        formData.get('issuedCount'),
        Math.max(0, total - available)
      );

    const unavailableCount =
      sanitizeNumber(
        formData.get('unavailableCount'),
        0
      );

    const damagedCount =
      sanitizeNumber(
        formData.get('damagedCount'),
        0
      );

    return {
      name,
      category,
      total,
      available: Math.min(available, total),
      status,
      borrowedCount,
      issuedCount: borrowedCount,
      unavailableCount,
      damagedCount
    };
  }

  function validateAdminEquipmentData(data) {
    if (!data.name) {
      return {
        valid: false,
        message: 'กรุณากรอกชื่ออุปกรณ์'
      };
    }

    if (!data.category) {
      return {
        valid: false,
        message: 'กรุณาเลือกหมวดหมู่'
      };
    }

    if (data.total < 0) {
      return {
        valid: false,
        message: 'จำนวนทั้งหมดต้องไม่ติดลบ'
      };
    }

    if (data.available < 0) {
      return {
        valid: false,
        message: 'จำนวนที่พร้อมใช้งานต้องไม่ติดลบ'
      };
    }

    if (data.available > data.total) {
      return {
        valid: false,
        message: 'จำนวนพร้อมใช้งานห้ามมากกว่าจำนวนทั้งหมด'
      };
    }

    if (data.borrowedCount < 0) {
      return {
        valid: false,
        message: 'จำนวนที่ถูกยืมต้องไม่ติดลบ'
      };
    }

    if (data.unavailableCount < 0) {
      return {
        valid: false,
        message: 'จำนวนที่ไม่พร้อมใช้งานต้องไม่ติดลบ'
      };
    }

    if (data.damagedCount < 0) {
      return {
        valid: false,
        message: 'จำนวนชำรุดต้องไม่ติดลบ'
      };
    }

    return {
      valid: true,
      message: ''
    };
  }

  function getCurrentEditor() {
    const user = getCurrentUser();

    if (!user) {
      return {
        uid: '',
        name: 'ไม่ทราบชื่อ',
        email: ''
      };
    }

    return {
      uid: user.uid || user.id || '',
      name:
        user.name ||
        user.displayName ||
        localStorage.getItem(KEYS.userName) ||
        'ผู้ดูแลระบบ',
      email:
        user.email ||
        localStorage.getItem(KEYS.userEmail) ||
        ''
    };
  }

  function createChangeDescription(
    oldData,
    newData
  ) {
    const changes = [];

    const fields = [
      ['name', 'ชื่ออุปกรณ์'],
      ['category', 'หมวดหมู่'],
      ['total', 'จำนวนทั้งหมด'],
      ['available', 'จำนวนพร้อมใช้งาน'],
      ['status', 'สถานะ'],
      ['borrowedCount', 'จำนวนที่ถูกยืม'],
      ['issuedCount', 'จำนวนที่จ่ายออก'],
      ['unavailableCount', 'จำนวนไม่พร้อมใช้งาน'],
      ['damagedCount', 'จำนวนชำรุด']
    ];

    fields.forEach(([field, label]) => {
      const oldValue = oldData[field];
      const newValue = newData[field];

      if (
        String(oldValue ?? '') !==
        String(newValue ?? '')
      ) {
        let oldDisplay = oldValue;
        let newDisplay = newValue;

        if (field === 'status') {
          oldDisplay = statusToThai(oldValue);
          newDisplay = statusToThai(newValue);
        }

        changes.push(
          `${label}: "${oldDisplay ?? '-'}" → "${newDisplay ?? '-'}"`
        );
      }
    });

    return changes;
  }

  async function saveAdminEditHistory({
    action,
    oldData = null,
    newData = null,
    equipmentId = '',
    equipmentName = '',
    category = ''
  }) {
    const editor = getCurrentEditor();

    const changes =
      action === 'create'
        ? [`สร้างอุปกรณ์ "${equipmentName}"`]
        : action === 'delete'
          ? [`ลบอุปกรณ์ "${equipmentName}"`]
          : createChangeDescription(
              oldData || {},
              newData || {}
            );

    const record = {
      id: makeId('EDIT'),
      type: 'admin_edit',
      action,
      editorUid: editor.uid,
      editorName: editor.name,
      editorEmail: editor.email,
      equipmentId,
      equipmentName,
      category,
      oldData,
      newData,
      changes,
      description:
        changes.length
          ? changes.join(', ')
          : 'ไม่มีรายละเอียดการเปลี่ยนแปลง',
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    try {
      if (db && auth && auth.currentUser) {
        await firebaseFirestoreAdd(
          'history',
          record
        );
      }
    } catch (error) {
      console.error(
        'ไม่สามารถบันทึกประวัติการแก้ไขลง Firestore:',
        error
      );
    }

    const localHistory =
      parseJSON(
        localStorage.getItem('admin_edit_history'),
        []
      );

    localHistory.unshift(record);

    localStorage.setItem(
      'admin_edit_history',
      JSON.stringify(localHistory)
    );

    return record;
  }

  async function firebaseFirestoreAdd(
    collectionName,
    data
  ) {
    if (!db) {
      return null;
    }

    const firestore =
      window.firebaseModules &&
      window.firebaseModules.firestore;

    if (
      firestore &&
      typeof firestore.addDoc === 'function' &&
      typeof firestore.collection === 'function'
    ) {
      const collectionRef =
        firestore.collection(
          db,
          collectionName
        );

      return firestore.addDoc(
        collectionRef,
        data
      );
    }

    return null;
  }

  async function firebaseFirestoreSet(
    collectionName,
    documentId,
    data
  ) {
    if (!db) {
      return null;
    }

    const firestore =
      window.firebaseModules &&
      window.firebaseModules.firestore;

    if (
      firestore &&
      typeof firestore.doc === 'function' &&
      typeof firestore.setDoc === 'function'
    ) {
      const docRef =
        firestore.doc(
          db,
          collectionName,
          documentId
        );

      return firestore.setDoc(
        docRef,
        data,
        { merge: true }
      );
    }

    return null;
  }

  async function firebaseFirestoreDelete(
    collectionName,
    documentId
  ) {
    if (!db) {
      return null;
    }

    const firestore =
      window.firebaseModules &&
      window.firebaseModules.firestore;

    if (
      firestore &&
      typeof firestore.doc === 'function' &&
      typeof firestore.deleteDoc === 'function'
    ) {
      const docRef =
        firestore.doc(
          db,
          collectionName,
          documentId
        );

      return firestore.deleteDoc(docRef);
    }

    return null;
  }

  function saveEquipmentToLocal(equipment) {
    const normalized =
      equipment.map(
        normalizeAdminEquipmentForStorage
      );

    saveJSON(
      KEYS.equipment,
      normalized
    );

    saveJSON(
      KEYS.equipmentData,
      normalized
    );

    return normalized;
  }

  function normalizeAdminEquipmentForStorage(item) {
    const equipment =
      normalizeAdminEquipmentFormDataFromObject(
        item
      );

    return {
      ...item,
      ...equipment
    };
  }

  function normalizeAdminEquipmentFormDataFromObject(
    item
  ) {
    const total =
      sanitizeNumber(item.total, 0);

    const available =
      Math.min(
        sanitizeNumber(item.available, 0),
        total
      );

    const borrowedCount =
      sanitizeNumber(
        item.borrowedCount ??
        item.issuedCount ??
        Math.max(0, total - available),
        Math.max(0, total - available)
      );

    return {
      name:
        String(item.name || '').trim(),

      category:
        normalizeCategory(
          item.category || 'อุปกรณ์'
        ),

      total,

      available,

      status:
        normalizeStatus(
          item.status || 'available'
        ),

      borrowedCount,

      issuedCount:
        sanitizeNumber(
          item.issuedCount,
          borrowedCount
        ),

      unavailableCount:
        sanitizeNumber(
          item.unavailableCount,
          0
        ),

      damagedCount:
        sanitizeNumber(
          item.damagedCount,
          0
        )
    };
  }

  async function addEquipmentByAdmin(
    data
  ) {
    const validation =
      validateAdminEquipmentData(data);

    if (!validation.valid) {
      throw new Error(
        validation.message
      );
    }

    const equipment =
      loadEquipment();

    const newEquipment = {
      id: createAdminEquipmentId(),
      name: data.name,
      category: data.category,
      icon: 'equipment',
      total: data.total,
      available: data.available,
      status: data.status,
      borrower: '',
      borrowedCount: data.borrowedCount,
      issuedCount: data.issuedCount,
      unavailableCount: data.unavailableCount,
      damagedCount: data.damagedCount,
      createdAt:
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString()
    };

    equipment.push(newEquipment);

    saveEquipmentToLocal(
      equipment
    );

    try {
      await firebaseFirestoreSet(
        'equipment',
        newEquipment.id,
        newEquipment
      );
    } catch (error) {
      console.error(
        'บันทึกอุปกรณ์ลง Firebase ไม่สำเร็จ:',
        error
      );
    }

    await saveAdminEditHistory({
      action: 'create',
      oldData: null,
      newData: newEquipment,
      equipmentId: newEquipment.id,
      equipmentName: newEquipment.name,
      category: newEquipment.category
    });

    return newEquipment;
  }

  async function updateEquipmentByAdmin(
    id,
    data
  ) {
    const validation =
      validateAdminEquipmentData(data);

    if (!validation.valid) {
      throw new Error(
        validation.message
      );
    }

    const equipment =
      loadEquipment();

    const index =
      equipment.findIndex(
        item =>
          String(item.id) === String(id)
      );

    if (index === -1) {
      throw new Error(
        'ไม่พบอุปกรณ์ที่ต้องการแก้ไข'
      );
    }

    const oldEquipment =
      normalizeAdminEquipmentForStorage(
        equipment[index]
      );

    const updatedEquipment = {
      ...equipment[index],
      ...data,
      id: equipment[index].id,
      updatedAt:
        new Date().toISOString()
    };

    equipment[index] =
      updatedEquipment;

    saveEquipmentToLocal(
      equipment
    );

    try {
      await firebaseFirestoreSet(
        'equipment',
        updatedEquipment.id,
        updatedEquipment
      );
    } catch (error) {
      console.error(
        'อัปเดตอุปกรณ์ใน Firebase ไม่สำเร็จ:',
        error
      );
    }

    await saveAdminEditHistory({
      action: 'update',
      oldData: oldEquipment,
      newData: updatedEquipment,
      equipmentId: updatedEquipment.id,
      equipmentName: updatedEquipment.name,
      category: updatedEquipment.category
    });

    return updatedEquipment;
  }

  async function deleteEquipmentByAdmin(
    id
  ) {
    const equipment =
      loadEquipment();

    const index =
      equipment.findIndex(
        item =>
          String(item.id) === String(id)
      );

    if (index === -1) {
      throw new Error(
        'ไม่พบอุปกรณ์ที่ต้องการลบ'
      );
    }

    const deletedEquipment =
      equipment[index];

    const confirmDelete =
      window.confirm(
        `ต้องการลบ "${deletedEquipment.name}" ใช่หรือไม่?`
      );

    if (!confirmDelete) {
      return false;
    }

    equipment.splice(index, 1);

    saveEquipmentToLocal(
      equipment
    );

    try {
      await firebaseFirestoreDelete(
        'equipment',
        deletedEquipment.id
      );
    } catch (error) {
      console.error(
        'ลบอุปกรณ์จาก Firebase ไม่สำเร็จ:',
        error
      );
    }

    await saveAdminEditHistory({
      action: 'delete',
      oldData: deletedEquipment,
      newData: null,
      equipmentId: deletedEquipment.id,
      equipmentName: deletedEquipment.name,
      category: deletedEquipment.category
    });

    return true;
  }

  function getAdminEquipmentFormHtml(
    equipment = null
  ) {
    const isEdit =
      Boolean(equipment);

    const item =
      equipment ||
      {
        id: '',
        name: '',
        category:
          getSelectedCategory() ||
          'อุปกรณ์',
        total: 0,
        available: 0,
        status: 'available',
        borrowedCount: 0,
        issuedCount: 0,
        unavailableCount: 0,
        damagedCount: 0
      };

    return `
      <div class="admin-equipment-form-wrapper">

        <div class="admin-form-header">
          <h2>
            ${isEdit
              ? 'แก้ไขข้อมูลอุปกรณ์'
              : 'เพิ่มอุปกรณ์ใหม่'}
          </h2>
        </div>

        <form
          id="adminEquipmentForm"
          class="admin-equipment-form"
        >

          <input
            type="hidden"
            name="equipmentId"
            value="${escapeHtml(item.id || '')}"
          >

          <div class="form-group">
            <label for="equipmentName">
              ชื่ออุปกรณ์
            </label>

            <input
              id="equipmentName"
              name="equipmentName"
              type="text"
              value="${escapeHtml(item.name || '')}"
              placeholder="กรอกชื่ออุปกรณ์"
              required
            >
          </div>

          <div class="form-group">
            <label for="equipmentCategory">
              หมวดหมู่
            </label>

            <select
              id="equipmentCategory"
              name="equipmentCategory"
              required
            >
              ${ADMIN_CATEGORIES.map(
                category => `
                  <option
                    value="${escapeHtml(category)}"
                    ${category === item.category
                      ? 'selected'
                      : ''}
                  >
                    ${escapeHtml(category)}
                  </option>
                `
              ).join('')}
            </select>
          </div>

          <div class="admin-form-grid">

            <div class="form-group">
              <label for="equipmentTotal">
                จำนวนทั้งหมด
              </label>

              <input
                id="equipmentTotal"
                name="equipmentTotal"
                type="number"
                min="0"
                value="${sanitizeNumber(item.total)}"
                required
              >
            </div>

            <div class="form-group">
              <label for="equipmentAvailable">
                จำนวนพร้อมใช้งาน
              </label>

              <input
                id="equipmentAvailable"
                name="equipmentAvailable"
                type="number"
                min="0"
                value="${sanitizeNumber(item.available)}"
                required
              >
            </div>

            <div class="form-group">
              <label for="borrowedCount">
                จำนวนที่ถูกยืม
              </label>

              <input
                id="borrowedCount"
                name="borrowedCount"
                type="number"
                min="0"
                value="${sanitizeNumber(item.borrowedCount)}"
              >
            </div>

            <div class="form-group">
              <label for="unavailableCount">
                จำนวนไม่พร้อมใช้งาน
              </label>

              <input
                id="unavailableCount"
                name="unavailableCount"
                type="number"
                min="0"
                value="${sanitizeNumber(item.unavailableCount)}"
              >
            </div>

            <div class="form-group">
              <label for="damagedCount">
                จำนวนชำรุด
              </label>

              <input
                id="damagedCount"
                name="damagedCount"
                type="number"
                min="0"
                value="${sanitizeNumber(item.damagedCount)}"
              >
            </div>

          </div>

          <div class="form-group">
            <label for="equipmentStatus">
              สถานะ
            </label>

            <select
              id="equipmentStatus"
              name="equipmentStatus"
              required
            >
              <option
                value="available"
                ${item.status === 'available'
                  ? 'selected'
                  : ''}
              >
                พร้อมใช้งาน
              </option>

              <option
                value="borrowed"
                ${item.status === 'borrowed'
                  ? 'selected'
                  : ''}
              >
                กำลังถูกยืม
              </option>

              <option
                value="unavailable"
                ${item.status === 'unavailable'
                  ? 'selected'
                  : ''}
              >
                ไม่พร้อมใช้งาน
              </option>
            </select>
          </div>

          <div class="admin-form-actions">

            <button
              type="submit"
              class="btn btn-primary"
            >
              ${isEdit
                ? 'บันทึกการแก้ไข'
                : 'เพิ่มอุปกรณ์'}
            </button>

            <button
              type="button"
              id="cancelAdminEquipmentForm"
              class="btn btn-secondary"
            >
              ยกเลิก
            </button>

          </div>

        </form>
      </div>
    `;
  }

  function renderAdminEquipmentTable(
    category = ''
  ) {
    const container =
      getManagementContainer();

    if (!container) {
      return;
    }

    const equipment =
      getCategoryEquipment(category)
        .map(
          normalizeAdminEquipmentForStorage
        );

    const title =
      category
        ? `จัดการ${category}`
        : 'จัดการข้อมูลอุปกรณ์';

    container.innerHTML = `
      <div class="admin-management-header">

        <div>
          <h1>${escapeHtml(title)}</h1>

          <p>
            ผู้ดูแลระบบสามารถเพิ่ม แก้ไข ลบ
            และเปลี่ยนสถานะข้อมูลได้
          </p>
        </div>

        <button
          type="button"
          id="addAdminEquipmentButton"
          class="btn btn-primary"
        >
          + เพิ่มอุปกรณ์
        </button>

      </div>

      <div class="admin-category-filter">

        <label for="adminCategoryFilter">
          หมวดหมู่
        </label>

        <select id="adminCategoryFilter">

          <option value="">
            ทั้งหมด
          </option>

          ${ADMIN_CATEGORIES.map(
            item => `
              <option
                value="${escapeHtml(item)}"
                ${item === category
                  ? 'selected'
                  : ''}
              >
                ${escapeHtml(item)}
              </option>
            `
          ).join('')}

        </select>

      </div>

      <div class="admin-equipment-table-wrapper">

        <table class="admin-equipment-table">

          <thead>
            <tr>
              <th>รหัส</th>
              <th>ชื่อ</th>
              <th>หมวดหมู่</th>
              <th>ทั้งหมด</th>
              <th>พร้อมใช้</th>
              <th>ถูกยืม</th>
              <th>ไม่พร้อมใช้</th>
              <th>ชำรุด</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>

          <tbody>

            ${
              equipment.length
                ? equipment.map(
                    item => `
                      <tr>

                        <td>
                          ${escapeHtml(item.id)}
                        </td>

                        <td>
                          ${escapeHtml(item.name)}
                        </td>

                        <td>
                          ${escapeHtml(item.category)}
                        </td>

                        <td>
                          ${sanitizeNumber(item.total)}
                        </td>

                        <td>
                          ${sanitizeNumber(item.available)}
                        </td>

                        <td>
                          ${sanitizeNumber(
                            item.borrowedCount
                          )}
                        </td>

                        <td>
                          ${sanitizeNumber(
                            item.unavailableCount
                          )}
                        </td>

                        <td>
                          ${sanitizeNumber(
                            item.damagedCount
                          )}
                        </td>

                        <td>
                          <span class="status-badge status-${escapeHtml(item.status)}">
                            ${escapeHtml(
                              statusToThai(
                                item.status
                              )
                            )}
                          </span>
                        </td>

                        <td>

                          <div class="admin-table-actions">

                            <button
                              type="button"
                              class="btn btn-small btn-primary"
                              data-admin-edit="${escapeHtml(item.id)}"
                            >
                              แก้ไข
                            </button>

                            <button
                              type="button"
                              class="btn btn-small btn-danger"
                              data-admin-delete="${escapeHtml(item.id)}"
                            >
                              ลบ
                            </button>

                          </div>

                        </td>

                      </tr>
                    `
                  ).join('')
                : `
                  <tr>
                    <td
                      colspan="10"
                      class="empty-state"
                    >
                      ยังไม่มีข้อมูลอุปกรณ์
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>
    `;

    const addButton =
      qs('#addAdminEquipmentButton');

    if (addButton) {
      addButton.addEventListener(
        'click',
        () => {
          showAdminEquipmentForm();
        }
      );
    }

    const categoryFilter =
      qs('#adminCategoryFilter');

    if (categoryFilter) {
      categoryFilter.addEventListener(
        'change',
        () => {
          renderAdminEquipmentTable(
            categoryFilter.value
          );
        }
      );
    }

    qsa(
      '[data-admin-edit]'
    ).forEach(button => {
      button.addEventListener(
        'click',
        () => {
          const id =
            button.dataset.adminEdit;

          const item =
            getEquipmentById(id);

          if (item) {
            showAdminEquipmentForm(item);
          }
        }
      );
    });

    qsa(
      '[data-admin-delete]'
    ).forEach(button => {
      button.addEventListener(
        'click',
        async () => {
          const id =
            button.dataset.adminDelete;

          try {
            const deleted =
              await deleteEquipmentByAdmin(
                id
              );

            if (deleted) {
              alert(
                'ลบข้อมูลอุปกรณ์เรียบร้อยแล้ว'
              );

              renderAdminEquipmentTable(
                category
              );
            }

          } catch (error) {
            console.error(error);

            alert(
              error.message ||
              'ไม่สามารถลบข้อมูลได้'
            );
          }
        }
      );
    });
  }

  function showAdminEquipmentForm(
    equipment = null
  ) {
    const container =
      getManagementContainer();

    if (!container) {
      return;
    }

    container.innerHTML =
      getAdminEquipmentFormHtml(
        equipment
      );

    const form =
      qs('#adminEquipmentForm');

    if (!form) {
      return;
    }

    form.addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        const data =
          normalizeAdminEquipmentFormData(
            form
          );

        const validation =
          validateAdminEquipmentData(
            data
          );

        if (!validation.valid) {
          alert(
            validation.message
          );

          return;
        }

        const id =
          qs(
            'input[name="equipmentId"]',
            form
          )?.value || '';

        try {
          if (id) {
            await updateEquipmentByAdmin(
              id,
              data
            );

            alert(
              'บันทึกการแก้ไขเรียบร้อยแล้ว'
            );

          } else {
            await addEquipmentByAdmin(
              data
            );

            alert(
              'เพิ่มอุปกรณ์เรียบร้อยแล้ว'
            );
          }

          renderAdminEquipmentTable(
            data.category
          );

        } catch (error) {
          console.error(error);

          alert(
            error.message ||
            'ไม่สามารถบันทึกข้อมูลได้'
          );
        }
      }
    );

    const cancelButton =
      qs(
        '#cancelAdminEquipmentForm'
      );

    if (cancelButton) {
      cancelButton.addEventListener(
        'click',
        () => {
          renderAdminEquipmentTable(
            getSelectedCategory()
          );
        }
      );
    }

    const totalInput =
      qs(
        '#equipmentTotal',
        form
      );

    const availableInput =
      qs(
        '#equipmentAvailable',
        form
      );

    const borrowedInput =
      qs(
        '#borrowedCount',
        form
      );

    if (
      totalInput &&
      availableInput &&
      borrowedInput
    ) {
      function syncBorrowedCount() {
        const total =
          sanitizeNumber(
            totalInput.value
          );

        const available =
          Math.min(
            sanitizeNumber(
              availableInput.value
            ),
            total
          );

        borrowedInput.value =
          Math.max(
            0,
            total - available
          );
      }

      totalInput.addEventListener(
        'input',
        syncBorrowedCount
      );

      availableInput.addEventListener(
        'input',
        syncBorrowedCount
      );
    }
  }

  async function setupAdminManagement() {
    const container =
      getManagementContainer();

    if (!container) {
      return;
    }

    const allowed =
      await requireAdmin();

    if (!allowed) {
      return;
    }

    renderAdminEquipmentTable(
      getSelectedCategory()
    );
  }

  function getAdminEditHistory() {
    return parseJSON(
      localStorage.getItem(
        'admin_edit_history'
      ),
      []
    );
  }

  function formatAdminHistoryAction(
    action
  ) {
    switch (action) {
      case 'create':
        return 'เพิ่มอุปกรณ์';

      case 'update':
        return 'แก้ไขข้อมูล';

      case 'delete':
        return 'ลบอุปกรณ์';

      default:
        return action || '-';
    }
  }

  function renderAdminHistory() {
    const container =
      qs('#adminEditHistory') ||
      qs('#historyContent') ||
      qs('#adminHistory');

    if (!container) {
      return;
    }

    const history =
      getAdminEditHistory();

    container.innerHTML = `
      <div class="admin-history-header">
        <h1>ประวัติการแก้ไขข้อมูล</h1>

        <p>
          ตรวจสอบการเพิ่ม แก้ไข และลบข้อมูล
          โดยผู้ดูแลระบบ
        </p>
      </div>

      <div class="admin-history-table-wrapper">

        <table class="admin-history-table">

          <thead>
            <tr>
              <th>วันที่ / เวลา</th>
              <th>ผู้แก้ไข</th>
              <th>อีเมล</th>
              <th>รายการ</th>
              <th>หมวดหมู่</th>
              <th>การดำเนินการ</th>
              <th>รายละเอียด</th>
            </tr>
          </thead>

          <tbody>

            ${
              history.length
                ? history.map(
                    record => `
                      <tr>

                        <td>
                          ${escapeHtml(
                            formatDateTime(
                              record.createdAt ||
                              record.timestamp
                            )
                          )}
                        </td>

                        <td>
                          ${escapeHtml(
                            record.editorName ||
                            '-'
                          )}
                        </td>

                        <td>
                          ${escapeHtml(
                            record.editorEmail ||
                            '-'
                          )}
                        </td>

                        <td>
                          ${escapeHtml(
                            record.equipmentName ||
                            '-'
                          )}
                        </td>

                        <td>
                          ${escapeHtml(
                            record.category ||
                            '-'
                          )}
                        </td>

                        <td>
                          ${escapeHtml(
                            formatAdminHistoryAction(
                              record.action
                            )
                          )}
                        </td>

                        <td>
                          <ul class="history-change-list">
                            ${
                              Array.isArray(
                                record.changes
                              )
                                ? record.changes.map(
                                    change =>
                                      `<li>${escapeHtml(change)}</li>`
                                  ).join('')
                                : `<li>${escapeHtml(
                                    record.description ||
                                    '-'
                                  )}</li>`
                            }
                          </ul>
                        </td>

                      </tr>
                    `
                  ).join('')
                : `
                  <tr>
                    <td
                      colspan="7"
                      class="empty-state"
                    >
                      ยังไม่มีประวัติการแก้ไข
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>
    `;
  }

  async function setupAdminHistory() {
    const container =
      qs('#adminEditHistory') ||
      qs('#historyContent') ||
      qs('#adminHistory');

    if (!container) {
      return;
    }

    const allowed =
      await requireAdmin();

    if (!allowed) {
      return;
    }

    renderAdminHistory();
  }

  function hideAdminOnlyElements() {
    const user =
      getCurrentUser();

    const isAdmin =
      Boolean(
        user &&
        (
          user.role === 'admin' ||
          localStorage.getItem(
            'userRole'
          ) === 'admin'
        )
      );

    qsa(
      '[data-admin-only]'
    ).forEach(element => {
      element.style.display =
        isAdmin
          ? ''
          : 'none';
    });
  }

  function setupAdminPageProtection() {
    const path =
      window.location.pathname
        .split('/')
        .pop()
        .toLowerCase();

    const adminPages = [
      'dashboard.html',
      'admin.html',
      'admin-management.html',
      'admin-history.html'
    ];

    if (
      adminPages.includes(path)
    ) {
      setupAdminDashboard();
    }

    if (
      path === 'equipment.html'
    ) {
      setupCategoryEquipment();
      setupAdminManagement();
    }

    if (
      path === 'history.html'
    ) {
      setupAdminHistory();
    }

    hideAdminOnlyElements();
  }

  function setupAdminCategoryLinks() {
    qsa(
      '[data-admin-category]'
    ).forEach(element => {
      element.addEventListener(
        'click',
        () => {
          const category =
            element.dataset.adminCategory;

          if (!category) {
            return;
          }

          window.location.href =
            `equipment.html?category=${encodeURIComponent(
              category
            )}`;
        }
      );
    });
  }

  function setupAdminRoleNavigation() {
    const user =
      getCurrentUser();

    if (!user) {
      return;
    }

    const isAdmin =
      user.role === 'admin' ||
      localStorage.getItem(
        'userRole'
      ) === 'admin';

    qsa(
      '[data-admin-link]'
    ).forEach(link => {
      link.style.display =
        isAdmin
          ? ''
          : 'none';
    });
  }

  function setupAdminManagementButtons() {
    qsa(
      '[data-open-admin-management]'
    ).forEach(button => {
      button.addEventListener(
        'click',
        () => {
          window.location.href =
            'equipment.html';
        }
      );
    });

    qsa(
      '[data-open-admin-history]'
    ).forEach(button => {
      button.addEventListener(
        'click',
        () => {
          window.location.href =
            'history.html';
        }
      );
    });
  }

  function initializeAdminFeatures() {
    setupAdminCategoryLinks();
    setupAdminRoleNavigation();
    setupAdminManagementButtons();
    setupAdminPageProtection();
  }
/* =========================================================
   PART 5/5
   USER BORROW / RETURN / HISTORY / NOTIFICATION
   + GLOBAL APP INITIALIZATION
   ========================================================= */

  function getCurrentPage() {
    return window.location.pathname
      .split('/')
      .pop()
      .toLowerCase();
  }

  function requireUser() {
    const user =
      getCurrentUser();

    if (!user) {
      window.location.href =
        'index.html';

      return false;
    }

    return true;
  }

  function isAdminUser() {
    const user =
      getCurrentUser();

    return Boolean(
      user &&
      (
        user.role === 'admin' ||
        localStorage.getItem(
          'userRole'
        ) === 'admin'
      )
    );
  }

  function getUserEmail() {
    const user =
      getCurrentUser();

    return (
      user?.email ||
      localStorage.getItem(
        KEYS.userEmail
      ) ||
      ''
    );
  }

  function getUserName() {
    const user =
      getCurrentUser();

    return (
      user?.name ||
      user?.displayName ||
      localStorage.getItem(
        KEYS.userName
      ) ||
      'ผู้ใช้งาน'
    );
  }

  function createBorrowRecord(
    equipment,
    quantity = 1
  ) {
    const user =
      getCurrentUser();

    return {
      id: makeId('BORROW'),

      equipmentId:
        equipment.id,

      equipmentName:
        equipment.name,

      category:
        equipment.category,

      quantity:
        sanitizeNumber(
          quantity,
          1
        ),

      userUid:
        user?.uid ||
        user?.id ||
        localStorage.getItem(
          KEYS.firebaseUid
        ) ||
        '',

      userName:
        getUserName(),

      userEmail:
        getUserEmail(),

      borrowDate:
        new Date().toISOString(),

      returnDate:
        null,

      status:
        'borrowed'
    };
  }

  function getBorrowRecords() {
    return parseJSON(
      localStorage.getItem(
        'borrow_records'
      ),
      []
    );
  }

  function saveBorrowRecords(
    records
  ) {
    localStorage.setItem(
      'borrow_records',
      JSON.stringify(records)
    );
  }

  function getCurrentUserBorrowRecords() {
    const email =
      getUserEmail();

    const uid =
      getCurrentUser()?.uid ||
      getCurrentUser()?.id ||
      localStorage.getItem(
        KEYS.firebaseUid
      );

    return getBorrowRecords()
      .filter(record =>
        (
          uid &&
          String(record.userUid) ===
          String(uid)
        ) ||
        (
          email &&
          String(record.userEmail)
            .toLowerCase() ===
          String(email)
            .toLowerCase()
        )
      );
  }

  async function borrowEquipment(
    equipmentId,
    quantity = 1
  ) {
    if (!requireUser()) {
      return false;
    }

    if (isAdminUser()) {
      alert(
        'บัญชีผู้ดูแลระบบไม่สามารถทำรายการยืมในส่วนผู้ใช้งานทั่วไปได้'
      );

      return false;
    }

    const equipment =
      getEquipmentById(
        equipmentId
      );

    if (!equipment) {
      alert(
        'ไม่พบอุปกรณ์ที่ต้องการยืม'
      );

      return false;
    }

    quantity =
      sanitizeNumber(
        quantity,
        1
      );

    if (quantity <= 0) {
      alert(
        'จำนวนที่ยืมต้องมากกว่า 0'
      );

      return false;
    }

    if (
      sanitizeNumber(
        equipment.available
      ) < quantity
    ) {
      alert(
        'จำนวนอุปกรณ์ไม่เพียงพอ'
      );

      return false;
    }

    const records =
      getBorrowRecords();

    const user =
      getCurrentUser();

    const existing =
      records.find(
        record =>
          record.equipmentId ===
            equipment.id &&
          record.status ===
            'borrowed' &&
          (
            record.userUid ===
              (
                user?.uid ||
                user?.id ||
                ''
              ) ||
            record.userEmail ===
              getUserEmail()
          )
      );

    if (existing) {
      alert(
        'คุณกำลังยืมอุปกรณ์รายการนี้อยู่แล้ว'
      );

      return false;
    }

    equipment.available =
      Math.max(
        0,
        sanitizeNumber(
          equipment.available
        ) - quantity
      );

    equipment.borrowedCount =
      sanitizeNumber(
        equipment.borrowedCount,
        0
      ) + quantity;

    equipment.issuedCount =
      sanitizeNumber(
        equipment.issuedCount,
        0
      ) + quantity;

    if (
      equipment.available === 0
    ) {
      equipment.status =
        'borrowed';
    }

    equipment.updatedAt =
      new Date().toISOString();

    const allEquipment =
      loadEquipment();

    const index =
      allEquipment.findIndex(
        item =>
          item.id ===
          equipment.id
      );

    if (index !== -1) {
      allEquipment[index] =
        equipment;

      saveEquipmentToLocal(
        allEquipment
      );
    }

    const record =
      createBorrowRecord(
        equipment,
        quantity
      );

    records.unshift(
      record
    );

    saveBorrowRecords(
      records
    );

    try {
      await firebaseFirestoreSet(
        'equipment',
        equipment.id,
        equipment
      );
    } catch (error) {
      console.error(
        'อัปเดตอุปกรณ์ใน Firebase ไม่สำเร็จ:',
        error
      );
    }

    try {
      await firebaseFirestoreAdd(
        'borrow',
        record
      );
    } catch (error) {
      console.error(
        'บันทึกรายการยืมลง Firebase ไม่สำเร็จ:',
        error
      );
    }

    const historyRecord = {
      id:
        makeId('HISTORY'),

      type:
        'borrow',

      equipmentId:
        equipment.id,

      equipmentName:
        equipment.name,

      category:
        equipment.category,

      quantity,

      userUid:
        record.userUid,

      userName:
        record.userName,

      userEmail:
        record.userEmail,

      action:
        'ยืมอุปกรณ์',

      date:
        record.borrowDate,

      createdAt:
        record.borrowDate
    };

    const history =
      loadHistory();

    history.unshift(
      historyRecord
    );

    saveHistory(
      history
    );

    try {
      await firebaseFirestoreAdd(
        'history',
        historyRecord
      );
    } catch (error) {
      console.error(
        'บันทึกประวัติการยืมไม่สำเร็จ:',
        error
      );
    }

    await createNotification({
      type: 'borrow',
      title: 'มีรายการยืมอุปกรณ์',
      message:
        `${record.userName} ยืม ${record.equipmentName} จำนวน ${quantity} รายการ`,
      equipmentId:
        equipment.id,
      equipmentName:
        equipment.name,
      userUid:
        record.userUid,
      userName:
        record.userName,
      userEmail:
        record.userEmail
    });

    return true;
  }

  async function returnEquipment(
    borrowRecordId
  ) {
    if (!requireUser()) {
      return false;
    }

    const records =
      getBorrowRecords();

    const index =
      records.findIndex(
        record =>
          String(record.id) ===
          String(borrowRecordId)
      );

    if (index === -1) {
      alert(
        'ไม่พบรายการยืม'
      );

      return false;
    }

    const record =
      records[index];

    const user =
      getCurrentUser();

    const isOwner =
      (
        record.userUid &&
        (
          record.userUid ===
          (
            user?.uid ||
            user?.id ||
            ''
          )
        )
      ) ||
      (
        record.userEmail &&
        record.userEmail.toLowerCase() ===
        getUserEmail().toLowerCase()
      );

    if (
      !isOwner &&
      !isAdminUser()
    ) {
      alert(
        'คุณไม่มีสิทธิ์คืนรายการนี้'
      );

      return false;
    }

    if (
      record.status !==
      'borrowed'
    ) {
      alert(
        'รายการนี้ถูกคืนแล้ว'
      );

      return false;
    }

    const equipment =
      getEquipmentById(
        record.equipmentId
      );

    if (!equipment) {
      alert(
        'ไม่พบข้อมูลอุปกรณ์'
      );

      return false;
    }

    const quantity =
      sanitizeNumber(
        record.quantity,
        1
      );

    equipment.available =
      Math.min(
        sanitizeNumber(
          equipment.total
        ),
        sanitizeNumber(
          equipment.available
        ) + quantity
      );

    equipment.borrowedCount =
      Math.max(
        0,
        sanitizeNumber(
          equipment.borrowedCount
        ) - quantity
      );

    equipment.issuedCount =
      Math.max(
        0,
        sanitizeNumber(
          equipment.issuedCount
        ) - quantity
      );

    if (
      equipment.available > 0
    ) {
      equipment.status =
        'available';
    }

    equipment.updatedAt =
      new Date().toISOString();

    const allEquipment =
      loadEquipment();

    const equipmentIndex =
      allEquipment.findIndex(
        item =>
          item.id ===
          equipment.id
      );

    if (
      equipmentIndex !== -1
    ) {
      allEquipment[
        equipmentIndex
      ] = equipment;

      saveEquipmentToLocal(
        allEquipment
      );
    }

    record.status =
      'returned';

    record.returnDate =
      new Date().toISOString();

    records[index] =
      record;

    saveBorrowRecords(
      records
    );

    try {
      await firebaseFirestoreSet(
        'equipment',
        equipment.id,
        equipment
      );
    } catch (error) {
      console.error(error);
    }

    try {
      await firebaseFirestoreSet(
        'borrow',
        record.id,
        record
      );
    } catch (error) {
      console.error(error);
    }

    const historyRecord = {
      id:
        makeId('HISTORY'),

      type:
        'return',

      equipmentId:
        equipment.id,

      equipmentName:
        equipment.name,

      category:
        equipment.category,

      quantity,

      userUid:
        record.userUid,

      userName:
        record.userName,

      userEmail:
        record.userEmail,

      action:
        'คืนอุปกรณ์',

      date:
        record.returnDate,

      createdAt:
        record.returnDate
    };

    const history =
      loadHistory();

    history.unshift(
      historyRecord
    );

    saveHistory(
      history
    );

    try {
      await firebaseFirestoreAdd(
        'history',
        historyRecord
      );
    } catch (error) {
      console.error(error);
    }

    await createNotification({
      type: 'return',
      title: 'มีการคืนอุปกรณ์',
      message:
        `${record.userName} คืน ${record.equipmentName} จำนวน ${quantity} รายการ`,
      equipmentId:
        equipment.id,
      equipmentName:
        equipment.name,
      userUid:
        record.userUid,
      userName:
        record.userName,
      userEmail:
        record.userEmail
    });

    return true;
  }

  function renderBorrowList() {
    const container =
      qs('#borrowList') ||
      qs('#borrowContent') ||
      qs('#borrowTableBody');

    if (!container) {
      return;
    }

    if (!requireUser()) {
      return;
    }

    const equipment =
      loadEquipment()
        .map(
          normalizeAdminEquipmentForStorage
        )
        .filter(
          item =>
            sanitizeNumber(
              item.available
            ) > 0
        );

    if (
      container.tagName ===
      'TBODY'
    ) {
      container.innerHTML =
        equipment.length
          ? equipment.map(
              item => `
                <tr>

                  <td>
                    ${escapeHtml(item.id)}
                  </td>

                  <td>
                    ${escapeHtml(item.name)}
                  </td>

                  <td>
                    ${escapeHtml(item.category)}
                  </td>

                  <td>
                    ${item.available}
                  </td>

                  <td>
                    <button
                      type="button"
                      class="btn btn-primary btn-small"
                      data-borrow-id="${escapeHtml(item.id)}"
                    >
                      ยืม
                    </button>
                  </td>

                </tr>
              `
            ).join('')
          : `
            <tr>
              <td
                colspan="5"
                class="empty-state"
              >
                ไม่มีอุปกรณ์ที่พร้อมให้ยืม
              </td>
            </tr>
          `;

    } else {
      container.innerHTML =
        equipment.length
          ? equipment.map(
              item => `
                <div class="equipment-card">

                  <div class="equipment-card-content">

                    <h3>
                      ${escapeHtml(item.name)}
                    </h3>

                    <p>
                      หมวดหมู่:
                      ${escapeHtml(item.category)}
                    </p>

                    <p>
                      พร้อมใช้งาน:
                      ${item.available}
                    </p>

                    <button
                      type="button"
                      class="btn btn-primary"
                      data-borrow-id="${escapeHtml(item.id)}"
                    >
                      ยืมอุปกรณ์
                    </button>

                  </div>

                </div>
              `
            ).join('')
          : `
            <div class="empty-state">
              ไม่มีอุปกรณ์ที่พร้อมให้ยืม
            </div>
          `;
    }

    qsa(
      '[data-borrow-id]',
      container
    ).forEach(button => {
      button.addEventListener(
        'click',
        async () => {
          const id =
            button.dataset.borrowId;

          const success =
            await borrowEquipment(
              id,
              1
            );

          if (success) {
            alert(
              'ยืมอุปกรณ์เรียบร้อยแล้ว'
            );

            renderBorrowList();
          }
        }
      );
    });
  }

  function renderReturnList() {
    const container =
      qs('#returnList') ||
      qs('#returnContent') ||
      qs('#returnTableBody');

    if (!container) {
      return;
    }

    if (!requireUser()) {
      return;
    }

    const records =
      getCurrentUserBorrowRecords()
        .filter(
          record =>
            record.status ===
            'borrowed'
        );

    if (
      container.tagName ===
      'TBODY'
    ) {
      container.innerHTML =
        records.length
          ? records.map(
              record => `
                <tr>

                  <td>
                    ${escapeHtml(
                      record.equipmentName
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      record.category
                    )}
                  </td>

                  <td>
                    ${record.quantity}
                  </td>

                  <td>
                    ${escapeHtml(
                      formatDate(
                        record.borrowDate
                      )
                    )}
                  </td>

                  <td>

                    <button
                      type="button"
                      class="btn btn-primary btn-small"
                      data-return-id="${escapeHtml(record.id)}"
                    >
                      คืนอุปกรณ์
                    </button>

                  </td>

                </tr>
              `
            ).join('')
          : `
            <tr>
              <td
                colspan="5"
                class="empty-state"
              >
                ไม่มีรายการที่กำลังยืม
              </td>
            </tr>
          `;

    } else {
      container.innerHTML =
        records.length
          ? records.map(
              record => `
                <div class="borrow-card">

                  <h3>
                    ${escapeHtml(
                      record.equipmentName
                    )}
                  </h3>

                  <p>
                    หมวดหมู่:
                    ${escapeHtml(
                      record.category
                    )}
                  </p>

                  <p>
                    จำนวน:
                    ${record.quantity}
                  </p>

                  <p>
                    วันที่ยืม:
                    ${escapeHtml(
                      formatDate(
                        record.borrowDate
                      )
                    )}
                  </p>

                  <button
                    type="button"
                    class="btn btn-primary"
                    data-return-id="${escapeHtml(record.id)}"
                  >
                    คืนอุปกรณ์
                  </button>

                </div>
              `
            ).join('')
          : `
            <div class="empty-state">
              ไม่มีรายการที่กำลังยืม
            </div>
          `;
    }

    qsa(
      '[data-return-id]',
      container
    ).forEach(button => {
      button.addEventListener(
        'click',
        async () => {
          const id =
            button.dataset.returnId;

          const success =
            await returnEquipment(
              id
            );

          if (success) {
            alert(
              'คืนอุปกรณ์เรียบร้อยแล้ว'
            );

            renderReturnList();
          }
        }
      );
    });
  }

  function renderUserHistory() {
    const container =
      qs('#userHistory') ||
      qs('#historyList') ||
      qs('#historyTableBody');

    if (!container) {
      return;
    }

    if (!requireUser()) {
      return;
    }

    const email =
      getUserEmail();

    const uid =
      getCurrentUser()?.uid ||
      getCurrentUser()?.id ||
      localStorage.getItem(
        KEYS.firebaseUid
      );

    const history =
      loadHistory()
        .filter(
          record =>
            (
              uid &&
              record.userUid === uid
            ) ||
            (
              email &&
              String(
                record.userEmail || ''
              ).toLowerCase() ===
              email.toLowerCase()
            )
        );

    if (
      container.tagName ===
      'TBODY'
    ) {
      container.innerHTML =
        history.length
          ? history.map(
              record => `
                <tr>

                  <td>
                    ${escapeHtml(
                      formatDateTime(
                        record.date ||
                        record.createdAt
                      )
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      record.equipmentName ||
                      '-'
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      record.category ||
                      '-'
                    )}
                  </td>

                  <td>
                    ${record.quantity || 1}
                  </td>

                  <td>
                    ${escapeHtml(
                      record.action ||
                      '-'
                    )}
                  </td>

                </tr>
              `
            ).join('')
          : `
            <tr>
              <td
                colspan="5"
                class="empty-state"
              >
                ยังไม่มีประวัติการยืม-คืน
              </td>
            </tr>
          `;
    } else {
      container.innerHTML =
        history.length
          ? history.map(
              record => `
                <div class="history-card">

                  <h3>
                    ${escapeHtml(
                      record.equipmentName ||
                      '-'
                    )}
                  </h3>

                  <p>
                    ${escapeHtml(
                      record.action ||
                      '-'
                    )}
                  </p>

                  <p>
                    จำนวน:
                    ${record.quantity || 1}
                  </p>

                  <p>
                    ${escapeHtml(
                      formatDateTime(
                        record.date ||
                        record.createdAt
                      )
                    )}
                  </p>

                </div>
              `
            ).join('')
          : `
            <div class="empty-state">
              ยังไม่มีประวัติการยืม-คืน
            </div>
          `;
    }
  }

  function setupUserPages() {
    const page =
      getCurrentPage();

    if (
      page ===
      'borrow.html'
    ) {
      if (
        requireUser() &&
        !isAdminUser()
      ) {
        renderBorrowList();
      }
    }

    if (
      page ===
      'return.html'
    ) {
      if (
        requireUser() &&
        !isAdminUser()
      ) {
        renderReturnList();
      }
    }

    if (
      page ===
      'history.html' &&
      !isAdminUser()
    ) {
      if (requireUser()) {
        renderUserHistory();
      }
    }
  }


  /* =========================================================
     NOTIFICATION SYSTEM
     ========================================================= */

  function getLocalNotifications() {
    return parseJSON(
      localStorage.getItem(
        'notifications'
      ),
      []
    );
  }

  function saveLocalNotifications(
    notifications
  ) {
    localStorage.setItem(
      'notifications',
      JSON.stringify(
        notifications
      )
    );
  }

  async function createNotification(
    data
  ) {
    const notification = {
      id:
        makeId('NOTI'),

      ...data,

      read:
        false,

      createdAt:
        new Date().toISOString()
    };

    const notifications =
      getLocalNotifications();

    notifications.unshift(
      notification
    );

    saveLocalNotifications(
      notifications
    );

    try {
      await firebaseFirestoreSet(
        'notifications',
        notification.id,
        notification
      );
    } catch (error) {
      console.error(
        'บันทึก notification ไม่สำเร็จ:',
        error
      );
    }

    return notification;
  }

  function getUnreadNotifications() {
    return getLocalNotifications()
      .filter(
        notification =>
          notification.read !== true
      );
  }

  function markNotificationRead(
    notificationId
  ) {
    const notifications =
      getLocalNotifications();

    const index =
      notifications.findIndex(
        notification =>
          String(
            notification.id
          ) ===
          String(
            notificationId
          )
      );

    if (index === -1) {
      return;
    }

    notifications[index].read =
      true;

    saveLocalNotifications(
      notifications
    );
  }

  function renderAdminNotifications() {
    if (!isAdminUser()) {
      return;
    }

    const container =
      qs('#notificationList') ||
      qs('#adminNotifications');

    if (!container) {
      return;
    }

    const notifications =
      getLocalNotifications();

    container.innerHTML =
      notifications.length
        ? notifications.map(
            notification => `
              <div
                class="notification-item ${
                  notification.read
                    ? 'is-read'
                    : 'is-unread'
                }"
                data-notification-id="${escapeHtml(
                  notification.id
                )}"
              >

                <strong>
                  ${escapeHtml(
                    notification.title ||
                    'แจ้งเตือน'
                  )}
                </strong>

                <p>
                  ${escapeHtml(
                    notification.message ||
                    ''
                  )}
                </p>

                <small>
                  ${escapeHtml(
                    formatDateTime(
                      notification.createdAt
                    )
                  )}
                </small>

              </div>
            `
          ).join('')
        : `
          <div class="empty-state">
            ไม่มีการแจ้งเตือน
          </div>
        `;

    qsa(
      '[data-notification-id]',
      container
    ).forEach(item => {
      item.addEventListener(
        'click',
        () => {
          markNotificationRead(
            item.dataset.notificationId
          );

          item.classList.remove(
            'is-unread'
          );

          item.classList.add(
            'is-read'
          );
        }
      );
    });
  }


  /* =========================================================
     USER DISPLAY
     ========================================================= */

  function updateUserDisplay() {
    const user =
      getCurrentUser();

    if (!user) {
      return;
    }

    const name =
      getUserName();

    qsa(
      '#userName, [data-user-name]'
    ).forEach(
      element => {
        element.textContent =
          name;
      }
    );

    qsa(
      '[data-user-email]'
    ).forEach(
      element => {
        element.textContent =
          getUserEmail();
      }
    );

    qsa(
      '[data-user-role]'
    ).forEach(
      element => {
        element.textContent =
          user.role === 'admin'
            ? 'ผู้ดูแลระบบ'
            : 'ผู้ใช้งานทั่วไป';
      }
    );
  }


  /* =========================================================
     NAVIGATION
     ========================================================= */

  function setupNavigation() {
    const page =
      getCurrentPage();

    qsa(
      'a[href]'
    ).forEach(link => {
      const href =
        link.getAttribute(
          'href'
        );

      if (!href) {
        return;
      }

      const target =
        href
          .split('?')[0]
          .split('#')[0]
          .split('/')
          .pop()
          .toLowerCase();

      if (
        target &&
        target === page
      ) {
        link.classList.add(
          'active'
        );
      }
    });
  }


  /* =========================================================
     LOGOUT BUTTON
     ========================================================= */

  function setupGlobalLogout() {
    qsa(
      '#logoutButton, [data-logout]'
    ).forEach(button => {
      button.addEventListener(
        'click',
        async () => {
          const confirmed =
            window.confirm(
              'ต้องการออกจากระบบใช่หรือไม่?'
            );

          if (!confirmed) {
            return;
          }

          await logout();
        }
      );
    });
  }


  /* =========================================================
     PAGE ACCESS CONTROL
     ========================================================= */

  async function applyPageAccessControl() {
    const page =
      getCurrentPage();

    const adminPages = [
      'dashboard.html'
    ];

    const protectedPages = [
      'borrow.html',
      'return.html',
      'history.html',
      'equipment.html'
    ];

    if (
      adminPages.includes(page)
    ) {
      const allowed =
        await requireAdmin();

      if (!allowed) {
        return false;
      }
    }

    if (
      protectedPages.includes(page)
    ) {
      if (!requireUser()) {
        return false;
      }
    }

    return true;
  }


  /* =========================================================
     FIREBASE AUTH STATE
     ========================================================= */

  function setupAuthStateListener() {
    if (
      !auth ||
      !window.firebaseModules
    ) {
      return;
    }

    const authModule =
      window.firebaseModules.auth;

    if (
      !authModule ||
      typeof authModule.onAuthStateChanged !==
        'function'
    ) {
      return;
    }

    authModule.onAuthStateChanged(
      async firebaseUser => {
        if (!firebaseUser) {
          return;
        }

        try {
          const profile =
            await getUserProfile(
              firebaseUser.uid
            );

          if (profile) {
            localStorage.setItem(
              KEYS.currentUser,
              JSON.stringify({
                ...profile,
                uid:
                  firebaseUser.uid,
                email:
                  firebaseUser.email ||
                  profile.email ||
                  ''
              })
            );

            localStorage.setItem(
              KEYS.firebaseUid,
              firebaseUser.uid
            );

            localStorage.setItem(
              KEYS.loggedIn,
              'true'
            );

            if (
              profile.name
            ) {
              localStorage.setItem(
                KEYS.userName,
                profile.name
              );
            }

            if (
              firebaseUser.email
            ) {
              localStorage.setItem(
                KEYS.userEmail,
                firebaseUser.email
              );
            }
          }
        } catch (error) {
          console.error(
            'ไม่สามารถโหลดข้อมูลผู้ใช้:',
            error
          );
        }

        updateUserDisplay();
        setupAdminRoleNavigation();
        hideAdminOnlyElements();
      }
    );
  }


  /* =========================================================
     LOAD REMEMBERED LOGIN
     ========================================================= */

  function loadRememberedLogin() {
    const remember =
      localStorage.getItem(
        'rememberMe'
      );

    if (
      remember !== 'true'
    ) {
      return;
    }

    const emailInput =
      qs('#email');

    const passwordInput =
      qs('#password');

    const rememberInput =
      qs('#rememberMe');

    const savedEmail =
      localStorage.getItem(
        'rememberedEmail'
      );

    const savedPassword =
      localStorage.getItem(
        'rememberedPassword'
      );

    if (
      emailInput &&
      savedEmail
    ) {
      emailInput.value =
        savedEmail;
    }

    if (
      passwordInput &&
      savedPassword
    ) {
      passwordInput.value =
        savedPassword;
    }

    if (
      rememberInput
    ) {
      rememberInput.checked =
        true;
    }
  }


  /* =========================================================
     ADMIN DASHBOARD REFRESH
     ========================================================= */

  function refreshDashboardData() {
    const page =
      getCurrentPage();

    if (
      page !==
      'dashboard.html'
    ) {
      return;
    }

    if (
      typeof renderDashboardSummary ===
      'function'
    ) {
      renderDashboardSummary();
    }

    if (
      typeof renderAdminCategories ===
      'function'
    ) {
      renderAdminCategories();
    }

    if (
      typeof renderAdminNotifications ===
      'function'
    ) {
      renderAdminNotifications();
    }
  }


  /* =========================================================
     EQUIPMENT DATA INITIALIZATION
     ========================================================= */

  function initializeEquipmentData() {
    let equipment =
      loadEquipment();

    if (
      !Array.isArray(equipment)
    ) {
      equipment = [];
    }

    equipment =
      equipment.map(
        normalizeAdminEquipmentForStorage
      );

    saveEquipmentToLocal(
      equipment
    );

    return equipment;
  }


  /* =========================================================
     REGISTER / LOGIN PAGE INIT
     ========================================================= */

  function initializeLoginPage() {
    setupLoginRoleUIIfAvailable();
    setupLogin();
    loadRememberedLogin();
    setupPasswordToggle();
  }

  function setupLoginRoleUIIfAvailable() {
    const roleSelect =
      qs('#loginRole');

    if (
      !roleSelect
    ) {
      return;
    }

    updateLoginRoleUI();

    roleSelect.addEventListener(
      'change',
      updateLoginRoleUI
    );
  }


  /* =========================================================
     GLOBAL INITIALIZATION
     ========================================================= */

  async function initializeApplication() {
    try {
      initializeEquipmentData();

      setupPasswordToggle();

      initializeAuthenticationPages();

      setupGlobalLogout();

      setupNavigation();

      updateUserDisplay();

      setupAuthStateListener();

      setupUserPages();

      initializeAdminFeatures();

      refreshDashboardData();

      renderAdminNotifications();
      setupForgotPassword();

      if (
        getCurrentPage() ===
        'index.html' ||
        getCurrentPage() === ''
      ) {
        loadRememberedLogin();
      }

      if (
        getCurrentPage() ===
        'register.html'
      ) {
        updatePasswordRules();
      }

    } catch (error) {
      console.error(
        'Application initialization error:',
        error
      );
    }
  }


  /* =========================================================
     DOM READY
     ========================================================= */

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      initializeApplication
    );
  } else {
    initializeApplication();
  }


  /* =========================================================
     GLOBAL FUNCTIONS
     เปิดให้ HTML เรียกใช้งานได้
     ========================================================= */

  window.EquipmentBorrowSystem = {
    borrowEquipment,
    returnEquipment,
    loadEquipment,
    saveEquipmentToLocal,
    getEquipmentById,
    getCategoryEquipment,
    getDashboardStats,
    addEquipmentByAdmin,
    updateEquipmentByAdmin,
    deleteEquipmentByAdmin,
    getAdminEditHistory,
    createNotification,
    getUnreadNotifications,
    logout
  };


  /* =========================================================
     END OF APP.JS
     ========================================================= */

})();
