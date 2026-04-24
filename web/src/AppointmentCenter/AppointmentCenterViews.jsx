import { lifecycleActions, lifecycleTransitions, quickViews, summaryRanges } from './appointmentCenterData'
import { AvatarChip, Icon, StatusPill } from './AppointmentCenterShell'

function formatDateLabel(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDayShort(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleDateString('en-US', { weekday: 'short' }).replace('.', '').toUpperCase()
}

function formatDayNumber(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return String(date.getDate()).padStart(2, '0')
}

function formatTimeSlot(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function PageHeader({ eyebrow, title, subtitle, actions, meta }) {
  return (
    <div className="ac-page-header">
      <div className="ac-page-copy">
        {eyebrow ? <div className="ac-page-eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {meta ? <div className="ac-page-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="ac-page-actions">{actions}</div> : null}
    </div>
  )
}

function CardTitle({ title, subtitle, actions }) {
  return (
    <div className="ac-card-title">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="ac-card-actions">{actions}</div> : null}
    </div>
  )
}

function EmptyState({ message }) {
  return <div className="ac-empty-state">{message}</div>
}

function InlineMessage({ tone = 'muted', message }) {
  if (!message) return null
  return <div className={`ac-inline-message is-${tone}`}>{message}</div>
}

function MetricMini({ label, value, helper, theme = 'plain' }) {
  return (
    <article className={`ac-metric-card ${theme === 'primary' ? 'is-primary' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  )
}

function renderTimelineItem(item) {
  const createdAt = item?.created_at ? new Date(item.created_at).toLocaleString('en-US') : ''
  return {
    title: item?.action || item?.title || 'Audit Event',
    description: item?.message || item?.status || 'No additional operational note recorded.',
    meta: createdAt || item?.meta || 'No timestamp',
  }
}

function SummaryStat({ card, index }) {
  const iconMap = {
    total: 'chart',
    booked: 'calendar',
    confirmed: 'check',
    checked_in: 'user',
    in_consultation: 'clock',
    completed: 'check',
    cancelled: 'cancel',
    no_show: 'slash',
    rescheduled: 'shuffle',
  }

  return (
    <article className={`ac-summary-stat ${index === 0 ? 'is-primary is-large' : ''}`} data-key={card.key}>
      <div className="ac-summary-stat-head">
        <span className="ac-summary-icon">
          <Icon name={iconMap[card.key] || 'chart'} />
        </span>
        <em>{card.label}</em>
      </div>
      <strong>{card.value}</strong>
      {index === 0 ? <p>+12% vs last week</p> : null}
    </article>
  )
}

function InfoTile({ icon, label, value, helper }) {
  return (
    <div className="ac-info-tile">
      <span className="ac-info-icon">
        <Icon name={icon} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{helper}</p>
      </div>
    </div>
  )
}

function MiniInfoCard({ label, value, helper, accent = '' }) {
  return (
    <div className={`ac-mini-card ${accent ? `is-${accent}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </div>
  )
}

function getLifecycleHero(rawStatus, detail) {
  const base = {
    title: 'Assign Queue & Triage',
    description:
      'Patient has arrived. Verify identity, insurance and operational readiness before assigning the queue ticket.',
    cta: 'Print Ticket',
  }

  if (rawStatus === 'confirmed') {
    return {
      ...base,
      description:
        'Appointment has been confirmed. Staff can now proceed to check-in, assign the queue and prepare the encounter handoff.',
    }
  }

  if (rawStatus === 'checked_in') {
    return {
      ...base,
      title: 'Check-In Completed',
      description:
        'Patient is checked in. Maintain queue visibility, verify room allocation and keep lifecycle events synchronized.',
    }
  }

  if (rawStatus === 'in_consultation') {
    return {
      ...base,
      title: 'Consultation In Progress',
      description:
        'Encounter has started. Continue monitoring status transitions and avoid duplicate updates while consultation is active.',
    }
  }

  if (rawStatus === 'completed') {
    return {
      ...base,
      title: 'Completed Appointment',
      description:
        'Appointment lifecycle is closed. Staff can still review the audit trail, linked encounter and historical updates.',
    }
  }

  if (rawStatus === 'cancelled') {
    return {
      ...base,
      title: 'Cancelled Workflow',
      description:
        'This appointment is cancelled. Review cancellation notes and reschedule only when a new operational slot is validated.',
    }
  }

  if (rawStatus === 'rescheduled') {
    return {
      ...base,
      title: 'Rescheduled Appointment',
      description:
        'A new time has been assigned. Review the latest schedule decision and confirm the revised patient journey.',
    }
  }

  if (rawStatus === 'no_show') {
    return {
      ...base,
      title: 'No-Show Handling',
      description:
        'Patient did not arrive for the scheduled time. Record the event, preserve audit evidence and decide on rebooking.',
    }
  }

  return {
    ...base,
    description:
      detail?.queueNumber && detail.queueNumber !== '--'
        ? 'Queue assignment already exists. Verify front-desk workflow and continue operational triage.'
        : base.description,
  }
}

function buildConflictTimeColumns(conflictData, suggestions) {
  const source = new Set()

  if (conflictData?.appointmentTime) {
    const current = new Date(conflictData.appointmentTime)
    if (!Number.isNaN(current.getTime())) {
      ;[-60, -30, 0, 30, 60, 90].forEach((offset) => {
        const next = new Date(current.getTime() + offset * 60000)
        source.add(next.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
      })
    }
  }

  suggestions.forEach((item) => {
    if (item?.time) source.add(item.time)
  })

  return Array.from(source).slice(0, 6)
}

export function AppointmentListScreen({
  quickView,
  onChangeQuickView,
  filters,
  onFilterChange,
  activeFilterChips,
  appointments,
  pagination,
  loading,
  error,
  patientOptions,
  doctorOptions,
  departmentOptions,
  listMetrics,
  canWriteAppointments,
  doctorNotice,
  onOpenCreate,
  onOpenDetail,
  onOpenLifecycle,
}) {
  const page = pagination?.page || 1
  const totalPages = pagination?.total_pages || 1
  const totalItems = pagination?.total || appointments.length

  return (
    <div className="ac-screen-stack">
      <PageHeader
        title="Danh sách lịch hẹn"
        subtitle="Quản lý vận hành và kiếm soát lịch hẹn thời gian thực."
        actions={
          <div className="ac-header-actions">
            {canWriteAppointments && (
              <button type="button" className="ac-primary-button" onClick={onOpenCreate}>
                + Tạo lịch hẹn mới
              </button>
            )}
            <div className="ac-segmented">
              {quickViews.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={`ac-segmented-button ${quickView === view.id ? 'is-active' : ''}`}
                  onClick={() => onChangeQuickView(view.id)}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <section className="ac-filter-board">
        <article className="ac-filter-card ac-filter-wide">
          <span className="ac-filter-label">Mã định danh bệnh nhân</span>
          <div className="ac-filter-input">
            <Icon name="search" />
            <input
              value={filters.search}
              onChange={(event) => onFilterChange('search', event.target.value)}
              placeholder="Tên hoặc mã bệnh nhân"
            />
          </div>

          {patientOptions.length > 0 ? (
            <div className="ac-inline-selector">
              {patientOptions.slice(0, 3).map((patient) => (
                <button
                  key={patient.patient_id}
                  type="button"
                  className={`ac-inline-option ${String(filters.patientId) === String(patient.patient_id) ? 'is-active' : ''}`}
                  onClick={() =>
                    onFilterChange(
                      'patientId',
                      String(filters.patientId) === String(patient.patient_id) ? '' : patient.patient_id,
                    )
                  }
                >
                  {patient.full_name}
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="ac-filter-card">
          <span className="ac-filter-label">Khoảng ngày</span>
          <div className="ac-date-range-stack">
            <input
              className="ac-input-control"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => onFilterChange('dateFrom', event.target.value)}
            />
            <input
              className="ac-input-control"
              type="date"
              value={filters.dateTo}
              onChange={(event) => onFilterChange('dateTo', event.target.value)}
            />
          </div>
        </article>

        <article className="ac-filter-card">
          <span className="ac-filter-label">Trạng thái</span>
          <select
            className="ac-select-control"
            value={filters.status}
            onChange={(event) => onFilterChange('status', event.target.value)}
          >
            <option value="">
TẤt cả trạng thái</option>
            <option value="booked">Đã đặt</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="checked_in">Đã nhân phòng</option>
            <option value="in_consultation">Đang khám</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
            <option value="no_show">Không đến</option>
            <option value="rescheduled">Đã chuyển lịch</option>
          </select>
        </article>

        <article className="ac-filter-card">
          <span className="ac-filter-label">Bác sĩ</span>
          <select
            className="ac-select-control"
            value={filters.doctorId}
            onChange={(event) => onFilterChange('doctorId', event.target.value)}
          >
            <option value="">Tất cả bác sĩ</option>
            {doctorOptions.map((doctor) => (
              <option key={doctor.user_id} value={doctor.user_id}>
                {doctor.full_name || doctor.username}
              </option>
            ))}
          </select>
        </article>

        <article className="ac-filter-card">
          <span className="ac-filter-label">Khoa phòng</span>
          <select
            className="ac-select-control"
            value={filters.departmentId}
            onChange={(event) => onFilterChange('departmentId', event.target.value)}
          >
            <option value="">Tất cả khoa</option>
            {departmentOptions.map((department) => (
              <option key={department.department_id} value={department.department_id}>
                {department.department_name}
              </option>
            ))}
          </select>
        </article>
      </section>

      {doctorNotice ? <InlineMessage tone="info" message={doctorNotice} /> : null}

      <section className="ac-panel ac-list-panel">
        <CardTitle
          title="Hàng xếp bệnh nhân"
          subtitle={`${totalItems} hoạt động`}
          actions={
            <div className="ac-card-actions">
              <button type="button" className="ac-icon-button" aria-label="Filter view">
                <Icon name="filter" />
              </button>
              <button type="button" className="ac-icon-button" aria-label="Download queue">
                <Icon name="download" />
              </button>
            </div>
          }
        />

        {activeFilterChips.length > 0 ? (
          <div className="ac-chip-strip">
            {activeFilterChips.map((chip) => (
              <span key={chip} className="ac-inline-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        {loading ? <EmptyState message="Đang tải lịch hẹn..." /> : null}
        {!loading && error ? <InlineMessage tone="error" message={error} /> : null}

        {!loading && !error ? (
          <>
            <div className="ac-table-wrap">
              <table className="ac-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Tên bệnh nhân</th>
                    <th>Bác sĩ</th>
                    <th>Khoa phòng</th>
                    <th>Trạng thái</th>
                    <th>Số xếp hàng</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((row) => {
                    const isAttention = ['cancelled', 'no_show'].includes(row.status)

                    return (
                      <tr key={row.appointmentId}>
                        <td>
                          <div className={`ac-time-block ${isAttention ? 'is-alert' : ''}`}>
                            <strong>{row.timeLabel}</strong>
                            <span>{row.dateLabel}</span>
                          </div>
                        </td>
                        <td>
                          <div className="ac-person-cell">
                            <AvatarChip initials={row.patientName.slice(0, 2).toUpperCase()} tone={isAttention ? 'dark' : 'blue'} />
                            <div>
                              <div className="ac-person-name">{row.patientName}</div>
                              <div className="ac-person-meta">{row.patientCode}</div>
                            </div>
                          </div>
                        </td>
                        <td>{row.doctorName}</td>
                        <td>
                          <span className="ac-table-tag">{row.departmentName}</span>
                        </td>
                        <td>
                          <StatusPill status={row.status} />
                        </td>
                        <td>{row.queueNumber}</td>
                        <td>
                          <div className="ac-row-actions">
                            <button type="button" className="ac-row-button" onClick={() => onOpenDetail(row.appointmentId)}>
                              <Icon name="eye" />
                            </button>
                            <button type="button" className="ac-row-button" onClick={() => onOpenLifecycle(row.appointmentId)}>
                              <Icon name="edit" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {appointments.length === 0 ? <EmptyState message="Không tìm thấy lịch hẹn cho phạm vi vận hành được chọn." /> : null}

            <div className="ac-table-footer">
              <span>Hiển thị trang {page} của {totalPages} trong {totalItems} lịch hẹn</span>
              <div className="ac-pagination">
                <button
                  type="button"
                  className="ac-page-dot is-muted"
                  disabled={page <= 1}
                  onClick={() => onFilterChange('page', Math.max(1, page - 1))}
                >
                  {'<'}
                </button>
                <button type="button" className="ac-page-dot">
                  {page}
                </button>
                <button
                  type="button"
                  className="ac-page-dot is-muted"
                  disabled={page >= totalPages}
                  onClick={() => onFilterChange('page', Math.min(totalPages, page + 1))}
                >
                  {'>'}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="ac-list-metrics">
        <MetricMini {...listMetrics[0]} theme="primary" />
        <MetricMini {...listMetrics[1]} />
        <MetricMini {...listMetrics[2]} />
      </section>

      {!canWriteAppointments ? (
        <InlineMessage
          tone="warning"
          message="Current account is read-only for appointment creation and lifecycle updates. Use a staff account with appointments.write for operational actions."
        />
      ) : null}
    </div>
  )
}

export function AppointmentCreateScreen({
  canWriteAppointments,
  form,
  onChangeForm,
  selectedPatient,
  selectedPatientSummary,
  patientBookingState,
  patientLoading,
  patientError,
  patientOptions,
  onSelectPatient,
  departmentOptions,
  doctorOptions,
  doctorNotice,
  schedules,
  slots,
  slotLoading,
  slotError,
  onSelectSlot,
  duplicateState,
  precheckState,
  actionState,
  onBack,
  onOpenConflict,
  onSubmit,
}) {
  const scheduleDays = Array.from(new Set((schedules || []).map((item) => item.work_date))).filter(Boolean)
  const visibleDays = scheduleDays.length ? scheduleDays : [form.appointmentDate]
  const activeDay = form.appointmentDate
  const visibleSlots = slots.filter(
    (slot) => slot.is_available && formatDateLabel(slot.slot_time) === formatDateLabel(activeDay),
  )

  const selectedDoctorName =
    doctorOptions.find((doctor) => String(doctor.user_id) === String(form.doctorId))?.full_name || '--'

  const recentActivity =
    selectedPatientSummary?.last_encounter?.encounter_code ||
    selectedPatientSummary?.last_prescription?.prescription_code ||
    'No recent clinical activity recorded'

  return (
    <div className="ac-screen-stack">
      <PageHeader
        title="Tạo lịch hẹn"
        subtitle="Lến lịch tư vấn lâm sàng mới cho bệnh nhân hiện tại hoặc mới."
      />

      {!canWriteAppointments ? (
        <InlineMessage
          tone="warning"
          message="Tài khoản hiện tại không có quyền đặt lịch theo createAppointmentByStaff. Xác thực trước đặt lịch vẫn có sẵn trong chế độ chỉ đọc."
        />
      ) : null}

      <div className="ac-two-column">
        <div className="ac-screen-stack">
          <section className="ac-panel">
            <CardTitle title="Xác định bệnh nhân" actions={<button type="button" className="ac-text-action">Thêm nhanh bệnh nhân mới</button>} />

            <div className="ac-search-field">
              <Icon name="search" />
              <input
                value={form.patientSearch}
                onChange={(event) => onChangeForm('patientSearch', event.target.value)}
                placeholder="Tìm kiếm bệnh nhân theo tên, mã, điện thoại hoặc email"
              />
            </div>

            {patientOptions.length > 0 ? (
              <div className="ac-option-list">
                {patientOptions.map((patient) => (
                  <button
                    key={patient.patient_id}
                    type="button"
                    className={`ac-option-item ${String(form.patientId) === String(patient.patient_id) ? 'is-active' : ''}`}
                    onClick={() => onSelectPatient(patient)}
                  >
                    <strong>{patient.full_name}</strong>
                    <span>{patient.patient_code || patient.email || patient.phone}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {patientLoading ? <InlineMessage tone="info" message="Đang tải hồ sơ bệnh nhân..." /> : null}
            {patientError ? <InlineMessage tone="error" message={patientError} /> : null}

            {duplicateState.data?.has_duplicate ? (
              <div className="ac-danger-banner">
                <div className="ac-danger-icon">
                  <Icon name="alert" />
                </div>
                <div>
                  <strong>Có thể có sự đặt lịch trẫng lặp</strong>
                  <p>Bệnh nhân này đã có lịch hẹn khác gần khoảng thời gian yêu cầu. Kiểm tra xung đột trước khi đặt lịch.</p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="ac-panel">
            <CardTitle
              title="Chi tiết lâm sàng"
              actions={
                <button type="button" className="ac-outline-button is-small" onClick={onOpenConflict}>
                  <Icon name="spark" />
                  Kiểm tra xung đột
                </button>
              }
            />

            <div className="ac-form-grid">
              <div className="ac-form-block">
                <span>Chọn khoa phòng</span>
                <select
                  className="ac-select-control"
                  value={form.departmentId}
                  onChange={(event) => onChangeForm('departmentId', event.target.value)}
                >
                  <option value="">Chọn khoa phòng</option>
                  {departmentOptions.map((department) => (
                    <option key={department.department_id} value={department.department_id}>
                      {department.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ac-form-block">
                <span>Bác sĩ được giao</span>
                <select
                  className="ac-select-control"
                  value={form.doctorId}
                  onChange={(event) => onChangeForm('doctorId', event.target.value)}
                >
                  <option value="">Chọn bác sĩ</option>
                  {doctorOptions.map((doctor) => (
                    <option key={doctor.user_id} value={doctor.user_id}>
                      {doctor.full_name || doctor.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <InlineMessage tone="info" message={doctorNotice} />
            {slotLoading ? <InlineMessage tone="info" message="Đang tải tính khả dụng của bác sĩ..." /> : null}
            {slotError ? <InlineMessage tone="error" message={slotError} /> : null}

            <div className="ac-slot-block">
              <span className="ac-filter-label">Chọn khoảng thời gian có sẵn</span>

              <div className="ac-day-selector">
                {visibleDays.map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={`ac-day-pill ${String(activeDay) === String(day).slice(0, 10) ? 'is-active' : ''}`}
                    onClick={() => onChangeForm('appointmentDate', String(day).slice(0, 10))}
                  >
                    <span>{formatDayShort(day)}</span>
                    <strong>{formatDayNumber(day)}</strong>
                  </button>
                ))}
              </div>

              <div className="ac-slot-selector">
                {visibleSlots.map((slot) => {
                  const slotValue = formatTimeSlot(slot.slot_time)
                  const selected =
                    String(form.doctorScheduleId) === String(slot.doctor_schedule_id) &&
                    String(form.appointmentTime) === slotValue

                  return (
                    <button
                      key={`${slot.doctor_schedule_id}-${slot.slot_time}`}
                      type="button"
                      className={`ac-slot-pill ${selected ? 'is-active' : ''}`}
                      onClick={() => onSelectSlot(slot)}
                    >
                      {slotValue}
                    </button>
                  )
                })}
              </div>

              {!slotLoading && visibleSlots.length === 0 ? (
                <EmptyState message="Không tìm thấy khoảng thời gian có sẵn cho bác sĩ, khoa phòng và ngày hiện tại." />
              ) : null}
            </div>
          </section>

          <section className="ac-panel">
            <CardTitle title="Lí do khám / Các triệu chứng" />
            <textarea
              className="ac-textarea-control"
              value={form.reason}
              onChange={(event) => onChangeForm('reason', event.target.value)}
              placeholder="Nhập lý do lâm sàng..."
            />
            <textarea
              className="ac-textarea-control secondary"
              value={form.notes}
              onChange={(event) => onChangeForm('notes', event.target.value)}
              placeholder="Ghi chú vận hành cho tiếp tân, bác sĩ hoặc nhân viên xếp hàng"
            />

            {precheckState.error ? <InlineMessage tone="error" message={precheckState.error} /> : null}
            {precheckState.data?.blockingReasons?.length > 0 ? (
              <InlineMessage tone="warning" message={precheckState.data.blockingReasons.join(' | ')} />
            ) : null}
          </section>
        </div>

        <aside className="ac-side-column">
          <section className="ac-profile-card">
            <div className="ac-profile-cover" />
            <div className="ac-profile-head">
              <AvatarChip initials={(selectedPatient?.full_name || 'PT').slice(0, 2).toUpperCase()} tone="teal" />
              <div>
                <h3>{selectedPatient?.full_name || 'Chọn bệnh nhân'}</h3>
                <p>{selectedPatient?.patient_code || 'Chưa chọn bệnh nhân nào'}</p>
              </div>
            </div>

            <div className="ac-profile-list">
              <div>
                <Icon name="calendar" />
                <span>{selectedPatient?.date_of_birth || 'Ngày sinh không có sẵn'}</span>
              </div>
              <div>
                <Icon name="phone" />
                <span>{selectedPatient?.phone || 'Điện thoại không có sẵn'}</span>
              </div>
              <div>
                <Icon name="mail" />
                <span>{selectedPatient?.email || 'Email không có sẵn'}</span>
              </div>
            </div>
          </section>

          <section className="ac-panel compact">
            <CardTitle title="Thông tin bảo hiểm" />
            <div className="ac-summary-row-card">
              <strong>{selectedPatient?.insurance_number || 'Bảo hiểm chưa được liên kết'}</strong>
              <span>{patientBookingState?.can_book ? 'HOẠT ĐỘNG' : 'CHỜ XEM XÉT'}</span>
              <em>{patientBookingState?.status || 'Chưa xác minh khả năng được hối lộ'}</em>
            </div>
          </section>

          <section className="ac-panel compact">
            <CardTitle title="Hoạt động gần đây" />
            <div className="ac-activity-card">
              <strong>{recentActivity}</strong>
              <span>
                {selectedPatientSummary?.appointments_count || 0} lịch hẹn và {selectedPatientSummary?.encounters_count || 0} cuộc gặp
              </span>
            </div>
          </section>

          <section className="ac-summary-card-large">
            <h3>Tóm tắt</h3>
            <div className="ac-summary-list">
              <div>
                <span>Ngày</span>
                <strong>{form.appointmentDate || '--'}</strong>
              </div>
              <div>
                <span>Khoảng thời gian</span>
                <strong>{form.appointmentTime || '--'}</strong>
              </div>
              <div>
                <span>Bác sĩ</span>
                <strong>{selectedDoctorName}</strong>
              </div>
              <div>
                <span>Phí dịch vụ</span>
                <strong>{form.appointmentType === 'procedure' ? '$240.00' : '$120.00'}</strong>
              </div>
            </div>

            {actionState.error ? <InlineMessage tone="error" message={actionState.error} /> : null}
            {actionState.success ? <InlineMessage tone="success" message={actionState.success} /> : null}

            <button type="button" className="ac-primary-button ac-wide-button" disabled={!canWriteAppointments} onClick={onSubmit}>
              Đặt lịch
            </button>
            <button type="button" className="ac-ghost-button ac-wide-button" onClick={onBack}>
              Trở về danh sách
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}

export function AppointmentDetailScreen({
  detail,
  timeline,
  loading,
  error,
  canWriteAppointments,
  onBack,
  onOpenCreate,
  onOpenLifecycle,
}) {
  if (loading) return <EmptyState message="Loading appointment detail..." />
  if (error) return <InlineMessage tone="error" message={error} />
  if (!detail) return <EmptyState message="Select an appointment from the queue to view its detail." />

  return (
    <div className="ac-screen-stack">
      <PageHeader
        eyebrow="Lịch hẹn / Chi tiết"
        title={`#${detail.appointmentId}`}
        subtitle=""
        meta={
          <div className="ac-page-status-row">
            <StatusPill status={detail.status} />
            <span>{detail.updatedAt}</span>
          </div>
        }
        actions={
          <div className="ac-detail-actions">
            <button type="button" className="ac-outline-button is-small" onClick={() => window.print()}>
              <Icon name="print" />
              In đơn
            </button>
            <button type="button" className="ac-outline-button is-small" onClick={onOpenLifecycle}>
              <Icon name="edit" />
              Chỉnh sửa
            </button>
            <button type="button" className="ac-danger-button is-small" onClick={onOpenLifecycle}>
              <Icon name="cancel" />
              Hủy
            </button>
          </div>
        }
      />

      {!canWriteAppointments ? (
        <InlineMessage tone="warning" message="Tài khoản hiện tại có thể xem chỉ tiết nhưng không thể thay đổi dữ liệu lịch hẹn." />
      ) : null}

      <div className="ac-detail-layout">
        <div className="ac-screen-stack">
          <section className="ac-panel">
            <CardTitle title="Thông tin lịch hẹn" />
            <div className="ac-info-grid">
              <InfoTile icon="calendar" label="Ngày & Giờ" value={detail.date} helper={detail.time} />
              <InfoTile icon="user" label="Chi tiết bệnh nhân" value={detail.patientName} helper={detail.patientMeta} />
              <InfoTile icon="doctor" label="Bác sĩ được giao" value={detail.physician} helper={detail.physicianMeta} />
              <InfoTile icon="pin" label="Khoa phòng" value={detail.department} helper={detail.departmentMeta} />
            </div>
          </section>

          <section className="ac-mini-grid">
            <MiniInfoCard label="Vé xếp hàng" value={detail.queueTicket} helper={detail.queueMeta} accent="blue" />
            <MiniInfoCard label="ID cuộc gặp" value={detail.encounterId} helper={detail.encounterMeta} />
            <MiniInfoCard
              label="Nhà cung cấp bảo hiểm"
              value={detail.insuranceProvider || detail.appointmentType}
              helper={detail.insuranceMeta || `Nguồn: ${detail.source}`}
            />
          </section>

          <section className="ac-panel">
            <CardTitle title="Lý do khám" />
            <blockquote className="ac-quote">{detail.reason}</blockquote>
            {detail.notes ? <div className="ac-note-box">{detail.notes}</div> : null}
          </section>

          <div className="ac-inline-link-row">
            <button type="button" className="ac-primary-button" onClick={onOpenCreate}>
              Tạo lịch hẹn
            </button>
            <button type="button" className="ac-ghost-button" onClick={onBack}>
              Trở về
            </button>
          </div>
        </div>

        <aside className="ac-audit-column">
          <section className="ac-panel ac-audit-panel">
            <CardTitle title="Nhật ký kiểm tra" />
            <div className="ac-audit-list">
              {timeline.map((item, index) => {
                const viewModel = renderTimelineItem(item)

                return (
                  <div key={`${viewModel.title}-${viewModel.meta}-${index}`} className="ac-audit-item">
                    <span className="ac-audit-node" />
                    <div>
                      <strong>{viewModel.title}</strong>
                      <p>{viewModel.description}</p>
                      <span>{viewModel.meta}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {timeline.length === 0 ? <EmptyState message="Chưa có lịch sử kiểm tra nào được ghi lại cho lịch hẹn này." /> : null}

            <div className="ac-security-box">
              <div className="ac-security-head">
                <Icon name="shield" />
                <span>Nhật ký bảo mật</span>
              </div>
              <p>Hồ sơ này được bảo vệ bởi lịch sử kiểm tra backend. Cập nhật vận hành vẫn có nhìn thấy được để xem xét tuân thủ.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export function AppointmentLifecycleScreen({
  detail,
  rawStatus,
  timeline,
  checks,
  form,
  onChangeForm,
  state,
  loading,
  error,
  canWriteAppointments,
  onSubmitUpdate,
  onRunAction,
  onOpenCreate,
  onBack,
}) {
  if (loading) return <EmptyState message="Loading lifecycle data..." />
  if (error) return <InlineMessage tone="error" message={error} />
  if (!detail) return <EmptyState message="Open an appointment first to process its lifecycle." />

  const hero = getLifecycleHero(rawStatus, detail)
  const nextTransitions = lifecycleTransitions[rawStatus] || []

  return (
    <div className="ac-screen-stack">
      <PageHeader
        eyebrow={
          <button type="button" className="ac-back-link" onClick={onBack}>
            <Icon name="chevron-left" />
            Trở lại lịch
          </button>
        }
        title="Vòng đời lịch hẹn"
        subtitle={`Xử lý lịch hẹn ${detail.queueNumber !== '--' ? detail.queueNumber : detail.patientName}`}
      />

      <div className="ac-lifecycle-toolbar">
        {lifecycleActions.map((action) => {
          const isCurrent = action.id === rawStatus
          const enabled =
            isCurrent ||
            (action.id === 'confirmed' && nextTransitions.includes('confirmed')) ||
            (action.id === 'checked_in' && checks?.canCheckIn) ||
            (action.id === 'rescheduled' && checks?.canReschedule) ||
            (action.id === 'cancelled' && checks?.canCancel) ||
            (action.id === 'no_show' && nextTransitions.includes('no_show')) ||
            (action.id === 'completed' && nextTransitions.includes('completed'))

          return (
            <button
              key={action.id}
              type="button"
              className={`ac-lifecycle-action ${isCurrent ? 'is-current' : ''}`}
              disabled={!enabled || !canWriteAppointments}
              onClick={() => onRunAction(action.id)}
            >
              <Icon name={action.icon} />
              {action.label}
            </button>
          )
        })}
      </div>

      {!canWriteAppointments ? (
        <InlineMessage tone="warning" message="Các hành động vòng đời bị khóa vì tài khoản hiện tại không có appointments.write." />
      ) : null}
      {state.error ? <InlineMessage tone="error" message={state.error} /> : null}
      {state.success ? <InlineMessage tone="success" message={state.success} /> : null}

      <div className="ac-detail-layout">
        <div className="ac-screen-stack">
          <section className="ac-lifecycle-hero">
            <div className="ac-lifecycle-hero-copy">
              <span className="ac-hero-chip">Cập ngoạt hiện tại</span>
              <h2>{hero.title}</h2>
              <p>{hero.description}</p>
              <div className="ac-queue-box">
                <span>ID xếp hàng</span>
                <strong>{detail.queueNumber}</strong>
              </div>
            </div>

            <button type="button" className="ac-hero-button" onClick={() => window.print()}>
              {hero.cta}
            </button>
          </section>

          <section className="ac-panel">
            <CardTitle title="Lịch sử vòng đời" />
            <div className="ac-lifecycle-history">
              {timeline.map((item, index) => {
                const viewModel = renderTimelineItem(item)

                return (
                  <div key={`${viewModel.title}-${index}`} className={`ac-history-item ${index === 0 ? 'is-active' : ''}`}>
                    <span className="ac-history-node" />
                    <div>
                      <strong>{viewModel.title}</strong>
                      <p>{viewModel.description}</p>
                      <span>{viewModel.meta}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {timeline.length === 0 ? <EmptyState message="Chưa có lịch sử vòng đời nào được ghi lại." /> : null}
          </section>

          <section className="ac-panel">
            <CardTitle title="Cập nhật vận hành" />
            <div className="ac-form-grid">
              <div className="ac-form-block">
                <span>Lý do</span>
                <textarea
                  className="ac-textarea-control compact"
                  value={form.reason}
                  onChange={(event) => onChangeForm('reason', event.target.value)}
                  placeholder="Cập nhật lí do lâm sàng"
                />
              </div>
              <div className="ac-form-block">
                <span>Ghi chú</span>
                <textarea
                  className="ac-textarea-control compact"
                  value={form.notes}
                  onChange={(event) => onChangeForm('notes', event.target.value)}
                  placeholder="Ghi chú vận hàng"
                />
              </div>
              <div className="ac-form-block">
                <span>Ngày chuyển lịch</span>
                <input
                  className="ac-input-control"
                  type="date"
                  value={form.appointmentDate}
                  onChange={(event) => onChangeForm('appointmentDate', event.target.value)}
                />
              </div>
              <div className="ac-form-block">
                <span>Giờ chuyển lịch</span>
                <input
                  className="ac-input-control"
                  type="time"
                  value={form.appointmentTime}
                  onChange={(event) => onChangeForm('appointmentTime', event.target.value)}
                />
              </div>
            </div>

            <div className="ac-inline-link-row">
              <button type="button" className="ac-primary-button" disabled={!canWriteAppointments || state.loading} onClick={onSubmitUpdate}>
                Lưu cập nhật
              </button>
              <button type="button" className="ac-ghost-button" onClick={onBack}>
                Quay lại
              </button>
            </div>
          </section>
        </div>

        <aside className="ac-side-column">
          <section className="ac-panel compact">
            <div className="ac-patient-summary">
              <AvatarChip initials={detail.patientName.slice(0, 2).toUpperCase()} tone="dark" />
              <div>
                <strong>{detail.patientName}</strong>
                <span>{detail.patientMeta}</span>
              </div>
            </div>

            <div className="ac-summary-list">
              <div>
                <span>Loại lịch hẹn</span>
                <strong>{detail.appointmentType}</strong>
              </div>
              <div>
                <span>Thời lượng</span>
                <strong>{detail.duration}</strong>
              </div>
              <div>
                <span>Bảo hiểm</span>
                <strong>{detail.insurance}</strong>
              </div>
            </div>
          </section>

          <section className="ac-panel compact">
            <CardTitle title="Cấp phát tài nguyên" />
            <div className="ac-resource-list">
              <div className="ac-resource-card">
                <span>Bác sĩ chín</span>
                <strong>{detail.primaryPhysician}</strong>
              </div>
              <div className="ac-resource-card">
                <span>Phòng được giao</span>
                <strong>{detail.room}</strong>
              </div>
            </div>
          </section>

          <section className="ac-panel compact">
            <CardTitle title="Hành động tương lai" />
            <div className="ac-future-actions">
              {(nextTransitions.length ? nextTransitions : ['review']).map((transition) => (
                <span key={transition}>{transition.replaceAll('_', ' ')}</span>
              ))}
            </div>
            <button type="button" className="ac-round-action" onClick={onOpenCreate}>
              <Icon name="calendar" />
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}

export function AppointmentSummaryScreen({
  summaryRange,
  onChangeSummaryRange,
  filters,
  onChangeFilter,
  summaryCards,
  departmentDistribution,
  doctorProductivity,
  footerMetrics,
  loading,
  error,
  doctorOptions,
  departmentOptions,
}) {
  return (
    <div className="ac-screen-stack">
      <PageHeader
        title="Tóm tắt chiến lược"
        subtitle="Các số liệu hiệu suất vận hành thời gian thực và dung lượng chẩn đoán."
        actions={
          <div className="ac-segmented">
            {summaryRanges.map((range) => (
              <button
                key={range}
                type="button"
                className={`ac-segmented-button ${summaryRange === range.toLowerCase() ? 'is-active' : ''}`}
                onClick={() => onChangeSummaryRange(range.toLowerCase())}
              >
                {range}
              </button>
            ))}
          </div>
        }
      />

      <section className="ac-summary-controls">
        <input
          className="ac-input-control"
          type="date"
          value={filters.date}
          onChange={(event) => onChangeFilter('date', event.target.value)}
        />
        <select
          className="ac-select-control"
          value={filters.doctorId}
          onChange={(event) => onChangeFilter('doctorId', event.target.value)}
        >
          <option value="">All Doctors</option>
          {doctorOptions.map((doctor) => (
            <option key={doctor.user_id} value={doctor.user_id}>
              {doctor.full_name || doctor.username}
            </option>
          ))}
        </select>
        <select
          className="ac-select-control"
          value={filters.departmentId}
          onChange={(event) => onChangeFilter('departmentId', event.target.value)}
        >
          <option value="">All Departments</option>
          {departmentOptions.map((department) => (
            <option key={department.department_id} value={department.department_id}>
              {department.department_name}
            </option>
          ))}
        </select>
      </section>

      {loading ? <EmptyState message="Đang tải tóm tắt lịch hẹn..." /> : null}
      {error ? <InlineMessage tone="error" message={error} /> : null}

      {!loading && !error ? (
        <>
          <section className="ac-summary-grid">
            {summaryCards.map((card, index) => (
              <SummaryStat key={card.key} card={card} index={index} />
            ))}
          </section>

          <div className="ac-summary-layout">
            <section className="ac-panel">
              <CardTitle title="Phân bố khoa phòng" subtitle="Khối lượng lịch hẹn theo chuyên khoa y tế" actions={<button type="button" className="ac-text-action">Xem chi tiết</button>} />
              <div className="ac-bars">
                {departmentDistribution.map((item) => (
                  <div key={item.label} className="ac-bar-column">
                    <div className="ac-bar-track">
                      <div className="ac-bar-value" style={{ height: `${Math.max(18, item.value)}%` }} />
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              {departmentDistribution.length === 0 ? <EmptyState message="Không có dữ liệu tóm tắt khoa phòng." /> : null}
            </section>

            <section className="ac-panel">
              <CardTitle title="Năng suất nhân viên" />
              <div className="ac-productivity-list">
                {doctorProductivity.map((doctor) => (
                  <div key={doctor.name} className="ac-productivity-item">
                    <div className="ac-productivity-head">
                      <div className="ac-person-cell compact">
                        <AvatarChip initials={doctor.name.slice(0, 2).toUpperCase()} tone="teal" />
                        <span>{doctor.name}</span>
                      </div>
                      <strong>{doctor.value}%</strong>
                    </div>
                    <div className="ac-progress-bar">
                      <div className="ac-progress-fill" style={{ width: `${doctor.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {doctorProductivity.length === 0 ? <EmptyState message="Không có dữ liệu năng suất bác sĩ." /> : null}
            </section>
          </div>

          <section className="ac-list-metrics summary">
            {footerMetrics.map((metric) => (
              <MetricMini key={metric.label} label={metric.label} value={metric.value} helper={metric.helper} />
            ))}
          </section>
        </>
      ) : null}
    </div>
  )
}

export function AppointmentConflictScreen({
  canWriteAppointments,
  loading,
  error,
  conflictData,
  suggestions,
  context,
  onBack,
  onOpenCreate,
  onConfirmSlot,
}) {
  const blockingReasons = conflictData?.blockingReasons || []
  const timeColumns = buildConflictTimeColumns(conflictData, suggestions)
  const requestedTime = conflictData?.appointmentTime ? formatTimeSlot(conflictData.appointmentTime) : '--'

  if (loading) return <EmptyState message="Running pre-booking checks..." />
  if (error) return <InlineMessage tone="error" message={error} />
  if (!conflictData) {
    return <EmptyState message="Run pre-booking checks from the create screen to populate this conflict console." />
  }

  return (
    <div className="ac-screen-stack">
      <PageHeader
        title="Conflict Checker"
        subtitle={`Validating appointment for Patient: ${context?.patientName || '--'} with ${context?.doctorName || '--'} for ${context?.departmentName || 'selected department'}.`}
        actions={
          <div className="ac-detail-actions">
            <button type="button" className="ac-outline-button is-small" onClick={onOpenCreate}>
              Reschedule Slot
            </button>
            <button type="button" className="ac-primary-button is-small" disabled={!canWriteAppointments || blockingReasons.length > 0} onClick={onConfirmSlot}>
              Force Override
            </button>
          </div>
        }
      />

      {!canWriteAppointments ? (
        <InlineMessage tone="warning" message="No backend override endpoint exists. Conflict resolution remains advisory for this account." />
      ) : null}

      <div className={`ac-conflict-alert ${blockingReasons.length === 0 ? 'is-success' : ''}`}>
        <div className="ac-conflict-alert-head">
          <span className="ac-danger-icon">
            <Icon name={blockingReasons.length === 0 ? 'check' : 'alert'} />
          </span>
          <div>
            <strong>{blockingReasons.length > 0 ? 'Multiple Conflicts Detected' : 'No Blocking Conflict Detected'}</strong>
            <p>
              {blockingReasons.length > 0
                ? blockingReasons.join(' | ')
                : 'Doctor availability, time validation, slot validation and patient duplicate checks passed.'}
            </p>
          </div>
        </div>
        <button type="button" className="ac-inline-close" aria-label="Close">
          <Icon name="cancel" />
        </button>
      </div>

      <div className="ac-conflict-layout">
        <div className="ac-screen-stack">
          <section className="ac-panel">
            <CardTitle
              title="Visual Conflict Matrix"
              actions={
                <div className="ac-matrix-legend">
                  <span><i className="is-proposed" /> Proposed</span>
                  <span><i className="is-conflict" /> Conflict</span>
                  <span><i className="is-available" /> Available</span>
                </div>
              }
            />

            <div className="ac-matrix">
              <div className="ac-matrix-header">
                <span />
                {timeColumns.map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>

              <div className="ac-matrix-row">
                <div className="ac-matrix-person">
                  <strong>{context?.doctorName || 'Doctor'}</strong>
                  <span>Physician</span>
                </div>
                {timeColumns.map((column, index) => (
                  <div key={`doctor-${column}`} className="ac-matrix-cell">
                    {column === requestedTime ? (
                      <div className="ac-matrix-block is-conflict">
                        <strong>{context?.departmentShort || 'Booked'}</strong>
                        <span>Overlap</span>
                      </div>
                    ) : index === timeColumns.length - 1 ? (
                      <div className="ac-matrix-block is-available">
                        <strong>Open</strong>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="ac-matrix-row">
                <div className="ac-matrix-person">
                  <strong>{context?.patientName || 'Patient'}</strong>
                  <span>Patient</span>
                </div>
                {timeColumns.map((column, index) => (
                  <div key={`patient-${column}`} className="ac-matrix-cell">
                    {column === requestedTime ? (
                      <div className="ac-matrix-block is-proposed">
                        <strong>Selected</strong>
                        <span>{requestedTime}</span>
                      </div>
                    ) : index === 0 ? (
                      <div className="ac-matrix-block is-conflict alt">
                        <strong>Booked</strong>
                        <span>Overlap</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="ac-conflict-card-grid">
            <section className="ac-panel compact">
              <div className="ac-conflict-card">
                <span className="ac-conflict-dot is-red" />
                <div>
                  <strong>Doctor Conflict</strong>
                  <p>{conflictData.doctorConflict.data?.message || 'Doctor conflict check passed.'}</p>
                </div>
              </div>
            </section>

            <section className="ac-panel compact">
              <div className="ac-conflict-card">
                <span className="ac-conflict-dot is-red" />
                <div>
                  <strong>Patient Conflict</strong>
                  <p>
                    {conflictData.patientConflict.data?.has_conflict
                      ? 'Patient already has another overlapping appointment.'
                      : 'Patient conflict check passed.'}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className="ac-warning-panel">
            <div className="ac-warning-icon">
              <Icon name="clock" />
            </div>
            <div>
              <strong>Time Validation Warning</strong>
              <p>
                {conflictData.timeValidation.ok
                  ? `Selected time ${requestedTime} passed backend validation.`
                  : conflictData.timeValidation.message}
              </p>
            </div>
          </section>
        </div>

        <aside className="ac-side-column">
          <section className="ac-panel">
            <CardTitle title="Gợi ý thông minh" subtitle="Tìm thấy các khoảng thời gian không có xung đột" />
            <div className="ac-suggestion-list">
              {suggestions.map((item, index) => (
                <div key={`${item.label}-${item.time}-${index}`} className="ac-suggestion-card">
                  <span>{index === 0 ? 'Khoảng thời gian sớm nhất' : item.label}</span>
                  <strong>{item.time}</strong>
                  <p>{item.meta}</p>
                </div>
              ))}
            </div>
            {suggestions.length === 0 ? <EmptyState message="Không có gợi Ý khoảng thời gian thay thế có sẵn từ lịch hiện tại." /> : null}
            <button type="button" className="ac-outline-button ac-wide-button" onClick={onOpenCreate}>
              Xem lịch tuần đầy đủ
            </button>
          </section>

          <section className="ac-location-card">
            <div className="ac-location-image" />
            <div className="ac-location-copy">
              <span>Địa điểm đích
</span>
              <strong>{context?.departmentName || 'Được chọn khoa'}</strong>
              <p>{context?.doctorName || 'Bác sĩ được giao'}</p>
            </div>
          </section>
        </aside>
      </div>

      <footer className="ac-bottom-bar">
        <span>Con sư người y ếu cầu các xung đột được giải quyết trước khi createAppointmentByStaff có thể tiếp tục mà không rủi ro.</span>
        <div className="ac-bottom-actions">
          <button type="button" className="ac-ghost-button" onClick={onBack}>
            Huỷ yêu cầu
          </button>
          <button type="button" className="ac-primary-button" disabled={blockingReasons.length > 0 || !canWriteAppointments} onClick={onConfirmSlot}>
            Xác nhận lịch chọn
          </button>
        </div>
      </footer>
    </div>
  )
}
