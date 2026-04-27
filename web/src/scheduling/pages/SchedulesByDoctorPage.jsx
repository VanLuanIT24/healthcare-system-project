import { FilterBar, SchedulingHero, StatusBadge, UtilizationBar } from '../components/SchedulingPrimitives';
import { useSchedulingData } from '../context/SchedulingDataContext';
import { formatDate } from '../utils/schedulingUi';

export function SchedulesByDoctorPage() {
  const { doctors, error, schedules } = useSchedulingData();
  return (
    <>
      <SchedulingHero
        eyebrow="Lịch theo bác sĩ"
        title="Lịch theo bác sĩ"
        copy="Góc nhìn rút gọn cho quản trị viên hoặc bác sĩ xem lịch cá nhân, khung giờ đã đặt và tải trong tuần."
      />

      {error ? (
        <section className="scheduling-sync-banner is-warning">
          <strong>Đang dùng dữ liệu mẫu</strong>
          <span>{error}</span>
        </section>
      ) : null}

      <FilterBar>
        <label><span>Bác sĩ</span><select>{doctors.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label><span>Tuần</span><input type="week" defaultValue="2026-W17" /></label>
        <button type="button">Xem lịch</button>
      </FilterBar>

      <section className="scheduling-doctor-grid">
        {doctors.map((doctor) => {
          const doctorSchedules = schedules.filter((item) => item.doctorId === doctor.id);
          return (
            <article key={doctor.id} className="scheduling-panel scheduling-doctor-card">
              <div className="scheduling-doctor-card__head">
                <div><strong>{doctor.name}</strong><span>{doctor.department}</span></div>
                <UtilizationBar value={doctor.load} />
              </div>
              <div className="scheduling-mini-list">
                {doctorSchedules.map((item) => (
                  <div key={item.id}>
                    <span>{formatDate(item.date)} • {item.start}-{item.end}</span>
                    <small>{item.bookedSlots}/{item.totalSlots} khung giờ</small>
                    <StatusBadge>{item.status}</StatusBadge>
                  </div>
                ))}
                {doctorSchedules.length === 0 ? <div><span>Chưa có lịch trong tuần này.</span></div> : null}
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
