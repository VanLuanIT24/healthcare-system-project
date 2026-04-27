import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SchedulingHero, StatusBadge, UtilizationBar } from '../components/SchedulingPrimitives';
import { useScheduleDetailData, useSchedulingData } from '../context/SchedulingDataContext';
import { formatDate, getSlotStatusLabel } from '../utils/schedulingUi';

const tabs = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'available', label: 'Khung giờ còn trống' },
  { key: 'booked', label: 'Khung giờ đã đặt' },
  { key: 'blocked', label: 'Khung giờ đã khóa' },
  { key: 'controls', label: 'Điều khiển' },
  { key: 'timeline', label: 'Dòng thời gian' },
];

function getDuplicateDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function ScheduleDetailPage() {
  const { scheduleId } = useParams();
  const { actions } = useSchedulingData();
  const { error, impact, loading, schedule, slots, timeline } = useScheduleDetailData(scheduleId);
  const [activeTab, setActiveTab] = useState('overview');
  const availableSlots = slots.filter((item) => item.status === 'Available');
  const bookedSlots = slots.filter((item) => item.status === 'Booked');
  const blockedSlots = slots.filter((item) => item.status === 'Blocked');
  const [actionError, setActionError] = useState('');

  async function runAction(work) {
    setActionError('');
    try {
      await work();
    } catch (actionFailure) {
      setActionError(actionFailure.message);
    }
  }

  return (
    <>
      <SchedulingHero
        eyebrow="Chi tiết lịch"
        title={schedule.doctor}
        copy={`${schedule.department} • ${formatDate(schedule.date)} • ${schedule.start} - ${schedule.end}`}
        actions={
          <>
            <Link to="/scheduling/schedules">Danh sách</Link>
            <button type="button" onClick={() => runAction(() => actions.publishSchedule(schedule.id))}>Công khai</button>
            <button type="button">Sửa</button>
            <button type="button" onClick={() => runAction(() => actions.duplicateSchedule(schedule.id, { work_date: getDuplicateDate(schedule.date) }))}>Sao chép</button>
            <button type="button" className="is-danger" onClick={() => runAction(() => actions.cancelSchedule(schedule.id))}>Hủy lịch</button>
          </>
        }
      />

      {loading || error || actionError ? (
        <section className={`scheduling-sync-banner ${error || actionError ? 'is-warning' : ''}`}>
          <strong>{loading ? 'Đang tải chi tiết từ máy chủ...' : 'Thông báo máy chủ'}</strong>
          <span>{actionError || error || 'Dữ liệu chi tiết đang được đồng bộ.'}</span>
        </section>
      ) : null}

      <section className="scheduling-detail-summary">
        <article><span>Trạng thái</span><StatusBadge>{schedule.status}</StatusBadge></article>
        <article><span>Tổng khung giờ</span><strong>{schedule.totalSlots}</strong></article>
        <article><span>Đã đặt</span><strong>{schedule.bookedSlots}</strong></article>
        <article><span>Còn trống</span><strong>{schedule.availableSlots}</strong></article>
        <article><span>Đã khóa</span><strong>{schedule.blockedSlots}</strong></article>
        <article><span>Tỷ lệ lấp đầy</span><UtilizationBar value={schedule.utilization} /></article>
      </section>

      <section className="scheduling-panel">
        <div className="scheduling-tabs">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" className={activeTab === tab.key ? 'is-active' : ''} onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' ? (
          <div className="scheduling-detail-grid">
            <div><span>Mã lịch</span><strong>{schedule.id}</strong></div>
            <div><span>Bác sĩ</span><strong>{schedule.doctor}</strong></div>
            <div><span>Khoa</span><strong>{schedule.department}</strong></div>
            <div><span>Ngày khám</span><strong>{formatDate(schedule.date)}</strong></div>
            <div><span>Giờ khám</span><strong>{schedule.start} - {schedule.end}</strong></div>
            <div><span>Thời lượng khung giờ</span><strong>15 phút</strong></div>
            <div><span>Sức chứa mỗi khung giờ</span><strong>1 bệnh nhân</strong></div>
            <div><span>Người tạo</span><strong>{schedule.createdBy}</strong></div>
            <div><span>Ngày tạo</span><strong>{schedule.createdAt}</strong></div>
            <div><span>Cập nhật gần nhất</span><strong>{schedule.updatedAt}</strong></div>
            <div><span>Lịch hẹn bị ảnh hưởng nếu đổi lịch</span><strong>{impact?.impacted_appointments_count ?? 0}</strong></div>
            <div className="is-wide"><span>Ghi chú nội bộ</span><p>{schedule.note}</p></div>
          </div>
        ) : null}

        {activeTab === 'available' ? (
          <div className="scheduling-slot-list">
            {availableSlots.map((slot) => (
              <div key={slot.id}>
                <strong>{slot.time}</strong>
                <StatusBadge type="slot">{slot.status}</StatusBadge>
                <button type="button">Hỗ trợ đặt lịch</button>
                <button
                  type="button"
                  onClick={() => runAction(() => actions.batchBlockSlots(schedule.id, { slot_times: [slot.slotTime || slot.time], reason: 'Khóa từ chi tiết lịch' }))}
                >
                  Khóa
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'booked' ? (
          <div className="scheduling-slot-list">
            {bookedSlots.map((slot) => (
              <div key={slot.id}>
                <strong>{slot.time}</strong>
                <span>{slot.patient}</span>
                <small>{slot.appointment}</small>
                <StatusBadge type="slot">{slot.status}</StatusBadge>
                <button type="button">Xem lịch hẹn</button>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'blocked' ? (
          <div className="scheduling-slot-list">
            {blockedSlots.map((slot) => (
              <div key={slot.id}>
                <strong>{slot.time}</strong>
                <span>{slot.reason || 'Chưa nhập lý do'}</span>
                <small>Người khóa: Lễ tân</small>
                <StatusBadge type="slot">{slot.status}</StatusBadge>
                <button type="button" onClick={() => runAction(() => actions.batchReopenSlots(schedule.id, { slot_times: [slot.slotTime || slot.time] }))}>Mở lại</button>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'controls' ? (
          <div className="scheduling-control-grid">
            <label><span>Khung giờ cần xử lý</span><select>{slots.map((slot) => <option key={slot.id}>{slot.time} - {getSlotStatusLabel(slot.status)}</option>)}</select></label>
            <label><span>Lý do khóa</span><input placeholder="Bác sĩ bận, phòng khám bảo trì..." /></label>
            <button type="button" className="is-danger" onClick={() => runAction(() => actions.batchBlockSlots(schedule.id, { from_time: schedule.start, to_time: schedule.end, reason: 'Khóa từ tab điều khiển' }))}>Khóa khung giờ</button>
            <button type="button" onClick={() => runAction(() => actions.batchReopenSlots(schedule.id, { from_time: schedule.start, to_time: schedule.end }))}>Mở lại khung giờ</button>
          </div>
        ) : null}

        {activeTab === 'timeline' ? (
          <div className="scheduling-timeline">
            {timeline.map((item) => (
              <div key={`${item.time}-${item.title}`}>
                <time>{item.time}</time>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.actor}</span>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
