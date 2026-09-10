(function () {
  'use strict';

  const KEYS = {
    equipment: 'equipment',
    equipmentData: 'equipment_data',
    history: 'borrow_history',
    users: 'equipment_users',
    currentUser: 'equipment_current_user',
    loggedIn: 'isLoggedIn',
    userEmail: 'userEmail',
    userName: 'userName'
  };

  const DEFAULT_EQUIPMENT = [
    { id: 'EQ001', name: 'Projector Epson EB-X05', category: 'เครื่องฉาย', icon: 'projector', total: 10, available: 10, status: 'available', borrower: '', createdAt: new Date().toISOString() },
    { id: 'EQ002', name: 'กล้อง Nikon D5600', category: 'กล้องถ่ายภาพ', icon: 'camera', total: 5, available: 5, status: 'available', borrower: '', createdAt: new Date().toISOString() },
    { id: 'EQ003', name: 'ไมโครโฟนไร้สาย', category: 'เครื่องเสียง', icon: 'mic', total: 8, available: 8, status: 'available', borrower: '', createdAt: new Date().toISOString() },
    { id: 'EQ004', name: 'ลำโพง JBL', category: 'เครื่องเสียง', icon: 'speaker', total: 3, available: 3, status: 'available', borrower: '', createdAt: new Date().toISOString() }
  ];

  const STATUS_MAP = {
    'พร้อมใช้งาน': 'available',
    'กำลังถูกยืม': 'borrowed',
    'ไม่พร้อมใช้งาน': 'unavailable',
    available: 'available',
    borrowed: 'borrowed',
    unavailable: 'unavailable'
  };

  function qs(selector, root = document) { return root.querySelector(selector); }
  function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  }
  function parseJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) { return fallback; }
  }
  function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
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
    return ({ available:'พร้อมใช้งาน', borrowed:'กำลังถูกยืม', unavailable:'ไม่พร้อมใช้งาน' }[STATUS_MAP[status] || status]) || status || '-';
  }
  function normalizeStatus(status) { return STATUS_MAP[status] || 'available'; }

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
      createdAt: item.createdAt || new Date().toISOString()
    };
  }

  function getEquipment() {
    let data = parseJSON(KEYS.equipment, null);
    if (!Array.isArray(data)) data = parseJSON(KEYS.equipmentData, null);
    if (!Array.isArray(data)) data = DEFAULT_EQUIPMENT.map(x => ({ ...x }));
    data = data.map(normalizeEquipment).filter(x => x.id && x.name);
    if (!data.length) data = DEFAULT_EQUIPMENT.map(x => ({ ...x }));
    return data;
  }

  function saveEquipment(data) {
    const normalized = data.map(normalizeEquipment);
    saveJSON(KEYS.equipment, normalized);
    // Keep the old key in sync for compatibility with earlier pages/scripts.
    saveJSON(KEYS.equipmentData, normalized);
    window.dispatchEvent(new CustomEvent('equipmentDataChanged'));
  }

  function getHistory() {
    const data = parseJSON(KEYS.history, []);
    return Array.isArray(data) ? data : [];
  }
  function saveHistory(data) {
    saveJSON(KEYS.history, data);
    window.dispatchEvent(new CustomEvent('historyDataChanged'));
  }

  function getCurrentUserName() {
    const current = parseJSON(KEYS.currentUser, null);
    return localStorage.getItem(KEYS.userName) || current?.name || current?.email || localStorage.getItem(KEYS.userEmail) || 'ผู้ใช้งาน';
  }

  function initIcons() {
    if (window.lucide?.createIcons) window.lucide.createIcons();
  }

  function setupCommonUI() {
    const name = getCurrentUserName();
    qsa('#userName, .profile-name, #welcomeUserName').forEach(el => { el.textContent = name; });

    const profileButton = qs('#profileButton');
    const profileModal = qs('#profileModal');
    const closeProfile = qs('#closeProfileModal');
    const editName = qs('#editUserName');
    const saveProfile = qs('#saveProfileButton');
    if (profileButton && profileModal) {
      profileButton.addEventListener('click', () => {
        if (editName) editName.value = getCurrentUserName();
        profileModal.classList.add('show');
      });
    }
    if (closeProfile && profileModal) closeProfile.addEventListener('click', () => profileModal.classList.remove('show'));
    if (saveProfile) saveProfile.addEventListener('click', () => {
      const value = (editName?.value || '').trim();
      if (!value) return alert('กรุณากรอกชื่อผู้ใช้งาน');
      localStorage.setItem(KEYS.userName, value);
      qsa('#userName, .profile-name, #welcomeUserName').forEach(el => { el.textContent = value; });
      if (profileModal) profileModal.classList.remove('show');
    });

    const logout = qs('#logoutButton');
    if (logout) logout.addEventListener('click', () => {
      localStorage.removeItem(KEYS.loggedIn);
      localStorage.removeItem(KEYS.currentUser);
      localStorage.removeItem(KEYS.userEmail);
      window.location.href = 'index.html';
    });

    const notificationCount = qs('#notificationCount');
    if (notificationCount) {
      const active = getHistory().filter(h => h.status === 'borrowing' && !h.actualReturnDate).length;
      notificationCount.textContent = active;
      notificationCount.style.display = active ? '' : 'none';
    }

    const headerSearch = qs('#headerSearch');
    if (headerSearch) {
      headerSearch.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const term = headerSearch.value.trim();
          if (term && location.pathname.endsWith('equipment.html')) {
            const s = qs('#equipmentSearch'); if (s) { s.value = term; s.dispatchEvent(new Event('input')); }
          } else if (term && location.pathname.endsWith('history.html')) {
            const s = qs('#historySearch'); if (s) { s.value = term; s.dispatchEvent(new Event('input')); }
          }
        }
      });
    }
  }

  function setupLogin() {
    const form = qs('#loginForm');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const email = (qs('#email')?.value || '').trim();
      const password = qs('#password')?.value || '';
      if (!email || !password) return alert('กรุณากรอกอีเมลและรหัสผ่าน');
      const users = parseJSON(KEYS.users, []);
      const found = Array.isArray(users) ? users.find(u => u.email === email && u.password === password) : null;
      // Preserve the original demo behaviour when no registered-user database exists.
      if (Array.isArray(users) && users.length && !found) return alert('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      localStorage.setItem(KEYS.loggedIn, 'true');
      localStorage.setItem(KEYS.userEmail, email);
      localStorage.setItem(KEYS.currentUser, JSON.stringify(found || { email }));
      if (found?.name) localStorage.setItem(KEYS.userName, found.name);
      window.location.href = 'dashboard.html';
    });
  }

  function setupDashboard() {
    const totalEl = qs('#totalEquipment');
    const availableEl = qs('#availableEquipment');
    const borrowedEl = qs('#borrowedEquipment');
    const unavailableEl = qs('#unavailableEquipment');
    const welcome = qs('#welcomeText');
    if (!totalEl && !availableEl && !borrowedEl && !unavailableEl && !welcome) return;
    const render = () => {
      const data = getEquipment();
      const total = data.reduce((s, x) => s + x.total, 0);
      const available = data.reduce((s, x) => s + x.available, 0);
      const unavailable = data.filter(x => x.status === 'unavailable').reduce((s, x) => s + x.total, 0);
      const borrowed = Math.max(0, total - available - unavailable);
      if (totalEl) totalEl.textContent = total;
      if (availableEl) availableEl.textContent = available;
      if (borrowedEl) borrowedEl.textContent = borrowed;
      if (unavailableEl) unavailableEl.textContent = unavailable;
      if (welcome) welcome.textContent = `ยินดีต้อนรับ ${getCurrentUserName()}`;
    };
    render();
    window.addEventListener('equipmentDataChanged', render);
  }

  function equipmentIcon(category) {
    const c = String(category || '').toLowerCase();
    if (c.includes('กล้อง')) return 'camera';
    if (c.includes('เสียง') || c.includes('ไมโคร')) return 'mic';
    if (c.includes('ฉาย') || c.includes('โปรเจค')) return 'projector';
    if (c.includes('คอม')) return 'laptop';
    return 'package';
  }

  function setupEquipmentPage() {
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

    if (quantityInput) quantityInput.min = '1';

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
      if (modal) modal.classList.add('show');
    }
    function closeForm() { if (modal) modal.classList.remove('show'); editingId = null; }
    function render() {
      const term = (search?.value || '').trim().toLowerCase();
      const data = getEquipment().filter(x => !term || [x.id,x.name,x.category,x.borrower,statusToThai(x.status)].join(' ').toLowerCase().includes(term));
      if (!data.length) {
        table.innerHTML = `<tr><td colspan="6" class="empty-state">ไม่พบข้อมูลอุปกรณ์</td></tr>`;
        initIcons(); return;
      }
      table.innerHTML = data.map((x, i) => {
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
    form?.addEventListener('submit', e => {
      e.preventDefault();
      const id = (idInput?.value || '').trim();
      const name = (nameInput?.value || '').trim();
      const category = (categoryInput?.value || 'ทั่วไป').trim();
      const quantity = Math.max(1, Number(quantityInput?.value || 1));
      const status = normalizeStatus(statusInput?.value || 'available');
      const borrower = (borrowerInput?.value || '').trim();
      if (!id || !name) return alert('กรุณากรอกรหัสและชื่ออุปกรณ์');
      if (!Number.isFinite(quantity) || quantity < 1) return alert('จำนวนอุปกรณ์ต้องมากกว่า 0');
      const data = getEquipment();
      const existing = data.find(x => x.id.toLowerCase() === id.toLowerCase());
      if (existing && !editingId) return alert('รหัสอุปกรณ์นี้มีอยู่แล้ว');
      if (editingId && !existing) return alert('ไม่พบอุปกรณ์ที่ต้องการแก้ไข');
      if (editingId) {
        const borrowedCount = existing.total - existing.available;
        if (quantity < borrowedCount) return alert(`จำนวนใหม่ต้องไม่น้อยกว่าจำนวนที่กำลังถูกยืม (${borrowedCount} ชิ้น)`);
        existing.total = quantity;
        existing.available = quantity - borrowedCount;
        existing.name = name; existing.category = category; existing.borrower = borrower;
        existing.status = status === 'unavailable' ? 'unavailable' : (borrowedCount > 0 ? 'borrowed' : 'available');
      } else {
        data.push({ id, name, category, icon: equipmentIcon(category), total: quantity, available: status === 'unavailable' ? 0 : quantity, status, borrower, createdAt: new Date().toISOString() });
      }
      saveEquipment(data);
      closeForm(); render();
    });

    window.viewEquipment = encodedId => {
      const id = decodeURIComponent(encodedId);
      const item = getEquipment().find(x => x.id === id);
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
      const item = getEquipment().find(x => x.id === id);
      if (item) openForm(item);
    };
    window.deleteEquipment = encodedId => {
      const id = decodeURIComponent(encodedId);
      const data = getEquipment();
      const item = data.find(x => x.id === id);
      if (!item) return;
      if (item.total - item.available > 0) return alert('ไม่สามารถลบอุปกรณ์ที่กำลังถูกยืมได้');
      if (!confirm(`ต้องการลบ “${item.name}” ใช่หรือไม่?`)) return;
      saveEquipment(data.filter(x => x.id !== id));
      render();
    };

    const detailModal = qs('#equipmentModal');
    qs('#closeModal')?.addEventListener('click', () => detailModal?.classList.remove('show'));
    render();
  }

  function populateEquipmentSelect(select) {
    if (!select) return;
    const data = getEquipment();
    const previous = select.value;
    select.innerHTML = '<option value="">-- เลือกอุปกรณ์ --</option>' + data.filter(x => x.status !== 'unavailable' && x.available > 0).map(x => `<option value="${escapeHtml(x.id)}">${escapeHtml(x.name)} (${escapeHtml(x.id)}) — เหลือ ${x.available}</option>`).join('');
    if (previous && data.some(x => x.id === previous && x.available > 0)) select.value = previous;
  }

  function setupBorrowPage() {
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

    populateEquipmentSelect(select);
    if (borrowDate && !borrowDate.value) borrowDate.value = todayISO();
    if (borrower && !borrower.value) borrower.value = getCurrentUserName();

    const updateSelected = () => {
      const item = getEquipment().find(x => x.id === select.value);
      const name = qs('#selectedEquipmentName');
      const code = qs('#selectedEquipmentCode');
      if (name) name.textContent = item?.name || '-';
      if (code) code.textContent = item?.id || '-';
      if (quantity && item) { quantity.max = String(item.available); if (Number(quantity.value || 1) > item.available) quantity.value = item.available; }
    };
    select.addEventListener('change', updateSelected); updateSelected();
    qsa('#decreaseButton, #increaseButton').forEach(btn => btn.addEventListener('click', () => {
      const item = getEquipment().find(x => x.id === select.value);
      if (!quantity || !item) return;
      const delta = btn.id === 'increaseButton' ? 1 : -1;
      const next = Math.max(1, Math.min(item.available, Number(quantity.value || 1) + delta));
      quantity.value = next;
    }));

    sendOtp?.addEventListener('click', () => {
      alert('ส่งรหัส OTP แบบจำลองแล้ว (โหมดเว็บไซต์ตัวอย่าง)');
      otpInputs[0]?.focus();
    });
    otpInputs.forEach((input, i) => input.addEventListener('input', () => { if (input.value && otpInputs[i + 1]) otpInputs[i + 1].focus(); }));

    function doBorrow(e) {
      e?.preventDefault();
      const item = getEquipment().find(x => x.id === select.value);
      const qty = Math.max(1, Number(quantity?.value || 1));
      const who = (borrower?.value || getCurrentUserName()).trim();
      if (!item) return alert('กรุณาเลือกอุปกรณ์');
      if (qty > item.available) return alert('จำนวนที่ยืมมากกว่าจำนวนที่มีอยู่');
      if (!who) return alert('กรุณาระบุชื่อผู้ยืม');
      if (terms && !terms.checked) return alert('กรุณายอมรับเงื่อนไขการยืม');
      const data = getEquipment();
      const target = data.find(x => x.id === item.id);
      target.available -= qty;
      target.status = target.available === 0 ? 'borrowed' : 'available';
      target.borrower = who;
      saveEquipment(data);
      const history = getHistory();
      history.unshift({
        id: makeId('BR'), equipmentId: item.id, equipmentName: item.name, borrower: who,
        borrowDate: borrowDate?.value || todayISO(), returnDate: returnDate?.value || '', actualReturnDate: '',
        quantity: qty, note: note?.value?.trim() || '', status: 'borrowing', createdAt: new Date().toISOString()
      });
      saveHistory(history);
      alert('บันทึกการยืมอุปกรณ์เรียบร้อยแล้ว');
      form?.reset();
      if (borrowDate) borrowDate.value = todayISO();
      if (borrower) borrower.value = getCurrentUserName();
      populateEquipmentSelect(select); updateSelected();
    }
    if (form) form.addEventListener('submit', doBorrow);
    else confirmBtn?.addEventListener('click', doBorrow);
  }

  function setupReturnPage() {
    const select = qs('#returnEquipmentSelect') || qs('#equipmentSelect');
    const form = qs('#returnForm');
    const table = qs('#returnTable');
    if (!select && !form && !table) return;

    const active = () => getHistory().filter(h => h.status === 'borrowing' && !h.actualReturnDate);
    function renderReturnOptions() {
      if (!select) return;
      const records = active();
      select.innerHTML = '<option value="">-- เลือกรายการยืม --</option>' + records.map(h => `<option value="${escapeHtml(h.id)}">${escapeHtml(h.equipmentName)} — ${escapeHtml(h.borrower)}</option>`).join('');
    }
    function renderTable() {
      if (!table) return;
      const records = active();
      table.innerHTML = records.length ? records.map(h => `<tr><td>${escapeHtml(h.id)}</td><td>${escapeHtml(h.equipmentName)}</td><td>${escapeHtml(h.borrower)}</td><td>${formatDate(h.borrowDate)}</td><td>${formatDate(h.returnDate)}</td><td><button type="button" class="return-action-button" onclick="returnEquipment('${encodeURIComponent(h.id)}')">คืนอุปกรณ์</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">ไม่มีรายการที่กำลังยืม</td></tr>';
      initIcons();
    }
    window.returnEquipment = encodedId => {
      const id = decodeURIComponent(encodedId);
      completeReturn(id);
    };
    function completeReturn(id) {
      const history = getHistory();
      const record = history.find(h => h.id === id && h.status === 'borrowing');
      if (!record) return alert('ไม่พบรายการยืม');
      const data = getEquipment();
      const item = data.find(x => x.id === record.equipmentId);
      if (item) {
        item.available = Math.min(item.total, item.available + Number(record.quantity || 1));
        item.status = item.available === item.total ? 'available' : 'borrowed';
        if (item.available === item.total) item.borrower = '';
      }
      record.actualReturnDate = new Date().toISOString();
      record.status = 'returned';
      saveEquipment(data); saveHistory(history);
      alert('บันทึกการคืนอุปกรณ์เรียบร้อยแล้ว');
      renderReturnOptions(); renderTable();
    }
    if (form) form.addEventListener('submit', e => {
      e.preventDefault();
      const id = select?.value;
      if (!id) return alert('กรุณาเลือกรายการยืม');
      completeReturn(id);
    });
    renderReturnOptions(); renderTable();
  }

  function setupHistoryPage() {
    const table = qs('#historyTable');
    if (!table) return;
    const search = qs('#historySearch');
    const filter = qs('#statusFilter');
    const empty = qs('#emptyHistory');
    const modal = qs('#historyModal');
    const modalContent = qs('#historyModalContent');

    function effectiveStatus(h) {
      if (h.status === 'returned') return 'returned';
      if (h.returnDate && new Date(h.returnDate) < new Date() && !h.actualReturnDate) return 'overdue';
      return 'borrowing';
    }
    function renderStats(data) {
      const total = data.length;
      const borrowing = data.filter(h => effectiveStatus(h) === 'borrowing').length;
      const returned = data.filter(h => effectiveStatus(h) === 'returned').length;
      const overdue = data.filter(h => effectiveStatus(h) === 'overdue').length;
      if (qs('#totalHistory')) qs('#totalHistory').textContent = total;
      if (qs('#borrowingHistory')) qs('#borrowingHistory').textContent = borrowing;
      if (qs('#returnedHistory')) qs('#returnedHistory').textContent = returned;
      if (qs('#overdueHistory')) qs('#overdueHistory').textContent = overdue;
    }
    function render() {
      const all = getHistory();
      renderStats(all);
      const term = (search?.value || '').trim().toLowerCase();
      const selected = filter?.value || 'all';
      const rows = all.filter(h => {
        const status = effectiveStatus(h);
        const text = [h.id,h.equipmentId,h.equipmentName,h.borrower,h.note].join(' ').toLowerCase();
        return (!term || text.includes(term)) && (selected === 'all' || selected === status);
      });
      table.innerHTML = rows.map((h, i) => {
        const status = effectiveStatus(h);
        const label = { borrowing:'กำลังยืม', returned:'คืนแล้ว', overdue:'เกินกำหนด' }[status];
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
      const h = getHistory().find(x => x.id === id);
      if (!h || !modal || !modalContent) return;
      const status = effectiveStatus(h);
      const label = { borrowing:'กำลังยืม', returned:'คืนแล้ว', overdue:'เกินกำหนด' }[status];
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
      modal.classList.add('show'); initIcons();
    };
    qs('#closeHistoryModal')?.addEventListener('click', () => modal?.classList.remove('show'));
    search?.addEventListener('input', render);
    filter?.addEventListener('change', render);
    render();
    window.addEventListener('historyDataChanged', render);
    window.addEventListener('equipmentDataChanged', render);
  }

  function setupMiscModals() {
    qsa('.modal').forEach(modal => {
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });
    });
    qs('#notificationButton')?.addEventListener('click', () => {
      if (location.pathname.endsWith('history.html')) return;
      window.location.href = 'history.html';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Initialize only if the storage is empty; never overwrite user data.
    if (!localStorage.getItem(KEYS.equipment) && !localStorage.getItem(KEYS.equipmentData)) saveEquipment(DEFAULT_EQUIPMENT);
    setupCommonUI();
    setupLogin();
    setupDashboard();
    setupEquipmentPage();
    setupBorrowPage();
    setupReturnPage();
    setupHistoryPage();
    setupMiscModals();
    initIcons();
  });
})();
