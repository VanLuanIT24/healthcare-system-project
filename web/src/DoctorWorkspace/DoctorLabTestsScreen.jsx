import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  FlaskConical,
  Hourglass,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  TestTube2,
  X,
} from 'lucide-react'
import { doctorApi } from './doctorApi'
import { safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const PAGE_SIZE = 5

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

function itemResultText(item = {}) {
  const value = item.result_value ?? item.numeric_value ?? item.value ?? ''
  if (value === '' || value === null || value === undefined) return '--'
  return String(value)
}

function itemTone(item = {}) {
  const flag = String(item.abnormal_flag || '').toLowerCase()
  if (item.is_critical || ['critical', 'panic', 'high', 'low', 'abnormal'].includes(flag)) return 'red'
  if (['normal', 'none'].includes(flag)) return 'green'
  if (itemResultText(item) === '--') return 'orange'
  return 'green'
}

function itemStatusLabel(item = {}) {
  const tone = itemTone(item)
  if (tone === 'red') return 'Bất thường'
  if (tone === 'orange') return 'Chờ kết quả'
  return 'Bình thường'
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
  const date = new Date(eventTime(row.source || row.result || row.order || row))
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
  const dateRangeLabel = useMemo(() => {
    const end = new Date(`${today}T00:00:00`)
    const start = new Date(end)
    start.setDate(start.getDate() - 30)
    return { start: formatDate(start), end: formatDate(end) }
  }, [today])
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
  const [detail, setDetail] = useState({ loading: false, error: '', row: null, order: null, result: null, clinical: null })

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

  const rows = useMemo(() => {
    const merged = mergeLabRows(state.orders, state.results)
    return merged
  }, [state.orders, state.results])

  const filtered = useMemo(
    () => rows.filter((row) => {
      const source = row.source || {}
      const status = statusInfo(row)
      return matchRow(row, searchTerm.trim())
        && (statusFilter === 'all' || status.group === statusFilter)
        && withinTime(row, timeFilter)
        && (typeFilter === 'all' || [source.test_type, source.category, testName(source)].filter(Boolean).join(' ').toLowerCase().includes(typeFilter))
        && (labFilter === 'all' || labRoom(source).toLowerCase().includes(labFilter))
        && (doctorFilter === 'all' || String(source.ordering_doctor_name || source.doctor_name || '').toLowerCase().includes(doctorFilter))
    }),
    [doctorFilter, labFilter, rows, searchTerm, statusFilter, timeFilter, typeFilter],
  )

  const typeOptions = useMemo(() => Array.from(new Set(rows
    .map((row) => row.source || {})
    .map((source) => source.test_type || source.category || testName(source))
    .filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'vi')), [rows])
  const labOptions = useMemo(() => Array.from(new Set(rows.map((row) => labRoom(row.source || {})).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'vi')), [rows])
  const doctorOptions = useMemo(() => Array.from(new Set(rows
    .map((row) => row.source || {})
    .map((source) => source.ordering_doctor_name || source.doctor_name)
    .filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'vi')), [rows])

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

  const selectedRow = rows.find((row) => row.key === selectedKey) || null
  const detailRow = detail.row || selectedRow
  const detailOrder = detail.order?.order || detail.order || detailRow?.order || null
  const detailResult = detail.result?.result || detail.result || detailRow?.result || null
  const detailSource = detailResult || detailOrder || detailRow?.source || {}
  const detailItems = safeArray(detail.result?.items)
  const detailCounts = detailItems.reduce((acc, item) => {
    const tone = itemTone(item)
    acc.total += 1
    if (tone === 'red') acc.abnormal += 1
    else if (tone === 'orange') acc.pending += 1
    else acc.normal += 1
    return acc
  }, { total: 0, normal: 0, abnormal: 0, pending: 0 })

  function reload() {
    setReloadKey((current) => current + 1)
  }

  async function openRow(row, options = {}) {
    if (!row) return
    setSelectedKey(row.key)
    const resultId = resultIdOf(row.result || {})
    const orderId = idOf(row.order || {})
    const encounterId = row.source?.encounter_id || row.order?.encounter_id || row.result?.encounter_id
    setDetail((current) => ({ ...current, loading: true, error: '', row }))
    try {
      const [resultDetail, orderDetail, clinicalSummary] = await Promise.all([
        resultId ? doctorApi.lab.getResult(resultId) : Promise.resolve(null),
        orderId ? doctorApi.lab.getOrder(orderId) : Promise.resolve(null),
        encounterId ? doctorApi.encounters.getClinicalSummary(encounterId).catch(() => null) : Promise.resolve(null),
      ])
      setDetail({ loading: false, error: '', row, order: orderDetail, result: resultDetail, clinical: clinicalSummary })
      if (options.silent) return
      toast.info('Đã tải chi tiết xét nghiệm từ API.')
    } catch (error) {
      setDetail((current) => ({ ...current, loading: false, error: getApiErrorMessage(error, 'Không thể tải chi tiết xét nghiệm.') }))
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

  useEffect(() => {
    if (!state.loading && rows.length && !selectedKey) {
      openRow(rows[0], { silent: true })
    }
  }, [rows, selectedKey, state.loading])

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
      {state.error ? <div className="doctor-lab-error">{state.error}</div> : null}

      <section className="doctor-lab-kpis">
        <KpiCard icon={TestTube2} tone="blue" label="Tổng chỉ định" value={stats.total.toLocaleString('vi-VN')} hint="Theo dữ liệu API" />
        <KpiCard icon={FlaskConical} tone="orange" label="Chờ lấy mẫu" value={stats.waiting} hint="Theo dữ liệu API" />
        <KpiCard icon={CheckCircle2} tone="green" label="Đã có kết quả" value={stats.resulted} hint="Theo dữ liệu API" />
        <KpiCard icon={Hourglass} tone="purple" label="Đang xử lý" value={stats.processing} hint="Hiện tại" />
        <KpiCard icon={AlertTriangle} tone="red" label="Kết quả bất thường" value={stats.abnormal} hint="Theo dữ liệu API" />
      </section>

      <section className="doctor-lab-layout">
        <main className="doctor-lab-main">
          <article className="doctor-lab-panel doctor-lab-table-card">
            <div className="doctor-lab-filters">
              <label className="doctor-lab-search"><Search size={16} /><input value={searchTerm} placeholder="Tìm kiếm..." onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }} /></label>
              <label><span>Trạng thái:</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option value="all">Tất cả</option><option value="waiting">Chờ lấy mẫu</option><option value="processing">Đang xử lý</option><option value="resulted">Có kết quả</option><option value="abnormal">Bất thường</option><option value="acknowledged">Đã xác nhận</option></select></label>
              <label><span>{dateRangeLabel.start}</span><b>?</b><span>{dateRangeLabel.end}</span><CalendarDays size={15} /></label>
              <label><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }}><option value="all">Loại xét nghiệm</option>{typeOptions.map((item) => <option value={item.toLowerCase()} key={item}>{item}</option>)}</select></label>
              <button type="button" onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setLabFilter('all'); setDoctorFilter('all'); setSearchTerm(''); setPage(1) }}><Filter size={15} /> Bộ lọc</button>
              <label className="doctor-lab-room-filter"><span>Phòng lab:</span><select value={labFilter} onChange={(event) => { setLabFilter(event.target.value); setPage(1) }}><option value="all">Tất cả</option>{labOptions.map((item) => <option value={item.toLowerCase()} key={item}>{item}</option>)}</select></label>
              <label className="doctor-lab-doctor-filter"><span>Bác sĩ chỉ định:</span><select value={doctorFilter} onChange={(event) => { setDoctorFilter(event.target.value); setPage(1) }}><option value="all">Tất cả</option>{doctorOptions.map((item) => <option value={item.toLowerCase()} key={item}>{item}</option>)}</select></label>
              <button type="button" onClick={reload}><RefreshCw size={15} /> Làm mới</button>
              <button type="button" onClick={() => toast.info('Tạo chỉ định mới sẽ được mở từ phiên khám đang chọn.')}><Plus size={15} /> Chỉ định mới</button>
            </div>

            <div className="doctor-lab-tabs" aria-label="Lọc trạng thái xét nghiệm">
              <button className={statusFilter === 'all' ? 'is-active' : ''} type="button" onClick={() => { setStatusFilter('all'); setPage(1) }}>Tất cả ({stats.total})</button>
              <button className={statusFilter === 'waiting' ? 'is-active' : ''} type="button" onClick={() => { setStatusFilter('waiting'); setPage(1) }}>Chờ lấy mẫu ({stats.waiting})</button>
              <button className={statusFilter === 'processing' ? 'is-active' : ''} type="button" onClick={() => { setStatusFilter('processing'); setPage(1) }}>Đang xử lý ({stats.processing})</button>
              <button className={statusFilter === 'resulted' ? 'is-active' : ''} type="button" onClick={() => { setStatusFilter('resulted'); setPage(1) }}>Đã có kết quả ({stats.resulted})</button>
              <button className={statusFilter === 'abnormal' ? 'is-active' : ''} type="button" onClick={() => { setStatusFilter('abnormal'); setPage(1) }}>Kết quả bất thường ({stats.abnormal})</button>
            </div>

            <div className="doctor-lab-table-scroll">
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
                        <button type="button" onClick={() => openRow(row)} aria-label="Xem kết quả"><Eye size={15} /></button>
                        <button type="button" onClick={() => openRow(row)} aria-label="Tùy chọn"><MoreVertical size={17} /></button>
                      </span>
                    </div>
                  )
                }) : (
                  <div className="doctor-lab-empty">Chưa có dữ liệu xét nghiệm phù hợp.</div>
                )}
              </div>
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
              <span className="doctor-fixed-page-size">Hiển thị <strong>{PAGE_SIZE}</strong> dòng</span>
            </footer>
          </article>

        </main>

        <aside className="doctor-lab-side">
          <article className="doctor-lab-result-detail">
            <header>
              <h2>{detailRow ? orderCode(detailOrder || detailSource, 0) : 'Chi tiết xét nghiệm'}</h2>
              <button type="button" aria-label="Đóng chi tiết" onClick={() => { setSelectedKey('__closed__'); setDetail({ loading: false, error: '', row: null, order: null, result: null, clinical: null }) }}><X size={16} /></button>
            </header>
            <nav aria-label="Chi tiết kết quả">
              <button type="button">Thông tin</button>
              <button className="is-active" type="button">Kết quả</button>
              <button type="button">Lâm sàng</button>
              <button type="button">Tệp đính kèm</button>
            </nav>
            {detail.loading ? (
              <p className="doctor-lab-detail-empty">Đang tải chi tiết từ API...</p>
            ) : detail.error ? (
              <p className="doctor-lab-detail-empty">{detail.error}</p>
            ) : detailRow ? (
              <>
                <section className="doctor-lab-detail-summary">
                  <h3>Tóm tắt kết quả</h3>
                  <div>
                    <span><small>Tổng chỉ số</small><strong>{detailCounts.total}</strong></span>
                    <span className="is-green"><small>Bình thường</small><strong>{detailCounts.normal}</strong></span>
                    <span className="is-red"><small>Bất thường</small><strong>{detailCounts.abnormal}</strong></span>
                    <span className="is-orange"><small>Chờ kết quả</small><strong>{detailCounts.pending}</strong></span>
                  </div>
                </section>
                <section className="doctor-lab-detail-results">
                  <h3>Kết quả xét nghiệm</h3>
                  <div className="doctor-lab-detail-head">
                    <span>Chỉ số</span>
                    <span>Kết quả</span>
                    <span>Khoảng tham chiếu</span>
                    <span>Đơn vị</span>
                    <span>Trạng thái</span>
                  </div>
                  {detailItems.length ? detailItems.map((item) => {
                    const tone = itemTone(item)
                    return (
                      <div className="doctor-lab-detail-row" key={item.result_item_id || item.item_code || item.item_name}>
                        <span>{item.item_name || item.item_code || '--'}</span>
                        <strong className={`is-${tone}`}>{itemResultText(item)}</strong>
                        <span>{item.reference_range || '--'}</span>
                        <span>{item.unit || '--'}</span>
                        <em className={`is-${tone}`}>{itemStatusLabel(item)}</em>
                      </div>
                    )
                  }) : (
                    <p className="doctor-lab-detail-empty">Chưa có chỉ số kết quả từ API.</p>
                  )}
                </section>
                <section className="doctor-lab-detail-info">
                  <h3>Thông tin chỉ định</h3>
                  <dl>
                    <div><dt>Bệnh nhân</dt><dd>{patientName(detailSource)}</dd></div>
                    <div><dt>Mã BN</dt><dd>{detailSource.patient_code || '--'}</dd></div>
                    <div><dt>Encounter</dt><dd>{encounterCode(detailSource)}</dd></div>
                    <div><dt>Bác sĩ chỉ định</dt><dd>{detailSource.ordering_doctor_name || detailOrder?.ordering_doctor_name || '--'}</dd></div>
                    <div><dt>Phòng lab</dt><dd>{labRoom(detailSource)}</dd></div>
                    <div><dt>Thời gian chỉ định</dt><dd>{formatDate(eventTime(detailOrder || detailSource))} {formatTime(eventTime(detailOrder || detailSource))}</dd></div>
                    <div><dt>Chẩn đoán chính</dt><dd>{detail.clinical?.primary_diagnosis?.diagnosis_name || '--'}</dd></div>
                    <div><dt>Sinh hiệu mới nhất</dt><dd>{detail.clinical?.latest_vital_signs ? `${detail.clinical.latest_vital_signs.systolic_bp || '--'}/${detail.clinical.latest_vital_signs.diastolic_bp || '--'} mmHg` : '--'}</dd></div>
                  </dl>
                </section>
                <footer>
                  <button type="button" onClick={exportCsv}><Download size={14} /> Xuất CSV</button>
                  <button type="button" onClick={() => openRow(detailRow)}><RefreshCw size={14} /> Tải lại</button>
                  <button type="button" onClick={() => acknowledgeCritical(detailRow)} disabled={!isCritical(detailResult || {}) || Boolean(detailResult?.acknowledged_at)}><Eye size={14} /> Xác nhận</button>
                </footer>
              </>
            ) : (
              <p className="doctor-lab-detail-empty">Chọn một chỉ định xét nghiệm để xem dữ liệu thật.</p>
            )}
          </article>
        </aside>
      </section>
    </div>
  )
}
