import { useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  List,
  MoreHorizontal,
  Plus,
  Settings,
  Sun,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSchedulingData } from '../context/SchedulingDataContext';

const calendarDoctors = [
  { id: 'all', name: 'Tất cả bác sĩ', avatar: '/images/scheduling/doctors/doctor-ai-fallback.png' },
  { id: 'dr-hai', name: 'BS. Trần Thanh Hải', avatar: '/images/scheduling/doctors/doctor-minh.svg' },
  { id: 'dr-lan', name: 'BS. Nguyễn Thị Lan', avatar: '/images/scheduling/doctors/doctor-lan.svg' },
  { id: 'dr-dat', name: 'BS. Nguyễn Thành Đạt', avatar: '/images/scheduling/doctors/doctor-khoa.svg' },
  { id: 'dr-hanh', name: 'BS. Đỗ Văn Hạnh', avatar: '/images/scheduling/doctors/doctor-hanh.svg' },
];

const calendarDepartments = [
  { id: 'all', name: 'Tất cả khoa' },
  { id: 'internal', name: 'Khoa Nội tổng hợp' },
  { id: 'cardiology', name: 'Khoa Tim mạch' },
  { id: 'pediatrics', name: 'Khoa Nhi' },
  { id: 'dermatology', name: 'Khoa Da liễu' },
];

const viewModes = [
  { id: 'day', label: 'Ngày', icon: CalendarDays },
  { id: 'week', label: 'Tuần', icon: CalendarCheck2 },
  { id: 'month', label: 'Tháng', icon: Calendar },
  { id: 'timeline', label: 'Timeline', icon: List },
];

const statusMeta = {
  all: { label: 'Tất cả', tone: 'all' },
  open: { label: 'Đang mở', tone: 'open' },
  booked: { label: 'Đã đặt', tone: 'booked' },
  near: { label: 'Gần kín', tone: 'near' },
  full: { label: 'Đã kín', tone: 'full' },
  cancelled: { label: 'Đã hủy', tone: 'cancelled' },
  blocked: { label: 'Đã khóa', tone: 'blocked' },
};

const timeRows = Array.from({ length: 11 }, (_, index) => 7 + index);
const slotRows = Array.from({ length: 22 }, (_, index) => index + 1);
const usageSeries = [
  ['07h', 76, 'open'],
  ['08h', 75, 'open'],
  ['09h', 56, 'open'],
  ['10h', 82, 'booked'],
  ['11h', 53, 'booked'],
  ['12h', 62, 'booked'],
  ['13h', 69, 'booked'],
  ['14h', 34, 'booked'],
  ['15h', 50, 'booked'],
  ['16h', 56, 'near'],
  ['17h', 31, 'near'],
];

const calendarAppointments = [
  { id: 'apt-1', day: 0, start: 3, span: 2, status: 'open', doctorId: 'dr-hai', departmentId: 'internal', patient: 'Trần Văn Nam', doctor: 'Trần Thanh Hải', time: '08:00 - 08:30', type: 'Khám tổng quát', booked: 2, total: 10 },
  { id: 'apt-2', day: 0, start: 5, span: 2, status: 'booked', doctorId: 'dr-lan', departmentId: 'internal', patient: 'Nguyễn Thị Lan', doctor: 'Nguyễn Thị Lan', time: '09:00 - 09:30', type: 'Đau đầu, chóng mặt', booked: 3, total: 10 },
  { id: 'apt-3', day: 0, start: 7, span: 2, status: 'near', doctorId: 'dr-hai', departmentId: 'internal', patient: 'Lê Minh Tuấn', doctor: 'Trần Thanh Hải', time: '10:00 - 10:30', type: 'Viêm họng', booked: 3, total: 10 },
  { id: 'apt-4', day: 0, start: 9, span: 2, status: 'booked', doctorId: 'dr-dat', departmentId: 'internal', patient: 'Phạm Thị Mai', doctor: 'Nguyễn Thành Đạt', time: '11:00 - 11:30', type: 'Khám định kỳ', booked: 4, total: 10 },
  { id: 'apt-5', day: 0, start: 14, span: 2, status: 'open', doctorId: 'dr-hanh', departmentId: 'internal', patient: 'Hoàng Văn Dũng', doctor: 'Đỗ Văn Hạnh', time: '13:30 - 14:00', type: 'Khám tổng quát', booked: 5, total: 10 },
  { id: 'apt-6', day: 0, start: 17, span: 2, status: 'near', doctorId: 'dr-lan', departmentId: 'cardiology', patient: 'Đỗ Thị Hương', doctor: 'Nguyễn Thị Lan', time: '15:00 - 15:30', type: 'Tiểu đường', booked: 6, total: 10 },
  { id: 'apt-7', day: 0, start: 19, span: 2, status: 'blocked', doctorId: 'dr-hai', departmentId: 'internal', patient: 'BLOCKED', doctor: 'Trần Thanh Hải', time: '16:00 - 17:00', type: 'Họp chuyên môn', booked: 0, total: 0 },
  { id: 'apt-8', day: 1, start: 4, span: 2, status: 'near', doctorId: 'dr-hai', departmentId: 'cardiology', patient: 'Võ Văn Hùng', doctor: 'Trần Thanh Hải', time: '08:30 - 09:00', type: 'Cao huyết áp', booked: 2, total: 10 },
  { id: 'apt-9', day: 1, start: 6, span: 2, status: 'booked', doctorId: 'dr-lan', departmentId: 'internal', patient: 'Bùi Thị Hoa', doctor: 'Nguyễn Thị Lan', time: '09:30 - 10:00', type: 'Đau dạ dày', booked: 3, total: 10 },
  { id: 'apt-10', day: 1, start: 10, span: 3, status: 'full', doctorId: 'dr-hanh', departmentId: 'internal', patient: 'ĐÃ KÍN', doctor: 'Đỗ Văn Hạnh', time: '11:30 - 12:00', type: '10/10 bệnh nhân', booked: 10, total: 10 },
  { id: 'apt-11', day: 1, start: 14, span: 2, status: 'near', doctorId: 'dr-lan', departmentId: 'cardiology', patient: 'Phùng Thị Hòa', doctor: 'Nguyễn Thị Lan', time: '13:00 - 13:30', type: 'Mờ màu cao', booked: 4, total: 10 },
  { id: 'apt-12', day: 1, start: 17, span: 2, status: 'booked', doctorId: 'dr-hanh', departmentId: 'internal', patient: 'Trịnh Văn Lâm', doctor: 'Đỗ Văn Hạnh', time: '14:30 - 15:00', type: 'Khám định kỳ', booked: 3, total: 10 },
  { id: 'apt-13', day: 1, start: 19, span: 2, status: 'open', doctorId: 'dr-dat', departmentId: 'internal', patient: 'Ngô Thị Bích', doctor: 'Nguyễn Thành Đạt', time: '15:30 - 16:00', type: 'Khám tổng quát', booked: 2, total: 10 },
  { id: 'apt-14', day: 2, start: 3, span: 2, status: 'open', doctorId: 'dr-dat', departmentId: 'internal', patient: 'Nguyễn Thành Đạt', doctor: 'Nguyễn Thành Đạt', time: '08:00 - 08:30', type: 'Khám tổng quát', booked: 2, total: 10 },
  { id: 'apt-15', day: 2, start: 5, span: 2, status: 'booked', doctorId: 'dr-lan', departmentId: 'internal', patient: 'Lý Thị Phương', doctor: 'Nguyễn Thị Lan', time: '09:00 - 09:30', type: 'Đau vai gáy', booked: 3, total: 10 },
  { id: 'apt-16', day: 2, start: 7, span: 2, status: 'near', doctorId: 'dr-hai', departmentId: 'cardiology', patient: 'Trần Quốc Bảo', doctor: 'Trần Thanh Hải', time: '10:00 - 10:30', type: 'Viêm xoang', booked: 4, total: 10 },
  { id: 'apt-17', day: 2, start: 9, span: 2, status: 'booked', doctorId: 'dr-lan', departmentId: 'internal', patient: 'Đặng Thị Nga', doctor: 'Nguyễn Thị Lan', time: '11:00 - 11:30', type: 'Khám định kỳ', booked: 3, total: 10 },
  { id: 'apt-18', day: 2, start: 11, span: 2, status: 'surgery', doctorId: 'dr-hai', departmentId: 'internal', patient: 'PHẪU THUẬT', doctor: 'Trần Thanh Hải', time: '12:00 - 13:00', type: 'Nội soi dạ dày', booked: 1, total: 1 },
  { id: 'apt-19', day: 2, start: 14, span: 2, status: 'open', doctorId: 'dr-hai', departmentId: 'internal', patient: 'Hoàng Văn Hải', doctor: 'Trần Thanh Hải', time: '13:30 - 14:00', type: 'Khám tổng quát', booked: 2, total: 10 },
  { id: 'apt-20', day: 2, start: 16, span: 2, status: 'booked', doctorId: 'dr-hanh', departmentId: 'internal', patient: 'Phạm Quang Huy', doctor: 'Đỗ Văn Hạnh', time: '14:30 - 15:00', type: 'Đau lưng', booked: 2, total: 10 },
  { id: 'apt-21', day: 2, start: 18, span: 2, status: 'near', doctorId: 'dr-lan', departmentId: 'cardiology', patient: 'Trần Thị Kim', doctor: 'Nguyễn Thị Lan', time: '15:30 - 16:00', type: 'Thyroid', booked: 2, total: 10 },
  { id: 'apt-22', day: 2, start: 20, span: 2, status: 'blocked', doctorId: 'dr-hai', departmentId: 'internal', patient: 'BLOCKED', doctor: 'Trần Thanh Hải', time: '16:30 - 17:30', type: 'Đào tạo nội bộ', booked: 0, total: 0 },
  { id: 'apt-23', day: 3, start: 4, span: 2, status: 'near', doctorId: 'dr-hai', departmentId: 'internal', patient: 'Phạm Văn Cường', doctor: 'Trần Thanh Hải', time: '08:30 - 09:00', type: 'Gout', booked: 2, total: 10 },
  { id: 'apt-24', day: 3, start: 6, span: 2, status: 'booked', doctorId: 'dr-lan', departmentId: 'internal', patient: 'Nguyễn Thị Hạnh', doctor: 'Nguyễn Thị Lan', time: '09:30 - 10:00', type: 'Đau đầu', booked: 3, total: 10 },
  { id: 'apt-25', day: 3, start: 8, span: 2, status: 'open', doctorId: 'dr-hanh', departmentId: 'internal', patient: 'Lê Trung Kiên', doctor: 'Đỗ Văn Hạnh', time: '10:30 - 11:00', type: 'Khám tổng quát', booked: 4, total: 10 },
  { id: 'apt-26', day: 3, start: 10, span: 2, status: 'booked', doctorId: 'dr-dat', departmentId: 'internal', patient: 'Nguyễn Thị Thảo', doctor: 'Nguyễn Thành Đạt', time: '11:30 - 12:00', type: 'Khám định kỳ', booked: 2, total: 10 },
  { id: 'apt-27', day: 3, start: 14, span: 2, status: 'open', doctorId: 'dr-hai', departmentId: 'internal', patient: 'Võ Thị Thanh', doctor: 'Trần Thanh Hải', time: '13:30 - 14:00', type: 'Khám tổng quát', booked: 3, total: 10 },
  { id: 'apt-28', day: 3, start: 16, span: 2, status: 'booked', doctorId: 'dr-hanh', departmentId: 'internal', patient: 'Đỗ Văn Mạnh', doctor: 'Đỗ Văn Hạnh', time: '14:30 - 15:00', type: 'Khám định kỳ', booked: 2, total: 10 },
  { id: 'apt-29', day: 4, start: 3, span: 2, status: 'open', doctorId: 'dr-hanh', departmentId: 'internal', patient: 'Bạch Văn Dương', doctor: 'Đỗ Văn Hạnh', time: '08:00 - 08:30', type: 'Khám tổng quát', booked: 1, total: 10 },
  { id: 'apt-30', day: 4, start: 5, span: 2, status: 'booked', doctorId: 'dr-lan', departmentId: 'cardiology', patient: 'Đinh Thị Liên', doctor: 'Nguyễn Thị Lan', time: '09:00 - 09:30', type: 'Đau dạ dày', booked: 3, total: 10 },
  { id: 'apt-31', day: 4, start: 7, span: 2, status: 'near', doctorId: 'dr-hai', departmentId: 'internal', patient: 'Hà Văn Toàn', doctor: 'Trần Thanh Hải', time: '10:00 - 10:30', type: 'Cao huyết áp', booked: 4, total: 10 },
  { id: 'apt-32', day: 4, start: 9, span: 2, status: 'booked', doctorId: 'dr-dat', departmentId: 'internal', patient: 'Phạm Thị Hiền', doctor: 'Nguyễn Thành Đạt', time: '11:00 - 11:30', type: 'Đau vai gáy', booked: 2, total: 10 },
  { id: 'apt-33', day: 4, start: 14, span: 2, status: 'open', doctorId: 'dr-hanh', departmentId: 'internal', patient: 'Võ Văn Tài', doctor: 'Đỗ Văn Hạnh', time: '13:30 - 14:00', type: 'Khám tổng quát', booked: 2, total: 10 },
  { id: 'apt-34', day: 4, start: 16, span: 2, status: 'near', doctorId: 'dr-hai', departmentId: 'cardiology', patient: 'Lưu Thị Mai', doctor: 'Trần Thanh Hải', time: '14:30 - 15:00', type: 'Tiểu đường', booked: 1, total: 10 },
  { id: 'apt-35', day: 4, start: 18, span: 2, status: 'booked', doctorId: 'dr-lan', departmentId: 'internal', patient: 'Nguyễn Văn Quý', doctor: 'Nguyễn Thị Lan', time: '15:30 - 16:00', type: 'Khám định kỳ', booked: 2, total: 10 },
  { id: 'apt-36', day: 5, start: 3, span: 4, status: 'full', doctorId: 'dr-lan', departmentId: 'internal', patient: 'ĐÃ KÍN', doctor: 'Nguyễn Thị Lan', time: '08:00 - 10:00', type: '20/20 bệnh nhân', booked: 20, total: 20 },
  { id: 'apt-37', day: 5, start: 8, span: 2, status: 'open', doctorId: 'dr-dat', departmentId: 'internal', patient: 'Nguyễn Tiến Đạt', doctor: 'Nguyễn Thành Đạt', time: '10:15 - 10:45', type: 'Khám tổng quát', booked: 2, total: 10 },
];

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function formatRangeDate(date) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatCompactDate(date) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
}

function getStatusCount(events, status) {
  if (status === 'all') {
    return events.length;
  }

  return events.filter((event) => event.status === status).length;
}

function getGridRow(event) {
  return `${event.start} / span ${event.span}`;
}

export function SchedulingCalendarPage() {
  const { departments, doctors, error } = useSchedulingData();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('week');
  const [selectedDoctor, setSelectedDoctor] = useState('dr-hai');
  const [selectedDepartment, setSelectedDepartment] = useState('internal');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [weekStart, setWeekStart] = useState(() => new Date(2026, 3, 22));
  const [selectedDay, setSelectedDay] = useState(2);
  const [selectedAppointment, setSelectedAppointment] = useState(calendarAppointments[13]);
  const [actionMessage, setActionMessage] = useState('');

  const doctorOptions = useMemo(() => {
    const mappedDoctors = doctors.map((doctor) => ({
      id: doctor.id,
      name: doctor.name,
      avatar: '/images/scheduling/doctors/doctor-ai-fallback.png',
    }));
    const merged = [...calendarDoctors, ...mappedDoctors];
    return merged.filter((doctor, index) => merged.findIndex((item) => item.id === doctor.id) === index);
  }, [doctors]);

  const departmentOptions = useMemo(() => {
    const mappedDepartments = departments.map((department) => ({ id: department.id, name: department.name }));
    const merged = [...calendarDepartments, ...mappedDepartments];
    return merged.filter((department, index) => merged.findIndex((item) => item.id === department.id) === index);
  }, [departments]);

  const weekDays = useMemo(() => {
    const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    return labels.map((label, index) => {
      const date = addDays(weekStart, index);
      return {
        date,
        index,
        label,
        dateLabel: formatCompactDate(date),
        fullDate: formatRangeDate(date),
      };
    });
  }, [weekStart]);

  const visibleDays = viewMode === 'day' ? weekDays.filter((day) => day.index === selectedDay) : weekDays;
  const visibleDayIndexes = new Set(visibleDays.map((day) => day.index));
  const selectedDoctorInfo = doctorOptions.find((doctor) => doctor.id === selectedDoctor) || doctorOptions[0];
  const selectedDayInfo = weekDays.find((day) => day.index === selectedDay) || weekDays[2];
  const dayOffColumn = visibleDays.findIndex((day) => day.index === 6);

  const filteredAppointments = calendarAppointments.filter((appointment) => {
    const matchesDay = visibleDayIndexes.has(appointment.day);
    const matchesDoctor = selectedDoctor === 'all' || appointment.doctorId === selectedDoctor;
    const matchesDepartment = selectedDepartment === 'all' || appointment.departmentId === selectedDepartment;
    const matchesStatus = selectedStatus === 'all' || appointment.status === selectedStatus;

    return matchesDay && matchesDoctor && matchesDepartment && matchesStatus;
  });

  const allVisibleAppointments = calendarAppointments.filter((appointment) => visibleDayIndexes.has(appointment.day));
  const selectedDayAppointments = calendarAppointments.filter((appointment) => appointment.day === selectedDay);
  const dayTotalSlots = selectedDayAppointments.reduce((sum, appointment) => sum + appointment.total, 0);
  const dayBookedSlots = selectedDayAppointments.reduce((sum, appointment) => sum + appointment.booked, 0);
  const dayAvailableSlots = Math.max(0, dayTotalSlots - dayBookedSlots);
  const weekTotalSlots = calendarAppointments.reduce((sum, appointment) => sum + appointment.total, 0);
  const weekBookedSlots = calendarAppointments.reduce((sum, appointment) => sum + appointment.booked, 0);
  const weekAvailableSlots = Math.max(0, weekTotalSlots - weekBookedSlots);
  const weekNearCount = calendarAppointments.filter((appointment) => appointment.status === 'near').length;
  const weekFullCount = calendarAppointments.filter((appointment) => appointment.status === 'full').length;
  const weekCancelledCount = calendarAppointments.filter((appointment) => appointment.status === 'cancelled').length;
  const utilization = Math.round((weekBookedSlots / Math.max(1, weekTotalSlots)) * 100);

  function moveDate(direction) {
    const amount = viewMode === 'day' ? direction : direction * 7;
    setWeekStart((current) => addDays(current, amount));
    setActionMessage(direction > 0 ? 'Đã chuyển sang khoảng lịch tiếp theo.' : 'Đã quay về khoảng lịch trước.');
  }

  function chooseAppointment(appointment) {
    setSelectedAppointment(appointment);
    setSelectedDay(appointment.day);
    setActionMessage(`Đã chọn ${appointment.patient} lúc ${appointment.time}.`);
  }

  function handleToday() {
    setWeekStart(new Date(2026, 3, 22));
    setSelectedDay(2);
    setActionMessage('Đã quay về tuần hiện tại 22 - 28/04/2026.');
  }

  return (
    <section className="visual-calendar-page">
      <div className="visual-calendar-breadcrumb">
        <span>Trang chủ</span>
        <ChevronRight size={13} aria-hidden="true" />
        <span>Lịch khám</span>
        <ChevronRight size={13} aria-hidden="true" />
        <strong>Lịch trực quan</strong>
      </div>

      {error || actionMessage ? (
        <div className={`visual-calendar-alert ${error ? 'is-warning' : 'is-success'}`}>
          <strong>{error ? 'Thông báo máy chủ' : 'Cập nhật lịch'}</strong>
          <span>{error || actionMessage}</span>
        </div>
      ) : null}

      <div className="visual-calendar-topbar">
        <label className="visual-calendar-select-card">
          <span>Bác sĩ</span>
          <div>
            <img src={selectedDoctorInfo.avatar} alt="" />
            <select value={selectedDoctor} onChange={(event) => setSelectedDoctor(event.target.value)}>
              {doctorOptions.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        </label>

        <label className="visual-calendar-select-card">
          <span>Khoa</span>
          <div>
            <Building2 size={19} aria-hidden="true" />
            <select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)}>
              {departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        </label>

        <label className="visual-calendar-select-card">
          <span>Chế độ xem</span>
          <div>
            <CalendarCheck2 size={19} aria-hidden="true" />
            <select value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
              {viewModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        </label>

        <div className="visual-calendar-date-nav">
          <button type="button" aria-label="Khoảng trước" onClick={() => moveDate(-1)}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <strong>
            {viewMode === 'day'
              ? visibleDays[0]?.fullDate
              : `${formatCompactDate(weekDays[0].date)} - ${formatRangeDate(weekDays[6].date)}`}
          </strong>
          <button type="button" aria-label="Khoảng sau" onClick={() => moveDate(1)}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>

        <button type="button" className="visual-calendar-soft-button" onClick={handleToday}>Hôm nay</button>
        <button type="button" className="visual-calendar-create-button" onClick={() => navigate('/scheduling/create')}>
          <Plus size={18} aria-hidden="true" />
          Tạo lịch
        </button>
        <button type="button" className="visual-calendar-icon-button" aria-label="Thêm tùy chọn" onClick={() => setActionMessage('Đã mở menu tùy chọn lịch trực quan.')}>
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="visual-calendar-status-row">
        {Object.entries(statusMeta).map(([status, meta]) => (
          <button
            key={status}
            type="button"
            className={`is-${meta.tone} ${selectedStatus === status ? 'is-active' : ''}`}
            onClick={() => setSelectedStatus(status)}
          >
            <i aria-hidden="true" />
            {meta.label}
            <strong>{getStatusCount(allVisibleAppointments, status)}</strong>
          </button>
        ))}
        <div className="visual-calendar-view-tabs">
          {viewModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button key={mode.id} type="button" className={viewMode === mode.id ? 'is-active' : ''} onClick={() => setViewMode(mode.id)}>
                <Icon size={15} aria-hidden="true" />
                {mode.label}
              </button>
            );
          })}
          <button type="button" aria-label="Cài đặt lịch" onClick={() => setActionMessage('Đã mở cài đặt hiển thị lịch.')}>
            <Settings size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="visual-calendar-layout">
        <main className="visual-calendar-main-card">
          {viewMode === 'timeline' ? (
            <div className="visual-calendar-timeline-view">
              {filteredAppointments.map((appointment) => (
                <button key={appointment.id} type="button" className={`is-${appointment.status}`} onClick={() => chooseAppointment(appointment)}>
                  <span>{appointment.time}</span>
                  <strong>{appointment.patient}</strong>
                  <small>{appointment.type} · {appointment.doctor}</small>
                  <em>{statusMeta[appointment.status]?.label || 'Lịch'}</em>
                </button>
              ))}
            </div>
          ) : (
            <div
              className={`visual-calendar-grid-shell is-${viewMode}`}
              style={{ '--calendar-columns': visibleDays.length, '--calendar-min-width': `${56 + visibleDays.length * 150}px` }}
            >
              <div className="visual-calendar-week-header">
                <span />
                {visibleDays.map((day) => (
                  <button
                    key={day.index}
                    type="button"
                    className={selectedDay === day.index ? 'is-selected' : ''}
                    onClick={() => setSelectedDay(day.index)}
                  >
                    <strong>{day.label}</strong>
                    <small>{day.dateLabel}</small>
                    {day.index === 2 ? <em>24</em> : null}
                  </button>
                ))}
              </div>

              <div className="visual-calendar-grid">
                {timeRows.map((hour, index) => (
                  <span key={hour} className="visual-calendar-time" style={{ gridRow: `${index * 2 + 1} / span 2` }}>
                    {String(hour).padStart(2, '0')}:00
                  </span>
                ))}
                {visibleDays.flatMap((day, dayPosition) =>
                  slotRows.map((row) => (
                    <button
                      key={`${day.index}-${row}`}
                      type="button"
                      className="visual-calendar-slot-cell"
                      style={{ gridColumn: dayPosition + 2, gridRow: row }}
                      aria-label={`${day.label} hàng ${row}`}
                      onClick={() => {
                        setSelectedDay(day.index);
                        setActionMessage(`Đã chọn ô trống ${day.label} ${day.dateLabel}.`);
                      }}
                    />
                  )),
                )}
                <div className="visual-calendar-now-line" style={{ gridRow: '11', gridColumn: '1 / -1' }}><i /></div>
                {viewMode !== 'day' && dayOffColumn >= 0 ? (
                  <div className="visual-calendar-day-off" style={{ gridColumn: dayOffColumn + 2, gridRow: '1 / -1' }}>
                    <Sun size={35} aria-hidden="true" />
                    <strong>Ngày nghỉ</strong>
                  </div>
                ) : null}
                {filteredAppointments.map((appointment) => {
                  const dayPosition = visibleDays.findIndex((day) => day.index === appointment.day);
                  if (dayPosition < 0) return null;

                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      className={`visual-calendar-appointment is-${appointment.status} ${selectedAppointment?.id === appointment.id ? 'is-selected' : ''}`}
                      style={{ gridColumn: dayPosition + 2, gridRow: getGridRow(appointment) }}
                      onClick={() => chooseAppointment(appointment)}
                    >
                      <strong>{appointment.time}</strong>
                      <span>{appointment.patient}</span>
                      <small>{appointment.type}</small>
                      {appointment.total > 0 ? <em>{appointment.booked}/{appointment.total}</em> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        <aside className="visual-calendar-sidebar">
          <section className="visual-calendar-day-info">
            <div className="visual-calendar-side-title">
              <strong>Thông tin ngày</strong>
              <Sun size={24} aria-hidden="true" />
            </div>
            <h2>{selectedDayInfo?.label}, {selectedDayInfo?.fullDate}</h2>
            <div className="visual-calendar-day-stats">
              <article><span>Tổng slot</span><strong>{dayTotalSlots}</strong></article>
              <article><span>Đã đặt</span><strong>{dayBookedSlots}</strong></article>
              <article className="is-open"><span>Còn trống</span><strong>{dayAvailableSlots}</strong></article>
              <article className="is-near"><span>Gần kín</span><strong>{selectedDayAppointments.filter((item) => item.status === 'near').length}</strong></article>
              <article className="is-full"><span>Đã kín</span><strong>{selectedDayAppointments.filter((item) => item.status === 'full').length}</strong></article>
              <article className="is-cancelled"><span>Đã hủy</span><strong>{selectedDayAppointments.filter((item) => item.status === 'cancelled').length}</strong></article>
            </div>
          </section>

          <section className="visual-calendar-chart-card">
            <div className="visual-calendar-side-title">
              <strong>Biểu đồ sử dụng trong ngày</strong>
              <button type="button">Theo giờ <ChevronDown size={13} aria-hidden="true" /></button>
            </div>
            <div className="visual-calendar-bars">
              {usageSeries.map(([label, value, tone]) => (
                <div key={label}>
                  <i className={`is-${tone}`} style={{ height: `${value}%` }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="visual-calendar-upcoming">
            <div className="visual-calendar-side-title">
              <strong>Lịch sắp tới</strong>
              <button type="button" onClick={() => setActionMessage('Đã mở toàn bộ lịch sắp tới.')}>Xem tất cả</button>
            </div>
            {selectedDayAppointments.slice(0, 4).map((appointment, index) => (
              <button key={appointment.id} type="button" onClick={() => chooseAppointment(appointment)}>
                <time>{appointment.time.slice(0, 5)}</time>
                <span>
                  <strong>{appointment.patient}</strong>
                  <small>{appointment.type}</small>
                </span>
                <em>{index === 0 ? '2 phút trước' : index === 1 ? '15 phút trước' : `${index} giờ trước`}</em>
              </button>
            ))}
          </section>

          <section className="visual-calendar-quick-actions">
            <div className="visual-calendar-side-title">
              <strong>Thao tác nhanh</strong>
            </div>
            <div>
              <button type="button" onClick={() => navigate('/scheduling/create')}><CalendarPlus size={18} aria-hidden="true" /><span>Tạo lịch nhanh</span></button>
              <button type="button" onClick={() => navigate('/scheduling/bulk-create')}><CalendarCheck2 size={18} aria-hidden="true" /><span>Tạo lịch hàng loạt</span></button>
              <button
                type="button"
                onClick={() => setActionMessage(
                  selectedAppointment
                    ? `Đã tạo bản sao lịch ${selectedAppointment.patient} lúc ${selectedAppointment.time}.`
                    : 'Vui lòng chọn một lịch trước khi nhân bản.',
                )}
              >
                <Copy size={18} aria-hidden="true" />
                <span>Nhân bản lịch</span>
              </button>
              <button type="button" onClick={() => setActionMessage('Đã mở chức năng import Excel.')}>
                <FileSpreadsheet size={18} aria-hidden="true" />
                <span>Import Excel</span>
              </button>
            </div>
          </section>
        </aside>
      </div>

      <div className="visual-calendar-bottom-summary">
        <section>
          <strong>Tổng quan tuần này</strong>
          <div><span>Tổng slot</span><b>{weekTotalSlots}</b></div>
          <div><i className="is-booked" /><span>Đã đặt</span><b>{weekBookedSlots} ({utilization}%)</b></div>
          <div><i className="is-open" /><span>Còn trống</span><b>{weekAvailableSlots}</b></div>
          <div><i className="is-near" /><span>Gần kín</span><b>{weekNearCount}</b></div>
          <div><i className="is-full" /><span>Đã kín</span><b>{weekFullCount}</b></div>
          <div><i className="is-cancelled" /><span>Đã hủy</span><b>{weekCancelledCount}</b></div>
        </section>
        <aside>
          <span>Tỷ lệ sử dụng</span>
          <strong>{utilization}%</strong>
          <div style={{ '--usage': `${utilization * 3.6}deg` }} />
          <ChevronRight size={18} aria-hidden="true" />
        </aside>
      </div>
    </section>
  );
}
