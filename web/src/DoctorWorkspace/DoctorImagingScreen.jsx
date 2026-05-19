import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Filter,
  Image as ImageIcon,
  MoreVertical,
  RefreshCw,
  Search,
  Timer,
} from 'lucide-react'
import { doctorApi, getDoctorId } from './doctorApi'
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

function percent(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function idOf(order = {}) {
  return order.order_id || order.id || order._id || ''
}

function orderCode(order = {}, index = 0) {
  return order.order_code || order.code || idOf(order) || `IMG-${String(index + 1).padStart(4, '0')}`
}

function patientName(order = {}) {
  return order.patient_name || order.patient?.full_name || order.patient?.name || 'Bệnh nhân'
}

function patientLine(order = {}) {
  return [order.patient_gender, order.patient_age ? `${order.patient_age} tuổi` : order.patient_birth_year].filter(Boolean).join(', ') || order.patient_code || '--'
}

function encounterCode(order = {}) {
  return order.encounter_code || order.encounter?.encounter_code || order.encounter_id || '--'
}

function imageType(order = {}) {
  const value = String(order.modality || order.image_type || order.service_type || order.order_subtype || order.category || '').trim()
  if (value) return value
  const service = serviceName(order).toLowerCase()
  if (service.includes('ct')) return 'CT Scanner'
  if (service.includes('mri')) return 'MRI'
  if (service.includes('siêu âm') || service.includes('ultrasound')) return 'Siêu âm'
  return 'X-quang'
}

function serviceName(order = {}) {
  const items = safeArray(order.items)
  return order.service_name || order.service?.service_name || order.title || items[0]?.service_name || items[0]?.name || order.clinical_diagnosis || 'Chẩn đoán hình ảnh'
}

function roomName(order = {}) {
  return order.room_name || order.imaging_room || order.receiving_department_name || order.department_name || 'P. CĐHA'
}

function orderTime(order = {}) {
  return order.reported_at || order.completed_at || order.created_at || order.ordered_at || order.requested_at || order.updated_at || ''
}

function hasReport(order = {}) {
  return Boolean(order.report_id || order.report_url || order.reported_at || order.result_text || order.result || order.report_status === 'reported')
}

function isCritical(order = {}) {
  const priority = String(order.priority || order.urgency || '').toLowerCase()
  const flag = String(order.result_flag || order.flag || order.report_flag || '').toLowerCase()
  return Boolean(order.is_critical || order.critical || priority === 'critical' || flag === 'critical')
}

function isAcknowledged(order = {}) {
  const raw = String(order.status || order.report_status || '').toLowerCase()
  return Boolean(order.acknowledged_at || order.report_acknowledged_at || ['acknowledged', 'confirmed', 'reviewed'].includes(raw))
}

function statusInfo(order = {}) {
  const raw = String(order.status || order.report_status || '').toLowerCase()
  if (isCritical(order) && !isAcknowledged(order)) return { label: 'Critical', tone: 'red', group: 'critical' }
  if (isAcknowledged(order)) return { label: 'Đã xác nhận', tone: 'slate', group: 'acknowledged' }
  if (hasReport(order) || ['completed', 'done', 'resulted', 'reported', 'report_ready'].includes(raw)) return { label: 'Có báo cáo', tone: 'green', group: 'reported' }
  if (['processing', 'in_progress', 'started', 'accepted'].includes(raw)) return { label: 'Đang thực hiện', tone: 'blue', group: 'processing' }
  return { label: 'Chờ chụp', tone: 'orange', group: 'waiting' }
}

function isImagingOrder(order = {}) {
  const text = [
    order.order_type,
    order.type,
    order.category,
    order.service_type,
    order.modality,
    serviceName(order),
  ].filter(Boolean).join(' ').toLowerCase()
  return /imaging|diagnostic|radiology|image|x-quang|xray|x-ray|ct|mri|siêu âm|sieu am|ultrasound/.test(text)
}

function matchSearch(order, keyword) {
  if (!keyword) return true
  const text = [
    orderCode(order),
    patientName(order),
    order.patient_code,
    encounterCode(order),
    imageType(order),
    serviceName(order),
    roomName(order),
  ].filter(Boolean).join(' ').toLowerCase()
  return text.includes(keyword.toLowerCase())
}

function withinTime(order, value) {
  if (value === 'all') return true
  const date = new Date(orderTime(order))
  if (Number.isNaN(date.getTime())) return false
  const diffDays = (Date.now() - date.getTime()) / 86400000
  if (value === 'today') return date.toDateString() === new Date().toDateString()
  if (value === '7d') return diffDays <= 7
  return diffDays <= 30
}

function ImagingKpi({ icon: Icon, tone, label, value, hint, trend }) {
  return (
    <article className={`doctor-imaging-kpi is-${tone}`}>
      <span><Icon size={30} /></span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
      <em>{trend}</em>
    </article>
  )
}

function StatusBadge({ status }) {
  return <span className={`doctor-imaging-status is-${status.tone}`}>{status.label}</span>
}

function ImagingDonut({ stats }) {
  const total = stats.total || 1
  const waitingEnd = percent(stats.waiting, total)
  const processingEnd = waitingEnd + percent(stats.processing, total)
  const reportedEnd = processingEnd + percent(stats.reported, total)
  const criticalEnd = reportedEnd + percent(stats.critical, total)
  return (
    <div
      className="doctor-imaging-donut"
      style={{
        '--waiting-end': `${waitingEnd}%`,
        '--processing-end': `${processingEnd}%`,
        '--reported-end': `${reportedEnd}%`,
        '--critical-end': `${criticalEnd}%`,
      }}
    >
      <div>
        <strong>{stats.total}</strong>
        <span>Tổng chỉ định</span>
      </div>
    </div>
  )
}

export function DoctorImagingScreen({ user }) {
  const toast = useToast()
  const [today] = useState(getTodayDate)
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('30d')
  const [typeFilter, setTypeFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState('')
  const [state, setState] = useState({ loading: true, error: '', orders: [], pagination: null })

  const doctorId = getDoctorId(user)

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))
    if (!doctorId) {
      setState({ loading: false, error: 'Không tìm thấy mã bác sĩ hiện tại.', orders: [], pagination: null })
      return undefined
    }

    doctorApi.orders.listByDoctorPage(doctorId, {
      order_type: 'imaging',
      type: 'imaging',
      limit: 500,
      sort_by: 'created_at',
      sort_order: 'desc',
    })
      .then((payload) => {
        if (!active) return
        setState({
          loading: false,
          error: '',
          orders: safeArray(payload?.items).filter(isImagingOrder),
          pagination: payload?.pagination || null,
        })
      })
      .catch((error) => {
        if (!active) return
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Không thể tải dữ liệu chẩn đoán hình ảnh.'),
          orders: [],
          pagination: null,
        })
      })

    return () => {
      active = false
    }
  }, [doctorId, reloadKey])

  const filtered = useMemo(
    () => state.orders.filter((order) => {
      const status = statusInfo(order)
      return matchSearch(order, searchTerm.trim())
        && (statusFilter === 'all' || status.group === statusFilter)
        && withinTime(order, timeFilter)
        && (typeFilter === 'all' || imageType(order).toLowerCase().includes(typeFilter))
        && (roomFilter === 'all' || roomName(order).toLowerCase().includes(roomFilter))
    }),
    [roomFilter, searchTerm, state.orders, statusFilter, timeFilter, typeFilter],
  )

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const displayRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const stats = useMemo(() => {
    const base = { total: state.orders.length, waiting: 0, processing: 0, reported: 0, critical: 0, acknowledged: 0 }
    state.orders.forEach((order) => {
      const group = statusInfo(order).group
      if (group === 'waiting') base.waiting += 1
      if (group === 'processing') base.processing += 1
      if (group === 'reported') base.reported += 1
      if (group === 'critical') base.critical += 1
      if (group === 'acknowledged') {
        base.acknowledged += 1
        base.reported += 1
      }
    })
    return base
  }, [state.orders])

  const newReports = state.orders.filter((order) => hasReport(order)).slice(0, 3)
  const criticalRows = state.orders.filter((order) => isCritical(order) && !isAcknowledged(order)).slice(0, 3)
  const activities = state.orders.slice(0, 3)

  function reload() {
    setReloadKey((current) => current + 1)
  }

  async function openOrder(order) {
    const id = idOf(order)
    if (!id) {
      toast.error('Không tìm thấy mã chỉ định hình ảnh.')
      return
    }
    setSelectedId(id)
    try {
      await doctorApi.orders.getDetail(id)
      toast.info('Đã tải chi tiết chỉ định hình ảnh từ API.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải chi tiết chỉ định hình ảnh.'))
    }
  }

  async function acknowledgeOrder(order) {
    const id = idOf(order)
    if (!id) {
      toast.info('Chọn một báo cáo critical để xác nhận.')
      return
    }
    setBusy(id)
    try {
      await doctorApi.orders.acknowledge(id, { acknowledged_by: user?.user_id || user?.id })
      toast.success('Đã xác nhận báo cáo critical.')
      reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể xác nhận báo cáo critical.'))
    } finally {
      setBusy('')
    }
  }

  function exportCsv() {
    const rows = [
      ['Ma chi dinh', 'Benh nhan', 'Encounter', 'Loai hinh anh', 'Dich vu', 'Trang thai', 'Bao cao', 'Thoi gian', 'Phong CDHA'],
      ...filtered.map((order, index) => [
        orderCode(order, index),
        patientName(order),
        encounterCode(order),
        imageType(order),
        serviceName(order),
        statusInfo(order).label,
        hasReport(order) ? 'Co bao cao' : '-',
        `${formatDate(orderTime(order))} ${formatTime(orderTime(order))}`,
        roomName(order),
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `imaging-orders-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="doctor-imaging-page">
      {state.error ? <div className="doctor-imaging-error">{state.error}</div> : null}

      <section className="doctor-imaging-kpis">
        <ImagingKpi icon={ImageIcon} tone="blue" label="Tổng chỉ định hình ảnh" value={stats.total} hint="Trong 30 ngày qua" trend="▲ 12%" />
        <ImagingKpi icon={Timer} tone="orange" label="Chờ thực hiện" value={stats.waiting} hint="Chờ chụp" trend="▲ 8%" />
        <ImagingKpi icon={FileText} tone="green" label="Đã có báo cáo" value={stats.reported} hint="Trong 30 ngày qua" trend="▲ 15%" />
        <ImagingKpi icon={AlertTriangle} tone="red" label="Kết quả quan trọng" value={stats.critical} hint="Chưa xác nhận" trend="▲ 40%" />
      </section>

      <section className="doctor-imaging-layout">
        <main className="doctor-imaging-main">
          <article className="doctor-imaging-panel doctor-imaging-table-card">
            <div className="doctor-imaging-filters">
              <label><span>Tìm kiếm</span><div><input value={searchTerm} placeholder="Tìm theo mã chỉ định, bệnh nhân..." onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }} /><Search size={15} /></div></label>
              <label><span>Thời gian</span><div><select value={timeFilter} onChange={(event) => { setTimeFilter(event.target.value); setPage(1) }}><option value="30d">30 ngày qua</option><option value="7d">7 ngày qua</option><option value="today">Hôm nay</option><option value="all">Tất cả</option></select><CalendarDays size={15} /></div></label>
              <label><span>Trạng thái</span><div><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option value="all">Tất cả trạng thái</option><option value="waiting">Chờ chụp</option><option value="processing">Đang thực hiện</option><option value="reported">Có báo cáo</option><option value="critical">Critical</option><option value="acknowledged">Đã xác nhận</option></select></div></label>
              <label><span>Loại hình ảnh</span><div><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }}><option value="all">Tất cả</option><option value="x">X-quang</option><option value="ct">CT Scanner</option><option value="mri">MRI</option><option value="siêu">Siêu âm</option></select></div></label>
              <label><span>Phòng CĐHA</span><div><select value={roomFilter} onChange={(event) => { setRoomFilter(event.target.value); setPage(1) }}><option value="all">Tất cả</option><option value="x-quang">P. X-quang</option><option value="ct">P. CT</option><option value="mri">P. MRI</option><option value="siêu">P. Siêu âm</option></select></div></label>
              <button className="is-primary" type="button" onClick={reload}><Filter size={15} /> Bộ lọc</button>
              <button type="button" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setTimeFilter('30d'); setTypeFilter('all'); setRoomFilter('all'); setPage(1) }}><RefreshCw size={15} /> Đặt lại</button>
            </div>

            <div className="doctor-imaging-table-head">
              <span />
              <span>Mã chỉ định</span>
              <span>Bệnh nhân</span>
              <span>Encounter</span>
              <span>Loại hình ảnh</span>
              <span>Dịch vụ</span>
              <span>Trạng thái</span>
              <span>Báo cáo</span>
              <span>Thời gian</span>
              <span>Phòng CĐHA</span>
              <span>Thao tác</span>
            </div>
            <div className="doctor-imaging-table">
              {state.loading ? (
                <div className="doctor-imaging-empty">Đang tải dữ liệu chẩn đoán hình ảnh...</div>
              ) : displayRows.length ? displayRows.map((order, index) => {
                const status = statusInfo(order)
                return (
                  <div className={`doctor-imaging-row${selectedId === idOf(order) ? ' is-selected' : ''}`} key={idOf(order) || orderCode(order, index)}>
                    <input type="checkbox" aria-label={`Chọn ${orderCode(order, index)}`} />
                    <strong>{orderCode(order, index)}</strong>
                    <span className="doctor-imaging-person"><b>{patientName(order)}</b><small>{patientLine(order)}</small></span>
                    <strong>{encounterCode(order)}</strong>
                    <span><b>{imageType(order)}</b><small>{order.modality_detail || order.body_part || ''}</small></span>
                    <span>{serviceName(order)}</span>
                    <StatusBadge status={status} />
                    <em className={hasReport(order) ? 'is-green' : isCritical(order) ? 'is-red' : ''}>{hasReport(order) ? <FileText size={16} /> : isCritical(order) ? <AlertTriangle size={16} /> : '-'}</em>
                    <time>{formatDate(orderTime(order))}<small>{formatTime(orderTime(order))}</small></time>
                    <span>{roomName(order)}</span>
                    <span className="doctor-imaging-actions">
                      <button type="button" onClick={() => openOrder(order)}><Eye size={14} /></button>
                      <button type="button" aria-label="Tùy chọn"><MoreVertical size={16} /></button>
                    </span>
                  </div>
                )
              }) : (
                <div className="doctor-imaging-empty">Chưa có chỉ định hình ảnh phù hợp.</div>
              )}
            </div>
            <footer className="doctor-imaging-footer">
              <span>Hiển thị {total ? `${(page - 1) * PAGE_SIZE + 1} - ${Math.min(page * PAGE_SIZE, total)}` : '0'} trong tổng số {total.toLocaleString('vi-VN')} kết quả</span>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => idx + 1).map((pageNumber) => (
                  <button type="button" className={pageNumber === page ? 'is-active' : ''} key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                ))}
                {totalPages > 5 ? <span>...</span> : null}
                {totalPages > 5 ? <button type="button" onClick={() => setPage(totalPages)}>{totalPages}</button> : null}
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={15} /></button>
              </div>
              <span className="doctor-fixed-page-size">Hiển thị <strong>{PAGE_SIZE}</strong> dòng</span>
            </footer>
          </article>

          <section className="doctor-imaging-bottom">
            <article className="doctor-imaging-panel doctor-imaging-reports">
              <header><h2>Báo cáo mới</h2><button type="button" onClick={() => setStatusFilter('reported')}>Xem tất cả</button></header>
              <div className="doctor-imaging-small-head"><span>Mã chỉ định</span><span>Bệnh nhân</span><span>Loại hình ảnh</span><span>Dịch vụ</span><span>Thời gian có báo cáo</span><span>Thao tác</span></div>
              {newReports.length ? newReports.map((order, index) => (
                <button type="button" key={idOf(order) || index} onClick={() => openOrder(order)}>
                  <strong>{orderCode(order, index)}</strong>
                  <span>{patientName(order)}<small>{patientLine(order)}</small></span>
                  <span>{imageType(order)}</span>
                  <span>{serviceName(order)}</span>
                  <time>{formatDate(orderTime(order))} {formatTime(orderTime(order))}</time>
                  <em>Xem báo cáo</em>
                </button>
              )) : <p>Chưa có báo cáo mới.</p>}
            </article>

            <article className="doctor-imaging-panel doctor-imaging-critical">
              <header><h2>Kết quả cần xem <b>(Critical)</b></h2><button type="button" onClick={() => setStatusFilter('critical')}>Xem tất cả</button></header>
              {criticalRows.length ? criticalRows.map((order, index) => (
                <button type="button" key={idOf(order) || index} onClick={() => acknowledgeOrder(order)} disabled={busy === idOf(order)}>
                  <AlertTriangle size={15} />
                  <strong>{orderCode(order, index)}</strong>
                  <span>{patientName(order)}</span>
                  <span>{serviceName(order)}</span>
                  <time>{formatDate(orderTime(order))} {formatTime(orderTime(order))}</time>
                  <em>Chưa xác nhận</em>
                </button>
              )) : <p>Không có kết quả critical cần xem.</p>}
            </article>
          </section>
        </main>

        <aside className="doctor-imaging-side">
          <article className="doctor-imaging-panel doctor-imaging-overview">
            <h2>Tổng quan chẩn đoán hình ảnh</h2>
            <div>
              <ImagingDonut stats={stats} />
              <dl>
                <div><dt><i className="is-orange" /> Chờ chụp</dt><dd>{stats.waiting} ({percent(stats.waiting, stats.total)}%)</dd></div>
                <div><dt><i className="is-blue" /> Đang thực hiện</dt><dd>{stats.processing} ({percent(stats.processing, stats.total)}%)</dd></div>
                <div><dt><i className="is-green" /> Có báo cáo</dt><dd>{stats.reported} ({percent(stats.reported, stats.total)}%)</dd></div>
                <div><dt><i className="is-red" /> Critical</dt><dd>{stats.critical} ({percent(stats.critical, stats.total)}%)</dd></div>
              </dl>
            </div>
            <section>
              <p><AlertTriangle size={15} /> Báo cáo Critical (chưa xác nhận) <strong>{stats.critical}</strong></p>
              <p><Timer size={15} /> Báo cáo chờ xác nhận <strong>{stats.reported - stats.acknowledged}</strong></p>
              <p><ImageIcon size={15} /> Encounter có chỉ định hình ảnh <strong>{new Set(state.orders.map((order) => order.encounter_id).filter(Boolean)).size}</strong></p>
            </section>
          </article>

          <article className="doctor-imaging-panel doctor-imaging-quick">
            <h2>Thao tác nhanh</h2>
            <button type="button" onClick={() => newReports[0] ? openOrder(newReports[0]) : toast.info('Chưa có báo cáo hình ảnh để mở.')}><span><FileText size={18} /></span><b>Xem báo cáo</b><small>Tra cứu và xem báo cáo hình ảnh</small><ChevronRight size={17} /></button>
            <button type="button" onClick={() => criticalRows[0] ? acknowledgeOrder(criticalRows[0]) : toast.info('Không có báo cáo critical cần xác nhận.')}><span><AlertTriangle size={18} /></span><b>Xác nhận bất thường (Critical)</b><small>Xem và xác nhận kết quả quan trọng</small><i>{stats.critical}</i><ChevronRight size={17} /></button>
            <button type="button" onClick={exportCsv}><span><Download size={18} /></span><b>Xuất danh sách</b><small>Xuất danh sách chỉ định/báo cáo</small><ChevronRight size={17} /></button>
            <button type="button" onClick={() => setStatusFilter('reported')}><span><ImageIcon size={18} /></span><b>Xem theo encounter</b><small>Tổng hợp hình ảnh theo encounter</small><ChevronRight size={17} /></button>
          </article>

          <article className="doctor-imaging-panel doctor-imaging-activity">
            <h2>Hoạt động gần đây</h2>
            {activities.length ? activities.map((order, index) => {
              const status = statusInfo(order)
              return (
                <div key={idOf(order) || index}>
                  <i />
                  <span>
                    <b>{status.group === 'critical' ? 'Báo cáo critical cần xác nhận' : status.group === 'reported' || status.group === 'acknowledged' ? 'Báo cáo mới có sẵn' : 'Chỉ định mới được tạo'}</b>
                    <small>{orderCode(order, index)} - {patientName(order)}</small>
                  </span>
                  <time>{formatTime(orderTime(order))}</time>
                </div>
              )
            }) : <p>Chưa có hoạt động gần đây.</p>}
          </article>
        </aside>
      </section>
    </div>
  )
}
