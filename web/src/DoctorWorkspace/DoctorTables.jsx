import { EmptyState, StatusBadge } from './DoctorShell'
import { formatDate, formatTime, getInitials } from './doctorData'
import { buildFallbackName } from './DoctorHooks'

function PatientCell({ patient, patientId }) {
  const label = patient?.full_name || buildFallbackName(patientId, 'Bệnh nhân')
  const sublabel = patient?.patient_code || patientId || '--'

  return (
    <div className="doctor-patient-cell">
      <span className="doctor-patient-chip">{getInitials(label) || 'PT'}</span>
      <div>
        <strong>{label}</strong>
        <span>{sublabel}</span>
      </div>
    </div>
  )
}

export function AppointmentTable({
  appointments,
  patientMap,
  canManageAppointments,
  onOpenDetail,
  onOpenEncounter,
  onAppointmentAction,
}) {
  if (!appointments.length) {
    return (
      <EmptyState
        title="Không có lịch hẹn trong phạm vi"
        description="Hãy thử khoảng ngày hoặc bộ lọc trạng thái khác để tải lịch bác sĩ."
      />
    )
  }

  return (
    <div className="doctor-table-wrap">
      <table className="doctor-table">
        <thead>
          <tr>
            <th>Giờ</th>
            <th>Bệnh nhân</th>
            <th>Loại khám</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => {
            const appointmentId = appointment.appointment_id || appointment.id
            const patientId = appointment.patient_id
            const patient = patientMap[patientId]

            return (
              <tr key={appointmentId}>
                <td>
                  <div className="doctor-table-cell-stack">
                    <strong>{formatTime(appointment.appointment_time)}</strong>
                    <span>{formatDate(appointment.appointment_time, { year: undefined })}</span>
                  </div>
                </td>
                <td>
                  <PatientCell patient={patient} patientId={patientId} />
                </td>
                <td>
                  <div className="doctor-table-cell-stack">
                    <strong>{appointment.appointment_type || appointment.visit_type || '--'}</strong>
                    <span>{appointment.reason || appointment.source || '--'}</span>
                  </div>
                </td>
                <td>
                  <StatusBadge status={appointment.status} />
                </td>
                <td>
                  <div className="doctor-inline-actions doctor-inline-actions-wrap doctor-table-actions">
                    <button className="doctor-secondary-button" type="button" onClick={() => onOpenDetail(appointmentId)}>
                      Xem
                    </button>
                    <button className="doctor-secondary-button" type="button" onClick={() => onOpenEncounter(appointment)}>
                      Mở phiên khám
                    </button>
                    {canManageAppointments ? (
                      <>
                        <button className="doctor-secondary-button" type="button" onClick={() => onAppointmentAction('confirm', appointmentId)}>
                          Xác nhận
                        </button>
                        <button className="doctor-secondary-button" type="button" onClick={() => onAppointmentAction('no-show', appointmentId)}>
                          Không đến
                        </button>
                        <button className="doctor-primary-button doctor-primary-green" type="button" onClick={() => onAppointmentAction('complete', appointmentId)}>
                          Hoàn tất
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function QueueBoardTable({
  tickets,
  patientMap,
  onRecall,
  onSkip,
  onStartService,
  onComplete,
}) {
  if (!tickets.length) {
    return (
      <EmptyState
        title="Hàng chờ hiện đang trống"
        description="Không có phiếu hàng chờ nào trong danh sách trực tiếp của ngày đã chọn."
      />
    )
  }

  return (
    <div className="doctor-queue-list">
      {tickets.map((ticket) => {
        const ticketId = ticket.queue_ticket_id || ticket.id
        const patientId = ticket.patient_id
        const patient = patientMap[patientId]
        const patientLabel = patient?.full_name || buildFallbackName(patientId, 'Bệnh nhân')
        const patientCode = patient?.patient_code || patientId || '--'

        return (
          <article key={ticketId} className="doctor-queue-row">
            <div className="doctor-queue-ticket-badge">
              <strong>{ticket.queue_number || '---'}</strong>
              <span>{ticket.priority_flag ? 'Ưu tiên' : 'Hàng chờ'}</span>
            </div>

            <div className="doctor-queue-row-main">
              <div className="doctor-queue-row-header">
                <div className="doctor-queue-patient-identity">
                  <div className="doctor-queue-row-titlebar">
                    <span className="doctor-card-eyebrow">Phiếu đang xử lý</span>
                    <StatusBadge status={ticket.status || ''} className="doctor-queue-inline-status" />
                  </div>
                  <strong>{patientLabel}</strong>
                  <p>
                    {patientCode} - {ticket.queue_type || '--'}
                  </p>
                </div>
                <div className="doctor-queue-row-time">
                  <span>Giờ vào</span>
                  <strong>{formatTime(ticket.checkin_time)}</strong>
                </div>
              </div>

              <div className="doctor-queue-row-meta">
                <div className="doctor-queue-meta-item">
                  <span>Mã phiếu</span>
                  <strong>{ticketId}</strong>
                </div>
                <div className="doctor-queue-meta-item">
                  <span>Mã bệnh nhân</span>
                  <strong>{patientCode}</strong>
                </div>
                <div className="doctor-queue-meta-item">
                  <span>Loại khám</span>
                  <strong>{ticket.queue_type || '--'}</strong>
                </div>
                <div className="doctor-queue-meta-item">
                  <span>Trạng thái</span>
                  <strong>{ticket.status ? String(ticket.status).replaceAll('_', ' ') : '--'}</strong>
                </div>
              </div>

              {ticket.priority_reason ? (
                <div className="doctor-queue-priority-pill">{ticket.priority_reason}</div>
              ) : null}
            </div>

            <div className="doctor-queue-row-actions">
              <button className="doctor-secondary-button" type="button" onClick={() => onRecall(ticketId)}>
                Gọi lại
              </button>
              <button className="doctor-secondary-button" type="button" onClick={() => onSkip(ticket)}>
                Bỏ qua
              </button>
              <button className="doctor-primary-button" type="button" onClick={() => onStartService(ticket)}>
                Bắt đầu phục vụ
              </button>
              <button
                className="doctor-primary-button doctor-primary-green"
                type="button"
                onClick={() => onComplete(ticket)}
              >
                Hoàn tất
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function EncounterTable({ encounters, patientMap, onOpen, onTransition }) {
  if (!encounters.length) {
    return (
      <EmptyState
        title="Không tìm thấy phiên khám"
        description="Không có phiên khám đang hoạt động hoặc lịch sử trong phạm vi đã chọn."
      />
    )
  }

  return (
    <div className="doctor-table-wrap">
      <table className="doctor-table">
        <thead>
          <tr>
            <th>Phiên khám</th>
            <th>Bệnh nhân</th>
            <th>Bắt đầu</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {encounters.map((encounter) => {
            const encounterId = encounter.encounter_id || encounter.id
            const patientId = encounter.patient_id
            const patient = patientMap[patientId]

            return (
              <tr key={encounterId}>
                <td>
                  <div className="doctor-table-cell-stack">
                    <strong>{encounter.encounter_code || encounterId}</strong>
                    <span>{encounter.encounter_type || '--'}</span>
                  </div>
                </td>
                <td>
                  <PatientCell patient={patient} patientId={patientId} />
                </td>
                <td>
                  <div className="doctor-table-cell-stack">
                    <strong>{formatTime(encounter.start_time)}</strong>
                    <span>{formatDate(encounter.start_time)}</span>
                  </div>
                </td>
                <td>
                  <StatusBadge status={encounter.status} />
                </td>
                <td>
                  <div className="doctor-inline-actions doctor-inline-actions-wrap doctor-table-actions">
                    <button className="doctor-secondary-button" type="button" onClick={() => onOpen(encounterId)}>
                      Mở
                    </button>
                    {encounter.status !== 'in_progress' ? (
                      <button className="doctor-secondary-button" type="button" onClick={() => onTransition(encounterId, 'start')}>
                        Bắt đầu
                      </button>
                    ) : null}
                    {encounter.status === 'in_progress' ? (
                      <button className="doctor-secondary-button" type="button" onClick={() => onTransition(encounterId, 'hold')}>
                        Tạm dừng
                      </button>
                    ) : null}
                    {encounter.status !== 'completed' ? (
                      <button className="doctor-primary-button doctor-primary-green" type="button" onClick={() => onTransition(encounterId, 'complete')}>
                        Hoàn tất
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function PatientSearchTable({ items, onOpen }) {
  if (!items.length) {
    return (
      <EmptyState
        title="Không có bệnh nhân phù hợp"
        description="Hãy thử tìm theo tên bệnh nhân, mã, số điện thoại hoặc số bảo hiểm."
      />
    )
  }

  return (
    <div className="doctor-table-wrap">
      <table className="doctor-table">
        <thead>
          <tr>
            <th>Bệnh nhân</th>
            <th>Số điện thoại</th>
            <th>Trạng thái</th>
            <th>Mở</th>
          </tr>
        </thead>
        <tbody>
          {items.map((patient) => {
            const patientId = patient.patient_id || patient.id
            return (
              <tr key={patientId}>
                <td>
                  <PatientCell patient={patient} patientId={patientId} />
                </td>
                <td>{patient.phone || '--'}</td>
                <td>
                  <StatusBadge status={patient.status || ''} />
                </td>
                <td>
                  <button className="doctor-secondary-button" type="button" onClick={() => onOpen(patientId)}>
                    Mở
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
