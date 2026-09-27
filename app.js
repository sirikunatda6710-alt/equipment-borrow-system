(function () {
  'use strict';

  // ============================================================
  // Configuration
  // ============================================================

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC3JRPuC-2LCs8nqiLy_LKvi72NyLLd7_U",
    authDomain: "equipment-borrow-1303c.firebaseapp.com",
    projectId: "equipment-borrow-1303c",
    storageBucket: "equipment-borrow-1303c.firebasestorage.app",
    messagingSenderId: "433020378004",
    appId: "1:433020378004:web:d574cf9e4c7fafa4034d81",
    measurementId: "G-MFWPB1GBKZ"
  };

  const FIREBASE_VERSION = '12.19.0';

  const KEYS = {
    currentUser: 'equipment_current_user',
    loggedIn: 'isLoggedIn',
    userEmail: 'userEmail',
    userName: 'userName',
    firebaseUid: 'firebaseUid',
    userRole: 'userRole'
  };

  let db = null;
  let auth = null;
  let isFirebaseInitializing = false;

  // ============================================================
  // Date & Time Formatter
  // ============================================================

  function getCurrentDateTimeFormatted() {
    const now = new Date();
    return now.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(e);
    }
  }

  window.addSystemLog = function (action, detail) {
    try {
      let history = JSON.parse(localStorage.getItem('system_history')) || [];
      const currentUser = JSON.parse(localStorage.getItem('equipment_current_user')) || {};
      const adminName = currentUser.name || localStorage.getItem('userName') || 'ผู้ดูแลระบบ';
      
      history.unshift({
        action: action,
        detail: detail,
        adminName: adminName,
        date: getCurrentDateTimeFormatted()
      });
      localStorage.setItem('system_history', JSON.stringify(history));
    } catch (e) {
      console.error(e);
    }
  };

  function getEquipmentLocal() {
    const mockEquipment = [
      { id: "EQ-BUILD-001", name: "โปรเจกเตอร์ความละเอียดสูง (HD Projector)", category: "ครุภัณฑ์", total: 5, available: 1, status: "available" },
      { id: "EQ-BUILD-002", name: "จอรับภาพแบบขาตั้ง 100 นิ้ว", category: "ครุภัณฑ์", total: 4, available: 4, status: "available" },
      { id: "EQ-BUILD-003", name: "โต๊ะพับอเนกประสงค์หน้าขาว", category: "ครุภัณฑ์", total: 12, available: 10, status: "available" },
      { id: "EQ-MAT-001", name: "ปลั๊กพ่วงสายยาว 10 เมตร (4 ช่อง)", category: "วัสดุ", total: 15, available: 0, status: "available" },
      { id: "EQ-MAT-002", name: "สายแปลง HDMI to VGA", category: "วัสดุ", total: 10, available: 8, status: "available" },
      { id: "EQ-AUDIO-001", name: "ชุดลำโพงเคลื่อนย้ายพร้อมไมค์ไร้สาย (Portable Speaker)", category: "อุปกรณ์", total: 5, available: 3, status: "available" },
      { id: "EQ-AUDIO-002", name: "ไมโครโฟนไร้สายคู่ (Wireless Microphone Set)", category: "อุปกรณ์", total: 8, available: 6, status: "available" },
      { id: "EQ-AUDIO-003", name: "เครื่องผสมสัญญาณเสียง มิกเซอร์ 8 ช่อง", category: "อุปกรณ์", total: 3, available: 2, status: "available" },
      { id: "EQ-CAM-001", name: "กล้องถ่ายภาพ DSLR Canon EOS 80D พร้อมเลนส์ Kit", category: "บันทึกภาพ", total: 4, available: 2, status: "available" },
      { id: "EQ-CAM-002", name: "ขาตั้งกล้องอลูมิเนียม พร้อมหัวแพน (Tripod)", category: "บันทึกภาพ", total: 6, available: 5, status: "available" },
      { id: "EQ-CAM-003", name: "ชุดไฟต่อเนื่องสตูดิโอ (Softbox Light Set)", category: "บันทึกภาพ", total: 3, available: 3, status: "available" },
      { id: "EQ-CAM-004", name: "กล้องวิดีโอ 4K Sony Handycam", category: "บันทึกภาพ", total: 3, available: 1, status: "available" }
    ];

    try {
      const data = localStorage.getItem('equipment');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { console.error(e); }

    saveJSON('equipment', mockEquipment);
    return mockEquipment;
  }

  function firebaseErrorMessage(error) {
    const code = error?.code || '';
    const map = {
      'auth/api-key-not-valid': 'API Key ของ Firebase ไม่ถูกต้อง',
      'auth/email-already-in-use': 'อีเมลนี้มีบัญชีอยู่แล้ว',
      'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
      'auth/weak-password': 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      'auth/user-not-found': 'ไม่พบบัญชีผู้ใช้ในระบบ',
      'auth/wrong-password': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
    };
    return map[code] || error?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ';
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
      script.src = src; script.async = true;
      script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once: true });
      script.addEventListener('error', () => reject(new Error('Load failed')), { once: true });
      document.head.appendChild(script);
    });
  }

  async function initFirebase() {
    if (window.firebase?.apps?.length) {
      db = window.firebase.firestore(); auth = window.firebase.auth(); return true;
    }
    if (isFirebaseInitializing) return false;
    isFirebaseInitializing = true;
    try {
      const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
      await loadScript(`${base}/firebase-app-compat.js`);
      await loadScript(`${base}/firebase-auth-compat.js`);
      await loadScript(`${base}/firebase-firestore-compat.js`);
      if (window.firebase) {
        if (!window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
        db = window.firebase.firestore(); auth = window.firebase.auth();
        isFirebaseInitializing = false; return true;
      }
    } catch (e) { console.warn('Firebase init warning:', e); }
    isFirebaseInitializing = false; return false;
  }

  // ============================================================
  // Controls & UI
  // ============================================================

  function setupProfileModal() {
    const profileBtn = document.getElementById('profileButton');
    const profileModal = document.getElementById('profileModal');
    const closeBtn = document.getElementById('closeProfileModal');
    const saveBtn = document.getElementById('saveProfileButton');
    const nameInput = document.getElementById('editUserName');
    const logoutBtn = document.getElementById('logoutButton');

    if (logoutBtn && logoutBtn.dataset.bound !== 'true') {
      logoutBtn.dataset.bound = 'true';
      logoutBtn.addEventListener('click', () => {
        if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
          localStorage.removeItem('equipment_current_user');
          localStorage.setItem('isLoggedIn', 'false');
          window.location.href = 'index.html';
        }
      });
    }

    if (!profileModal) return;

    if (profileBtn && profileBtn.dataset.bound !== 'true') {
      profileBtn.dataset.bound = 'true';
      profileBtn.addEventListener('click', () => {
        const currentUser = JSON.parse(localStorage.getItem('equipment_current_user')) || {};
        if (nameInput) nameInput.value = currentUser.name || '';
        profileModal.style.display = 'flex';
      });
    }

    if (closeBtn && closeBtn.dataset.bound !== 'true') {
      closeBtn.dataset.bound = 'true';
      closeBtn.addEventListener('click', () => { profileModal.style.display = 'none'; });
    }

    if (saveBtn && saveBtn.dataset.bound !== 'true') {
      saveBtn.dataset.bound = 'true';
      saveBtn.addEventListener('click', () => {
        const newName = nameInput?.value?.trim();
        if (newName) {
          const currentUser = JSON.parse(localStorage.getItem('equipment_current_user')) || {};
          currentUser.name = newName;
          saveJSON('equipment_current_user', currentUser);
          localStorage.setItem('userName', newName);
          const userNameElem = document.getElementById('userName');
          if (userNameElem) userNameElem.textContent = newName;
          alert('บันทึกข้อมูลชื่อเรียบร้อยแล้ว');
        }
        profileModal.style.display = 'none';
      });
    }
  }

  function setupPasswordToggle() {
    document.querySelectorAll('.toggle-password').forEach(button => {
      if (button.dataset.ready === 'true') return;
      button.dataset.ready = 'true';
      button.addEventListener('click', event => {
        event.preventDefault();
        const wrapper = button.closest('.password-wrapper') || button.parentElement;
        const input = wrapper ? wrapper.querySelector('input') : null;
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        button.textContent = isPassword ? 'ซ่อน' : 'แสดง';
      });
    });
  }

  function setupRoleUI() {
    const roleSelect = document.getElementById('loginRole');
    const adminCodeGroup = document.getElementById('adminCodeGroup');
    const adminCode = document.getElementById('adminCode');
    if (!roleSelect || !adminCodeGroup) return;

    const update = () => {
      const isAdmin = roleSelect.value === 'admin';
      adminCodeGroup.style.display = isAdmin ? 'block' : 'none';
      if (adminCode) { adminCode.required = isAdmin; if (!isAdmin) adminCode.value = ''; }
    };
    roleSelect.addEventListener('change', update); 
    update();
  }

  function loadRememberedData() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberMe = document.getElementById('rememberMe');
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');
    if (emailInput && savedEmail) emailInput.value = savedEmail;
    if (passwordInput && savedPassword) passwordInput.value = savedPassword;
    if (rememberMe && savedEmail) rememberMe.checked = true;
  }

  // ============================================================
  // Login Feature
  // ============================================================

  function setupLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const email = document.getElementById('email')?.value?.trim() || '';
      const password = document.getElementById('password')?.value || '';
      const selectedRole = document.getElementById('loginRole')?.value || 'user';
      const adminCodeInput = document.getElementById('adminCode');

      if (!email || !password) { alert('กรุณากรอกอีเมลและรหัสผ่าน'); return; }
      if (selectedRole === 'admin' && adminCodeInput?.value?.trim() !== '24236') {
        alert('รหัสผู้ดูแลระบบไม่ถูกต้อง'); return;
      }

      try {
        const ready = await initFirebase();
        if (!ready || !auth) throw new Error('ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้');
        const cred = await auth.signInWithEmailAndPassword(email, password);
        const user = cred.user;
        let profile = null;
        try {
          const snap = await db.collection('users').doc(user.uid).get();
          if (snap.exists) profile = snap.data();
        } catch (e) {}

        const actualRole = profile?.role || 'user';
        if (selectedRole === 'admin' && actualRole !== 'admin') {
          await auth.signOut();
          alert('❌ การเข้าถึงถูกปฏิเสธ: บัญชีนี้ไม่มีสิทธิ์เป็นผู้ดูแลระบบ'); return;
        }

        const currentUserData = {
          uid: user.uid,
          name: profile?.name || user.displayName || email,
          email: user.email || email,
          role: actualRole
        };

        saveJSON(KEYS.currentUser, currentUserData);
        localStorage.setItem(KEYS.loggedIn, 'true');
        localStorage.setItem(KEYS.userEmail, email);
        localStorage.setItem(KEYS.userName, currentUserData.name);
        localStorage.setItem(KEYS.userRole, actualRole);

        window.location.href = 'dashboard.html';

      } catch (err) { alert(firebaseErrorMessage(err)); }
    });
  }

  // ============================================================
  // Register Feature
  // ============================================================

  function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const name = document.getElementById('regName')?.value?.trim() || '';
      const email = document.getElementById('regEmail')?.value?.trim() || '';
      const password = document.getElementById('regPassword')?.value || '';

      if (!name || !email || !password) { alert('กรุณากรอกข้อมูลให้ครบถ้วน'); return; }

      try {
        const ready = await initFirebase();
        if (!ready || !auth) throw new Error('ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้');

        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const user = cred.user;

        if (db) {
          await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            role: 'user',
            createdAt: new Date()
          });
        }

        alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
        window.location.href = 'index.html';

      } catch (err) { alert(firebaseErrorMessage(err)); }
    });
  }

  // ============================================================
  // Forgot Password Feature
  // ============================================================

  function setupForgotPasswordForm() {
    const form = document.getElementById('forgotPasswordForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgotEmail')?.value?.trim() || '';
      if (!email) { alert('กรุณากรอกอีเมลของคุณ'); return; }

      try {
        const ready = await initFirebase();
        if (!ready || !auth) throw new Error('ไม่สามารถเชื่อมต่อ Firebase ได้');

        await auth.sendPasswordResetEmail(email);
        alert(`ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมล:\n${email} เรียบร้อยแล้ว`);
        window.location.href = 'index.html';
      } catch (err) { alert(firebaseErrorMessage(err)); }
    });
  }

  // ============================================================
  // Init App Safely
  // ============================================================

  function boot() {
    try { setupPasswordToggle(); } catch (e) {}
    try { setupRoleUI(); } catch (e) {}
    try { loadRememberedData(); } catch (e) {}
    try { setupLoginForm(); } catch (e) {}
    try { setupRegisterForm(); } catch (e) {}
    try { setupForgotPasswordForm(); } catch (e) {}
    try { setupProfileModal(); } catch (e) {}
    if (window.lucide) { try { lucide.createIcons(); } catch (e) {} }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
