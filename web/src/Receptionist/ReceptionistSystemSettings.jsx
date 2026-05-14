import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import { fetchWithAuth } from '../lib/authSession'
import { readStoredAuth } from '../lib/storage'
import ReceptionistShell from './ReceptionistShell'
import './receptionist.css'

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || 'Không thể kiểm tra nguồn dữ liệu.')
  return payload?.data || payload
}

function itemsFrom(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

function formatTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getRoleName(auth) {
  return auth?.user?.role?.name || auth?.user?.role || auth?.user?.role_name || auth?.role || 'Receptionist'
}

const receptionistModules = [
  { name: 'Tổng quan', path: '/receptionist', source: 'Appointments, Queue, Patients' },
  { name: 'Lịch hẹn', path: '/receptionist/appointments', source: 'Appointments API' },
  { name: 'Đặt lịch mới', path: '/receptionist/create', source: 'Appointments API' },
  { name: 'Lịch chờ', path: '/receptionist/waiting-list', source: 'Appointments API' },
  { name: 'Danh sách chờ', path: '/receptionist/queue', source: 'Queue API' },
  { name: 'Tìm bệnh nhân', path: '/receptionist/patients', source: 'Patients API' },
  { name: 'Hồ sơ bệnh nhân', path: '/receptionist/patient-records', source: 'Patients API' },
  { name: 'Thu ngân', path: '/receptionist/cashier', source: 'Invoices API' },
  { name: 'Lịch sử thanh toán', path: '/receptionist/payment-history', source: 'Invoices API' },
  { name: 'Báo cáo ngày', path: '/receptionist/daily-report', source: 'Appointments, Invoices' },
  { name: 'Hiệu suất làm việc', path: '/receptionist/productivity', source: 'Appointments, Doctors' },
  { name: 'Cài đặt hệ thống', path: '/receptionist/settings', source: 'Session, API status' },
]

export default function ReceptionistSystemSettingsPage() {
  const auth = readStoredAuth()
  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const accessToken = auth?.accessToken || auth?.token || auth?.access_token
  const user = auth?.user || {}
  const permissions = user?.permissions || auth?.permissions || []
  const displayUser = user?.fullName || user?.full_name || user?.username || auth?.username || 'Receptionist'

  const loadChecks = useCallback(async () => {
    setLoading(true)
    setError('')
    const targets = [
      { key: 'appointments', name: 'Lịch hẹn', url: `${API_BASE_URL}/appointments?limit=1` },
      { key: 'patients', name: 'Bệnh nhân', url: `${API_BASE_URL}/patients?limit=1` },
      { key: 'doctors', name: 'Bác sĩ', url: `${API_BASE_URL}/staff/doctors` },
      { key: 'queue', name: 'Danh sách chờ', url: `${API_BASE_URL}/queue?limit=1` },
      { key: 'invoices', name: 'Hóa đơn', url: `${API_BASE_URL}/invoices?page=1&limit=1` },
      { key: 'invoiceSummary', name: 'Tổng hợp thu ngân', url: `${API_BASE_URL}/invoices/summary` },
    ]

    const startedAt = Date.now()
    const results = await Promise.all(targets.map(async (target) => {
      const start = Date.now()
      try {
        const payload = await fetchWithAuth(target.url).then(readJson)
        const items = itemsFrom(payload)
        return {
          ...target,
          ok: true,
          count: Array.isArray(items) ? items.length : 0,
          latency: Date.now() - start,
          checkedAt: new Date().toISOString(),
        }
      } catch (err) {
        return {
          ...target,
          ok: false,
          count: 0,
          latency: Date.now() - start,
          checkedAt: new Date().toISOString(),
          message: err.message,
        }
      }
    }))

    setChecks(results)
    const failed = results.filter((item) => !item.ok)
    setError(failed.length ? `${failed.length} nguồn dữ liệu chưa phản hồi.` : '')
    setLoading(false)
    return Date.now() - startedAt
  }, [])

  useEffect(() => { loadChecks() }, [loadChecks])

  const stats = useMemo(() => {
    const connected = checks.filter((item) => item.ok).length
    const failed = checks.filter((item) => !item.ok).length
    const avgLatency = checks.length ? Math.round(checks.reduce((sum, item) => sum + item.latency, 0) / checks.length) : 0
    return { connected, failed, avgLatency, total: checks.length }
  }, [checks])

  const permissionRows = useMemo(() => {
    if (!Array.isArray(permissions) || permissions.length === 0) return []
    return permissions.map((item) => typeof item === 'string' ? item : item?.name || item?.code).filter(Boolean)
  }, [permissions])

  const sessionRows = [
    ['Người dùng', displayUser],
    ['Vai trò', getRoleName(auth)],
    ['Mã nhân sự', user?.staff_id || user?.staffId || user?.id || user?._id || '—'],
    ['Email', user?.email || '—'],
    ['Trạng thái đăng nhập', accessToken ? 'Đã xác thực' : 'Chưa có token'],
    ['API base URL', API_BASE_URL],
  ]

  const visibleWarnings = [
    !accessToken ? 'Phiên đăng nhập không có access token.' : '',
    stats.failed ? `${stats.failed} API đang lỗi hoặc chưa khả dụng.` : '',
    !permissionRows.length ? 'Session hiện tại không trả danh sách quyền chi tiết.' : '',
  ].filter(Boolean)

  return (
    <ReceptionistShell
      title="Trạng thái hệ thống"
      subtitle="Kiểm tra phiên đăng nhập, quyền truy cập và các nguồn dữ liệu thực đang dùng"
      activeSection="settings"
    >
      <div className="settings-layout">
        <div className="settings-main">
          <div className="rd-stats settings-stats">
            <article className="rd-stat green">
              <div className="rd-stat-head"><span>Nguồn dữ liệu kết nối</span><div className="rd-stat-icon green"><Icon name="check" /></div></div>
              <div className="rd-stat-body"><strong>{loading ? '...' : `${stats.connected}/${stats.total || 6}`}</strong><span>API thật đang phản hồi</span></div>
            </article>
            <article className="rd-stat blue">
              <div className="rd-stat-head"><span>Phiên đăng nhập</span><div className="rd-stat-icon blue"><Icon name="users" /></div></div>
              <div className="rd-stat-body"><strong>{accessToken ? 'Hợp lệ' : 'Thiếu'}</strong><span>{getRoleName(auth)}</span></div>
            </article>
            <article className="rd-stat purple">
              <div className="rd-stat-head"><span>Module lễ tân</span><div className="rd-stat-icon purple"><Icon name="settings" /></div></div>
              <div className="rd-stat-body"><strong>{receptionistModules.length}</strong><span>Route đang cấu hình</span></div>
            </article>
            <article className="rd-stat violet">
              <div className="rd-stat-head"><span>Độ trễ API TB</span><div className="rd-stat-icon violet"><Icon name="clock" /></div></div>
              <div className="rd-stat-body"><strong>{stats.avgLatency}ms</strong><span>Ước tính từ lần kiểm tra</span></div>
            </article>
            <article className="rd-stat red">
              <div className="rd-stat-head"><span>Cảnh báo thực tế</span><div className="rd-stat-icon red"><Icon name="file" /></div></div>
              <div className="rd-stat-body"><strong>{visibleWarnings.length}</strong><span>{visibleWarnings.length ? 'Cần kiểm tra' : 'Không có cảnh báo'}</span></div>
            </article>
          </div>

          <section className="settings-toolbar settings-toolbar-simple">
            <button type="button" className="active"><Icon name="settings" /> Tổng quan thực tế</button>
            <button type="button" onClick={loadChecks}><Icon name="file" /> Kiểm tra lại API</button>
          </section>

          {error && <div className="payment-history-error">{error}</div>}

          <div className="settings-grid">
            <section className="settings-card">
              <header><h2>Phiên đăng nhập</h2></header>
              {sessionRows.map(([label, value]) => (
                <div className="settings-row" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </section>

            <section className="settings-card">
              <header><h2>Quyền truy cập</h2></header>
              {permissionRows.length ? permissionRows.slice(0, 8).map((item) => (
                <div className="settings-row" key={item}>
                  <span>{item}</span>
                  <strong>Cho phép</strong>
                </div>
              )) : (
                <p className="settings-empty">Backend chưa trả danh sách quyền chi tiết trong session.</p>
              )}
            </section>

            <section className="settings-card">
              <header><h2>Cảnh báo</h2></header>
              {visibleWarnings.length ? visibleWarnings.map((item) => (
                <div className="settings-row" key={item}>
                  <span>{item}</span>
                  <strong>Cần xem</strong>
                </div>
              )) : (
                <p className="settings-empty">Các nguồn dữ liệu chính đang phản hồi bình thường.</p>
              )}
            </section>
          </div>

          <section className="settings-card">
            <header><h2>Trạng thái nguồn dữ liệu</h2></header>
            <table className="appointment-table settings-table">
              <thead>
                <tr>
                  <th>Nguồn</th>
                  <th>Endpoint</th>
                  <th>Trạng thái</th>
                  <th>Độ trễ</th>
                  <th>Kiểm tra lúc</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((item) => (
                  <tr key={item.key}>
                    <td>{item.name}</td>
                    <td>{item.url.replace(API_BASE_URL, '')}</td>
                    <td><span className={`appt-badge ${item.ok ? 'green' : 'red'}`}>{item.ok ? 'Kết nối' : 'Lỗi'}</span></td>
                    <td>{item.latency}ms</td>
                    <td>{formatTime(item.checkedAt)}</td>
                  </tr>
                ))}
                {!checks.length && (
                  <tr><td colSpan="5" className="appointment-empty">Đang kiểm tra nguồn dữ liệu...</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="settings-card">
            <header><h2>Module đang khả dụng</h2></header>
            <table className="appointment-table settings-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Đường dẫn</th>
                  <th>Nguồn dữ liệu</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {receptionistModules.map((item) => (
                  <tr key={item.path}>
                    <td>{item.name}</td>
                    <td>{item.path}</td>
                    <td>{item.source}</td>
                    <td><span className="appt-badge green">Đã cấu hình</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="rd-right settings-side">
          <section className="rd-card-list">
            <header><h2>Thông tin phiên</h2></header>
            <article className="settings-log-row">
              <Icon name="users" />
              <span>{displayUser}</span>
              <time>{getRoleName(auth)}</time>
            </article>
            <article className="settings-log-row">
              <Icon name="check" />
              <span>Token</span>
              <time>{accessToken ? 'Có' : 'Không'}</time>
            </article>
            <article className="settings-log-row">
              <Icon name="settings" />
              <span>API</span>
              <time>{API_BASE_URL.replace(/^https?:\/\//, '')}</time>
            </article>
          </section>

          <section className="rd-card-list">
            <header><h2>API chưa phản hồi</h2></header>
            {checks.filter((item) => !item.ok).length ? checks.filter((item) => !item.ok).map((item) => (
              <article key={item.key} className="settings-warning-row">
                <Icon name="clock" />
                <span>{item.name}</span>
                <b>Lỗi</b>
              </article>
            )) : <p className="rd-muted">Không có API lỗi trong lần kiểm tra này.</p>}
          </section>

          <section className="rd-card-list settings-backup-card">
            <header><h2>Ghi chú</h2><span>Thực tế</span></header>
            <p>Trang này đã bỏ cấu hình chưa có API backend như SMS, BHYT, backup, bảo mật 2 bước và quy tắc lịch hẹn.</p>
            <small>Khi backend có endpoint settings thật, có thể thêm form chỉnh sửa/lưu cấu hình tại đây.</small>
          </section>
        </aside>
      </div>
    </ReceptionistShell>
  )
}
