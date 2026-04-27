import { useEffect, useState } from 'react';
import { FilterBar, SchedulingHero } from '../components/SchedulingPrimitives';
import { useSchedulingData } from '../context/SchedulingDataContext';
import { getCalendarStatusLabel } from '../utils/schedulingUi';

const viewModes = ['Ngày', 'Tuần', 'Tháng'];

export function SchedulingCalendarPage() {
  const { actions, calendarEvents, departments, doctors, error } = useSchedulingData();
  const [viewMode, setViewMode] = useState('Tuần');
  const [selectedEvent, setSelectedEvent] = useState(calendarEvents[0]);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!selectedEvent && calendarEvents[0]) {
      setSelectedEvent(calendarEvents[0]);
    }
  }, [calendarEvents, selectedEvent]);

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
        eyebrow="Lịch trực quan"
        title="Lịch trực quan"
        copy="Góc nhìn ngày, tuần, tháng giúp điều phối nhìn nhanh lịch đang mở, gần kín, đã kín hoặc đã hủy."
      />

      {error || actionError ? (
        <section className="scheduling-sync-banner is-warning">
          <strong>Thông báo máy chủ</strong>
          <span>{actionError || error}</span>
        </section>
      ) : null}

      <FilterBar>
        <label><span>Chế độ xem</span><select value={viewMode} onChange={(event) => setViewMode(event.target.value)}>{viewModes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Bác sĩ</span><select><option>Toàn hệ thống</option>{doctors.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label><span>Khoa</span><select><option>Tất cả khoa</option>{departments.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label><span>Trạng thái</span><select><option>Tất cả</option><option>Đang mở</option><option>Gần kín</option><option>Đã kín</option><option>Đã hủy</option></select></label>
        <button type="button">Đồng bộ lịch</button>
      </FilterBar>

      <section className="scheduling-calendar-layout">
        <article className="scheduling-panel scheduling-calendar-board">
          <div className="scheduling-calendar-board__head">
            <button type="button">‹</button>
            <strong>Chế độ {viewMode.toLowerCase()} • 22-28/04/2026</strong>
            <button type="button">›</button>
          </div>

          <div className="scheduling-status-legend">
            <span className="is-open">Đang mở</span>
            <span className="is-near-full">Gần kín</span>
            <span className="is-full">Đã kín</span>
            <span className="is-cancelled">Đã hủy</span>
          </div>

          <div className="scheduling-calendar-grid">
            {calendarEvents.map((event) => (
              <button key={event.id} type="button" className={`scheduling-calendar-card scheduling-calendar-card--${event.status}`} onClick={() => setSelectedEvent(event)}>
                <span>{event.day}</span>
                <strong>{event.date}</strong>
                <mark>{getCalendarStatusLabel(event.status)}</mark>
                <p>{event.doctor}</p>
                <small>{event.time}</small>
                <em>{event.booked}/{event.total} khung giờ đã đặt</em>
              </button>
            ))}
          </div>
        </article>

        <aside className="scheduling-panel scheduling-calendar-drawer">
          <div className="scheduling-panel__head">
            <div>
              <span>Xem nhanh</span>
              <h2>{selectedEvent.doctor}</h2>
            </div>
          </div>
          {selectedEvent ? <div className="scheduling-calendar-drawer__body">
            <strong>{selectedEvent.day}, ngày {selectedEvent.date}</strong>
            <span>{selectedEvent.time}</span>
            <div className="scheduling-preview__stats">
              <div><strong>{selectedEvent.booked}</strong><span>Đã đặt</span></div>
              <div><strong>{selectedEvent.total - selectedEvent.booked}</strong><span>Còn trống</span></div>
              <div><strong>{getCalendarStatusLabel(selectedEvent.status)}</strong><span>Trạng thái</span></div>
            </div>
            <button type="button">Sửa lịch</button>
            <button type="button" onClick={() => runAction(() => actions.publishSchedule(selectedEvent.scheduleId || selectedEvent.id))}>Công khai</button>
            <button type="button">Xem chi tiết</button>
            <button type="button">Xem lịch hẹn</button>
            <button type="button" onClick={() => runAction(() => actions.duplicateSchedule(selectedEvent.scheduleId || selectedEvent.id, { work_date: new Date().toISOString().slice(0, 10) }))}>Sao chép lịch</button>
            <button type="button" className="is-danger" onClick={() => runAction(() => actions.batchBlockSlots(selectedEvent.scheduleId || selectedEvent.id, { from_time: '09:00', to_time: '10:00', reason: 'Khóa từ lịch trực quan' }))}>Khóa khung giờ</button>
          </div> : null}
        </aside>
      </section>
    </>
  );
}
