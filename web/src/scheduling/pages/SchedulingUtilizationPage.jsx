import { Link } from 'react-router-dom';
import { MetricCard, SchedulingHero, UtilizationBar } from '../components/SchedulingPrimitives';
import { useSchedulingData } from '../context/SchedulingDataContext';

export function SchedulingUtilizationPage() {
  const { departments, doctors, error, schedules } = useSchedulingData();
  const lowSchedules = schedules.filter((item) => item.utilization < 50);
  const fullSchedules = schedules.filter((item) => item.utilization >= 95);
  const totalSlots = schedules.reduce((sum, item) => sum + item.totalSlots, 0);
  const totalBooked = schedules.reduce((sum, item) => sum + item.bookedSlots, 0);
  const totalBlocked = schedules.reduce((sum, item) => sum + item.blockedSlots, 0);
  const doctorRows = doctors.map((doctor) => {
    const doctorSchedules = schedules.filter((item) => item.doctorId === doctor.id);
    const slotsByDoctor = doctorSchedules.reduce((sum, item) => sum + item.totalSlots, 0);
    const bookedByDoctor = doctorSchedules.reduce((sum, item) => sum + item.bookedSlots, 0);
    const availableByDoctor = doctorSchedules.reduce((sum, item) => sum + item.availableSlots, 0);
    return {
      ...doctor,
      totalSlots: slotsByDoctor,
      bookedSlots: bookedByDoctor,
      availableSlots: availableByDoctor,
      utilization: slotsByDoctor ? Math.round((bookedByDoctor / slotsByDoctor) * 100) : doctor.load,
    };
  });
  const departmentRows = departments.map((department) => {
    const departmentSchedules = schedules.filter((item) => item.department === department.name);
    const slotsByDepartment = departmentSchedules.reduce((sum, item) => sum + item.totalSlots, 0);
    const bookedByDepartment = departmentSchedules.reduce((sum, item) => sum + item.bookedSlots, 0);
    return {
      ...department,
      totalSlots: slotsByDepartment,
      bookedSlots: bookedByDepartment,
      utilization: slotsByDepartment ? Math.round((bookedByDepartment / slotsByDepartment) * 100) : department.utilization,
    };
  });

  return (
    <>
      <SchedulingHero
        eyebrow="Báo cáo"
        title="Tỷ lệ lấp đầy / Sức chứa"
        copy="Báo cáo lấp đầy lịch để quản trị viên quyết định mở thêm lịch, giảm lịch hoặc phân bổ lại bác sĩ."
        actions={<Link to="/scheduling/calendar">Mở lịch trực quan</Link>}
      />

      {error ? (
        <section className="scheduling-sync-banner is-warning">
          <strong>Đang dùng dữ liệu mẫu</strong>
          <span>{error}</span>
        </section>
      ) : null}

      <section className="scheduling-metrics-grid scheduling-metrics-grid--four">
        <MetricCard label="Tỷ lệ lấp đầy trung bình" value="74%" delta="toàn hệ thống" tone="violet" />
        <MetricCard label="Tổng lịch" value={schedules.length} delta="đang quản lý" tone="blue" />
        <MetricCard label="Tổng khung giờ" value={totalSlots} delta="toàn hệ thống" tone="slate" />
        <MetricCard label="Đã đặt" value={totalBooked} delta="cần phục vụ" tone="green" />
        <MetricCard label="Đã khóa" value={totalBlocked} delta="đang khóa" tone="amber" />
      </section>

      <section className="scheduling-report-grid">
        <article className="scheduling-panel">
          <div className="scheduling-panel__head">
            <div>
              <span>Theo bác sĩ</span>
              <h2>Tỷ lệ lấp đầy theo bác sĩ</h2>
            </div>
          </div>
          <div className="scheduling-stack">
            {doctors.map((doctor) => (
              <div key={doctor.id} className="scheduling-stack__item">
                <div><strong>{doctor.name}</strong><span>{doctor.department}</span></div>
                <UtilizationBar value={doctor.load} />
              </div>
            ))}
          </div>
        </article>

        <article className="scheduling-panel">
          <div className="scheduling-panel__head">
            <div>
              <span>Theo khoa</span>
              <h2>Tỷ lệ lấp đầy theo khoa</h2>
            </div>
          </div>
          <div className="scheduling-stack">
            {departments.map((department) => (
              <div key={department.id} className="scheduling-stack__item">
                <div><strong>{department.name}</strong><span>{department.bookings} lượt đặt</span></div>
                <UtilizationBar value={department.utilization} />
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="scheduling-report-grid">
        <article className="scheduling-panel">
          <div className="scheduling-panel__head">
            <div>
              <span>Bảng theo bác sĩ</span>
              <h2>Công suất từng bác sĩ</h2>
            </div>
          </div>
          <div className="scheduling-table scheduling-table--report">
            <div className="scheduling-table__head">
              <span>Bác sĩ</span>
              <span>Tổng</span>
              <span>Đã đặt</span>
              <span>Còn trống</span>
              <span>Lấp đầy</span>
            </div>
            {doctorRows.map((doctor) => (
              <div key={doctor.id} className="scheduling-table__row">
                <strong>{doctor.name}</strong>
                <span>{doctor.totalSlots}</span>
                <span>{doctor.bookedSlots}</span>
                <span>{doctor.availableSlots}</span>
                <UtilizationBar value={doctor.utilization} />
              </div>
            ))}
          </div>
        </article>

        <article className="scheduling-panel">
          <div className="scheduling-panel__head">
            <div>
              <span>Bảng theo khoa</span>
              <h2>Công suất từng khoa</h2>
            </div>
          </div>
          <div className="scheduling-table scheduling-table--report">
            <div className="scheduling-table__head">
              <span>Khoa</span>
              <span>Tổng</span>
              <span>Đã đặt</span>
              <span>Lượt đặt</span>
              <span>Lấp đầy</span>
            </div>
            {departmentRows.map((department) => (
              <div key={department.id} className="scheduling-table__row">
                <strong>{department.name}</strong>
                <span>{department.totalSlots}</span>
                <span>{department.bookedSlots}</span>
                <span>{department.bookings}</span>
                <UtilizationBar value={department.utilization} />
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="scheduling-report-grid">
        <article className="scheduling-panel">
          <div className="scheduling-panel__head"><div><span>Kín lịch nhanh</span><h2>Top lịch kín nhanh</h2></div></div>
          <div className="scheduling-mini-list">
            {fullSchedules.map((item) => (
              <div key={item.id}><span>{item.doctor}</span><small>{item.department} • {item.bookedSlots}/{item.totalSlots}</small></div>
            ))}
          </div>
        </article>

        <article className="scheduling-panel">
          <div className="scheduling-panel__head"><div><span>Ít lượt đặt</span><h2>Lịch mở nhưng ít lượt đặt</h2></div></div>
          <div className="scheduling-mini-list">
            {lowSchedules.map((item) => (
              <div key={item.id}><span>{item.doctor}</span><small>{item.department} • {item.utilization}% lấp đầy</small></div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
