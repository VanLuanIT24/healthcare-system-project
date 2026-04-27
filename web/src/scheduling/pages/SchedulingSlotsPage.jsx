import { useEffect, useState } from 'react';
import { FilterBar, SchedulingHero, StatusBadge } from '../components/SchedulingPrimitives';
import { useScheduleDetailData, useSchedulingData } from '../context/SchedulingDataContext';
import { getSlotStatusLabel } from '../utils/schedulingUi';

export function SchedulingSlotsPage() {
  const { actions, departments, doctors, error, schedules } = useSchedulingData();
  const [selectedScheduleId, setSelectedScheduleId] = useState(schedules[0]?.id || '');
  const { error: detailError, loading, slots } = useScheduleDetailData(selectedScheduleId || schedules[0]?.id);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!selectedScheduleId && schedules[0]?.id) {
      setSelectedScheduleId(schedules[0].id);
    }
  }, [schedules, selectedScheduleId]);

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
        eyebrow="Quản lý khung giờ"
        title="Quản lý khung giờ"
        copy="Màn tập trung xử lý từng khung giờ: xem còn trống, đã đặt, đã khóa; khóa từng khung giờ nhỏ và mở lại khi cần."
      />

      {loading || error || detailError || actionError ? (
        <section className={`scheduling-sync-banner ${error || detailError || actionError ? 'is-warning' : ''}`}>
          <strong>{loading ? 'Đang tải khung giờ từ máy chủ...' : 'Thông báo máy chủ'}</strong>
          <span>{actionError || detailError || error || 'Dữ liệu khung giờ đang được đồng bộ.'}</span>
        </section>
      ) : null}

      <FilterBar>
        <label><span>Lịch</span><select value={selectedScheduleId} onChange={(event) => setSelectedScheduleId(event.target.value)}>{schedules.map((item) => <option key={item.id} value={item.id}>{item.id} - {item.doctor}</option>)}</select></label>
        <label><span>Bác sĩ</span><select>{doctors.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label><span>Khoa</span><select><option>Tất cả khoa</option>{departments.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label><span>Ngày</span><input type="date" defaultValue="2026-04-24" /></label>
        <label><span>Trạng thái khung giờ</span><select><option>Tất cả</option><option>Còn trống</option><option>Đã đặt</option><option>Đã khóa</option></select></label>
        <button type="button">Tải khung giờ</button>
      </FilterBar>

      <section className="scheduling-slot-layout">
        <article className="scheduling-panel scheduling-slot-timeline">
          <div className="scheduling-panel__head">
            <div>
              <span>Dòng thời gian</span>
              <h2>Khung giờ trong ngày</h2>
            </div>
          </div>
          {slots.map((slot) => (
            <div key={slot.id} className={`scheduling-slot-row scheduling-slot-row--${slot.status.toLowerCase()}`}>
              <time>{slot.time}</time>
              <StatusBadge type="slot">{slot.status}</StatusBadge>
              <div>
                <strong>{slot.patient || 'Chưa có bệnh nhân'}</strong>
                <span>{slot.appointment || slot.reason || 'Khung giờ có thể đặt lịch'}</span>
              </div>
              <div className="scheduling-actions">
                <button type="button" onClick={() => runAction(() => actions.batchBlockSlots(selectedScheduleId, { slot_times: [slot.slotTime || slot.time], reason: 'Khóa từ quản lý khung giờ' }))}>Khóa</button>
                <button type="button" onClick={() => runAction(() => actions.batchReopenSlots(selectedScheduleId, { slot_times: [slot.slotTime || slot.time] }))}>Mở lại</button>
                <button type="button">Xem lịch hẹn</button>
              </div>
            </div>
          ))}
        </article>

        <aside className="scheduling-panel scheduling-slot-command">
          <div className="scheduling-panel__head">
            <div>
              <span>Điều khiển</span>
              <h2>Khóa / mở lại khung giờ</h2>
            </div>
          </div>
          <label><span>Chọn khung giờ</span><select>{slots.map((slot) => <option key={slot.id}>{slot.time} - {getSlotStatusLabel(slot.status)}</option>)}</select></label>
          <label><span>Phạm vi xử lý</span><select><option>Chỉ khung giờ đã chọn</option><option>Khóa nhiều khung giờ liên tiếp</option><option>Mở lại nhiều khung giờ liên tiếp</option></select></label>
          <label><span>Lý do khóa</span><textarea placeholder="Ví dụ: bác sĩ bận 1 tiếng, phòng khám cần vệ sinh..." /></label>
          <button type="button" className="is-danger" onClick={() => runAction(() => actions.batchBlockSlots(selectedScheduleId, { from_time: '09:00', to_time: '10:00', reason: 'Bác sĩ bận theo yêu cầu vận hành' }))}>Khóa khung giờ</button>
          <button type="button" onClick={() => runAction(() => actions.batchReopenSlots(selectedScheduleId, { from_time: '09:00', to_time: '10:00' }))}>Mở lại khung giờ</button>
        </aside>
      </section>
    </>
  );
}
