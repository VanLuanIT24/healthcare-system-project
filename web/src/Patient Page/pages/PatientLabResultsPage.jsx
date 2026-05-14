import { useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import labResultsPatientHero from '../assets/lab-results-patient-hero.png'

const labTabs = [
  { id: 'all', label: 'Tất cả' },
  { id: 'normal', label: 'Bình thường' },
  { id: 'watch', label: 'Cần theo dõi' },
  { id: 'warning', label: 'Cảnh báo' },
]

const fallbackLabResults = [
  {
    id: 'lab-1',
    name: 'Công thức máu (CBC)',
    date: '20/05/2024',
    status: 'Bình thường',
    tone: 'normal',
    icon: 'experiment',
  },
  {
    id: 'lab-2',
    name: 'Đường huyết lúc đói (FPG)',
    date: '20/05/2024',
    status: 'Bình thường',
    tone: 'normal',
    icon: 'bloodtype',
  },
  {
    id: 'lab-3',
    name: 'Chức năng gan (ALT, AST)',
    date: '20/05/2024',
    status: 'Cảnh báo',
    tone: 'warning',
    icon: 'folder_shared',
  },
  {
    id: 'lab-4',
    name: 'Mỡ máu (Cholesterol)',
    date: '20/05/2024',
    status: 'Bình thường',
    tone: 'normal',
    icon: 'favorite',
  },
  {
    id: 'lab-5',
    name: 'Creatinine',
    date: '20/05/2024',
    status: 'Bình thường',
    tone: 'normal',
    icon: 'water_drop',
  },
]

function formatLabDate(value) {
  if (!value) {
    return 'Chưa có ngày'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function getLabIcon(name = '') {
  const lower = name.toLowerCase()

  if (lower.includes('glucose') || lower.includes('đường') || lower.includes('huyết')) {
    return 'bloodtype'
  }

  if (lower.includes('cholesterol') || lower.includes('mỡ') || lower.includes('tim')) {
    return 'favorite'
  }

  if (lower.includes('creatinine') || lower.includes('thận')) {
    return 'water_drop'
  }

  if (lower.includes('gan') || lower.includes('alt') || lower.includes('ast')) {
    return 'folder_shared'
  }

  return 'experiment'
}

function getLabTone(result = {}) {
  const summary = [
    result.interpretation,
    result.summary,
    result.notes,
    result.status,
    result.abnormal_flag,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (result.is_critical || summary.includes('critical') || summary.includes('cảnh báo')) {
    return { tone: 'warning', status: 'Cảnh báo' }
  }

  if (
    summary.includes('abnormal') ||
    summary.includes('bất thường') ||
    summary.includes('theo dõi') ||
    summary.includes('cao') ||
    summary.includes('thấp')
  ) {
    return { tone: 'watch', status: 'Cần theo dõi' }
  }

  return { tone: 'normal', status: 'Bình thường' }
}

function mapLabResult(result, index) {
  const order = result.lab_order_id || {}
  const name =
    result.test_name ||
    result.lab_test_name ||
    order.test_name ||
    result.result_name ||
    result.result_no ||
    result.lab_result_no ||
    `Kết quả xét nghiệm ${index + 1}`
  const tone = getLabTone(result)

  return {
    id: result.lab_result_id || result._id || result.id || `${name}-${index}`,
    name,
    date: formatLabDate(
      result.reported_at ||
        result.verified_at ||
        result.released_at ||
        result.completed_at ||
        order.completed_at ||
        order.ordered_at ||
        result.created_at,
    ),
    icon: getLabIcon(name),
    ...tone,
  }
}

export default function PatientLabResultsPage({ labResults = [], loading = false }) {
  const [activeTab, setActiveTab] = useState('all')
  const sourceResults = labResults.length ? labResults.map(mapLabResult) : loading ? [] : fallbackLabResults
  const visibleResults =
    activeTab === 'all' ? sourceResults : sourceResults.filter((result) => result.tone === activeTab)
  const totalCount = sourceResults.length
  const normalCount = sourceResults.filter((result) => result.tone === 'normal').length
  const warningCount = sourceResults.filter((result) => result.tone === 'warning').length
  const watchCount = sourceResults.filter((result) => result.tone === 'watch').length

  const summaryCards = [
    {
      id: 'all',
      label: 'Tất cả kết quả',
      count: totalCount,
      unit: 'xét nghiệm',
      icon: 'experiment',
      tone: 'blue',
    },
    {
      id: 'normal',
      label: 'Bình thường',
      count: normalCount,
      unit: 'xét nghiệm',
      icon: 'check',
      tone: 'green',
    },
    {
      id: 'warning',
      label: 'Cảnh báo',
      count: warningCount,
      unit: 'xét nghiệm',
      icon: 'warning',
      tone: 'orange',
    },
    {
      id: 'watch',
      label: 'Cần theo dõi',
      count: watchCount,
      unit: 'xét nghiệm',
      icon: 'verified_user',
      tone: 'soft',
    },
  ]

  return (
    <section
      className="patient-labs-page"
      style={{ '--patient-labs-background-image': `url(${labResultsPatientHero})` }}
    >
      <header className="patient-labs-hero">
        <div className="patient-labs-hero-copy">
          <h1>Kết quả xét nghiệm</h1>

          <div className="patient-labs-tabs" role="tablist" aria-label="Lọc kết quả xét nghiệm">
            {labTabs.map((tab) => {
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  className={`patient-labs-tab${isActive ? ' is-active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

      </header>

      <div className="patient-labs-summary-grid">
        {summaryCards.map((card) => (
          <button
            key={card.id}
            className={`patient-labs-summary-card ${card.tone}${activeTab === card.id ? ' is-active' : ''}`}
            type="button"
            onClick={() => setActiveTab(card.id)}
          >
            <span className="patient-labs-summary-icon" aria-hidden="true">
              <PatientIcon name={card.icon} />
            </span>
            <span className="patient-labs-summary-copy">
              <strong>{card.label}</strong>
              <span>
                <b>{card.count}</b>
                {card.unit}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="patient-labs-table-card">
        <div className="patient-labs-table-head" role="row">
          <span>Tên xét nghiệm</span>
          <span>Ngày xét nghiệm</span>
          <span>Kết quả</span>
          <span aria-label="Thao tác" />
        </div>

        <div className="patient-labs-list">
          {loading && !labResults.length ? (
            <div className="patient-labs-empty">Đang tải kết quả xét nghiệm...</div>
          ) : null}

          {!loading && visibleResults.length === 0 ? (
            <div className="patient-labs-empty">Không có kết quả phù hợp với bộ lọc hiện tại.</div>
          ) : null}

          {visibleResults.map((result) => (
            <button key={result.id} className="patient-labs-row" type="button">
              <span className={`patient-labs-test-icon ${result.tone}`} aria-hidden="true">
                <PatientIcon name={result.icon} />
              </span>

              <strong className="patient-labs-test-name">{result.name}</strong>

              <span className="patient-labs-date">
                <PatientIcon name="calendar_today" aria-hidden="true" />
                {result.date}
              </span>

              <span className={`patient-labs-status ${result.tone}`}>{result.status}</span>

              <span className="patient-labs-action" aria-hidden="true">
                <PatientIcon name="chevron_right" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="patient-labs-note">
        <span className="patient-labs-note-icon" aria-hidden="true">
          <PatientIcon name="info" />
        </span>
        <div>
          <strong>Sức khỏe là vốn quý nhất</strong>
          <p>Nếu bạn có chỉ số bất thường hoặc dấu hiệu sức khỏe không ổn, vui lòng liên hệ bác sĩ để được tư vấn và theo dõi kịp thời.</p>
        </div>
        <span className="patient-labs-note-art" aria-hidden="true">
          <PatientIcon name="monitor_heart" />
        </span>
      </div>
    </section>
  )
}
