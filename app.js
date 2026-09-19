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
    firebaseUid: 'firebaseUid'
  };

  const DEFAULT_EQUIPMENT = [
    { id: 'EQ001', name: 'Projector Epson EB-X05', category: 'เครื่องฉาย', icon: 'projector', total: 10, available: 10, status: 'available', borrower: '' },
    { id: 'EQ002', name: 'กล้อง Nikon D5600', category: 'กล้องถ่ายภาพ', icon: 'camera', total: 5, available: 5, status: 'available', borrower: '' },
    { id: 'EQ003', name: 'ไมโครโฟนไร้สาย', category: 'เครื่องเสียง', icon: 'mic', total: 8, available: 8, status: 'available', borrower: '' },
    { id: 'EQ004', name: 'ลำโพง JBL', category: 'เครื่องเสียง', icon: 'speaker', total: 3, available: 3, status: 'available', borrower: '' }
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

  function qs(selector, root = document) { return root.querySelector(selector); }
  function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
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
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  }

  function makeId(prefix) {
    return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  }

  function statusToThai(status) {
    return ({ available: 'พร้อมใช้งาน', borrowed: 'กำลังถูกยืม', unavailable: 'ไม่พร้อมใช้งาน' }[STATUS_MAP[status] || status]) || status || '-';
  }

  function normalizeStatus(status) {
    return STATUS_MAP[status] || 'available';
  }

  function normalizeEquipment(item) {
    const total = Math.max(1, Number(item.total ?? item.quantity ?? 1));
    let available = Number(item.available);
    if (!Number.isFinite(available)) available = total;
    available = Math.max(0, Math.min(total, available));

    return {
      id: String(item.id ?? item.equipmentId ?? '').trim(),
      name: String(item.name ?? item.equipmentName ?? '').trim(),
      category: String(item.category ?? 'ทั่วไป').trim(),
      icon: item.icon || 'package',
      total,
      available,
      status: normalizeStatus(item.status || (available < total ? 'borrowed' : 'available')),
      borrower: String(item.borrower ?? '').trim(),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    };
  }
  function equipmentIcon(category) {
  // แมปชื่อประเภทกับชื่อไอคอน
  const map = {
    'เครื่องฉาย': 'projector',
    'กล้องถ่ายภาพ': 'camera',
    'เครื่องเสียง': 'mic'
  };
  // ถ้าไม่มีใน map ให้ใช้ไอคอน 'package' เป็นค่าเริ่มต้น
  return map[category] || 'package';
}

  function getEquipmentLocal() {
    let data = parseJSON(KEYS.equipment, null);
    if (!Array.isArray(data)) data = parseJSON(KEYS.equipmentData, null);
    if (!Array.isArray(data)) data = DEFAULT_EQUIPMENT.map(x => ({ ...x }));
    data = data.map(normalizeEquipment).filter(x => x.id && x.name);
    if (!data.length) data = DEFAULT_EQUIPMENT.map(x => ({ ...x }));
    return data;
  }

  function saveEquipmentLocal(data) {
    const normalized = data.map(normalizeEquipment);
    saveJSON(KEYS.equipment, normalized);
    saveJSON(KEYS.equipmentData, normalized);
    window.dispatchEvent(new CustomEvent('equipmentDataChanged'));
  }

  function getHistoryLocal() {
    const data = parseJSON(KEYS.history, []);
    return Array.isArray(data) ? data : [];
  }

  function saveHistoryLocal(data) {
    saveJSON(KEYS.history, data);
    window.dispatchEvent(new CustomEvent('historyDataChanged'));
  }

  function getCurrentUserName() {
    const current = parseJSON(KEYS.currentUser, null);
    return localStorage.getItem(KEYS.userName) || current?.name || current?.email || localStorage.getItem(KEYS.userEmail) || 'ผู้ใช้งาน';
  }

  function isLoggedIn() {
    return !!(auth && auth.currentUser);
  }

  function firebaseErrorMessage(error) {
    const code = error?.code || '';
    const map = {
      'auth/email-already-in-use': 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ',
      'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
      'auth/weak-password': 'รหัสผ่านไม่ปลอดภัยเพียงพอ',
      'auth/user-not-found': 'ไม่พบบัญชีผู้ใช้นี้',
      'auth/wrong-password': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      'auth/invalid-credential': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      'auth/too-many-requests': 'มีการลองเข้าสู่ระบบหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง',
      'auth/network-request-failed': 'ไม่สามารถเชื่อมต่อ Firebase ได้ กรุณาตรวจสอบอินเทอร์เน็ต',
      'auth/missing-password': 'กรุณากรอกรหัสผ่าน',
      'auth/expired-action-code': 'ลิงก์รีเซ็ตรหัสผ่านหมดอายุแล้ว',
      'auth/invalid-action-code': 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือถูกใช้ไปแล้ว'
    };
    return map[code] || error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => reject(new Error('โหลด Firebase SDK ไม่สำเร็จ')), { once: true });
      document.head.appendChild(script);
    });
  }

  async function initFirebase() {
    if (firebaseReadyPromise) return firebaseReadyPromise;

    firebaseReadyPromise = (async () => {
      if (window.firebase?.apps?.length) {
        db = window.firebase.firestore();
        auth = window.firebase.auth();
        return true;
      }

      const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
      await loadScript(`${base}/firebase-app-compat.js`);
      await loadScript(`${base}/firebase-auth-compat.js`);
      await loadScript(`${base}/firebase-firestore-compat.js`);

      window.firebase.initializeApp(FIREBASE_CONFIG);
      db = window.firebase.firestore();
      auth = window.firebase.auth();
      return true;
    })().catch(error => {
      console.error(error);
      return false;
    });

    return firebaseReadyPromise;
  }

  async function getUserProfile(user) {
    if (!user || !db) return null;
    try {
      const snap = await db.collection('users').doc(user.uid).get();
      return snap.exists ? snap.data() : null;
    } catch (error) {
      console.warn('อ่าน profile จาก Firestore ไม่สำเร็จ:', error);
      return null;
    }
  }

  async function ensureEquipmentSeed() {
    if (!db || !auth?.currentUser) return;
    try {
      const snapshot = await db.collection('equipment').limit(1).get();
      if (!snapshot.empty) return;

      const batch = db.batch();
      DEFAULT_EQUIPMENT.forEach(item => {
        const doc = db.collection('equipment').doc(item.id);
        batch.set(doc, {
          ...item,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
    } catch (error) {
      console.warn('Seed equipment ไม่สำเร็จ:', error);
    }
  }

  async function loadEquipmentFromFirebase() {
    if (!db || !auth?.currentUser) return getEquipmentLocal();
    try {
      const snap = await db.collection('equipment').get();
      const data = snap.docs.map(doc => normalizeEquipment({ id: doc.id, ...doc.data() }));
      if (data.length) {
        saveEquipmentLocal(data);
        return data;
      }
    } catch (error) {
      console.warn('อ่านอุปกรณ์จาก Firebase ไม่สำเร็จ:', error);
    }
    return getEquipmentLocal();
  }

  async function saveEquipmentFirebase(item) {
    if (!db || !auth?.currentUser) return;
    const normalized = normalizeEquipment(item);
    await db.collection('equipment').doc(normalized.id).set({
      ...normalized,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  async function deleteEquipmentFirebase(id) {
    if (!db || !auth?.currentUser) return;
    await db.collection('equipment').doc(id).delete();
  }

  async function loadHistoryFromFirebase() {
    if (!db || !auth?.currentUser) return getHistoryLocal();
    try {
      const snap = await db.collection('history').orderBy('createdAt', 'desc').get();
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      saveHistoryLocal(data);
      return data;
    } catch (error) {
      // หากยังไม่มี index ให้ fallback โดยไม่เรียง
      try {
        const snap = await db.collection('history').get();
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        saveHistoryLocal(data);
        return data;
      } catch (fallbackError) {
        console.warn('อ่านประวัติจาก Firebase ไม่สำเร็จ:', fallbackError);
      }
    }
    return getHistoryLocal();
  }

  async function saveHistoryFirebase(record) {
    if (!db || !auth?.currentUser) return;
    await db.collection('history').doc(record.id).set({ ...record, updatedAt: new Date().toISOString() }, { merge: true });
  }

  async function saveBorrowFirebase(record) {
    if (!db || !auth?.currentUser) return;
    await db.collection('borrow').doc(record.id).set({ ...record, updatedAt: new Date().toISOString() }, { merge: true });
  }

  async function updateBorrowFirebase(record) {
    if (!db || !auth?.currentUser) return;
    await db.collection('borrow').doc(record.id).set({ ...record, updatedAt: new Date().toISOString() }, { merge: true });
  }

  function initIcons() {

  const icons = {

    package: `
      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
      <path d="M3 9h18"></path>
      <path d="M9 3v6"></path>
    `,

    "circle-check": `
      <circle cx="12" cy="12" r="9"></circle>
      <path d="m9 12 2 2 4-4"></path>
    `,

    "clipboard-list": `
      <rect x="5" y="4" width="14" height="17" rx="2"></rect>
      <path d="M9 4V3h6v1"></path>
      <path d="M9 9h6"></path>
      <path d="M9 13h6"></path>
      <path d="M9 17h4"></path>
    `,

    "circle-x": `
      <circle cx="12" cy="12" r="9"></circle>
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
      <circle cx="11" cy="11" r="7"></circle>
      <path d="m20 20-4-4"></path>
    `,

    bell: `
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
      <path d="M10 21h4"></path>
    `,

    "circle-user-round": `
      <circle cx="12" cy="12" r="9"></circle>
      <circle cx="12" cy="10" r="3"></circle>
      <path d="M7 20c1-3 3-4 5-4s4 1 5 4"></path>
    `,

    "log-out": `
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <path d="m16 17 5-5-5-5"></path>
      <path d="M21 12H9"></path>
    `,

    "layout-dashboard": `
      <rect x="3" y="3" width="7" height="7" rx="1"></rect>
      <rect x="14" y="3" width="7" height="7" rx="1"></rect>
      <rect x="3" y="14" width="7" height="7" rx="1"></rect>
      <rect x="14" y="14" width="7" height="7" rx="1"></rect>
    `,

    "package-search": `
      <path d="M21 8 12 3 3 8v8l9 5 5-2.8"></path>
      <path d="M3 8l9 5 9-5"></path>
      <path d="M12 13v8"></path>
      <circle cx="17.5" cy="17.5" r="3"></circle>
      <path d="m20 20 2 2"></path>
    `,

    "undo-2": `
      <path d="M9 14 4 9l5-5"></path>
      <path d="M4 9h10a6 6 0 0 1 6 6v1"></path>
    `,

    history: `
      <path d="M3 12a9 9 0 1 0 3-6.7"></path>
      <path d="M3 4v5h5"></path>
      <path d="M12 7v5l3 2"></path>
    `,

    /* ===== ไอคอนที่เพิ่ม ===== */

    eye: `
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path>
      <circle cx="12" cy="12" r="2.5"></circle>
    `,

    pencil: `
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
    `,

    "trash-2": `
      <path d="M3 6h18"></path>
      <path d="M8 6V4h8v2"></path>
      <path d="M19 6l-1 15H6L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    `,

    plus: `
      <path d="M12 5v14"></path>
      <path d="M5 12h14"></path>
    `,

    minus: `
      <path d="M5 12h14"></path>
    `,

    "package-check": `
      <path d="m16.5 9.4-5 5-2.5-2.5"></path>
      <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z"></path>
      <path d="M3 8l9 5 9-5"></path>
      <path d="M12 13v8"></path>
    `,

    "calendar-days": `
      <rect x="3" y="4" width="18" height="18" rx="2"></rect>
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
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M12 8v4"></path>
      <path d="M12 16h.01"></path>
    `,
projector: `
  <path d="M5 7 3 5"/><path d="M19 7l2-2"/><path d="M22 9v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2Z"/><circle cx="9" cy="13" r="3"/><path d="M17 13h.01"/>
`,
camera: `
  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>
`,
mic: `
  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
`,
speaker: `
  <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><circle cx="12" cy="14" r="4"/><line x1="12" x2="12.01" y1="6" y2="6"/>
`,
    
  };

  qsa('[data-lucide]').forEach(element => {

    const name = element.getAttribute('data-lucide');
    const icon = icons[name];

    if (!icon) return;

    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );

    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '24');   // <-- เพิ่มบรรทัดนี้
    svg.setAttribute('height', '24');  // <-- เพิ่มบรรทัดนี้
    svg.setAttribute('fill', 'none');

    if (element.className) {
      svg.setAttribute('class', String(element.className));
    }

    svg.innerHTML = icon;

    element.replaceWith(svg);
  });

}
  // ============================================================
  // PASSWORD SHOW / HIDE
  // ============================================================
  function setupPasswordToggle() {
    qsa('.toggle-password').forEach(button => {
      if (button.dataset.passwordToggleReady === 'true') return;

      const wrapper = button.closest('.password-wrapper');
      const targetId = button.getAttribute('data-target') || button.getAttribute('aria-controls');
      const input =
        (wrapper && wrapper.querySelector('input')) ||
        (targetId ? document.getElementById(targetId) : null);

      if (!input) return;

      button.dataset.passwordToggleReady = 'true';
      button.type = 'button';
      button.textContent = input.type === 'text' ? 'ซ่อน' : 'แสดง';

      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        input.type = input.type === 'password' ? 'text' : 'password';
        button.textContent = input.type === 'password' ? 'แสดง' : 'ซ่อน';
        input.focus();
        try {
          const pos = input.value.length;
          input.setSelectionRange(pos, pos);
        } catch (_) {}
      });
    });
  }

  function setupCommonUI() {
    const name = getCurrentUserName();
    qsa('#userName, .profile-name, #welcomeUserName').forEach(el => { el.textContent = name; });

    const profileButton = qs('#profileButton');
    const profileModal = qs('#profileModal');
    const closeProfile = qs('#closeProfileModal');
    const editName = qs('#editUserName');
    const saveProfile = qs('#saveProfileButton');

    profileButton?.addEventListener('click', () => {
      if (editName) editName.value = getCurrentUserName();
      profileModal?.classList.add('show');
    });

    closeProfile?.addEventListener('click', () => profileModal?.classList.remove('show'));

    saveProfile?.addEventListener('click', async () => {
      const value = (editName?.value || '').trim();
      if (!value) return alert('กรุณากรอกชื่อผู้ใช้งาน');

      localStorage.setItem(KEYS.userName, value);
      const current = parseJSON(KEYS.currentUser, {});
      saveJSON(KEYS.currentUser, { ...current, name: value });
      qsa('#userName, .profile-name, #welcomeUserName').forEach(el => { el.textContent = value; });

      try {
        if (db && auth?.currentUser) {
          await db.collection('users').doc(auth.currentUser.uid).set({ name: value, updatedAt: new Date().toISOString() }, { merge: true });
        }
      } catch (error) {
        console.warn(error);
      }

      profileModal?.classList.remove('show');
    });

    qs('#logoutButton')?.addEventListener('click', async () => {
      try { await auth?.signOut(); } catch (_) {}
      localStorage.removeItem(KEYS.loggedIn);
      localStorage.removeItem(KEYS.currentUser);
      localStorage.removeItem(KEYS.userEmail);
      localStorage.removeItem(KEYS.userName);
      localStorage.removeItem(KEYS.firebaseUid);
      window.location.href = 'index.html';
    });

    const notificationCount = qs('#notificationCount');
    if (notificationCount) {
      const active = getHistoryLocal().filter(h => h.status === 'borrowing' && !h.actualReturnDate).length;
      notificationCount.textContent = active;
      notificationCount.style.display = active ? '' : 'none';
    }

    const headerSearch = qs('#headerSearch');
    headerSearch?.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const term = headerSearch.value.trim();
      if (!term) return;
      if (location.pathname.endsWith('equipment.html')) {
        const s = qs('#equipmentSearch');
        if (s) { s.value = term; s.dispatchEvent(new Event('input')); }
      } else if (location.pathname.endsWith('history.html')) {
        const s = qs('#historySearch');
        if (s) { s.value = term; s.dispatchEvent(new Event('input')); }
      }
    });
  }

async function setupLogin() {

    const form = qs('#loginForm');

    if (!form || !auth) {
        return;
    }

    const remember = qs('#rememberMe');
    const emailInput = qs('#email');
    const passwordInput = qs('#password');

    // ========================================
    // โหลดข้อมูลที่จดจำไว้
    // ========================================

    const savedEmail =
        localStorage.getItem('rememberedEmail');

    const savedPassword =
        localStorage.getItem('rememberedPassword');

    if (savedEmail && emailInput) {

        emailInput.value = savedEmail;

    }

    if (
        savedPassword &&
        passwordInput
    ) {

        passwordInput.value = savedPassword;

    }

    if (
        savedEmail &&
        savedPassword &&
        remember
    ) {

        remember.checked = true;

    }


    // ========================================
    // Login
    // ========================================

    form.addEventListener(
        'submit',
        async (e) => {

            e.preventDefault();

            const email =
                (emailInput?.value || '')
                    .trim()
                    .toLowerCase();

            const password =
                passwordInput?.value || '';


            // ตรวจสอบข้อมูล
            if (!email || !password) {

                alert(
                    'กรุณากรอกอีเมลและรหัสผ่าน'
                );

                return;
            }


            const submitButton =
                form.querySelector(
                    '[type="submit"]'
                );


            if (submitButton) {

                submitButton.disabled = true;

                submitButton.textContent =
                    'กำลังเข้าสู่ระบบ...';

            }


            try {

                // ========================================
                // Login Firebase
                // ========================================

                const credential =
                    await auth.signInWithEmailAndPassword(
                        email,
                        password
                    );

                const user =
                    credential.user;


                // ========================================
                // ดึงชื่อจาก Firestore
                // ========================================

                let name =
                    user.displayName ||
                    email;


                try {

                    const profileSnap =
                        await db
                            .collection('users')
                            .doc(user.uid)
                            .get();


                    if (
                        profileSnap.exists &&
                        profileSnap.data().name
                    ) {

                        name =
                            profileSnap.data().name;

                    }

                } catch (profileError) {

                    console.warn(
                        'อ่านข้อมูลสมาชิกไม่ได้ แต่ Login สำเร็จ:',
                        profileError
                    );

                }


                // ========================================
                // บันทึกสถานะ Login
                // ========================================

                localStorage.setItem(
                    'isLoggedIn',
                    'true'
                );

                localStorage.setItem(
                    'userEmail',
                    email
                );

                localStorage.setItem(
                    'firebaseUid',
                    user.uid
                );

                localStorage.setItem(
                    'userName',
                    name
                );


                localStorage.setItem(
                    'equipment_current_user',
                    JSON.stringify({
                        id: user.uid,
                        name: name,
                        email: email
                    })
                );


                // ========================================
                // จดจำอีเมล + รหัสผ่าน
                // ========================================

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


                // ========================================
                // ไป Dashboard
                // ========================================

                window.location.replace(
                    'dashboard.html'
                );

            } catch (error) {

                console.error(
                    'Firebase Login Error:',
                    error
                );

                alert(
                    firebaseErrorMessage(error)
                );

            } finally {

                if (submitButton) {

                    submitButton.disabled = false;

                    submitButton.textContent =
                        'เข้าสู่ระบบ';

                }

            }

        }
    );
}
  async function setupRegister() {
    const form = qs('#registerForm');
    if (!form || !auth) return;

    const password = qs('#password');
    const confirm = qs('#confirmPassword');
    password?.addEventListener('input', () => updatePasswordRules('rule', password.value));

    form.addEventListener('submit', async e => {
      e.preventDefault();

      const name = (qs('#name')?.value || '').trim();
      const email = (qs('#email')?.value || '').trim().toLowerCase();
      const pass = password?.value || '';
      const confirmPass = confirm?.value || '';

      if (!name || !email || !pass || !confirmPass) return alert('กรุณากรอกข้อมูลให้ครบ');
      if (!passwordValid(pass)) return alert('รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข');
      if (pass !== confirmPass) return alert('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');

      const submitButton = form.querySelector('[type="submit"]');
      if (submitButton) submitButton.disabled = true;

      try {
        const credential = await auth.createUserWithEmailAndPassword(email, pass);
        const user = credential.user;

        try {
          await user.updateProfile({ displayName: name });
        } catch (_) {}

        await db.collection('users').doc(user.uid).set({
          uid: user.uid,
          name,
          email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active'
        }, { merge: true });

        await auth.signOut();
        localStorage.setItem('registerEmail', email);
        alert('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');
        window.location.href = 'index.html';
      } catch (error) {
        alert(firebaseErrorMessage(error));
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  async function setupForgotPassword() {
    const form = qs('#forgotPasswordForm');
    if (!form || !auth) return;

    // รองรับทั้งหน้า Forgot แบบส่งอีเมล และหน้าเดิมที่มีช่อง password ซ้ำอยู่
    const passwordField = qs('#newPassword');
    const confirmField = qs('#confirmNewPassword');

    // หากมี password fields อยู่ในหน้า forgot ให้ซ่อนไว้ เพราะการรีเซ็ตที่ถูกต้อง
    // คือส่งอีเมลจาก Firebase แล้วตั้งรหัสผ่านบนหน้า reset-password
    if (passwordField) {
      const pWrap = passwordField.closest('.password-wrapper');
      const pLabel = qs('label[for="newPassword"]');
      const cWrap = confirmField?.closest('.password-wrapper');
      const cLabel = confirmField ? qs('label[for="confirmNewPassword"]') : null;
      const rules = qs('.password-rules');
      [passwordField, confirmField, pWrap, cWrap, pLabel, cLabel, rules].filter(Boolean).forEach(el => { el.style.display = 'none'; });
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = (qs('#forgotEmail')?.value || qs('#email')?.value || '').trim().toLowerCase();
      if (!email) return alert('กรุณากรอกอีเมล');

      const button = form.querySelector('[type="submit"]');
      if (button) button.disabled = true;

      try {
        await auth.sendPasswordResetEmail(email, {
          url: `${window.location.origin}${window.location.pathname.replace('forgot-password.html', 'reset-password.html')}`,
          handleCodeInApp: true
        });
        alert('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว กรุณาตรวจสอบกล่องจดหมายและ Spam/Junk');
      } catch (error) {
        alert(firebaseErrorMessage(error));
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function getActionCode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('oobCode');
  }

  async function setupResetPassword() {
    const form = qs('#resetPasswordForm');
    if (!form || !auth) return;

    const newPassword = qs('#newPassword');
    const confirm = qs('#confirmNewPassword');
    const code = getActionCode();

    if (newPassword) newPassword.addEventListener('input', () => updatePasswordRules('resetRule', newPassword.value));

    if (!code) {
      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      const warning = document.createElement('p');
      warning.className = 'login-error';
      warning.textContent = 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง กรุณากดลิงก์จากอีเมลอีกครั้ง';
      form.prepend(warning);
      return;
    }

    try {
      const email = await auth.verifyPasswordResetCode(code);
      const emailField = qs('#resetEmail');
      if (emailField) emailField.value = email;
    } catch (error) {
      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      alert(firebaseErrorMessage(error));
      return;
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const pass = newPassword?.value || '';
      const confirmPass = confirm?.value || '';
      if (!passwordValid(pass)) return alert('รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข');
      if (pass !== confirmPass) return alert('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');

      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;

      try {
        await auth.confirmPasswordReset(code, pass);
        alert('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบ');
        window.location.href = 'index.html';
      } catch (error) {
        alert(firebaseErrorMessage(error));
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
  async function setupDashboard() {
  const totalEquipmentEl = qs('#totalEquipment');
  const availableEquipmentEl = qs('#availableEquipment');
  const borrowedEquipmentEl = qs('#borrowedEquipment');
  const unavailableEquipmentEl = qs('#unavailableEquipment');
  const equipmentTable = qs('#equipmentTable');
  const userNameEl = qs('#userName');
  const headerSearch = qs('#headerSearch');
  const tableSearch = qs('#tableSearch');

  // ถ้าไม่ใช่หน้า Dashboard
  if (
    !totalEquipmentEl &&
    !availableEquipmentEl &&
    !borrowedEquipmentEl &&
    !unavailableEquipmentEl &&
    !equipmentTable
  ) {
    return;
  }

  // ==========================================
  // รอ Firebase
  // ==========================================
  const firebaseOK = await initFirebase();

  if (!firebaseOK || !auth) {
    console.error('Firebase ยังไม่พร้อมสำหรับ Dashboard');
    return;
  }

  // ==========================================
  // ตรวจสอบผู้ใช้ที่ Login อยู่
  // ==========================================
  const user = auth.currentUser;

  if (!user) {
    console.warn('ไม่พบผู้ใช้ที่ Login อยู่');

    window.location.replace('index.html');
    return;
  }

  console.log(
    'Dashboard User:',
    user.email
  );

  // ==========================================
  // ข้อมูลผู้ใช้งาน
  // ==========================================
  let userName =
    user.displayName ||
    localStorage.getItem(KEYS.userName) ||
    user.email ||
    'ผู้ใช้งาน';

  if (userNameEl) {
    userNameEl.textContent = userName;
  }

  localStorage.setItem(
    KEYS.userName,
    userName
  );

  localStorage.setItem(
    KEYS.userEmail,
    user.email || ''
  );

  localStorage.setItem(
    KEYS.firebaseUid,
    user.uid
  );

  // ==========================================
  // โหลดข้อมูลอุปกรณ์
  // ==========================================
  let equipment = [];

  try {

    if (db) {

      const snapshot =
        await db.collection('equipment').get();

      snapshot.forEach(doc => {

        const data = doc.data() || {};

        equipment.push({
          id: doc.id,
          ...data
        });

      });

      console.log(
        'โหลดอุปกรณ์จาก Firebase:',
        equipment.length,
        'รายการ'
      );

    }

  } catch (error) {

    console.error(
      'ไม่สามารถโหลด equipment จาก Firebase:',
      error
    );

  }

  // ==========================================
  // ถ้า Firebase ยังไม่มีข้อมูล
  // ให้ลองอ่าน LocalStorage
  // ==========================================
  if (!equipment.length) {

    const localEquipment =
      localStorage.getItem(KEYS.equipment) ||
      localStorage.getItem(KEYS.equipmentData);

    if (localEquipment) {

      try {

        const parsed =
          JSON.parse(localEquipment);

        if (Array.isArray(parsed)) {
          equipment = parsed;
        }

      } catch (error) {

        console.error(
          'อ่านข้อมูลอุปกรณ์จาก LocalStorage ไม่สำเร็จ:',
          error
        );

      }

    }

  }

  // ==========================================
  // ฟังก์ชันตรวจสถานะอุปกรณ์
  // ==========================================
  function getEquipmentStatus(item) {

    const status =
      String(
        item.status ||
        item.state ||
        item.availability ||
        ''
      )
        .trim()
        .toLowerCase();

    if (
      status === 'borrowed' ||
      status === 'ยืม' ||
      status === 'กำลังถูกยืม' ||
      status === 'ถูกยืม'
    ) {
      return 'borrowed';
    }

    if (
      status === 'unavailable' ||
      status === 'ไม่พร้อมใช้งาน' ||
      status === 'เสีย' ||
      status === 'ซ่อม'
    ) {
      return 'unavailable';
    }

    return 'available';
  }

  // ==========================================
  // คำนวณจำนวนอุปกรณ์
  // ==========================================
  let total = equipment.length;
  let available = 0;
  let borrowed = 0;
  let unavailable = 0;

  equipment.forEach(item => {

    const status =
      getEquipmentStatus(item);

    if (status === 'borrowed') {
      borrowed++;
    }
    else if (status === 'unavailable') {
      unavailable++;
    }
    else {
      available++;
    }

  });

  // ==========================================
  // แสดงสถิติบน Dashboard
  // ==========================================
  if (totalEquipmentEl) {
    totalEquipmentEl.textContent = total;
  }

  if (availableEquipmentEl) {
    availableEquipmentEl.textContent = available;
  }

  if (borrowedEquipmentEl) {
    borrowedEquipmentEl.textContent = borrowed;
  }

  if (unavailableEquipmentEl) {
    unavailableEquipmentEl.textContent =
      unavailable;
  }

  // ==========================================
  // แปลงสถานะสำหรับแสดงบนหน้าเว็บ
  // ==========================================
  function getStatusText(item) {

    const status =
      getEquipmentStatus(item);

    if (status === 'borrowed') {
      return 'กำลังถูกยืม';
    }

    if (status === 'unavailable') {
      return 'ไม่พร้อมใช้งาน';
    }

    return 'พร้อมใช้งาน';
  }

  // ==========================================
  // สร้างรายการอุปกรณ์ในตาราง
  // ==========================================
  function renderEquipmentTable(
    searchText = ''
  ) {

    if (!equipmentTable) return;

    const keyword =
      String(searchText)
        .trim()
        .toLowerCase();

    const filteredEquipment =
      equipment.filter(item => {

        if (!keyword) return true;

        const id =
          String(
            item.id ||
            item.equipmentId ||
            item.code ||
            ''
          );

        const name =
          String(
            item.name ||
            item.equipmentName ||
            item.title ||
            ''
          );

        const type =
          String(
            item.type ||
            item.category ||
            ''
          );

        const borrower =
          String(
            item.borrower ||
            item.borrowerName ||
            item.userName ||
            ''
          );

        return (
          id.toLowerCase().includes(keyword) ||
          name.toLowerCase().includes(keyword) ||
          type.toLowerCase().includes(keyword) ||
          borrower.toLowerCase().includes(keyword)
        );

      });

    // ไม่มีข้อมูล
    if (!filteredEquipment.length) {

      equipmentTable.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;">
            ไม่พบข้อมูลอุปกรณ์
          </td>
        </tr>
      `;

      return;
    }

    equipmentTable.innerHTML =
      filteredEquipment
        .map(item => {

          const id =
            item.equipmentId ||
            item.code ||
            item.id ||
            '-';

          const name =
            item.name ||
            item.equipmentName ||
            item.title ||
            '-';

          const type =
            item.type ||
            item.category ||
            '-';

          const status =
            getEquipmentStatus(item);

          const statusText =
            getStatusText(item);

          const borrower =
            item.borrower ||
            item.borrowerName ||
            item.userName ||
            '-';

          let statusClass =
            'status-available';

          if (status === 'borrowed') {
            statusClass =
              'status-borrowed';
          }

          if (status === 'unavailable') {
            statusClass =
              'status-unavailable';
          }

          return `
            <tr>
              <td>${escapeHtml(id)}</td>

              <td>${escapeHtml(name)}</td>

              <td>${escapeHtml(type)}</td>

              <td>
                <span class="status-badge ${statusClass}">
                  ${escapeHtml(statusText)}
                </span>
              </td>

              <td>
                ${escapeHtml(borrower)}
              </td>

              <td>
                <button
                  type="button"
                  class="table-action-button"
                  data-equipment-id="${escapeHtml(id)}"
                >
                  ดูรายละเอียด
                </button>
              </td>
            </tr>
          `;

        })
        .join('');

    // ========================================
    // ปุ่มดูรายละเอียด
    // ========================================
    qsa(
      '.table-action-button',
      equipmentTable
    ).forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const equipmentId =
            button.dataset.equipmentId;

          const item =
            equipment.find(
              equipmentItem =>
                String(
                  equipmentItem.equipmentId ||
                  equipmentItem.code ||
                  equipmentItem.id
                ) === String(equipmentId)
            );

          if (!item) return;

          const modal =
            qs('#equipmentModal');

          const modalContent =
            qs('#modalContent');

          if (
            modal &&
            modalContent
          ) {

            modalContent.innerHTML = `
              <h2>
                ${escapeHtml(
                  item.name ||
                  item.equipmentName ||
                  item.title ||
                  'รายละเอียดอุปกรณ์'
                )}
              </h2>

              <p>
                <strong>รหัส:</strong>
                ${escapeHtml(
                  item.equipmentId ||
                  item.code ||
                  item.id ||
                  '-'
                )}
              </p>

              <p>
                <strong>ประเภท:</strong>
                ${escapeHtml(
                  item.type ||
                  item.category ||
                  '-'
                )}
              </p>

              <p>
                <strong>สถานะ:</strong>
                ${escapeHtml(
                  getStatusText(item)
                )}
              </p>

              <p>
                <strong>ผู้ยืม:</strong>
                ${escapeHtml(
                  item.borrower ||
                  item.borrowerName ||
                  item.userName ||
                  '-'
                )}
              </p>
            `;

            modal.classList.add('show');

          }

        }
      );

    });

  }

  // ==========================================
  // แสดงข้อมูลครั้งแรก
  // ==========================================
  renderEquipmentTable();

  // ==========================================
  // ค้นหาจากช่องค้นหาด้านบน
  // ==========================================
  if (headerSearch) {

    headerSearch.addEventListener(
      'input',
      () => {

        const value =
          headerSearch.value;

        if (tableSearch) {
          tableSearch.value = value;
        }

        renderEquipmentTable(value);

      }
    );

  }

  // ==========================================
  // ค้นหาจากช่องค้นหาในตาราง
  // ==========================================
  if (tableSearch) {

    tableSearch.addEventListener(
      'input',
      () => {

        const value =
          tableSearch.value;

        if (headerSearch) {
          headerSearch.value = value;
        }

        renderEquipmentTable(value);

      }
    );

  }

  // ==========================================
  // ปุ่มปิด Modal
  // ==========================================
  const closeModal =
    qs('#closeModal');

  const equipmentModal =
    qs('#equipmentModal');

  if (
    closeModal &&
    equipmentModal
  ) {

    closeModal.addEventListener(
      'click',
      () => {
        equipmentModal.classList.remove(
          'show'
        );
      }
    );

  }

  // ==========================================
  // Logout
  // ==========================================
  const logoutButton =
    qs('#logoutButton');

  if (
    logoutButton &&
    logoutButton.dataset.logoutReady !== 'true'
  ) {

    logoutButton.dataset.logoutReady = 'true';

    logoutButton.addEventListener(
      'click',
      async () => {

        try {

          if (auth) {
            await auth.signOut();
          }

        } catch (error) {

          console.error(
            'Logout Error:',
            error
          );

        }

        // ล้างสถานะ Login
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
          KEYS.currentUser
        );

        window.location.replace(
          'index.html'
        );

      }
    );

  }

  console.log(
    'Dashboard พร้อมใช้งาน'
  );
}
  async function setupEquipmentPage() {
    const table = qs('#equipmentTable');
    if (!table) return;

    const search = qs('#equipmentSearch');
    const modal = qs('#equipmentFormModal');
    const form = qs('#equipmentForm');
    const addBtn = qs('#addEquipmentButton');
    const closeBtn = qs('#closeEquipmentFormModal');
    const idInput = qs('#equipmentId');
    const nameInput = qs('#equipmentName');
    const categoryInput = qs('#equipmentCategory');
    const statusInput = qs('#equipmentStatus');
    const borrowerInput = qs('#equipmentBorrower');
    const quantityInput = qs('#equipmentQuantity');
    let editingId = null;

    let allData = await loadEquipmentFromFirebase();

    function openForm(item = null) {
      editingId = item?.id || null;
      const title = qs('#equipmentFormTitle');
      if (title) title.textContent = item ? 'แก้ไขข้อมูลอุปกรณ์' : 'เพิ่มอุปกรณ์';
      if (idInput) { idInput.value = item?.id || ''; idInput.readOnly = !!item; }
      if (nameInput) nameInput.value = item?.name || '';
      if (categoryInput) categoryInput.value = item?.category || '';
      if (statusInput) statusInput.value = statusToThai(item?.status || 'available');
      if (borrowerInput) borrowerInput.value = item?.borrower || '';
      if (quantityInput) quantityInput.value = item?.total || 1;
      modal?.classList.add('show');
    }

    function closeForm() {
      modal?.classList.remove('show');
      editingId = null;
      form?.reset();
      if (idInput) idInput.readOnly = false;
    }

    function render() {
      const term = (search?.value || '').trim().toLowerCase();
      const data = allData.filter(x => !term || [x.id, x.name, x.category, x.borrower, statusToThai(x.status)].join(' ').toLowerCase().includes(term));

      if (!data.length) {
        table.innerHTML = '<tr><td colspan="6" class="empty-state">ไม่พบข้อมูลอุปกรณ์</td></tr>';
        initIcons();
        return;
      }

      table.innerHTML = data.map(x => {
        const state = x.status === 'unavailable' ? 'ไม่พร้อมใช้งาน' : (x.available < x.total ? 'กำลังถูกยืม' : 'พร้อมใช้งาน');
        const cls = x.status === 'unavailable' ? 'unavailable' : (x.available < x.total ? 'borrowed' : 'available');
        return `<tr>
          <td><strong>${escapeHtml(x.id)}</strong></td>
          <td><div class="equipment-name"><i data-lucide="${equipmentIcon(x.category)}"></i><div><strong>${escapeHtml(x.name)}</strong><small>จำนวน ${x.total} ชิ้น • พร้อมใช้ ${x.available}</small></div></div></td>
          <td>${escapeHtml(x.category)}</td>
          <td><span class="status-badge ${cls}">${state}</span></td>
          <td>${escapeHtml(x.borrower || '-')}</td>
          <td><div class="table-actions">
            <button type="button" class="icon-button" title="ดูรายละเอียด" onclick="viewEquipment('${encodeURIComponent(x.id)}')"><i data-lucide="eye"></i></button>
            <button type="button" class="icon-button" title="แก้ไข" onclick="editEquipment('${encodeURIComponent(x.id)}')"><i data-lucide="pencil"></i></button>
            <button type="button" class="icon-button danger" title="ลบ" onclick="deleteEquipment('${encodeURIComponent(x.id)}')"><i data-lucide="trash-2"></i></button>
          </div></td>
        </tr>`;
      }).join('');
      initIcons();
    }

    addBtn?.addEventListener('click', () => openForm());
    closeBtn?.addEventListener('click', closeForm);
    search?.addEventListener('input', render);

    form?.addEventListener('submit', async e => {
      e.preventDefault();
      const id = (idInput?.value || '').trim();
      const name = (nameInput?.value || '').trim();
      const category = (categoryInput?.value || 'ทั่วไป').trim();
      const quantity = Math.max(1, Number(quantityInput?.value || 1));
      const status = normalizeStatus(statusInput?.value || 'available');
      const borrower = (borrowerInput?.value || '').trim();

      if (!id || !name) return alert('กรุณากรอกรหัสและชื่ออุปกรณ์');
      if (!Number.isFinite(quantity) || quantity < 1) return alert('จำนวนอุปกรณ์ต้องมากกว่า 0');

      const existing = allData.find(x => x.id.toLowerCase() === id.toLowerCase());
      if (existing && !editingId) return alert('รหัสอุปกรณ์นี้มีอยู่แล้ว');
      if (editingId && !existing) return alert('ไม่พบอุปกรณ์ที่ต้องการแก้ไข');

      let item;
      if (editingId) {
        const borrowedCount = existing.total - existing.available;
        if (quantity < borrowedCount) return alert(`จำนวนใหม่ต้องไม่น้อยกว่าจำนวนที่กำลังถูกยืม (${borrowedCount} ชิ้น)`);
        item = {
          ...existing,
          name,
          category,
          icon: equipmentIcon(category),
          total: quantity,
          available: status === 'unavailable' ? 0 : quantity - borrowedCount,
          status: status === 'unavailable' ? 'unavailable' : (borrowedCount > 0 ? 'borrowed' : 'available'),
          borrower
        };
      } else {
        item = {
          id,
          name,
          category,
          icon: equipmentIcon(category),
          total: quantity,
          available: status === 'unavailable' ? 0 : quantity,
          status,
          borrower,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      try {
        await saveEquipmentFirebase(item);
        allData = [...allData.filter(x => x.id !== item.id), normalizeEquipment(item)];
        allData.sort((a, b) => a.id.localeCompare(b.id));
        saveEquipmentLocal(allData);
        closeForm();
        render();
      } catch (error) {
        alert('บันทึกอุปกรณ์ไม่สำเร็จ: ' + firebaseErrorMessage(error));
      }
    });

    window.viewEquipment = encodedId => {
      const id = decodeURIComponent(encodedId);
      const item = allData.find(x => x.id === id);
      const detailModal = qs('#equipmentModal');
      const content = qs('#modalContent');
      if (!item || !detailModal || !content) return;
      content.innerHTML = `<div class="equipment-detail">
        <div><strong>รหัสอุปกรณ์</strong><span>${escapeHtml(item.id)}</span></div>
        <div><strong>ชื่ออุปกรณ์</strong><span>${escapeHtml(item.name)}</span></div>
        <div><strong>ประเภท</strong><span>${escapeHtml(item.category)}</span></div>
        <div><strong>จำนวน</strong><span>${item.total} ชิ้น</span></div>
        <div><strong>พร้อมใช้งาน</strong><span>${item.available} ชิ้น</span></div>
        <div><strong>สถานะ</strong><span>${statusToThai(item.status)}</span></div>
        <div><strong>ผู้ยืม</strong><span>${escapeHtml(item.borrower || '-')}</span></div>
      </div>`;
      detailModal.classList.add('show');
      initIcons();
    };

    window.editEquipment = encodedId => {
      const id = decodeURIComponent(encodedId);
      const item = allData.find(x => x.id === id);
      if (item) openForm(item);
    };

    window.deleteEquipment = async encodedId => {
      const id = decodeURIComponent(encodedId);
      const item = allData.find(x => x.id === id);
      if (!item) return;
      if (item.total - item.available > 0) return alert('ไม่สามารถลบอุปกรณ์ที่กำลังถูกยืมได้');
      if (!confirm(`ต้องการลบ “${item.name}” ใช่หรือไม่?`)) return;

      try {
        await deleteEquipmentFirebase(id);
        allData = allData.filter(x => x.id !== id);
        saveEquipmentLocal(allData);
        render();
      } catch (error) {
        alert('ลบอุปกรณ์ไม่สำเร็จ: ' + firebaseErrorMessage(error));
      }
    };

    qs('#closeModal')?.addEventListener('click', () => qs('#equipmentModal')?.classList.remove('show'));
    render();
  }

  function populateEquipmentSelectLocal(select, data) {

  if (!select) return;

  const previous = select.value;

  const availableEquipment = data.filter(item => {

    const available = Number(item.available || 0);

    const status = normalizeStatus(item.status);

    return (
      status !== 'unavailable' &&
      available > 0
    );

  });

  select.innerHTML = `
    <option value="">
      -- เลือกอุปกรณ์ --
    </option>
  `;

  availableEquipment.forEach(item => {

    const option = document.createElement('option');

    option.value = item.id;

    option.textContent =
      `${item.name} (${item.id}) — เหลือ ${item.available} ชิ้น`;

    select.appendChild(option);

  });

  if (
    previous &&
    availableEquipment.some(item => item.id === previous)
  ) {

    select.value = previous;

  }

}
  async function setupBorrowPage() {
    const select = qs('#equipmentSelect');
    if (!select) return;

    const form = qs('#borrowForm');
    const quantity = qs('#borrowQuantity') || qs('#quantity');
    const borrower = qs('#borrowerName');
    const borrowDate = qs('#borrowDate');
    const returnDate = qs('#returnDate');
    const note = qs('#borrowNote');
    const terms = qs('#termsCheckbox');
    const confirmBtn = qs('#confirmBorrowButton');
    const sendOtp = qs('#sendOtpButton');
    const otpInputs = qsa('.otp-input');

    let data = await loadEquipmentFromFirebase();
    populateEquipmentSelectLocal(select, data);
    if (borrowDate && !borrowDate.value) borrowDate.value = todayISO();
    if (borrower && !borrower.value) borrower.value = getCurrentUserName();

    const updateSelected = () => {
      const item = data.find(x => x.id === select.value);
      const name = qs('#selectedEquipmentName');
      const code = qs('#selectedEquipmentCode');
      if (name) name.textContent = item?.name || '-';
      if (code) code.textContent = item?.id || '-';
      if (quantity && item) {
        quantity.max = String(item.available);
        if (Number(quantity.value || 1) > item.available) quantity.value = item.available;
      }
    };

    select.addEventListener('change', updateSelected);
    updateSelected();
    // เติมโค้ดนี้ต่อท้าย updateSelected();
    const urlParams = new URLSearchParams(window.location.search);
    const preSelectId = urlParams.get('id');
    if (preSelectId && select.querySelector(`option[value="${preSelectId}"]`)) {
        select.value = preSelectId;
        updateSelected(); // สั่งให้อัปเดตชื่อและรหัสลงช่องอัตโนมัติ
    }

   qsa('#decreaseButton, #increaseButton').forEach(btn => {

  // ป้องกันไม่ให้ปุ่มไป submit form
  btn.type = 'button';

  btn.addEventListener('click', event => {

    event.preventDefault();
    event.stopPropagation();

    const item =
      data.find(x => x.id === select.value);

    if (!quantity || !item) {
      alert('กรุณาเลือกอุปกรณ์ก่อน');
      return;
    }

    const current =
      Number(quantity.value || 1);

    let next;

    if (btn.id === 'increaseButton') {

      next = current + 1;

    } else {

      next = current - 1;

    }

    next =
      Math.max(
        1,
        Math.min(
          Number(item.available),
          next
        )
      );

    quantity.value = next;

  });

});
    sendOtp?.addEventListener('click', () => {
      alert('ระบบ OTP สำหรับการยืมยังเป็นโหมดตัวอย่าง ไม่ใช่ OTP จริง');
      otpInputs[0]?.focus();
    });
    otpInputs.forEach((input, i) => input.addEventListener('input', () => { if (input.value && otpInputs[i + 1]) otpInputs[i + 1].focus(); }));

    async function doBorrow(e) {
      e?.preventDefault();
      if (!auth?.currentUser) return alert('กรุณาเข้าสู่ระบบก่อนยืมอุปกรณ์');

      const item = data.find(x => x.id === select.value);
      const qty = Math.max(1, Number(quantity?.value || 1));
      const who = (borrower?.value || getCurrentUserName()).trim();
      if (!item) return alert('กรุณาเลือกอุปกรณ์');
      if (qty > item.available) return alert('จำนวนที่ยืมมากกว่าจำนวนที่มีอยู่');
      if (!who) return alert('กรุณาระบุชื่อผู้ยืม');
      if (terms && !terms.checked) return alert('กรุณายอมรับเงื่อนไขการยืม');

      const updatedItem = {
        ...item,
        available: item.available - qty,
        status: item.available - qty === 0 ? 'borrowed' : 'available',
        borrower: who,
        updatedAt: new Date().toISOString()
      };

      const record = {
        id: makeId('BR'),
        equipmentId: item.id,
        equipmentName: item.name,
        borrower: who,
        borrowerUid: auth.currentUser.uid,
        borrowDate: borrowDate?.value || todayISO(),
        returnDate: returnDate?.value || '',
        actualReturnDate: '',
        quantity: qty,
        note: note?.value?.trim() || '',
        status: 'borrowing',
        createdAt: new Date().toISOString()
      };

      try {
        await saveEquipmentFirebase(updatedItem);
        await saveBorrowFirebase(record);
        await saveHistoryFirebase(record);

        data = data.map(x => x.id === updatedItem.id ? normalizeEquipment(updatedItem) : x);
        saveEquipmentLocal(data);
        const history = getHistoryLocal();
        history.unshift(record);
        saveHistoryLocal(history);

        alert('บันทึกการยืมอุปกรณ์เรียบร้อยแล้ว');
        form?.reset();
        if (borrowDate) borrowDate.value = todayISO();
        if (borrower) borrower.value = getCurrentUserName();
        populateEquipmentSelectLocal(select, data);
        updateSelected();
      } catch (error) {
        alert('บันทึกการยืมไม่สำเร็จ: ' + firebaseErrorMessage(error));
      }
    }

    if (form) form.addEventListener('submit', doBorrow);
    else confirmBtn?.addEventListener('click', doBorrow);
  }
async function setupReturnPage() {
  const select = qs('#returnEquipmentSelect');
  const form = qs('#returnForm');
  const table = qs('#returnTable');
  if (!select && !form && !table) return;

  let records = await loadHistoryFromFirebase();
  let data = await loadEquipmentFromFirebase();

  const active = () => records.filter(h => h.status === 'borrowing' && !h.actualReturnDate);

  function renderReturnOptions() {
    if (!select) return;
    select.innerHTML = '<option value="">-- เลือกรายการยืม --</option>' + active().map(h => `<option value="${escapeHtml(h.id)}">${escapeHtml(h.equipmentName)} — ${escapeHtml(h.borrower)}</option>`).join('');
  }

  function renderTable() {
    if (!table) return;
    const list = active();
    const today = todayISO();
    
    table.innerHTML = list.length
      ? list.map(h => {
          const isOverdue = h.returnDate && h.returnDate < today;
          const statusHtml = isOverdue 
            ? '<span class="status-badge status-unavailable">เลยกำหนดคืน</span>' 
            : '<span class="status-badge status-available">อยู่ในกำหนด</span>';

          return `<tr>
            <td>${escapeHtml(h.id)}</td>
            <td>${escapeHtml(h.equipmentName)}</td>
            <td>${escapeHtml(h.borrower)}</td>
            <td>${formatDate(h.borrowDate)}</td>
            <td>${formatDate(h.returnDate)}</td>
            <td>${statusHtml}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="6" class="empty-state">ไม่มีรายการที่กำลังยืม</td></tr>';
    initIcons();
  }

  async function completeReturn(id) {
    const record = records.find(h => h.id === id && h.status === 'borrowing');
    if (!record) return alert('ไม่พบรายการยืม');
    const item = data.find(x => x.id === record.equipmentId);
    if (!item) return alert('ไม่พบอุปกรณ์รายการนี้');

    const updatedItem = {
      ...item,
      available: Math.min(item.total, item.available + Number(record.quantity || 1)),
      status: Math.min(item.total, item.available + Number(record.quantity || 1)) === item.total ? 'available' : 'borrowed',
      borrower: Math.min(item.total, item.available + Number(record.quantity || 1)) === item.total ? '' : item.borrower,
      updatedAt: new Date().toISOString()
    };

    const updatedRecord = {
      ...record,
      actualReturnDate: new Date().toISOString(),
      status: 'returned',
      updatedAt: new Date().toISOString()
    };

    try {
      await saveEquipmentFirebase(updatedItem);
      await updateBorrowFirebase(updatedRecord);
      await saveHistoryFirebase(updatedRecord);

      data = data.map(x => x.id === updatedItem.id ? normalizeEquipment(updatedItem) : x);
      records = records.map(x => x.id === updatedRecord.id ? updatedRecord : x);
      saveEquipmentLocal(data);
      saveHistoryLocal(records);

      alert('คืนอุปกรณ์เรียบร้อยแล้ว');
      window.location.replace('dashboard.html');
    } catch (error) {
      alert('บันทึกการคืนไม่สำเร็จ: ' + firebaseErrorMessage(error));
    }
  }

  if (form) form.addEventListener('submit', async e => {
    e.preventDefault();
    const id = select?.value;
    if (!id) return alert('กรุณาเลือกรายการยืม');
    await completeReturn(id);
  });

  renderReturnOptions();
  renderTable();
}
  async function setupHistoryPage() {
    const table = qs('#historyTable');
    if (!table) return;

    const search = qs('#historySearch');
    const filter = qs('#statusFilter');
    const empty = qs('#emptyHistory');
    const modal = qs('#historyModal');
    const modalContent = qs('#historyModalContent');
    let all = await loadHistoryFromFirebase();

    function effectiveStatus(h) {
      if (h.status === 'returned') return 'returned';
      if (h.returnDate && new Date(h.returnDate) < new Date() && !h.actualReturnDate) return 'overdue';
      return 'borrowing';
    }

    function renderStats(data) {
      if (qs('#totalHistory')) qs('#totalHistory').textContent = data.length;
      if (qs('#borrowingHistory')) qs('#borrowingHistory').textContent = data.filter(h => effectiveStatus(h) === 'borrowing').length;
      if (qs('#returnedHistory')) qs('#returnedHistory').textContent = data.filter(h => effectiveStatus(h) === 'returned').length;
      if (qs('#overdueHistory')) qs('#overdueHistory').textContent = data.filter(h => effectiveStatus(h) === 'overdue').length;
    }

    function render() {
      renderStats(all);
      const term = (search?.value || '').trim().toLowerCase();
      const selected = filter?.value || 'all';
      const rows = all.filter(h => {
        const status = effectiveStatus(h);
        const text = [h.id, h.equipmentId, h.equipmentName, h.borrower, h.note].join(' ').toLowerCase();
        return (!term || text.includes(term)) && (selected === 'all' || selected === status);
      });

      table.innerHTML = rows.map(h => {
        const status = effectiveStatus(h);
        const label = { borrowing: 'กำลังยืม', returned: 'คืนแล้ว', overdue: 'เกินกำหนด' }[status];
        return `<tr>
          <td>${escapeHtml(h.id)}</td>
          <td><div class="equipment-name"><i data-lucide="package"></i><div><strong>${escapeHtml(h.equipmentName || h.equipmentId)}</strong><small>${escapeHtml(h.equipmentId || '')}</small></div></div></td>
          <td><div class="borrower-name">${escapeHtml(h.borrower || '-')}</div></td>
          <td>${formatDate(h.borrowDate)}</td>
          <td>${formatDate(h.returnDate)}</td>
          <td>${formatDate(h.actualReturnDate)}</td>
          <td><span class="history-status ${status}">${label}</span></td>
          <td><button type="button" class="history-detail-button" onclick="viewHistory('${encodeURIComponent(h.id)}')"><i data-lucide="eye"></i> รายละเอียด</button></td>
        </tr>`;
      }).join('');

      if (empty) empty.style.display = rows.length ? 'none' : '';
      initIcons();
    }

    window.viewHistory = encodedId => {
      const id = decodeURIComponent(encodedId);
      const h = all.find(x => x.id === id);
      if (!h || !modal || !modalContent) return;
      const status = effectiveStatus(h);
      const label = { borrowing: 'กำลังยืม', returned: 'คืนแล้ว', overdue: 'เกินกำหนด' }[status];
      modalContent.innerHTML = `<div class="history-detail-list">
        <div class="history-detail-item"><strong>เลขที่รายการ</strong><span>${escapeHtml(h.id)}</span></div>
        <div class="history-detail-item"><strong>อุปกรณ์</strong><span>${escapeHtml(h.equipmentName || h.equipmentId)}</span></div>
        <div class="history-detail-item"><strong>ผู้ยืม</strong><span>${escapeHtml(h.borrower || '-')}</span></div>
        <div class="history-detail-item"><strong>จำนวน</strong><span>${Number(h.quantity || 1)} ชิ้น</span></div>
        <div class="history-detail-item"><strong>วันที่ยืม</strong><span>${formatDate(h.borrowDate)}</span></div>
        <div class="history-detail-item"><strong>กำหนดคืน</strong><span>${formatDate(h.returnDate)}</span></div>
        <div class="history-detail-item"><strong>วันที่คืนจริง</strong><span>${formatDateTime(h.actualReturnDate)}</span></div>
        <div class="history-detail-item"><strong>สถานะ</strong><span>${label}</span></div>
        <div class="history-note"><strong>หมายเหตุ</strong><p>${escapeHtml(h.note || '-')}</p></div>
      </div>`;
      modal.classList.add('show');
      initIcons();
    };

    qs('#closeHistoryModal')?.addEventListener('click', () => modal?.classList.remove('show'));
    search?.addEventListener('input', render);
    filter?.addEventListener('change', render);
    render();
  }

  function setupMiscModals() {
    qsa('.modal').forEach(modal => {
      modal.addEventListener('click', e => {
        if (e.target === modal) modal.classList.remove('show');
      });
    });

    qs('#notificationButton')?.addEventListener('click', () => {
      if (location.pathname.endsWith('history.html')) return;
      window.location.href = 'history.html';
    });
  }

  async function guardProtectedPage() {

    const page =
        location.pathname.split('/').pop() || 'index.html';

    const publicPages = [
        'index.html',
        'register.html',
        'forgot-password.html',
        'reset-password.html',
        ''
    ];

    // หน้า Login / Register ไม่ต้องตรวจสอบ Login
    if (publicPages.includes(page)) {
        return true;
    }

    if (!auth) {
        console.error('Firebase Auth ยังไม่พร้อม');
        window.location.replace('index.html');
        return false;
    }

    // ⭐ รอ Firebase ตรวจสอบ Session ก่อน
    const user = await new Promise(resolve => {

        if (auth.currentUser) {
            resolve(auth.currentUser);
            return;
        }

        let unsubscribe = null;

        unsubscribe = auth.onAuthStateChanged(currentUser => {

            if (unsubscribe) {
                unsubscribe();
            }

            resolve(currentUser);

        });

    });

    // ไม่มี Login
    if (!user) {

        console.log(
            'ไม่พบผู้ใช้ที่ Login อยู่ → กลับหน้า Login'
        );

        localStorage.removeItem(KEYS.loggedIn);
        localStorage.removeItem(KEYS.firebaseUid);
        localStorage.removeItem(KEYS.userEmail);
        localStorage.removeItem(KEYS.userName);
        localStorage.removeItem(KEYS.currentUser);

        window.location.replace('index.html');

        return false;
    }

    // ⭐ มี Login แล้ว
    console.log(
        'Firebase Login ตรวจสอบสำเร็จ:',
        user.email
    );

    let name =
        localStorage.getItem(KEYS.userName) ||
        user.displayName ||
        user.email ||
        'ผู้ใช้งาน';

    try {

        const profile =
            await getUserProfile(user);

        if (profile?.name) {
            name = profile.name;
        }

    } catch (error) {

        console.warn(
            'อ่านข้อมูลผู้ใช้ไม่สำเร็จ:',
            error
        );

    }

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
        user.email || ''
    );

    localStorage.setItem(
        KEYS.userName,
        name
    );

    saveJSON(
        KEYS.currentUser,
        {
            id: user.uid,
            name: name,
            email: user.email || ''
        }
    );

    return true;
}
 async function initializeApp() {

  console.log('เริ่มต้นระบบ...');

  // ==============================
  // 1. Firebase
  // ==============================

  const ready = await initFirebase();

  if (!ready || !auth || !db) {

    console.error(
      'Firebase ไม่พร้อมใช้งาน'
    );

    setupPasswordToggle();

    setupCommonUI();

    return;
  }


  // ==============================
  // 2. UI พื้นฐาน
  // ==============================

  setupPasswordToggle();

  setupCommonUI();


  // ==============================
  // 3. Login / Register
  // ==============================

  await setupLogin();

  await setupRegister();

  await setupForgotPassword();

  await setupResetPassword();


  // ==============================
  // 4. ตรวจสอบ Login
  // ==============================

  const protectedPageAllowed =
    await guardProtectedPage();

  if (!protectedPageAllowed) {

    return;

  }


  // ==============================
  // 5. เตรียมข้อมูล Firebase
  // ต้องทำก่อนหน้า Borrow / Return
  // ==============================

  if (auth.currentUser) {

    await ensureEquipmentSeed();

    await loadEquipmentFromFirebase();

    await loadHistoryFromFirebase();

  }


  // ==============================
  // 6. Dashboard
  // ==============================

  await setupDashboard();


  // ==============================
  // 7. Equipment
  // ==============================

  await setupEquipmentPage();


  // ==============================
  // 8. Borrow
  // ==============================

  await setupBorrowPage();


  // ==============================
  // 9. Return
  // ==============================

  await setupReturnPage();


  // ==============================
  // 10. History
  // ==============================

  await setupHistoryPage();


  // ==============================
  // 11. Modal
  // ==============================

  setupMiscModals();


  // ==============================
  // 12. Icons
  // ==============================

  initIcons();


  // ==============================
  // 13. แสดงชื่อผู้ใช้
  // ==============================

  const currentUser =
    auth.currentUser;

  if (currentUser) {

    const name =
      localStorage.getItem(KEYS.userName) ||
      currentUser.displayName ||
      currentUser.email ||
      'ผู้ใช้งาน';

    qsa(
      '#userName, .profile-name, #welcomeUserName'
    ).forEach(element => {

      element.textContent = name;

    });

  }


  console.log(
    'ระบบพร้อมใช้งาน'
  );

}
document.addEventListener(
    'DOMContentLoaded',
    initializeApp
);})();
