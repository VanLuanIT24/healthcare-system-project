import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { preferredPharmacy } from '../data/patientPageData'
import medicationEmptyIllustration from '../assets/medication-empty-rx-clear.png'
import medicationClockImage from '../assets/medication-clock.png'
import medicationInfoHeroImage from '../assets/medication-info-hero.png'
import medStatTotalImage from '../assets/med-stat-total.png'
import medStatActiveImage from '../assets/med-stat-active.png'
import medStatCompletedImage from '../assets/med-stat-completed.png'
import medStatItemsImage from '../assets/med-stat-items.png'

function MedicationEmptyArtwork() {
  return (
    <svg
      className="patient-medications-empty-art"
      viewBox="0 0 343 181"
      role="img"
      aria-label="Minh họa đơn thuốc"
    >
      <defs>
        <linearGradient id="medBoxBlue" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#5db7ff" />
          <stop offset="0.55" stopColor="#1677ff" />
          <stop offset="1" stopColor="#0457d8" />
        </linearGradient>
        <linearGradient id="medBoxPaper" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.58" stopColor="#eef6ff" />
          <stop offset="1" stopColor="#d9eaff" />
        </linearGradient>
        <linearGradient id="medBoxSide" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c8ddff" />
        </linearGradient>
        <linearGradient id="medLeaf" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#edf6ff" />
          <stop offset="1" stopColor="#a9caff" />
        </linearGradient>
        <filter id="medSoftShadow" x="-24%" y="-24%" width="148%" height="160%">
          <feDropShadow dx="0" dy="15" stdDeviation="10" floodColor="#0d63f3" floodOpacity="0.16" />
        </filter>
      </defs>

      <ellipse cx="172" cy="153" rx="132" ry="15" fill="#dcecff" opacity="0.86" />

      <g opacity="0.9">
        <path d="M36 128c4-28 18-47 42-58 7 25 0 45-19 59" fill="url(#medLeaf)" />
        <path d="M60 140c13-28 33-43 61-45-3 28-19 44-47 53" fill="url(#medLeaf)" />
        <path d="M306 128c-4-28-18-47-42-58-7 25 0 45 19 59" fill="url(#medLeaf)" />
        <path d="M284 140c-13-28-33-43-61-45 3 28 19 44 47 53" fill="url(#medLeaf)" />
        <path d="M48 92c15 13 25 28 29 47" stroke="#8db9ff" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        <path d="M295 92c-15 13-25 28-29 47" stroke="#8db9ff" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </g>

      <g filter="url(#medSoftShadow)">
        <path d="M103 48h122c9 0 17 8 17 17v76H116c-9 0-17-8-17-17V54c0-3 2-6 4-6z" fill="url(#medBoxPaper)" stroke="#1370f6" strokeWidth="7" />
        <path d="M225 48l25 19v72c0 5-4 9-9 9h-18V55c0-4 1-6 2-7z" fill="url(#medBoxSide)" stroke="#1370f6" strokeWidth="7" strokeLinejoin="round" />
        <path d="M111 48l19-23h100l-14 23z" fill="url(#medBoxBlue)" stroke="#1370f6" strokeWidth="7" strokeLinejoin="round" />
        <rect x="121" y="72" width="58" height="55" rx="12" fill="url(#medBoxBlue)" />
        <rect x="143" y="84" width="14" height="32" rx="7" fill="#fff" />
        <rect x="134" y="93" width="32" height="14" rx="7" fill="#fff" />
        <rect x="190" y="75" width="35" height="6" rx="3" fill="#b8cce7" />
        <rect x="190" y="94" width="42" height="6" rx="3" fill="#c8d8ee" />
        <rect x="190" y="113" width="38" height="6" rx="3" fill="#c8d8ee" />
        <text x="135" y="43" fill="#ffffff" fontFamily="Manrope, sans-serif" fontSize="17" fontWeight="800">MED</text>
      </g>

      <g filter="url(#medSoftShadow)">
        <rect x="238" y="88" width="58" height="66" rx="12" fill="#e7f0ff" stroke="#bfd9ff" strokeWidth="3" />
        {[0, 1, 2, 3].map((index) => (
          <g key={index}>
            <circle cx={256} cy={105 + index * 14} r="8" fill="#c5dcff" />
            <circle cx={280} cy={105 + index * 14} r="8" fill="#c5dcff" />
            <circle cx={254} cy={103 + index * 14} r="6" fill="#ffffff" opacity="0.55" />
            <circle cx={278} cy={103 + index * 14} r="6" fill="#ffffff" opacity="0.55" />
          </g>
        ))}
      </g>

      <g>
        <rect x="70" y="138" width="42" height="16" rx="8" fill="#19c4d2" transform="rotate(-24 91 146)" />
        <rect x="95" y="138" width="42" height="16" rx="8" fill="#2f7bff" transform="rotate(-24 116 146)" />
        <circle cx="151" cy="153" r="8" fill="#e6f1ff" />
        <circle cx="168" cy="153" r="8" fill="#ffffff" />
        <rect x="202" y="138" width="45" height="18" rx="9" fill="#18c7d5" transform="rotate(-34 224 147)" />
        <rect x="228" y="138" width="45" height="18" rx="9" fill="#2f7bff" transform="rotate(-34 250 147)" />
        <path d="M286 26l6 13 13 6-13 6-6 13-6-13-13-6 13-6z" fill="#9ec5ff" opacity="0.82" />
        <path d="M72 33l5 10 10 5-10 5-5 10-5-10-10-5 10-5z" fill="#9ec5ff" opacity="0.82" />
        <path d="M302 86l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" fill="#c8dcfb" opacity="0.9" />
        <circle cx="55" cy="80" r="4" fill="#d8e8ff" />
        <circle cx="316" cy="72" r="4" fill="#d8e8ff" />
      </g>
    </svg>
  )
}

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
      instructions:
        item.instructions || 'Chưa có hướng dẫn dùng thuốc chi tiết.',
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
  const [reminderCreated, setReminderCreated] = useState(false)

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

  const statCards = [
    {
      label: 'Tổng đơn thuốc',
      value: prescriptions.length,
      note: 'Tất cả đơn thuốc',
      image: medStatTotalImage,
      icon: 'assignment',
      tone: 'blue',
    },
    {
      label: 'Đơn đang hiệu lực',
      value: activePrescriptionCount,
      note: 'Đang sử dụng',
      image: medStatActiveImage,
      icon: 'verified_user',
      tone: 'green',
    },
    {
      label: 'Đơn đã hoàn tất',
      value: completedPrescriptionCount,
      note: 'Trong quá khứ',
      image: medStatCompletedImage,
      icon: 'check_circle',
      tone: 'violet',
    },
    {
      label: 'Mục thuốc',
      value: medicationEntries.length,
      note: 'Tổng số mục thuốc',
      image: medStatItemsImage,
      icon: 'pill',
      tone: 'orange',
    },
  ]

  return (
    <div className="patient-medications-page">
      <section className="patient-medications-head">
        <div>
          <h1>Theo dõi thuốc</h1>
          <p>
            Quản lý đơn thuốc, lịch uống thuốc và thông tin thuốc được đồng bộ
            trực tiếp từ hệ thống bệnh viện.
          </p>
        </div>

        <button className="patient-medications-refill" type="button">
          <PatientIcon name="medical_information" aria-hidden="true" />
          <span>{prescriptions.length} đơn thuốc từ backend</span>
        </button>
      </section>

      <section className="patient-medications-stats" aria-label="Tổng quan đơn thuốc">
        {statCards.map((item) => (
          <article className={`patient-medications-stat is-${item.tone}`} key={item.label}>
            <div className="patient-medications-stat-icon">
              <img src={item.image} alt="" aria-hidden="true" />
            </div>
            <div>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
              <span>{item.note}</span>
            </div>
          </article>
        ))}
      </section>

      <div className="patient-medications-layout">
        <section className="patient-medications-main">
          <div className="patient-panel patient-medications-schedule-card">
            <div className="patient-medications-card-head">
              <div className="patient-medications-title-row">
                <span>
                  <PatientIcon name="medication" aria-hidden="true" />
                </span>
                <h2>Thuốc đang được kê</h2>
              </div>
            </div>

            {loading ? (
              <div className="patient-medications-empty">
                <div className="patient-medications-loading-icon">
                  <PatientIcon name="hourglass_top" aria-hidden="true" />
                </div>
                <h3>Đang tải đơn thuốc...</h3>
                <p>Hệ thống đang lấy dữ liệu đơn thuốc từ backend.</p>
              </div>
            ) : medicationEntries.length === 0 ? (
              <div className="patient-medications-empty">
                <img
                  className="patient-medications-empty-art"
                  src={medicationEmptyIllustration}
                  alt="Minh họa đơn thuốc"
                />
                <h3>Chưa có đơn thuốc nào</h3>
                <p>Hiện chưa có đơn thuốc nào được kê cho tài khoản của bạn.</p>
                <div className="patient-medications-empty-actions">
                  <button className="patient-medications-refill" type="button">
                    <PatientIcon name="medical_information" aria-hidden="true" />
                    Đơn thuốc từ backend
                  </button>
                  <button className="patient-medications-secondary-btn" type="button">
                    <PatientIcon name="refresh" aria-hidden="true" />
                    Làm mới dữ liệu
                  </button>
                </div>
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
                            .join(' | ')}
                        </p>
                        <small>
                          {dose.prescribedAtLabel} | {dose.doctorName}
                        </small>
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

          <div
            className={`patient-panel patient-medications-today-card${
              reminderCreated ? ' is-reminder-created' : ''
            }`}
          >
            <div className="patient-medications-today-icon">
              <img src={medicationClockImage} alt="" aria-hidden="true" />
            </div>
            <div>
              <h3>Lịch uống hôm nay</h3>
              <p>
                {medicationEntries.length
                  ? 'Xem hướng dẫn dùng thuốc trong từng mục thuốc đang được kê.'
                  : 'Không có lịch uống thuốc nào cho hôm nay.'}
              </p>
            </div>
            <button
              className="patient-medications-secondary-btn"
              type="button"
              onClick={() => setReminderCreated(true)}
              aria-label={
                reminderCreated
                  ? 'Đã tạo nhắc nhở uống thuốc hôm nay'
                  : 'Tạo nhắc nhở uống thuốc hôm nay'
              }
            >
              <PatientIcon
                name={reminderCreated ? 'check_circle' : 'notifications'}
                aria-hidden="true"
              />
              {reminderCreated ? 'Đã tạo nhắc nhở' : 'Tạo nhắc nhở'}
            </button>
            <div className="patient-medications-today-calendar" aria-hidden="true">
              <PatientIcon name="calendar_month" />
            </div>
          </div>
        </section>

        <aside className="patient-medications-side">
          <div className="patient-medications-insight-card">
            {selectedMedication ? (
              <div className="patient-medications-insight-hero">
                <div className="patient-medications-insight-mark" aria-hidden="true">
                  <span className="patient-medications-capsule-glow">
                    <span />
                  </span>
                </div>

                <div>
                  <h3>Thông tin thuốc</h3>
                  <p>Kê bởi {selectedMedication.doctorName}</p>
                </div>
              </div>
            ) : (
              <div className="patient-medications-insight-hero patient-medications-insight-hero-image">
                <img
                  src={medicationInfoHeroImage}
                  alt="Thông tin thuốc - chưa có thuốc nào được chọn"
                />
              </div>
            )}

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
                        .join(' | ')}
                    </p>
                  </div>

                  <div className="patient-medications-callout">
                    <PatientIcon name="info" aria-hidden="true" />
                    <div>
                      <strong>Thông tin kê đơn</strong>
                      <p>
                        {selectedMedication.prescribedAtLabel} |{' '}
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

                  <div className="patient-medications-chip-list">
                    <span>{selectedMedication.routeDetail}</span>
                    {selectedMedication.durationDays ? (
                      <span>{selectedMedication.durationDays} ngày</span>
                    ) : null}
                    <span>Số lượng: {selectedMedication.quantity}</span>
                    <span>{selectedMedication.statusLabel}</span>
                  </div>
                </>
              ) : (
                <div className="patient-medications-no-selection">
                  <PatientIcon name="info" aria-hidden="true" />
                  <p>
                    Chọn một thuốc từ danh sách để xem thông tin chi tiết,
                    hướng dẫn sử dụng và lưu ý quan trọng.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="patient-panel patient-medications-pharmacy-card">
            <h3>Nhà thuốc ưu tiên</h3>
            <div className="patient-medications-map">
              <div className="patient-medications-map-pin">
                <PatientIcon name="local_pharmacy" aria-hidden="true" />
              </div>
            </div>
            <button className="patient-medications-pharmacy-link" type="button">
              <span>Xem danh sách nhà thuốc gần bạn</span>
              <PatientIcon name="chevron_right" aria-hidden="true" />
            </button>
            <p>
              {preferredPharmacy.name} | {preferredPharmacy.meta}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
