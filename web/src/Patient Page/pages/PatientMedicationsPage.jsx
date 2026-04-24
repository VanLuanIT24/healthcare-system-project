import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { preferredPharmacy } from '../data/patientPageData'

function formatPrescriptionDate(value) {
  if (!value) {
    return 'Chưa có ngày kê'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Chưa có ngày kê'
  }

  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date)
}

function getPrescriptionStatusMeta(status) {
  const map = {
    draft: { label: 'Nháp', tone: 'soft' },
    active: { label: 'Đang hiệu lực', tone: 'good' },
    verified: { label: 'Đã duyệt', tone: 'good' },
    partially_dispensed: { label: 'Cấp một phần', tone: 'soft' },
    fully_dispensed: { label: 'Đã cấp đủ', tone: 'good' },
    cancelled: { label: 'Đã hủy', tone: 'rose' },
    completed: { label: 'Hoàn tất', tone: 'good' },
  }

  return map[status] || { label: status || 'Chưa cập nhật', tone: 'soft' }
}

function getRouteLabel(route) {
  const normalized = String(route || '').toLowerCase()
  const map = {
    oral: 'Uống',
    iv: 'IV',
    im: 'IM',
    sc: 'SC',
    topical: 'Bôi',
    inhalation: 'Hít',
  }

  return map[normalized] || 'RX'
}

function getRouteDetail(route) {
  const normalized = String(route || '').toLowerCase()
  const map = {
    oral: 'Đường dùng: uống',
    iv: 'Đường dùng: tiêm tĩnh mạch',
    im: 'Đường dùng: tiêm bắp',
    sc: 'Đường dùng: tiêm dưới da',
    topical: 'Đường dùng: bôi ngoài da',
    inhalation: 'Đường dùng: hít',
  }

  return map[normalized] || 'Đường dùng theo chỉ định bác sĩ'
}

function getRouteIcon(route) {
  const normalized = String(route || '').toLowerCase()
  const map = {
    oral: 'pill',
    iv: 'water_drop',
    im: 'vaccines',
    sc: 'vaccines',
    topical: 'dermatology',
    inhalation: 'air',
  }

  return map[normalized] || 'pill'
}

function mapPrescriptionEntries(prescriptions = []) {
  return prescriptions.flatMap((prescription) => {
    const status = getPrescriptionStatusMeta(prescription.status)

    return (prescription.items || []).map((item) => ({
      id:
        item.prescription_item_id ||
        `${prescription.prescription_id}-${item.medication_name}`,
      name: item.medication_name || 'Thuốc chưa định danh',
      dose: item.dose || 'Theo chỉ định',
      frequency: item.frequency || '',
      instructions: item.instructions || 'Chưa có hướng dẫn dùng thuốc chi tiết.',
      quantity: item.quantity ?? 0,
      durationDays: item.duration_days,
      route: item.route || '',
      routeLabel: getRouteLabel(item.route),
      routeDetail: getRouteDetail(item.route),
      icon: getRouteIcon(item.route),
      prescriptionNo: prescription.prescription_no || 'Đơn thuốc',
      prescribedAt: prescription.prescribed_at,
      prescribedAtLabel: formatPrescriptionDate(prescription.prescribed_at),
      doctorName:
        prescription.doctor_name ||
        `Bác sĩ ${String(prescription.doctor_id || '').slice(-6)}`,
      departmentName: prescription.department_name || 'Khám ngoại trú',
      note: prescription.note || '',
      status: prescription.status,
      statusLabel: status.label,
      tone: status.tone,
    }))
  })
}

export default function PatientMedicationsPage({
  prescriptions = [],
  loading = false,
}) {
  const medicationEntries = useMemo(
    () => mapPrescriptionEntries(prescriptions),
    [prescriptions],
  )
  const [activeDoseId, setActiveDoseId] = useState(
    () => medicationEntries[0]?.id || null,
  )

  useEffect(() => {
    if (!medicationEntries.length) {
      setActiveDoseId(null)
      return
    }

    if (!medicationEntries.some((entry) => entry.id === activeDoseId)) {
      setActiveDoseId(medicationEntries[0].id)
    }
  }, [activeDoseId, medicationEntries])

  const selectedMedication =
    medicationEntries.find((entry) => entry.id === activeDoseId) ||
    medicationEntries[0] ||
    null

  const activePrescriptionCount = prescriptions.filter((item) =>
    ['active', 'verified', 'partially_dispensed', 'fully_dispensed'].includes(
      item.status,
    ),
  ).length
  const completedPrescriptionCount = prescriptions.filter((item) =>
    ['completed', 'fully_dispensed'].includes(item.status),
  ).length
  const activePercent = prescriptions.length
    ? Math.round((activePrescriptionCount / prescriptions.length) * 100)
    : 0
  const completedPercent = prescriptions.length
    ? Math.round((completedPrescriptionCount / prescriptions.length) * 100)
    : 0

  return (
    <div className="patient-medications-page">
      <section className="patient-medications-head">
        <div>
          <h1>Theo dõi thuốc</h1>
          <p>
            Theo dõi đơn thuốc thật đang được đồng bộ từ backend của cổng bệnh
            nhân.
          </p>
        </div>

        <button className="patient-medications-refill" type="button">
          <PatientIcon name="medication" aria-hidden="true" />
          <span>{prescriptions.length} đơn thuốc từ backend</span>
        </button>
      </section>

      <div className="patient-medications-layout">
        <section className="patient-medications-main">
          <div className="patient-panel patient-medications-schedule-card">
            <div className="patient-medications-card-head">
              <h2>Thuốc đang được kê</h2>
              <div className="patient-medications-count">
                <PatientIcon name="inventory_2" aria-hidden="true" />
                <span>{medicationEntries.length} mục thuốc</span>
              </div>
            </div>

            {loading ? (
              <div className="patient-empty-state">Đang tải đơn thuốc...</div>
            ) : medicationEntries.length === 0 ? (
              <div className="patient-empty-state">
                Backend chưa có đơn thuốc nào cho tài khoản này.
              </div>
            ) : (
              <div className="patient-medications-dose-list">
                {medicationEntries.map((dose) => (
                  <article
                    key={dose.id}
                    className={`patient-medications-dose${
                      dose.id === activeDoseId ? ' is-active' : ''
                    }`}
                  >
                    <button
                      className="patient-medications-dose-body"
                      type="button"
                      onClick={() => setActiveDoseId(dose.id)}
                    >
                      <div className="patient-medications-dose-time">
                        <PatientIcon name={dose.icon} aria-hidden="true" />
                        <strong>{dose.routeLabel}</strong>
                      </div>

                      <div className="patient-medications-dose-copy">
                        <h3>
                          {dose.name} <span>{dose.dose}</span>
                        </h3>
                        <p>
                          {[dose.frequency, dose.instructions]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      </div>
                    </button>

                    <span className={`patient-pill ${dose.tone}`}>
                      {dose.statusLabel}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="patient-medications-progress-grid">
            <div className="patient-panel patient-medications-progress-card">
              <div className="patient-medications-progress-head">
                <div>
                  <p>Đơn đang hiệu lực</p>
                  <h3>{activePrescriptionCount} đơn</h3>
                </div>
                <strong>{activePercent}%</strong>
              </div>

              <div className="patient-medications-progress-track">
                <span style={{ width: `${activePercent}%` }} />
              </div>

              <small>
                {activePrescriptionCount}/{prescriptions.length || 0} đơn còn hiệu
                lực trên hệ thống.
              </small>
            </div>

            <div className="patient-panel patient-medications-progress-card">
              <div className="patient-medications-progress-head">
                <div>
                  <p>Đơn đã hoàn tất</p>
                  <h3>{completedPrescriptionCount} đơn</h3>
                </div>
                <strong className="is-secondary">{completedPercent}%</strong>
              </div>

              <div className="patient-medications-progress-track is-secondary">
                <span style={{ width: `${completedPercent}%` }} />
              </div>

              <small>
                Dữ liệu này lấy từ trạng thái đơn thuốc thật ở backend.
              </small>
            </div>
          </div>
        </section>

        <aside className="patient-medications-side">
          <div className="patient-medications-insight-card">
            <div className="patient-medications-insight-hero">
              <div className="patient-medications-insight-mark">
                <PatientIcon
                  name={selectedMedication?.icon || 'pill'}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h3>Thông tin thuốc</h3>
                <p>
                  {selectedMedication
                    ? `Kê bởi ${selectedMedication.doctorName}`
                    : 'Chưa có thuốc nào được chọn'}
                </p>
              </div>
            </div>

            <div className="patient-medications-insight-body">
              {selectedMedication ? (
                <>
                  <div className="patient-medications-title-block">
                    <h2>{selectedMedication.name}</h2>
                    <span>{selectedMedication.prescriptionNo}</span>
                  </div>

                  <div className="patient-medications-info-block">
                    <p className="patient-medications-block-label">Liều dùng</p>
                    <p>
                      {[selectedMedication.dose, selectedMedication.frequency]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </div>

                  <div className="patient-medications-callout">
                    <PatientIcon name="info" aria-hidden="true" />
                    <div>
                      <strong>Thông tin kê đơn</strong>
                      <p>
                        {selectedMedication.prescribedAtLabel} •{' '}
                        {selectedMedication.departmentName}
                      </p>
                    </div>
                  </div>

                  <div className="patient-medications-info-block">
                    <p className="patient-medications-block-label">
                      Hướng dẫn sử dụng
                    </p>
                    <p>{selectedMedication.instructions}</p>
                  </div>

                  <div className="patient-medications-info-block">
                    <p className="patient-medications-block-label">Chi tiết thêm</p>
                    <div className="patient-medications-chip-list">
                      <span>{selectedMedication.routeDetail}</span>
                      {selectedMedication.durationDays ? (
                        <span>{selectedMedication.durationDays} ngày</span>
                      ) : null}
                      <span>Số lượng: {selectedMedication.quantity}</span>
                      <span>{selectedMedication.statusLabel}</span>
                    </div>
                  </div>

                  {selectedMedication.note ? (
                    <div className="patient-medications-info-block">
                      <p className="patient-medications-block-label">Ghi chú bác sĩ</p>
                      <p>{selectedMedication.note}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="patient-empty-state">
                  Chưa có thông tin thuốc để hiển thị.
                </div>
              )}
            </div>
          </div>

          <div className="patient-panel patient-medications-pharmacy-card">
            <p className="patient-medications-block-label">Nhà thuốc ưu tiên</p>

            <div className="patient-medications-map">
              <div className="patient-medications-map-pin">
                <PatientIcon name="location_on" aria-hidden="true" />
              </div>
            </div>

            <h3>{preferredPharmacy.name}</h3>
            <p>{preferredPharmacy.meta}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
