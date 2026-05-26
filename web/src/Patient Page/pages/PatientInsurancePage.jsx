import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'

const dashboardTabs = [
  { key: 'overview', label: 'Thông tin bảo hiểm', icon: 'dashboard' },
  { key: 'claims', label: 'Claims', icon: 'receipt_long' },
  { key: 'missing', label: 'Hồ sơ cần bổ sung', icon: 'upload_file' },
  { key: 'pending', label: 'Chờ xử lý', icon: 'schedule' },
  { key: 'approved', label: 'Đã duyệt', icon: 'verified_user' },
  { key: 'rejected', label: 'Bị từ chối', icon: 'block' },
  { key: 'history', label: 'Lịch sử', icon: 'history' },
]

const coveredServices = [
  { icon: 'medical_services', title: 'Khám bệnh & Tư vấn', copy: 'Ngoại trú, nội trú' },
  { icon: 'experiment', title: 'Xét nghiệm', copy: 'Xét nghiệm máu, nước tiểu, chẩn đoán' },
  { icon: 'radiology', title: 'Chẩn đoán hình ảnh', copy: 'X-quang, CT, MRI, Siêu âm' },
  { icon: 'settings_suggest', title: 'Phẫu thuật & Thủ thuật', copy: 'Phẫu thuật, tiểu phẫu, thủ thuật' },
  { icon: 'local_hospital', title: 'Điều trị nội trú', copy: 'Giường bệnh, điều dưỡng, thuốc' },
  { icon: 'accessibility_new', title: 'Vật lý trị liệu & Phục hồi chức năng', copy: 'Tập phục hồi, điện trị liệu' },
]

const claimStatusMeta = {
  draft: { label: 'Nháp', tone: 'pending' },
  submitted: { label: 'Chờ bổ sung', tone: 'pending' },
  under_review: { label: 'Đang xử lý', tone: 'partial' },
  approved: { label: 'Đã duyệt', tone: 'active' },
  partially_approved: { label: 'Duyệt một phần', tone: 'partial' },
  settled: { label: 'Đã chi trả', tone: 'active' },
  rejected: { label: 'Từ chối', tone: 'rejected' },
  cancelled: { label: 'Đã hủy', tone: 'rejected' },
}

const insuranceFormDefaults = {
  providerName: '',
  policyNo: '',
  memberNo: '',
  coverageType: 'Khám chữa bệnh đúng tuyến',
  validFrom: '',
  validTo: '',
  coveragePercent: '80',
  coverageLimit: '50000000',
  note: '',
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  currency: 'VND',
  maximumFractionDigits: 0,
  style: 'currency',
})

function normalizeText(value, fallback = '') {
  const text = String(value || '').trim()
  return text || fallback
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

function formatMoney(value) {
  const numberValue = Number(value)
  return moneyFormatter.format(Number.isFinite(numberValue) ? numberValue : 0)
}

function getPolicyId(policy, index) {
  return policy._id || policy.policy_id || policy.id || policy.policy_no || policy.member_no || `insurance-policy-${index}`
}

function normalizePolicy(policy, index) {
  const payerName = normalizeText(
    policy.payer_name || policy.company_name || policy.insurer_name || policy.provider_name,
    `Bảo hiểm y tế ${index + 1}`,
  )

  return {
    ...policy,
    id: getPolicyId(policy, index),
    payerName,
    payerCode: normalizeText(policy.payer_code || policy.company_code || policy.insurer_code),
    policyNo: normalizeText(policy.policy_no || policy.policy_number || policy.member_no, 'Chưa có mã thẻ'),
    memberNo: normalizeText(policy.member_no || policy.policy_no || policy.policy_number, 'Chưa có mã thành viên'),
    coverageType: normalizeText(policy.coverage_type || policy.plan_name || policy.type, 'Khám chữa bệnh đúng tuyến'),
    coveragePercent: policy.coverage_percent,
    coverageLimit: Number(policy.coverage_limit || policy.annual_limit || policy.limit_amount || 50000000),
    validFrom: policy.valid_from || policy.start_date || policy.effective_from,
    validTo: policy.valid_to || policy.end_date || policy.to_date,
    status: normalizeText(policy.status, 'active').toLowerCase(),
  }
}

function getClaimId(claim, index) {
  return claim._id || claim.claim_id || claim.id || claim.claim_no || `insurance-usage-${index}`
}

function getPolicyClaims(policy, claims) {
  return claims.filter((claim) => {
    const claimPolicyId = claim.policy_id?._id || claim.policy_id || claim.policyId
    return String(claimPolicyId || '') === String(policy?.id || policy?._id || '')
  })
}

function getClaimStatusMeta(status) {
  const key = normalizeText(status, 'submitted').toLowerCase()
  return claimStatusMeta[key] || claimStatusMeta.submitted
}

function getClaimGroup(status) {
  const key = normalizeText(status, 'submitted').toLowerCase()
  if (['approved', 'partially_approved', 'settled'].includes(key)) return 'approved'
  if (['rejected', 'cancelled'].includes(key)) return 'rejected'
  return 'pending'
}

function getClaimDate(claim) {
  return formatDate(claim.settled_at || claim.approved_at || claim.submitted_at || claim.created_at)
}

function getClaimTitle(claim) {
  return normalizeText(
    claim.service_name || claim.service || claim.department_name || claim.facility_name,
    `Hồ sơ ${claim.claim_no || 'bồi thường bảo hiểm'}`,
  )
}

function getPolicyTypeLabel(policy) {
  const code = String(policy?.payerCode || policy?.payer_code || '').toUpperCase()
  const name = policy?.payerName || policy?.payer_name || ''
  if (code.includes('BHYT') || name.toLowerCase().includes('y tế')) return 'Bảo hiểm y tế'
  if (code.includes('BHXH') || name.toLowerCase().includes('xã hội')) return 'Bảo hiểm xã hội'
  return name || 'Bảo hiểm'
}

function getBenefitPercent(policy) {
  if (policy?.coveragePercent !== undefined && policy?.coveragePercent !== null && policy?.coveragePercent !== '') {
    return `${policy.coveragePercent}%`
  }
  return '80%'
}

function getBenefitScope(policy) {
  return normalizeText(policy?.coverageType || policy?.benefit_scope || policy?.scope, 'Khám chữa bệnh đúng tuyến')
}

function getBenefitCode(policy) {
  const explicitCode = normalizeText(policy?.benefit_code || policy?.right_code || policy?.coverage_code)
  if (explicitCode) return explicitCode
  const cardCode = normalizeText(policy?.memberNo || policy?.policyNo).replace(/[^a-zA-Z0-9]/g, '')
  return cardCode.length >= 5 ? cardCode.slice(0, 5).toUpperCase() : 'GD401'
}

function getInitialCarePlace(policy) {
  return normalizeText(
    policy?.initial_care_place ||
      policy?.registered_hospital ||
      policy?.primary_hospital ||
      policy?.registration_facility ||
      policy?.facility_name,
    'Bệnh viện Đa khoa Bộ Y tế',
  )
}

export default function PatientInsurancePage({
  claims = [],
  error = '',
  feedback = null,
  loading = false,
  onBackToDashboard,
  onCreatePolicy,
  onOpenSupportChat,
  policies = [],
}) {
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [notice, setNotice] = useState('')
  const [showInsuranceForm, setShowInsuranceForm] = useState(false)
  const [insuranceForm, setInsuranceForm] = useState(insuranceFormDefaults)
  const sourcePolicies = useMemo(
    () => policies,
    [policies],
  )
  const sourceClaims = claims
  const normalizedPolicies = useMemo(() => sourcePolicies.map(normalizePolicy), [sourcePolicies])

  useEffect(() => {
    if (!normalizedPolicies.length) {
      setSelectedPolicyId('')
      return
    }

    if (!normalizedPolicies.some((policy) => policy.id === selectedPolicyId)) {
      setSelectedPolicyId(normalizedPolicies[0].id)
    }
  }, [normalizedPolicies, selectedPolicyId])

  const selectedPolicy = normalizedPolicies.find((policy) => policy.id === selectedPolicyId) || normalizedPolicies[0] || null
  const selectedClaims = useMemo(
    () => (selectedPolicy ? getPolicyClaims(selectedPolicy, sourceClaims) : []),
    [selectedPolicy, sourceClaims],
  )
  const claimSummary = useMemo(
    () =>
      selectedClaims.reduce(
        (summary, claim) => ({
          approved: summary.approved + (Number(claim.approved_amount) || 0),
          paid: summary.paid + (Number(claim.paid_amount) || 0),
          submitted: summary.submitted + (Number(claim.submitted_amount) || 0),
        }),
        { approved: 0, paid: 0, submitted: 0 },
      ),
    [selectedClaims],
  )

  const safePolicyLimit = Number.isFinite(selectedPolicy?.coverageLimit) && selectedPolicy.coverageLimit > 0 ? selectedPolicy.coverageLimit : 50000000
  const remainingBenefit = Math.max(safePolicyLimit - claimSummary.approved, 0)
  const remainingPercent = Math.min(100, Math.round((remainingBenefit / safePolicyLimit) * 1000) / 10)
  const paymentRate = Number.parseInt(getBenefitPercent(selectedPolicy || {}).replace(/[^\d]/g, ''), 10) || 80
  const approvedClaims = selectedClaims.filter((claim) => getClaimGroup(claim.status) === 'approved')
  const pendingClaims = selectedClaims.filter((claim) => getClaimGroup(claim.status) === 'pending')
  const claimRows = useMemo(() => {
    if (activeTab === 'approved') return selectedClaims.filter((claim) => getClaimGroup(claim.status) === 'approved')
    if (activeTab === 'rejected') return selectedClaims.filter((claim) => getClaimGroup(claim.status) === 'rejected')
    if (activeTab === 'pending' || activeTab === 'missing') return selectedClaims.filter((claim) => getClaimGroup(claim.status) === 'pending')
    return activeTab === 'claims' || activeTab === 'history' ? selectedClaims : selectedClaims.slice(0, 5)
  }, [activeTab, selectedClaims])

  const dashboardKpis = [
    {
      id: 'remaining',
      icon: 'shield_plus',
      tone: 'blue',
      label: 'Quyền lợi còn lại',
      value: formatMoney(remainingBenefit),
      helper: `Trong tổng mức ${formatMoney(safePolicyLimit)}`,
      progress: remainingPercent,
    },
    {
      id: 'claims',
      icon: 'receipt_long',
      tone: 'green',
      label: 'Số hồ sơ yêu cầu',
      value: `${selectedClaims.length} hồ sơ`,
      helper: 'Trong năm 2026',
    },
    {
      id: 'approved',
      icon: 'verified',
      tone: 'violet',
      label: 'Đã được duyệt',
      value: `${approvedClaims.length} hồ sơ`,
      helper: `Tổng ${formatMoney(claimSummary.approved)}`,
    },
    {
      id: 'pending',
      icon: 'schedule',
      tone: 'orange',
      label: 'Chờ xử lý',
      value: `${pendingClaims.length} hồ sơ`,
      helper: `Tổng ${formatMoney(Math.max(claimSummary.submitted - claimSummary.approved, 0))}`,
    },
  ]

  const benefitRows = selectedPolicy
    ? [
        ['Mức hưởng', getBenefitPercent(selectedPolicy)],
        ['Phạm vi hưởng', getBenefitScope(selectedPolicy)],
        ['Mã quyền lợi', getBenefitCode(selectedPolicy)],
        ['Nơi đăng ký KCB', getInitialCarePlace(selectedPolicy)],
      ]
    : []

  const handleUploadNotice = () => {
    setNotice('Tải tài liệu bảo hiểm qua kho tài liệu rồi gắn vào hồ sơ bảo hiểm.')
  }

  const handleInsuranceFormChange = (event) => {
    const { name, value } = event.target
    setInsuranceForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const closeInsuranceForm = () => {
    setShowInsuranceForm(false)
    setInsuranceForm(insuranceFormDefaults)
  }

  const handleInsuranceFormSubmit = async (event) => {
    event.preventDefault()

    const payload = {
      payer_name: normalizeText(insuranceForm.providerName, 'Bảo hiểm mới'),
      payer_code: '',
      policy_no: normalizeText(insuranceForm.policyNo, 'Chưa có mã thẻ'),
      member_no: normalizeText(insuranceForm.memberNo || insuranceForm.policyNo, 'Chưa có mã thành viên'),
      coverage_type: normalizeText(insuranceForm.coverageType, 'Khám chữa bệnh đúng tuyến'),
      coverage_percent: Math.max(0, Math.min(100, Number(insuranceForm.coveragePercent) || 0)),
      valid_from: insuranceForm.validFrom,
      valid_to: insuranceForm.validTo,
      is_primary: !normalizedPolicies.length,
      note: insuranceForm.note,
    }

    const saved = await onCreatePolicy?.(payload)
    if (saved !== false) {
      setShowInsuranceForm(false)
      setInsuranceForm(insuranceFormDefaults)
      setNotice('Đã gửi thông tin bảo hiểm.')
    }
  }

  return (
    <section className="patient-insurance-page patient-insurance-page--dashboard">
      <div className="pi-dashboard-layout">
        <main className="pi-dashboard-main">
          <header className="pi-dashboard-header">
            <div>
              <h1>Bảo hiểm</h1>
              <p>Quản lý thông tin bảo hiểm, quyền lợi và yêu cầu bồi thường của bạn.</p>
            </div>
            <div className="pi-dashboard-illustration" aria-hidden="true">
              <span><PatientIcon name="description" /></span>
              <strong><PatientIcon name="health_and_safety" /></strong>
              <i><PatientIcon name="favorite" /></i>
            </div>
          </header>

          {notice ? (
            <div className="pi-notice" role="status">
              <PatientIcon name="info" aria-hidden="true" />
              <span>{notice}</span>
            </div>
          ) : null}
          {feedback?.context === 'insurance' ? (
            <div className="pi-notice" role="status">
              <PatientIcon name={feedback.type === 'error' ? 'warning' : 'check_circle'} aria-hidden="true" />
              <span>{feedback.message || feedback.text}</span>
            </div>
          ) : null}
          {loading ? <div className="patient-dashboard-state">Đang tải thông tin bảo hiểm...</div> : null}
          {!loading && error ? <div className="patient-dashboard-state patient-dashboard-state-error">{error}</div> : null}

          {showInsuranceForm ? (
            <form className="pi-insurance-entry-card" onSubmit={handleInsuranceFormSubmit}>
              <div className="pi-entry-header">
                <div>
                  <span>Thông tin bảo hiểm</span>
                  <h2>Nhập bảo hiểm của bệnh nhân</h2>
                </div>
                <button type="button" aria-label="Đóng form nhập bảo hiểm" onClick={closeInsuranceForm}>
                  <PatientIcon name="close" aria-hidden="true" />
                </button>
              </div>

              <div className="pi-entry-grid">
                <label>
                  Nhà bảo hiểm
                  <input
                    name="providerName"
                    value={insuranceForm.providerName}
                    onChange={handleInsuranceFormChange}
                    placeholder="Ví dụ: Bảo Việt, BHYT, PVI..."
                    required
                  />
                </label>
                <label>
                  Mã thẻ / Số hợp đồng
                  <input
                    name="policyNo"
                    value={insuranceForm.policyNo}
                    onChange={handleInsuranceFormChange}
                    placeholder="Nhập mã trên thẻ bảo hiểm"
                    required
                  />
                </label>
                <label>
                  Mã thành viên
                  <input
                    name="memberNo"
                    value={insuranceForm.memberNo}
                    onChange={handleInsuranceFormChange}
                    placeholder="Có thể bỏ trống nếu trùng mã thẻ"
                  />
                </label>
                <label>
                  Loại quyền lợi
                  <input
                    name="coverageType"
                    value={insuranceForm.coverageType}
                    onChange={handleInsuranceFormChange}
                    placeholder="Khám chữa bệnh đúng tuyến"
                  />
                </label>
                <label>
                  Ngày hiệu lực
                  <input
                    name="validFrom"
                    type="date"
                    value={insuranceForm.validFrom}
                    onChange={handleInsuranceFormChange}
                  />
                </label>
                <label>
                  Ngày hết hạn
                  <input
                    name="validTo"
                    type="date"
                    value={insuranceForm.validTo}
                    onChange={handleInsuranceFormChange}
                    required
                  />
                </label>
                <label>
                  Tỷ lệ chi trả (%)
                  <input
                    name="coveragePercent"
                    type="number"
                    min="0"
                    max="100"
                    value={insuranceForm.coveragePercent}
                    onChange={handleInsuranceFormChange}
                  />
                </label>
                <label>
                  Giới hạn chi trả
                  <input
                    name="coverageLimit"
                    type="number"
                    min="0"
                    step="100000"
                    value={insuranceForm.coverageLimit}
                    onChange={handleInsuranceFormChange}
                  />
                </label>
                <label className="pi-entry-grid-full">
                  Ghi chú
                  <textarea
                    name="note"
                    value={insuranceForm.note}
                    onChange={handleInsuranceFormChange}
                    placeholder="Ghi chú thêm về tuyến khám, giấy tờ hoặc điều kiện chi trả"
                    rows="3"
                  />
                </label>
              </div>

              <div className="pi-entry-footer">
                <button className="pi-secondary-action" type="button" onClick={closeInsuranceForm}>Hủy</button>
                <button className="pi-primary-action" type="submit">
                  <PatientIcon name="check_circle" aria-hidden="true" />
                  Lưu bảo hiểm
                </button>
              </div>
            </form>
          ) : null}

          {selectedPolicy ? (
            <section className="pi-hero-card" aria-label="Thông tin bảo hiểm chính">
              <div className="pi-hero-provider">
                <span>Nhà bảo hiểm</span>
                <strong>{selectedPolicy.payerName}</strong>
                <small>{getPolicyTypeLabel(selectedPolicy)}</small>
                <div className="pi-hero-actions">
                  <button type="button" className="pi-hero-add-button" onClick={() => setShowInsuranceForm(true)}>
                    <PatientIcon name="add_circle" aria-hidden="true" />
                    Thêm bảo hiểm
                  </button>
                  <button type="button" className="pi-hero-link-button" onClick={() => setActiveTab('overview')}>
                    Xem chi tiết hợp đồng
                    <PatientIcon name="arrow_forward" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="pi-hero-stat">
                <span>Số hợp đồng</span>
                <strong>{selectedPolicy.policyNo}</strong>
              </div>
              <div className="pi-hero-stat">
                <span>Hiệu lực đến</span>
                <strong><PatientIcon name="calendar_today" aria-hidden="true" />{formatDate(selectedPolicy.validTo) || '--'}</strong>
              </div>
              <div className="pi-hero-stat">
                <span>Tỷ lệ chi trả</span>
                <strong>{getBenefitPercent(selectedPolicy)}</strong>
                <small>Nội trú: {getBenefitPercent(selectedPolicy)} · Ngoại trú: 70%</small>
              </div>
              <div className="pi-hero-ring" style={{ '--pi-ring': `${Math.min(paymentRate, 100) * 3.6}deg` }} aria-hidden="true">
                <span><PatientIcon name="shield_plus" /></span>
              </div>
            </section>
          ) : !loading ? (
            <section className="pi-document-state">
              <PatientIcon name="health_and_safety" aria-hidden="true" />
              <strong>Chưa có bảo hiểm trong hồ sơ</strong>
              <p>Thêm thông tin thẻ bảo hiểm để theo dõi xác minh, claims và hồ sơ cần bổ sung.</p>
              <button type="button" onClick={() => setShowInsuranceForm(true)}>Thêm bảo hiểm</button>
            </section>
          ) : null}

          <section className="pi-kpi-grid" aria-label="Tổng quan bảo hiểm">
            {dashboardKpis.map((item) => (
              <article className={`pi-kpi-card pi-kpi-card--${item.tone}`} key={item.id}>
                <span className="pi-kpi-icon" aria-hidden="true">
                  <PatientIcon name={item.icon} />
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.value}</p>
                  <small>{item.helper}</small>
                  {item.progress !== undefined ? (
                    <div className="pi-kpi-progress">
                      <i style={{ '--pi-progress': `${item.progress}%` }} />
                      <span>{item.progress}%</span>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </section>

          <section className="pi-work-panel">
            <div className="pi-tabs" role="tablist" aria-label="Nội dung bảo hiểm">
              {dashboardTabs.map((tab) => (
                <button
                  className={activeTab === tab.key ? 'is-active' : ''}
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <PatientIcon name={tab.icon} aria-hidden="true" />
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' ? (
              <div className="pi-benefit-grid">
                {benefitRows.map(([label, value]) => (
                  <article key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
            ) : activeTab === 'missing' ? (
              <div className="pi-document-state">
                <PatientIcon name="upload_file" aria-hidden="true" />
                <strong>Hồ sơ cần bổ sung</strong>
                <p>Hóa đơn, chứng từ và giấy tờ bổ sung theo từng claim sẽ hiển thị tại đây.</p>
                <button type="button" onClick={handleUploadNotice}>Upload hồ sơ bổ sung</button>
              </div>
            ) : (
              <>
                <div className="pi-table-headline">
                  <h2>Lịch sử yêu cầu bồi thường</h2>
                  <select aria-label="Lọc trạng thái yêu cầu">
                    <option>Tất cả trạng thái</option>
                    <option>Đã duyệt</option>
                    <option>Đang xử lý</option>
                    <option>Từ chối</option>
                  </select>
                </div>

                <div className="pi-claim-table" role="table" aria-label="Lịch sử yêu cầu bồi thường">
                  <div className="pi-claim-table-row pi-claim-table-row--head" role="row">
                    <span>Mã hồ sơ</span>
                    <span>Ngày yêu cầu</span>
                    <span>Dịch vụ</span>
                    <span>Số tiền yêu cầu</span>
                    <span>Số tiền được duyệt</span>
                    <span>Trạng thái</span>
                    <span>Thao tác</span>
                  </div>
                  {claimRows.length ? claimRows.map((claim, index) => {
                    const claimMeta = getClaimStatusMeta(claim.status)
                    return (
                      <div className="pi-claim-table-row" role="row" key={getClaimId(claim, index)}>
                        <span>{claim.claim_no || getClaimId(claim, index)}</span>
                        <span>{getClaimDate(claim) || '--'}</span>
                        <span>{getClaimTitle(claim)}</span>
                        <span>{formatMoney(claim.submitted_amount)}</span>
                        <span>{Number(claim.approved_amount) ? formatMoney(claim.approved_amount) : '--'}</span>
                        <span><b className={`pi-claim-status pi-claim-status--${claimMeta.tone}`}>{claimMeta.label}</b></span>
                        <span><button type="button" aria-label="Xem hồ sơ"><PatientIcon name="image" aria-hidden="true" /></button></span>
                      </div>
                    )
                  }) : (
                    <div className="pi-claim-table-empty">Chưa có hồ sơ bồi thường cho thẻ này.</div>
                  )}
                </div>

                {selectedClaims.length > claimRows.length ? (
                  <button className="pi-show-all-button" type="button" onClick={() => setActiveTab('claims')}>
                    Xem tất cả hồ sơ
                    <PatientIcon name="expand_more" aria-hidden="true" />
                  </button>
                ) : null}
              </>
            )}
          </section>
        </main>

        <aside className="pi-dashboard-side" aria-label="Tiện ích bảo hiểm">
          <section className="pi-side-card pi-covered-card">
            <h2>Dịch vụ được bảo hiểm</h2>
            <div className="pi-covered-list">
              {coveredServices.map((service) => (
                <article key={service.title}>
                  <span><PatientIcon name={service.icon} aria-hidden="true" /></span>
                  <div>
                    <strong>{service.title}</strong>
                    <small>{service.copy}</small>
                  </div>
                  <PatientIcon name="check_circle" aria-hidden="true" />
                </article>
              ))}
            </div>
            <button type="button" onClick={() => setActiveTab('overview')}>
              Xem đầy đủ quyền lợi
              <PatientIcon name="arrow_forward" aria-hidden="true" />
            </button>
          </section>

          <section className="pi-side-card pi-upload-card">
            <h2>Gửi tài liệu yêu cầu bồi thường</h2>
            <p>Tải lên hóa đơn, chứng từ và hồ sơ liên quan để được xem xét bồi thường nhanh chóng.</p>
            <div>
              <PatientIcon name="upload_file" aria-hidden="true" />
              <strong>Kéo thả file vào đây</strong>
              <span>hoặc</span>
              <button type="button" onClick={handleUploadNotice}>
                <PatientIcon name="upload_file" aria-hidden="true" />
                Chọn file để tải lên
              </button>
              <small>Định dạng: JPG, PNG, PDF (tối đa 10MB/file)</small>
            </div>
          </section>

          <section className="pi-support-card">
            <div>
              <h2>Cần hỗ trợ về bảo hiểm?</h2>
              <p>Đội ngũ của chúng tôi luôn sẵn sàng hỗ trợ bạn.</p>
              <button type="button" onClick={() => onOpenSupportChat?.()}>
                <PatientIcon name="phone_forwarded" aria-hidden="true" />
                Liên hệ hỗ trợ
              </button>
            </div>
            <span aria-hidden="true"><PatientIcon name="help_clinic" /></span>
          </section>

          <button className="pi-back-link" type="button" onClick={onBackToDashboard}>
            Quay lại trang tổng quan
          </button>
        </aside>
      </div>
    </section>
  )
}
