import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Building2,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  LockKeyhole,
  MapPin,
  MoreVertical,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Star,
  Stethoscope,
  Timer,
  TrendingUp,
  UserRound,
  UsersRound,
  Video,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSchedulingData } from '../context/SchedulingDataContext';

const doctorProfiles = {
  'dr-minh': {
    displayName: 'PGS.TS. Nguyễn Hoàng Minh',
    department: 'Nội tổng quát',
    title: 'Trưởng đơn vị Nội tổng quát',
    avatar: '/images/scheduling/doctors/doctor-minh.svg',
    room: 'P.302 - Nội tổng quát 1',
    workTime: '07:30 - 17:00',
    experience: '18 năm',
    certificate: '05',
    rating: '4.9/5',
    reviews: 312,
    patientsWeek: 152,
    fillRate: 70,
    noShow: '4.3%',
    avgTime: '18 phút',
    peakTime: '09:00 - 11:00',
    satisfaction: '4.9/5',
    telehealth: 6,
    specialties: ['Nội tổng quát', 'Tiêu hóa', 'Theo dõi mạn tính'],
  },
  'dr-lan': {
    displayName: 'TS.BS. Trần Thùy Lan',
    department: 'Tim mạch',
    title: 'Bác sĩ Tim mạch can thiệp',
    avatar: '/images/scheduling/doctors/doctor-lan.svg',
    room: 'P.208 - Tim mạch 2',
    workTime: '08:00 - 17:30',
    experience: '16 năm',
    certificate: '07',
    rating: '4.8/5',
    reviews: 284,
    patientsWeek: 136,
    fillRate: 84,
    noShow: '3.8%',
    avgTime: '20 phút',
    peakTime: '08:30 - 10:30',
    satisfaction: '4.8/5',
    telehealth: 4,
    specialties: ['Tim mạch', 'Tăng huyết áp', 'Rối loạn nhịp'],
  },
  'dr-khoa': {
    displayName: 'BS.CKII. Phạm Anh Khoa',
    department: 'Nhi khoa',
    title: 'Bác sĩ Nhi tổng quát',
    avatar: '/images/scheduling/doctors/doctor-khoa.svg',
    room: 'P.115 - Nhi khoa 1',
    workTime: '07:30 - 16:30',
    experience: '11 năm',
    certificate: '04',
    rating: '4.7/5',
    reviews: 198,
    patientsWeek: 118,
    fillRate: 62,
    noShow: '5.1%',
    avgTime: '16 phút',
    peakTime: '15:00 - 17:00',
    satisfaction: '4.7/5',
    telehealth: 3,
    specialties: ['Nhi tổng quát', 'Dinh dưỡng', 'Hô hấp nhi'],
  },
  'dr-hanh': {
    displayName: 'ThS.BS. Lê Ngọc Hạnh',
    department: 'Da liễu',
    title: 'Bác sĩ Da liễu thẩm mỹ',
    avatar: '/images/scheduling/doctors/doctor-hanh.svg',
    room: 'P.410 - Da liễu',
    workTime: '08:00 - 15:30',
    experience: '10 năm',
    certificate: '03',
    rating: '4.8/5',
    reviews: 176,
    patientsWeek: 94,
    fillRate: 48,
    noShow: '2.9%',
    avgTime: '14 phút',
    peakTime: '13:30 - 15:30',
    satisfaction: '4.8/5',
    telehealth: 8,
    specialties: ['Da liễu', 'Dị ứng', 'Chăm sóc da'],
  },
  'dr-quang': {
    displayName: 'BS. Võ Minh Quang',
    department: 'Cơ xương khớp',
    title: 'Bác sĩ Cơ xương khớp',
    avatar: '/images/scheduling/doctors/doctor-quang.svg',
    room: 'P.506 - Cơ xương khớp',
    workTime: '07:30 - 18:00',
    experience: '14 năm',
    certificate: '06',
    rating: '4.7/5',
    reviews: 221,
    patientsWeek: 121,
    fillRate: 73,
    noShow: '4.8%',
    avgTime: '19 phút',
    peakTime: '10:00 - 12:00',
    satisfaction: '4.7/5',
    telehealth: 5,
    specialties: ['Cơ xương khớp', 'Đau mạn tính', 'Phục hồi vận động'],
  },
};

const fallbackProfile = {
  avatar: '/images/scheduling/doctors/doctor-ai-fallback.png',
  room: 'P.201 - Phòng khám chuyên khoa',
  workTime: '07:30 - 17:00',
  experience: '12 năm',
  certificate: '03',
  rating: '4.7/5',
  reviews: 120,
  patientsWeek: 96,
  fillRate: 68,
  noShow: '4.6%',
  avgTime: '18 phút',
  peakTime: '09:00 - 11:00',
  satisfaction: '4.7/5',
  telehealth: 4,
  specialties: ['Khám chuyên khoa', 'Tái khám', 'Tư vấn online'],
};

const weekStart = new Date(2026, 3, 27);
const weekDayLabels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const timeMarkers = ['07:30', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const viewTabs = [
  { id: 'week', label: 'Lịch tuần', icon: CalendarDays },
  { id: 'day', label: 'Lịch ngày', icon: Clock3 },
  { id: 'capacity', label: 'Công suất', icon: Activity },
  { id: 'patients', label: 'Bệnh nhân', icon: UsersRound },
  { id: 'activity', label: 'Hoạt động', icon: ClipboardList },
];

const baseWeeklyEvents = [
  { id: 'mon-1', day: 0, row: 2, span: 2, title: 'Khám thường', time: '08:00 - 10:00', booked: 8, total: 8, tone: 'clinic', badge: 'Sáng' },
  { id: 'mon-2', day: 0, row: 4, span: 2, title: 'Tái khám', time: '10:15 - 12:00', booked: 5, total: 6, tone: 'follow', badge: 'Ưu tiên' },
  { id: 'mon-3', day: 0, row: 8, span: 2, title: 'Telehealth', time: '13:30 - 14:30', booked: 2, total: 4, tone: 'online', badge: 'Online' },
  { id: 'mon-4', day: 0, row: 10, span: 2, title: 'Khám thường', time: '15:00 - 17:00', booked: 7, total: 8, tone: 'clinic', badge: 'Chiều' },
  { id: 'tue-1', day: 1, row: 2, span: 3, title: 'Phẫu thuật', time: '08:00 - 12:00', booked: 4, total: 4, tone: 'surgery', badge: 'Phòng mổ' },
  { id: 'tue-2', day: 1, row: 7, span: 2, title: 'Tái khám', time: '13:30 - 15:30', booked: 4, total: 6, tone: 'follow', badge: 'Gần đây' },
  { id: 'tue-3', day: 1, row: 10, span: 2, title: 'Còn trống', time: '15:45 - 17:00', booked: 0, total: 4, tone: 'empty', badge: 'Mở' },
  { id: 'wed-1', day: 2, row: 2, span: 2, title: 'Khám thường', time: '08:00 - 10:00', booked: 6, total: 8, tone: 'clinic', badge: 'Gần đầy' },
  { id: 'wed-2', day: 2, row: 4, span: 2, title: 'Tái khám', time: '10:15 - 12:00', booked: 5, total: 5, tone: 'follow', badge: 'Đầy' },
  { id: 'wed-3', day: 2, row: 8, span: 2, title: 'Telehealth', time: '13:30 - 14:30', booked: 3, total: 4, tone: 'online', badge: 'Online' },
  { id: 'wed-4', day: 2, row: 10, span: 2, title: 'Khám thường', time: '15:00 - 17:00', booked: 6, total: 8, tone: 'clinic', badge: 'Chiều' },
  { id: 'thu-1', day: 3, row: 2, span: 2, title: 'Khám thường', time: '08:00 - 10:00', booked: 8, total: 8, tone: 'clinic', badge: 'Hôm nay' },
  { id: 'thu-2', day: 3, row: 4, span: 2, title: 'Tái khám', time: '10:15 - 12:00', booked: 5, total: 6, tone: 'follow', badge: 'Đã xác nhận' },
  { id: 'thu-3', day: 3, row: 6, span: 1, title: 'Nghỉ trưa', time: '12:00 - 13:30', booked: 0, total: 0, tone: 'blocked', badge: 'Khóa' },
  { id: 'thu-4', day: 3, row: 8, span: 2, title: 'Telehealth', time: '13:30 - 14:30', booked: 3, total: 4, tone: 'online', badge: 'Online' },
  { id: 'thu-5', day: 3, row: 10, span: 2, title: 'Còn trống', time: '15:00 - 16:30', booked: 0, total: 5, tone: 'empty', badge: 'Mở' },
  { id: 'fri-1', day: 4, row: 2, span: 2, title: 'Khám thường', time: '08:00 - 10:00', booked: 6, total: 8, tone: 'clinic', badge: 'Sáng' },
  { id: 'fri-2', day: 4, row: 4, span: 2, title: 'Phẫu thuật', time: '10:15 - 12:00', booked: 4, total: 4, tone: 'surgery', badge: 'Ưu tiên' },
  { id: 'fri-3', day: 4, row: 8, span: 1, title: 'Blocked', time: '13:30 - 15:00', booked: 0, total: 0, tone: 'blocked', badge: 'Họp' },
  { id: 'fri-4', day: 4, row: 10, span: 2, title: 'Tái khám', time: '15:00 - 17:00', booked: 5, total: 6, tone: 'follow', badge: 'Chiều' },
  { id: 'sat-1', day: 5, row: 2, span: 2, title: 'Khám thường', time: '08:00 - 11:00', booked: 10, total: 12, tone: 'clinic', badge: 'Gần đầy' },
  { id: 'sat-2', day: 5, row: 6, span: 2, title: 'Telehealth', time: '11:15 - 12:15', booked: 2, total: 4, tone: 'online', badge: 'Online' },
  { id: 'sat-3', day: 5, row: 9, span: 3, title: 'Còn trống', time: '13:30 - 17:00', booked: 0, total: 8, tone: 'empty', badge: 'Mở thêm' },
];

const appointmentsToday = [
  { time: '08:00', patient: 'Nguyễn Văn An', meta: 'Khám thường - Nam, 45 tuổi', status: 'Đã xác nhận', tone: 'confirmed' },
  { time: '09:00', patient: 'Trần Thị Mai', meta: 'Tái khám - Nữ, 52 tuổi', status: 'Đang chờ', tone: 'waiting' },
  { time: '10:15', patient: 'Lê Minh Đức', meta: 'Khám thường - Nam, 38 tuổi', status: 'Đang chờ', tone: 'waiting' },
  { time: '13:30', patient: 'Telehealth - Phạm Thu Hoa', meta: 'Tư vấn online - Nữ, 29 tuổi', status: 'Đã xác nhận', tone: 'confirmed' },
];

const hourlyLoad = [
  ['07h', 13, 18],
  ['08h', 22, 28],
  ['09h', 26, 31],
  ['10h', 18, 26],
  ['11h', 30, 34],
  ['12h', 15, 22],
  ['13h', 21, 28],
  ['14h', 17, 24],
  ['15h', 23, 29],
  ['16h', 16, 22],
  ['17h', 13, 18],
];

function formatDate(value) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(value);
}

function getWeekDays() {
  return weekDayLabels.map((label, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return { label, date, dateLabel: formatDate(date), index, isToday: index === 0 };
  });
}

function getLoadTone(load) {
  if (load >= 94) return 'critical';
  if (load >= 78) return 'busy';
  if (load <= 45) return 'light';
  return 'normal';
}

function getLoadLabel(load) {
  if (load >= 94) return 'Đã kín';
  if (load >= 78) return 'Gần kín';
  if (load <= 45) return 'Còn nhiều';
  return 'Đang làm việc';
}

function hashId(value = '') {
  return String(value)
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0);
}

function createWeeklyEvents(doctorId) {
  const offset = hashId(doctorId) % 4;
  return baseWeeklyEvents.map((event, index) => {
    if (event.total === 0) return { ...event, id: `${doctorId}-${event.id}` };
    const booked = Math.min(event.total, Math.max(0, event.booked - ((index + offset) % 3 === 0 ? 1 : 0) + (offset === 2 ? 1 : 0)));
    return { ...event, id: `${doctorId}-${event.id}`, booked };
  });
}

function buildDoctorCards(doctors, schedules) {
  return doctors.map((doctor) => {
    const profile = { ...fallbackProfile, ...doctorProfiles[doctor.id] };
    const doctorSchedules = schedules.filter((schedule) => schedule.doctorId === doctor.id);
    const totalSlots = doctorSchedules.reduce((sum, item) => sum + Number(item.totalSlots || 0), 0);
    const bookedSlots = doctorSchedules.reduce((sum, item) => sum + Number(item.bookedSlots || 0), 0);
    const availableSlots = doctorSchedules.reduce((sum, item) => sum + Number(item.availableSlots || 0), 0);
    const load = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : Math.round(Number(doctor.load || profile.fillRate || 0));

    return {
      ...profile,
      id: doctor.id,
      displayName: profile.displayName || doctor.name,
      title: profile.title || doctor.department || 'Bác sĩ chuyên khoa',
      department: doctor.department || profile.department,
      totalSlots: totalSlots || doctor.totalSlots || 40,
      bookedSlots: bookedSlots || doctor.bookedSlots || Math.round((load / 100) * 40),
      availableSlots: availableSlots || doctor.availableSlots || Math.max(0, 40 - Math.round((load / 100) * 40)),
      scheduleCount: doctorSchedules.length || 7,
      load,
      loadTone: getLoadTone(load),
      loadLabel: getLoadLabel(load),
    };
  });
}

export function SchedulesByDoctorPage() {
  const navigate = useNavigate();
  const { doctors, error, schedules } = useSchedulingData();
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || 'dr-minh');
  const [activeView, setActiveView] = useState('week');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [notice, setNotice] = useState('');

  const weekDays = useMemo(() => getWeekDays(), []);
  const doctorCards = useMemo(() => buildDoctorCards(doctors, schedules), [doctors, schedules]);
  const selectedDoctor = doctorCards.find((doctor) => doctor.id === selectedDoctorId) || doctorCards[0];
  const weeklyEvents = useMemo(() => createWeeklyEvents(selectedDoctor?.id || 'dr-minh'), [selectedDoctor?.id]);
  const selectedEvent = weeklyEvents.find((event) => event.id === selectedEventId) || weeklyEvents[0];

  const bookedThisWeek = weeklyEvents.reduce((sum, event) => sum + event.booked, 0);
  const totalThisWeek = weeklyEvents.reduce((sum, event) => sum + event.total, 0);
  const openThisWeek = Math.max(0, totalThisWeek - bookedThisWeek);
  const fillRate = totalThisWeek > 0 ? Math.round((bookedThisWeek / totalThisWeek) * 100) : selectedDoctor?.load || 0;

  function handleAction(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  if (!selectedDoctor) {
    return (
      <section className="doctor-dispatch-empty">
        <Stethoscope size={28} />
        <strong>Chưa có dữ liệu bác sĩ</strong>
        <span>Vui lòng đồng bộ dữ liệu lịch khám hoặc thêm bác sĩ trước khi xem lịch.</span>
      </section>
    );
  }

  return (
    <main className="doctor-dispatch-page">
      <section className="doctor-dispatch-top">
        <div className="doctor-dispatch-title">
          <span aria-hidden="true"><Activity size={18} /></span>
          <div>
            <h1>Điều phối lịch theo bác sĩ</h1>
            <p>Theo dõi công suất, lịch hẹn và hiệu suất làm việc của bác sĩ. Quản lý dễ dàng, điều phối thông minh.</p>
          </div>
        </div>
        <div className="doctor-dispatch-actions">
          <button type="button" onClick={() => navigate('/scheduling/bulk-create')}>
            <UsersRound size={17} />
            Phân công lịch
          </button>
          <button type="button" className="is-primary" onClick={() => navigate('/scheduling/create')}>
            <Plus size={17} />
            Tạo lịch
          </button>
          <button type="button" onClick={() => handleAction('Đã chuẩn bị báo cáo lịch theo bác sĩ.')}>
            <Download size={17} />
            Xuất báo cáo
          </button>
        </div>
      </section>

      {error ? (
        <section className="scheduling-sync-banner is-warning">
          <strong>Đang dùng dữ liệu mẫu</strong>
          <span>{error}</span>
        </section>
      ) : null}

      {notice ? (
        <section className="doctor-dispatch-toast">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </section>
      ) : null}

      <section className="doctor-picker-strip" aria-label="Chọn bác sĩ">
        <button type="button" aria-label="Xem bác sĩ trước"><ChevronLeft size={20} /></button>
        <div className="doctor-picker-row">
          {doctorCards.map((doctor) => (
            <button
              key={doctor.id}
              type="button"
              className={`doctor-picker-card ${doctor.id === selectedDoctor.id ? 'is-active' : ''}`}
              onClick={() => {
                setSelectedDoctorId(doctor.id);
                setSelectedEventId('');
              }}
            >
              <img src={doctor.avatar} alt="" />
              <span>
                <strong>{doctor.displayName}</strong>
                <small>{doctor.department}</small>
                <em className={`is-${doctor.loadTone}`}>{doctor.loadLabel}</em>
              </span>
              <i style={{ '--doctor-load': `${doctor.load}%` }}>
                <b />
              </i>
              <small>
                <UsersRound size={13} />
                {doctor.bookedSlots}/{doctor.totalSlots} ca
              </small>
              <small>{doctor.load}%</small>
            </button>
          ))}
        </div>
        <button type="button" aria-label="Xem bác sĩ tiếp theo"><ChevronRight size={20} /></button>
      </section>

      <section className="doctor-dispatch-layout">
        <div className="doctor-dispatch-main">
          <section className="doctor-profile-band">
            <article className="doctor-profile-card">
              <div className="doctor-profile-main">
                <span className="doctor-profile-avatar">
                  <img src={selectedDoctor.avatar} alt="" />
                  <i />
                </span>
                <div>
                  <h2>
                    {selectedDoctor.displayName}
                    <BadgeCheck size={18} />
                  </h2>
                  <p>{selectedDoctor.department} - Bệnh viện Đa khoa Quốc tế</p>
                  <dl>
                    <div>
                      <Building2 size={15} />
                      <dt>Phòng khám</dt>
                      <dd>{selectedDoctor.room}</dd>
                    </div>
                    <div>
                      <Clock3 size={15} />
                      <dt>Thời gian làm việc</dt>
                      <dd>{selectedDoctor.workTime}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="doctor-profile-meta">
                <span>Chuyên môn: {selectedDoctor.specialties.map((item) => <b key={item}>{item}</b>)}</span>
                <span>Kinh nghiệm: <strong>{selectedDoctor.experience}</strong></span>
                <span>Chứng chỉ: <strong>{selectedDoctor.certificate}</strong></span>
                <span>Đánh giá: <strong>{selectedDoctor.rating} ({selectedDoctor.reviews})</strong></span>
              </div>
            </article>

            <div className="doctor-stat-grid">
              <article>
                <span>Tổng ca tuần</span>
                <strong>{selectedDoctor.totalSlots}</strong>
                <small className="is-up">+8% so với tuần trước</small>
              </article>
              <article>
                <span>Đã đặt</span>
                <strong>{bookedThisWeek}</strong>
                <small>{fillRate}% tổng ca</small>
              </article>
              <article>
                <span>Còn trống</span>
                <strong>{openThisWeek}</strong>
                <small>{100 - fillRate}% khả dụng</small>
              </article>
              <article className="is-ring" style={{ '--doctor-ring': `${fillRate * 3.6}deg` }}>
                <span>Tỷ lệ lấp đầy</span>
                <strong>{fillRate}%</strong>
                <i aria-hidden="true" />
              </article>
              <article>
                <span>Telehealth</span>
                <strong>{selectedDoctor.telehealth}</strong>
                <small>21% tổng ca</small>
              </article>
              <article>
                <span>No-show rate</span>
                <strong>{selectedDoctor.noShow}</strong>
                <small className="is-down">-1.2% so với tuần trước</small>
              </article>
              <article>
                <span>Thời gian TB/ca</span>
                <strong>{selectedDoctor.avgTime}</strong>
                <small>-2 phút</small>
              </article>
              <article>
                <span>Đánh giá hài lòng</span>
                <strong>{selectedDoctor.satisfaction}</strong>
                <Star size={22} />
              </article>
            </div>
          </section>

          <section className="doctor-calendar-panel">
            <div className="doctor-calendar-tabs">
              {viewTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={activeView === tab.id ? 'is-active' : ''}
                    onClick={() => setActiveView(tab.id)}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="doctor-calendar-head">
              <div>
                <strong>Tuần {weekDays[0].dateLabel} - {weekDays[6].dateLabel}</strong>
                <span>{selectedDoctor.displayName} - {selectedDoctor.room}</span>
              </div>
              <div>
                <button type="button" aria-label="Tuần trước"><ChevronLeft size={18} /></button>
                <button type="button" onClick={() => handleAction('Đã làm mới dữ liệu lịch tuần.')}>
                  <RefreshCw size={16} />
                  Hôm nay
                </button>
                <button type="button" aria-label="Tuần sau"><ChevronRight size={18} /></button>
              </div>
            </div>

            <div className="doctor-schedule-scroll">
              <div className="doctor-schedule-board">
                <div className="doctor-schedule-corner">Giờ</div>
                {weekDays.map((day) => (
                  <div key={day.label} className={`doctor-day-head ${day.isToday ? 'is-today' : ''}`}>
                    <strong>{day.label}</strong>
                    <span>{day.dateLabel}{day.isToday ? ' - Hôm nay' : ''}</span>
                  </div>
                ))}
                {timeMarkers.map((time, index) => (
                  <div key={time} className="doctor-time-marker" style={{ gridRow: index + 2, gridColumn: 1 }}>{time}</div>
                ))}
                {weekDays.map((day) => (
                  <div key={day.index} className="doctor-day-lane" style={{ gridColumn: day.index + 2, gridRow: '2 / span 11' }} />
                ))}
                <div className="doctor-day-off" style={{ gridColumn: 8, gridRow: '3 / span 8' }}>
                  <Stethoscope size={22} />
                  <strong>Nghỉ</strong>
                </div>
                {weeklyEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className={`doctor-schedule-event is-${event.tone} ${selectedEvent.id === event.id ? 'is-selected' : ''}`}
                    style={{ gridColumn: event.day + 2, gridRow: `${event.row} / span ${event.span}` }}
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    <span>
                      <strong>{event.title}</strong>
                      <MoreVertical size={14} />
                    </span>
                    <time>{event.time}</time>
                    <small>
                      <UsersRound size={12} />
                      {event.total ? `${event.booked}/${event.total}` : 'Đã khóa'}
                    </small>
                    <em>{event.badge}</em>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="doctor-side-rail">
          <article className="doctor-side-card doctor-info-mini">
            <header>
              <strong>Thông tin bác sĩ</strong>
              <button type="button" aria-label="Gọi bác sĩ"><Phone size={15} /></button>
            </header>
            <div>
              <img src={selectedDoctor.avatar} alt="" />
              <span>
                <strong>{selectedDoctor.displayName}</strong>
                <em className={`is-${selectedDoctor.loadTone}`}>{selectedDoctor.loadLabel}</em>
                <small>{selectedDoctor.department}</small>
                <small>{selectedDoctor.room}</small>
              </span>
            </div>
          </article>

          <article className="doctor-side-card doctor-today-card">
            <header>
              <strong>Lịch hẹn hôm nay (Thứ 2, 27/04)</strong>
              <button type="button" onClick={() => setActiveView('day')}>Xem tất cả (7)</button>
            </header>
            <div className="doctor-appointment-list">
              {appointmentsToday.map((appointment) => (
                <div key={`${appointment.time}-${appointment.patient}`}>
                  <time>{appointment.time}</time>
                  <span>
                    <strong>{appointment.patient}</strong>
                    <small>{appointment.meta}</small>
                  </span>
                  <em className={`is-${appointment.tone}`}>{appointment.status}</em>
                  <MoreVertical size={15} />
                </div>
              ))}
            </div>
            <button type="button" className="doctor-link-button">Xem thêm 3 lịch hẹn <ArrowUpRight size={14} /></button>
          </article>

          <article className="doctor-side-card doctor-quick-actions">
            <header><strong>Thao tác nhanh</strong></header>
            <div>
              <button type="button" onClick={() => navigate('/scheduling/calendar')}><CalendarPlus size={18} />Sửa lịch</button>
              <button type="button" onClick={() => handleAction('Đã mở luồng đổi phòng khám.')}><MapPin size={18} />Đổi phòng</button>
              <button type="button" onClick={() => handleAction('Đã chuẩn bị chuyển ca.')}><RefreshCw size={18} />Chuyển ca</button>
              <button type="button" onClick={() => handleAction('Đã khóa lịch đã chọn.')}><LockKeyhole size={18} />Khóa lịch</button>
              <button type="button" onClick={() => handleAction('Đã gửi nhắc lịch cho bệnh nhân.')}><Bell size={18} />Gửi nhắc lịch</button>
              <button type="button" onClick={() => handleAction('Đã bật phòng Telehealth.')}><Video size={18} />Telehealth</button>
              <button type="button" onClick={() => handleAction('Đã mở ghi chú ca khám.')}><FileText size={18} />Ghi chú</button>
              <button type="button" onClick={() => handleAction('Đã gửi danh sách tới máy in.')}><Printer size={18} />In danh sách</button>
            </div>
          </article>

          <article className="doctor-side-card doctor-capacity-card">
            <header>
              <strong>Công suất hôm nay</strong>
              <span>{fillRate}%</span>
            </header>
            <i style={{ '--doctor-capacity': `${fillRate}%` }}><b /></i>
            <div>
              <span><strong>{bookedThisWeek}</strong>Đã đặt</span>
              <span><strong>{openThisWeek}</strong>Còn trống</span>
              <span><strong>1</strong>No-show</span>
            </div>
          </article>

          <article className="doctor-side-card doctor-hourly-card">
            <header>
              <strong>Số ca khám theo giờ</strong>
              <span><i />Đã đặt <i />Còn trống</span>
            </header>
            <div className="doctor-hourly-bars">
              {hourlyLoad.map(([label, booked, total]) => (
                <span key={label}>
                  <b style={{ height: `${booked * 2}px` }} />
                  <i style={{ height: `${total * 2}px` }} />
                  <small>{label}</small>
                </span>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="doctor-analytics-row">
        <article>
          <span>Tổng bệnh nhân tuần này</span>
          <strong>{selectedDoctor.patientsWeek}</strong>
          <small className="is-up">+12% so với tuần trước</small>
          <svg viewBox="0 0 120 38" aria-hidden="true">
            <polyline points="2,28 14,22 26,25 38,18 50,16 62,8 74,20 86,15 98,27 118,13" />
          </svg>
        </article>
        <article className="is-donut" style={{ '--doctor-donut': `${fillRate * 3.6}deg` }}>
          <span>Tỷ lệ lấp đầy</span>
          <div><strong>{fillRate}%</strong></div>
          <small>Đã đặt {bookedThisWeek} - Còn trống {openThisWeek}</small>
        </article>
        <article>
          <span>No-show rate</span>
          <strong>{selectedDoctor.noShow}</strong>
          <small className="is-down">-1.2% so với tuần trước</small>
          <svg viewBox="0 0 120 38" aria-hidden="true">
            <polyline points="2,25 14,14 26,18 38,11 50,27 62,22 74,19 86,8 98,18 118,12" />
          </svg>
        </article>
        <article>
          <span>Thời gian khám TB</span>
          <strong>{selectedDoctor.avgTime}</strong>
          <small className="is-down">-2 phút so với tuần trước</small>
          <svg viewBox="0 0 120 38" aria-hidden="true">
            <polyline points="2,10 14,18 26,26 38,12 50,20 62,8 74,16 86,11 98,25 118,17" />
          </svg>
        </article>
        <article className="is-peak">
          <span>Mức quá tải giờ cao điểm</span>
          <strong>{selectedDoctor.peakTime}</strong>
          <small>Công suất trung bình 92%</small>
          <i><b /></i>
        </article>
      </section>
    </main>
  );
}
