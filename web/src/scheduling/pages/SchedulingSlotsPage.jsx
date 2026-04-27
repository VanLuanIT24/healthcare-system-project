import { useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  FileSpreadsheet,
  Filter,
  Grid3X3,
  Headphones,
  List,
  Lock,
  MoreVertical,
  Plus,
  RefreshCcw,
  Settings,
  SlidersHorizontal,
  Timer,
  Unlock,
  UserRound,
  UsersRound,
  Video,
  X,
} from 'lucide-react';
import { useSchedulingData } from '../context/SchedulingDataContext';

const statusMeta = {
  all: { label: 'Tất cả', tone: 'all' },
  available: { label: 'Còn trống', tone: 'available' },
  near: { label: 'Gần đầy', tone: 'near' },
  full: { label: 'Đã đầy', tone: 'full' },
  blocked: { label: 'Đã khóa', tone: 'blocked' },
  telehealth: { label: 'Telehealth', tone: 'telehealth' },
  vip: { label: 'VIP', tone: 'vip' },
  overbook: { label: 'Overbook', tone: 'overbook' },
  break: { label: 'Nghỉ trưa', tone: 'blocked' },
};

const patientQueue = [
  ['Nguyễn Văn An', '07:00', 'Đã xác nhận'],
  ['Trần Thị Bích Ngọc', '07:05', 'Đã xác nhận'],
  ['Lê Quốc Tuấn', '07:12', 'Đã xác nhận'],
  ['Phạm Thị Thu Hương', '07:20', 'Đã xác nhận'],
  ['Đỗ Minh Khoa', '07:24', 'Đã xác nhận'],
  ['Vũ Hoàng Nam', '07:28', 'Đã xác nhận'],
];

const chartSeries = [22, 28, 36, 44, 32, 54, 48, 62, 70, 58, 81, 66, 74, 52, 38, 46, 57, 43];
const trendPoints = '0,36 24,27 48,33 72,18 96,22 120,10 144,15 168,8 192,19 216,12 240,16 264,31 288,22 312,26 336,13 360,18 384,14';

const initialSlotGroups = [
  {
    id: 'morning',
    label: 'SÁNG',
    icon: CalendarDays,
    time: '06:00 - 12:00',
    total: 96,
    utilization: 78,
    slots: [
      {
        id: 'slot-0700',
        time: '07:00 - 07:30',
        status: 'available',
        doctor: 'BS. Trần Thanh Hải',
        doctorId: 'dr-hai',
        department: 'Nội tổng quát',
        departmentId: 'internal',
        room: 'P. Khám 1 - Tầng 2',
        service: 'Khám tổng quát',
        booked: 6,
        capacity: 10,
        duration: 30,
        mode: 'Trực tiếp',
        type: 'standard',
      },
      {
        id: 'slot-0730',
        time: '07:30 - 08:00',
        status: 'near',
        doctor: 'BS. Lê Minh Tuấn',
        doctorId: 'dr-tuan',
        department: 'Tim mạch',
        departmentId: 'cardiology',
        room: 'P. Khám 1 - Tầng 2',
        service: 'Khám tim mạch',
        booked: 8,
        capacity: 10,
        duration: 30,
        mode: 'Trực tiếp',
        type: 'vip',
      },
      {
        id: 'slot-0800',
        time: '08:00 - 08:30',
        status: 'full',
        doctor: 'BS. Nguyễn Thị Lan',
        doctorId: 'dr-lan',
        department: 'Nhi khoa',
        departmentId: 'pediatrics',
        room: 'P. Khám 2 - Tầng 2',
        service: 'Khám nhi khoa',
        booked: 10,
        capacity: 10,
        duration: 30,
        mode: 'Trực tiếp',
        type: 'standard',
      },
      {
        id: 'slot-0830',
        time: '08:30 - 09:00',
        status: 'telehealth',
        doctor: 'BS. Phạm Văn Hùng',
        doctorId: 'dr-hung',
        department: 'Telehealth',
        departmentId: 'telehealth',
        room: 'Tư vấn online',
        service: 'Telehealth Room 1',
        booked: 4,
        capacity: 10,
        duration: 30,
        mode: 'Telehealth',
        type: 'telehealth',
      },
    ],
  },
  {
    id: 'afternoon',
    label: 'CHIỀU',
    icon: Timer,
    time: '12:00 - 18:00',
    total: 88,
    utilization: 52,
    slots: [
      {
        id: 'slot-1300',
        time: '13:00 - 13:30',
        status: 'available',
        doctor: 'BS. Hoàng Văn Dũng',
        doctorId: 'dr-dung',
        department: 'Da liễu',
        departmentId: 'dermatology',
        room: 'P. Khám 3 - Tầng 3',
        service: 'Khám da liễu',
        booked: 5,
        capacity: 10,
        duration: 30,
        mode: 'Trực tiếp',
        type: 'standard',
      },
      {
        id: 'slot-break',
        time: '13:30 - 14:30',
        status: 'break',
        doctor: 'Block thời gian',
        doctorId: 'system',
        department: 'Vận hành',
        departmentId: 'operation',
        room: 'Không đặt lịch',
        service: 'Nghỉ trưa',
        booked: 0,
        capacity: 0,
        duration: 60,
        mode: 'Nghỉ',
        type: 'blocked',
      },
      {
        id: 'slot-1430',
        time: '14:30 - 15:00',
        status: 'near',
        doctor: 'BS. Võ Thị Thanh',
        doctorId: 'dr-thanh',
        department: 'Nội tổng quát',
        departmentId: 'internal',
        room: 'P. Khám 3 - Tầng 3',
        service: 'Khám sản phụ khoa',
        booked: 7,
        capacity: 10,
        duration: 30,
        mode: 'Trực tiếp',
        type: 'standard',
      },
      {
        id: 'slot-1500',
        time: '15:00 - 15:30',
        status: 'overbook',
        doctor: 'BS. Phạm Quốc Huy',
        doctorId: 'dr-huy',
        department: 'Nội tổng quát',
        departmentId: 'internal',
        room: 'P. Khám 1 - Tầng 2',
        service: 'Khám tổng quát',
        booked: 11,
        capacity: 10,
        duration: 30,
        mode: 'Trực tiếp',
        type: 'standard',
      },
    ],
  },
  {
    id: 'evening',
    label: 'TỐI',
    icon: Clock3,
    time: '18:00 - 22:00',
    total: 72,
    utilization: 45,
    slots: [
      {
        id: 'slot-1800',
        time: '18:00 - 18:30',
        status: 'available',
        doctor: 'BS. Nguyễn Thu Thảo',
        doctorId: 'dr-thao',
        department: 'Tai mũi họng',
        departmentId: 'ent',
        room: 'P. Khám 2 - Tầng 2',
        service: 'Khám tai mũi họng',
        booked: 4,
        capacity: 10,
        duration: 30,
        mode: 'Trực tiếp',
        type: 'standard',
      },
      {
        id: 'slot-1900',
        time: '19:00 - 19:30',
        status: 'full',
        doctor: 'BS. Trần Minh Đức',
        doctorId: 'dr-duc',
        department: 'Răng hàm mặt',
        departmentId: 'dental',
        room: 'P. Khám 2 - Tầng 2',
        service: 'Khám răng hàm mặt',
        booked: 10,
        capacity: 10,
        duration: 30,
        mode: 'Trực tiếp',
        type: 'standard',
      },
      {
        id: 'slot-2000',
        time: '20:00 - 20:30',
        status: 'blocked',
        doctor: 'BS. Lê Trung Kiên',
        doctorId: 'dr-kien',
        department: 'Cơ xương khớp',
        departmentId: 'bone',
        room: 'P. Khám 3 - Tầng 3',
        service: 'Khám cơ xương khớp',
        booked: 0,
        capacity: 10,
        duration: 30,
        mode: 'Đã khóa',
        type: 'blocked',
      },
      {
        id: 'slot-2100',
        time: '21:00 - 21:30',
        status: 'telehealth',
        doctor: 'BS. Đỗ Gia Minh',
        doctorId: 'dr-minh',
        department: 'Telehealth',
        departmentId: 'telehealth',
        room: 'Telehealth Room 2',
        service: 'Tư vấn online',
        booked: 3,
        capacity: 10,
        duration: 30,
        mode: 'Telehealth',
        type: 'telehealth',
      },
    ],
  },
];

function getFillRate(slot) {
  if (!slot.capacity) return 0;
  return Math.min(120, Math.round((slot.booked / slot.capacity) * 100));
}

function countByStatus(slots, status) {
  if (status === 'all') return slots.length;
  if (status === 'vip') return slots.filter((slot) => slot.type === 'vip').length;
  return slots.filter((slot) => slot.status === status).length;
}

export function SchedulingSlotsPage() {
  const { departments, doctors, error, schedules } = useSchedulingData();
  const [slotGroups, setSlotGroups] = useState(initialSlotGroups);
  const [selectedSlotId, setSelectedSlotId] = useState('slot-0700');
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedFacility, setSelectedFacility] = useState('all');
  const [selectedDate, setSelectedDate] = useState('2026-04-24');
  const [viewMode, setViewMode] = useState('list');
  const [actionMessage, setActionMessage] = useState('');

  const allSlots = useMemo(() => slotGroups.flatMap((group) => group.slots.map((slot) => ({ ...slot, groupId: group.id }))), [slotGroups]);
  const selectedSlot = allSlots.find((slot) => slot.id === selectedSlotId) || allSlots[0];
  const totalCapacity = allSlots.reduce((sum, slot) => sum + slot.capacity, 0);
  const bookedCapacity = allSlots.reduce((sum, slot) => sum + slot.booked, 0);
  const availableCapacity = allSlots.reduce((sum, slot) => sum + Math.max(0, slot.capacity - slot.booked), 0);
  const fullSlots = allSlots.filter((slot) => slot.status === 'full' || slot.status === 'overbook').length;
  const blockedSlots = allSlots.filter((slot) => slot.status === 'blocked' || slot.status === 'break').length;
  const utilization = Math.round((bookedCapacity / Math.max(1, totalCapacity)) * 100);

  const filteredGroups = slotGroups.map((group) => ({
    ...group,
    slots: group.slots.filter((slot) => {
      const matchesDoctor = selectedDoctor === 'all' || slot.doctorId === selectedDoctor;
      const matchesDepartment = selectedDepartment === 'all' || slot.departmentId === selectedDepartment;
      const matchesStatus =
        selectedStatus === 'all' ||
        slot.status === selectedStatus ||
        (selectedStatus === 'vip' && slot.type === 'vip');
      const matchesType = selectedType === 'all' || slot.type === selectedType;
      const matchesFacility = selectedFacility === 'all' || slot.room.includes(selectedFacility);

      return matchesDoctor && matchesDepartment && matchesStatus && matchesType && matchesFacility;
    }),
  }));

  function updateSelectedSlot(status, message) {
    setSlotGroups((current) =>
      current.map((group) => ({
        ...group,
        slots: group.slots.map((slot) => {
          if (slot.id !== selectedSlot?.id) return slot;
          if (status === 'duplicate') {
            return slot;
          }
          return {
            ...slot,
            status,
            booked: status === 'blocked' ? 0 : slot.booked,
            mode: status === 'blocked' ? 'Đã khóa' : slot.mode,
          };
        }),
      })),
    );
    setActionMessage(message);
  }

  function handleCreateSlot() {
    setActionMessage(`Đã mở luồng tạo slot mới cho ngày ${selectedDate}.`);
  }

  return (
    <section className="slots-visual-page">
      <div className="slots-visual-filters">
        <label>
          <span>Bác sĩ</span>
          <select value={selectedDoctor} onChange={(event) => setSelectedDoctor(event.target.value)}>
            <option value="all">Tất cả bác sĩ</option>
            {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
            {allSlots.map((slot) => <option key={slot.doctorId} value={slot.doctorId}>{slot.doctor}</option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
        <label>
          <span>Khoa</span>
          <select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)}>
            <option value="all">Tất cả khoa</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            <option value="internal">Nội tổng quát</option>
            <option value="telehealth">Telehealth</option>
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
        <label>
          <span>Ngày</span>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          <Calendar size={14} aria-hidden="true" />
        </label>
        <label>
          <span>Loại slot</span>
          <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="standard">Trực tiếp</option>
            <option value="telehealth">Telehealth</option>
            <option value="vip">VIP</option>
            <option value="blocked">Đã chặn</option>
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
        <label>
          <span>Trạng thái</span>
          <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
            {Object.entries(statusMeta).slice(0, 7).map(([status, meta]) => <option key={status} value={status}>{meta.label}</option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
        <label>
          <span>Cơ sở</span>
          <select value={selectedFacility} onChange={(event) => setSelectedFacility(event.target.value)}>
            <option value="all">Tất cả cơ sở</option>
            <option value="Tầng 2">Cơ sở A - Tầng 2</option>
            <option value="Tầng 3">Cơ sở A - Tầng 3</option>
            <option value="Telehealth">Telehealth</option>
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
        <button type="button" onClick={handleCreateSlot}>
          <Plus size={17} aria-hidden="true" />
          Tạo slot
        </button>
      </div>

      <div className="slots-visual-title">
        <div>
          <h1>Quản lý khung giờ & slot</h1>
          <p>Tối ưu điều phối khung giờ, sức chứa và thao tác nhanh để nâng cao hiệu quả vận hành.</p>
        </div>
        {(error || actionMessage) ? (
          <span className={error ? 'is-warning' : 'is-success'}>
            {error || actionMessage}
          </span>
        ) : null}
      </div>

      <div className="slots-visual-metrics">
        {[
          { label: 'Tổng slot', value: totalCapacity, delta: '+12 so với hôm qua', icon: CalendarDays, tone: 'blue' },
          { label: 'Còn trống', value: availableCapacity, delta: `${Math.round((availableCapacity / Math.max(1, totalCapacity)) * 100)}%`, icon: Headphones, tone: 'mint' },
          { label: 'Đã đặt', value: bookedCapacity, delta: `${Math.round((bookedCapacity / Math.max(1, totalCapacity)) * 100)}%`, icon: UsersRound, tone: 'indigo' },
          { label: 'Gần đầy', value: countByStatus(allSlots, 'near'), delta: '7.0%', icon: CalendarPlus, tone: 'amber' },
          { label: 'Đã đầy', value: fullSlots, delta: '3.9%', icon: X, tone: 'rose' },
          { label: 'Đã khóa', value: blockedSlots, delta: '3.1%', icon: Lock, tone: 'violet' },
          { label: 'Tỷ lệ lấp đầy', value: `${utilization}%`, delta: '+8.2%', icon: Activity, tone: 'blue' },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className={`is-${metric.tone}`}>
              <span><Icon size={18} aria-hidden="true" /></span>
              <div>
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
                <em>{metric.delta}</em>
              </div>
            </article>
          );
        })}
      </div>

      <div className="slots-visual-actions">
        <button type="button" className="is-primary" onClick={() => setActionMessage('Đã mở tạo nhanh slot mới.')}>
          <Plus size={15} aria-hidden="true" />
          Tạo nhanh
        </button>
        <button type="button" onClick={() => setActionMessage('Đã mở form tạo hàng loạt theo mẫu ngày.')}>
          <CalendarPlus size={15} aria-hidden="true" />
          Tạo hàng loạt
        </button>
        <button type="button" onClick={() => updateSelectedSlot('blocked', `Đã chặn ${selectedSlot?.time}.`)}>
          <Filter size={15} aria-hidden="true" />
          Chặn slot
        </button>
        <button type="button" onClick={() => updateSelectedSlot('available', `Đã mở lại ${selectedSlot?.time}.`)}>
          <RefreshCcw size={15} aria-hidden="true" />
          Mở lại slot
        </button>
        <button type="button" onClick={() => setActionMessage(`Đã nhân bản cấu hình ${selectedSlot?.time}.`)}>
          <Copy size={15} aria-hidden="true" />
          Nhân bản
        </button>
        <button type="button" onClick={() => setActionMessage('Đã sẵn sàng import slot từ Excel.')}>
          <FileSpreadsheet size={15} aria-hidden="true" />
          Import Excel
        </button>
        <button type="button" onClick={() => setActionMessage('Đã xuất dữ liệu slot trong ngày.')}>
          <Download size={15} aria-hidden="true" />
          Xuất dữ liệu
        </button>
        <button type="button" onClick={() => setActionMessage('Đã mở bộ lọc nâng cao.')}>
          <SlidersHorizontal size={15} aria-hidden="true" />
          Bộ lọc nâng cao
        </button>
        <div>
          <button type="button" className={viewMode === 'list' ? 'is-active' : ''} aria-label="Dạng danh sách" onClick={() => setViewMode('list')}>
            <List size={16} aria-hidden="true" />
          </button>
          <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} aria-label="Dạng lưới" onClick={() => setViewMode('grid')}>
            <Grid3X3 size={16} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Cài đặt slot" onClick={() => setActionMessage('Đã mở cài đặt hiển thị slot.')}>
            <Settings size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="slots-visual-tabs">
        {Object.entries(statusMeta).slice(0, 7).map(([status, meta]) => (
          <button
            key={status}
            type="button"
            className={`is-${meta.tone} ${selectedStatus === status ? 'is-active' : ''}`}
            onClick={() => setSelectedStatus(status)}
          >
            <i aria-hidden="true" />
            {meta.label}
            <strong>{countByStatus(allSlots, status)}</strong>
          </button>
        ))}
      </div>

      <div className="slots-visual-layout">
        <main className={`slots-visual-board is-${viewMode}`}>
          {filteredGroups.map((group) => {
            const Icon = group.icon;
            return (
              <section key={group.id} className="slots-visual-shift">
                <header>
                  <div>
                    <Icon size={20} aria-hidden="true" />
                    <strong>{group.label}</strong>
                    <span>{group.time}</span>
                    <em>{group.total} slots</em>
                  </div>
                  <div>
                    <span>06:00</span>
                    <span>07:00</span>
                    <span>08:00</span>
                    <span>09:00</span>
                    <span>10:00</span>
                    <span>11:00</span>
                    <b>{group.utilization}%</b>
                  </div>
                </header>
                <div className="slots-visual-slot-row">
                  {group.slots.length ? group.slots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      className={`is-${slot.status} ${selectedSlot?.id === slot.id ? 'is-selected' : ''}`}
                      onClick={() => {
                        setSelectedSlotId(slot.id);
                        setActionMessage(`Đã chọn slot ${slot.time}.`);
                      }}
                    >
                      <span>
                        <strong>{slot.time}</strong>
                        <em>{statusMeta[slot.status]?.label}</em>
                        <MoreVertical size={15} aria-hidden="true" />
                      </span>
                      <b>{slot.doctor}</b>
                      <small><UserRound size={12} aria-hidden="true" /> {slot.room}</small>
                      <small><Building2 size={12} aria-hidden="true" /> {slot.service}</small>
                      <footer>
                        <i style={{ width: `${Math.min(100, getFillRate(slot))}%` }} aria-hidden="true" />
                        {slot.capacity ? <strong>{slot.booked}/{slot.capacity}</strong> : <strong>Nghỉ</strong>}
                        <span>{slot.mode === 'Telehealth' ? <Video size={12} aria-hidden="true" /> : <CalendarDays size={12} aria-hidden="true" />} {slot.mode}</span>
                      </footer>
                    </button>
                  )) : (
                    <div className="slots-visual-empty">Không có slot phù hợp bộ lọc hiện tại.</div>
                  )}
                </div>
              </section>
            );
          })}
        </main>

        <aside className="slots-visual-detail">
          <div className="slots-detail-head">
            <strong>Chi tiết slot</strong>
            <button type="button" aria-label="Đóng chi tiết" onClick={() => setActionMessage('Đã thu gọn panel chi tiết slot.')}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="slots-detail-status">
            <span className={`is-${selectedSlot?.status}`}>{statusMeta[selectedSlot?.status]?.label}</span>
            <small>Thứ Sáu, 24/04/2026</small>
          </div>
          <h2>{selectedSlot?.time}</h2>
          <div className="slots-detail-list">
            <div><UserRound size={15} aria-hidden="true" /><span>Bác sĩ</span><strong>{selectedSlot?.doctor}</strong></div>
            <div><Building2 size={15} aria-hidden="true" /><span>Khoa</span><strong>{selectedSlot?.department}</strong></div>
            <div><CalendarDays size={15} aria-hidden="true" /><span>Phòng</span><strong>{selectedSlot?.room}</strong></div>
            <div><Timer size={15} aria-hidden="true" /><span>Thời lượng</span><strong>{selectedSlot?.duration} phút</strong></div>
            <div><UsersRound size={15} aria-hidden="true" /><span>Sức chứa</span><strong>{selectedSlot?.booked} / {selectedSlot?.capacity} bệnh nhân</strong></div>
          </div>
          <div className="slots-detail-progress">
            <span>Mức độ lấp đầy <strong>{getFillRate(selectedSlot)}%</strong></span>
            <i><b style={{ width: `${Math.min(100, getFillRate(selectedSlot))}%` }} /></i>
          </div>

          <section className="slots-detail-patients">
            <div>
              <strong>Danh sách bệnh nhân ({patientQueue.length})</strong>
              <button type="button" onClick={() => setActionMessage('Đã mở toàn bộ danh sách bệnh nhân trong slot.')}>Xem tất cả</button>
            </div>
            {patientQueue.map(([name, time, status]) => (
              <button key={name} type="button" onClick={() => setActionMessage(`Đã mở hồ sơ ${name}.`)}>
                <img src="/images/scheduling/doctors/doctor-ai-fallback.png" alt="" />
                <span>{name}</span>
                <time>{time}</time>
                <em>{status}</em>
              </button>
            ))}
          </section>

          <div className="slots-detail-actions">
            <button type="button" onClick={() => setActionMessage(`Đã mở form sửa slot ${selectedSlot?.time}.`)}><Settings size={14} aria-hidden="true" />Sửa slot</button>
            <button type="button" onClick={() => updateSelectedSlot('blocked', `Đã chặn slot ${selectedSlot?.time}.`)}><Lock size={14} aria-hidden="true" />Chặn slot</button>
            <button type="button" onClick={() => updateSelectedSlot('available', `Đã mở lại slot ${selectedSlot?.time}.`)}><Unlock size={14} aria-hidden="true" />Mở lại slot</button>
            <button type="button" onClick={() => updateSelectedSlot('telehealth', `Đã bật Telehealth cho ${selectedSlot?.time}.`)}><Video size={14} aria-hidden="true" />Telehealth</button>
            <button type="button" onClick={() => setActionMessage(`Đã nhân bản slot ${selectedSlot?.time}.`)}><Copy size={14} aria-hidden="true" />Nhân bản</button>
            <button type="button" className="is-danger" onClick={() => updateSelectedSlot('blocked', `Đã hủy slot ${selectedSlot?.time}.`)}><X size={14} aria-hidden="true" />Hủy slot</button>
          </div>

          <section className="slots-detail-analysis">
            <div>
              <strong>Phân tích slot</strong>
              <button type="button">Hôm nay <ChevronDown size={13} aria-hidden="true" /></button>
            </div>
            <div className="slots-mini-bars">
              {chartSeries.map((value, index) => <i key={index} style={{ height: `${value}%` }} />)}
            </div>
            <ul>
              <li><span>Giờ cao điểm</span><strong>08:00 - 10:00</strong></li>
              <li><span>Tỷ lệ no-show</span><strong className="is-good">2.4% ↓ -0.6%</strong></li>
              <li><span>Đã gửi nhắc lịch</span><strong>6 / 6 · 100%</strong></li>
            </ul>
          </section>
        </aside>
      </div>

      <div className="slots-visual-bottom">
        <article>
          <UsersRound size={22} aria-hidden="true" />
          <span>Tổng bệnh nhân</span>
          <strong>1.248</strong>
          <em>+98 (8.5%) so với ngày 23/04</em>
        </article>
        <article className="is-ring">
          <div style={{ '--slot-ring': `${utilization * 3.6}deg` }} />
          <span>Tỷ lệ sử dụng</span>
          <strong>{utilization}%</strong>
          <em>+8.2% so với ngày 23/04</em>
        </article>
        <article>
          <Headphones size={22} aria-hidden="true" />
          <span>Slot còn trống</span>
          <strong>{availableCapacity}</strong>
          <em>+24 (20.3%) so với ngày 23/04</em>
        </article>
        <article className="is-danger">
          <Lock size={22} aria-hidden="true" />
          <span>Slot bị chặn</span>
          <strong>{blockedSlots}</strong>
          <em>-2 (20.0%) so với ngày 23/04</em>
        </article>
        <article className="is-trend">
          <span>Xu hướng 7 ngày</span>
          <svg viewBox="0 0 384 46" role="img" aria-label="Xu hướng 7 ngày">
            <polyline points={trendPoints} />
          </svg>
          <strong>+12.5%</strong>
        </article>
      </div>
    </section>
  );
}
