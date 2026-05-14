import { useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import {
  healthTrendMetrics,
  historicalBiometrics,
  upcomingTests,
} from '../data/patientPageData'

const chartFilters = [
  { key: 'all', label: 'Tất cả' },
  { key: 'bp', label: 'Huyết áp' },
  { key: 'hr', label: 'Nhịp tim' },
  { key: 'bmi', label: 'BMI' },
]

const sparkLines = {
  'blood-pressure': [42, 48, 72, 86, 66, 52, 62, 57, 65, 60, 58, 63, 55, 50, 56, 52],
  'heart-rate': [35, 48, 82, 55, 46, 68, 50, 58, 44, 76, 57, 79, 42, 50, 61, 53],
  bmi: [54, 58, 61, 52, 59, 50, 57, 62, 66, 45, 53, 56, 42, 51, 48, 52],
  sleep: [36, 44, 42, 55, 45, 70, 56, 48, 62, 50, 66, 43, 58, 41, 72],
}

const chartData = [
  { label: '25/02', systolic: 121, diastolic: 80, heartRate: 72, bmi: 22.3 },
  { label: '05/03', systolic: 123, diastolic: 82, heartRate: 74, bmi: 22.4 },
  { label: '15/03', systolic: 118, diastolic: 79, heartRate: 70, bmi: 22.3 },
  { label: '25/03', systolic: 124, diastolic: 83, heartRate: 73, bmi: 22.5 },
  { label: '04/04', systolic: 119, diastolic: 78, heartRate: 71, bmi: 22.2 },
  { label: '14/04', systolic: 122, diastolic: 81, heartRate: 72, bmi: 22.4 },
  { label: '24/04', systolic: 120, diastolic: 80, heartRate: 72, bmi: 22.3 },
  { label: '04/05', systolic: 117, diastolic: 76, heartRate: 69, bmi: 22.2 },
  { label: '14/05', systolic: 115, diastolic: 75, heartRate: 68, bmi: 22.2 },
  { label: '24/05', systolic: 121, diastolic: 79, heartRate: 71, bmi: 22.3 },
  { label: '03/06', systolic: 126, diastolic: 84, heartRate: 73, bmi: 22.5 },
  { label: '13/06', systolic: 120, diastolic: 78, heartRate: 70, bmi: 22.4 },
  { label: '24/06', systolic: 120, diastolic: 80, heartRate: 72, bmi: 22.4 },
]

const wellnessRecommendations = [
  {
    id: 'move',
    icon: 'directions_walk',
    tone: 'mint',
    title: 'Duy trì vận động đều đặn',
    body: 'Đi bộ 30 phút mỗi ngày giúp tim mạch khỏe mạnh.',
  },
  {
    id: 'nutrition',
    icon: 'nutrition',
    tone: 'amber',
    title: 'Kiểm soát muối và đường',
    body: 'Hạn chế muối dưới 5g/ngày và giảm đồ ngọt.',
  },
  {
    id: 'sleep',
    icon: 'bedtime',
    tone: 'violet',
    title: 'Ngủ đủ giấc',
    body: 'Duy trì 7-8 giờ ngủ mỗi đêm để phục hồi cơ thể.',
  },
]

const trendRows = [
  {
    id: 'today-bp',
    date: '24/06/2024',
    time: '08:30',
    icon: 'monitor_heart',
    category: 'Huyết áp',
    value: '120/80 mmHg',
    status: 'Tối ưu',
    tone: 'good',
    clinician: 'BS. Marcus Thorne',
  },
  {
    id: 'today-hr',
    date: '24/06/2024',
    time: '08:30',
    icon: 'favorite',
    category: 'Nhịp tim',
    value: '72 bpm',
    status: 'Ổn định',
    tone: 'good',
    clinician: 'Tự cập nhật',
  },
  {
    id: 'today-weight',
    date: '24/06/2024',
    time: '08:30',
    icon: 'scale',
    category: 'Cân nặng',
    value: '74.0 kg',
    status: 'Ổn định',
    tone: 'good',
    clinician: 'Tự cập nhật',
  },
  ...historicalBiometrics.map((entry) => ({
    ...entry,
    time: entry.id === 'bio-1' ? '09:15' : '14:30',
    icon: entry.category === 'Nhịp tim' ? 'favorite' : entry.category === 'Cân nặng' ? 'scale' : 'monitor_heart',
  })),
]

function buildMetricCards() {
  const sleepMetric = {
    id: 'sleep',
    icon: 'bedtime',
    tone: 'violet',
    label: 'Giấc ngủ',
    badge: 'Tốt',
    badgeTone: 'good',
    value: '7h 15m',
    unit: '',
    note: 'Trung bình 7 ngày gần nhất',
    trend: 'Duy trì nhịp sinh học ổn định',
    trendTone: 'good',
  }

  return [...healthTrendMetrics, sleepMetric]
}

function buildPolyline(values, min, max, width = 720, height = 220) {
  const step = width / Math.max(values.length - 1, 1)
  const range = max - min || 1

  return values
    .map((value, index) => {
      const x = Math.round(index * step)
      const y = Math.round(height - ((value - min) / range) * height)

      return `${x},${y}`
    })
    .join(' ')
}

function buildSparkline(values, width = 160, height = 48) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const step = width / Math.max(values.length - 1, 1)
  const range = max - min || 1

  return values
    .map((value, index) => {
      const x = Math.round(index * step)
      const y = Math.round(height - ((value - min) / range) * height)

      return `${x},${y}`
    })
    .join(' ')
}

function shouldShowLine(activeFilter, lineType) {
  if (activeFilter === 'all') return true
  if (activeFilter === 'bp') return lineType === 'systolic' || lineType === 'diastolic'
  return activeFilter === lineType
}

export default function PatientHealthTrendsPage({ patientName }) {
  const [activeFilter, setActiveFilter] = useState('all')
  const metricCards = buildMetricCards()
  const systolicPoints = buildPolyline(chartData.map((item) => item.systolic), 0, 150)
  const diastolicPoints = buildPolyline(chartData.map((item) => item.diastolic), 0, 150)
  const heartRatePoints = buildPolyline(chartData.map((item) => item.heartRate), 0, 150)
  const bmiPoints = buildPolyline(chartData.map((item) => item.bmi), 10, 30)
  const focusPoint = chartData[6]

  return (
    <div className="patient-trends-page">
      <section className="patient-trends-shell">
        <main className="patient-trends-main">
          <header className="patient-trends-header">
            <div>
              <h1>Xu hướng sức khỏe</h1>
              <p>Phân tích và theo dõi các chỉ số sinh hiệu quan trọng của {patientName}</p>
            </div>
          </header>

          <section className="patient-trends-metric-grid">
            {metricCards.map((metric) => {
              const sparkline = buildSparkline(sparkLines[metric.id] || sparkLines.bmi)

              return (
                <article key={metric.id} className="patient-trend-card">
                  <div className="patient-trend-card-head">
                    <span className={`patient-trend-icon ${metric.tone}`}>
                      <PatientIcon name={metric.icon} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="patient-trend-label">{metric.label}</p>
                      <div className="patient-trend-value">
                        <strong>{metric.value}</strong>
                        {metric.accent ? <em>{metric.accent}</em> : null}
                        {metric.secondaryValue ? <strong>{metric.secondaryValue}</strong> : null}
                        {metric.unit ? <span>{metric.unit}</span> : null}
                      </div>
                    </div>
                    <span className={`patient-trend-badge ${metric.badgeTone}`}>{metric.badge}</span>
                  </div>

                  <p className="patient-trend-note">{metric.note}</p>

                  <svg className={`patient-trend-spark ${metric.tone}`} viewBox="0 0 160 54" aria-hidden="true">
                    <defs>
                      <linearGradient id={`spark-${metric.id}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polyline
                      points={`0,54 ${sparkline} 160,54`}
                      className="patient-trend-spark-fill"
                      fill={`url(#spark-${metric.id})`}
                    />
                    <polyline points={sparkline} className="patient-trend-spark-line" />
                    <circle cx="158" cy={sparkline.split(' ').at(-1)?.split(',')[1] || 24} r="4" />
                  </svg>
                </article>
              )
            })}
          </section>

          <section className="patient-panel patient-trend-chart-panel">
            <div className="patient-trend-chart-head">
              <div>
                <h2>Diễn biến sức khỏe trong 6 tháng</h2>
                <p>So sánh huyết áp, nhịp tim và BMI theo thời gian.</p>
              </div>

              <div className="patient-trend-chart-actions">
                <div className="patient-trend-chart-filters">
                  {chartFilters.map((filter) => (
                    <button
                      key={filter.key}
                      className={activeFilter === filter.key ? 'is-active' : ''}
                      type="button"
                      onClick={() => setActiveFilter(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <button className="patient-trend-range-button" type="button">
                  <PatientIcon name="calendar_month" aria-hidden="true" />
                  6 tháng qua
                  <PatientIcon name="expand_more" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="patient-trend-chart-legend">
              <span className="bp-sys">Huyết áp tâm thu (mmHg)</span>
              <span className="bp-dia">Huyết áp tâm trương (mmHg)</span>
              <span className="hr">Nhịp tim (bpm)</span>
              <span className="bmi">BMI</span>
            </div>

            <div className="patient-trend-line-chart">
              <div className="patient-trend-y-axis left">
                <span>150</span>
                <span>120</span>
                <span>90</span>
                <span>60</span>
                <span>30</span>
                <span>0</span>
              </div>
              <svg viewBox="0 0 720 220" preserveAspectRatio="none" aria-label="Biểu đồ xu hướng sức khỏe">
                <g className="patient-chart-grid">
                  <line x1="0" x2="720" y1="0" y2="0" />
                  <line x1="0" x2="720" y1="44" y2="44" />
                  <line x1="0" x2="720" y1="88" y2="88" />
                  <line x1="0" x2="720" y1="132" y2="132" />
                  <line x1="0" x2="720" y1="176" y2="176" />
                  <line x1="0" x2="720" y1="220" y2="220" />
                </g>
                <line className="patient-chart-focus-line" x1="360" x2="360" y1="0" y2="220" />
                {shouldShowLine(activeFilter, 'systolic') ? (
                  <polyline className="patient-chart-line bp-sys" points={systolicPoints} />
                ) : null}
                {shouldShowLine(activeFilter, 'diastolic') ? (
                  <polyline className="patient-chart-line bp-dia" points={diastolicPoints} />
                ) : null}
                {shouldShowLine(activeFilter, 'hr') ? (
                  <polyline className="patient-chart-line hr" points={heartRatePoints} />
                ) : null}
                {shouldShowLine(activeFilter, 'bmi') ? (
                  <polyline className="patient-chart-line bmi" points={bmiPoints} />
                ) : null}
                <circle className="patient-chart-focus-dot bp-sys" cx="360" cy="44" r="5" />
                <circle className="patient-chart-focus-dot bp-dia" cx="360" cy="102" r="5" />
                <circle className="patient-chart-focus-dot hr" cx="360" cy="114" r="5" />
                <circle className="patient-chart-focus-dot bmi" cx="360" cy="84" r="5" />
              </svg>
              <div className="patient-trend-y-axis right">
                <span>bpm</span>
                <span>120</span>
                <span>90</span>
                <span>60</span>
                <span>30</span>
                <span>BMI</span>
              </div>
              <div className="patient-trend-tooltip">
                <strong>24/04/2024</strong>
                <span className="bp-sys">Huyết áp tâm thu: {focusPoint.systolic} mmHg</span>
                <span className="bp-dia">Huyết áp tâm trương: {focusPoint.diastolic} mmHg</span>
                <span className="hr">Nhịp tim: {focusPoint.heartRate} bpm</span>
                <span className="bmi">BMI: {focusPoint.bmi}</span>
              </div>
              <div className="patient-trend-x-axis">
                {chartData.filter((_, index) => index % 2 === 0).map((item) => (
                  <span key={item.label}>{item.label}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="patient-panel patient-trend-history-panel">
            <div className="patient-trend-history-head">
              <h2>Dữ liệu chỉ số theo thời gian</h2>
              <button type="button">
                <PatientIcon name="download" aria-hidden="true" />
                <span>Xuất CSV</span>
              </button>
            </div>

            <div className="patient-trend-table-wrap">
              <table className="patient-trend-table">
                <thead>
                  <tr>
                    <th>Ngày ghi nhận</th>
                    <th>Loại chỉ số</th>
                    <th>Giá trị</th>
                    <th>Trạng thái</th>
                    <th>Người theo dõi</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {trendRows.slice(0, 6).map((entry) => (
                    <tr key={entry.id}>
                      <td className="patient-trend-date">
                        <PatientIcon name="calendar_today" aria-hidden="true" />
                        <span>{entry.date}</span>
                        <small>{entry.time}</small>
                      </td>
                      <td>
                        <span className={`patient-trend-table-icon ${entry.tone}`}>
                          <PatientIcon name={entry.icon} aria-hidden="true" />
                        </span>
                        {entry.category}
                      </td>
                      <td className="patient-trend-value-cell">{entry.value}</td>
                      <td>
                        <span className={`patient-pill ${entry.tone}`}>{entry.status}</span>
                      </td>
                      <td>{entry.clinician}</td>
                      <td>
                        <button className="patient-trend-row-menu" type="button" aria-label="Tùy chọn">
                          <PatientIcon name="more_vert" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        <aside className="patient-trends-side-column">
          <section className="patient-health-score-card">
            <h3>Điểm sức khỏe</h3>
            <div className="patient-health-score-ring">
              <svg viewBox="0 0 160 100" aria-hidden="true">
                <path className="track" d="M24 84 A56 56 0 0 1 136 84" />
                <path className="progress" d="M24 84 A56 56 0 0 1 136 84" />
              </svg>
              <strong>92</strong>
              <span>/100</span>
            </div>
            <p><strong>Rất tốt!</strong> Bạn đang duy trì lối sống lành mạnh.</p>
            <button type="button">
              Xem chi tiết báo cáo
              <PatientIcon name="chevron_right" aria-hidden="true" />
            </button>
          </section>

          <section className="patient-panel patient-wellness-card">
            <div className="patient-wellness-head">
              <PatientIcon name="tips_and_updates" aria-hidden="true" />
              <h3>Khuyến nghị sức khỏe</h3>
            </div>
            <div className="patient-wellness-list">
              {wellnessRecommendations.map((item) => (
                <article key={item.id} className="patient-wellness-item">
                  <span className={item.tone}>
                    <PatientIcon name={item.icon} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
            <button className="patient-wellness-action" type="button">
              Xem tất cả khuyến nghị
              <PatientIcon name="chevron_right" aria-hidden="true" />
            </button>
          </section>

          <section className="patient-panel patient-trend-tests-card">
            <div className="patient-trend-tests-head">
              <h3>Xét nghiệm sắp tới</h3>
              <button type="button">Xem tất cả</button>
            </div>

            <div className="patient-trend-tests-list">
              {upcomingTests.map((test) => (
                <button key={test.id} className="patient-trend-test-row" type="button">
                  <span className={`patient-trend-test-icon ${test.tone}`}>
                    <PatientIcon name={test.icon} aria-hidden="true" />
                  </span>

                  <span className="patient-trend-test-copy">
                    <strong>{test.title}</strong>
                    <small>{test.subtitle}</small>
                  </span>

                  <PatientIcon name="chevron_right" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  )
}
