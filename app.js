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
  // Global Admin Operations (เปิดใช้งานปุ่ม อนุมัติ / ปฏิเสธ)
  // ============================================================

  window.handleAdminApproval = async function(requestId, newStatus) {
    const currentUser = JSON.parse(localStorage.getItem('equipment_current_user')) || {};
    const adminName = currentUser.name || localStorage.getItem('userName') || 'ผู้ดูแลระบบ';

    // 1. อัปเดตใน LocalStorage
    let requests = JSON.parse(localStorage.getItem('user_requests')) || [];
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx !== -1) {
      requests[idx].status = newStatus;
      requests[idx].approvedBy = adminName;
      localStorage.setItem('user_requests', JSON.stringify(requests));
    }

    // 2. อัปเดตลง Firestore
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
      // ฝั่ง Admin
      let activePendingUsers = [];
      if (window.getFirestoreUsers) {
        const users = await window.getFirestoreUsers();
        activePendingUsers = users.filter(u => u.status === 'pending');
      }

      activePendingUsers.forEach(u => {
        notifications.push({
          title: `👤 ผู้ใช้ใหม่รอการอนุมัติ`,
          desc: `${u.name} (${u.email}) ลงทะเบียนขอเข้าใช้งาน`,
          link: 'admin-approvals.html'
        });
      });

      const pendingReqs = requests.filter(r => r.status === 'pending');
      pendingReqs.forEach(req => {
        notifications.push({
          title: `🔔 มีคำขอ${req.type}รออนุมัติ`,
          desc: `${req.userName || 'ผู้ใช้งาน'} ขอ${req.type} ${req.equipmentName}`,
          link: 'admin-approvals.html'
        });
      });

    } else {
      // ฝั่ง User
      const myApprovedOrRejected = requests.filter(r => isOwnRequest(r, currentUser) && (r.status === 'approved' || r.status === 'rejected'));

      myApprovedOrRejected.forEach(req => {
        const isApproved = req.status === 'approved';
        notifications.push({
          title: isApproved ? `🟢 คำขอ${req.type}ได้รับการอนุมัติแล้ว` : `🔴 คำขอ${req.type}ถูกปฏิเสธ`,
          desc: `อุปกรณ์: ${req.equipmentName} (${req.requestDate})`,
          link: req.type === 'ยืม' ? 'return.html' : 'history.html'
        });
      });
    }

    if (countBadge) {
      if (notifications.length > 0) {
        countBadge.textContent = notifications.length;
        countBadge.style.display = 'inline-flex';
        playNotificationSound();
      } else {
        countBadge.style.display = 'none';
      }
    }

    if (notifList) {
      if (notifications.length === 0) {
        notifList.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: #6b7280; font-size: 0.85rem;">ไม่มีการแจ้งเตือนใหม่ในขณะนี้</div>`;
      } else {
        notifList.innerHTML = notifications.map(n => `
          <a href="${n.link}" style="display: block; padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; text-decoration: none; color: inherit; transition: background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='transparent'">
            <div style="font-weight: 600; font-size: 0.88rem; color: #1f2937;">${n.title}</div>
            <div style="font-size: 0.8rem; color: #6b7280; margin-top: 2px;">${n.desc}</div>
          </a>
        `).join('');
      }
    }

    if (notifBtn && notifBtn.dataset.bound !== 'true') {
      notifBtn.dataset.bound = 'true';
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (notifPanel) {
          const isVisible = notifPanel.style.display === 'block';
          notifPanel.style.display = isVisible ? 'none' : 'block';
        }
      });
    }

    const closeBtn = document.getElementById('closeNotificationPanel');
    if (closeBtn && closeBtn.dataset.bound !== 'true') {
      closeBtn.dataset.bound = 'true';
      closeBtn.addEventListener('click', () => {
        if (notifPanel) notifPanel.style.display = 'none';
      });
    }

    document.addEventListener('click', (e) => {
      if (notifPanel && notifBtn && !notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
        notifPanel.style.display = 'none';
      }
    });

    if (window.lucide) lucide.createIcons();
  }

  // ============================================================
  // Dashboard & Navbar
  // ============================================================

  function initDashboardByRole() {
    const adminView = document.getElementById('adminDashboardView');
    const userView = document.getElementById('userDashboardView');
    const currentUser = JSON.parse(localStorage.getItem('equipment_current_user')) || { name: 'ผู้ใช้งานระบบ', role: 'user' };
    const roleBadge = document.getElementById('userRoleBadge');
    const userNameElem = document.getElementById('userName');
    const navbar = document.getElementById('mainNavbar');

    if (userNameElem) userNameElem.textContent = currentUser.name;
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';

    const dropdownNavHTML = `
      <div class="nav-dropdown">
        <button type="button" class="nav-dropdown-btn ${currentPage === 'equipment.html' ? 'active' : ''}">
          <i data-lucide="package-search"></i> 
          <span>รายการอุปกรณ์</span>
          <i data-lucide="chevron-down" class="dropdown-icon"></i>
        </button>
        <div class="nav-dropdown-content">
          <a href="equipment.html?category=ครุภัณฑ์">🏢 ครุภัณฑ์</a>
          <a href="equipment.html?category=วัสดุ">📦 วัสดุ</a>
          <a href="equipment.html?category=อุปกรณ์">🔊 อุปกรณ์ / เครื่องเสียง</a>
          <a href="equipment.html?category=บันทึกภาพ">📷 อุปกรณ์บันทึกภาพ</a>
        </div>
      </div>`;

    if (currentUser.role === 'admin') {
      if (roleBadge) roleBadge.textContent = 'ผู้ดูแลระบบ (Admin)';
      if (navbar) {
        navbar.innerHTML = `
          <a href="dashboard.html" class="nav-item ${currentPage === 'dashboard.html' ? 'active' : ''}"><i data-lucide="layout-dashboard"></i> <span>Dashboard</span></a>
          ${dropdownNavHTML}
          <a href="admin-management.html" class="nav-item ${currentPage === 'admin-management.html' ? 'active' : ''}"><i data-lucide="settings"></i> <span>จัดการสิ่งของ</span></a>
          <a href="admin-approvals.html" class="nav-item ${currentPage === 'admin-approvals.html' ? 'active' : ''}"><i data-lucide="check-square"></i> <span>อนุมัติยืม-คืน</span></a>
          <a href="history.html" class="nav-item ${currentPage === 'history.html' ? 'active' : ''}"><i data-lucide="history"></i> <span>ประวัติระบบ</span></a>
        `;
      }
      if (adminView) adminView.style.display = 'block';
      if (userView) userView.style.display = 'none';
      renderAdminDashboardData();
    } else {
      if (roleBadge) roleBadge.textContent = 'ผู้ใช้งานทั่วไป';
      if (navbar) {
        navbar.innerHTML = `
          <a href="dashboard.html" class="nav-item ${currentPage === 'dashboard.html' ? 'active' : ''}"><i data-lucide="layout-dashboard"></i> <span>Dashboard</span></a>
          ${dropdownNavHTML}
          <a href="return.html" class="nav-item ${currentPage === 'return.html' ? 'active' : ''}"><i data-lucide="undo-2"></i> <span>คืนอุปกรณ์</span></a>
          <a href="history.html" class="nav-item ${currentPage === 'history.html' ? 'active' : ''}"><i data-lucide="history"></i> <span>ประวัติยืม-คืน</span></a>
        `;
      }
      if (adminView) adminView.style.display = 'none';
      if (userView) userView.style.display = 'block';
      renderUserDashboardData(currentUser);
    }

    setupDropdownToggle();
    initNotificationSystem();
    if (window.lucide) lucide.createIcons();
  }

  function renderAdminDashboardData() {
    const equipmentList = getEquipmentLocal();
    function calculateStats(categoryName) {
      const items = equipmentList.filter(item => String(item.category || '').trim() === categoryName);
      let total = 0, available = 0, borrowed = 0, unavailable = 0;
      items.forEach(item => {
        const itemTotal = Number(item.total || 0), itemAvail = Number(item.available || 0);
        total += itemTotal; available += itemAvail;
        if (item.status === 'unavailable') unavailable += Math.max(0, itemTotal - itemAvail);
        else borrowed += Math.max(0, itemTotal - itemAvail);
      });
      return { total, available, borrowed, unavailable };
    }

    function updateCategoryUI(prefix, stats) {
      if (document.getElementById(`total${prefix}`)) document.getElementById(`total${prefix}`).textContent = stats.total;
      if (document.getElementById(`avail${prefix}`)) document.getElementById(`avail${prefix}`).textContent = stats.available;
      if (document.getElementById(`borrowed${prefix}`)) document.getElementById(`borrowed${prefix}`).textContent = stats.borrowed;
      if (document.getElementById(`unavail${prefix}`)) document.getElementById(`unavail${prefix}`).textContent = stats.unavailable;
    }

    updateCategoryUI('Building', calculateStats('ครุภัณฑ์'));
    updateCategoryUI('Material', calculateStats('วัสดุ'));
    updateCategoryUI('Device', calculateStats('อุปกรณ์'));
    updateCategoryUI('Camera', calculateStats('บันทึกภาพ'));
  }

  async function renderUserDashboardData(user) {
    let myRequests = [];
    if (window.getFirestoreBorrowRequests) {
      const allReqs = await window.getFirestoreBorrowRequests();
      myRequests = allReqs.filter(r => isOwnRequest(r, user));
    } else {
      const userRequests = JSON.parse(localStorage.getItem('user_requests')) || [];
      myRequests = userRequests.filter(r => isOwnRequest(r, user));
    }

    const activeBorrows = myRequests.filter(r => r.status === 'approved' && r.type === 'ยืม');
    const pendingRequests = myRequests.filter(r => r.status === 'pending');

    if (document.getElementById('userActiveBorrowCount')) document.getElementById('userActiveBorrowCount').textContent = activeBorrows.length;
    if (document.getElementById('userPendingCount')) document.getElementById('userPendingCount').textContent = pendingRequests.length;
    if (document.getElementById('userTotalHistoryCount')) document.getElementById('userTotalHistoryCount').textContent = myRequests.length;

    const tableBody = document.getElementById('userBorrowTable');
    if (!tableBody) return;

    if (myRequests.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">ยังไม่มีประวัติการทำรายการยืม-คืนอุปกรณ์</td></tr>`;
      return;
    }

    tableBody.innerHTML = myRequests.map(req => `
      <tr>
        <td><strong>${req.id}</strong></td>
        <td>${req.equipmentName}</td>
        <td>${req.requestDate}</td>
        <td>
          <span class="${req.status === 'pending' ? 'badge-pending' : req.status === 'approved' ? 'badge-approved' : 'badge-rejected'}">
            ${req.status === 'pending' ? 'รอผู้ดูแลอนุมัติ' : req.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
          </span>
        </td>
        <td>
          ${req.status === 'approved' && req.type === 'ยืม' ? `<a href="return.html" class="btn btn-sm" style="background:#10b981; color:white; padding:4px 8px; border-radius:4px; text-decoration:none;">ไปหน้าคืนอุปกรณ์</a>` : '-'}
        </td>
      </tr>
    `).join('');
  }

  // ============================================================
  // Equipment Page & Borrow Form
  // ============================================================

  function initEquipmentPage() {
    const gridContainer = document.getElementById('equipmentGridContainer');
    if (!gridContainer) return;

    const urlParams = new URLSearchParams(window.location.search);
    let selectedCategory = decodeURIComponent(urlParams.get('category') || '').trim();

    const pageTitle = document.getElementById('categoryPageTitle');
    const categoryFilter = document.getElementById('categorySelectFilter');

    if (selectedCategory) {
      if (pageTitle) pageTitle.textContent = `รายการ${selectedCategory}`;
      if (categoryFilter) categoryFilter.value = selectedCategory;
    }

    renderEquipmentGrid(selectedCategory, '');

    const searchInput = document.getElementById('equipmentSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        renderEquipmentGrid(categoryFilter ? categoryFilter.value : '', e.target.value.trim());
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        const cat = e.target.value;
        if (pageTitle) pageTitle.textContent = cat ? `รายการ${cat}` : 'รายการทั้งหมด';
        renderEquipmentGrid(cat, searchInput ? searchInput.value.trim() : '');
      });
    }

    setupBorrowFormSubmit();
  }

  function renderEquipmentGrid(category, searchKeyword) {
    const container = document.getElementById('equipmentGridContainer');
    if (!container) return;

    const allEquipment = getEquipmentLocal();
    const filtered = allEquipment.filter(item => {
      const itemCat = String(item.category || '').trim();
      const filterCat = String(category || '').trim();

      let matchCategory = !filterCat || filterCat === 'รายการทั้งหมด' || itemCat === filterCat;
      if (!matchCategory && filterCat) {
        if (filterCat.includes('อุปกรณ์') && itemCat.includes('อุปกรณ์')) matchCategory = true;
        if (filterCat.includes('บันทึกภาพ') && itemCat.includes('บันทึกภาพ')) matchCategory = true;
      }

      const matchSearch = !searchKeyword || 
        (item.name && item.name.toLowerCase().includes(searchKeyword.toLowerCase())) || 
        (item.id && item.id.toLowerCase().includes(searchKeyword.toLowerCase()));

      return matchCategory && matchSearch;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #6b7280;">ไม่พบรายการอุปกรณ์ในหมวดหมู่นี้</div>`;
      return;
    }

    container.innerHTML = filtered.map(item => {
      const isAvailable = (item.available || 0) > 0 && item.status !== 'unavailable';
      return `
        <div class="equipment-card" style="background: #fff; border-radius: 12px; padding: 1.25rem; border: 1px solid #e5e7eb; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
              <span style="font-size: 0.8rem; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${item.category || 'อุปกรณ์'}</span>
              <span style="font-size: 0.85rem; font-weight: 600; color: ${isAvailable ? '#10b981' : '#ef4444'};">${isAvailable ? 'พร้อมเบิก' : 'ไม่พร้อมใช้งาน'}</span>
            </div>
            <h3 style="font-size: 1.05rem; margin-bottom: 0.5rem; color: #1f2937;">${item.name}</h3>
            <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">คงเหลือพร้อมใช้: <strong>${item.available || 0}</strong> / ${item.total || 0}</p>
          </div>
          <button type="button" onclick="openBorrowModal('${item.id}', '${item.name}', ${item.available || 0})" ${!isAvailable ? 'disabled' : ''} style="width: 100%; padding: 0.6rem; border: none; border-radius: 8px; font-weight: 600; cursor: ${isAvailable ? 'pointer' : 'not-allowed'}; background: ${isAvailable ? '#10b981' : '#d1d5db'}; color: white;">
            ${isAvailable ? 'กดเบิก/ยืมสิ่งนี้' : 'สินค้าหมด / ไม่พร้อมยืม'}
          </button>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  window.openBorrowModal = function(id, name, maxAvail) {
    const currentUser = JSON.parse(localStorage.getItem('equipment_current_user')) || {};
    
    if (currentUser.role === 'user' && currentUser.accountStatus !== 'approved') {
      alert('❌ ไม่สามารถทำรายการได้!\n\nบัญชีของคุณยังไม่ได้รับการอนุมัติการลงทะเบียนจากผู้ดูแลระบบ กรุณารอผู้ดูแลระบบอนุมัติบัญชีของคุณก่อนทำรายการยืม-คืนอุปกรณ์');
      return;
    }

    const modal = document.getElementById('borrowModal');
    if (!modal) return;
    document.getElementById('modalEquipmentId').value = id;
    document.getElementById('modalEquipmentName').value = name;
    const qtyInput = document.getElementById('modalBorrowQuantity');
    qtyInput.max = maxAvail; qtyInput.value = 1;
    document.getElementById('modalMaxAvailable').textContent = `*(เบิกได้สูงสุด ${maxAvail} ชิ้น)`;
    document.getElementById('modalBorrowReason').value = '';
    modal.style.display = 'flex';
  };

  window.closeBorrowModal = function() {
    const modal = document.getElementById('borrowModal');
    if (modal) modal.style.display = 'none';
  };

  function setupBorrowFormSubmit() {
    const form = document.getElementById('borrowRequestForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentUser = JSON.parse(localStorage.getItem('equipment_current_user')) || {};

      if (currentUser.role === 'user' && currentUser.accountStatus !== 'approved') {
        alert('❌ ไม่สามารถทำรายการได้! บัญชีของคุณยังไม่ได้รับการอนุมัติการลงทะเบียนจากผู้ดูแลระบบ');
        closeBorrowModal();
        return;
      }

      const eqId = document.getElementById('modalEquipmentId').value;
      const eqName = document.getElementById('modalEquipmentName').value;
      const qty = parseInt(document.getElementById('modalBorrowQuantity').value) || 1;
      const reason = document.getElementById('modalBorrowReason').value.trim();

      const requestId = 'REQ' + Date.now().toString().slice(-6);
      const newRequest = {
        id: requestId,
        equipmentId: eqId,
        equipmentName: eqName,
        quantity: qty,
        reason: reason,
        userName: currentUser.name || localStorage.getItem('userName') || 'ผู้ใช้งานระบบ',
        userEmail: currentUser.email || localStorage.getItem('userEmail') || '',
        userUid: currentUser.uid || '',
        requestDate: getCurrentDateTimeFormatted(),
        type: 'ยืม',
        status: 'pending',
        approvedBy: '-'
      };

      const userRequests = JSON.parse(localStorage.getItem('user_requests')) || [];
      userRequests.unshift(newRequest);
      localStorage.setItem('user_requests', JSON.stringify(userRequests));

      try {
        await initFirebase();
        if (db) {
          await db.collection('borrow_requests').doc(requestId).set(newRequest);
        }
      } catch (err) {
        console.warn("Firestore save warning (fallback to LocalStorage):", err);
      }

      alert('ส่งคำขอเบิก/ยืมเรียบร้อยแล้ว! กรุณารอการอนุมัติจากผู้ดูแลระบบ');
      closeBorrowModal();
      window.location.reload();
    });
  }

  // ============================================================
  // Boot System
  // ============================================================

  function boot() {
    try { setupProfileModal(); } catch (e) {}
    try { setupPasswordToggle(); } catch (e) {}
    try { setupRoleUI(); } catch (e) {}
    try { loadRememberedData(); } catch (e) {}
    try { setupLoginForm(); } catch (e) {}
    try { initDashboardByRole(); } catch (e) {}
    try { initEquipmentPage(); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
