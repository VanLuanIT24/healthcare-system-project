import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'

const fallbackPolicies = [
  {
    id: 'demo-bhxh',
    payer_name: 'Bảo hiểm Xã hội',
    payer_code: 'BHXH',
    policy_no: 'BHXH-0123456789',
    member_no: 'BHXH-0123456789',
    coverage_type: 'Hưu trí, tử tuất, ốm đau, thai sản',
    valid_from: '2024-01-01',
    valid_to: '2026-12-31',
    status: 'active',
    is_primary: true,
  },
  {
    id: 'demo-bhyt',
    payer_name: 'Bảo hiểm Y tế',
    payer_code: 'BHYT',
    policy_no: 'BHYT-9876543210',
    member_no: 'BHYT-9876543210',
    coverage_type: 'Khám chữa bệnh theo tuyến',
    valid_from: '2024-01-01',
    valid_to: '2026-12-31',
    status: 'active',
  },
]

const fallbackUsageHistory = [
  {
    id: 'demo-usage-bhxh-1',
    policy_id: 'demo-bhxh',
    claim_no: 'CLM-2024-0018',
    service_name: 'Nghỉ ốm hưởng BHXH',
    department_name: 'Phòng hồ sơ bảo hiểm',
    submitted_amount: 1200000,
    approved_amount: 1200000,
    paid_amount: 1200000,
    submitted_at: '2024-06-03',
    settled_at: '2024-06-10',
    status: 'settled',
  },
  {
    id: 'demo-usage-bhyt-1',
    policy_id: 'demo-bhyt',
    invoice_id: {
      invoice_no: 'HD-2024-000123',
      status: 'paid',
      total_amount: 1250000,
      balance_due: 0,
    },
    claim_no: 'CLM-2024-0024',
    service_name: 'Khám tổng quát định kỳ',
    department_name: 'Khoa Nội tổng quát',
    submitted_amount: 1000000,
    approved_amount: 850000,
    paid_amount: 850000,
    submitted_at: '2024-05-15',
    settled_at: '2024-05-20',
    status: 'settled',
  },
  {
    id: 'demo-usage-bhyt-2',
    policy_id: 'demo-bhyt',
    invoice_id: {
      invoice_no: 'HD-2024-000456',
      status: 'issued',
      total_amount: 760000,
      balance_due: 152000,
    },
    claim_no: 'CLM-2024-0031',
    service_name: 'Xét nghiệm máu và nước tiểu',
    department_name: 'Khoa Xét nghiệm',
    submitted_amount: 608000,
    approved_amount: 608000,
    paid_amount: 0,
    submitted_at: '2024-07-08',
    approved_at: '2024-07-09',
    status: 'approved',
  },
]

const logoTones = ['navy', 'teal', 'rose', 'amber', 'blue']

const statusMeta = {
  active: {
    label: 'CÒN HẠN',
    tone: 'active',
    action: 'Chi tiết',
    filter: 'active',
  },
  expired: {
    label: 'HẾT HẠN',
    tone: 'expired',
    action: 'Xem chi tiết',
    filter: 'expired',
  },
  cancelled: {
    label: 'ĐÃ HỦY',
    tone: 'expired',
    action: 'Xem chi tiết',
    filter: 'expired',
  },
  inactive: {
    label: 'TẠM NGƯNG',
    tone: 'expired',
    action: 'Xem chi tiết',
    filter: 'expired',
  },
  pending: {
    label: 'ĐANG CHỜ DUYỆT',
    tone: 'pending',
    action: 'Kiểm tra',
    filter: 'pending',
  },
  under_review: {
    label: 'ĐANG CHỜ DUYỆT',
    tone: 'pending',
    action: 'Kiểm tra',
    filter: 'pending',
  },
  submitted: {
    label: 'ĐANG CHỜ DUYỆT',
    tone: 'pending',
    action: 'Kiểm tra',
    filter: 'pending',
  },
  draft: {
    label: 'ĐANG CHỜ DUYỆT',
    tone: 'pending',
    action: 'Kiểm tra',
    filter: 'pending',
  },
}

const statusFilters = [
  { key: 'all', label: 'Tất cả' },
  { key: 'active', label: 'Còn hạn' },
  { key: 'expired', label: 'Hết hạn' },
]

const claimStatusMeta = {
  draft: { label: 'Nháp', tone: 'pending' },
  submitted: { label: 'Đã gửi', tone: 'pending' },
  under_review: { label: 'Đang duyệt', tone: 'pending' },
  approved: { label: 'Đã duyệt', tone: 'active' },
  partially_approved: { label: 'Duyệt một phần', tone: 'partial' },
  settled: { label: 'Đã chi trả', tone: 'active' },
  rejected: { label: 'Từ chối', tone: 'rejected' },
  cancelled: { label: 'Đã hủy', tone: 'rejected' },
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

function getPolicyId(policy, index) {
  return (
    policy._id ||
    policy.policy_id ||
    policy.id ||
    policy.policy_no ||
    policy.member_no ||
    `insurance-policy-${index}`
  )
}

function getProviderInitials(name, code) {
  const explicitCode = normalizeText(code)
  if (explicitCode) {
    return explicitCode.slice(0, 3).toUpperCase()
  }

  return normalizeText(name, 'BH')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-3)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function formatDate(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return dateFormatter.format(date)
}

function getStatusMeta(status) {
  const key = normalizeText(status, 'active').toLowerCase()
  return statusMeta[key] || statusMeta.active
}

function normalizePolicy(policy, index) {
  const payerName = normalizeText(
    policy.payer_name || policy.company_name || policy.insurer_name || policy.provider_name,
    `Bảo hiểm y tế ${index + 1}`,
  )
  const payerCode = normalizeText(policy.payer_code || policy.company_code || policy.insurer_code)
  const status = normalizeText(policy.status, 'active').toLowerCase()
  const meta = getStatusMeta(status)

  return {
    ...policy,
    id: getPolicyId(policy, index),
    payerName,
    payerCode,
    policyNo: normalizeText(policy.policy_no || policy.policy_number || policy.member_no, 'Chưa có mã thẻ'),
    memberNo: normalizeText(policy.member_no || policy.policy_no || policy.policy_number, 'Chưa có mã thành viên'),
    coverageType: normalizeText(policy.coverage_type || policy.plan_name || policy.type),
    coveragePercent: policy.coverage_percent,
    validFrom: policy.valid_from || policy.start_date || policy.effective_from,
    validTo: policy.valid_to || policy.end_date || policy.effective_to,
    status,
    meta,
    initials: getProviderInitials(payerName, payerCode),
    logoTone: logoTones[index % logoTones.length],
  }
}

function getPolicyClaims(policy, claims) {
  return claims.filter((claim) => {
    const claimPolicyId = claim.policy_id?._id || claim.policy_id || claim.policyId
    return String(claimPolicyId || '') === String(policy.id || policy._id || '')
  })
}

function getClaimId(claim, index) {
  return claim._id || claim.claim_id || claim.id || claim.claim_no || `insurance-usage-${index}`
}

function getClaimStatusMeta(status) {
  const key = normalizeText(status, 'submitted').toLowerCase()
  return claimStatusMeta[key] || claimStatusMeta.submitted
}

function formatMoney(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return moneyFormatter.format(0)
  return moneyFormatter.format(numberValue)
}

function getClaimDate(claim) {
  return formatDate(claim.settled_at || claim.approved_at || claim.submitted_at || claim.created_at)
}

function getClaimInvoiceNo(claim) {
  return normalizeText(claim.invoice_id?.invoice_no || claim.invoice_no || claim.invoice_number)
}

function getClaimTitle(claim) {
  return normalizeText(
    claim.service_name || claim.service || claim.department_name || claim.facility_name,
    `Hồ sơ ${claim.claim_no || 'bồi thường bảo hiểm'}`,
  )
}

function getClaimNote(claim) {
  return normalizeText(claim.rejection_reason || claim.cancel_reason || claim.note || claim.description)
}

function getPolicyTypeLabel(policy) {
  const code = String(policy.payerCode || policy.payer_code || '').toUpperCase()
  const name = policy.payerName || policy.payer_name || ''

  if (code.includes('BHYT') || name.toLowerCase().includes('y tế')) {
    return 'Bảo hiểm y tế (BHYT)'
  }

  if (code.includes('BHXH') || name.toLowerCase().includes('xã hội')) {
    return 'Bảo hiểm xã hội (BHXH)'
  }

  return name || 'Bảo hiểm'
}

function getPolicyNumberLabel(policy) {
  const code = String(policy.payerCode || '').toUpperCase()
  const typeLabel = getPolicyTypeLabel(policy)

  if (code.includes('BHXH') || typeLabel.includes('xã hội')) {
    return 'Số sổ BHXH'
  }

  if (code.includes('BHYT') || typeLabel.includes('y tế')) {
    return 'Số thẻ BHYT'
  }

  return 'Số thẻ bảo hiểm'
}

function getInitialCarePlace(policy) {
  return normalizeText(
    policy.initial_care_place ||
      policy.registered_hospital ||
      policy.primary_hospital ||
      policy.registration_facility ||
      policy.facility_name,
    'Bệnh viện Đa khoa HealthCare',
  )
}

function getBenefitPercent(policy) {
  if (policy.coveragePercent !== undefined && policy.coveragePercent !== null && policy.coveragePercent !== '') {
    return `${policy.coveragePercent}%`
  }

  return '80%'
}

function getBenefitScope(policy) {
  return normalizeText(policy.coverageType || policy.benefit_scope || policy.scope, 'Khám chữa bệnh đúng tuyến')
}

function getBenefitCode(policy) {
  const explicitCode = normalizeText(policy.benefit_code || policy.right_code || policy.coverage_code)
  if (explicitCode) return explicitCode

  const cardCode = normalizeText(policy.memberNo || policy.policyNo).replace(/[^a-zA-Z0-9]/g, '')
  if (cardCode.length >= 5) return cardCode.slice(0, 5).toUpperCase()

  return 'GD401'
}

function getParticipationTime(policy) {
  if (policy.participation_years) return `${policy.participation_years} năm`
  if (policy.joined_years) return `${policy.joined_years} năm`
  return normalizeText(policy.participation_time || policy.joined_time, '5 năm')
}

function InsuranceLogo({ policy, compact = false }) {
  return (
    <div className={`pi-provider-logo pi-provider-logo--${policy.logoTone}${compact ? ' is-compact' : ''}`}>
      <strong>{policy.initials}</strong>
      <span>Bảo hiểm</span>
    </div>
  )
}

function StatusBadge({ meta }) {
  return <span className={`pi-status pi-status--${meta.tone}`}>{meta.label}</span>
}

export default function PatientInsurancePage({
  claims = [],
  error = '',
  loading = false,
  onBackToDashboard,
  policies = [],
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [detailPolicyId, setDetailPolicyId] = useState('')
  const [notice, setNotice] = useState('')
  const sourcePolicies = policies.length ? policies : fallbackPolicies
  const sourceClaims = claims.length ? claims : fallbackUsageHistory

  const normalizedPolicies = useMemo(
    () => sourcePolicies.map((policy, index) => normalizePolicy(policy, index)),
    [sourcePolicies],
  )

  const companyOptions = useMemo(() => {
    const seen = new Set()
    return normalizedPolicies.filter((policy) => {
      if (seen.has(policy.payerName)) return false
      seen.add(policy.payerName)
      return true
    })
  }, [normalizedPolicies])

  const filteredPolicies = useMemo(
    () =>
      normalizedPolicies.filter((policy) => {
        const matchesStatus = statusFilter === 'all' || policy.meta.filter === statusFilter
        const matchesCompany = companyFilter === 'all' || policy.payerName === companyFilter
        return matchesStatus && matchesCompany
      }),
    [companyFilter, normalizedPolicies, statusFilter],
  )

  useEffect(() => {
    if (!filteredPolicies.length) {
      setSelectedPolicyId('')
      setDetailPolicyId('')
      return
    }

    if (!filteredPolicies.some((policy) => policy.id === selectedPolicyId)) {
      setSelectedPolicyId(filteredPolicies[0].id)
    }

    if (detailPolicyId && !filteredPolicies.some((policy) => policy.id === detailPolicyId)) {
      setDetailPolicyId('')
    }
  }, [detailPolicyId, filteredPolicies, selectedPolicyId])

  const selectedPolicy = filteredPolicies.find((policy) => policy.id === selectedPolicyId)
  const detailPolicy = filteredPolicies.find((policy) => policy.id === detailPolicyId)
  const selectedPolicyClaims = useMemo(
    () => (selectedPolicy ? getPolicyClaims(selectedPolicy, sourceClaims) : []),
    [selectedPolicy, sourceClaims],
  )
  const selectedPolicyClaimSummary = useMemo(
    () =>
      selectedPolicyClaims.reduce(
        (summary, claim) => ({
          approved: summary.approved + (Number(claim.approved_amount) || 0),
          paid: summary.paid + (Number(claim.paid_amount) || 0),
          submitted: summary.submitted + (Number(claim.submitted_amount) || 0),
        }),
        { approved: 0, paid: 0, submitted: 0 },
      ),
    [selectedPolicyClaims],
  )

  const handleAddInsurance = () => {
    setNotice('Chức năng gửi thông tin bảo hiểm mới đang chờ API tự phục vụ từ backend.')
  }

  return (
    <section className="patient-insurance-page">
      <div className="pi-card-shell">
        <header className="pi-header">
          <div className="pi-title-row">
            <h1>DANH SÁCH BẢO HIỂM CHÍNH ĐÃ ĐĂNG KÝ</h1>
          </div>

          <div className="pi-toolbar">
            <button className="pi-add-button" type="button" onClick={handleAddInsurance}>
              <PatientIcon name="add" aria-hidden="true" />
              <span>THÊM BẢO HIỂM MỚI</span>
            </button>

            <div className="pi-filter-group" aria-label="Lọc trạng thái bảo hiểm">
              <span>Lọc theo trạng thái:</span>
              <div className="pi-segmented">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.key}
                    className={statusFilter === filter.key ? 'is-active' : ''}
                    type="button"
                    onClick={() => setStatusFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="pi-company-filter">
              <span>Lọc theo công ty:</span>
              <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
                <option value="all">Tất cả công ty</option>
                {companyOptions.map((policy) => (
                  <option key={policy.payerName} value={policy.payerName}>
                    {policy.payerName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {notice ? (
          <div className="pi-notice" role="status">
            <PatientIcon name="info" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        ) : null}

        {loading ? <div className="patient-dashboard-state">Đang tải thông tin bảo hiểm...</div> : null}

        {!loading && error ? (
          <div className="patient-dashboard-state patient-dashboard-state-error">{error}</div>
        ) : null}

        <div className="pi-policy-grid">
          {filteredPolicies.map((policy) => {
            const isSelected = policy.id === selectedPolicy?.id
            const policyClaims = getPolicyClaims(policy, sourceClaims)
            const validFrom = formatDate(policy.validFrom)
            const validTo = formatDate(policy.validTo)
            const validityText = validFrom || validTo ? `Từ ${validFrom || '--'} đến ${validTo || '--'}` : 'Đang chờ cập nhật'

            return (
              <div className="pi-policy-row" key={policy.id}>
                <button
                  className={`pi-policy-card${isSelected ? ' is-selected' : ''}`}
                  type="button"
                  onClick={() => setSelectedPolicyId(policy.id)}
                >
                  <InsuranceLogo policy={policy} />

                  <div className="pi-policy-copy">
                    <h2>{policy.payerName}</h2>
                    <p>{policy.policyNo}</p>
                    {policy.validFrom || policy.validTo ? <span>{validityText}</span> : null}
                    {!policy.validFrom && !policy.validTo ? <span>Đang chờ cập nhật</span> : null}
                  </div>

                  <div className="pi-policy-meta">
                    <StatusBadge meta={policy.meta} />
                    {policy.meta.filter !== 'active' ? (
                      <span className={`pi-inline-action pi-inline-action--${policy.meta.tone}`}>
                        {policy.meta.action}
                      </span>
                    ) : null}
                  </div>
                </button>

                <article className={`pi-detail-card${isSelected ? ' is-selected' : ''}`}>
                  {isSelected ? (
                    <>
                      <div className="pi-detail-main">
                        <InsuranceLogo policy={policy} compact />
                        <div className="pi-verified-mark" aria-hidden="true">
                          <PatientIcon name={policy.meta.filter === 'expired' ? 'warning' : 'check_circle'} />
                        </div>
                        <div className="pi-detail-copy">
                          <strong>{validityText}</strong>
                          <span>
                            {policy.coveragePercent !== undefined && policy.coveragePercent !== null
                              ? `Chi trả ${policy.coveragePercent}%`
                              : policy.coverageType || 'Thông tin quyền lợi sẽ hiển thị khi có dữ liệu.'}
                          </span>
                          {policyClaims.length ? <small>{policyClaims.length} hồ sơ bồi thường liên quan</small> : null}
                        </div>
                      </div>

                      <button
                        className="pi-detail-button"
                        type="button"
                        onClick={() => {
                          setSelectedPolicyId(policy.id)
                          setDetailPolicyId(policy.id)
                        }}
                      >
                        {policy.meta.action}
                      </button>
                    </>
                  ) : (
                    <button
                      className="pi-detail-button"
                      type="button"
                      onClick={() => {
                        setSelectedPolicyId(policy.id)
                        setDetailPolicyId(policy.id)
                      }}
                    >
                      {policy.meta.action}
                    </button>
                  )}
                </article>
              </div>
            )
          })}
        </div>

        {selectedPolicy ? (
          <section className="pi-usage-panel" aria-label="Lịch sử sử dụng bảo hiểm">
            <div className="pi-usage-head">
              <div>
                <span className="pi-section-eyebrow">Theo thẻ đang chọn</span>
                <h2>Lịch sử sử dụng bảo hiểm</h2>
              </div>

              <div className="pi-usage-summary" aria-label="Tổng quan lịch sử sử dụng bảo hiểm">
                <div>
                  <span>Số hồ sơ</span>
                  <strong>{selectedPolicyClaims.length}</strong>
                </div>
                <div>
                  <span>Đã duyệt</span>
                  <strong>{formatMoney(selectedPolicyClaimSummary.approved)}</strong>
                </div>
                <div>
                  <span>Đã chi trả</span>
                  <strong>{formatMoney(selectedPolicyClaimSummary.paid)}</strong>
                </div>
              </div>
            </div>

            {selectedPolicyClaims.length ? (
              <div className="pi-usage-list">
                {selectedPolicyClaims.map((claim, index) => {
                  const claimMeta = getClaimStatusMeta(claim.status)
                  const claimDate = getClaimDate(claim)
                  const invoiceNo = getClaimInvoiceNo(claim)
                  const claimNote = getClaimNote(claim)

                  return (
                    <article className="pi-usage-item" key={getClaimId(claim, index)}>
                      <span className="pi-usage-icon" aria-hidden="true">
                        <PatientIcon name="receipt_long" />
                      </span>

                      <div className="pi-usage-copy">
                        <div className="pi-usage-title-row">
                          <h3>{getClaimTitle(claim)}</h3>
                          <span className={`pi-claim-status pi-claim-status--${claimMeta.tone}`}>
                            {claimMeta.label}
                          </span>
                        </div>
                        <p>
                          {invoiceNo ? `Hóa đơn ${invoiceNo}` : 'Chưa liên kết hóa đơn'}
                          {claimDate ? ` | ${claimDate}` : ''}
                        </p>
                        {claimNote ? <small>{claimNote}</small> : null}
                      </div>

                      <dl className="pi-usage-amounts">
                        <div>
                          <dt>Đề nghị</dt>
                          <dd>{formatMoney(claim.submitted_amount)}</dd>
                        </div>
                        <div>
                          <dt>Được duyệt</dt>
                          <dd>{formatMoney(claim.approved_amount)}</dd>
                        </div>
                        <div>
                          <dt>Đã chi trả</dt>
                          <dd>{formatMoney(claim.paid_amount)}</dd>
                        </div>
                      </dl>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="pi-usage-empty">
                Chưa có lượt sử dụng bảo hiểm cho thẻ này.
              </div>
            )}
          </section>
        ) : null}

        {detailPolicy ? (
          <section className="pi-info-panel" aria-label="Chi tiết bảo hiểm">
            <article className="pi-info-card">
              <div className="pi-info-card-head">
                <span className="pi-info-head-icon" aria-hidden="true">
                  <PatientIcon name="verified_user" />
                </span>
                <h2>Thông tin bảo hiểm</h2>
              </div>

              <dl className="pi-info-list">
                <div>
                  <dt>Loại bảo hiểm</dt>
                  <dd>{getPolicyTypeLabel(detailPolicy)}</dd>
                </div>
                <div>
                  <dt>{getPolicyNumberLabel(detailPolicy)}</dt>
                  <dd>{detailPolicy.memberNo || detailPolicy.policyNo}</dd>
                </div>
                <div>
                  <dt>Ngày hiệu lực</dt>
                  <dd>{formatDate(detailPolicy.validFrom) || 'Đang cập nhật'}</dd>
                </div>
                <div>
                  <dt>Ngày hết hạn</dt>
                  <dd>{formatDate(detailPolicy.validTo) || 'Đang cập nhật'}</dd>
                </div>
                <div>
                  <dt>Nơi đăng ký KCB ban đầu</dt>
                  <dd>{getInitialCarePlace(detailPolicy)}</dd>
                </div>
              </dl>

              <div className={`pi-validity-box pi-validity-box--${detailPolicy.meta.tone}`}>
                <span aria-hidden="true">
                  <PatientIcon name={detailPolicy.meta.filter === 'expired' ? 'warning' : 'check_circle'} />
                </span>
                <div>
                  <strong>
                    {detailPolicy.meta.filter === 'expired'
                      ? 'Hết hiệu lực'
                      : detailPolicy.meta.filter === 'pending'
                        ? 'Đang chờ duyệt'
                        : 'Còn hiệu lực'}
                  </strong>
                  <p>
                    {detailPolicy.meta.filter === 'expired'
                      ? `Thẻ đã hết hiệu lực từ ${formatDate(detailPolicy.validTo) || 'ngày chưa cập nhật'}`
                      : detailPolicy.meta.filter === 'pending'
                        ? 'Thông tin bảo hiểm đang được kiểm tra.'
                        : `Thẻ BHYT còn hiệu lực đến ${formatDate(detailPolicy.validTo) || 'ngày chưa cập nhật'}`}
                  </p>
                </div>
              </div>
            </article>

            <article className="pi-info-card">
              <div className="pi-info-card-head">
                <span className="pi-info-head-icon" aria-hidden="true">
                  <PatientIcon name="calendar_today" />
                </span>
                <h2>Thông tin quyền lợi</h2>
                <button className="pi-info-close" type="button" aria-label="Đóng chi tiết" onClick={() => setDetailPolicyId('')}>
                  <PatientIcon name="close" aria-hidden="true" />
                </button>
              </div>

              <dl className="pi-info-list">
                <div>
                  <dt>Mức hưởng</dt>
                  <dd>{getBenefitPercent(detailPolicy)}</dd>
                </div>
                <div>
                  <dt>Phạm vi hưởng</dt>
                  <dd>{getBenefitScope(detailPolicy)}</dd>
                </div>
                <div>
                  <dt>Mã quyền lợi</dt>
                  <dd>{getBenefitCode(detailPolicy)}</dd>
                </div>
                <div>
                  <dt>Thời gian tham gia</dt>
                  <dd>{getParticipationTime(detailPolicy)}</dd>
                </div>
              </dl>
            </article>
          </section>
        ) : null}

        {!loading && filteredPolicies.length === 0 ? (
          <div className="pi-empty-state">
            Không tìm thấy bảo hiểm phù hợp với bộ lọc hiện tại.
          </div>
        ) : null}

        <div className="pi-footer-actions">
          <button className="pi-back-button" type="button" onClick={onBackToDashboard}>
            Quay lại trang tổng quan
          </button>
        </div>
      </div>
    </section>
  )
}
