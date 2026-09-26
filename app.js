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
  // Utility Functions
  // ============================================================

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
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
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
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
      }[STATUS_MAP[status] || status] ||
      status ||
      '-'
    );
  }

  function normalizeStatus(status) {
    return STATUS_MAP[status] || 'available';
  }

  function getCurrentUser() {
    return parseJSON(KEYS.currentUser, null);
  }

  function getEquipmentLocal() {
    let data = parseJSON(KEYS.equipment, null);
    if (!Array.isArray(data)) data = parseJSON(KEYS.equipmentData, null);
    if (!Array.isArray(data)) data = DEFAULT_EQUIPMENT.map(x => ({ ...x }));
    return data;
  }

  function saveEquipmentLocal(data) {
    saveJSON(KEYS.equipment, data);
    saveJSON(KEYS.equipmentData, data);
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
    const current = getCurrentUser();
    return (
      localStorage.getItem(KEYS.userName) ||
      current?.name ||
      current?.email ||
      localStorage.getItem(KEYS.userEmail) ||
      'ผู้ใช้งาน'
    );
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
      'auth/too-many-requests': 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง',
      'auth/network-request-failed': 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้'
    };
    return map[code] || error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
  }

  // ============================================================
  // Async Firebase Script Loader
  // ============================================================

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
      script.async = true;

      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });

      script.addEventListener('error', () => {
        reject(new Error(`โหลด ${src} ไม่สำเร็จ`));
      }, { once: true });

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

      try {
        await loadScript(`${base}/firebase-app-compat.js`);
        await loadScript(`${base}/firebase-auth-compat.js`);
        await loadScript(`${base}/firebase-firestore-compat.js`);

        if (window.firebase) {
          if (!window.firebase.apps.length) {
            window.firebase.initializeApp(FIREBASE_CONFIG);
          }
          db = window.firebase.firestore();
          auth = window.firebase.auth();
          return true;
        }
      } catch (e) {
        console.warn('Firebase init deferred/failed:', e);
      }
      return false;
    })();

    return firebaseReadyPromise;
  }

  async function getUserProfile(user) {
    if (!user || !db) return null;
    try {
      const snap = await db.collection('users').doc(user.uid || user).get();
      return snap.exists ? snap.data() : null;
    } catch (e) {
      return null;
    }
  }

  // ============================================================
  // Fixed Password Toggle (No Observer Loop)
  // ============================================================

  function setupPasswordToggle() {
    qsa('.toggle-password').forEach(button => {
      if (button.dataset.passwordToggleReady === 'true') return;

      const wrapper = button.closest('.password-wrapper') || button.parentElement;
      const input = wrapper ? wrapper.querySelector('input') : null;

      if (!input) return;

      button.dataset.passwordToggleReady = 'true';
      button.type = 'button';
      button.textContent = input.type === 'text' ? 'ซ่อน' : 'แสดง';

      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        button.textContent = showing ? 'แสดง' : 'ซ่อน';
      });
    });
  }

  // ============================================================
  // Login Role UI
  // ============================================================

  function updateLoginRoleUI() {
    const roleSelect = qs('#loginRole');
    const adminCodeGroup = qs('#adminCodeGroup');
    const adminCode = qs('#adminCode');

    if (!roleSelect || !adminCodeGroup) return;

    const isAdmin = roleSelect.value === 'admin';
    adminCodeGroup.style.display = isAdmin ? 'block' : 'none';

    if (adminCode) {
      adminCode.required = isAdmin;
      if (!isAdmin) adminCode.value = '';
    }
  }

  // ============================================================
  // Login Implementation
  // ============================================================

  function setupLogin() {
    const form = qs('#loginForm');
    if (!form || form.dataset.loginBound === 'true') return;
    form.dataset.loginBound = 'true';

    const loginRole = qs('#loginRole');
    const adminCode = qs('#adminCode');
    const emailInput = qs('#email');
    const passwordInput = qs('#password');
    const rememberMe = qs('#rememberMe');
    const ADMIN_CODE = '24236';

    if (loginRole) {
      loginRole.addEventListener('change', updateLoginRoleUI);
      updateLoginRoleUI();
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const email = emailInput?.value?.trim() || '';
      const password = passwordInput?.value || '';
      const selectedRole = loginRole?.value || 'user';

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

      if (selectedRole === 'admin') {
        const code = adminCode?.value?.trim() || '';
        if (code !== ADMIN_CODE) {
          alert('รหัสผู้ดูแลระบบไม่ถูกต้อง');
          adminCode?.focus();
          return;
        }
      }

      const submitButton = form.querySelector('button[type="submit"]');
      const oldText = submitButton?.textContent || 'เข้าสู่ระบบ';

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'กำลังเข้าสู่ระบบ...';
      }

      try {
        const firebaseOK = await initFirebase();

        if (!firebaseOK || !auth) {
          // Fallback handling if offline or Firebase failure
          throw new Error('ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้ กรุณาตรวจสอบอินเทอร์เน็ต');
        }

        const credential = await auth.signInWithEmailAndPassword(email, password);
        const user = credential.user;
        const profile = await getUserProfile(user);
        const actualRole = profile?.role || 'user';

        if (selectedRole === 'admin' && actualRole !== 'admin') {
          await auth.signOut();
          alert('บัญชีนี้ไม่มีสิทธิ์เป็นผู้ดูแลระบบ');
          return;
        }

        const currentUser = {
          uid: user.uid,
          name: profile?.name || user.displayName || email,
          email: user.email || email,
          role: actualRole,
          loginAt: new Date().toISOString()
        };

        saveJSON(KEYS.currentUser, currentUser);
        localStorage.setItem(KEYS.loggedIn, 'true');
        localStorage.setItem(KEYS.userEmail, email);
        localStorage.setItem(KEYS.userName, currentUser.name);
        localStorage.setItem(KEYS.firebaseUid, user.uid);
        localStorage.setItem(KEYS.userRole, actualRole);

        if (rememberMe?.checked) {
          localStorage.setItem('rememberedEmail', email);
          localStorage.setItem('rememberedPassword', password);
        } else {
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberedPassword');
        }

        if (actualRole === 'admin') {
          window.location.href = 'dashboard.html';
        } else {
          window.location.href = 'borrow.html';
        }
      } catch (error) {
        alert(firebaseErrorMessage(error));
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = oldText;
        }
      }
    });
  }

  // ============================================================
  // Initialize Application
  // ============================================================

  function initializeApplication() {
    setupPasswordToggle();
    setupLogin();

    // Fire-and-forget init Firebase background load
    initFirebase();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
  } else {
    initializeApplication();
  }

  window.EquipmentBorrowSystem = {
    initFirebase
  };

})();
