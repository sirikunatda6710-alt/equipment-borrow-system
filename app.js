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

  // Helper สำหรับตรวจสอบความเป็นเจ้าของคำขอ
  function isOwnRequest(req, user) {
    if (!user) return false;

    const uUid = String(user.uid || '').trim();
    const rUid = String(req.userUid || '').trim();
    if (uUid && rUid && uUid === rUid) return true;

    const uEmail = String(user.email || localStorage.getItem('userEmail') || '').toLowerCase().trim();
    const rEmail = String(req.userEmail || '').toLowerCase().trim();
    if (uEmail && rEmail && uEmail === rEmail) return true;

    const uName = String(user.name || localStorage.getItem('userName') || '').trim();
    const rName = String(req.userName || '').trim();
    if (uName && rName && uName === rName) return true;

    return false;
  }

  // ============================================================
  // Audio Alert System
  // ============================================================

  function playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio Context error');
    }
  }

  // ============================================================
  // Helpers & System Log
  // ============================================================

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
      'auth/email-already-in-use': 'อีเมลนี้มีบัญชีในระบบอยู่แล้ว',
      'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
      'auth/weak-password': 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร',
      'auth/user-not-found': 'ไม่พบบัญชีผู้ใช้ที่มีอีเมลนี้ในระบบ',
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

  window.getFirestoreUsers = async function() {
    try {
      const ready = await initFirebase();
      if (!ready || !db) return [];
      
      const snap = await db.collection('users').get();
      let list = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.role !== 'admin') {
          list.push({
            uid: doc.id,
            name: data.name || 'ไม่ระบุชื่อ',
            email: data.email || '',
            requestDate: data.createdAt || '-',
            status: data.accountStatus || 'pending'
          });
        }
      });
      return list;
    } catch (e) {
      console.error("Error fetching users from Firestore:", e);
      return [];
    }
  };

  window.getFirestoreBorrowRequests = async function() {
    try {
      const ready = await initFirebase();
      if (!ready || !db) return [];
      
      const snap = await db.collection('borrow_requests').get();
      let list = [];
      snap.forEach(doc => {
        list.push(doc.data());
      });
      
      list.sort((a, b) => (b.id > a.id ? 1 : -1));
      return list;
    } catch (e) {
      console.error("Error fetching borrow requests from Firestore:", e);
      return [];
    }
  };

  // ============================================================
  // Functions สำหรับให้ปุ่ม อนุมัติ / ปฏิเสธ ทำงานได้
  // ============================================================

  window.handleAdminApproval = async function(requestId, newStatus) {
    const currentUser = JSON.parse(localStorage.getItem('equipment_current_user')) || {};
    const adminName = currentUser.name || localStorage.getItem('userName') || 'ผู้ดูแลระบบ';

    let requests = JSON.parse(localStorage.getItem('user_requests')) || [];
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx !== -1) {
      requests[idx].status = newStatus;
      requests[idx].approvedBy = adminName;
      localStorage.setItem('user_requests', JSON.stringify(requests));
    }

    try {
      await initFirebase();
      if (db) {
        await db.collection('borrow_requests').doc(requestId).set({
          status: newStatus,
          approvedBy: adminName,
          approvedAt: getCurrentDateTimeFormatted()
        }, { merge: true });
      }
    } catch (e) {
      console.warn("Firestore update warning:", e);
    }

    window.addSystemLog(
      newStatus === 'approved' ? 'อนุมัติคำขอ' : 'ปฏิเสธคำขอ',
      `คำขอ ${requestId} โดยแอดมิน ${adminName}`
    );

    alert(`ทำรายการ ${newStatus === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} เรียบร้อยแล้ว`);
    if (window.renderBorrowTable) {
      window.renderBorrowTable();
    } else {
      window.location.reload();
    }
  };

  window.handleUserAccountApproval = async function(userUid, userEmail, actionStatus) {
    const currentUser = JSON.parse(localStorage.getItem('equipment_current_user')) || {};
    const adminName = currentUser.name || 'ผู้ดูแลระบบ';

    try {
      await initFirebase();
      
      if (db) {
        if (userUid) {
          await db.collection('users').doc(userUid).set({
            accountStatus: actionStatus,
            approvedBy: adminName,
            approvedAt: getCurrentDateTimeFormatted()
          }, { merge: true });
        } else {
          const snap = await db.collection('users').where('email', '==', userEmail).get();
          snap.forEach(async (doc) => {
            await db.collection('users').doc(doc.id).set({
              accountStatus: actionStatus,
              approvedBy: adminName,
              approvedAt: getCurrentDateTimeFormatted()
            }, { merge: true });
          });
        }
      }

      let pendingUsers = JSON.parse(localStorage.getItem('pending_user_registrations')) || [];
      const userIndex = pendingUsers.findIndex(u => (userUid && u.uid === userUid) || u.email === userEmail);
      if (userIndex !== -1) {
        pendingUsers[userIndex].status = actionStatus;
        pendingUsers[userIndex].approvedBy = adminName;
        localStorage.setItem('pending_user_registrations', JSON.stringify(pendingUsers));
      }

      window.addSystemLog(
        actionStatus === 'approved' ? 'อนุมัติสมาชิกใหม่' : 'ปฏิเสธสมาชิกใหม่',
        `บัญชี ${userEmail} โดยแอดมิน ${adminName}`
      );

      alert(`ทำการ ${actionStatus === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} สมาชิกใหม่เรียบร้อยแล้ว!`);
      
      if (window.renderUserTable) {
        window.renderUserTable();
      } else {
        window.location.reload();
      }
    } catch (e) {
      console.error("Error approving user:", e);
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะสมาชิก: ' + e.message);
    }
  };

  // ============================================================
  // Forgot Password Page Logic (ส่งอีเมลลิงก์รีเซ็ตรหัสผ่าน)
  // ============================================================

  function setupForgotPasswordForm() {
    const form = document.getElementById('forgotPasswordForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('forgotEmail');
      const email = emailInput?.value?.trim();

      if (!email) {
        alert('❌ กรุณากรอกอีเมลของคุณ');
        return;
      }

      try {
        const ready = await initFirebase();
        if (!ready || !auth) throw new Error('ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้');

        const redirectUrl = window.location.origin + window.location.pathname.replace('forgot-password.html', 'reset-password.html') + '?email=' + encodeURIComponent(email);
        
        const actionCodeSettings = {
          url: redirectUrl,
          handleCodeInApp: true
        };

        await auth.sendPasswordResetEmail(email, actionCodeSettings);

        localStorage.setItem('reset_email_temp', email);
        alert('📧 ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว! กรุณาตรวจสอบในกล่องข้อความ (Inbox) หรือ Junk/Spam');
        window.location.href = 'index.html';

      } catch (err) {
        console.error("Send password reset email error:", err);
        alert('เกิดข้อผิดพลาด: ' + firebaseErrorMessage(err));
      }
    });
  }

  // ============================================================
  // Reset Password Page Logic (ตั้งรหัสผ่านใหม่)
  // ============================================================

  function setupResetPasswordForm() {
    const form = document.getElementById('resetPasswordForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email') || localStorage.getItem('reset_email_temp') || '';
    const emailInput = document.getElementById('resetEmail');
    
    if (emailInput) {
      if (emailParam) {
        emailInput.value = emailParam;
      } else {
        emailInput.removeAttribute('readonly');
        emailInput.placeholder = 'กรอกอีเมลของคุณ...';
      }
    }

    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmNewPassword');

    if (newPasswordInput) {
      newPasswordInput.addEventListener('input', () => {
        const val = newPasswordInput.value;
        const ruleLength = document.getElementById('resetRuleLength');
        const ruleUpper = document.getElementById('resetRuleUppercase');
        const ruleLower = document.getElementById('resetRuleLowercase');
        const ruleNumber = document.getElementById('resetRuleNumber');

        if (ruleLength) ruleLength.style.color = val.length >= 8 ? '#10b981' : '#ef4444';
        if (ruleUpper) ruleUpper.style.color = /[A-Z]/.test(val) ? '#10b981' : '#ef4444';
        if (ruleLower) ruleLower.style.color = /[a-z]/.test(val) ? '#10b981' : '#ef4444';
        if (ruleNumber) ruleNumber.style.color = /[0-9]/.test(val) ? '#10b981' : '#ef4444';
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput?.value?.trim();
      const newPass = newPasswordInput?.value;
      const confirmPass = confirmPasswordInput?.value;

      if (!email) {
        alert('❌ กรุณากรอกหรือระบุอีเมลสำหรับตั้งรหัสผ่านใหม่');
        return;
      }

      if (newPass !== confirmPass) {
        alert('❌ รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
        return;
      }

      const isValid = newPass.length >= 8 && /[A-Z]/.test(newPass) && /[a-z]/.test(newPass) && /[0-9]/.test(newPass);
      if (!isValid) {
        alert('❌ กรุณาตั้งรหัสผ่านให้ครบตามเงื่อนไขที่กำหนด');
        return;
      }

      try {
        const ready = await initFirebase();
        if (ready && auth && auth.currentUser) {
          await auth.currentUser.updatePassword(newPass);
        }
        
        localStorage.setItem('rememberedPassword', newPass);

        alert('✅ เปลี่ยนรหัสผ่านสำเร็จแล้ว! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
        localStorage.removeItem('reset_email_temp');
        window.location.href = 'index.html';
      } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้'));
      }
    });
  }

  // ============================================================
  // Profile & Logout
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
    profileModal.style.display = 'none';

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
    roleSelect.addEventListener('change', update); update();
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

  function setupDropdownToggle() {
    document.querySelectorAll('.nav-dropdown-btn').forEach(btn => {
      if (btn.dataset.bound === 'true') return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const dropdown = btn.closest('.nav-dropdown');
        if (dropdown) dropdown.classList.toggle('active');
      });
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('.nav-dropdown').forEach(dropdown => dropdown.classList.remove('active'));
    });
  }

  // ============================================================
  // Notification System & Badges
  // ============================================================

  async function initNotificationSystem() {
    const notifBtn = document.getElementById('notificationButton');
    const notifPanel = document.getElementById('notificationPanel');
    const countBadge = document.getElementById('notificationCount');
    const notifList = document.getElementById('notificationList');

    const currentUser = JSON.parse(localStorage.getItem('equipment_current_user')) || {};
    const isAdmin = currentUser.role === 'admin';

    let notifications = [];

    let requests = [];
    if (window.getFirestoreBorrowRequests) {
      requests = await window.getFirestoreBorrowRequests();
    }
    if (!requests || requests.length === 0) {
      requests = JSON.parse(localStorage.getItem('user_requests')) || [];
    }

    if (isAdmin) {
      let activePendingUsers = [];
      if (window.getFirestoreUsers) {
        const users = await window.getFirestoreUsers();
        activePendingUsers = users.filter(u
