import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Beaker,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  FlaskConical,
  HelpCircle,
  Menu,
  MoreVertical,
  RefreshCw,
  Search,
  TestTube2,
  UserRound,
} from 'lucide-react'
import { doctorApi } from './doctorApi'
import { getInitials, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { useToast } from './toast/ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const PAGE_SIZE = 8

function todayLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`)
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'short' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date.toLocaleDateString('vi-VN')}`
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('vi-VN')
}

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function percent(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function idOf(value = {}) {
  return value.lab_order_id || value.order_id || value.result_id || value.id || value._id || ''
}

function resultIdOf(result = {}) {
  return result.result_id || result.lab_result_id || result.id || result._id || ''
}

function orderCode(order = {}, index = 0) {
  return order.lab_order_code || order.order_code || order.code || idOf(order) || `LAB-${String(index + 1).padStart(4, '0')}`
}

function resultCode(result = {}, index = 0) {
  return result.result_code || result.code || resultIdOf(result) || `LABR-${String(index + 1).padStart(4, '0')}`
}

function patientName(row = {}) {
  return row.patient_name || row.patient?.full_name || row.patient?.name || 'Bệnh nhân'
}

function patientLine(row = {}) {
  return [row.patient_birth_year, row.patient_gender].filter(Boolean).join(' • ') || row.patient_code || '--'
}

function encounterCode(row = {}) {
  return row.encounter_code || row.encounter?.encounter_code || row.encounter_id || '--'
}

function testName(row = {}) {
  return row.test_name || row.service_name || row.analyte_name || row.name || 'Xét nghiệm'
}

function labRoom(row = {}) {
  return row.lab_room || row.lab_room_name || row.department_name || row.room_name || 'Lab'
}

function eventTime(row = {}) {
  return row.resulted_at || row.completed_at || row.ordered_at || row.created_at || row.updated_at || ''
}

function resultText(result = {}) {
  const value = result.result_value ?? result.value ?? result.display_value ?? ''
  const unit = result.unit || result.result_unit || ''
  if (value === '' || value === null || value === undefined) return '--'
  return [value, unit].filter(Boolean).join(' ')
}

function isCritical(result = {}) {
  return Boolean(result.is_critical || result.critical || String(result.flag || '').toLowerCase() === 'critical')
}

function isAbnormal(result = {}) {
  return Boolean(result.is_abnormal || result.abnormal || isCritical(result) || String(result.flag || '').toLowerCase() === 'abnormal')
}

function statusInfo(row = {}) {
  const result = row.result || {}
  const order = row.order || row
  const raw = String(result.status || order.status || '').toLowerCase()
  if (isCritical(result) || (isAbnormal(result) && !result.acknowledged_at)) return { label: 'Bất thường', tone: 'red', group: 'abnormal' }
  if (result.acknowledged_at || ['acknowledged', 'confirmed', 'reviewed'].includes(raw)) return { label: 'Đã xác nhận', tone: 'purple', group: 'acknowledged' }
  if (resultIdOf(result) || ['completed', 'resulted', 'result_ready', 'done'].includes(raw)) return { label: 'Có kết quả', tone: 'green', group: 'resulted' }
  if (['processing', 'in_progress', 'received', 'collected'].includes(raw)) return { label: 'Đang xử lý', tone: 'blue', group: 'processing' }
  return { label: 'Chờ lấy mẫu', tone: 'orange', group: 'waiting' }
}

function matchRow(row, keyword) {
  if (!keyword) return true
  const source = row.result || row.order || row
  const text = [
    orderCode(row.order || row),
    resultCode(row.result || {}),
    patientName(source),
    source.patient_code,
    encounterCode(source),
    testName(source),
    labRoom(source),
  ].filter(Boolean).join(' ').toLowerCase()
  return text.includes(keyword.toLowerCase())
}

function withinTime(row, value) {
  if (value === 'all') return true
  const date = new Date(eventTime(row.result || row.order || row))
  if (Number.isNaN(date.getTime())) return false
  const diffDays = (Date.now() - date.getTime()) / 86400000
  if (value === 'today') return date.toDateString() === new Date().toDateString()
  if (value === '7d') return diffDays <= 7
  return diffDays <= 30
}

function KpiCard({ icon: Icon, tone, label, value, hint, trend }) {
  return (
    <article className="doctor-lab-kpi">
      <span className={`doctor-lab-kpi__icon is-${tone}`}><Icon size={30} /></span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
      {trend ? <em>{trend}</em> : null}
    </article>
  )
}

function StatusBadge({ status }) {
  return <span className={`doctor-lab-status is-${status.tone}`}>{status.label}</span>
}

function LabDonut({ stats }) {
  const total = stats.total || 1
  const resultedEnd = percent(stats.resulted, total)
  const waitingEnd = resultedEnd + percent(stats.waiting, total)
  const processingEnd = waitingEnd + percent(stats.processing, total)
  const abnormalEnd = processingEnd + percent(stats.abnormal, total)

  return (
    <div
      className="doctor-lab-donut"
      style={{
        '--resulted-end': `${resultedEnd}%`,
        '--waiting-end': `${waitingEnd}%`,
        '--processing-end': `${processingEnd}%`,
        '--abnormal-end': `${abnormalEnd}%`,
      }}
    >
      <div>
        <strong>{stats.total.toLocaleString('vi-VN')}</strong>
        <span>Tổng</span>
      </div>
    </div>
  )
}

function mergeLabRows(orders = [], results = []) {
  const resultByOrder = new Map()
  results.forEach((result) => {
    const key = result.lab_order_id || result.order_id
    if (key && !resultByOrder.has(key)) resultByOrder.set(key, result)
  })

  const rows = orders.map((order, index) => {
    const result = resultByOrder.get(order.lab_order_id || order.order_id || order.id) || null
    return {
      key: order.lab_order_id || order.order_id || order.id || `order-${index}`,
      order,
      result,
      source: result || order,
    }
  })

  results.forEach((result, index) => {
    const orderKey = result.lab_order_id || result.order_id
    if (orderKey && orders.some((order) => [order.lab_order_id, order.order_id, order.id].includes(orderKey))) return
    rows.push({
      key: result.result_id || result.id || `result-${index}`,
      order: null,
      result,
      source: result,
    })
  })

  return rows.sort((left, right) => new Date(eventTime(right.source) || 0) - new Date(eventTime(left.source) || 0))
}

export function DoctorLabTestsScreen({ user }) {
  const toast = useToast()
  const [today] = useState(getTodayDate)
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('30d')
  const [typeFilter, setTypeFilter] = useState('all')
  const [labFilter, setLabFilter] = useState('all')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [selectedKey, setSelectedKey] = useState('')
  const [busy, setBusy] = useState('')
  const [state, setState] = useState({ loading: true, error: '', orders: [], results: [], orderPagination: null, resultPagination: null })

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))
    Promise.all([
      doctorApi.lab.listOrders({ sort_by: 'created_at', sort_order: 'desc' }),
      doctorApi.lab.listResults({ sort_by: 'resulted_at', sort_order: 'desc' }),
    ])
      .then(([ordersPayload, resultsPayload]) => {
        if (!active) return
        setState({
          loading: false,
          error: '',
          orders: safeArray(ordersPayload?.items),
          results: safeArray(resultsPayload?.items),
          orderPagination: ordersPayload?.pagination || null,
          resultPagination: resultsPayload?.pagination || null,
        })
      })
      .catch((error) => {
        if (!active) return
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Không thể tải dữ liệu xét nghiệm.'),
          orders: [],
          results: [],
          orderPagination: null,
          resultPagination: null,
        })
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  const rows = useMemo(() => mergeLabRows(state.orders, state.results), [state.orders, state.results])

  const filtered = useMemo(
    () => rows.filter((row) => {
      const source = row.source || {}
      const status = statusInfo(row)
      return matchRow(row, searchTerm.trim())
        && (statusFilter === 'all' || status.group === statusFilter)
        && withinTime(row, timeFilter)
        && (typeFilter === 'all' || String(source.test_type || source.category || '').toLowerCase().includes(typeFilter))
        && (labFilter === 'all' || labRoom(source).toLowerCase().includes(labFilter))
        && (doctorFilter === 'all' || String(source.ordering_doctor_name || source.doctor_name || '').toLowerCase().includes(doctorFilter))
    }),
    [doctorFilter, labFilter, rows, searchTerm, statusFilter, timeFilter, typeFilter],
  )

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const displayRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const stats = useMemo(() => {
    const base = { total: rows.length, waiting: 0, processing: 0, resulted: 0, abnormal: 0, acknowledged: 0 }
    rows.forEach((row) => {
      const group = statusInfo(row).group
      if (group === 'waiting') base.waiting += 1
      if (group === 'processing') base.processing += 1
      if (group === 'resulted') base.resulted += 1
      if (group === 'abnormal') base.abnormal += 1
      if (group === 'acknowledged') {
        base.acknowledged += 1
        base.resulted += 1
      }
    })
    return base
  }, [rows])

  const criticalRows = rows
    .filter((row) => isCritical(row.result || {}) || (isAbnormal(row.result || {}) && !row.result?.acknowledged_at))
    .slice(0, 3)
  const confirmRows = rows
    .filter((row) => resultIdOf(row.result || {}) && !row.result?.acknowledged_at)
    .slice(0, 3)
  const activities = rows.slice(0, 3)

  function reload() {
    setReloadKey((current) => current + 1)
  }

  async function openRow(row) {
    setSelectedKey(row.key)
    const resultId = resultIdOf(row.result || {})
    const orderId = idOf(row.order || {})
    try {
      await Promise.all([
        resultId ? doctorApi.lab.getResult(resultId) : Promise.resolve(null),
        orderId ? doctorApi.lab.getOrder(orderId) : Promise.resolve(null),
      ])
      toast.info('Đã tải chi tiết xét nghiệm từ API.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải chi tiết xét nghiệm.'))
    }
  }

  async function acknowledgeCritical(row) {
    const resultId = resultIdOf(row?.result || {})
    if (!resultId) {
      toast.info('Chọn một kết quả critical để xác nhận.')
      return
    }
    setBusy(resultId)
    try {
      await doctorApi.lab.acknowledgeCritical(resultId, { acknowledged_by: user?.user_id || user?.id })
      toast.success('Đã xác nhận bác sĩ đã xem kết quả critical.')
      reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể xác nhận kết quả critical.'))
    } finally {
      setBusy('')
    }
  }

  function exportCsv() {
    const csvRows = [
      ['Ma chi dinh', 'Benh nhan', 'Encounter', 'Loai xet nghiem', 'Trang thai', 'Ket qua', 'Thoi gian', 'Phong lab'],
      ...filtered.map((row, index) => {
        const source = row.source || {}
        return [
          orderCode(row.order || source, index),
          patientName(source),
          encounterCode(source),
          testName(source),
          statusInfo(row).label,
          resultText(row.result || {}),
          `${formatDate(eventTime(source))} ${formatTime(eventTime(source))}`,
          labRoom(source),
        ]
      }),
    ]
    const csv = csvRows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `lab-tests-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="doctor-lab-page">
      <header className="doctor-lab-header">
        <div className="doctor-lab-title">
          <button type="button" aria-label="Mở menu"><Menu size={20} /></button>
          <div>
            <h1>Xét nghiệm</h1>
            <p>Quản lý chỉ định xét nghiệm và kết quả xét nghiệm của bệnh nhân.</p>
          </div>
        </div>
        <div className="doctor-lab-topbar">
          <label><Search size={17} /><input placeholder="Tìm bệnh nhân, mã chỉ định, encounter..." value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }} /><kbd>⌘ K</kbd></label>
          <button type="button" aria-label="Thông báo"><Bell size={18} /><i>12</i></button>
          <button type="button" aria-label="Trợ giúp"><HelpCircle size={18} /></button>
          <div className="doctor-lab-profile">
            <span>{getInitials(user?.fullName || user?.full_name || user?.name) || 'BS'}</span>
            <i />
            <ChevronDown size={14} />
          </div>
        </div>
      </header>

      {state.error ? <div className="doctor-lab-error">{state.error}</div> : null}

      <section className="doctor-lab-kpis">
        <KpiCard icon={TestTube2} tone="blue" label="Tổng chỉ định xét nghiệm" value={stats.total.toLocaleString('vi-VN')} hint="Trong 30 ngày qua" trend="↑ 12,6%" />
        <KpiCard icon={FlaskConical} tone="orange" label="Chờ lấy mẫu" value={stats.waiting} hint="Hiện tại" trend="↑ 8,3%" />
        <KpiCard icon={CheckCircle2} tone="green" label="Đã có kết quả" value={stats.resulted} hint="Trong 30 ngày qua" trend="↑ 15,8%" />
        <KpiCard icon={AlertTriangle} tone="red" label="Kết quả bất thường" value={stats.abnormal} hint="Trong 30 ngày qua" trend="↑ 6,2%" />
      </section>

      <section className="doctor-lab-layout">
        <main className="doctor-lab-main">
          <article className="doctor-lab-panel doctor-lab-table-card">
            <div className="doctor-lab-filters">
              <label className="doctor-lab-search"><Search size={16} /><input value={searchTerm} placeholder="Tìm kiếm..." onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }} /></label>
              <label><span>Trạng thái:</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option value="all">Tất cả</option><option value="waiting">Chờ lấy mẫu</option><option value="processing">Đang xử lý</option><option value="resulted">Có kết quả</option><option value="abnormal">Bất thường</option><option value="acknowledged">Đã xác nhận</option></select></label>
              <label><span>01/05/2024</span><b>→</b><span>31/05/2024</span><CalendarDays size={15} /></label>
              <label><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }}><option value="all">Loại xét nghiệm</option><option value="blood">Máu</option><option value="urine">Nước tiểu</option><option value="bio">Sinh hóa</option></select></label>
              <label><span>Phòng lab:</span><select value={labFilter} onChange={(event) => { setLabFilter(event.target.value); setPage(1) }}><option value="all">Tất cả</option><option value="huyết">Lab Huyết học</option><option value="sinh">Lab Sinh hóa</option><option value="nước">Lab Nước tiểu</option></select></label>
              <label><span>Bác sĩ chỉ định:</span><select value={doctorFilter} onChange={(event) => { setDoctorFilter(event.target.value); setPage(1) }}><option value="all">Tất cả</option><option value="nguyễn">BS. Nguyễn</option><option value="trần">BS. Trần</option></select></label>
              <button type="button" onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setLabFilter('all'); setDoctorFilter('all'); setSearchTerm(''); setPage(1) }}><Filter size={15} /> Bộ lọc</button>
              <button type="button" onClick={reload}><RefreshCw size={15} /> Làm mới</button>
            </div>

            <div className="doctor-lab-table-head">
              <span />
              <span>Mã chỉ định</span>
              <span>Bệnh nhân</span>
              <span>Encounter</span>
              <span>Loại xét nghiệm</span>
              <span>Trạng thái</span>
              <span>Kết quả</span>
              <span>Thời gian</span>
              <span>Phòng lab</span>
              <span>Thao tác</span>
            </div>
            <div className="doctor-lab-table">
              {state.loading ? (
                <div className="doctor-lab-empty">Đang tải dữ liệu xét nghiệm...</div>
              ) : displayRows.length ? displayRows.map((row, index) => {
                const source = row.source || {}
                const result = row.result || {}
                const status = statusInfo(row)
                return (
                  <div className={`doctor-lab-row${selectedKey === row.key ? ' is-selected' : ''}`} key={row.key}>
                    <input type="checkbox" aria-label={`Chọn ${orderCode(row.order || source, index)}`} />
                    <strong>{orderCode(row.order || source, index)}</strong>
                    <span className="doctor-lab-person">
                      <b>{patientName(source)}</b>
                      <small>{patientLine(source)}</small>
                    </span>
                    <strong>{encounterCode(source)}</strong>
                    <span>{testName(source)}</span>
                    <StatusBadge status={status} />
                    <em className={isAbnormal(result) ? 'is-red' : resultIdOf(result) ? 'is-green' : ''}>
                      {resultText(result)}
                      {isAbnormal(result) ? <AlertTriangle size={12} /> : null}
                    </em>
                    <time>{formatDate(eventTime(source))}<small>{formatTime(eventTime(source))}</small></time>
                    <span>{labRoom(source)}</span>
                    <span className="doctor-lab-actions">
                      {isCritical(result) && !result.acknowledged_at ? (
                        <button type="button" disabled={busy === resultIdOf(result)} onClick={() => acknowledgeCritical(row)}>Xác nhận</button>
                      ) : null}
                      <button type="button" onClick={() => openRow(row)} aria-label="Xem chi tiết"><MoreVertical size={17} /></button>
                    </span>
                  </div>
                )
              }) : (
                <div className="doctor-lab-empty">Chưa có dữ liệu xét nghiệm phù hợp.</div>
              )}
            </div>
            <footer className="doctor-lab-footer">
              <span>Hiển thị {total ? `${(page - 1) * PAGE_SIZE + 1} - ${Math.min(page * PAGE_SIZE, total)}` : '0'} của {total.toLocaleString('vi-VN')} kết quả</span>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, index) => index + 1).map((pageNumber) => (
                  <button className={pageNumber === page ? 'is-active' : ''} type="button" key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                ))}
                {totalPages > 5 ? <span>...</span> : null}
                {totalPages > 5 ? <button type="button" onClick={() => setPage(totalPages)}>{totalPages}</button> : null}
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={15} /></button>
              </div>
              <button type="button">{PAGE_SIZE} / trang <ChevronDown size={14} /></button>
            </footer>
          </article>

          <section className="doctor-lab-bottom">
            <article className="doctor-lab-panel doctor-lab-priority">
              <header><h2>Ưu tiên xử lý</h2><b>{criticalRows.length}</b></header>
              {criticalRows.length ? criticalRows.map((row, index) => {
                const source = row.source || {}
                return (
                  <button type="button" key={row.key} onClick={() => acknowledgeCritical(row)}>
                    <b>{testName(source)}</b>
                    <span>{patientName(source)} • {patientLine(source)}</span>
                    <strong>{resultText(row.result || {})}</strong>
                    <time>{formatDate(eventTime(source))} {formatTime(eventTime(source))}</time>
                    <em>Xác nhận</em>
                  </button>
                )
              }) : <p>Không có kết quả critical cần xử lý.</p>}
            </article>

            <article className="doctor-lab-panel doctor-lab-confirm">
              <header><h2>Kết quả cần xác nhận</h2><b>{confirmRows.length}</b></header>
              {confirmRows.length ? confirmRows.map((row) => {
                const source = row.source || {}
                return (
                  <button type="button" key={row.key} onClick={() => openRow(row)}>
                    <b>{testName(source)}</b>
                    <span>{patientName(source)} • {patientLine(source)}</span>
                    <strong>{resultText(row.result || {})}</strong>
                    <time>{formatDate(eventTime(source))} {formatTime(eventTime(source))}</time>
                  </button>
                )
              }) : <p>Không có kết quả cần xác nhận.</p>}
              <button className="doctor-lab-link" type="button" onClick={() => setStatusFilter('resulted')}>Xem tất cả ({confirmRows.length})</button>
            </article>
          </section>
        </main>

        <aside className="doctor-lab-side">
          <article className="doctor-lab-panel doctor-lab-overview">
            <h2>Tổng quan xét nghiệm</h2>
            <div>
              <LabDonut stats={stats} />
              <dl>
                <div><dt><i className="is-green" /> Có kết quả</dt><dd>{stats.resulted} ({percent(stats.resulted, stats.total)}%)</dd></div>
                <div><dt><i className="is-orange" /> Chờ lấy mẫu</dt><dd>{stats.waiting} ({percent(stats.waiting, stats.total)}%)</dd></div>
                <div><dt><i className="is-blue" /> Đang xử lý</dt><dd>{stats.processing} ({percent(stats.processing, stats.total)}%)</dd></div>
                <div><dt><i className="is-red" /> Bất thường</dt><dd>{stats.abnormal} ({percent(stats.abnormal, stats.total)}%)</dd></div>
              </dl>
            </div>
            <section>
              <p><AlertTriangle size={15} /> Tỷ lệ kết quả bất thường <strong>{percent(stats.abnormal, stats.total)}%</strong></p>
              <p><FlaskConical size={15} /> Kết quả chờ xác nhận <strong>{confirmRows.length}</strong></p>
              <p><Beaker size={15} /> Encounter có chỉ định lab <strong>{new Set(rows.map((row) => row.source?.encounter_id).filter(Boolean)).size}</strong></p>
              <p><Activity size={15} /> Thời gian TAT trung bình <strong>78 phút</strong></p>
            </section>
          </article>

          <article className="doctor-lab-panel doctor-lab-quick">
            <h2>Thao tác nhanh</h2>
            <div>
              <button type="button" onClick={() => displayRows[0] && openRow(displayRows[0])}><Eye size={20} /><span>Xem kết quả</span></button>
              <button type="button" onClick={() => acknowledgeCritical(criticalRows[0])}><AlertTriangle size={20} /><span>Xác nhận critical</span></button>
              <button type="button" onClick={exportCsv}><Download size={20} /><span>Xuất danh sách</span></button>
              <button type="button" onClick={() => setStatusFilter('resulted')}><UserRound size={20} /><span>Xem theo encounter</span></button>
            </div>
          </article>

          <article className="doctor-lab-panel doctor-lab-activity">
            <header><h2>Hoạt động gần đây</h2><button type="button">Xem tất cả</button></header>
            {activities.length ? activities.map((row) => {
              const source = row.source || {}
              const status = statusInfo(row)
              const Icon = status.group === 'abnormal' ? AlertTriangle : status.group === 'resulted' || status.group === 'acknowledged' ? CheckCircle2 : FlaskConical
              return (
                <div key={row.key}>
                  <Icon size={16} />
                  <span>
                    <b>{status.group === 'abnormal' ? `Kết quả ${testName(source)} bất thường` : status.group === 'resulted' || status.group === 'acknowledged' ? `Có kết quả ${testName(source)}` : `Cập nhật ${testName(source)}`}</b>
                    <small>{patientName(source)} • {formatDate(eventTime(source))} {formatTime(eventTime(source))}</small>
                  </span>
                </div>
              )
            }) : <p>Chưa có hoạt động gần đây.</p>}
          </article>
        </aside>
      </section>
    </div>
  )
}
