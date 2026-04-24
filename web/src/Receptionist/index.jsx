import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../Home/context/AuthContext'
import useReceptionistData from './useReceptionistData'
import receptionistService from '../services/receptionistService'

// Fallback data constants
const PENDING_CONFIRMATIONS = []
const SPECIALISTS = []
const SCHEDULE_ACTION_CARDS = [
  { icon: '📅', title: 'Add Schedule', desc: 'Create new doctor schedules', bg: '#dbeafe' },
  { icon: '👥', title: 'Bulk Import', desc: 'Import multiple schedules', bg: '#fce7f3' },
  { icon: '📊', title: 'View Analytics', desc: 'Schedule utilization', bg: '#ecfdf5' },
]
const URGENT_CASE = { ticket: 'Q-001', patient: 'Awaiting data', upcoming: [] }
const NOTIFICATIONS = []
const QUEUE_BOARD = []
const RECENT_INTERACTIONS = []
const RECENT_ACTIVITY = []
const DOCTOR_STATUS = []
const CALENDAR_TIMES = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM']

// Generate calendar days dynamically based on current date
function getCalendarDays(offsetWeeks = 0) {
  const today = new Date();
  // Reference date shifted by week offset
  const refDate = new Date(today);
  if (offsetWeeks && Number.isFinite(offsetWeeks)) {
    refDate.setDate(refDate.getDate() + offsetWeeks * 7);
  }

  const dayOfWeek = refDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Get Monday of the reference week
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const days = [];
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    days.push({
      day: dayNames[i],
      num: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      // highlight real today regardless of offset
      today: date.toDateString() === new Date().toDateString()
    });
  }

  return days;
}

function getCalendarRange(days) {
  if (days.length === 0) return '';
  const start = days[0];
  const end = days[days.length - 1];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if (start.month === end.month) {
    return `${monthNames[start.month]} ${start.num} – ${end.num}, ${start.year}`;
  } else {
    return `${monthNames[start.month]} ${start.num} – ${monthNames[end.month]} ${end.num}, ${end.year}`;
  }
}

const CALENDAR_EVENTS = { '1-1': [{ label: 'Event 1', sub: 'Details', type: 'green' }] }
const QUEUE_DEPARTMENTS = []

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body, #root { 
  width: 100%; 
  height: 100%; 
  margin: 0; 
  padding: 0; 
}

:root {
  --primary: #0d9488;
  --primary-light: #14b8a6;
  --primary-dark: #0f766e;
  --primary-bg: #f0fdfa;
  --sidebar-bg: #0f172a;
  --sidebar-hover: rgba(13,148,136,0.15);
  --sidebar-active: rgba(13,148,136,0.25);
  --accent: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --info: #3b82f6;
  --bg: #f8fafc;
  --card: #ffffff;
  --border: #e2e8f0;
  --text: #0f172a;
  --text-muted: #64748b;
  --text-light: #94a3b8;
  --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --radius: 12px;
  --radius-sm: 8px;
}

body { font-family: 'DM Sans', sans-serif; }

.app { display: flex; height: 100vh; background: var(--bg); overflow: hidden; }

/* SIDEBAR */
.sidebar {
  width: 240px; min-width: 240px;
  background: var(--sidebar-bg);
  display: flex; flex-direction: column;
  transition: width 0.3s ease, min-width 0.3s ease;
  overflow: hidden;
  z-index: 50;
}
.sidebar.collapsed { width: 68px; min-width: 68px; }

.sidebar-logo {
  display: flex; align-items: center; gap: 10px;
  padding: 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.07);
}
.logo-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
}
.logo-text { color: white; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 15px; white-space: nowrap; }
.logo-sub { color: var(--text-light); font-size: 10px; white-space: nowrap; }

.sidebar-nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 10px; border-radius: var(--radius-sm);
  color: rgba(255,255,255,0.5); cursor: pointer;
  transition: all 0.2s; border: none; background: transparent;
  font-family: 'DM Sans', sans-serif; font-size: 13.5px; font-weight: 500;
  white-space: nowrap; width: 100%; text-align: left;
}
.nav-item:hover { background: var(--sidebar-hover); color: rgba(255,255,255,0.85); }
.nav-item.active { background: var(--sidebar-active); color: var(--primary-light); font-weight: 600; }
.nav-icon { font-size: 17px; min-width: 24px; text-align: center; flex-shrink: 0; }

.check-in-btn {
  margin: 0 8px 12px;
  padding: 11px 14px;
  background: var(--primary);
  color: white; border: none; border-radius: var(--radius-sm);
  cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all 0.2s; white-space: nowrap;
}
.check-in-btn:hover { background: var(--primary-dark); transform: translateY(-1px); }

.sidebar-user {
  padding: 12px 14px; border-top: 1px solid rgba(255,255,255,0.07);
  display: flex; align-items: center; gap: 10px;
}
.user-ava {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, #0ea5e9, var(--primary));
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 700; font-size: 13px; flex-shrink: 0;
}
.user-info { overflow: hidden; }
.user-name { color: white; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-role { color: var(--text-light); font-size: 11px; white-space: nowrap; }

.sidebar-footer-btns {
  padding: 8px 8px 8px;
  display: flex; flex-direction: column; gap: 2px;
  border-top: 1px solid rgba(255,255,255,0.07);
}
.footer-btn {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: var(--radius-sm);
  color: rgba(255,255,255,0.4); cursor: pointer;
  background: transparent; border: none;
  font-size: 13px; transition: all 0.2s; white-space: nowrap; width: 100%; text-align: left;
}
.footer-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); }
.footer-btn.logout:hover { background: rgba(239,68,68,0.12); color: #fca5a5; }

/* MAIN */
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.topbar {
  display: flex; align-items: center; gap: 16px;
  padding: 14px 24px; background: white;
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
}
.topbar-title h1 {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 20px; font-weight: 800; color: var(--text);
}
.topbar-title p { font-size: 12px; color: var(--text-muted); margin-top: 1px; }
.search-wrap { flex: 1; max-width: 400px; position: relative; }
.search-wrap input {
  width: 100%; padding: 9px 14px 9px 38px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  font-size: 13px; background: #f8fafc; color: var(--text);
  transition: all 0.2s; font-family: 'DM Sans', sans-serif;
}
.search-wrap input:focus { outline: none; border-color: var(--primary); background: white; box-shadow: 0 0 0 3px rgba(13,148,136,0.1); }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 14px; }
.search-dropdown {
  position: absolute; top: 100%; left: 0; right: 0;
  background: white; border: 1px solid var(--border);
  border-top: none; border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  max-height: 400px; overflow-y: auto; z-index: 100;
}

/* NOTIFICATIONS PANEL */
.notification-panel {
  position: absolute; top: 100%; right: 0;
  background: white; border: 1px solid var(--border);
  border-top: none; border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 360px; max-height: 500px; display: flex; flex-direction: column;
  z-index: 100;
}
.notif-header {
  padding: 14px 16px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.notif-header h3 {
  font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700;
  color: var(--text); margin: 0;
}
.notif-badge {
  background: #ef4444; color: white; border-radius: 20px;
  padding: 2px 8px; font-size: 11px; font-weight: 700;
}
.notif-list {
  flex: 1; overflow-y: auto; border-bottom: 1px solid var(--border);
}
.notif-item {
  display: flex; gap: 10px; padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  background: white; cursor: pointer; transition: background 0.2s;
}
.notif-item:last-child { border-bottom: none; }
.notif-item:hover { background: #f8fafc; }
.notif-item.unread {
  background: #f0fdfa; border-left: 3px solid var(--primary);
}
.notif-icon {
  font-size: 20px; min-width: 24px; text-align: center; flex-shrink: 0;
}
.notif-content { flex: 1; overflow: hidden; }
.notif-title {
  font-size: 13px; font-weight: 600; color: var(--text);
  margin-bottom: 2px;
}
.notif-message {
  font-size: 12px; color: var(--text-muted); margin-bottom: 4px;
  line-height: 1.4; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.notif-time {
  font-size: 11px; color: var(--text-light);
}
.notif-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--primary); flex-shrink: 0; margin-top: 4px;
}
.notif-footer {
  padding: 12px 14px; background: #f8fafc;
}
.notif-view-all {
  width: 100%; padding: 8px 12px; border: 1px solid var(--border);
  background: white; border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 600; color: var(--primary);
  cursor: pointer; transition: all 0.2s;
}
.notif-view-all:hover {
  background: var(--primary-bg); border-color: var(--primary);
}

/* HELP PANEL */
.help-panel {
  position: absolute; top: 100%; right: 0;
  background: white; border: 1px solid var(--border);
  border-top: none; border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 380px; max-height: 550px; display: flex; flex-direction: column;
  z-index: 100;
}
.help-header {
  padding: 14px 16px; border-bottom: 1px solid var(--border);
}
.help-header h3 {
  font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700;
  color: var(--text); margin: 0;
}
.help-content {
  flex: 1; overflow-y: auto; padding: 12px 0;
}
.help-section {
  border-bottom: 1px solid var(--border);
  padding: 12px 16px;
}
.help-section:last-child { border-bottom: none; }
.help-category h4 {
  font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 700;
  color: var(--text); margin: 0 0 8px 0; text-transform: none;
}
.help-category ul {
  list-style: none; padding: 0; margin: 0;
}
.help-category li {
  font-size: 12px; color: var(--text-muted); margin-bottom: 6px; line-height: 1.5;
}
.help-category li strong {
  color: var(--text); font-weight: 600;
}
.help-category li:last-child { margin-bottom: 0; }
.help-footer {
  padding: 12px 16px; background: #f8fafc; border-top: 1px solid var(--border);
  display: flex; gap: 10px;
}
.help-link {
  flex: 1; padding: 8px 12px; border: 1px solid var(--border);
  background: white; border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 600; color: var(--primary);
  cursor: pointer; text-align: center; text-decoration: none; transition: all 0.2s;
}
.help-link:hover {
  background: var(--primary-bg); border-color: var(--primary);
}

/* USER PROFILE MENU */
.user-profile-menu {
  position: absolute; top: 100%; right: 0;
  background: white; border: 1px solid var(--border);
  border-top: none; border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 280px; z-index: 100;
  font-family: 'DM Sans', sans-serif;
}
.user-menu-header {
  padding: 14px 16px;
  display: flex; align-items: center; gap: 10px;
  border-bottom: 1px solid var(--border);
}
.user-menu-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  background: linear-gradient(135deg, #0ea5e9, var(--primary));
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 700; font-size: 16px; flex-shrink: 0;
}
.user-menu-info { flex: 1; overflow: hidden; }
.user-menu-name {
  font-size: 13px; font-weight: 600; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.user-menu-role {
  font-size: 11px; color: var(--text-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.user-menu-divider {
  height: 1px; background: var(--border);
}
.user-menu-items {
  display: flex; flex-direction: column;
  padding: 4px 0;
}
.user-menu-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; background: transparent; border: none;
  cursor: pointer; font-size: 13px; color: var(--text);
  transition: background 0.2s; text-align: left; font-family: 'DM Sans', sans-serif;
}
.user-menu-item:hover {
  background: #f8fafc;
}
.user-menu-item span:first-child {
  font-size: 16px; min-width: 18px; flex-shrink: 0;
}
.user-menu-item.logout {
  color: #dc2626; border-top: 1px solid var(--border);
}
.user-menu-item.logout:hover {
  background: #fee2e2;
}

.user-profile-wrapper { position: relative; cursor: pointer; }

.notification-wrapper { position: relative; }
.help-wrapper { position: relative; }

.topbar-right { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.icon-btn {
  width: 36px; height: 36px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: white;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 16px; transition: all 0.2s;
}
.icon-btn:hover { background: #f1f5f9; }
.topbar-user { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.topbar-user-ava {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #0ea5e9, var(--primary));
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 700; font-size: 13px;
}
.topbar-user-info .name { font-size: 13px; font-weight: 600; color: var(--text); }
.topbar-user-info .role { font-size: 11px; color: var(--text-muted); }

/* NAV TABS (Appointments) */
.nav-tabs-bar {
  display: flex; align-items: center; gap: 4px;
  padding: 0 24px; background: white;
  border-bottom: 1px solid var(--border);
}
.tab-btn {
  padding: 12px 16px; background: transparent; border: none;
  cursor: pointer; font-size: 13px; font-weight: 500;
  color: var(--text-muted); border-bottom: 2px solid transparent;
  transition: all 0.2s; font-family: 'DM Sans', sans-serif;
}
.tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }

/* PAGE CONTENT */
.content { flex: 1; overflow-y: auto; padding: 24px; }
.content::-webkit-scrollbar { width: 6px; }
.content::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

/* CARDS */
.card { background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; }

/* STATS GRID */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card {
  background: white; border-radius: var(--radius); padding: 18px 20px;
  box-shadow: var(--shadow); display: flex; align-items: center; gap: 14px;
  transition: all 0.2s;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.stat-icon-wrap {
  width: 44px; height: 44px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;
}
.stat-info .label { font-size: 11.5px; color: var(--text-muted); font-weight: 500; margin-bottom: 3px; }
.stat-info .value { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 26px; font-weight: 800; color: var(--text); line-height: 1; }
.stat-info .sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.stat-badge { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 20px; margin-left: auto; align-self: flex-start; }

/* TWO COL */
.two-col { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; margin-bottom: 24px; }
.section-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-hdr h3 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); }
.link-btn { font-size: 12px; color: var(--primary); background: none; border: none; cursor: pointer; font-weight: 600; }

/* APPOINTMENT ROWS */
.appt-list { display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; padding-right: 4px; }
.appt-list::-webkit-scrollbar { width: 6px; }
.appt-list::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
.appt-list::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 10px; }
.appt-list::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
.appt-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; background: #f8fafc;
  border-radius: var(--radius-sm); border-left: 3px solid var(--primary);
  transition: background 0.2s;
}
.appt-row:hover { background: #f1f5f9; }
.appt-time { font-size: 13px; font-weight: 700; color: var(--primary); min-width: 46px; }
.appt-det { flex: 1; }
.appt-patient { font-size: 13px; font-weight: 600; color: var(--text); }
.appt-sub { font-size: 11.5px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.badge {
  display: inline-block; padding: 3px 8px; border-radius: 4px;
  font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
}
.badge-pending { background: #fee2e2; color: #dc2626; }
.badge-checked { background: #cffafe; color: #0e7490; }
.badge-progress { background: #dbeafe; color: #1d4ed8; }
.badge-veteran { background: #fef3c7; color: #d97706; }
.badge-insurance { background: #ede9fe; color: #7c3aed; }
.checkin-btn {
  padding: 6px 12px; background: white; border: 1px solid var(--border);
  border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--text);
  transition: all 0.2s;
}
.checkin-btn:hover { background: var(--primary); color: white; border-color: var(--primary); }

/* QUEUE */
.queue-board {
  background: var(--sidebar-bg); border-radius: var(--radius);
  padding: 16px; color: white;
}
.queue-live-hdr { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: pulse 1.5s infinite; flex-shrink: 0; }
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
.queue-live-label { font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; }
.queue-ticket { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
.queue-ticket:last-child { border-bottom: none; }
.ticket-left { display: flex; flex-direction: column; }
.ticket-label { font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px; }
.ticket-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22px; font-weight: 800; color: white; }
.ticket-sub { font-size: 11px; color: rgba(255,255,255,0.4); }
.ticket-num { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 800; color: var(--primary-light); }
.ticket-num.green { color: #4ade80; }
.manage-q-btn {
  width: 100%; margin-top: 14px; padding: 10px;
  background: rgba(13,148,136,0.25); border: 1px solid rgba(13,148,136,0.4);
  border-radius: var(--radius-sm); color: var(--primary-light);
  cursor: pointer; font-size: 12.5px; font-weight: 700;
  transition: all 0.2s; font-family: 'Plus Jakarta Sans', sans-serif;
}
.manage-q-btn:hover { background: rgba(13,148,136,0.4); }

/* DOCTOR STATUS */
.doctor-status { margin-top: 16px; }
.doctor-status h4 { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
.doc-row { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--border); }
.doc-row:last-child { border-bottom: none; }
.doc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.doc-name { font-size: 13px; color: var(--text); font-weight: 500; flex: 1; }
.doc-status-badge { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 20px; }
.in-session { background: #d1fae5; color: #065f46; }
.on-break { background: #fef3c7; color: #92400e; }
.off-duty { background: #fee2e2; color: #991b1b; }

/* ACTIVITY TABLE */
.act-table { width: 100%; border-collapse: collapse; }
.act-table th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; background: #f8fafc; border-bottom: 1px solid var(--border); }
.act-table td { padding: 12px 14px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text); }
.act-table tbody tr:hover { background: #f8fafc; }
.act-green { color: var(--primary); font-weight: 600; }
.patient-cell { display: flex; align-items: center; gap: 8px; }
.patient-ava { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; flex-shrink: 0; }

/* ===== PATIENTS PAGE ===== */
.page-hdr { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
.page-hdr h2 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22px; font-weight: 800; color: var(--text); }
.page-hdr p { font-size: 13px; color: var(--text-muted); margin-top: 3px; }
.primary-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 18px; background: var(--primary); color: white;
  border: none; border-radius: var(--radius-sm); cursor: pointer;
  font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 700;
  transition: all 0.2s;
}
.primary-btn:hover { background: var(--primary-dark); transform: translateY(-1px); }

.filters-row { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.filter-tab {
  padding: 7px 16px; border-radius: 20px; border: 1.5px solid var(--border);
  background: white; cursor: pointer; font-size: 12.5px; font-weight: 500;
  color: var(--text-muted); transition: all 0.2s;
}
.filter-tab.active { background: var(--primary); color: white; border-color: var(--primary); font-weight: 600; }
.filter-icon-btn { margin-left: auto; display: flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: white; cursor: pointer; font-size: 12.5px; color: var(--text-muted); }

.patients-table-wrap { background: white; border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; margin-bottom: 24px; }
.pt-table { width: 100%; border-collapse: collapse; }
.pt-table th { padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; background: #f8fafc; border-bottom: 1px solid var(--border); }
.pt-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text); vertical-align: middle; }
.pt-table tbody tr:hover { background: #f8fafc; }
.pt-id { font-size: 12px; font-weight: 700; color: var(--text-muted); }
.pt-info .name { font-weight: 600; color: var(--text); }
.pt-info .email { font-size: 11.5px; color: var(--text-muted); }
.pt-ins { display: flex; flex-direction: column; }
.pt-ins .ins-name { font-size: 12px; font-weight: 600; }
.pt-ins .ins-id { font-size: 11px; color: var(--text-muted); }
.status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.status-renewed { background: #d1fae5; color: #065f46; }
.status-selected { background: #dbeafe; color: #1e40af; }
.status-critical { background: #fee2e2; color: #991b1b; }
.status-approved { background: #d1fae5; color: #065f46; }
.action-btns { display: flex; gap: 6px; }
.action-btn { width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--border); background: white; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.action-btn:hover { background: #f1f5f9; }
.pt-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: white; flex-shrink: 0; }

.pagination { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: white; border-top: 1px solid var(--border); }
.pagination-info { font-size: 13px; color: var(--text-muted); }
.page-btns { display: flex; gap: 4px; }
.pg-btn { width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--border); background: white; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--text-muted); transition: all 0.2s; }
.pg-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
.pg-btn:hover:not(.active) { background: #f1f5f9; }

.bottom-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

.interaction-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; }
.interaction-item:last-child { border-bottom: none; }
.int-icon { width: 36px; height: 36px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.int-info .title { font-size: 13px; font-weight: 600; color: var(--text); }
.int-info .sub { font-size: 12px; color: var(--text-muted); margin-top: 1px; }
.int-arrow { margin-left: auto; color: var(--text-muted); }

.queue-status-mini { background: var(--sidebar-bg); border-radius: var(--radius); padding: 20px; color: white; }
.queue-big { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 64px; font-weight: 800; color: white; line-height: 1; }
.queue-next { margin-top: 8px; font-size: 13px; color: rgba(255,255,255,0.5); }
.queue-next span { color: var(--primary-light); font-weight: 600; }
.manage-full-btn { width: 100%; margin-top: 16px; padding: 11px; background: var(--primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 700; transition: all 0.2s; }
.manage-full-btn:hover { background: var(--primary-dark); }

/* ===== APPOINTMENTS PAGE ===== */
.appts-page-hdr { display: flex; align-items: center; justify-content: flex-end; margin-bottom: 20px; }
.calendar-layout { display: grid; grid-template-columns: 1fr 280px; gap: 20px; }
.calendar-wrap { background: white; border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
.cal-toolbar { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--border); }
.cal-nav-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border); background: white; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.cal-nav-btn:hover { background: #f1f5f9; }
.cal-range { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700; color: var(--text); }
.cal-dept-sel { margin-left: auto; padding: 6px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 12.5px; color: var(--text); background: white; cursor: pointer; }
.cal-view-btns { display: flex; gap: 2px; background: #f1f5f9; border-radius: 6px; padding: 2px; }
.view-btn { padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer; font-size: 12px; font-weight: 500; color: var(--text-muted); background: transparent; transition: all 0.2s; }
.view-btn.active { background: white; color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,0.1); }

.cal-grid { display: grid; grid-template-columns: 80px repeat(7, 1fr); }
.cal-header { display: contents; }
.cal-header-cell { padding: 10px; text-align: center; font-size: 12px; font-weight: 600; color: var(--text-muted); border-bottom: 1px solid var(--border); background: #f8fafc; }
.cal-header-cell.today { color: var(--primary); }
.cal-header-cell.today .day-num { background: var(--primary); color: white; border-radius: 50%; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; }
.cal-time-col { font-size: 11px; color: var(--text-muted); text-align: right; padding: 8px 10px; border-right: 1px solid var(--border); }
.cal-cell { border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); min-height: 60px; position: relative; padding: 4px; }
.cal-event { padding: 4px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 600; margin-bottom: 2px; }
.cal-event.green { background: #d1fae5; color: #065f46; border-left: 3px solid #10b981; }
.cal-event.blue { background: #dbeafe; color: #1e40af; border-left: 3px solid #3b82f6; }
.cal-event.teal { background: #ccfbf1; color: #0f766e; border-left: 3px solid var(--primary); }
.cal-event .ev-doc { font-size: 10px; font-weight: 400; color: inherit; opacity: 0.7; }

.cal-right { display: flex; flex-direction: column; gap: 16px; }
.pending-card { background: white; border-radius: var(--radius); box-shadow: var(--shadow); padding: 16px; }
.pending-card h4 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
.pending-card h4 span { background: var(--primary); color: white; font-size: 10px; padding: 2px 8px; border-radius: 20px; }
.pending-item { padding: 12px; background: #f8fafc; border-radius: var(--radius-sm); margin-bottom: 10px; border-left: 3px solid var(--primary); }
.pending-item:last-child { margin-bottom: 0; }
.pi-name { font-size: 13px; font-weight: 600; color: var(--text); }
.pi-time { font-size: 12px; color: var(--text-muted); margin: 4px 0; display: flex; align-items: center; gap: 4px; }
.pi-actions { display: flex; gap: 6px; margin-top: 8px; }
.pi-confirm { padding: 5px 14px; background: var(--primary); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 600; }
.pi-decline { padding: 5px 14px; background: white; color: var(--text-muted); border: 1px solid var(--border); border-radius: 5px; cursor: pointer; font-size: 12px; }

.specialists-card { background: white; border-radius: var(--radius); box-shadow: var(--shadow); padding: 16px; }
.specialists-card h4 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 12px; }
.spec-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); cursor: pointer; }
.spec-row:last-child { border-bottom: none; }
.spec-ava { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: white; flex-shrink: 0; }
.spec-info .spec-name { font-size: 13px; font-weight: 600; color: var(--text); }
.spec-info .spec-role { font-size: 11px; color: var(--text-muted); }
.spec-arrow { margin-left: auto; color: var(--text-muted); font-size: 12px; }

.booking-capacity { background: white; border-radius: var(--radius); box-shadow: var(--shadow); padding: 16px; }
.booking-capacity h4 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
.capacity-pct { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 28px; font-weight: 800; color: var(--text); margin-bottom: 10px; }
.progress-bar { height: 8px; background: #e2e8f0; border-radius: 20px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--primary-light)); border-radius: 20px; }

/* ===== DOCTOR SCHEDULES PAGE ===== */
.schedules-hdr { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.schedules-hdr h2 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22px; font-weight: 800; color: var(--text); }
.schedules-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }
.schedules-topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.filter-sel { padding: 8px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; color: var(--text); background: white; cursor: pointer; }
.filter-sel:focus { outline: none; border-color: var(--primary); }
.quick-filter { padding: 7px 14px; border-radius: 20px; border: 1.5px solid var(--border); background: white; cursor: pointer; font-size: 12.5px; font-weight: 500; color: var(--text-muted); transition: all 0.2s; }
.quick-filter.active { background: var(--primary); color: white; border-color: var(--primary); }
.date-badge { margin-left: auto; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: white; font-size: 13px; font-weight: 600; color: var(--text); }
.day-view-btns { display: flex; gap: 2px; background: #f1f5f9; border-radius: 6px; padding: 2px; }

.schedules-table-wrap { background: white; border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; margin-bottom: 24px; }
.sch-table { width: 100%; border-collapse: collapse; }
.sch-table th { padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; background: #f8fafc; border-bottom: 1px solid var(--border); }
.sch-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.sch-table tbody tr:hover { background: #f8fafc; }
.doc-profile { display: flex; align-items: center; gap: 10px; }
.doc-ava { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #0ea5e9, var(--primary)); color: white; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.doc-ava img { width: 100%; height: 100%; object-fit: cover; }
.doc-pname { font-size: 13px; font-weight: 600; color: var(--text); }
.doc-dept { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }
.time-slot { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; margin: 2px; }
.slot-green { background: #d1fae5; color: #065f46; }
.slot-blue { background: #dbeafe; color: #1e40af; }
.slot-red { background: #fee2e2; color: #991b1b; border: 1px dashed #fca5a5; }
.out-of-office { display: flex; align-items: center; gap: 6px; color: #dc2626; font-size: 12px; font-weight: 600; }

.sch-action-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.sch-action-card { background: white; border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; }
.sac-icon { width: 40px; height: 40px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 12px; }
.sac-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
.sac-desc { font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 14px; }
.sac-btn { width: 100%; padding: 9px; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 700; transition: all 0.2s; font-family: 'Plus Jakarta Sans', sans-serif; }
.sac-btn.green { background: var(--primary); color: white; }
.sac-btn.red { background: #dc2626; color: white; }
.sac-btn.dark { background: var(--sidebar-bg); color: white; }
.sac-btn:hover { transform: translateY(-1px); opacity: 0.9; }

/* ===== QUEUE PAGE ===== */
.queue-page-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 24px; }
.queue-dept-card { background: white; border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; }
.qdept-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.qdept-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); }
.qdept-in-q { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; background: #d1fae5; color: #065f46; }
.qdept-sub { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; }
.qdept-serving { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
.qdept-ticket { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 48px; font-weight: 800; color: var(--text); line-height: 1; display: flex; align-items: center; gap: 8px; }
.qdept-ticket .speaker { font-size: 20px; }
.call-next-btn { width: 100%; margin-top: 14px; padding: 10px; background: var(--primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; }
.call-next-btn:hover { background: var(--primary-dark); }
.call-next-btn.dark { background: var(--sidebar-bg); }
.call-next-btn.dark:hover { background: #1e293b; }

.urgent-card { background: #7f1d1d; border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; color: white; }
.urgent-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.urgent-hdr h3 { font-size: 14px; font-weight: 700; color: white; }
.urgent-blink { font-size: 10px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 20px; animation: blink 1.5s infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
.urgent-ticket { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 52px; font-weight: 800; color: white; line-height: 1; margin: 8px 0; }
.urgent-patient { font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 14px; }
.alert-doc-btn { width: 100%; padding: 10px; background: rgba(255,255,255,0.15); border: 1.5px solid rgba(255,255,255,0.3); color: white; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; }
.alert-doc-btn:hover { background: rgba(255,255,255,0.25); }
.upcoming-list { margin-top: 14px; }
.upc-hdr { font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
.upc-item { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
.upc-item:last-child { border-bottom: none; }
.upc-time { font-size: 11px; color: rgba(255,255,255,0.5); }
.upc-name { font-size: 12.5px; color: white; font-weight: 500; }
.upc-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; }

.waiting-list { background: white; border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; margin-bottom: 24px; }
.wl-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.wl-item:last-child { border-bottom: none; }
.wl-ticket { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700; min-width: 60px; }
.wl-name { flex: 1; font-size: 13px; font-weight: 500; color: var(--text); }
.wl-wait { font-size: 12px; color: var(--text-muted); }
.wl-status { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; }
.wl-waiting { background: #e0f2fe; color: #0369a1; }
.wl-serving { background: #d1fae5; color: #065f46; }
.wl-requeue { background: #fee2e2; color: #991b1b; cursor: pointer; }

/* ===== ISSUE TICKET PANEL ===== */
.issue-ticket-panel { background: var(--sidebar-bg); border-radius: var(--radius); padding: 20px; color: white; margin-bottom: 24px; }
.it-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 16px; font-weight: 800; color: white; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.it-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.it-field { margin-bottom: 12px; }
.it-label { font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.it-input {
  width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm);
  color: white; font-size: 13px; font-family: 'DM Sans', sans-serif;
}
.it-input:focus { outline: none; border-color: var(--primary); }
.it-input option { background: #1e293b; color: white; }
.print-ticket-btn { width: 100%; padding: 11px; background: var(--primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; font-family: 'Plus Jakarta Sans', sans-serif; }
.print-ticket-btn:hover { background: var(--primary-dark); }

.queue-stats-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 20px; }
.qs-card { background: white; border-radius: var(--radius); box-shadow: var(--shadow); padding: 18px; display: flex; flex-direction: column; align-items: center; }
.qs-icon { font-size: 22px; margin-bottom: 8px; }
.qs-val { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 30px; font-weight: 800; color: var(--text); }
.qs-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

/* ===== SETTINGS PAGE ===== */
.settings-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.profile-settings { background: white; border-radius: var(--radius); box-shadow: var(--shadow); padding: 24px; }
.ps-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.ps-hdr h3 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
.edit-btn { padding: 6px 14px; border: 1.5px solid var(--primary); color: var(--primary); background: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; font-weight: 600; }
.profile-card { display: grid; grid-template-columns: auto 1fr 1fr; gap: 16px; align-items: start; padding: 16px; background: #f8fafc; border-radius: var(--radius-sm); margin-bottom: 16px; }
.profile-avatar-big { width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #06b6d4, var(--primary)); display: flex; align-items: center; justify-content: center; color: white; font-size: 22px; font-weight: 800; flex-shrink: 0; }
.profile-field { margin-bottom: 8px; }
.pf-label { font-size: 11px; color: var(--text-muted); margin-bottom: 3px; }
.pf-val { font-size: 13px; font-weight: 600; color: var(--text); }
.pf-val.link { color: var(--primary); }
.pf-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: #d1fae5; color: #065f46; }
.change-pwd-row { display: flex; align-items: center; justify-content: space-between; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.cp-info .title { font-size: 13px; font-weight: 600; color: var(--text); }
.cp-info .sub { font-size: 12px; color: var(--text-muted); }
.update-pwd-btn { padding: 7px 16px; background: #f1f5f9; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; font-size: 12.5px; font-weight: 600; color: var(--text); }

.interface-prefs { background: white; border-radius: var(--radius); box-shadow: var(--shadow); padding: 24px; }
.ip-hdr h3 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
.ip-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.ip-label { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; font-weight: 500; }
.mode-btns { display: flex; gap: 8px; }
.mode-btn { flex: 1; padding: 12px; border: 2px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; background: #f8fafc; color: var(--text-muted); display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; }
.mode-btn.active { border-color: var(--primary); color: var(--primary); background: var(--primary-bg); font-weight: 600; }
.lang-sel { width: 100%; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; color: var(--text); background: white; cursor: pointer; }
.font-size-btns { display: flex; gap: 6px; }
.fs-btn { flex: 1; padding: 8px; border: 1.5px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; background: white; color: var(--text-muted); transition: all 0.2s; }
.fs-btn.active { border-color: var(--primary); color: var(--primary); background: var(--primary-bg); }

.alerts-card { background: white; border-radius: var(--radius); box-shadow: var(--shadow); padding: 24px; }
.alerts-card h3 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.alert-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); }
.alert-row:last-child { border-bottom: none; }
.ar-info .title { font-size: 13px; font-weight: 600; color: var(--text); }
.ar-info .sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.toggle { width: 44px; height: 24px; border-radius: 12px; cursor: pointer; position: relative; transition: background 0.2s; border: none; }
.toggle.on { background: var(--primary); }
.toggle.off { background: #d1d5db; }
.toggle::after { content: ''; position: absolute; width: 18px; height: 18px; border-radius: 50%; background: white; top: 3px; transition: left 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
.toggle.on::after { left: 23px; }
.toggle.off::after { left: 3px; }

.system-config-card { background: white; border-radius: var(--radius); box-shadow: var(--shadow); padding: 24px; }
.system-config-card h3 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.sc-field { margin-bottom: 14px; }
.sc-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; font-weight: 500; }
.sc-val { font-size: 13px; font-weight: 600; color: var(--text); padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.radio-option { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; margin-bottom: 8px; transition: all 0.2s; font-size: 13px; }
.radio-option.selected { border-color: var(--primary); background: var(--primary-bg); color: var(--primary); font-weight: 600; }

.data-audit-card { background: linear-gradient(135deg, #0f766e, #0d9488); border-radius: var(--radius); padding: 20px; color: white; margin-top: 16px; }
.da-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 700; color: white; margin-bottom: 6px; }
.da-desc { font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 16px; }
.gen-log-btn { padding: 10px 20px; background: white; color: var(--primary-dark); border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 700; transition: all 0.2s; }
.gen-log-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }

.settings-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 20px 0 0; border-top: 1px solid var(--border); margin-top: 8px; }
.discard-btn { padding: 10px 20px; background: white; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text-muted); }
.save-btn { padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 700; transition: all 0.2s; }
.save-btn:hover { background: var(--primary-dark); transform: translateY(-1px); }

/* EMERGENCY ALERT */
.emergency-alert { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: #fee2e2; color: #dc2626; border-radius: var(--radius-sm); font-size: 12px; font-weight: 700; cursor: pointer; animation: blink 1.5s infinite; }

/* TOPBAR TABS */
.topbar-center { display: flex; gap: 4px; margin-left: 16px; }
.tbc-btn { padding: 6px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: white; cursor: pointer; font-size: 12.5px; font-weight: 500; color: var(--text-muted); transition: all 0.2s; }
.tbc-btn.active { background: var(--primary); color: white; border-color: var(--primary); }

/* BOTTOM SAVE BAR */
.bottom-bar { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px; background: white; border-top: 1px solid var(--border); }

/* ===== CREATE APPOINTMENT MODAL ===== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: white;
  border-radius: var(--radius);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  background: #f8fafc;
}

.modal-header h3 {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #e2e8f0;
  color: var(--text);
}

.create-appt-form {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.form-group input,
.form-group select {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  color: var(--text);
  background: white;
  transition: all 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
}

.form-group input:disabled,
.form-group select:disabled {
  background: #f8fafc;
  color: var(--text-muted);
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.btn-cancel,
.btn-create {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #e2e8f0;
  color: var(--text);
}

.btn-cancel:hover:not(:disabled) {
  background: #cbd5e1;
  transform: translateY(-1px);
}

.btn-create {
  background: var(--primary);
  color: white;
}

.btn-create:hover:not(:disabled) {
  background: var(--primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
}

.btn-cancel:disabled,
.btn-create:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
`

// ===================== DATA IMPORTED FROM mockData.js =====================
// All mock data is now imported from ./mockData.js

// ===================== COMPONENTS =====================
function Toggle({ on, onToggle }) {
  return <button className={`toggle ${on ? 'on' : 'off'}`} onClick={onToggle} />
}

function SearchResults({ searchTerm, activeMenu, patientsData, doctorsData, appointmentsData }) {
  let results = []
  
  if (activeMenu === 'patients') {
    results = patientsData.filter(p => 
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  } else if (activeMenu === 'appointments') {
    results = appointmentsData.filter(a => 
      (a.patient || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.doctor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  } else if (activeMenu === 'queue') {
    // For queue search, we'll search in the waiting lists of queue departments
    results = []
    // This would need queueDepartmentsData passed as prop for proper implementation
  } else if (activeMenu === 'schedule') {
    results = doctorsData.filter(d =>
      (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.dept || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  if (results.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No results found for "{searchTerm}"
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, padding: '12px 16px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {results.length} Result{results.length !== 1 ? 's' : ''}
      </div>
      <div>
        {activeMenu === 'patients' && results.map(p => (
          <div key={p.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{p.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.email} • {p.id}</div>
          </div>
        ))}
        {activeMenu === 'appointments' && results.map(a => (
          <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{a.patient} - {a.time}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{a.doctor} • {a.id}</div>
          </div>
        ))}
        {activeMenu === 'queue' && results.map(p => (
          <div key={p.code} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{p.code} - {p.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.dept}</div>
          </div>
        ))}
        {activeMenu === 'schedule' && results.map(d => (
          <div key={d.name} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{d.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{d.dept}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NotificationPanel({ onClose }) {
  const [notifications] = useState(NOTIFICATIONS)

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="notification-panel">
      <div className="notif-header">
        <h3>Notifications</h3>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </div>
      <div className="notif-list">
        {notifications.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
            <div>No notifications</div>
          </div>
        ) : (
          notifications.map(notif => (
            <div key={notif.id} className={`notif-item ${notif.read ? '' : 'unread'}`}>
              <div className="notif-icon">{notif.icon}</div>
              <div className="notif-content">
                <div className="notif-title">{notif.title}</div>
                <div className="notif-message">{notif.message}</div>
                <div className="notif-time">{notif.time}</div>
              </div>
              {!notif.read && <div className="notif-dot"></div>}
            </div>
          ))
        )}
      </div>
      <div className="notif-footer">
        <button className="notif-view-all">View All Notifications</button>
      </div>
    </div>
  )
}

function HelpPanel({ onClose }) {
  return (
    <div className="help-panel">
      <div className="help-header">
        <h3>Help & Support</h3>
      </div>
      <div className="help-content">
        <div className="help-section">
          <div className="help-category">
            <h4>📅 Appointments</h4>
            <ul>
              <li><strong>Create appointment:</strong> Go to Appointments tab and click "Create Appointment"</li>
              <li><strong>Check-in patient:</strong> Click "Check In" button on the appointment row</li>
              <li><strong>View schedule:</strong> Navigate to Doctor Schedules for full view</li>
            </ul>
          </div>
        </div>

        <div className="help-section">
          <div className="help-category">
            <h4>👥 Patient Management</h4>
            <ul>
              <li><strong>Add patient:</strong> Click "+ Add New Patient" button on Patients page</li>
              <li><strong>Search patients:</strong> Use the search bar at the top to find patients by name or ID</li>
              <li><strong>View details:</strong> Click the eye icon to view patient profile</li>
            </ul>
          </div>
        </div>

        <div className="help-section">
          <div className="help-category">
            <h4>🎫 Queue Management</h4>
            <ul>
              <li><strong>Issue ticket:</strong> Use "Issue New Ticket" panel to create patient tickets</li>
              <li><strong>Call next:</strong> Click "Call Next" to serve the next patient</li>
              <li><strong>Manage queue:</strong> View all waiting patients in the queue board</li>
            </ul>
          </div>
        </div>

        <div className="help-section">
          <div className="help-category">
            <h4>🔍 Quick Tips</h4>
            <ul>
              <li>Use search bar to quickly find patients, doctors, or appointments</li>
              <li>Click bell icon to see all notifications</li>
              <li>Collapse sidebar with hamburger menu to get more space</li>
              <li>Access settings to manage your preferences and alerts</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="help-footer">
        <a href="#" className="help-link">Contact Support</a>
        <a href="#" className="help-link">View Documentation</a>
      </div>
    </div>
  )
}

function UserProfileMenu({ user, onLogout }) {
  return (
    <div className="user-profile-menu">
      <div className="user-menu-header">
        <div className="user-menu-avatar">{user.fullName[0]}</div>
        <div className="user-menu-info">
          <div className="user-menu-name">{user.fullName}</div>
          <div className="user-menu-role">{user.role}</div>
        </div>
      </div>
      <div className="user-menu-divider"></div>
      <div className="user-menu-items">
        <button className="user-menu-item">
          <span>👤</span>
          <span>View Profile</span>
        </button>
        <button className="user-menu-item">
          <span>⚙️</span>
          <span>Account Settings</span>
        </button>
        <button className="user-menu-item">
          <span>🔔</span>
          <span>Notification Preferences</span>
        </button>
      </div>
      <div className="user-menu-divider"></div>
      <button className="user-menu-item logout" onClick={onLogout}>
        <span>🚪</span>
        <span>Sign Out</span>
      </button>
    </div>
  )
}

function StatCard({ icon, label, value, sub, bgColor, badge, badgeColor }) {
  return (
    <div className="stat-card">
      <div className="stat-icon-wrap" style={{ background: bgColor + '20' }}>
        <span style={{ color: bgColor }}>{icon}</span>
      </div>
      <div className="stat-info">
        <div className="label">{label}</div>
        <div className="value">{value}</div>
        {sub && <div className="sub" style={{ color: badgeColor }}>{sub}</div>}
      </div>
      {badge && <div className="stat-badge" style={{ background: badgeColor + '20', color: badgeColor }}>{badge}</div>}
    </div>
  )
}

// ===================== PAGES =====================
function DashboardPage({ 
  appointments = [], 
  doctors = [], 
  patients = [],
  queueBoard = QUEUE_BOARD,
  doctorStatus = [],
  recentActivity = RECENT_ACTIVITY
}) {
  // Calculate real stats from data
  const totalCheckins = appointments.filter(a => a.status === 'checked_in' || a.status === 'completed').length;
  const pendingAppts = appointments.filter(a => a.status === 'booked' || a.status === 'confirmed').length;
  const currentQueue = queueBoard ? queueBoard.length : 0;
  const activeDoctors = doctorStatus ? doctorStatus.filter(d => d.cls === 'in-session').length : 0;
  const activeDoctorsAll = doctors ? doctors.length : 0;

  return (
    <>
      <div className="stats-grid">
        <StatCard icon="✓" label="Total Check-ins" value={totalCheckins || "0"} sub="✓ From today" bgColor="#10b981" badgeColor="#10b981" badge="TODAY" />
        <StatCard icon="⏳" label="Pending Appts" value={pendingAppts || "0"} sub={`${pendingAppts > 0 ? pendingAppts + ' need attention' : 'All scheduled'}`} bgColor="#3b82f6" badgeColor="#3b82f6" />
        <StatCard icon="👥" label="Current Queue" value={String(currentQueue).padStart(2, '0')} sub="Avg wait: 14m" bgColor="#f59e0b" badgeColor="#f59e0b" />
        <StatCard icon="👨‍⚕️" label="Active Doctors" value={String(activeDoctorsAll).padStart(2, '0')} sub={`${activeDoctors} in session`} bgColor="#ef4444" badgeColor="#ef4444" />
      </div>

      <div className="two-col" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="card">
          <div className="section-hdr">
            <h3>Upcoming Appointments</h3>
            <button className="link-btn">View All Schedules →</button>
          </div>
          <div className="appt-list">
            {appointments && appointments.length > 0 ? appointments.map(a => (
              <div className="appt-row" key={a.id}>
                <div className="appt-time">{a.time || a.scheduledTime || '--:--'}</div>
                <div className="appt-det">
                  <div className="appt-patient">{a.patient || a.patientName || 'N/A'}</div>
                  <div className="appt-sub"><span>🩺</span>{a.doctor || a.doctorName || 'N/A'}</div>
                </div>
                <span className={`badge ${a.badgeClass || 'badge-pending'}`}>{a.badge || a.status || 'Pending'}</span>
                <button className="checkin-btn">Check In</button>
              </div>
            )) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No appointments scheduled</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="queue-board">
            <div className="queue-live-hdr">
              <div className="live-dot" />
              <span className="queue-live-label">Live Calling Board</span>
            </div>
            {queueBoard && queueBoard.map((q, i) => (
              <div className="queue-ticket" key={i}>
                <div className="ticket-left">
                  <div className="ticket-label">{q.label}</div>
                  <div className="ticket-name">{q.name}</div>
                </div>
                <div className={`ticket-num ${q.col || ''}`}>{q.ticket}</div>
              </div>
            ))}
            <button className="manage-q-btn">MANAGE QUEUE ORDER</button>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="doctor-status">
              <h4>Doctor Status</h4>
              {doctorStatus && doctorStatus.map((d, i) => (
                <div className="doc-row" key={i}>
                  <div className="doc-dot" style={{ background: d.cls === 'in-session' ? '#10b981' : d.cls === 'on-break' ? '#f59e0b' : '#ef4444' }} />
                  <div className="doc-name">{d.name}</div>
                  <span className={`doc-status-badge ${d.cls}`}>{d.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-hdr">
          <h3>Recent Activity Ledger</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icon-btn">+</button>
            <button className="icon-btn">⋮</button>
          </div>
        </div>
        <table className="act-table">
          <thead>
            <tr>
              <th>PATIENT DETAILS</th>
              <th>ACTION</th>
              <th>METHOD</th>
              <th>COMPLETED TIME</th>
              <th>TRANSACTION</th>
            </tr>
          </thead>
          <tbody>
            {recentActivity && recentActivity.length > 0 ? recentActivity.map((l, i) => (
              <tr key={i}>
                <td><div className="patient-cell"><div className="patient-ava" style={{ background: l.color || '#0ea5e9' }}>{(l.name || 'N')[0]}</div><div><div style={{ fontWeight: 600 }}>{l.name || 'N/A'}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.id || ''}</div></div></div></td>
                <td>{l.action || ''}</td>
                <td>{l.method || ''}</td>
                <td>{l.time || ''}</td>
                <td className="act-green">{l.tx || ''}</td>
              </tr>
            )) : (
              <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No recent activity</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

function PatientsPage({ patients = [], appointmentSummary = {}, queueSummary = {} }) {
  const [activeFilter, setActiveFilter] = useState('All Patients')
  
  // Calculate statistics from data
  const totalPatients = patients.length || 0;
  const activeTodayCount = queueSummary?.waiting || appointmentSummary?.checked_in || 0;
  
  // Count new registrations from this week
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const newRegistrations = patients.filter(p => {
    if (!p.created_at && !p.createdAt) return false;
    const patientDate = new Date(p.created_at || p.createdAt);
    return patientDate >= weekAgo;
  }).length;
  
  // Calculate average wait time from queue data (in minutes)
  // If not available, show default
  const averageWaitTime = queueSummary?.avg_wait_time ? Math.round(queueSummary.avg_wait_time) : 14;
  
  return (
    <>
      <div className="page-hdr">
        <div>
          <h2>Patient Management</h2>
          <p>Manage, filter, and track {totalPatients.toLocaleString()} registered patients.</p>
        </div>
        <button className="primary-btn">＋ Add New Patient</button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <StatCard 
          icon="👥" 
          label="Total Patients" 
          value={totalPatients.toString()} 
          sub="↑ 3% from last month" 
          bgColor="#10b981" 
          badgeColor="#10b981" 
        />
        <StatCard 
          icon="✓" 
          label="Active Today" 
          value={activeTodayCount.toString()} 
          sub={`${queueSummary?.waiting || 0} currently in queue`} 
          bgColor="#3b82f6" 
          badgeColor="#3b82f6" 
        />
        <StatCard 
          icon="🆕" 
          label="New Registrations" 
          value={newRegistrations.toString()} 
          sub="This week" 
          bgColor="#8b5cf6" 
          badgeColor="#8b5cf6" 
        />
        <StatCard 
          icon="⏱" 
          label="Wait Time Avg." 
          value={`${averageWaitTime}m`}
          sub="⚠ 6min above target" 
          bgColor="#ef4444" 
          badgeColor="#ef4444" 
        />
      </div>

      <div className="filters-row">
        {['All Patients', 'In-Patient', 'Out-Patient'].map(f => (
          <button key={f} className={`filter-tab ${activeFilter === f ? 'active' : ''}`} onClick={() => setActiveFilter(f)}>{f}</button>
        ))}
        <button className="filter-icon-btn" style={{ marginLeft: 'auto' }}>⇅ Filter</button>
        <button className="filter-icon-btn">⤓ Export</button>
      </div>

      <div className="patients-table-wrap">
        <table className="pt-table">
          <thead>
            <tr>
              <th>PATIENT ID</th>
              <th>FULL NAME</th>
              <th>INSURANCE</th>
              <th>LAST VISIT</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {patients && patients.length > 0 ? patients.map(p => (
              <tr key={p.id}>
                <td><div className="pt-id">{p.id}</div></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="pt-avatar" style={{ background: p.color || '#0ea5e9' }}>{(p.name || 'N')[0]}</div>
                    <div className="pt-info"><div className="name">{p.name || 'N/A'}</div><div className="email">{p.email || ''}</div></div>
                  </div>
                </td>
                <td><div className="pt-ins"><div className="ins-name">{p.ins || ''}</div><div className="ins-id">{p.insId || ''}</div></div></td>
                <td>{p.lastVisit || ''}</td>
                <td>
                  <span className={`status-badge status-${p.status.toLowerCase()}`}>
                    {p.status === 'Renewed' ? '✓' : p.status === 'Critical' ? '⚠' : '●'} {p.status}
                  </span>
                </td>
                <td>
                  <div className="action-btns">
                    <button className="action-btn">👁</button>
                    <button className="action-btn">✏️</button>
                    <button className="action-btn">🗑</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No patients found</td></tr>
            )}
          </tbody>
        </table>
        <div className="pagination">
          <div className="pagination-info">Showing 1–4 of 1,284 patients</div>
          <div className="page-btns">
            {[1,2,3,'...',32].map((p,i) => (
              <button key={i} className={`pg-btn ${p===1?'active':''}`}>{p}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="bottom-two-col">
        <div className="card">
          <div className="section-hdr"><h3>Recent Patient Interactions</h3></div>
          {RECENT_INTERACTIONS.map((it, i) => (
            <div className="interaction-item" key={i}>
              <div className="int-icon" style={{ background: it.bg }}>{it.icon}</div>
              <div className="int-info"><div className="title">{it.title}</div><div className="sub">{it.sub}</div></div>
              <div className="int-arrow">›</div>
            </div>
          ))}
        </div>
        <div className="queue-status-mini">
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Current Queue</div>
          <div className="queue-big">08</div>
          <div className="queue-next">Next up: <span>Julian White</span></div>
          <button className="manage-full-btn">Manage Full Queue</button>
        </div>
      </div>
    </>
  )
}

function AppointmentsPage({ appointments = [], doctors = [], patients = [], onConfirm, onDecline, refetch }) {
  const [processingAppointments, setProcessingAppointments] = useState(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingAppointment, setCreatingAppointment] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    appointmentDate: '',
    appointmentTime: '08:00',
    reason: ''
  })
  
  const times = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM']
  const days = getCalendarDays(weekOffset)
  
  const handleConfirmClick = async (appointmentId, appointmentData) => {
    setProcessingAppointments(prev => new Set(prev).add(appointmentId))
    try {
      if (onConfirm) {
        await onConfirm(appointmentId, appointmentData)
      }
    } finally {
      setProcessingAppointments(prev => {
        const newSet = new Set(prev)
        newSet.delete(appointmentId)
        return newSet
      })
    }
  }

  const handleDeclineClick = async (appointmentId) => {
    const reason = prompt('Enter reason for declining (optional):', 'Declined by receptionist')
    if (reason === null) return // User cancelled
    
    setProcessingAppointments(prev => new Set(prev).add(appointmentId))
    try {
      if (onDecline) {
        await onDecline(appointmentId, reason)
      }
    } finally {
      setProcessingAppointments(prev => {
        const newSet = new Set(prev)
        newSet.delete(appointmentId)
        return newSet
      })
    }
  }

  const handleCreateAppointment = async (e) => {
    e.preventDefault()
    
    // Validate form
    if (!formData.patientId || !formData.doctorId || !formData.appointmentDate || !formData.appointmentTime) {
      alert('Please fill in all required fields')
      return
    }

    setCreatingAppointment(true)
    try {
      // Find the patient and doctor to get their MongoDB IDs
      console.log('🔍 Finding patient with id:', formData.patientId);
      console.log('Available patients:', patients.map(p => ({ id: p.id, _id: p._id })));
      
      const selectedPatient = patients.find(p => p.id === formData.patientId)
      const selectedDoctor = doctors.find(d => d.id === formData.doctorId)

      console.log('Selected patient:', selectedPatient);
      console.log('Selected doctor:', selectedDoctor);

      if (!selectedPatient || !selectedDoctor) {
        alert('Invalid patient or doctor selection')
        console.error('Patient not found or doctor not found');
        setCreatingAppointment(false)
        return
      }

      if (!selectedPatient._id) {
        alert('Patient data is incomplete. Please refresh and try again.');
        console.error('Patient has no _id:', selectedPatient);
        setCreatingAppointment(false)
        return
      }

      if (!selectedDoctor._id) {
        alert('Doctor data is incomplete. Please refresh and try again.');
        console.error('Doctor has no _id:', selectedDoctor);
        setCreatingAppointment(false)
        return
      }

        // Ensure department_id is present for the appointment payload
        const deptId = selectedDoctor.department_id || selectedDoctor.departmentId || selectedDoctor.department_id || selectedDoctor.department || null
        if (!deptId) {
          alert('Doctor does not have an associated department. Please refresh or choose another doctor.');
          console.error('Doctor missing department_id:', selectedDoctor);
          setCreatingAppointment(false)
          return
        }

      // Combine date and time
      const appointmentDateTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`)
      
      // Use MongoDB IDs for API call
      const payload = {
        patient_id: selectedPatient._id?.toString?.() || selectedPatient._id,
        doctor_id: selectedDoctor._id?.toString?.() || selectedDoctor._id,
        department_id: deptId?.toString?.() || deptId,
        appointment_time: appointmentDateTime.toISOString(),
        appointment_type: 'outpatient',
        reason: formData.reason || 'General consultation'
      }

      console.log('📝 Creating appointment with payload:', payload);
      const response = await receptionistService.appointments.create(payload)
      console.log('✓ Appointment created:', response)

      // Reset form and close modal
      setFormData({
        patientId: '',
        doctorId: '',
        appointmentDate: '',
        appointmentTime: '08:00',
        reason: ''
      })
      setShowCreateModal(false)

      // Refresh data
      if (refetch) {
        await refetch()
      }

      alert('✓ Appointment created successfully')
    } catch (error) {
      console.error('❌ Error creating appointment:', error)
      alert('Failed to create appointment: ' + (error.response?.data?.message || error.message))
    } finally {
      setCreatingAppointment(false)
    }
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }
  
  // Generate events from appointments data
  const generateEvents = () => {
    const events = {};
    
    if (!Array.isArray(appointments) || appointments.length === 0) {
      return events;
    }
    
    console.log('📅 Generating calendar events from', appointments.length, 'appointments:', appointments);
    
    // Parse times to get hour only
    const timeHours = times.map((t) => {
      const hour = parseInt(t.split(':')[0]);
      const isPM = t.includes('PM');
      return isPM && hour !== 12 ? hour + 12 : (hour === 12 && !isPM ? 0 : hour);
    });
    
    appointments.forEach((apt) => {
      try {
        if (!apt.appointmentTime) return;
        
        const aptTime = new Date(apt.appointmentTime);
        const aptHour = aptTime.getHours();
        const aptDate = aptTime.getDate();
        const aptMonth = aptTime.getMonth();
        const aptYear = aptTime.getFullYear();
        
        // Find matching time slot (row)
        const timeRow = timeHours.findIndex((h) => {
          const slotStart = h;
          const slotEnd = h + 1;
          return aptHour >= slotStart && aptHour < slotEnd;
        });
        
        // Find matching day column - check date, month, and year
        const dayCol = days.findIndex((d) => 
          d.num === aptDate && d.month === aptMonth && d.year === aptYear
        );
        
        // Only add if within calendar range
        if (timeRow >= 0 && dayCol >= 0) {
          const key = `${timeRow}-${dayCol}`;
          if (!events[key]) {
            events[key] = [];
          }
          
          const eventObj = {
            label: apt.patient || 'Unknown Patient',
            sub: apt.doctor || 'Unknown Doctor',
            type: ['green', 'blue', 'teal'][appointments.indexOf(apt) % 3],
            status: apt.status,
            time: apt.time,
          };
          
          console.log(`📌 Event for ${key}: "${eventObj.label}" with Dr. "${eventObj.sub}"`);
          events[key].push(eventObj);
        }
      } catch (err) {
        console.error('Error processing appointment:', apt, err);
      }
    });
    
    console.log('✓ Calendar events generated:', events);
    return events;
  };
  
  const events = generateEvents();
  
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="primary-btn" onClick={() => setShowCreateModal(true)}>＋ Create Appointment</button>
      </div>
      <div className="calendar-layout">
        <div className="calendar-wrap">
          <div className="cal-toolbar">
            <div className="cal-view-btns">
              {['Calendar', 'List View', 'Map'].map(v => (
                <button key={v} className={`view-btn ${v==='Calendar'?'active':''}`}>{v}</button>
              ))}
            </div>
            <button className="cal-nav-btn" onClick={() => setWeekOffset(prev => prev - 1)}>‹</button>
            <span className="cal-range">{getCalendarRange(days)}</span>
            <button className="cal-nav-btn" onClick={() => setWeekOffset(prev => prev + 1)}>›</button>
            <select className="cal-dept-sel"><option>All Departments</option></select>
          </div>
          <div className="cal-grid">
            <div className="cal-header-cell" style={{ background: '#f8fafc' }}></div>
            {days.map((d, i) => (
              <div key={i} className={`cal-header-cell ${d.today ? 'today' : ''}`}>
                <div style={{ fontSize: 11, color: d.today ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 2 }}>{d.day}</div>
                <div className="day-num" style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 14 }}>{d.num}</div>
              </div>
            ))}
            {times.map((t, ri) => (
              <>
                <div key={`t${ri}`} className="cal-time-col">{t}</div>
                {days.map((_, ci) => (
                  <div key={`c${ri}-${ci}`} className="cal-cell">
                    {(events[`${ri}-${ci}`] || []).map((ev, ei) => (
                      <div key={ei} className={`cal-event ${ev.type}`}>
                        {ev.label}
                        {ev.sub && <div className="ev-doc">{ev.sub}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            ))}
          </div>
        </div>

        <div className="cal-right">
          <div className="pending-card">
            <h4>Pending Confirmations <span>+ New</span></h4>
            {appointments && appointments.filter(a => a.status === 'booked').length > 0 ? (
              appointments.filter(a => a.status === 'booked').slice(0, 5).map((pi, i) => (
                <div className="pending-item" key={i}>
                  <div className="pi-name">{pi.patient || 'Unknown Patient'}</div>
                  <div className="pi-time">🕐 {pi.time || pi.scheduledTime || 'N/A'}</div>
                  <div className="pi-actions">
                    <button 
                      className="pi-confirm"
                      onClick={() => handleConfirmClick(pi.id, pi)}
                      disabled={processingAppointments.has(pi.id)}
                      style={{
                        opacity: processingAppointments.has(pi.id) ? 0.6 : 1,
                        cursor: processingAppointments.has(pi.id) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {processingAppointments.has(pi.id) ? '⏳' : 'Confirm'}
                    </button>
                    <button 
                      className="pi-decline"
                      onClick={() => handleDeclineClick(pi.id)}
                      disabled={processingAppointments.has(pi.id)}
                      style={{
                        opacity: processingAppointments.has(pi.id) ? 0.6 : 1,
                        cursor: processingAppointments.has(pi.id) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {processingAppointments.has(pi.id) ? '⏳' : 'Decline'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>No pending confirmations</div>
            )}
          </div>

          <div className="specialists-card">
            <h4>On-Call Specialists</h4>
            {doctors && doctors.length > 0 ? (
              doctors.slice(0, 5).map((s, i) => (
                <div className="spec-row" key={i}>
                  <div className="spec-ava" style={{ background: ['#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#84cc16'][i % 5] }}>
                    {(s.name || 'D').split(' ').slice(-1)[0][0]}
                  </div>
                  <div className="spec-info">
                    <div className="spec-name">{s.name || 'Unknown Doctor'}</div>
                    <div className="spec-role">{s.department || 'General Medicine'}</div>
                  </div>
                  <span className="spec-arrow">›</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>No specialists available</div>
            )}
          </div>

          <div className="booking-capacity">
            <h4>Booking Capacity</h4>
            <div className="capacity-pct">68%</div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: '68%' }} /></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>32 Slots Free</div>
          </div>
        </div>
      </div>

      {/* Create Appointment Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Appointment</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateAppointment} className="create-appt-form">
              <div className="form-group">
                <label>Patient *</label>
                <select 
                  name="patientId"
                  value={formData.patientId}
                  onChange={handleFormChange}
                  required
                  disabled={creatingAppointment}
                >
                  <option value="">Select a patient...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Doctor *</label>
                <select 
                  name="doctorId"
                  value={formData.doctorId}
                  onChange={handleFormChange}
                  required
                  disabled={creatingAppointment}
                >
                  <option value="">Select a doctor...</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} - {d.department || 'General Medicine'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Date *</label>
                  <input 
                    type="date"
                    name="appointmentDate"
                    value={formData.appointmentDate}
                    onChange={handleFormChange}
                    required
                    disabled={creatingAppointment}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="form-group">
                  <label>Time *</label>
                  <select 
                    name="appointmentTime"
                    value={formData.appointmentTime}
                    onChange={handleFormChange}
                    required
                    disabled={creatingAppointment}
                  >
                    <option value="08:00">08:00 AM</option>
                    <option value="09:00">09:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="12:00">12:00 PM</option>
                    <option value="13:00">01:00 PM</option>
                    <option value="14:00">02:00 PM</option>
                    <option value="15:00">03:00 PM</option>
                    <option value="16:00">04:00 PM</option>
                    <option value="17:00">05:00 PM</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Reason (Optional)</label>
                <input 
                  type="text"
                  name="reason"
                  placeholder="e.g., General checkup, Follow-up, etc."
                  value={formData.reason}
                  onChange={handleFormChange}
                  disabled={creatingAppointment}
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creatingAppointment}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-create"
                  disabled={creatingAppointment}
                >
                  {creatingAppointment ? '⏳ Creating...' : '✓ Create Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function DoctorSchedulesPage({ doctors = DOCTORS }) {
  return (
    <>
      <div className="schedules-hdr">
        <h2>Doctor Schedules</h2>
      </div>
      <div className="schedules-sub">Managing 24 clinicians across 8 departments</div>

      <div className="schedules-topbar">
        <select className="filter-sel"><option>All Departments</option><option>Cardiology</option><option>Pediatrics</option><option>Neurology</option></select>
        <input className="filter-sel" placeholder="Dr. Name..." style={{ minWidth: 160 }} />
        {['Available Now', 'On Call', 'Surgeries'].map((f, i) => (
          <button key={f} className={`quick-filter ${i===0?'active':''}`}>{f}</button>
        ))}
        <button className="quick-filter">Clear All</button>
        <div className="date-badge">
          <div className="day-view-btns">
            {['Day', 'Week', 'Month'].map(v => <button key={v} className={`view-btn ${v==='Day'?'active':''}`}>{v}</button>)}
          </div>
          📅 Oct 24, 2023
        </div>
      </div>

      <div className="schedules-table-wrap">
        <table className="sch-table">
          <thead>
            <tr>
              <th>PRACTITIONER</th>
              <th>09:00 AM</th>
              <th>09:00 AM</th>
              <th>10:00 AM</th>
              <th>11:00 AM</th>
              <th>12:00 PM</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((doc, i) => (
              <tr key={i}>
                <td>
                  <div className="doc-profile">
                    <div className="doc-ava">{doc.name.split(' ')[1][0]}{doc.name.split(' ')[2]?.[0]}</div>
                    <div><div className="doc-pname">{doc.name}</div><div className="doc-dept">{doc.dept}</div></div>
                  </div>
                </td>
                {doc.out ? (
                  <td colSpan={5}><div className="out-of-office">🔴 OUT OF OFFICE • FULL DAY LEAVE</div></td>
                ) : (
                  (doc.slots || []).concat([null, null, null]).slice(0, 5).map((s, j) => (
                    <td key={j}>{s && <span className={`time-slot slot-${s.type}`}>{s.label}<br/><span style={{fontSize:10,fontWeight:400}}>{s.sub}</span></span>}</td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sch-action-cards">
        {SCHEDULE_ACTION_CARDS.map((c, i) => (
          <div className="sch-action-card" key={i}>
            <div className="sac-icon" style={{ background: c.bg }}>{c.icon}</div>
            <div className="sac-title">{c.title}</div>
            <div className="sac-desc">{c.desc}</div>
            <button className={`sac-btn ${c.cls}`}>{c.btn}</button>
          </div>
        ))}
      </div>
    </>
  )
}

function QueuePage({ queueDepartments = QUEUE_DEPARTMENTS }) {
  return (
    <>
      <div className="page-hdr"><div><h2>Queue Management</h2><p>Real-time queue tracking across all departments</p></div></div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 24 }}>
        <div className="issue-ticket-panel">
          <div className="it-title">🎫 Issue New Ticket</div>
          <div className="it-field"><div className="it-label">Patient Name</div><input className="it-input" placeholder="Full name or MRN" /></div>
          <div className="it-form-row">
            <div className="it-field"><div className="it-label">Department</div>
              <select className="it-input"><option>Gen. Medicine</option><option>Pediatrics</option><option>Urgent Care</option></select>
            </div>
            <div className="it-field"><div className="it-label">Priority</div>
              <select className="it-input"><option>Routine</option><option>Urgent</option><option>Emergency</option></select>
            </div>
          </div>
          <button className="print-ticket-btn">🖨 Print Ticket</button>
        </div>

        <div className="queue-stats-row" style={{ alignContent: 'start' }}>
          <div className="qs-card"><div className="qs-icon" style={{ color: '#10b981' }}>👥</div><div className="qs-val">42</div><div className="qs-label">Total Waiting</div></div>
          <div className="qs-card"><div className="qs-icon" style={{ color: '#f59e0b' }}>⏱</div><div className="qs-val">18m</div><div className="qs-label">Avg. Wait Time</div></div>
          <div className="qs-card"><div className="qs-icon" style={{ color: '#ef4444' }}>🚨</div><div className="qs-val">12</div><div className="qs-label">Urgent Cases</div></div>
        </div>
      </div>

      <div className="queue-page-grid">
        {queueDepartments.map((d, i) => (
          <div className="queue-dept-card" key={i}>
            <div className="qdept-hdr"><div className="qdept-name">{d.dept}</div><span className="qdept-in-q">{d.inQ}</span></div>
            <div className="qdept-sub">{d.sub}</div>
            <div className="qdept-serving">CURRENTLY SERVING</div>
            <div className="qdept-ticket"><span>{d.serving}</span><span className="speaker">🔊</span></div>
            <button className={`call-next-btn ${d.btnCls}`}>Call Next →</button>
            <div style={{ marginTop: 14 }}>
              {d.waiting.map((w, j) => (
                <div className="wl-item" key={j}>
                  <div className="wl-ticket" style={{ color: 'var(--text-muted)' }}>{w.code}</div>
                  <div className="wl-name">{w.name}</div>
                  <div className="wl-wait">Waiting {w.wait}</div>
                  <span className={`wl-status ${w.st}`}>{w.st === 'wl-waiting' ? 'WAITING' : w.st === 'wl-serving' ? 'SERVING' : 'RE-QUEUE ↺'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="urgent-card">
          <div className="urgent-hdr"><h3>Urgent Care</h3><span className="urgent-blink">Active Monitoring</span></div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>HIGHEST PRIORITY</div>
          <div className="urgent-ticket">{URGENT_CASE.ticket}</div>
          <div className="urgent-patient">{URGENT_CASE.patient}</div>
          <button className="alert-doc-btn">🚨 ALERT DOCTOR</button>
          <div className="upcoming-list">
            <div className="upc-hdr">Upcoming Appointments</div>
            {URGENT_CASE.upcoming.map((u, i) => (
              <div className="upc-item" key={i}>
                <div className="upc-time">{u.time}</div>
                <div className="upc-name"><span className="upc-dot" style={{ background: '#4ade80' }}></span>{u.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function SettingsPage() {
  const [alerts, setAlerts] = useState({ newAppt: true, emergency: true, billing: false })
  const [mode, setMode] = useState('Light')
  const [fontSize, setFontSize] = useState('MEDIUM')
  const [defaultView, setDefaultView] = useState('Daily Schedule')

  return (
    <>
      <div className="page-hdr"><div><h2>System Settings</h2><p>Manage your clinical interface, profile, and notification preferences.</p></div></div>

      <div className="settings-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="profile-settings">
            <div className="ps-hdr"><h3>👤 Profile Settings</h3><button className="edit-btn">Edit Profile</button></div>
            <div className="profile-card">
              <div className="profile-avatar-big">S</div>
              <div>
                <div className="profile-field"><div className="pf-label">FULL NAME</div><div className="pf-val">Sarah Mitchell</div></div>
                <div className="profile-field"><div className="pf-label">WORK EMAIL</div><div className="pf-val link">s.mitchell@auraclinical.com</div></div>
              </div>
              <div>
                <div className="profile-field"><div className="pf-label">EMPLOYEE ID</div><div className="pf-val">AURA-2940-RM</div></div>
                <div className="profile-field"><div className="pf-label">DEPARTMENT</div><div className="pf-val"><span className="pf-badge">Front Desk Administration</span></div></div>
              </div>
            </div>
            <div className="change-pwd-row">
              <div className="cp-info"><div className="title">Change Password</div><div className="sub">Update your account security credentials</div></div>
              <button className="update-pwd-btn">Update Password</button>
            </div>
          </div>

          <div className="interface-prefs">
            <div className="ip-hdr"><h3>⚙️ Interface Preferences</h3></div>
            <div className="ip-row">
              <div>
                <div className="ip-label">Appearance Mode</div>
                <div className="mode-btns">
                  {['Light', 'Dark'].map(m => <button key={m} className={`mode-btn ${mode===m?'active':''}`} onClick={() => setMode(m)}>{m==='Light'?'☀️':'🌙'} {m}</button>)}
                </div>
              </div>
              <div>
                <div className="ip-label">Language</div>
                <select className="lang-sel"><option>English (US)</option><option>Español</option><option>Français</option></select>
              </div>
            </div>
            <div>
              <div className="ip-label">Font Size</div>
              <div className="font-size-btns">
                {['SMALL','MEDIUM','LARGE'].map(f => <button key={f} className={`fs-btn ${fontSize===f?'active':''}`} onClick={() => setFontSize(f)}>{f}</button>)}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="alerts-card">
            <h3>🔔 Alerts</h3>
            {[
              { key: 'newAppt', title: 'New Appointment', sub: 'Real-time web notifications' },
              { key: 'emergency', title: 'Emergency Alerts', sub: 'Priority SMS and Desktop' },
              { key: 'billing', title: 'Billing Reports', sub: 'Daily summary via email' },
            ].map(a => (
              <div className="alert-row" key={a.key}>
                <div className="ar-info"><div className="title">{a.title}</div><div className="sub">{a.sub}</div></div>
                <Toggle on={alerts[a.key]} onToggle={() => setAlerts(prev => ({ ...prev, [a.key]: !prev[a.key] }))} />
              </div>
            ))}
          </div>

          <div className="system-config-card">
            <h3>🏥 System Config</h3>
            <div className="sc-field">
              <div className="sc-label">ACTIVE BRANCH</div>
              <div className="sc-val">Northwest Medical Center<br/><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>3341 Clinica Way, Portland</span></div>
            </div>
            <div className="sc-field">
              <div className="sc-label">DEFAULT VIEW</div>
              {['Daily Schedule', 'Patient Queue'].map(v => (
                <div key={v} className={`radio-option ${defaultView===v?'selected':''}`} onClick={() => setDefaultView(v)}>
                  <span>{defaultView===v?'●':'○'}</span>{v}
                </div>
              ))}
            </div>

            <div className="data-audit-card">
              <div className="da-title">Data Audit</div>
              <div className="da-desc">Download your monthly activity and access logs for compliance reporting.</div>
              <button className="gen-log-btn">Generate Log</button>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <button className="discard-btn">Discard Changes</button>
        <button className="save-btn">Save All Preferences</button>
      </div>
    </>
  )
}

// ===================== MAIN APP =====================
export default function ReceptionistDashboard() {
  const [activeMenu, setActiveMenu] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const navigate = useNavigate()
  const { logout } = useAuth()

  // Fetch receptionist data from API
  const { 
    patients: apiPatients, 
    doctors: apiDoctors, 
    appointments: apiAppointments, 
    queueDepartments: apiQueueDepartments,
    recentActivity: apiRecentActivity,
    doctorStatus: apiDoctorStatus,
    appointmentSummary: apiAppointmentSummary,
    queueSummary: apiQueueSummary,
    loading, 
    error,
    refetch
  } = useReceptionistData()

  // Debug info
  useEffect(() => {
    console.log('🔧 ReceptionistDashboard mounted')
    console.log('📊 Data state:', { apiPatients, apiDoctors, apiAppointments, loading, error })
  }, [apiPatients, apiDoctors, apiAppointments, loading, error])

  // Use API data, with empty arrays as fallback initially
  const patientsData = apiPatients && apiPatients.length > 0 ? apiPatients : []
  const doctorsData = apiDoctors && apiDoctors.length > 0 ? apiDoctors : []
  const appointmentsData = apiAppointments && apiAppointments.length > 0 ? apiAppointments : []
  const queueDepartmentsData = apiQueueDepartments && apiQueueDepartments.length > 0 ? apiQueueDepartments : []
  const recentActivityData = apiRecentActivity && apiRecentActivity.length > 0 ? apiRecentActivity : []
  const doctorStatusData = apiDoctorStatus && apiDoctorStatus.length > 0 ? apiDoctorStatus : []

  const user = { fullName: 'Sarah Jenkins', role: 'Receptionist' }

  const handleLogout = async () => {
    try {
      await logout({ skipRequest: false })
      navigate('/dang-nhap', { replace: true })
    } catch (error) {
      console.error('Logout failed:', error)
      // Even if logout fails, redirect to login page
      navigate('/dang-nhap', { replace: true })
    }
  }

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
  }

  const handleSearchClear = () => {
    setSearchTerm('')
  }

  // Handler functions for appointment confirmations
  const handleConfirmAppointment = async (appointmentId, appointmentData) => {
    try {
      console.log('✓ Confirming appointment:', appointmentId)
      const response = await receptionistService.appointments.confirm(appointmentId)
      console.log('✓ Appointment confirmed:', response)
      
      // Refresh data
      if (refetch) {
        await refetch()
      }
      
      // Show success message
      alert('✓ Appointment confirmed successfully')
    } catch (error) {
      console.error('❌ Error confirming appointment:', error)
      alert('Failed to confirm appointment: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleDeclineAppointment = async (appointmentId, reason = 'Declined by receptionist') => {
    try {
      console.log('✗ Declining appointment:', appointmentId, reason)
      const response = await receptionistService.appointments.decline(appointmentId, reason)
      console.log('✗ Appointment declined:', response)
      
      // Refresh data
      if (refetch) {
        await refetch()
      }
      
      // Show success message
      alert('✗ Appointment declined successfully')
    } catch (error) {
      console.error('❌ Error declining appointment:', error)
      alert('Failed to decline appointment: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleNotificationToggle = () => {
    setShowNotifications(!showNotifications)
    setShowHelp(false)
    setShowUserMenu(false)
  }

  const handleHelpToggle = () => {
    setShowHelp(!showHelp)
    setShowNotifications(false)
    setShowUserMenu(false)
  }

  const handleUserMenuToggle = () => {
    setShowUserMenu(!showUserMenu)
    setShowNotifications(false)
    setShowHelp(false)
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
    { id: 'patients', label: 'Patients', icon: '👥' },
    { id: 'appointments', label: 'Appointments', icon: '📅' },
    { id: 'schedule', label: 'Doctor Schedules', icon: '⏰' },
    { id: 'queue', label: 'Queue', icon: '🎫' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ]

  const showTopTabs = activeMenu === 'schedule'
  const showCreateAppt = activeMenu === 'appointments'

  const pageTitle = {
    dashboard: { title: 'Clinical Curator', sub: 'Receptionist Portal' },
    patients: { title: 'Clinical Curator', sub: 'Receptionist Portal' },
    appointments: { title: 'Clinical Curator', sub: 'Receptionist Portal' },
    schedule: { title: 'Aura Clinical', sub: 'Reception Portal' },
    queue: { title: 'Clinical Curator', sub: 'Receptionist Portal' },
    settings: { title: 'Aura Clinical', sub: 'Reception Portal' },
  }[activeMenu]

  // Safeguard: Check if we're rendering properly
  if (!pageTitle) {
    console.error('❌ pageTitle is undefined!')
    return <div style={{ padding: '20px', color: 'red' }}>Error: pageTitle not found</div>
  }

  return (
    <>
      <style>{styles}</style>
      {/* Debug: Check if component is rendering */}
      <div style={{ position: 'fixed', top: 0, left: 0, background: '#f0f', color: 'white', padding: '5px', fontSize: '10px', zIndex: 99999, display: 'none' }}>
        ✓ Component loaded
      </div>
      <div className="app">
        <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
          <div className="sidebar-logo">
            <div className="logo-icon">⚕️</div>
            {sidebarOpen && <div><div className="logo-text">{pageTitle.title}</div><div className="logo-sub">{pageTitle.sub}</div></div>}
          </div>

          <nav className="sidebar-nav">
            {menuItems.map(item => (
              <button key={item.id} className={`nav-item ${activeMenu === item.id ? 'active' : ''}`} onClick={() => setActiveMenu(item.id)} title={item.label}>
                <span className="nav-icon">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            ))}
          </nav>

          {activeMenu !== 'settings' && (
            <div style={{ padding: '0 8px 12px' }}>
              <button className="check-in-btn">
                {sidebarOpen ? '＋ Check In Patient' : '＋'}
              </button>
            </div>
          )}

          {sidebarOpen && (
            <div className="sidebar-user">
              <div className="user-ava">{user.fullName[0]}</div>
              <div className="user-info"><div className="user-name">{user.fullName}</div><div className="user-role">{user.role}</div></div>
            </div>
          )}

          <div className="sidebar-footer-btns">
            <button className="footer-btn"><span>💬</span>{sidebarOpen && <span>Support</span>}</button>
            <button className="footer-btn logout" onClick={handleLogout}><span>🚪</span>{sidebarOpen && <span>Log Out</span>}</button>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
            <div className="topbar-title">
              <h1>{pageTitle.title}</h1>
              <p>{pageTitle.sub}</p>
            </div>

            {(activeMenu === 'schedule' || activeMenu === 'settings') && (
              <div className="topbar-center">
                <button className={`tbc-btn ${activeMenu==='schedule'?'active':''}`}>Doctor Directory</button>
                <button className="tbc-btn">Room Status</button>
              </div>
            )}

            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder={activeMenu === 'queue' ? 'Search patients or tickets...' : 'Search patients, doctors or appointments...'}
                value={searchTerm}
                onChange={handleSearchChange}
              />
              {searchTerm && (
                <div className="search-dropdown">
                  <SearchResults 
                    searchTerm={searchTerm} 
                    activeMenu={activeMenu}
                    patientsData={patientsData}
                    doctorsData={doctorsData}
                    appointmentsData={appointmentsData}
                  />
                </div>
              )}
            </div>

            <div className="topbar-right">
              {(activeMenu === 'schedule' || activeMenu === 'settings') && (
                <div className="emergency-alert">🔴 Emergency Alert</div>
              )}
              <div className="notification-wrapper">
                <button className="icon-btn" onClick={handleNotificationToggle}>🔔</button>
                {showNotifications && (
                  <NotificationPanel onClose={() => setShowNotifications(false)} />
                )}
              </div>
              <div className="help-wrapper">
                <button className="icon-btn" onClick={handleHelpToggle}>?</button>
                {showHelp && (
                  <HelpPanel onClose={() => setShowHelp(false)} />
                )}
              </div>
              <div className="user-profile-wrapper" onClick={handleUserMenuToggle}>
                <div className="topbar-user">
                  <div className="topbar-user-ava">{user.fullName[0]}</div>
                  <div className="topbar-user-info">
                    <div className="name">{user.fullName}</div>
                    <div className="role">M.R.N: 00:34</div>
                  </div>
                </div>
                {showUserMenu && (
                  <UserProfileMenu user={user} onLogout={handleLogout} />
                )}
              </div>
            </div>
          </header>

          <div className="content">
            {loading && !apiPatients.length && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 18, marginBottom: 10 }}>⏳ Loading data...</div>
                <div style={{ fontSize: 13 }}>Fetching latest information from server</div>
              </div>
            )}
            {error && (
              <div style={{ padding: '20px', background: '#fee2e2', borderRadius: 'var(--radius)', color: '#dc2626', marginBottom: '20px' }}>
                ⚠️ Error loading data: {error}
              </div>
            )}
            {activeMenu === 'dashboard' && <DashboardPage 
              appointments={appointmentsData} 
              doctors={doctorsData} 
              patients={patientsData}
              queueBoard={QUEUE_BOARD}
              doctorStatus={doctorStatusData}
              recentActivity={recentActivityData}
            />}
            {activeMenu === 'patients' && <PatientsPage patients={patientsData} appointmentSummary={apiAppointmentSummary} queueSummary={apiQueueSummary} />}
            {activeMenu === 'appointments' && <AppointmentsPage 
              appointments={appointmentsData} 
              doctors={doctorsData}
              patients={patientsData}
              onConfirm={handleConfirmAppointment}
              onDecline={handleDeclineAppointment}
              refetch={refetch}
            />}
            {activeMenu === 'schedule' && <DoctorSchedulesPage doctors={doctorsData} />}
            {activeMenu === 'queue' && <QueuePage queueDepartments={queueDepartmentsData} />}
            {activeMenu === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>
    </>
  )
}
