import { useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import {
  healthRecommendations,
  healthTrendChartFilters,
  healthTrendMetrics,
  healthTrendSeries,
  historicalBiometrics,
  upcomingTests,
} from '../data/patientPageData'

export default function PatientHealthTrendsPage({ patientName }) {
  const [activeFilter, setActiveFilter] = useState('all')

  return (
    <div className="patient-trends-page">
      <section className="patient-trends-header">
        <div>
          <h1>Xu hướng sức khỏe</h1>
          <p>Phân tích chỉ số sinh hiệu của {patientName}</p>
        </div>
      </section>

      <section className="patient-trends-metric-grid">
        {healthTrendMetrics.map((metric) => (
          <article key={metric.id} className="patient-trend-card">
            <div className="patient-trend-card-top">
              <span className={`patient-trend-icon ${metric.tone}`}>
                <PatientIcon name={metric.icon} aria-hidden="true" />
              </span>
              <span className={`patient-trend-badge ${metric.badgeTone}`}>{metric.badge}</span>
            </div>

            <p className="patient-trend-label">{metric.label}</p>

            <div className="patient-trend-value">
              <strong>{metric.value}</strong>
              {metric.accent ? <em>{metric.accent}</em> : null}
              {metric.secondaryValue ? <strong>{metric.secondaryValue}</strong> : null}
              {metric.unit ? <span>{metric.unit}</span> : null}
            </div>

            <p className="patient-trend-note">{metric.note}</p>

            <div className="patient-trend-footer">
              <span className={`patient-trend-footer-copy ${metric.trendTone}`}>
                <PatientIcon name={metric.trendIcon} aria-hidden="true" />
                <span>{metric.trend}</span>
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="patient-trends-analytics-grid">
        <div className="patient-panel patient-trend-chart-panel">
          <div className="patient-trend-chart-head">
            <div>
              <h2>Diễn biến sức khỏe trong 6 tháng</h2>
              <p>Phân tích tổng hợp các chỉ số sinh hiệu</p>
            </div>

            <div className="patient-trend-chart-filters">
              {healthTrendChartFilters.map((filter) => (
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
          </div>

          <div className="patient-trend-chart-stage">
            <div className="patient-trend-gridlines" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="patient-trend-bars">
              {healthTrendSeries.map((item) => (
                <div key={item.month} className="patient-trend-bar-group">
                  <div className="patient-trend-bar-stack">
                    {(activeFilter === 'all' || activeFilter === 'bp') && (
                      <span
                        className="patient-trend-bar is-soft"
                        style={{ height: `${item.bp}%` }}
                      />
                    )}
                    {(activeFilter === 'all' || activeFilter === 'hr') && (
                      <span
                        className="patient-trend-bar is-solid"
                        style={{ height: `${item.hr}%` }}
                      />
                    )}
                  </div>
                  <strong>{item.month}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="patient-trends-side-column">
          <div className="patient-trend-recommendation-card">
            <div className="patient-trend-recommendation-head">
              <PatientIcon name="auto_awesome" aria-hidden="true" />
              <h3>{healthRecommendations.title}</h3>
            </div>

            <p>{healthRecommendations.body}</p>

            <button type="button">{healthRecommendations.action}</button>
          </div>

          <div className="patient-panel patient-trend-tests-card">
            <h3>Xét nghiệm sắp tới</h3>

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
          </div>
        </aside>
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
              </tr>
            </thead>
            <tbody>
              {historicalBiometrics.map((entry) => (
                <tr key={entry.id}>
                  <td className="patient-trend-date">{entry.date}</td>
                  <td>{entry.category}</td>
                  <td className="patient-trend-value-cell">{entry.value}</td>
                  <td>
                    <span className={`patient-pill ${entry.tone}`}>{entry.status}</span>
                  </td>
                  <td>{entry.clinician}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
