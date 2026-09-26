(function () {
  'use strict';

  // ============================================================
  // Configuration (อัปเดต API Key ล่าสุดเรียบร้อยแล้ว)
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
  // Helpers
  // ============================================================

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(e);
    }
  }

  function firebaseErrorMessage(error) {
    const code = error?.code || '';
    const map = {
      'auth/api-key-not-valid': 'API Key ของ Firebase ไม่ถูกต้อง กรุณาตรวจสอบใน Project Settings',
      'auth/invalid-api-key': 'API Key ของ Firebase ไม่ถูกต้อง',
      'auth/email-already-in-use': 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ',
      'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
      'auth/weak-password': 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      'auth/user-not-found': 'ไม่พบบัญชีผู้ใช้นี้',
      'auth/wrong-password': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      'auth/invalid-credential': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      'auth/too-many-requests': 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณาลองใหม่ในภายหลัง'
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
      script.src = src;
      script.async = true;

      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });

      script.addEventListener('error', () => reject(new Error('Load failed')), { once: true });
      document.head.appendChild(script);
    });
  }

  async function initFirebase() {
    if (window.firebase?.apps?.length) {
      db = window.firebase.firestore();
      auth = window.firebase.auth();
      return true;
    }

    if (isFirebaseInitializing) return false;
    isFirebaseInitializing = true;

    try {
      const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
      await loadScript(`${base}/firebase-app-compat.js`);
      await loadScript(`${base}/firebase-auth-compat.js`);
      await loadScript(`${base}/firebase-firestore-compat.js`);

      if (window.firebase) {
        if (!window.firebase.apps.length) {
          window.firebase.initializeApp(FIREBASE_CONFIG);
        }
        db = window.firebase.firestore();
        auth = window.firebase.auth();
        isFirebaseInitializing = false;
        return true;
      }
    } catch (e) {
      console.warn('Firebase setup warning:', e);
    }

    isFirebaseInitializing = false;
    return false;
  }

  // ============================================================
  // UI Functionalities
  // ============================================================

  function setupPasswordToggle() {
    const buttons = document.querySelectorAll('.toggle-password');
    buttons.forEach(button => {
      if (button.dataset.ready === 'true') return;
      button.dataset.ready = 'true';

      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();

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
      if (adminCode) {
        adminCode.required = isAdmin;
        if (!isAdmin) adminCode.value = '';
      }
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
  // Register Feature (ลงทะเบียนแล้วสลับไปหน้าเข้าสู่ระบบอัตโนมัติ)
  // ============================================================

  function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const nameInput = document.getElementById('name');
      const emailInput = document.getElementById('email');
      const passwordInput = document.getElementById('password');
      const confirmPasswordInput = document.getElementById('confirmPassword');
      const roleInputs = Array.from(document.querySelectorAll('input[name="userRole"]'));

      const name = nameInput?.value?.trim() || '';
      const email = emailInput?.value?.trim() || '';
      const password = passwordInput?.value || '';
      const confirmPassword = confirmPasswordInput?.value || '';
      const selectedRole = roleInputs.find(i => i.checked)?.value || 'user';

      if (!name || !email || !password) {
        alert('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
      }

      if (password !== confirmPassword) {
        alert('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : '';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'กำลังลงทะเบียน...';
      }

      try {
        const ready = await initFirebase();
        if (!ready || !auth || !db) {
          throw new Error('ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้');
        }

        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const user = cred.user;

        try {
          await user.updateProfile({ displayName: name });
        } catch (_) {}

        const userData = {
          uid: user.uid,
          name,
          email,
          role: selectedRole,
          createdAt: new Date().toISOString()
        };

        await db.collection('users').doc(user.uid).set(userData, { merge: true });
        await auth.signOut();

        alert('ลงทะเบียนสำเร็จ! กำลังนำคุณไปยังหน้าเข้าสู่ระบบ...');
        
        // นำทางไปยังหน้าเข้าสู่ระบบอัตโนมัติ
        window.location.href = 'index.html';
      } catch (err) {
        alert(firebaseErrorMessage(err));
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
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

      const emailInput = document.getElementById('email');
      const passwordInput = document.getElementById('password');
      const roleSelect = document.getElementById('loginRole');
      const adminCodeInput = document.getElementById('adminCode');
      const rememberMe = document.getElementById('rememberMe');

      const email = emailInput?.value?.trim() || '';
      const password = passwordInput?.value || '';
      const selectedRole = roleSelect?.value || 'user';
      const ADMIN_CODE = '24236';

      if (!email || !password) {
        alert('กรุณากรอกอีเมลและรหัสผ่าน');
        return;
      }

      if (selectedRole === 'admin') {
        const code = adminCodeInput?.value?.trim() || '';
        if (code !== ADMIN_CODE) {
          alert('รหัสผู้ดูแลระบบไม่ถูกต้อง');
          return;
        }
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : '';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'กำลังเข้าสู่ระบบ...';
      }

      try {
        const ready = await initFirebase();
        if (!ready || !auth) {
          throw new Error('ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้');
        }

        const cred = await auth.signInWithEmailAndPassword(email, password);
        const user = cred.user;

        let profile = null;
        try {
          const snap = await db.collection('users').doc(user.uid).get();
          if (snap.exists) profile = snap.data();
        } catch (_) {}

        const actualRole = profile?.role || 'user';

        if (selectedRole === 'admin' && actualRole !== 'admin') {
          await auth.signOut();
          alert('บัญชีนี้ไม่มีสิทธิ์เป็นผู้ดูแลระบบ');
          return;
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
      } catch (err) {
        alert(firebaseErrorMessage(err));
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  // ============================================================
  // App Bootstrapper
  // ============================================================

  function boot() {
    setupPasswordToggle();
    setupRoleUI();
    loadRememberedData();
    setupLoginForm();
    setupRegisterForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
