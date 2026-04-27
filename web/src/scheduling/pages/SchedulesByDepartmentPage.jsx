import { FilterBar, SchedulingHero, UtilizationBar } from '../components/SchedulingPrimitives';
import { useSchedulingData } from '../context/SchedulingDataContext';

export function SchedulesByDepartmentPage() {
  const { departments, error, schedules } = useSchedulingData();
  return (
    <>
      <SchedulingHero
        eyebrow="Lịch theo khoa"
        title="Lịch theo khoa"
        copy="Theo dõi năng lực từng khoa: lượt đặt, tỷ lệ lấp đầy, số bác sĩ mở lịch và cảnh báo quá tải."
      />

      {error ? (
        <section className="scheduling-sync-banner is-warning">
          <strong>Đang dùng dữ liệu mẫu</strong>
          <span>{error}</span>
        </section>
      ) : null}

      <FilterBar>
        <label><span>Khoa</span><select>{departments.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label><span>Khoảng ngày</span><input type="date" defaultValue="2026-04-24" /></label>
        <button type="button">Tải dữ liệu</button>
      </FilterBar>

      <section className="scheduling-department-grid">
        {departments.map((department) => {
          const departmentSchedules = schedules.filter((item) => item.department === department.name);
          return (
            <article key={department.id} className="scheduling-panel scheduling-department-card">
              <div className="scheduling-panel__head">
                <div><span>Khoa</span><h2>{department.name}</h2></div>
              </div>
              <div className="scheduling-preview__stats">
                <div><strong>{department.bookings}</strong><span>Lượt đặt</span></div>
                <div><strong>{departmentSchedules.length}</strong><span>Lịch mở</span></div>
                <div><strong>{department.utilization}%</strong><span>Tỷ lệ lấp đầy</span></div>
              </div>
              <UtilizationBar value={department.utilization} />
              <p>{department.utilization >= 85 ? 'Khoa đang gần quá tải, nên mở thêm lịch.' : 'Sức chứa vẫn còn khả dụng.'}</p>
            </article>
          );
        })}
      </section>
    </>
  );
}
