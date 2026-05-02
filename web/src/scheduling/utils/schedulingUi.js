export function getScheduleTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active') return 'green';
  if (normalized === 'published') return 'green';
  if (normalized === 'draft') return 'amber';
  if (normalized === 'completed') return 'blue';
  if (normalized === 'cancelled') return 'red';
  return 'slate';
}

export function getScheduleStatusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  const labels = {
    active: 'Đang mở',
    published: 'Đã công khai',
    draft: 'Bản nháp',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
  };
  return labels[normalized] || 'Không rõ';
}

export function getSlotTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'available') return 'green';
  if (normalized === 'booked') return 'blue';
  if (normalized === 'blocked') return 'red';
  return 'slate';
}

export function getSlotStatusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  const labels = {
    available: 'Còn trống',
    booked: 'Đã đặt',
    blocked: 'Đã khóa',
  };
  return labels[normalized] || 'Không rõ';
}

export function getPublishStatusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  const labels = {
    visible: 'Đang hiển thị',
    hidden: 'Đang ẩn',
  };
  return labels[normalized] || 'Không rõ';
}

export function getCalendarStatusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  const labels = {
    open: 'Đang mở',
    'near-full': 'Gần kín',
    full: 'Đã kín',
    cancelled: 'Đã hủy',
  };
  return labels[normalized] || 'Không rõ';
}

export function getUtilizationTone(value) {
  const number = Number(value || 0);
  if (number >= 95) return 'red';
  if (number >= 80) return 'amber';
  if (number <= 35) return 'blue';
  return 'green';
}

export function formatPercent(value) {
  return `${Math.round(Number(value || 0))}%`;
}

export function formatDate(value) {
  if (!value) return 'Chưa chọn';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}

const departmentNameMap = new Map([
  ['cardiology', 'Tim mạch'],
  ['tim mach', 'Tim mạch'],
  ['khoa tim mach', 'Tim mạch'],
  ['pediatrics', 'Nhi khoa'],
  ['pediatric', 'Nhi khoa'],
  ['nhi khoa', 'Nhi khoa'],
  ['khoa nhi', 'Nhi khoa'],
  ['orthopedics', 'Cơ xương khớp'],
  ['orthopedic', 'Cơ xương khớp'],
  ['orthopaedics', 'Cơ xương khớp'],
  ['co xuong khop', 'Cơ xương khớp'],
  ['khoa co xuong khop', 'Cơ xương khớp'],
  ['neurology', 'Thần kinh'],
  ['than kinh', 'Thần kinh'],
  ['khoa than kinh', 'Thần kinh'],
  ['general medicine', 'Nội tổng quát'],
  ['internal medicine', 'Nội tổng quát'],
  ['noi tong quat', 'Nội tổng quát'],
  ['khoa noi tong quat', 'Nội tổng quát'],
  ['dermatology', 'Da liễu'],
  ['da lieu', 'Da liễu'],
  ['khoa da lieu', 'Da liễu'],
]);

function normalizeDepartmentName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function translateDepartmentName(value) {
  const text = String(value || '').trim();
  if (!text) return 'Chưa xác định khoa';

  const normalized = normalizeDepartmentName(text);
  return departmentNameMap.get(normalized) || text;
}

export function buildSlotPreview({ start = '07:30', end = '11:30', duration = 15, breakMinutes = 0 }) {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const slots = [];
  const cursor = new Date(2026, 3, 24, startHour, startMinute);
  const limit = new Date(2026, 3, 24, endHour, endMinute);
  const step = Math.max(Number(duration || 15) + Number(breakMinutes || 0), 5);

  while (cursor < limit && slots.length < 48) {
    slots.push(
      cursor.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    );
    cursor.setMinutes(cursor.getMinutes() + step);
  }

  return slots;
}
