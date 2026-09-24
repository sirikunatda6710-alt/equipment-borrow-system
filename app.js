(function () {
  'use strict';

  // ============================================================
  // Firebase configuration
  // ============================================================
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyC3JRPuC-2LCs8nqiLy_LKvi72NyLLd7_U',
    authDomain: 'equipment-borrow-1303c.firebaseapp.com',
    projectId: 'equipment-borrow-1303c',
    storageBucket: 'equipment-borrow-1303c.firebasestorage.app',
    messagingSenderId: '433020378004',
    appId: '1:433020378004:web:d574cf9e4c7fafa4034d81',
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
    firebaseUid: 'firebaseUid',
    userRole: 'userRole'
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
  'มีการเบิกใช้': 'in_use',
  'หมด': 'out',

  in_use: 'in_use',
  out: 'out'
};
  let db = null;
  let auth = null;
  let firebaseReadyPromise = null;

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
  return ({
    in_use: 'มีการเบิกใช้',
    out: 'หมด'
  }[STATUS_MAP[status] || status]) || status || '-';
}
  function normalizeStatus(status) {
    return STATUS_MAP[status] || 'available';
  }
  function calculateStockStatus(available) {
  return Number(available) > 0
    ? 'in_use'
    : 'out';
}

  function normalizeEquipment(item) {
  const total = Math.max(
    0,
    Number(item.total ?? item.quantity ?? 0)
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

    status: calculateStockStatus(available),

    borrower: String(
      item.borrower ??
      ''
    ).trim(),

    createdAt:
      item.createdAt ||
      new Date().toISOString(),

    updatedAt:
      item.updatedAt ||
      new Date().toISOString()
  };
}
  function equipmentIcon(category) {
    const map = {
      'เครื่องฉาย': 'projector',
      'กล้องถ่ายภาพ': 'camera',
      'เครื่องเสียง': 'mic'
    };

    return map[category] || 'package';
  }

  function getEquipmentLocal() {
    let data = parseJSON(
      KEYS.equipment,
      null
    );

    if (!Array.isArray(data)) {
      data = parseJSON(
        KEYS.equipmentData,
        null
      );
    }

    if (!Array.isArray(data)) {
      data = DEFAULT_EQUIPMENT.map(
        x => ({ ...x })
      );
    }

    data = data
      .map(normalizeEquipment)
      .filter(
        x => x.id && x.name
      );

    if (!data.length) {
      data = DEFAULT_EQUIPMENT.map(
        x => ({ ...x })
      );
    }

    return data;
  }

  function saveEquipmentLocal(data) {
    const normalized =
      data.map(normalizeEquipment);

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

  function getCurrentUserRole() {
    const current =
      parseJSON(
        KEYS.currentUser,
        null
      );

    return (
      localStorage.getItem(
        KEYS.userRole
      ) ||

      current?.role ||

      'user'
    );
  }

  function isAdmin() {
    return (
      getCurrentUserRole() ===
      'admin'
    );
  }

  function isLoggedIn() {
    return !!(
      auth &&
      auth.currentUser
    );
  }

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
          () =>
            reject(
              new Error(
                'โหลด Firebase SDK ไม่สำเร็จ'
              )
            ),
          { once: true }
        );

        document.head.appendChild(
          script
        );
      }
    );
  }

  async function initFirebase() {

    if (firebaseReadyPromise) {
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

        return false;

      });

    return firebaseReadyPromise;
  }

  async function getUserProfile(
    user = auth?.currentUser
  ) {

    if (!user || !db) {
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

      if (!snapshot.empty) {
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
                new Date().toISOString(),

              updatedAt:
                new Date().toISOString()
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

      if (data.length) {

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
  if (!auth?.currentUser || !db) {
    throw new Error('ไม่พบผู้ใช้งานที่เข้าสู่ระบบ');
  }

  const user = auth.currentUser;

  let userName =
    localStorage.getItem('userName') ||
    user.displayName ||
    user.email ||
    'ผู้ใช้งาน';

  try {
    const userSnap = await db
      .collection('users')
      .doc(user.uid)
      .get();

    if (
      userSnap.exists &&
      userSnap.data().name
    ) {
      userName = userSnap.data().name;
    }
  } catch (error) {
    console.warn(
      'อ่านชื่อผู้ใช้งานไม่ได้:',
      error
    );
  }

  const record = {
    id: makeId('HIS'),

    equipmentId: equipment.id,
    equipmentName: equipment.name,
    category: equipment.category || 'ทั่วไป',

    action,

    quantity: Number(quantity) || 0,

    beforeQuantity:
      Number(beforeQuantity) || 0,

    afterQuantity:
      Number(afterQuantity) || 0,

    beforeStatus,

    afterStatus,

    userUid: user.uid,

    userName,

    userEmail:
      user.email || '',

    note:
      String(note || '').trim(),

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
  const qty = Number(quantity);

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error(
      'จำนวนที่เบิกต้องมากกว่า 0'
    );
  }

  if (qty > Number(item.available)) {
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
    equipment: item,

    action: 'เบิกจ่าย',

    quantity: qty,

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
   * 3. ถ้าเหลือ 0 ให้แจ้งผู้ดูแล
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
  const qty = Number(quantity);

  if (!Number.isFinite(qty) || qty <= 0) {
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
      Number(item.total || 0) + qty,

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
    equipment: item,

    action: 'เพิ่มเติม',

    quantity: qty,

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
    equipment: item,

    action: 'แก้ไขสถานะ',

    quantity: 0,

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
   * ให้แจ้งเตือนผู้ดูแลด้วย
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
  async function loadAdminNotifications() {
  if (!db || !auth?.currentUser) {
    return [];
  }

  const snapshot = await db
    .collection('notifications')
    .where(
      'targetRole',
      '==',
      'admin'
    )
    .orderBy(
      'createdAt',
      'desc'
    )
    .limit(30)
    .get();

  return snapshot.docs.map(
    doc => ({
      id: doc.id,
      ...doc.data()
    })
  );
}
  async function getUnreadNotificationCount() {
  if (!db || !auth?.currentUser) {
    return 0;
  }

  const snapshot = await db
    .collection('notifications')
    .where(
      'targetRole',
      '==',
      'admin'
    )
    .where(
      'status',
      '==',
      'unread'
    )
    .get();

  return snapshot.size;
}
  async function markNotificationAsRead(
  notificationId
) {
  if (!db) return;

  await db
    .collection('notifications')
    .doc(notificationId)
    .update({
      status: 'read',
      readAt:
        new Date().toISOString(),
      readByUid:
        auth?.currentUser?.uid || ''
    });
}
// ============================================================
// DASHBOARD NOTIFICATIONS
// ============================================================

async function setupDashboardNotifications() {

  const button =
    qs('#notificationButton');

  const panel =
    qs('#notificationPanel');

  const list =
    qs('#notificationList');

  const count =
    qs('#notificationCount');

  const close =
    qs('#closeNotificationPanel');

  if (
    !button ||
    !panel ||
    !list ||
    !count
  ) {
    return;
  }

  async function renderNotifications() {

    try {

      let notifications = [];

      if (
        db &&
        auth?.currentUser
      ) {

        const snapshot =
          await db
            .collection('notifications')
            .where(
              'targetRole',
              '==',
              'admin'
            )
            .limit(30)
            .get();

        notifications =
          snapshot.docs.map(
            doc => ({
              id: doc.id,
              ...doc.data()
            })
          );

        notifications.sort(
          (a, b) =>
            String(
              b.createdAt || ''
            ).localeCompare(
              String(
                a.createdAt || ''
              )
            )
        );
      }

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

      if (
        notifications.length === 0
      ) {

        list.innerHTML = `
          <div class="notification-empty">
            ไม่มีการแจ้งเตือน
          </div>
        `;

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
                data-notification-id="${escapeHtml(
                  notification.id
                )}"
              >

                <strong>
                  ${escapeHtml(
                    notification.message ||
                    notification.equipmentName ||
                    'แจ้งเตือน'
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    notification.category ||
                    ''
                  )}
                </span>

                <small>
                  ${escapeHtml(
                    formatDateTime(
                      notification.createdAt
                    )
                  )}
                </small>

              </button>
            `
          )
          .join('');

      qsa(
        '[data-notification-id]',
        list
      ).forEach(
        element => {

          element.addEventListener(
            'click',
            async () => {

              const id =
                element.dataset
                  .notificationId;

              try {

                await markNotificationAsRead(
                  id
                );

              } catch (error) {

                console.error(
                  'อ่านแจ้งเตือนไม่สำเร็จ:',
                  error
                );
              }

              await renderNotifications();
            }
          );
        }
      );

    } catch (error) {

      console.error(
        'โหลดแจ้งเตือนไม่สำเร็จ:',
        error
      );

      list.innerHTML = `
        <div class="notification-empty">
          โหลดการแจ้งเตือนไม่สำเร็จ
        </div>
      `;
    }
  }

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

        await renderNotifications();
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

  await renderNotifications();
}
  // ============================================================
  // ICON SYSTEM
  // ============================================================

  function initIcons() {

    const icons = {

      package: `
        <rect x="3" y="3"
              width="18"
              height="18"
              rx="2"></rect>

        <path d="M3 9h18"></path>

        <path d="M9 3v6"></path>
      `,

      "circle-check": `
        <circle
          cx="12"
          cy="12"
          r="9"></circle>

        <path
          d="m9 12 2 2 4-4"></path>
      `,

      "package-open": `
        <path
          d="M12 3v12"></path>

        <path
          d="m8 7 4-4 4 4"></path>

        <path
          d="M21 11V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4"></path>

        <path
          d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"></path>

        <path
          d="M3 15h18"></path>
      `,

      "triangle-alert": `
        <path
          d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>

        <path d="M12 9v4"></path>

        <path d="M12 17h.01"></path>
      `,

      "clipboard-list": `
        <rect
          x="5"
          y="4"
          width="14"
          height="17"
          rx="2"></rect>

        <path
          d="M9 4V3h6v1"></path>

        <path d="M9 9h6"></path>

        <path d="M9 13h6"></path>

        <path d="M9 17h4"></path>
      `,

      "circle-x": `
        <circle
          cx="12"
          cy="12"
          r="9"></circle>

        <path d="m9 9 6 6"></path>

        <path d="m15 9-6 6"></path>
      `,

      list: `
        <path d="M8 6h13"></path>
        <path d="M8 12h13"></path>
        <path d="M8 18h13"></path>

        <path d="M3 6h.01"></path>
        <path d="M3 12h.01"></path>
        <path d="M3 18h.01"></path>
      `,

      search: `
        <circle
          cx="11"
          cy="11"
          r="7"></circle>

        <path d="m20 20-4-4"></path>
      `,

      bell: `
        <path
          d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>

        <path d="M10 21h4"></path>
      `,

      "circle-user-round": `
        <circle
          cx="12"
          cy="12"
          r="9"></circle>

        <circle
          cx="12"
          cy="10"
          r="3"></circle>

        <path
          d="M7 20c1-3 3-4 5-4s4 1 5 4"></path>
      `,

      "log-out": `
        <path
          d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>

        <path
          d="m16 17 5-5-5-5"></path>

        <path
          d="M21 12H9"></path>
      `,

      "layout-dashboard": `
        <rect
          x="3"
          y="3"
          width="7"
          height="7"
          rx="1"></rect>

        <rect
          x="14"
          y="3"
          width="7"
          height="7"
          rx="1"></rect>

        <rect
          x="3"
          y="14"
          width="7"
          height="7"
          rx="1"></rect>

        <rect
          x="14"
          y="14"
          width="7"
          height="7"
          rx="1"></rect>
      `,

      "package-search": `
        <path
          d="M21 8 12 3 3 8v8l9 5 5-2.8"></path>

        <path
          d="M3 8l9 5 9-5"></path>

        <path
          d="M12 13v8"></path>

        <circle
          cx="17.5"
          cy="17.5"
          r="3"></circle>

        <path
          d="m20 20 2 2"></path>
      `,

      "undo-2": `
        <path
          d="M9 14 4 9l5-5"></path>

        <path
          d="M4 9h10a6 6 0 0 1 6 6v1"></path>
      `,

      history: `
        <path
          d="M3 12a9 9 0 1 0 3-6.7"></path>

        <path
          d="M3 4v5h5"></path>

        <path
          d="M12 7v5l3 2"></path>
      `,

      eye: `
        <path
          d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path>

        <circle
          cx="12"
          cy="12"
          r="2.5"></circle>
      `,

      pencil: `
        <path d="M12 20h9"></path>

        <path
          d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
      `,

      "trash-2": `
        <path d="M3 6h18"></path>

        <path
          d="M8 6V4h8v2"></path>

        <path
          d="M19 6l-1 15H6L5 6"></path>

        <path
          d="M10 11v6"></path>

        <path
          d="M14 11v6"></path>
      `,

      plus: `
        <path d="M12 5v14"></path>
        <path d="M5 12h14"></path>
      `,

      minus: `
        <path d="M5 12h14"></path>
      `,

      "package-check": `
        <path
          d="m16.5 9.4-5 5-2.5-2.5"></path>

        <path
          d="M21 16V8l-9-5-9 5v8l9 5 9-5Z"></path>

        <path
          d="M3 8l9 5 9-5"></path>

        <path
          d="M12 13v8"></path>
      `,

      "calendar-days": `
        <rect
          x="3"
          y="4"
          width="18"
          height="18"
          rx="2"></rect>

        <path d="M16 2v4"></path>
        <path d="M8 2v4"></path>
        <path d="M3 10h18"></path>

        <path d="M8 14h.01"></path>
        <path d="M12 14h.01"></path>
        <path d="M16 14h.01"></path>

        <path d="M8 18h.01"></path>
        <path d="M12 18h.01"></path>
        <path d="M16 18h.01"></path>
      `,

      "circle-alert": `
        <circle
          cx="12"
          cy="12"
          r="9"></circle>

        <path d="M12 8v4"></path>

        <path d="M12 16h.01"></path>
      `
    };

    qsa(
      '[data-lucide]'
    ).forEach(element => {

      const name =
        element.getAttribute(
          'data-lucide'
        );

      const icon =
        icons[name];

      if (!icon) return;

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
        'width',
        '24'
      );

      svg.setAttribute(
        'height',
        '24'
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

      if (element.className) {
        svg.setAttribute(
          'class',
          String(element.className)
        );
      }

      svg.innerHTML = icon;

      element.replaceWith(
        svg
      );
    });
  }

  // ============================================================
  // PASSWORD SHOW / HIDE
  // ============================================================

  function setupPasswordToggle() {

    qsa(
      '.toggle-password'
    ).forEach(button => {

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
        event => {

          event.preventDefault();
          event.stopPropagation();

          input.type =
            input.type === 'password'
              ? 'text'
              : 'password';

          button.textContent =
            input.type === 'password'
              ? 'แสดง'
              : 'ซ่อน';

          input.focus();

          try {

            const pos =
              input.value.length;

            input.setSelectionRange(
              pos,
              pos
            );

          } catch (_) {}
        }
      );
    });
  }

  // ============================================================
  // COMMON UI
  // ============================================================

  function setupCommonUI() {

    const name =
      getCurrentUserName();

    qsa(
      '#userName, .profile-name, #welcomeUserName'
    ).forEach(el => {

      el.textContent =
        name;

    });

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
      () =>
        profileModal?.classList.remove(
          'show'
        )
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

          alert(
            'กรุณากรอกชื่อผู้ใช้งาน'
          );

          return;
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
        ).forEach(el => {

          el.textContent =
            value;

        });

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
                    new Date().toISOString()
                },
                {
                  merge: true
                }
              );
          }

        } catch (error) {

          console.warn(
            error
          );
        }

        profileModal?.classList.remove(
          'show'
        );
      }
    );

    qs(
      '#logoutButton'
    )?.addEventListener(
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

        localStorage.removeItem(
          KEYS.userRole
        );

        localStorage.removeItem(
          'registerRole'
        );

        window.location.href =
          'index.html';
      }
    );

   // ============================================================
// ระบบแจ้งเตือน Dashboard
// ============================================================

setupDashboardNotifications();
    // ============================================================
  // LOGIN
  // ============================================================

  async function setupLogin() {

    const form = qs('#loginForm');

    if (!form || !auth) {
      return;
    }

    const loginRole =
      qs('#loginRole');

    const adminCodeGroup =
      qs('#adminCodeGroup');

    const adminCode =
      qs('#adminCode');

    const remember =
      qs('#rememberMe');

    const emailInput =
      qs('#email');

    const passwordInput =
      qs('#password');

    // ----------------------------------------------------------
    // กำหนด Role จาก URL / localStorage
    // ----------------------------------------------------------

    const params =
      new URLSearchParams(
        window.location.search
      );

    const urlRole =
      params.get('role');

    const savedRole =
      localStorage.getItem(
        'registerRole'
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

    function updateLoginRoleUI() {

      if (!loginRole) {
        return;
      }

      if (
        loginRole.value ===
        'admin'
      ) {

        if (adminCodeGroup) {
          adminCodeGroup.style.display =
            'block';
        }

      } else {

        if (adminCodeGroup) {
          adminCodeGroup.style.display =
            'none';
        }

        if (adminCode) {
          adminCode.value = '';
        }
      }
    }

    loginRole?.addEventListener(
      'change',
      updateLoginRoleUI
    );

    updateLoginRoleUI();

    // ----------------------------------------------------------
    // โหลดข้อมูลที่ผู้ใช้เลือกจำไว้
    // ----------------------------------------------------------

    const savedEmail =
      localStorage.getItem(
        'rememberedEmail'
      );

    const savedPassword =
      localStorage.getItem(
        'rememberedPassword'
      );

    if (
      savedEmail &&
      emailInput
    ) {
      emailInput.value =
        savedEmail;
    }

    if (
      savedPassword &&
      passwordInput
    ) {
      passwordInput.value =
        savedPassword;
    }

    if (
      savedEmail &&
      savedPassword &&
      remember
    ) {
      remember.checked =
        true;
    }

    // ----------------------------------------------------------
    // Login Submit
    // ----------------------------------------------------------

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

        const password =
          passwordInput?.value ||
          '';

        const selectedRole =
          loginRole?.value ||
          'user';

        const enteredAdminCode =
          adminCode?.value?.trim() ||
          '';

        // ------------------------------------------------------
        // ตรวจข้อมูลพื้นฐาน
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
        // ตรวจรหัส Admin
        // รหัสที่กำหนด = 24236
        // ------------------------------------------------------

        if (
          selectedRole ===
          'admin'
        ) {

          if (
            enteredAdminCode !==
            '24236'
          ) {

            alert(
              'รหัสผู้ดูแลระบบไม่ถูกต้อง'
            );

            adminCode?.focus();

            return;
          }
        }

        const submitButton =
          form.querySelector(
            '[type="submit"]'
          );

        if (submitButton) {

          submitButton.disabled =
            true;

          submitButton.textContent =
            'กำลังเข้าสู่ระบบ...';
        }

        try {

          // ----------------------------------------------------
          // Firebase Login
          // ----------------------------------------------------

          const credential =
            await auth.signInWithEmailAndPassword(
              email,
              password
            );

          const user =
            credential.user;

          // ----------------------------------------------------
          // อ่านข้อมูลสมาชิกจาก Firestore
          // ----------------------------------------------------

          let profile =
            null;

          try {

            profile =
              await getUserProfile(
                user
              );

          } catch (profileError) {

            console.warn(
              'อ่านข้อมูลสมาชิกไม่ได้:',
              profileError
            );
          }

          // ----------------------------------------------------
          // ถ้าไม่มี Profile
          // ----------------------------------------------------

          if (!profile) {

            await auth.signOut();

            alert(
              'ไม่พบข้อมูลสมาชิกในระบบ กรุณาสมัครสมาชิกใหม่'
            );

            return;
          }

          // ----------------------------------------------------
          // Role จริงจาก Firestore
          // ----------------------------------------------------

          const actualRole =
            profile.role ||
            'user';

          // ----------------------------------------------------
          // ป้องกันการเลือกประเภทผู้ใช้ไม่ตรงกับบัญชีจริง
          // ----------------------------------------------------

          if (
            actualRole !==
            selectedRole
          ) {

            await auth.signOut();

            alert(
              selectedRole === 'admin'
                ? 'บัญชีนี้ไม่ได้ลงทะเบียนเป็นผู้ดูแลระบบ'
                : 'บัญชีนี้ไม่ได้ลงทะเบียนเป็นผู้ใช้งานทั่วไป'
            );

            return;
          }

          // ----------------------------------------------------
          // ตรวจสถานะบัญชี
          // ----------------------------------------------------

          if (
            profile.status &&
            profile.status !==
              'active'
          ) {

            await auth.signOut();

            alert(
              'บัญชีนี้ถูกระงับการใช้งาน'
            );

            return;
          }

          // ----------------------------------------------------
          // ชื่อผู้ใช้
          // ----------------------------------------------------

          const name =
            profile.name ||
            user.displayName ||
            email;

          // ----------------------------------------------------
          // บันทึกสถานะ Login
          // ----------------------------------------------------

          localStorage.setItem(
            KEYS.loggedIn,
            'true'
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
            KEYS.userName,
            name
          );

          localStorage.setItem(
            KEYS.userRole,
            actualRole
          );

          saveJSON(
            KEYS.currentUser,
            {
              id: user.uid,
              uid: user.uid,
              name: name,
              email: email,
              role: actualRole
            }
          );

          // ----------------------------------------------------
          // จดจำอีเมลและรหัสผ่าน
          // ----------------------------------------------------

          if (
            remember?.checked
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

          // ไม่ต้องใช้ registerRole ต่อหลัง Login สำเร็จ
          localStorage.removeItem(
            'registerRole'
          );

          // ----------------------------------------------------
          // แยก Dashboard ตาม Role
          // ----------------------------------------------------

          if (
            actualRole ===
            'admin'
          ) {

            window.location.replace(
              'dashboard.html'
            );

          } else {

            window.location.replace(
              'user-dashboard.html'
            );
          }

        } catch (error) {

          console.error(
            'Firebase Login Error:',
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
              'เข้าสู่ระบบ';
          }
        }
      }
    );
  }

  // ============================================================
  // PASSWORD VALIDATION
  // ============================================================

  function passwordValid(
    password
  ) {

    if (!password) {
      return false;
    }

    const hasUpper =
      /[A-Z]/.test(
        password
      );

    const hasLower =
      /[a-z]/.test(
        password
      );

    const hasNumber =
      /[0-9]/.test(
        password
      );

    const isLongEnough =
      password.length >= 8;

    return (
      hasUpper &&
      hasLower &&
      hasNumber &&
      isLongEnough
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

    password?.addEventListener(
      'input',
      () => {

        updatePasswordRules(
          'rule',
          password.value
        );
      }
    );

    form.addEventListener(
      'submit',
      async event => {

        event.preventDefault();

        const name =
          (
            qs('#name')?.value ||
            ''
          ).trim();

        const email =
          (
            qs('#email')?.value ||
            ''
          )
            .trim()
            .toLowerCase();

        const pass =
          password?.value ||
          '';

        const confirmPass =
          confirm?.value ||
          '';

        const role =
          qs(
            'input[name="userRole"]:checked'
          )?.value ||
          'user';

        // ------------------------------------------------------
        // ตรวจข้อมูล
        // ------------------------------------------------------

        if (
          !name ||
          !email ||
          !pass ||
          !confirmPass
        ) {

          alert(
            'กรุณากรอกข้อมูลให้ครบ'
          );

          return;
        }

        if (
          !passwordValid(pass)
        ) {

          alert(
            'รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข'
          );

          return;
        }

        if (
          pass !==
          confirmPass
        ) {

          alert(
            'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน'
          );

          return;
        }

        if (
          role !== 'user' &&
          role !== 'admin'
        ) {

          alert(
            'ประเภทผู้ใช้งานไม่ถูกต้อง'
          );

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
            'กำลังสมัครสมาชิก...';
        }

        try {

          // ----------------------------------------------------
          // สร้าง Firebase Account
          // ----------------------------------------------------

          const credential =
            await auth.createUserWithEmailAndPassword(
              email,
              pass
            );

          const user =
            credential.user;

          // ----------------------------------------------------
          // บันทึก Display Name
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
          // บันทึกข้อมูลสมาชิก Firestore
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
                  new Date().toISOString(),

                updatedAt:
                  new Date().toISOString()
              },
              {
                merge: true
              }
            );

          // ----------------------------------------------------
          // Logout หลังสมัคร
          // ----------------------------------------------------

          await auth.signOut();

          // ----------------------------------------------------
          // จำข้อมูลเพื่อให้ Login รู้ว่าเลือก Role อะไร
          // ----------------------------------------------------

          localStorage.setItem(
            'registerEmail',
            email
          );

          localStorage.setItem(
            'registerRole',
            role
          );

          // ----------------------------------------------------
          // ส่งไปหน้า Login
          // ----------------------------------------------------

          alert(
            'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ'
          );

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

          if (submitButton) {

            submitButton.disabled =
              false;

            submitButton.textContent =
              'สมัครสมาชิก';
          }
        }
      }
    );
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

    const passwordField =
      qs('#newPassword');

    const confirmField =
      qs('#confirmNewPassword');

    // หน้า Forgot ใช้สำหรับกรอก Email เท่านั้น
    if (passwordField) {

      const pWrap =
        passwordField.closest(
          '.password-wrapper'
        );

      const pLabel =
        qs(
          'label[for="newPassword"]'
        );

      const cWrap =
        confirmField?.closest(
          '.password-wrapper'
        );

      const cLabel =
        confirmField
          ? qs(
              'label[for="confirmNewPassword"]'
            )
          : null;

      const rules =
        qs(
          '.password-rules'
        );

      [
        passwordField,
        confirmField,
        pWrap,
        cWrap,
        pLabel,
        cLabel,
        rules
      ]
        .filter(Boolean)
        .forEach(
          element => {
            element.style.display =
              'none';
          }
        );
    }

    form.addEventListener(
      'submit',
      async event => {

        event.preventDefault();

        const email =
          (
            qs('#forgotEmail')
              ?.value ||

            qs('#email')
              ?.value ||

            ''
          )
            .trim()
            .toLowerCase();

        if (!email) {

          alert(
            'กรุณากรอกอีเมล'
          );

          return;
        }

        const button =
          form.querySelector(
            '[type="submit"]'
          );

        if (button) {
          button.disabled =
            true;

          button.textContent =
            'กำลังส่ง...';
        }

        try {

          const resetUrl =
            `${window.location.origin}` +
            `${window.location.pathname.replace(
              'forgot-password.html',
              'reset-password.html'
            )}`;

          await auth.sendPasswordResetEmail(
            email,
            {
              url:
                resetUrl,

              handleCodeInApp:
                true
            }
          );

          alert(
            'ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว กรุณาตรวจสอบกล่องจดหมายและ Spam/Junk'
          );

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

          if (button) {

            button.disabled =
              false;

            button.textContent =
              'ดำเนินการต่อ';
          }
        }
      }
    );
  }

  // ============================================================
  // RESET PASSWORD
  // ============================================================

  function getActionCode() {

    const params =
      new URLSearchParams(
        window.location.search
      );

    return params.get(
      'oobCode'
    );
  }

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

    const confirm =
      qs('#confirmNewPassword');

    const code =
      getActionCode();

    if (newPassword) {

      newPassword.addEventListener(
        'input',
        () => {

          updatePasswordRules(
            'resetRule',
            newPassword.value
          );
        }
      );
    }

    // ----------------------------------------------------------
    // ไม่มี oobCode
    // ----------------------------------------------------------

    if (!code) {

      const submit =
        form.querySelector(
          '[type="submit"]'
        );

      if (submit) {
        submit.disabled =
          true;
      }

      const warning =
        document.createElement(
          'p'
        );

      warning.className =
        'login-error';

      warning.textContent =
        'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง กรุณากดลิงก์จากอีเมลอีกครั้ง';

      form.prepend(
        warning
      );

      return;
    }

    // ----------------------------------------------------------
    // ตรวจสอบ Reset Code
    // ----------------------------------------------------------

    try {

      const email =
        await auth.verifyPasswordResetCode(
          code
        );

      const emailField =
        qs('#resetEmail');

      if (emailField) {

        emailField.value =
          email;
      }

    } catch (error) {

      const submit =
        form.querySelector(
          '[type="submit"]'
        );

      if (submit) {
        submit.disabled =
          true;
      }

      alert(
        firebaseErrorMessage(
          error
        )
      );

      return;
    }

    // ----------------------------------------------------------
    // เปลี่ยนรหัสผ่าน
    // ----------------------------------------------------------

    form.addEventListener(
      'submit',
      async event => {

        event.preventDefault();

        const pass =
          newPassword?.value ||
          '';

        const confirmPass =
          confirm?.value ||
          '';

        if (
          !passwordValid(
            pass
          )
        ) {

          alert(
            'รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข'
          );

          return;
        }

        if (
          pass !==
          confirmPass
        ) {

          alert(
            'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน'
          );

          return;
        }

        const submit =
          form.querySelector(
            '[type="submit"]'
          );

        if (submit) {

          submit.disabled =
            true;

          submit.textContent =
            'กำลังเปลี่ยนรหัสผ่าน...';
        }

        try {

          await auth.confirmPasswordReset(
            code,
            pass
          );

          alert(
            'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบ'
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

          if (submit) {

            submit.disabled =
              false;

            submit.textContent =
              'เปลี่ยนรหัสผ่าน';
          }
        }
      }
    );
  }
  // ============================================================
  // ROLE GUARD
  // ============================================================

  async function guardProtectedPage() {

    const page =
      location.pathname
        .split('/')
        .pop() ||
      'index.html';

    const publicPages = [
      '',
      'index.html',
      'register.html',
      'forgot-password.html',
      'reset-password.html'
    ];

    if (
      publicPages.includes(
        page
      )
    ) {
      return true;
    }

    if (
      !auth
    ) {

      window.location.replace(
        'index.html'
      );

      return false;
    }

    // ----------------------------------------------------------
    // รอ Firebase ตรวจสอบ Login
    // ----------------------------------------------------------

    const user =
      await new Promise(
        resolve => {

          if (
            auth.currentUser
          ) {

            resolve(
              auth.currentUser
            );

            return;
          }

          let unsubscribe =
            null;

          unsubscribe =
            auth.onAuthStateChanged(
              currentUser => {

                if (unsubscribe) {
                  unsubscribe();
                }

                resolve(
                  currentUser
                );
              }
            );
        }
      );

    if (!user) {

      localStorage.removeItem(
        KEYS.loggedIn
      );

      localStorage.removeItem(
        KEYS.firebaseUid
      );

      localStorage.removeItem(
        KEYS.userEmail
      );

      localStorage.removeItem(
        KEYS.userName
      );

      localStorage.removeItem(
        KEYS.userRole
      );

      localStorage.removeItem(
        KEYS.currentUser
      );

      window.location.replace(
        'index.html'
      );

      return false;
    }

    // ----------------------------------------------------------
    // อ่าน Role จริงจาก Firestore
    // ----------------------------------------------------------

    const profile =
      await getUserProfile(
        user
      );

    const actualRole =
      profile?.role ||
      localStorage.getItem(
        KEYS.userRole
      ) ||
      'user';

    const name =
      profile?.name ||
      user.displayName ||
      user.email ||
      'ผู้ใช้งาน';

    // ----------------------------------------------------------
    // Sync LocalStorage
    // ----------------------------------------------------------

    localStorage.setItem(
      KEYS.loggedIn,
      'true'
    );

    localStorage.setItem(
      KEYS.firebaseUid,
      user.uid
    );

    localStorage.setItem(
      KEYS.userEmail,
      user.email ||
        ''
    );

    localStorage.setItem(
      KEYS.userName,
      name
    );

    localStorage.setItem(
      KEYS.userRole,
      actualRole
    );

    saveJSON(
      KEYS.currentUser,
      {
        id: user.uid,
        uid: user.uid,
        name: name,
        email:
          user.email || '',
        role:
          actualRole
      }
    );

    // ----------------------------------------------------------
    // ป้องกันเข้าหน้าผิด Role
    // ----------------------------------------------------------

    if (
      page ===
        'dashboard.html' &&
      actualRole !==
        'admin'
    ) {

      window.location.replace(
        'user-dashboard.html'
      );

      return false;
    }

    if (
      page ===
        'user-dashboard.html' &&
      actualRole !==
        'user'
    ) {

      window.location.replace(
        'dashboard.html'
      );

      return false;
    }

    // ----------------------------------------------------------
    // Equipment เป็นหน้าของ Admin
    // ----------------------------------------------------------

    if (
      page ===
        'equipment.html' &&
      actualRole !==
        'admin'
    ) {

      window.location.replace(
        'user-dashboard.html'
      );

      return false;
    }

    console.log(
      'ตรวจสอบสิทธิ์สำเร็จ:',
      {
        email:
          user.email,
        role:
          actualRole
      }
    );

    return true;
  }
    // ============================================================
  // BORROW PAGE
  // ============================================================

  async function setupBorrowPage() {

    const select =
      qs('#equipmentSelect');

    if (!select) {
      return;
    }

    const form =
      qs('#borrowForm');

    const quantity =
      qs('#borrowQuantity') ||
      qs('#quantity');

    const borrower =
      qs('#borrowerName');

    const borrowDate =
      qs('#borrowDate');

    const returnDate =
      qs('#returnDate');

    const note =
      qs('#borrowNote');

    const terms =
      qs('#termsCheckbox');

    const confirmBtn =
      qs('#confirmBorrowButton');

    const sendOtp =
      qs('#sendOtpButton');

    const otpInputs =
      qsa('.otp-input');

    let data =
      await loadEquipmentFromFirebase();

    // ----------------------------------------------------------
    // แสดงเฉพาะอุปกรณ์ที่ยังมีของ
    // ----------------------------------------------------------

    populateEquipmentSelectLocal(
      select,
      data
    );

    // ----------------------------------------------------------
    // ค่าเริ่มต้น
    // ----------------------------------------------------------

    if (
      borrowDate &&
      !borrowDate.value
    ) {

      borrowDate.value =
        todayISO();
    }

    if (
      borrower &&
      !borrower.value
    ) {

      borrower.value =
        getCurrentUserName();
    }

    // ----------------------------------------------------------
    // อัปเดตข้อมูลอุปกรณ์ที่เลือก
    // ----------------------------------------------------------

    const updateSelected =
      () => {

        const item =
          data.find(
            x =>
              x.id ===
              select.value
          );

        const name =
          qs(
            '#selectedEquipmentName'
          );

        const code =
          qs(
            '#selectedEquipmentCode'
          );

        if (name) {

          if (
            name.tagName ===
            'INPUT'
          ) {

            name.value =
              item?.name || '';

          } else {

            name.textContent =
              item?.name || '-';
          }
        }

        if (code) {

          if (
            code.tagName ===
            'INPUT'
          ) {

            code.value =
              item?.id || '';

          } else {

            code.textContent =
              item?.id || '-';
          }
        }

        if (
          quantity &&
          item
        ) {

          quantity.max =
            String(
              item.available
            );

          if (
            Number(
              quantity.value || 1
            ) >
            item.available
          ) {

            quantity.value =
              item.available;
          }
        }
      };

    select.addEventListener(
      'change',
      updateSelected
    );

    updateSelected();

    // ----------------------------------------------------------
    // ปุ่มเพิ่ม / ลดจำนวน
    // ----------------------------------------------------------

    qsa(
      '#decreaseButton, #increaseButton'
    ).forEach(
      button => {

        button.type =
          'button';

        button.addEventListener(
          'click',
          event => {

            event.preventDefault();
            event.stopPropagation();

            const item =
              data.find(
                x =>
                  x.id ===
                  select.value
              );

            if (
              !quantity ||
              !item
            ) {

              alert(
                'กรุณาเลือกอุปกรณ์ก่อน'
              );

              return;
            }

            const current =
              Number(
                quantity.value || 1
              );

            let next;

            if (
              button.id ===
              'increaseButton'
            ) {

              next =
                current + 1;

            } else {

              next =
                current - 1;
            }

            next =
              Math.max(
                1,
                Math.min(
                  Number(
                    item.available
                  ),
                  next
                )
              );

            quantity.value =
              next;
          }
        );
      }
    );

    // ----------------------------------------------------------
    // OTP ตัวอย่าง
    // ----------------------------------------------------------

    sendOtp?.addEventListener(
      'click',
      () => {

        alert(
          'ระบบ OTP สำหรับการยืมยังเป็นโหมดตัวอย่าง ไม่ใช่ OTP จริง'
        );

        otpInputs[0]?.focus();
      }
    );

    otpInputs.forEach(
      (input, index) => {

        input.addEventListener(
          'input',
          () => {

            if (
              input.value &&
              otpInputs[index + 1]
            ) {

              otpInputs[
                index + 1
              ].focus();
            }
          }
        );
      }
    );

    // ----------------------------------------------------------
    // ดำเนินการยืม
    // ----------------------------------------------------------

    async function doBorrow(
      event
    ) {

      event?.preventDefault();

      if (
        !auth?.currentUser
      ) {

        alert(
          'กรุณาเข้าสู่ระบบก่อนยืมอุปกรณ์'
        );

        return;
      }

      const item =
        data.find(
          x =>
            x.id ===
            select.value
        );

      const qty =
        Math.max(
          1,
          Number(
            quantity?.value || 1
          )
        );

      const who =
        (
          borrower?.value ||
          getCurrentUserName()
        ).trim();

      // --------------------------------------------------------
      // ตรวจสอบข้อมูล
      // --------------------------------------------------------

      if (!item) {

        alert(
          'กรุณาเลือกอุปกรณ์'
        );

        return;
      }

      if (
        qty >
        Number(item.available)
      ) {

        alert(
          'จำนวนที่ยืมมากกว่าจำนวนที่มีอยู่'
        );

        return;
      }

      if (!who) {

        alert(
          'กรุณาระบุชื่อผู้ยืม'
        );

        return;
      }

      if (
        terms &&
        !terms.checked
      ) {

        alert(
          'กรุณายอมรับเงื่อนไขการยืม'
        );

        return;
      }

      // --------------------------------------------------------
      // สร้างข้อมูลอุปกรณ์ใหม่
      // --------------------------------------------------------

      const newAvailable =
        Number(
          item.available
        ) - qty;

      const updatedItem = {

        ...item,

        available:
          newAvailable,

        status:
          newAvailable === 0
            ? 'borrowed'
            : 'available',

        borrower:
          who,

        updatedAt:
          new Date().toISOString()
      };

      // --------------------------------------------------------
      // สร้างรายการยืม
      // --------------------------------------------------------

      const record = {

        id:
          makeId('BR'),

        equipmentId:
          item.id,

        equipmentName:
          item.name,

        borrower:
          who,

        borrowerUid:
          auth.currentUser.uid,

        borrowDate:
          borrowDate?.value ||
          todayISO(),

        returnDate:
          returnDate?.value ||
          '',

        actualReturnDate:
          '',

        quantity:
          qty,

        note:
          note?.value?.trim() ||
          '',

        status:
          'borrowing',

        createdAt:
          new Date().toISOString(),

        updatedAt:
          new Date().toISOString()
      };

      try {

        // ------------------------------------------------------
        // บันทึก Firebase
        // ------------------------------------------------------

        await saveEquipmentFirebase(
          updatedItem
        );

        await saveBorrowFirebase(
          record
        );

        await saveHistoryFirebase(
          record
        );

        // ------------------------------------------------------
        // บันทึก LocalStorage
        // ------------------------------------------------------

        data =
          data.map(
            item =>
              item.id ===
              updatedItem.id
                ? normalizeEquipment(
                    updatedItem
                  )
                : item
          );

        saveEquipmentLocal(
          data
        );

        const history =
          getHistoryLocal();

        history.unshift(
          record
        );

        saveHistoryLocal(
          history
        );

        // ------------------------------------------------------
        // แจ้งผล
        // ------------------------------------------------------

        alert(
          'บันทึกการยืมอุปกรณ์เรียบร้อยแล้ว'
        );

        form?.reset();

        if (borrowDate) {

          borrowDate.value =
            todayISO();
        }

        if (borrower) {

          borrower.value =
            getCurrentUserName();
        }

        if (quantity) {

          quantity.value =
            '1';
        }

        populateEquipmentSelectLocal(
          select,
          data
        );

        updateSelected();

      } catch (error) {

        console.error(
          'Borrow Error:',
          error
        );

        alert(
          'บันทึกการยืมไม่สำเร็จ: ' +
          firebaseErrorMessage(
            error
          )
        );
      }
    }

    if (form) {

      form.addEventListener(
        'submit',
        doBorrow
      );

    } else if (confirmBtn) {

      confirmBtn.addEventListener(
        'click',
        doBorrow
      );
    }

    initIcons();
  }


  // ============================================================
  // RETURN PAGE
  // ============================================================

  async function setupReturnPage() {

    const select =
      qs('#returnEquipmentSelect');

    const form =
      qs('#returnForm');

    const table =
      qs('#returnTable');

    if (
      !select &&
      !form &&
      !table
    ) {

      return;
    }

    if (
      !auth?.currentUser
    ) {

      return;
    }

    let records =
      await loadHistoryFromFirebase();

    let data =
      await loadEquipmentFromFirebase();

    // ----------------------------------------------------------
    // รายการที่กำลังยืมของผู้ใช้คนปัจจุบัน
    // ----------------------------------------------------------

    const active =
      () => {

        return records.filter(
          history => {

            return (
              history.status ===
                'borrowing' &&

              !history.actualReturnDate &&

              history.borrowerUid ===
                auth.currentUser.uid
            );
          }
        );
      };

    // ----------------------------------------------------------
    // แสดงรายการใน Select
    // ----------------------------------------------------------

    function renderReturnOptions() {

      if (!select) {
        return;
      }

      const list =
        active();

      select.innerHTML =
        '<option value="">-- เลือกรายการยืม --</option>' +

        list
          .map(
            history =>
              `<option value="${escapeHtml(
                history.id
              )}">
                ${escapeHtml(
                  history.equipmentName
                )}
                —
                ${escapeHtml(
                  history.borrower
                )}
              </option>`
          )
          .join('');
    }

    // ----------------------------------------------------------
    // ตารางรายการคืน
    // ----------------------------------------------------------

    function renderTable() {

      if (!table) {
        return;
      }

      const list =
        active();

      if (!list.length) {

        table.innerHTML =
          `<tr>
            <td
              colspan="6"
              class="empty-state"
            >
              ไม่มีรายการที่กำลังยืม
            </td>
          </tr>`;

        return;
      }

      table.innerHTML =
        list
          .map(
            history =>
              `<tr>

                <td>
                  ${escapeHtml(
                    history.id
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    history.equipmentName
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    history.borrower
                  )}
                </td>

                <td>
                  ${formatDate(
                    history.borrowDate
                  )}
                </td>

                <td>
                  ${formatDate(
                    history.returnDate
                  )}
                </td>

                <td>
                  <button
                    type="button"
                    class="return-action-button"
                    onclick="returnEquipment('${encodeURIComponent(
                      history.id
                    )}')"
                  >
                    คืนอุปกรณ์
                  </button>
                </td>

              </tr>`
          )
          .join('');

      initIcons();
    }

    // ----------------------------------------------------------
    // คืนอุปกรณ์
    // ----------------------------------------------------------

    window.returnEquipment =
      async encodedId => {

        const id =
          decodeURIComponent(
            encodedId
          );

        await completeReturn(
          id
        );
      };

    async function completeReturn(
      id
    ) {

      const record =
        records.find(
          history =>
            history.id ===
              id &&
            history.status ===
              'borrowing'
        );

      if (!record) {

        alert(
          'ไม่พบรายการยืม'
        );

        return;
      }

      // --------------------------------------------------------
      // ป้องกันคืนของคนอื่น
      // --------------------------------------------------------

      if (
        record.borrowerUid !==
        auth.currentUser?.uid
      ) {

        alert(
          'คุณไม่สามารถคืนอุปกรณ์ที่ผู้อื่นเป็นคนยืมได้'
        );

        return;
      }

      const item =
        data.find(
          equipment =>
            equipment.id ===
            record.equipmentId
        );

      if (!item) {

        alert(
          'ไม่พบอุปกรณ์รายการนี้'
        );

        return;
      }

      const returnedQuantity =
        Number(
          record.quantity || 1
        );

      const newAvailable =
        Math.min(
          Number(item.total),
          Number(item.available) +
            returnedQuantity
        );

      const updatedItem = {

        ...item,

        available:
          newAvailable,

        status:
          newAvailable >=
          Number(item.total)
            ? 'available'
            : 'borrowed',

        borrower:
          newAvailable >=
          Number(item.total)
            ? ''
            : item.borrower,

        updatedAt:
          new Date().toISOString()
      };

      const updatedRecord = {

        ...record,

        actualReturnDate:
          new Date().toISOString(),

        status:
          'returned',

        updatedAt:
          new Date().toISOString()
      };

      try {

        // ------------------------------------------------------
        // Firebase
        // ------------------------------------------------------

        await saveEquipmentFirebase(
          updatedItem
        );

        await updateBorrowFirebase(
          updatedRecord
        );

        await saveHistoryFirebase(
          updatedRecord
        );

        // ------------------------------------------------------
        // LocalStorage
        // ------------------------------------------------------

        data =
          data.map(
            equipment =>
              equipment.id ===
              updatedItem.id
                ? normalizeEquipment(
                    updatedItem
                  )
                : equipment
          );

        records =
          records.map(
            history =>
              history.id ===
              updatedRecord.id
                ? updatedRecord
                : history
          );

        saveEquipmentLocal(
          data
        );

        saveHistoryLocal(
          records
        );

        alert(
          'บันทึกการคืนอุปกรณ์เรียบร้อยแล้ว'
        );

        renderReturnOptions();

        renderTable();

      } catch (error) {

        console.error(
          'Return Error:',
          error
        );

        alert(
          'บันทึกการคืนไม่สำเร็จ: ' +
          firebaseErrorMessage(
            error
          )
        );
      }
    }

    // ----------------------------------------------------------
    // Submit คืน
    // ----------------------------------------------------------

    if (form) {

      form.addEventListener(
        'submit',
        async event => {

          event.preventDefault();

          const id =
            select?.value;

          if (!id) {

            alert(
              'กรุณาเลือกรายการยืม'
            );

            return;
          }

          await completeReturn(
            id
          );
        }
      );
    }

    renderReturnOptions();

    renderTable();
  }


  // ============================================================
  // HISTORY PAGE
  // ============================================================

  async function setupHistoryPage() {

    const table =
      qs('#historyTable');

    if (!table) {
      return;
    }

    const search =
      qs('#historySearch');

    const filter =
      qs('#statusFilter');

    const empty =
      qs('#emptyHistory');

    const modal =
      qs('#historyModal');

    const modalContent =
      qs('#historyModalContent');

    let all =
      await loadHistoryFromFirebase();

    // ----------------------------------------------------------
    // ผู้ใช้งานทั่วไปเห็นเฉพาะประวัติของตัวเอง
    // Admin เห็นทั้งหมด
    // ----------------------------------------------------------

    const currentRole =
      await getCurrentUserRole();

    if (
      currentRole !==
      'admin'
    ) {

      all =
        all.filter(
          history =>
            history.borrowerUid ===
            auth.currentUser?.uid
        );
    }

    // ----------------------------------------------------------
    // ตรวจสถานะ
    // ----------------------------------------------------------

    function effectiveStatus(
      history
    ) {

      if (
        history.status ===
        'returned'
      ) {

        return 'returned';
      }

      if (
        history.returnDate &&
        new Date(
          history.returnDate
        ) <
        new Date() &&
        !history.actualReturnDate
      ) {

        return 'overdue';
      }

      return 'borrowing';
    }
    // ----------------------------------------------------------
    // สถิติ
    // ----------------------------------------------------------

    function renderStats(
      data
    ) {

      const total =
        qs('#totalHistory');

      const borrowing =
        qs('#borrowingHistory');

      const returned =
        qs('#returnedHistory');

      const overdue =
        qs('#overdueHistory');

      if (total) {

        total.textContent =
          data.length;
      }

      if (borrowing) {

        borrowing.textContent =
          data.filter(
            history =>
              effectiveStatus(
                history
              ) ===
              'borrowing'
          ).length;
      }

      if (returned) {

        returned.textContent =
          data.filter(
            history =>
              effectiveStatus(
                history
              ) ===
              'returned'
          ).length;
      }

      if (overdue) {

        overdue.textContent =
          data.filter(
            history =>
              effectiveStatus(
                history
              ) ===
              'overdue'
          ).length;
      }
    }
    // ----------------------------------------------------------
    // Render
    // ----------------------------------------------------------

    function render() {

      renderStats(
        all
      );

      const term =
        (
          search?.value ||
          ''
        )
          .trim()
          .toLowerCase();

      const selected =
        filter?.value ||
        'all';

      const rows =
        all.filter(
          history => {

            const status =
              effectiveStatus(
                history
              );

            const text =
              [
                history.id,
                history.equipmentId,
                history.equipmentName,
                history.borrower,
                history.note
              ]
                .join(' ')
                .toLowerCase();

            const matchText =
              !term ||
              text.includes(
                term
              );

            const matchStatus =
              selected ===
                'all' ||
              selected ===
                status;

            return (
              matchText &&
              matchStatus
            );
          }
        );

      if (!rows.length) {

        table.innerHTML =
          `<tr>
            <td
              colspan="8"
              class="empty-state"
            >
              ไม่พบประวัติการยืม-คืน
            </td>
          </tr>`;

      } else {

        table.innerHTML =
          rows
            .map(
              history => {

                const status =
                  effectiveStatus(
                    history
                  );

                const labels = {

                  borrowing:
                    'กำลังยืม',

                  returned:
                    'คืนแล้ว',

                  overdue:
                    'เกินกำหนด'
                };

                return `
                  <tr>

                    <td>
                      ${escapeHtml(
                        history.id
                      )}
                    </td>

                    <td>
                      <div
                        class="equipment-name"
                      >

                        <i
                          data-lucide="package"
                        ></i>

                        <div>

                          <strong>
                            ${escapeHtml(
                              history.equipmentName ||
                              history.equipmentId
                            )}
                          </strong>

                          <small>
                            ${escapeHtml(
                              history.equipmentId ||
                              ''
                            )}
                          </small>

                        </div>

                      </div>
                    </td>

                    <td>
                      ${escapeHtml(
                        history.borrower ||
                        '-'
                      )}
                    </td>

                    <td>
                      ${formatDate(
                        history.borrowDate
                      )}
                    </td>

                    <td>
                      ${formatDate(
                        history.returnDate
                      )}
                    </td>

                    <td>
                      ${formatDate(
                        history.actualReturnDate
                      )}
                    </td>

                    <td>
                      <span
                        class="history-status ${status}"
                      >
                        ${labels[status]}
                      </span>
                    </td>

                    <td>

                      <button
                        type="button"
                        class="history-detail-button"
                        onclick="viewHistory('${encodeURIComponent(
                          history.id
                        )}')"
                      >

                        <i
                          data-lucide="eye"
                        ></i>

                        รายละเอียด

                      </button>

                    </td>

                  </tr>
                `;
              }
            )
            .join('');
      }

      if (empty) {

        empty.style.display =
          rows.length
            ? 'none'
            : '';
      }

      initIcons();
    }
    // ----------------------------------------------------------
    // ดูรายละเอียด
    // ----------------------------------------------------------

    window.viewHistory =
      encodedId => {

        const id =
          decodeURIComponent(
            encodedId
          );

        const history =
          all.find(
            item =>
              item.id ===
              id
          );

        if (
          !history ||
          !modal ||
          !modalContent
        ) {

          return;
        }

        const status =
          effectiveStatus(
            history
          );

        const labels = {

          borrowing:
            'กำลังยืม',

          returned:
            'คืนแล้ว',

          overdue:
            'เกินกำหนด'
        };

        modalContent.innerHTML =
          `
          <div
            class="history-detail-list"
          >

            <div
              class="history-detail-item"
            >

              <strong>
                เลขที่รายการ
              </strong>

              <span>
                ${escapeHtml(
                  history.id
                )}
              </span>

            </div>

            <div
              class="history-detail-item"
            >

              <strong>
                อุปกรณ์
              </strong>

              <span>
                ${escapeHtml(
                  history.equipmentName ||
                  history.equipmentId
                )}
              </span>

            </div>

            <div
              class="history-detail-item"
            >

              <strong>
                ผู้ยืม
              </strong>

              <span>
                ${escapeHtml(
                  history.borrower ||
                  '-'
                )}
              </span>

            </div>

            <div
              class="history-detail-item"
            >

              <strong>
                จำนวน
              </strong>

              <span>
                ${Number(
                  history.quantity ||
                  1
                )}
                ชิ้น
              </span>

            </div>

            <div
              class="history-detail-item"
            >

              <strong>
                วันที่ยืม
              </strong>

              <span>
                ${formatDate(
                  history.borrowDate
                )}
              </span>

            </div>

            <div
              class="history-detail-item"
            >

              <strong>
                กำหนดคืน
              </strong>

              <span>
                ${formatDate(
                  history.returnDate
                )}
              </span>

            </div>

            <div
              class="history-detail-item"
            >

              <strong>
                วันที่คืนจริง
              </strong>

              <span>
                ${formatDateTime(
                  history.actualReturnDate
                )}
              </span>

            </div>

            <div
              class="history-detail-item"
            >

              <strong>
                สถานะ
              </strong>

              <span>
                ${labels[status]}
              </span>

            </div>

            <div
              class="history-note"
            >

              <strong>
                หมายเหตุ
              </strong>

              <p>
                ${escapeHtml(
                  history.note ||
                  '-'
                )}
              </p>

            </div>

          </div>
          `;

        modal.classList.add(
          'show'
        );

        initIcons();
      };

    // ----------------------------------------------------------
    // ปุ่มปิด Modal
    // ----------------------------------------------------------

    qs(
      '#closeHistoryModal'
    )?.addEventListener(
      'click',
      () => {

        modal?.classList.remove(
          'show'
        );
      }
    );

    search?.addEventListener(
      'input',
      render
    );

    filter?.addEventListener(
      'change',
      render
    );

    render();
  }


  // ============================================================
  // INITIALIZE APP
  // ============================================================

  async function initializeApp() {

    console.log(
      'เริ่มต้นระบบ...'
    );

    // ----------------------------------------------------------
    // Firebase
    // ----------------------------------------------------------

    const ready =
      await initFirebase();

    if (
      !ready ||
      !auth ||
      !db
    ) {

      console.error(
        'Firebase ไม่พร้อมใช้งาน'
      );

      setupPasswordToggle();

      setupCommonUI();

      return;
    }

    // ----------------------------------------------------------
    // UI
    // ----------------------------------------------------------

    setupPasswordToggle();

    setupCommonUI();

    // ----------------------------------------------------------
    // Login / Register
    // ----------------------------------------------------------

    await setupLogin();

    await setupRegister();

    await setupForgotPassword();

    await setupResetPassword();

    // ----------------------------------------------------------
    // ตรวจสอบสิทธิ์
    // ----------------------------------------------------------

    const allowed =
      await guardProtectedPage();

    if (!allowed) {

      return;
    }

    // ----------------------------------------------------------
    // Seed อุปกรณ์เริ่มต้น
    // ----------------------------------------------------------

    if (
      auth.currentUser
    ) {

      await ensureEquipmentSeed();

      await loadEquipmentFromFirebase();

      await loadHistoryFromFirebase();
    }

    // ----------------------------------------------------------
    // หน้า Dashboard
    // ----------------------------------------------------------

    await setupDashboard();

    // ----------------------------------------------------------
    // หน้า Equipment
    // ----------------------------------------------------------

    await setupEquipmentPage();

    // ----------------------------------------------------------
    // หน้า Borrow
    // ----------------------------------------------------------

    await setupBorrowPage();

    // ----------------------------------------------------------
    // หน้า Return
    // ----------------------------------------------------------

    await setupReturnPage();

    // ----------------------------------------------------------
    // หน้า History
    // ----------------------------------------------------------

    await setupHistoryPage();

    // ----------------------------------------------------------
    // Modal
    // ----------------------------------------------------------

    setupMiscModals();

    // ----------------------------------------------------------
    // Icons
    // ----------------------------------------------------------

    initIcons();

    // ----------------------------------------------------------
    // แสดงชื่อผู้ใช้งาน
    // ----------------------------------------------------------

    const currentUser =
      auth.currentUser;

    if (
      currentUser
    ) {

      const name =
        localStorage.getItem(
          KEYS.userName
        ) ||
        currentUser.displayName ||
        currentUser.email ||
        'ผู้ใช้งาน';

      qsa(
        '#userName, .profile-name, #welcomeUserName'
      ).forEach(
        element => {

          element.textContent =
            name;
        }
      );
    }

    console.log(
      'ระบบพร้อมใช้งาน'
    );
  }

  // เริ่มระบบเพียงครั้งเดียว
  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      initializeApp,
      {
        once: true
      }
    );

  } else {

    initializeApp();
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

    // ----------------------------------------------------------
    // ตรวจสิทธิ์ Admin
    // ----------------------------------------------------------

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

    const addBtn =
      qs('#addEquipmentButton');

    const closeBtn =
      qs('#closeEquipmentFormModal');

    const idInput =
      qs('#equipmentId');

    const nameInput =
      qs('#equipmentName');

    const categoryInput =
      qs('#equipmentCategory');

    const statusInput =
      qs('#equipmentStatus');

    const borrowerInput =
      qs('#equipmentBorrower');

    const quantityInput =
      qs('#equipmentQuantity');

    let editingId =
      null;

    // ----------------------------------------------------------
    // โหลดข้อมูล
    // ----------------------------------------------------------

    let allData =
      await loadEquipmentFromFirebase();

    // ----------------------------------------------------------
    // เปิด Form
    // ----------------------------------------------------------

    function openForm(
      item = null
    ) {

      editingId =
        item?.id ||
        null;

      const title =
        qs('#equipmentFormTitle');

      if (title) {

        title.textContent =
          item
            ? 'แก้ไขข้อมูลอุปกรณ์'
            : 'เพิ่มอุปกรณ์';
      }

      if (idInput) {

        idInput.value =
          item?.id ||
          '';

        idInput.readOnly =
          !!item;
      }

      if (nameInput) {

        nameInput.value =
          item?.name ||
          '';
      }

      if (categoryInput) {

        categoryInput.value =
          item?.category ||
          '';
      }

      if (statusInput) {

        statusInput.value =
          item
            ? statusToThai(
                item.status
              )
            : 'พร้อมใช้งาน';
      }

      if (borrowerInput) {

        borrowerInput.value =
          item?.borrower ||
          '';
      }

      if (quantityInput) {

        quantityInput.value =
          item?.total ||
          1;
      }

      modal?.classList.add(
        'show'
      );
    }

    // ----------------------------------------------------------
    // ปิด Form
    // ----------------------------------------------------------

    function closeForm() {

      modal?.classList.remove(
        'show'
      );

      editingId =
        null;

      form?.reset();

      if (idInput) {

        idInput.readOnly =
          false;
      }
    }

    // ----------------------------------------------------------
    // Render ตาราง
    // ----------------------------------------------------------

    function render() {

      const keyword =
        (
          search?.value ||
          ''
        )
          .trim()
          .toLowerCase();

      const filtered =
        allData.filter(
          item => {

            if (!keyword) {
              return true;
            }

            const text =
              [
                item.id,
                item.name,
                item.category,
                item.borrower,
                statusToThai(
                  item.status
                )
              ]
                .join(' ')
                .toLowerCase();

            return text.includes(
              keyword
            );
          }
        );

      if (!filtered.length) {

        table.innerHTML =
          `
          <tr>
            <td
              colspan="6"
              class="empty-state"
            >
              ไม่พบข้อมูลอุปกรณ์
            </td>
          </tr>
          `;

        initIcons();

        return;
      }

      table.innerHTML =
        filtered
          .map(
            item => {

              const state =
                item.status ===
                'unavailable'

                  ? 'ไม่พร้อมใช้งาน'

                  : item.available <
                    item.total

                    ? 'กำลังถูกยืม'

                    : 'พร้อมใช้งาน';

              const statusClass =
                item.status ===
                'unavailable'

                  ? 'unavailable'

                  : item.available <
                    item.total

                    ? 'borrowed'

                    : 'available';

              return `
                <tr>

                  <td>
                    <strong>
                      ${escapeHtml(
                        item.id
                      )}
                    </strong>
                  </td>

                  <td>

                    <div
                      class="equipment-name"
                    >

                      <i
                        data-lucide="${escapeHtml(
                          equipmentIcon(
                            item.category
                          )
                        )}"
                      ></i>

                      <div>

                        <strong>
                          ${escapeHtml(
                            item.name
                          )}
                        </strong>

                        <small>
                          จำนวน
                          ${Number(
                            item.total ||
                            0
                          )}
                          ชิ้น
                          •
                          พร้อมใช้
                          ${Number(
                            item.available ||
                            0
                          )}
                        </small>

                      </div>

                    </div>

                  </td>

                  <td>
                    ${escapeHtml(
                      item.category ||
                      '-'
                    )}
                  </td>

                  <td>

                    <span
                      class="status-badge ${statusClass}"
                    >
                      ${state}
                    </span>

                  </td>

                  <td>
                    ${escapeHtml(
                      item.borrower ||
                      '-'
                    )}
                  </td>

                  <td>

                    <div
                      class="table-actions"
                    >

                      <button
                        type="button"
                        class="icon-button"
                        title="ดูรายละเอียด"
                        onclick="viewEquipment('${encodeURIComponent(
                          item.id
                        )}')"
                      >
                        <i
                          data-lucide="eye"
                        ></i>
                      </button>

                      <button
                        type="button"
                        class="icon-button"
                        title="แก้ไข"
                        onclick="editEquipment('${encodeURIComponent(
                          item.id
                        )}')"
                      >
                        <i
                          data-lucide="pencil"
                        ></i>
                      </button>

                      <button
                        type="button"
                        class="icon-button danger"
                        title="ลบ"
                        onclick="deleteEquipment('${encodeURIComponent(
                          item.id
                        )}')"
                      >
                        <i
                          data-lucide="trash-2"
                        ></i>
                      </button>

                    </div>

                  </td>

                </tr>
              `;
            }
          )
          .join('');

      initIcons();
    }

    // ----------------------------------------------------------
    // ปุ่มเพิ่ม
    // ----------------------------------------------------------

    addBtn?.addEventListener(
      'click',
      () => {

        openForm();
      }
    );

    // ----------------------------------------------------------
    // ปุ่มปิด
    // ----------------------------------------------------------

    closeBtn?.addEventListener(
      'click',
      closeForm
    );

    // ----------------------------------------------------------
    // Search
    // ----------------------------------------------------------

    search?.addEventListener(
      'input',
      render
    );

    // ----------------------------------------------------------
    // Submit เพิ่ม / แก้ไข
    // ----------------------------------------------------------

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

        const quantity =
          Math.max(
            1,
            Number(
              quantityInput?.value ||
              1
            )
          );

        const status =
          normalizeStatus(
            statusInput?.value ||
            'available'
          );

        const borrower =
          (
            borrowerInput?.value ||
            ''
          ).trim();

        // ------------------------------------------------------
        // ตรวจข้อมูล
        // ------------------------------------------------------

        if (
          !id ||
          !name
        ) {

          alert(
            'กรุณากรอกรหัสและชื่ออุปกรณ์'
          );

          return;
        }

        if (
          !Number.isFinite(
            quantity
          ) ||
          quantity < 1
        ) {

          alert(
            'จำนวนอุปกรณ์ต้องมากกว่า 0'
          );

          return;
        }

        const existing =
          allData.find(
            item =>
              item.id.toLowerCase() ===
              id.toLowerCase()
          );

        if (
          existing &&
          !editingId
        ) {

          alert(
            'รหัสอุปกรณ์นี้มีอยู่แล้ว'
          );

          return;
        }

        if (
          editingId &&
          !existing
        ) {

          alert(
            'ไม่พบอุปกรณ์ที่ต้องการแก้ไข'
          );

          return;
        }

        // ------------------------------------------------------
        // สร้างข้อมูล
        // ------------------------------------------------------

        let item;

        if (editingId) {

          const borrowedCount =
            Number(
              existing.total
            ) -
            Number(
              existing.available
            );

          if (
            quantity <
            borrowedCount
          ) {

            alert(
              `จำนวนใหม่ต้องไม่น้อยกว่าจำนวนที่กำลังถูกยืม (${borrowedCount} ชิ้น)`
            );

            return;
          }

          const newAvailable =
            status ===
            'unavailable'

              ? 0

              : quantity -
                borrowedCount;

          item = {

            ...existing,

            name,

            category,

            icon:
              equipmentIcon(
                category
              ),

            total:
              quantity,

            available:
              newAvailable,

            status:
              status ===
              'unavailable'

                ? 'unavailable'

                : borrowedCount > 0

                  ? 'borrowed'

                  : 'available',

            borrower,

            updatedAt:
              new Date()
                .toISOString()
          };

        } else {

          item = {

            id,

            name,

            category,

            icon:
              equipmentIcon(
                category
              ),

            total:
              quantity,

            available:
              status ===
              'unavailable'
                ? 0
                : quantity,

            status,

            borrower,

            createdAt:
              new Date()
                .toISOString(),

            updatedAt:
              new Date()
                .toISOString()
          };
        }

        const submitButton =
          form.querySelector(
            '[type="submit"]'
          );

        if (submitButton) {

          submitButton.disabled =
            true;

          submitButton.textContent =
            'กำลังบันทึก...';
        }

        try {

          // ----------------------------------------------------
          // Firebase
          // ----------------------------------------------------

          await saveEquipmentFirebase(
            item
          );

          // ----------------------------------------------------
          // LocalStorage
          // ----------------------------------------------------

          allData =
            [
              ...allData.filter(
                equipment =>
                  equipment.id !==
                  item.id
              ),
              normalizeEquipment(
                item
              )
            ];

          allData.sort(
            (a, b) =>
              a.id.localeCompare(
                b.id
              )
          );

          saveEquipmentLocal(
            allData
          );

          closeForm();

          render();

          alert(
            editingId
              ? 'แก้ไขข้อมูลอุปกรณ์เรียบร้อยแล้ว'
              : 'เพิ่มอุปกรณ์เรียบร้อยแล้ว'
          );

        } catch (error) {

          console.error(
            'Equipment Save Error:',
            error
          );

          alert(
            'บันทึกอุปกรณ์ไม่สำเร็จ: ' +
            firebaseErrorMessage(
              error
            )
          );

        } finally {

          if (submitButton) {

            submitButton.disabled =
              false;

            submitButton.textContent =
              'บันทึก';
          }
        }
      }
    );

    // ----------------------------------------------------------
    // ดูรายละเอียด
    // ----------------------------------------------------------

    window.viewEquipment =
      encodedId => {

        const id =
          decodeURIComponent(
            encodedId
          );

        const item =
          allData.find(
            equipment =>
              equipment.id ===
              id
          );

        const detailModal =
          qs(
            '#equipmentModal'
          );

        const content =
          qs(
            '#modalContent'
          );

        if (
          !item ||
          !detailModal ||
          !content
        ) {

          return;
        }

        const status =
          item.status ===
          'unavailable'

            ? 'ไม่พร้อมใช้งาน'

            : item.available <
              item.total

              ? 'กำลังถูกยืม'

              : 'พร้อมใช้งาน';

        content.innerHTML =
          `
          <div
            class="equipment-detail"
          >

            <div>

              <strong>
                รหัสอุปกรณ์
              </strong>

              <span>
                ${escapeHtml(
                  item.id
                )}
              </span>

            </div>

            <div>

              <strong>
                ชื่ออุปกรณ์
              </strong>

              <span>
                ${escapeHtml(
                  item.name
                )}
              </span>

            </div>

            <div>

              <strong>
                ประเภท
              </strong>

              <span>
                ${escapeHtml(
                  item.category ||
                  '-'
                )}
              </span>

            </div>

            <div>

              <strong>
                จำนวนทั้งหมด
              </strong>

              <span>
                ${Number(
                  item.total ||
                  0
                )}
                ชิ้น
              </span>

            </div>

            <div>

              <strong>
                พร้อมใช้งาน
              </strong>

              <span>
                ${Number(
                  item.available ||
                  0
                )}
                ชิ้น
              </span>

            </div>

            <div>

              <strong>
                สถานะ
              </strong>

              <span>
                ${status}
              </span>

            </div>

            <div>

              <strong>
                ผู้ยืม
              </strong>

              <span>
                ${escapeHtml(
                  item.borrower ||
                  '-'
                )}
              </span>

            </div>

          </div>
          `;

        detailModal.classList.add(
          'show'
        );

        initIcons();
      };

    // ----------------------------------------------------------
    // แก้ไข
    // ----------------------------------------------------------

    window.editEquipment =
      encodedId => {

        const id =
          decodeURIComponent(
            encodedId
          );

        const item =
          allData.find(
            equipment =>
              equipment.id ===
              id
          );

        if (item) {

          openForm(
            item
          );
        }
      };

    // ----------------------------------------------------------
    // ลบ
    // ----------------------------------------------------------

    window.deleteEquipment =
      async encodedId => {

        const id =
          decodeURIComponent(
            encodedId
          );

        const item =
          allData.find(
            equipment =>
              equipment.id ===
              id
          );

        if (!item) {
          return;
        }

        const borrowedCount =
          Number(
            item.total
          ) -
          Number(
            item.available
          );

        if (
          borrowedCount > 0
        ) {

          alert(
            'ไม่สามารถลบอุปกรณ์ที่กำลังถูกยืมได้'
          );

          return;
        }

        const confirmed =
          window.confirm(
            `ต้องการลบ “${item.name}” ใช่หรือไม่?`
          );

        if (!confirmed) {
          return;
        }

        try {

          await deleteEquipmentFirebase(
            id
          );

          allData =
            allData.filter(
              equipment =>
                equipment.id !==
                id
            );

          saveEquipmentLocal(
            allData
          );

          render();

          alert(
            'ลบอุปกรณ์เรียบร้อยแล้ว'
          );

        } catch (error) {

          console.error(
            'Delete Equipment Error:',
            error
          );

          alert(
            'ลบอุปกรณ์ไม่สำเร็จ: ' +
            firebaseErrorMessage(
              error
            )
          );
        }
      };

    // ----------------------------------------------------------
    // ปิด Detail Modal
    // ----------------------------------------------------------

    qs(
      '#closeModal'
    )?.addEventListener(
      'click',
      () => {

        qs(
          '#equipmentModal'
        )?.classList.remove(
          'show'
        );
      }
    );

    // ----------------------------------------------------------
    // แสดงตารางครั้งแรก
    // ----------------------------------------------------------

    render();
  }


  // ============================================================
  // MODAL ทั่วไป
  // ============================================================

  function setupMiscModals() {

    // ----------------------------------------------------------
    // Equipment Modal
    // ----------------------------------------------------------

    const equipmentModal =
      qs('#equipmentModal');

    const closeEquipmentModal =
      qs('#closeModal');

    closeEquipmentModal?.addEventListener(
      'click',
      () => {

        equipmentModal?.classList.remove(
          'show'
        );
      }
    );

    // ----------------------------------------------------------
    // Profile Modal
    // ----------------------------------------------------------

    const profileModal =
      qs('#profileModal');

    const closeProfileModal =
      qs('#closeProfileModal');

    closeProfileModal?.addEventListener(
      'click',
      () => {

        profileModal?.classList.remove(
          'show'
        );
      }
    );

    // ----------------------------------------------------------
    // History Modal
    // ----------------------------------------------------------

    const historyModal =
      qs('#historyModal');

    const closeHistoryModal =
      qs('#closeHistoryModal');

    closeHistoryModal?.addEventListener(
      'click',
      () => {

        historyModal?.classList.remove(
          'show'
        );
      }
    );

    // ----------------------------------------------------------
    // คลิกพื้นหลัง Modal เพื่อปิด
    // ----------------------------------------------------------

    [
      equipmentModal,
      profileModal,
      historyModal
    ]
      .filter(Boolean)
      .forEach(
        modal => {

          modal.addEventListener(
            'click',
            event => {

              if (
                event.target ===
                modal
              ) {

                modal.classList.remove(
                  'show'
                );
              }
            }
          );
        }
      );

    // ----------------------------------------------------------
    // ESC เพื่อปิด Modal
    // ----------------------------------------------------------

    document.addEventListener(
      'keydown',
      event => {

        if (
          event.key !==
          'Escape'
        ) {

          return;
        }

        [
          equipmentModal,
          profileModal,
          historyModal
        ]
          .filter(Boolean)
          .forEach(
            modal => {

              modal.classList.remove(
                'show'
              );
            }
          );
      }
    );
  }


  // ============================================================
  // ปิดระบบ
  // ============================================================

})();
