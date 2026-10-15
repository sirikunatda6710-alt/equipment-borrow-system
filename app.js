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
      { id: "EQ-AUDIO-0
