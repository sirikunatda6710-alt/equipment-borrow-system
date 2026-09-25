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

  const KEYS = {
    equipment: 'equipment',
    equipmentData: 'equipment_data',
    history: 'borrow_history',
    currentUser: 'equipment_current_user',
    loggedIn: 'isLoggedIn',
    userEmail: 'userEmail',
    userName: 'userName',
    firebaseUid: 'firebaseUid'
  };

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
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[c]));
  }

  function parseJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDate(value) {
    if (!value) return '-';

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
      return value;
    }

    return d.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function formatDateTime(value) {
    if (!value) return '-';

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
      return value;
    }

    return d.toLocaleString('th-TH', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  function makeId(prefix) {
    return (
      prefix +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).slice(2, 5).toUpperCase()
    );
  }

  function statusToThai(status) {
    return (
      {
        available: 'พร้อมใช้งาน',
        borrowed: 'กำลังถูกยืม',
        unavailable: 'ไม่พร้อมใช้งาน'
      }[STATUS_MAP[status] || status]
    ) || status || '-';
  }

  function normalizeStatus(status) {
    return STATUS_MAP[status] || 'available';
  }

  function normalizeEquipment(item) {
    const total = Math.max(
      1,
      Number(item.total ?? item.quantity ?? 1)
    );

    let available = Number(item.available);

    if (!Number.isFinite(available)) {
      available = total;
    }

    available = Math.max(
      0,
      Math.min(total, available)
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

      icon: item.icon || 'package',

      total,

      available,

      status: normalizeStatus(
        item.status ||
        (
          available < total
            ? 'borrowed'
            : 'available'
        )
      ),

      borrower: String(
        item.borrower ?? ''
      ).trim(),

      createdAt:
        item.createdAt ||
        new Date().toISOString(),

      updatedAt:
        item.updatedAt ||
        new Date().toISOString()
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

    if (!Array.isArray(data)) {
      data =
        parseJSON(
          KEYS.equipmentData,
          null
        );
    }

    if (!Array.isArray(data)) {
      data =
        DEFAULT_EQUIPMENT.map(
          x => ({ ...x })
        );
    }

    data =
      data
        .map(normalizeEquipment)
        .filter(
          x => x.id && x.name
        );

    if (!data.length) {
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
            window.firebase.firestore();

          auth =
            window.firebase.auth();

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
          window.firebase.firestore();

        auth =
          window.firebase.auth();

        return true;

      })().catch(error => {

  console.error(
    'Firebase initialization error:',
    error
  );

  alert(
    'ไม่สามารถเชื่อมต่อ Firebase ได้\n' +
    (error?.message || 'กรุณาตรวจสอบการตั้งค่า Firebase')
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

      list: `
        <path d="M8 6h13"></path>

        <path d="M8 12h13"></path>

        <path d="M8 18h13"></path>

        <path
          d="M3 6h.01">
        </path>

        <path
          d="M3 12h.01">
        </path>

        <path
          d="M3 18h.01">
        </path>
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

      bell: `
        <path
          d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9">
        </path>

        <path d="M10 21h4"></path>
      `,

      "circle-user-round": `
        <circle
          cx="12"
          cy="12"
          r="9">
        </circle>

        <circle
          cx="12"
          cy="10"
          r="3">
        </circle>

        <path
          d="M7 20c1-3 3-4 5-4s4 1 5 4">
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

      "layout-dashboard": `
        <rect
          x="3"
          y="3"
          width="7"
          height="7"
          rx="1">
        </rect>

        <rect
          x="14"
          y="3"
          width="7"
          height="7"
          rx="1">
        </rect>

        <rect
          x="3"
          y="14"
          width="7"
          height="7"
          rx="1">
        </rect>

        <rect
          x="14"
          y="14"
          width="7"
          height="7"
          rx="1">
        </rect>
      `,

      "package-search": `
        <path
          d="M21 8 12 3 3 8v8l9 5 5-2.8">
        </path>

        <path
          d="M3 8l9 5 9-5">
        </path>

        <path
          d="M12 13v8">
        </path>

        <circle
          cx="17.5"
          cy="17.5"
          r="3">
        </circle>

        <path
          d="m20 20 2 2">
        </path>
      `,

      "undo-2": `
        <path
          d="M9 14 4 9l5-5">
        </path>

        <path
          d="M4 9h10a6 6 0 0 1 6 6v1">
        </path>
      `,

      history: `
        <path
          d="M3 12a9 9 0 1 0 3-6.7">
        </path>

        <path
          d="M3 4v5h5">
        </path>

        <path
          d="M12 7v5l3 2">
        </path>
      `
    };

    document
      .querySelectorAll(
        '[data-lucide]'
      )
      .forEach(
        element => {

          const name =
            element.getAttribute(
              'data-lucide'
            );

          const icon =
            icons[name];

          if (!icon) {
            return;
          }

          const svg =
            document.createElementNS(
              'http://www.w3.org/2000/svg',
              'svg'
            );

          svg.setAttribute(
            'xmlns',
            'http://www.w3.org/2000/svg'
          );

          svg.setAttribute(
            'viewBox',
            '0 0 24 24'
          );

          svg.setAttribute(
            'fill',
            'none'
          );

          svg.setAttribute(
            'stroke',
            'currentColor'
          );

          svg.setAttribute(
            'stroke-width',
            '2'
          );

          svg.setAttribute(
            'stroke-linecap',
            'round'
          );

          svg.setAttribute(
            'stroke-linejoin',
            'round'
          );

          if (
            element.className
          ) {

            svg.setAttribute(
              'class',
              element.className
            );
          }

          svg.innerHTML =
            icon;

          element.replaceWith(
            svg
          );
        }
      );
  }

  // ============================================================
  // PASSWORD SHOW / HIDE
  // ============================================================

  function setupPasswordToggle() {

    qsa(
      '.toggle-password'
    ).forEach(
      button => {

        if (
          button.dataset.passwordToggleReady ===
          'true'
        ) {
          return;
        }

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

        button.dataset.passwordToggleReady =
          'true';

        button.type =
          'button';

        button.textContent =
          input.type === 'text'
            ? 'ซ่อน'
            : 'แสดง';

        button.addEventListener(
          'click',
          () => {

            const showing =
              input.type === 'text';

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
  }
  // ============================================================
  // COMMON UI
  // ============================================================

  function setupCommonUI() {

    const name =
      getCurrentUserName();

    qsa(
      '#userName, .profile-name, #welcomeUserName'
    ).forEach(
      element => {
        element.textContent =
          name;
      }
    );

    // ----------------------------------------------------------
    // Profile
    // ----------------------------------------------------------

    const profileButton =
      qs('#profileButton');

    const profileModal =
      qs('#profileModal');

    const closeProfile =
      qs('#closeProfileModal');

    const editName =
      qs('#editUserName');

    const saveProfile =
      qs('#saveProfileButton');

    profileButton?.addEventListener(
      'click',
      () => {

        if (editName) {
          editName.value =
            getCurrentUserName();
        }

        profileModal?.classList.add(
          'show'
        );
      }
    );

    closeProfile?.addEventListener(
      'click',
      () => {

        profileModal?.classList.remove(
          'show'
        );
      }
    );

    saveProfile?.addEventListener(
      'click',
      async () => {

        const value =
          (
            editName?.value ||
            ''
          ).trim();

        if (!value) {
          return alert(
            'กรุณากรอกชื่อผู้ใช้งาน'
          );
        }

        localStorage.setItem(
          KEYS.userName,
          value
        );

        const current =
          parseJSON(
            KEYS.currentUser,
            {}
          );

        saveJSON(
          KEYS.currentUser,
          {
            ...current,
            name: value
          }
        );

        qsa(
          '#userName, .profile-name, #welcomeUserName'
        ).forEach(
          element => {
            element.textContent =
              value;
          }
        );

        try {

          if (
            db &&
            auth?.currentUser
          ) {

            await db
              .collection('users')
              .doc(
                auth.currentUser.uid
              )
              .set(
                {
                  name: value,
                  updatedAt:
                    new Date()
                      .toISOString()
                },
                {
                  merge: true
                }
              );
          }

        } catch (error) {

          console.warn(error);

        }

        profileModal?.classList.remove(
          'show'
        );
      }
    );

    // ----------------------------------------------------------
    // Logout
    // ----------------------------------------------------------

    const logoutButton =
      qs('#logoutButton');

    logoutButton?.addEventListener(
      'click',
      async () => {

        try {

          await auth?.signOut();

        } catch (_) {}

        localStorage.removeItem(
          KEYS.loggedIn
        );

        localStorage.removeItem(
          KEYS.currentUser
        );

        localStorage.removeItem(
          KEYS.userEmail
        );

        localStorage.removeItem(
          KEYS.userName
        );

        localStorage.removeItem(
          KEYS.firebaseUid
        );

        window.location.href =
          'index.html';
      }
    );

    // ----------------------------------------------------------
    // Notification
    // ----------------------------------------------------------

    const notificationCount =
      qs('#notificationCount');

    if (notificationCount) {

      const active =
        getHistoryLocal().filter(
          h =>
            h.status ===
              'borrowing' &&
            !h.actualReturnDate
        ).length;

      notificationCount.textContent =
        active;

      notificationCount.style.display =
        active ? '' : 'none';
    }

    // ----------------------------------------------------------
    // Header Search
    // ----------------------------------------------------------

    const headerSearch =
      qs('#headerSearch');

    headerSearch?.addEventListener(
      'keydown',
      e => {

        if (
          e.key !== 'Enter'
        ) {
          return;
        }

        const term =
          headerSearch.value.trim();

        if (!term) {
          return;
        }

        if (
          location.pathname.endsWith(
            'equipment.html'
          )
        ) {

          const search =
            qs('#equipmentSearch');

          if (search) {

            search.value =
              term;

            search.dispatchEvent(
              new Event('input')
            );
          }

        } else if (
          location.pathname.endsWith(
            'history.html'
          )
        ) {

          const search =
            qs('#historySearch');

          if (search) {

            search.value =
              term;

            search.dispatchEvent(
              new Event('input')
            );
          }
        }
      }
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

    if (!roleSelect) {
      return;
    }

    const role =
      roleSelect.value;

    if (
      role === 'admin'
    ) {

      if (adminCodeGroup) {

        adminCodeGroup.style.display =
          '';
      }

      if (adminCode) {

        adminCode.required =
          true;
      }

    } else {

      if (adminCodeGroup) {

        adminCodeGroup.style.display =
          'none';
      }

      if (adminCode) {

        adminCode.required =
          false;

        adminCode.value =
          '';
      }
    }
  }

  // ============================================================
  // GET CURRENT ROLE
  // ============================================================

  async function getCurrentUserRole() {

    const savedRole =
      localStorage.getItem(
        'userRole'
      );

    if (savedRole) {
      return savedRole;
    }

    const current =
      parseJSON(
        KEYS.currentUser,
        null
      );

    if (current?.role) {
      return current.role;
    }

    if (
      auth?.currentUser
    ) {

      const profile =
        await getUserProfile(
          auth.currentUser
        );

      if (profile?.role) {

        localStorage.setItem(
          'userRole',
          profile.role
        );

        return profile.role;
      }
    }

    return 'user';
  }

  // ============================================================
  // LOGIN
  // ============================================================

  // ============================================================
// LOGIN
// ============================================================

async function setupLogin() {
    const form = qs('#loginForm');

    if (!form || !auth) {
        return;
    }

    const loginRole = qs('#loginRole');
    const adminCodeGroup = qs('#adminCodeGroup');
    const adminCode = qs('#adminCode');
    const emailInput = qs('#email');
    const passwordInput = qs('#password');
    const remember = qs('#rememberMe');

    // ==========================================================
    // รหัสสำหรับยืนยันการเข้าใช้งานของผู้ดูแลระบบ
    // ==========================================================
    const ADMIN_CODE = '24236';

    // ==========================================================
    // ตั้งค่า Role เริ่มต้น
    // ==========================================================
    const params = new URLSearchParams(
        window.location.search
    );

    const roleFromUrl = params.get('role');

    const savedRole =
        localStorage.getItem(KEYS.userRole);

    if (
        loginRole &&
        (
            roleFromUrl === 'admin' ||
            roleFromUrl === 'user'
        )
    ) {
        loginRole.value = roleFromUrl;

    } else if (
        loginRole &&
        (
            savedRole === 'admin' ||
            savedRole === 'user'
        )
    ) {
        loginRole.value = savedRole;

    } else if (loginRole) {
        loginRole.value = 'user';
    }

    // ==========================================================
    // แสดง / ซ่อนช่องรหัส Admin
    // ==========================================================

    function updateLoginRoleUI() {

        const role =
            loginRole?.value || 'user';

        if (role === 'admin') {

            if (adminCodeGroup) {
                adminCodeGroup.style.display = 'block';
            }

            if (adminCode) {
                adminCode.required = true;
            }

        } else {

            if (adminCodeGroup) {
                adminCodeGroup.style.display = 'none';
            }

            if (adminCode) {
                adminCode.required = false;
                adminCode.value = '';
            }
        }
    }

    loginRole?.addEventListener(
        'change',
        updateLoginRoleUI
    );

    updateLoginRoleUI();

    // ==========================================================
    // โหลด Email ที่เคยจำไว้
    // ==========================================================

    const rememberedEmail =
        localStorage.getItem('rememberedEmail');

    const rememberedPassword =
        localStorage.getItem('rememberedPassword');

    if (rememberedEmail && emailInput) {
        emailInput.value = rememberedEmail;
    }

    if (
        rememberedPassword &&
        passwordInput
    ) {
        passwordInput.value =
            rememberedPassword;

        if (remember) {
            remember.checked = true;
        }
    }

    // ==========================================================
    // LOGIN
    // ==========================================================

    form.addEventListener(
        'submit',
        async event => {

            event.preventDefault();

            const email =
                emailInput?.value
                    ?.trim()
                    ?.toLowerCase();

            const password =
                passwordInput?.value || '';

            const selectedRole =
                loginRole?.value || 'user';

            const enteredAdminCode =
                adminCode?.value
                    ?.trim() || '';

            // --------------------------------------------------
            // ตรวจสอบข้อมูลเบื้องต้น
            // --------------------------------------------------

            if (!email) {
                alert('กรุณากรอกอีเมล');
                emailInput?.focus();
                return;
            }

            if (!password) {
                alert('กรุณากรอกรหัสผ่าน');
                passwordInput?.focus();
                return;
            }

            // --------------------------------------------------
            // ถ้าเลือก Admin ต้องกรอกรหัส 5 หลัก
            // --------------------------------------------------

            if (selectedRole === 'admin') {

                if (!enteredAdminCode) {
                    alert(
                        'กรุณากรอกรหัสผู้ดูแลระบบ 5 หลัก'
                    );

                    adminCode?.focus();
                    return;
                }

                if (!/^\d{5}$/.test(enteredAdminCode)) {
                    alert(
                        'รหัสผู้ดูแลระบบต้องเป็นตัวเลข 5 หลัก'
                    );

                    adminCode?.focus();
                    return;
                }

                if (enteredAdminCode !== ADMIN_CODE) {
                    alert(
                        'รหัสผู้ดูแลระบบไม่ถูกต้อง'
                    );

                    adminCode?.focus();
                    adminCode?.select();

                    return;
                }
            }

            // --------------------------------------------------
            // ปุ่ม Login
            // --------------------------------------------------

            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );

            const originalText =
                submitButton?.textContent ||
                'เข้าสู่ระบบ';

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent =
                    'กำลังเข้าสู่ระบบ...';
            }

            try {

                // =================================================
                // Firebase Authentication
                // =================================================

                const credential =
                    await auth.signInWithEmailAndPassword(
                        email,
                        password
                    );

                const firebaseUser =
                    credential.user;

                if (!firebaseUser) {
                    throw new Error(
                        'ไม่พบข้อมูลผู้ใช้งาน'
                    );
                }

                // =================================================
                // ดึงข้อมูล Profile จาก Firestore
                // =================================================

                let profile = null;

                try {

                    if (db) {

                        const profileSnap =
                            await db
                                .collection('users')
                                .doc(firebaseUser.uid)
                                .get();

                        if (profileSnap.exists) {
                            profile =
                                profileSnap.data();
                        }
                    }

                } catch (profileError) {

                    console.warn(
                        'ไม่สามารถอ่าน Profile:',
                        profileError
                    );
                }

                // =================================================
                // กำหนด Role จริงจาก Firestore
                // =================================================

                const actualRole =
                    profile?.role ||
                    'user';

                // =================================================
                // ตรวจสอบ Role
                // =================================================

                if (
                    selectedRole === 'admin' &&
                    actualRole !== 'admin'
                ) {

                    await auth.signOut();

                    alert(
                        'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ'
                    );

                    return;
                }

                if (
                    selectedRole === 'user' &&
                    actualRole === 'admin'
                ) {

                    await auth.signOut();

                    alert(
                        'บัญชีนี้เป็นบัญชีผู้ดูแลระบบ กรุณาเลือก "ผู้ดูแลระบบ"'
                    );

                    return;
                }

                // =================================================
                // ตรวจสอบสถานะบัญชี
                // =================================================

                if (
                    profile?.status === 'disabled' ||
                    profile?.status === 'inactive'
                ) {

                    await auth.signOut();

                    alert(
                        'บัญชีนี้ถูกระงับการใช้งาน'
                    );

                    return;
                }

                // =================================================
                // บันทึกข้อมูลผู้ใช้งาน
                // =================================================

                const displayName =
                    profile?.name ||
                    firebaseUser.displayName ||
                    email;

                localStorage.setItem(
                    KEYS.loggedIn,
                    'true'
                );

                localStorage.setItem(
                    KEYS.currentUser,
                    displayName
                );

                localStorage.setItem(
                    KEYS.userName,
                    displayName
                );

                localStorage.setItem(
                    KEYS.userEmail,
                    email
                );

                localStorage.setItem(
                    KEYS.firebaseUid,
                    firebaseUser.uid
                );

                localStorage.setItem(
                    KEYS.userRole,
                    actualRole
                );

                // =================================================
                // จดจำ Email + Password
                // =================================================

                if (remember?.checked) {

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

                // =================================================
                // เก็บเวลา Login ล่าสุด
                // =================================================

                localStorage.setItem(
                    'lastLoginAt',
                    new Date().toISOString()
                );

                // =================================================
                // Redirect ตาม Role
                // =================================================

                if (actualRole === 'admin') {

                    window.location.href =
                        'dashboard.html';

                } else {

                    // ผู้ใช้งานทั่วไป
                    // ยังไม่เปิดหน้า Admin Dashboard
                    window.location.href =
                        'borrow.html';
                }

            } catch (error) {

                console.error(
                    'Login error:',
                    error
                );

                let message =
                    'ไม่สามารถเข้าสู่ระบบได้';

                switch (error?.code) {

                    case 'auth/invalid-email':
                        message =
                            'รูปแบบอีเมลไม่ถูกต้อง';
                        break;

                    case 'auth/user-not-found':
                        message =
                            'ไม่พบบัญชีผู้ใช้งานนี้';
                        break;

                    case 'auth/wrong-password':
                        message =
                            'รหัสผ่านไม่ถูกต้อง';
                        break;

                    case 'auth/invalid-credential':
                        message =
                            'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
                        break;

                    case 'auth/user-disabled':
                        message =
                            'บัญชีนี้ถูกระงับการใช้งาน';
                        break;

                    case 'auth/too-many-requests':
                        message =
                            'มีการพยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่';
                        break;

                    case 'auth/network-request-failed':
                        message =
                            'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้';
                        break;

                    default:
                        message =
                            error?.message ||
                            'ไม่สามารถเข้าสู่ระบบได้';
                }

                alert(message);

            } finally {

                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent =
                        originalText;
                }
            }
        }
    );
}
  // ============================================================
// PASSWORD VALIDATION
// ============================================================

function passwordValid(password) {

    if (!password) {
        return false;
    }

    const hasUpper =
        /[A-Z]/.test(password);

    const hasLower =
        /[a-z]/.test(password);

    const hasNumber =
        /[0-9]/.test(password);

    const isLongEnough =
        password.length >= 8;

    return (
        hasUpper &&
        hasLower &&
        hasNumber &&
        isLongEnough
    );
}


// ============================================================
// UPDATE PASSWORD RULES
// ============================================================

function updatePasswordRules(
    type,
    password
) {

    const value =
        String(password || '');


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
// REGISTER
// ============================================================
  // ============================================================
  // REGISTER
  // ============================================================

  async function setupRegister() {

    const form =
      qs('#registerForm');

    if (
      !form ||
      !auth
    ) {
      return;
    }

    const password =
      qs('#password');

    const confirm =
      qs('#confirmPassword');

    // ----------------------------------------------------------
    // Password Rules
    // ----------------------------------------------------------

    password?.addEventListener(
      'input',
      () => {

        updatePasswordRules(
          'rule',
          password.value
        );
      }
    );

    // ----------------------------------------------------------
    // Submit Register
    // ----------------------------------------------------------

    form.addEventListener(
      'submit',
      async e => {

        e.preventDefault();

        const name =
          (
            qs('#name')?.value ||
            ''
          ).trim();

        const email =
          (
            qs('#email')?.value ||
            ''
          ).trim().toLowerCase();

        const pass =
          password?.value ||
          '';

        const confirmPass =
          confirm?.value ||
          '';

        // ------------------------------------------------------
        // Role
        // ------------------------------------------------------

        const role =
          qs('#registerRole')?.value ||
          qs(
            'input[name="userRole"]:checked'
          )?.value ||
          'user';

        // ------------------------------------------------------
        // Validation
        // ------------------------------------------------------

        if (
          !name ||
          !email ||
          !pass ||
          !confirmPass
        ) {

          return alert(
            'กรุณากรอกข้อมูลให้ครบ'
          );
        }

        if (
          !passwordValid(pass)
        ) {

          return alert(
            'รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข'
          );
        }

        if (
          pass !==
          confirmPass
        ) {

          return alert(
            'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน'
          );
        }

        const submitButton =
          form.querySelector(
            '[type="submit"]'
          );

        if (submitButton) {

          submitButton.disabled =
            true;
        }

        try {

          // ----------------------------------------------------
          // Create Firebase Account
          // ----------------------------------------------------

          const credential =
            await auth
              .createUserWithEmailAndPassword(
                email,
                pass
              );

          const user =
            credential.user;

          // ----------------------------------------------------
          // Display Name
          // ----------------------------------------------------

          try {

            await user.updateProfile(
              {
                displayName:
                  name
              }
            );

          } catch (_) {}

          // ----------------------------------------------------
          // Save User Profile
          // ----------------------------------------------------

          await db
            .collection('users')
            .doc(user.uid)
            .set(
              {
                uid:
                  user.uid,

                name:
                  name,

                email:
                  email,

                role:
                  role,

                status:
                  'active',

                createdAt:
                  new Date()
                    .toISOString(),

                updatedAt:
                  new Date()
                    .toISOString()
              },
              {
                merge: true
              }
            );

          // ----------------------------------------------------
          // Logout หลังสมัครเสร็จ
          // ----------------------------------------------------

          await auth.signOut();

          // ----------------------------------------------------
          // ส่ง Email กลับไปหน้า Login
          // ----------------------------------------------------

          localStorage.setItem(
            'registerEmail',
            email
          );

          localStorage.setItem(
            'registerRole',
            role
          );

          alert(
            'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ'
          );

          // ----------------------------------------------------
          // กลับ Login พร้อม Role
          // ----------------------------------------------------

          window.location.href =
            `index.html?role=${encodeURIComponent(
              role
            )}`;

        } catch (error) {

          console.error(
            'Register Error:',
            error
          );

          alert(
            firebaseErrorMessage(
              error
            )
          );

        } finally {

          if (
            submitButton
          ) {

            submitButton.disabled =
              false;
          }
        }
      }
    );
  }
  async function saveEquipmentFirebase(
    item
  ) {

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
            new Date().toISOString()
        },
        {
          merge: true
        }
      );
  }


  async function deleteEquipmentFirebase(
    id
  ) {

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


  async function saveHistoryFirebase(
    record
  ) {

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
            new Date().toISOString()
        },
        {
          merge: true
        }
      );
  }


  async function saveInventoryHistory({
    equipment,
    action,
    quantity = 0,
    beforeQuantity = 0,
    afterQuantity = 0,
    beforeStatus = '',
    afterStatus = '',
    note = ''
  }) {

    if (
      !auth?.currentUser ||
      !db
    ) {
      throw new Error(
        'ไม่พบผู้ใช้งานที่เข้าสู่ระบบ'
      );
    }

    const user =
      auth.currentUser;

    let userName =
      localStorage.getItem(
        'userName'
      ) ||
      user.displayName ||
      user.email ||
      'ผู้ใช้งาน';

    try {

      const userSnap =
        await db
          .collection('users')
          .doc(user.uid)
          .get();

      if (
        userSnap.exists &&
        userSnap.data().name
      ) {

        userName =
          userSnap.data().name;
      }

    } catch (error) {

      console.warn(
        'อ่านชื่อผู้ใช้งานไม่ได้:',
        error
      );
    }


    const record = {

      id:
        makeId('HIS'),

      equipmentId:
        equipment.id,

      equipmentName:
        equipment.name,

      category:
        equipment.category ||
        'ทั่วไป',

      action,

      quantity:
        Number(quantity) || 0,

      beforeQuantity:
        Number(beforeQuantity) || 0,

      afterQuantity:
        Number(afterQuantity) || 0,

      beforeStatus,

      afterStatus,

      userUid:
        user.uid,

      userName,

      userEmail:
        user.email || '',

      note:
        String(
          note || ''
        ).trim(),

      createdAt:
        new Date().toISOString()
    };


    await db
      .collection('history')
      .doc(record.id)
      .set(record);

    return record;
  }


  async function saveBorrowFirebase(
    record
  ) {

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
            new Date().toISOString()
        },
        {
          merge: true
        }
      );
  }


  async function updateBorrowFirebase(
    record
  ) {

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
            new Date().toISOString()
        },
        {
          merge: true
        }
      );
  }


  async function issueStock(
    item,
    quantity,
    note = ''
  ) {

    const qty =
      Number(quantity);


    if (
      !Number.isFinite(qty) ||
      qty <= 0
    ) {

      throw new Error(
        'จำนวนที่เบิกต้องมากกว่า 0'
      );
    }


    if (
      qty >
      Number(item.available)
    ) {

      throw new Error(
        'จำนวนที่เบิกมากกว่าจำนวนคงเหลือ'
      );
    }


    const beforeQuantity =
      Number(item.available) || 0;


    const beforeStatus =
      calculateStockStatus(
        beforeQuantity
      );


    const afterQuantity =
      beforeQuantity - qty;


    const afterStatus =
      calculateStockStatus(
        afterQuantity
      );


    const updatedItem = {

      ...item,

      available:
        afterQuantity,

      status:
        afterStatus,

      updatedAt:
        new Date().toISOString()
    };


    /*
     * 1. บันทึกคลัง
     */

    await saveEquipmentFirebase(
      updatedItem
    );


    /*
     * 2. บันทึกประวัติ
     */

    await saveInventoryHistory({

      equipment:
        item,

      action:
        'เบิกจ่าย',

      quantity:
        qty,

      beforeQuantity,

      afterQuantity,

      beforeStatus:
        statusToThai(
          beforeStatus
        ),

      afterStatus:
        statusToThai(
          afterStatus
        ),

      note

    });


    /*
     * 3. ถ้าเหลือ 0
     *    ให้แจ้งผู้ดูแล
     */

    if (
      afterQuantity === 0 &&
      beforeQuantity > 0
    ) {

      await createStockEmptyNotification(
        updatedItem
      );
    }


    return updatedItem;
  }


  async function addStock(
    item,
    quantity,
    note = ''
  ) {

    const qty =
      Number(quantity);


    if (
      !Number.isFinite(qty) ||
      qty <= 0
    ) {

      throw new Error(
        'จำนวนที่เพิ่มต้องมากกว่า 0'
      );
    }


    const beforeQuantity =
      Number(item.available) || 0;


    const beforeStatus =
      calculateStockStatus(
        beforeQuantity
      );


    const afterQuantity =
      beforeQuantity + qty;


    const afterStatus =
      calculateStockStatus(
        afterQuantity
      );


    const updatedItem = {

      ...item,

      total:
        Number(
          item.total || 0
        ) + qty,

      available:
        afterQuantity,

      status:
        afterStatus,

      updatedAt:
        new Date().toISOString()
    };


    /*
     * บันทึกข้อมูลคลัง
     */

    await saveEquipmentFirebase(
      updatedItem
    );


    /*
     * บันทึกประวัติ
     */

    await saveInventoryHistory({

      equipment:
        item,

      action:
        'เพิ่มเติม',

      quantity:
        qty,

      beforeQuantity,

      afterQuantity,

      beforeStatus:
        statusToThai(
          beforeStatus
        ),

      afterStatus:
        statusToThai(
          afterStatus
        ),

      note

    });


    return updatedItem;
  }


  async function changeEquipmentStatus(
    item,
    newStatus,
    note = ''
  ) {

    const normalized =
      normalizeStatus(
        newStatus
      );


    if (
      normalized !== 'in_use' &&
      normalized !== 'out'
    ) {

      throw new Error(
        'สถานะไม่ถูกต้อง'
      );
    }


    const beforeStatus =
      calculateStockStatus(
        item.available
      );


    const afterStatus =
      normalized;


    const updatedItem = {

      ...item,

      status:
        afterStatus,

      updatedAt:
        new Date().toISOString()
    };


    await saveEquipmentFirebase(
      updatedItem
    );


    await saveInventoryHistory({

      equipment:
        item,

      action:
        'แก้ไขสถานะ',

      quantity:
        0,

      beforeQuantity:
        item.available,

      afterQuantity:
        item.available,

      beforeStatus:
        statusToThai(
          beforeStatus
        ),

      afterStatus:
        statusToThai(
          afterStatus
        ),

      note

    });


    /*
     * ถ้าแก้เป็น "หมด"
     * ให้แจ้งเตือนผู้ดูแล
     */

    if (
      afterStatus === 'out' &&
      beforeStatus !== 'out'
    ) {

      await createStockEmptyNotification(
        updatedItem
      );
    }


    return updatedItem;
  }


  async function createStockEmptyNotification(
    item
  ) {

    if (
      !db ||
      !auth?.currentUser ||
      !item
    ) {
      return;
    }


    try {

      /*
       * ป้องกันการแจ้งเตือนซ้ำ
       */

      const existing =
        await db
          .collection(
            'notifications'
          )
          .where(
            'targetRole',
            '==',
            'admin'
          )
          .where(
            'equipmentId',
            '==',
            item.id
          )
          .where(
            'status',
            '==',
            'unread'
          )
          .get();


      if (
        !existing.empty
      ) {
        return;
      }


      const id =
        makeId('NOTI');


      await db
        .collection(
          'notifications'
        )
        .doc(id)
        .set({

          id,

          type:
            'stock_empty',

          targetRole:
            'admin',

          equipmentId:
            item.id,

          equipmentName:
            item.name,

          category:
            item.category ||
            'ทั่วไป',

          message:
            `อุปกรณ์ "${item.name}" หมดแล้ว`,

          status:
            'unread',

          createdAt:
            new Date().toISOString(),

          createdByUid:
            auth.currentUser.uid

        });

    } catch (error) {

      console.error(
        'สร้างการแจ้งเตือนไม่สำเร็จ:',
        error
      );
    }
  }


  async function loadAdminNotifications() {

    if (
      !db ||
      !auth?.currentUser
    ) {
      return [];
    }


    try {

      const snapshot =
        await db
          .collection(
            'notifications'
          )
          .where(
            'targetRole',
            '==',
            'admin'
          )
          .limit(50)
          .get();


      const data =
        snapshot.docs.map(
          doc => ({

            id:
              doc.id,

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


      return data.slice(
        0,
        30
      );

    } catch (error) {

      console.error(
        'โหลดแจ้งเตือนไม่สำเร็จ:',
        error
      );

      return [];
    }
  }


  async function getUnreadNotificationCount() {

    const notifications =
      await loadAdminNotifications();

    return notifications.filter(
      notification =>
        notification.status ===
        'unread'
    ).length;
  }


  async function markNotificationAsRead(
    notificationId
  ) {

    if (
      !db ||
      !notificationId
    ) {
      return;
    }


    await db
      .collection(
        'notifications'
      )
      .doc(
        notificationId
      )
      .update({

        status:
          'read',

        readAt:
          new Date().toISOString(),

        readByUid:
          auth?.currentUser?.uid ||
          ''

      });
  }


  async function setupDashboardNotifications() {

    const button =
      qs(
        '#notificationButton'
      );

    const count =
      qs(
        '#notificationCount'
      );


    if (
      !button ||
      !count
    ) {
      return;
    }


    let panel =
      qs(
        '#notificationPanel'
      );


    if (!panel) {

      panel =
        document.createElement(
          'div'
        );

      panel.id =
        'notificationPanel';

      panel.className =
        'notification-panel';

      panel.innerHTML = `

        <div class="notification-header">

          <strong>
            การแจ้งเตือน
          </strong>

          <button
            type="button"
            id="closeNotificationPanel"
            class="notification-close"
          >
            ×
          </button>

        </div>

        <div
          id="notificationList"
          class="notification-list"
        >

          <div class="notification-empty">
            กำลังโหลด...
          </div>

        </div>
      `;

      button.parentElement?.appendChild(
        panel
      );
    }


    const list =
      qs(
        '#notificationList',
        panel
      );


    const close =
      qs(
        '#closeNotificationPanel',
        panel
      );


    const render =
      async () => {

        const notifications =
          await loadAdminNotifications();


        const unread =
          notifications.filter(
            notification =>
              notification.status ===
              'unread'
          ).length;


        count.textContent =
          unread;


        count.style.display =
          unread > 0
            ? ''
            : 'none';


        if (!list) {
          return;
        }


        if (
          !notifications.length
        ) {

          list.innerHTML =
            '<div class="notification-empty">ไม่มีการแจ้งเตือน</div>';

          return;
        }


        list.innerHTML =
          notifications
            .map(
              notification => `

                <button
                  type="button"
                  class="notification-item ${
                    notification.status ===
                    'unread'
                      ? 'unread'
                      : ''
                  }"
                  data-notification-id="${
                    escapeHtml(
                      notification.id
                    )
                  }"
                >

                  <strong>
                    ${
                      escapeHtml(
                        notification.message ||
                        notification.equipmentName ||
                        'แจ้งเตือน'
                      )
                    }
                  </strong>

                  <span>
                    ${
                      escapeHtml(
                        notification.category ||
                        ''
                      )
                    }
                  </span>

                  <small>
                    ${
                      escapeHtml(
                        formatDateTime(
                          notification.createdAt
                        )
                      )
                    }
                  </small>

                </button>

              `
            )
            .join('');


        qsa(
          '[data-notification-id]',
          list
        ).forEach(
          item => {

            item.addEventListener(
              'click',
              async () => {

                try {

                  await markNotificationAsRead(
                    item.dataset
                      .notificationId
                  );

                } catch (error) {

                  console.error(
                    'อ่านแจ้งเตือนไม่สำเร็จ:',
                    error
                  );
                }

                await render();
              }
            );
          }
        );
      };


    if (
      button.dataset
        .notificationReady !==
      'true'
    ) {

      button.dataset
        .notificationReady =
        'true';


      button.addEventListener(
        'click',
        async event => {

          event.stopPropagation();

          panel.classList.toggle(
            'show'
          );

          if (
            panel.classList.contains(
              'show'
            )
          ) {

            await render();
          }
        }
      );


      close?.addEventListener(
        'click',
        event => {

          event.stopPropagation();

          panel.classList.remove(
            'show'
          );
        }
      );


      document.addEventListener(
        'click',
        event => {

          if (
            !panel.contains(
              event.target
            ) &&
            !button.contains(
              event.target
            )
          ) {

            panel.classList.remove(
              'show'
            );
          }
        }
      );
    }


    await render();
  }
    // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  async function setupForgotPassword() {

    const form =
      qs('#forgotPasswordForm');

    if (
      !form ||
      !auth
    ) {
      return;
    }

    const emailInput =
      qs('#forgotEmail');

    form.addEventListener(
      'submit',
      async event => {

        event.preventDefault();

        const email =
          (
            emailInput?.value ||
            ''
          )
            .trim()
            .toLowerCase();

        if (!email) {

          alert(
            'กรุณากรอกอีเมล'
          );

          emailInput?.focus();

          return;
        }

        const submitButton =
          form.querySelector(
            '[type="submit"]'
          );

        if (submitButton) {

          submitButton.disabled =
            true;

          submitButton.textContent =
            'กำลังส่งลิงก์...';
        }

        try {

          /*
           * ส่งอีเมลสำหรับรีเซ็ตรหัสผ่าน
           */

          const actionCodeSettings = {

            url:
              `${window.location.origin}${window.location.pathname.replace(
                /forgot-password\.html$/,
                'reset-password.html'
              )}`,

            handleCodeInApp:
              true
          };


          await auth.sendPasswordResetEmail(
            email,
            actionCodeSettings
          );


          /*
           * จำอีเมลไว้
           */

          localStorage.setItem(
            'resetEmail',
            email
          );


          alert(
            'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบกล่องจดหมายหรือ Spam'
          );


          /*
           * กลับหน้า Login
           */

          window.location.href =
            'index.html';

        } catch (error) {

          console.error(
            'Forgot Password Error:',
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
              'ดำเนินการต่อ';
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

    if (
      !form ||
      !auth
    ) {
      return;
    }


    const newPassword =
      qs('#newPassword');

    const confirmPassword =
      qs('#confirmNewPassword');


    /*
     * แสดงกฎรหัสผ่านแบบทันที
     */

    newPassword?.addEventListener(
      'input',
      () => {

        updatePasswordRules(
          'rule',
          newPassword.value
        );
      }
    );


    form.addEventListener(
      'submit',
      async event => {

        event.preventDefault();


        const password =
          newPassword?.value ||
          '';

        const confirm =
          confirmPassword?.value ||
          '';


        /*
         * อ่าน oobCode จาก URL
         */

        const params =
          new URLSearchParams(
            window.location.search
          );

        const mode =
          params.get('mode');

        const oobCode =
          params.get('oobCode');


        /*
         * ตรวจลิงก์
         */

        if (
          mode !==
            'resetPassword' ||
          !oobCode
        ) {

          alert(
            'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว'
          );

          return;
        }


        /*
         * ตรวจรหัสผ่าน
         */

        if (
          !passwordValid(
            password
          )
        ) {

          alert(
            'รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข'
          );

          newPassword?.focus();

          return;
        }


        if (
          password !==
          confirm
        ) {

          alert(
            'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน'
          );

          confirmPassword?.focus();

          return;
        }


        const submitButton =
          form.querySelector(
            '[type="submit"]'
          );


        if (submitButton) {

          submitButton.disabled =
            true;

          submitButton.textContent =
            'กำลังเปลี่ยนรหัสผ่าน...';
        }


        try {

          /*
           * ตรวจสอบว่า Code ยังใช้ได้
           */

          await auth.verifyPasswordResetCode(
            oobCode
          );


          /*
           * ตั้งรหัสผ่านใหม่
           */

          await auth.confirmPasswordReset(
            oobCode,
            password
          );


          /*
           * สำเร็จ
           */

          alert(
            'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่'
          );


          window.location.href =
            'index.html';


        } catch (error) {

          console.error(
            'Reset Password Error:',
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
              'เปลี่ยนรหัสผ่าน';
          }
        }
      }
    );
  }


  // ============================================================
  // DASHBOARD
  // ============================================================

  async function setupDashboard() {

    const dashboard =
      qs('#totalEquipment');

    /*
     * ถ้าไม่ใช่หน้า Dashboard
     */

    if (!dashboard) {
      return;
    }


    const totalElement =
      qs('#totalEquipment');

    const availableElement =
      qs('#availableEquipment');

    const borrowedElement =
      qs('#borrowedEquipment');

    const unavailableElement =
      qs('#unavailableEquipment');


    /*
     * ดึงข้อมูลอุปกรณ์
     */

    async function refreshDashboard() {

      let equipment =
        getEquipmentLocal();


      try {

        if (
          db &&
          auth?.currentUser
        ) {

          equipment =
            await loadEquipmentFromFirebase();
        }

      } catch (error) {

        console.warn(
          'โหลดข้อมูล Dashboard ไม่สำเร็จ:',
          error
        );
      }


      /*
       * จำนวนรายการอุปกรณ์
       */

      const total =
        equipment.length;


      /*
       * จำนวนอุปกรณ์ที่ยังมีอยู่
       */

      const available =
        equipment.reduce(
          (
            sum,
            item
          ) =>
            sum +
            Number(
              item.available || 0
            ),
          0
        );


      /*
       * จำนวนที่ถูกเบิกใช้
       */

      const borrowed =
        equipment.reduce(
          (
            sum,
            item
          ) => {

            const total =
              Number(
                item.total || 0
              );

            const remain =
              Number(
                item.available || 0
              );

            return (
              sum +
              Math.max(
                0,
                total - remain
              )
            );
          },
          0
        );


      /*
       * จำนวนที่หมด
       */

      const unavailable =
        equipment.filter(
          item =>
            Number(
              item.available || 0
            ) <= 0
        ).length;


      if (totalElement) {

        totalElement.textContent =
          total;
      }


      if (availableElement) {

        availableElement.textContent =
          available;
      }


      if (borrowedElement) {

        borrowedElement.textContent =
          borrowed;
      }


      if (unavailableElement) {

        unavailableElement.textContent =
          unavailable;
      }


      /*
       * อัปเดตชื่อผู้ใช้
       */

      const name =
        getCurrentUserName();

      qsa(
        '#userName, .profile-name, #welcomeUserName'
      ).forEach(
        element => {

          element.textContent =
            name;
        }
      );
    }


    await refreshDashboard();


    /*
     * เมื่อข้อมูลอุปกรณ์เปลี่ยน
     * Dashboard จะอัปเดตทันที
     */

    window.addEventListener(
      'equipmentDataChanged',
      refreshDashboard
    );


    /*
     * ถ้าเปิด Dashboard ทิ้งไว้
     * ให้รีเฟรชข้อมูลเป็นระยะ
     */

    const refreshButton =
      qs('#refreshDashboardButton');

    refreshButton?.addEventListener(
      'click',
      async () => {

        await refreshDashboard();

        alert(
          'อัปเดตข้อมูลเรียบร้อยแล้ว'
        );
      }
    );
  }


  // ============================================================
  // EQUIPMENT PAGE
  // ============================================================

  async function setupEquipmentPage() {

    const table =
      qs('#equipmentTable');

    if (!table) {
      return;
    }


    /*
     * ตรวจสิทธิ์ Admin
     */

    const role =
      await getCurrentUserRole();

    if (
      role &&
      role !== 'admin'
    ) {
      return;
    }


    const search =
      qs('#equipmentSearch');

    const modal =
      qs('#equipmentFormModal');

    const form =
      qs('#equipmentForm');

    const addButton =
      qs('#addEquipmentButton');

    const closeButton =
      qs('#closeEquipmentFormModal');

    const idInput =
      qs('#equipmentId');

    const nameInput =
      qs('#equipmentName');

    const categoryInput =
      qs('#equipmentCategory');

    const totalInput =
      qs('#equipmentTotal');

    const availableInput =
      qs('#equipmentAvailable');

    const statusInput =
      qs('#equipmentStatus');


    /*
     * Render ตารางอุปกรณ์
     */

    function renderEquipment() {

      const term =
        (
          search?.value ||
          ''
        )
          .trim()
          .toLowerCase();


      const equipment =
        getEquipmentLocal()
          .filter(
            item => {

              if (!term) {
                return true;
              }

              return (

                item.id
                  .toLowerCase()
                  .includes(term)

                ||

                item.name
                  .toLowerCase()
                  .includes(term)

                ||

                item.category
                  .toLowerCase()
                  .includes(term)

              );
            }
          );


      /*
       * ถ้า table เป็น tbody
       */

      const tbody =
        table.tagName ===
        'TBODY'
          ? table
          : qs(
              'tbody',
              table
            );


      if (!tbody) {
        return;
      }


      tbody.innerHTML =
        equipment
          .map(
            item => {

              const status =
                item.available > 0
                  ? 'มีการเบิกใช้'
                  : 'หมด';


              const statusClass =
                item.available > 0
                  ? 'available'
                  : 'out';


              return `

                <tr>

                  <td>
                    ${escapeHtml(
                      item.id
                    )}
                  </td>

                  <td>

                    <div class="equipment-name-cell">

                      <span
                        class="equipment-icon"
                        data-lucide="${
                          escapeHtml(
                            item.icon ||
                            equipmentIcon(
                              item.category
                            )
                          )
                        }"
                      ></span>

                      <span>
                        ${escapeHtml(
                          item.name
                        )}
                      </span>

                    </div>

                  </td>

                  <td>
                    ${escapeHtml(
                      item.category
                    )}
                  </td>

                  <td>
                    ${Number(
                      item.total || 0
                    )}
                  </td>

                  <td>
                    ${Number(
                      item.available || 0
                    )}
                  </td>

                  <td>

                    <span
                      class="status-badge ${statusClass}"
                    >
                      ${escapeHtml(
                        status
                      )}
                    </span>

                  </td>

                  <td>

                    <div class="table-actions">

                      <button
                        type="button"
                        class="btn btn-sm btn-primary"
                        data-edit-equipment="${
                          escapeHtml(
                            item.id
                          )
                        }"
                      >
                        แก้ไข
                      </button>

                      <button
                        type="button"
                        class="btn btn-sm btn-danger"
                        data-delete-equipment="${
                          escapeHtml(
                            item.id
                          )
                        }"
                      >
                        ลบ
                      </button>

                    </div>

                  </td>

                </tr>
              `;
            }
          )
          .join('');


      /*
       * ปุ่มแก้ไข
       */

      qsa(
        '[data-edit-equipment]',
        tbody
      ).forEach(
        button => {

          button.addEventListener(
            'click',
            () => {

              const id =
                button.dataset
                  .editEquipment;

              const item =
                getEquipmentLocal()
                  .find(
                    equipment =>
                      equipment.id ===
                      id
                  );

              if (!item) {
                return;
              }


              if (idInput) {
                idInput.value =
                  item.id;
              }

              if (nameInput) {
                nameInput.value =
                  item.name;
              }

              if (categoryInput) {
                categoryInput.value =
                  item.category;
              }

              if (totalInput) {
                totalInput.value =
                  item.total;
              }

              if (availableInput) {
                availableInput.value =
                  item.available;
              }

              if (statusInput) {
                statusInput.value =
                  item.status;
              }


              modal?.classList.add(
                'show'
              );
            }
          );
        }
      );


      /*
       * ปุ่มลบ
       */

      qsa(
        '[data-delete-equipment]',
        tbody
      ).forEach(
        button => {

          button.addEventListener(
            'click',
            async () => {

              const id =
                button.dataset
                  .deleteEquipment;


              const item =
                getEquipmentLocal()
                  .find(
                    equipment =>
                      equipment.id ===
                      id
                  );


              if (!item) {
                return;
              }


              const confirmed =
                confirm(
                  `ต้องการลบอุปกรณ์ "${item.name}" หรือไม่?`
                );


              if (!confirmed) {
                return;
              }


              try {

                await deleteEquipmentFirebase(
                  id
                );


                const equipment =
                  getEquipmentLocal()
                    .filter(
                      equipment =>
                        equipment.id !==
                        id
                    );


                saveEquipmentLocal(
                  equipment
                );


                renderEquipment();


                alert(
                  'ลบอุปกรณ์เรียบร้อยแล้ว'
                );


              } catch (error) {

                console.error(
                  'Delete equipment error:',
                  error
                );


                alert(
                  firebaseErrorMessage(
                    error
                  )
                );
              }
            }
          );
        }
      );


      initIcons();
    }


    /*
     * เปิด Modal เพิ่มอุปกรณ์
     */

    addButton?.addEventListener(
      'click',
      () => {

        form?.reset();

        if (idInput) {
          idInput.value =
            makeId('EQ');
        }

        if (totalInput) {
          totalInput.value =
            1;
        }

        if (availableInput) {
          availableInput.value =
            1;
        }

        modal?.classList.add(
          'show'
        );
      }
    );


    /*
     * ปิด Modal
     */

    closeButton?.addEventListener(
      'click',
      () => {

        modal?.classList.remove(
          'show'
        );
      }
    );


    /*
     * บันทึกอุปกรณ์
     */

    form?.addEventListener(
      'submit',
      async event => {

        event.preventDefault();


        const id =
          (
            idInput?.value ||
            ''
          ).trim();

        const name =
          (
            nameInput?.value ||
            ''
          ).trim();

        const category =
          (
            categoryInput?.value ||
            'ทั่วไป'
          ).trim();

        const total =
          Number(
            totalInput?.value || 0
          );

        const available =
          Number(
            availableInput?.value || 0
          );


        if (!id || !name) {

          alert(
            'กรุณากรอกข้อมูลอุปกรณ์ให้ครบ'
          );

          return;
        }


        if (
          total < 0 ||
          available < 0 ||
          available > total
        ) {

          alert(
            'จำนวนอุปกรณ์ไม่ถูกต้อง'
          );

          return;
        }


        const equipment =
          getEquipmentLocal();


        const oldItem =
          equipment.find(
            item =>
              item.id === id
          );


        const newItem =
          normalizeEquipment({

            id,

            name,

            category,

            icon:
              oldItem?.icon ||
              equipmentIcon(
                category
              ),

            total,

            available,

            status:
              calculateStockStatus(
                available
              ),

            borrower:
              oldItem?.borrower ||
              '',

            createdAt:
              oldItem?.createdAt ||
              new Date().toISOString(),

            updatedAt:
              new Date().toISOString()

          });


        try {

          await saveEquipmentFirebase(
            newItem
          );


          const index =
            equipment.findIndex(
              item =>
                item.id === id
            );


          if (index >= 0) {

            equipment[index] =
              newItem;

          } else {

            equipment.push(
              newItem
            );
          }


          saveEquipmentLocal(
            equipment
          );


          modal?.classList.remove(
            'show'
          );


          renderEquipment();


          alert(
            oldItem
              ? 'แก้ไขอุปกรณ์เรียบร้อยแล้ว'
              : 'เพิ่มอุปกรณ์เรียบร้อยแล้ว'
          );


        } catch (error) {

          console.error(
            'Save equipment error:',
            error
          );


          alert(
            firebaseErrorMessage(
              error
            )
          );
        }
      }
    );


    search?.addEventListener(
      'input',
      renderEquipment
    );


    await loadEquipmentFromFirebase();

    renderEquipment();
  }
    // ============================================================
  // START APP
  // ============================================================

  async function startApp() {
  const firebaseOK = await initFirebase();

  setupPasswordToggle();
  initIcons();

  const path = window.location.pathname;

  if (path.endsWith('register.html')) {

    if (!firebaseOK || !auth || !db) {
      console.error(
        'Firebase ยังไม่พร้อมใช้งาน',
        {
          firebaseOK,
          auth,
          db
        }
      );

      alert(
        'ระบบยังไม่สามารถเชื่อมต่อ Firebase ได้ กรุณารีเฟรชหน้าแล้วลองใหม่อีกครั้ง'
      );

      return;
    }

    setupRegister();
    return;
  }

  if (path.endsWith('dashboard.html')) {
    setupCommonUI();

    if (auth?.currentUser) {
      await setupDashboard();
    }

    return;
  }

  if (path.endsWith('equipment.html')) {
    setupCommonUI();

    if (auth?.currentUser) {
      await setupEquipmentPage();
    }

    return;
  }
}
