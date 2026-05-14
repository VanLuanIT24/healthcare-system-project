import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { doctorApi, getDoctorCapabilities, getDoctorId } from './doctorApi'
import { useAsyncResource } from './DoctorHooks'
import { formatDate, formatDateTime, safeArray } from './doctorData'
import { useToast } from './toast/ToastProvider'
import { handleDoctorApiError, notifyDoctorSuccess, showDoctorToast } from './doctorFeedback'
import {
  ConfirmActionDialog,
  DoctorIcon,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionCard,
  StatusBadge,
  SurfaceHint,
} from './DoctorShell'

function useDebouncedSearch(value, delay = 300) {
  const [searchTerm, setSearchTerm] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchTerm(String(value || '').trim())
    }, delay)

    return () => window.clearTimeout(timeoutId)
  }, [delay, value])

  return searchTerm
}

function canReadOrders(capabilities) {
  return Boolean(capabilities.encountersRead || capabilities.canEncounterActions)
}

function getOrderTypeLabel(value) {
  const map = {
    lab: 'Xet nghiem',
    imaging: 'Chan doan hinh anh',
    procedure: 'Thu thuat',
    consultation: 'Hoi chan',
    service: 'Dich vu',
  }

  return map[value] || value || '--'
}

function getOrderPriorityLabel(value) {
  const map = {
    routine: 'Thuong',
    urgent: 'Uu tien',
    stat: 'Khan',
  }

  return map[value] || value || '--'
}

function getProgressClass(stepState) {
  if (stepState === 'done') return 'is-done'
  if (stepState === 'current') return 'is-current'
  return ''
}

export function EncounterOrdersPanel({ encounterId, readOnly = false, onChanged }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [ordersState, reloadOrders] = useAsyncResource(
    async () => doctorApi.orders.listByEncounter(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Khong the tai orders cua encounter.' },
  )
  const [ordersSummaryState, reloadOrdersSummary] = useAsyncResource(
    async () => doctorApi.orders.getEncounterSummary(encounterId),
    [encounterId],
    null,
    { fallbackMessage: 'Khong the tai tong quan orders cua encounter.' },
  )
  const orders = safeArray(ordersState.data)
  const orderSummary = ordersSummaryState.data || null
  const [form, setForm] = useState({
    title: '',
    order_type: 'lab',
    priority: 'routine',
    clinical_diagnosis: '',
    clinical_symptoms: '',
    doctor_note: '',
  })
  const [itemDraft, setItemDraft] = useState({
    service_name: '',
    service_code: '',
    specimen_type: '',
    unit_price: '',
    quantity: 1,
    note: '',
  })
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setForm({
      title: '',
      order_type: 'lab',
      priority: 'routine',
      clinical_diagnosis: '',
      clinical_symptoms: '',
      doctor_note: '',
    })
    setItemDraft({
      service_name: '',
      service_code: '',
      specimen_type: '',
      unit_price: '',
      quantity: 1,
      note: '',
    })
    setItems([])
  }

  function addDraftItem() {
    if (!String(itemDraft.service_name || '').trim()) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Thieu dich vu',
        message: 'Can nhap ten dich vu/chi dinh truoc khi them vao order.',
      })
      return
    }

    setItems((current) => [
      ...current,
      {
        ...itemDraft,
        service_name: String(itemDraft.service_name || '').trim(),
        service_code: String(itemDraft.service_code || '').trim(),
        specimen_type: String(itemDraft.specimen_type || '').trim(),
        unit_price: Number(itemDraft.unit_price || 0),
        quantity: Math.max(Number(itemDraft.quantity || 1), 1),
        note: String(itemDraft.note || '').trim(),
      },
    ])
    setItemDraft({
      service_name: '',
      service_code: '',
      specimen_type: '',
      unit_price: '',
      quantity: 1,
      note: '',
    })
  }

  async function handleCreateOrder() {
    if (items.length === 0) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Chua co chi dinh',
        message: 'Can co it nhat mot dich vu truoc khi tao order.',
      })
      return
    }

    setSaving(true)
    try {
      await doctorApi.orders.createForEncounter(encounterId, {
        ...form,
        items,
      })
      reloadOrders()
      reloadOrdersSummary()
      onChanged?.()
      resetForm()
      notifyDoctorSuccess(toast, 'Da tao order moi cho encounter.', 'Order da cap nhat')
    } catch (error) {
      handleDoctorApiError(error, toast, 'Khong the tao order moi.', { permission: 'encounters.write' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="doctor-two-column doctor-encounter-orders-redesign">
      <SectionCard title="Orders trong phiên khám" subtitle="Danh sách chỉ định cận lâm sàng liên kết với encounter này.">
        <div className="doctor-encounter-orders-summary">
          {[
            ['Tổng order', orderSummary?.total ?? orders.length],
            ['Đang mở', orderSummary?.pending ?? orders.filter((item) => !['completed', 'cancelled'].includes(item.status)).length],
            ['Có kết quả', orderSummary?.result_ready ?? 0],
            ['Hoàn tất', orderSummary?.completed ?? 0],
          ].map(([label, value]) => (
            <article key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>
        {ordersSummaryState.error ? <SurfaceHint tone="warning">{ordersSummaryState.error}</SurfaceHint> : null}
        {ordersState.loading ? <LoadingState label="Dang tai orders..." /> : null}
        {ordersState.error && !orders.length ? (
          <ErrorState title="Khong the tai orders" message={ordersState.error} onRetry={reloadOrders} />
        ) : null}
        {!ordersState.loading && !ordersState.error && orders.length === 0 ? (
          <EmptyState title="Chua co order" description="Encounter nay chua co chi dinh can lam sang nao." />
        ) : null}
        {orders.length ? (
          <div className="doctor-list-stack">
            {orders.map((order) => (
              <article key={order.order_id} className="doctor-list-row">
                <div>
                  <strong>{order.order_code || order.title || order.order_id}</strong>
                  <p>{order.title || getOrderTypeLabel(order.order_type)}</p>
                  <span className="doctor-muted-text">
                    {order.patient_name || '--'} | {order.items_count || 0} dịch vụ | {formatDateTime(order.created_at)}
                  </span>
                </div>
                <div className="doctor-inline-actions doctor-inline-actions-wrap">
                  <StatusBadge status={order.status || 'draft'} />
                  <button
                    className="doctor-secondary-button"
                    type="button"
                    onClick={() => navigate(`/doctor/orders/${order.order_id}`)}
                  >
                    Mo chi tiet
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Tạo order mới"
        subtitle="Bác sĩ tạo order trực tiếp từ encounter bằng API thật."
        actions={readOnly ? <SurfaceHint tone="warning">Chi xem</SurfaceHint> : null}
      >
        <div className="doctor-panel-stack">
          <div className="doctor-form-grid">
            <label>
              <span>Tieu de</span>
              <input value={form.title} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Vi du: Goi xet nghiem tong quat" />
            </label>
            <label>
              <span>Loai order</span>
              <select value={form.order_type} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, order_type: event.target.value }))}>
                <option value="lab">Xet nghiem</option>
                <option value="imaging">Chan doan hinh anh</option>
                <option value="procedure">Thu thuat</option>
                <option value="consultation">Hoi chan</option>
                <option value="service">Dich vu</option>
              </select>
            </label>
            <label>
              <span>Uu tien</span>
              <select value={form.priority} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                <option value="routine">Thuong</option>
                <option value="urgent">Uu tien</option>
                <option value="stat">Khan</option>
              </select>
            </label>
            <label>
              <span>Chan doan</span>
              <input value={form.clinical_diagnosis} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, clinical_diagnosis: event.target.value }))} placeholder="Chan doan lam sang" />
            </label>
            <label>
              <span>Trieu chung</span>
              <textarea value={form.clinical_symptoms} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, clinical_symptoms: event.target.value }))} placeholder="Mo ta trieu chung/boi canh can lam sang" />
            </label>
            <label>
              <span>Ghi chu bac si</span>
              <textarea value={form.doctor_note} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, doctor_note: event.target.value }))} placeholder="Ghi chu bo sung cho khoa nhan order" />
            </label>
          </div>

          <div className="doctor-order-item-builder">
            <div className="doctor-form-grid doctor-form-grid-compact">
              <label>
                <span>Dich vu</span>
                <input value={itemDraft.service_name} disabled={readOnly} onChange={(event) => setItemDraft((current) => ({ ...current, service_name: event.target.value }))} placeholder="VD: Tong phan tich te bao mau" />
              </label>
              <label>
                <span>Ma dich vu</span>
                <input value={itemDraft.service_code} disabled={readOnly} onChange={(event) => setItemDraft((current) => ({ ...current, service_code: event.target.value }))} />
              </label>
              <label>
                <span>Mau benh pham</span>
                <input value={itemDraft.specimen_type} disabled={readOnly} onChange={(event) => setItemDraft((current) => ({ ...current, specimen_type: event.target.value }))} />
              </label>
              <label>
                <span>Don gia</span>
                <input type="number" value={itemDraft.unit_price} disabled={readOnly} onChange={(event) => setItemDraft((current) => ({ ...current, unit_price: event.target.value }))} />
              </label>
              <label>
                <span>So luong</span>
                <input type="number" value={itemDraft.quantity} disabled={readOnly} onChange={(event) => setItemDraft((current) => ({ ...current, quantity: event.target.value }))} />
              </label>
              <label>
                <span>Ghi chu item</span>
                <input value={itemDraft.note} disabled={readOnly} onChange={(event) => setItemDraft((current) => ({ ...current, note: event.target.value }))} />
              </label>
            </div>

            <div className="doctor-inline-actions doctor-inline-actions-wrap">
              <button className="doctor-secondary-button" type="button" onClick={addDraftItem} disabled={readOnly || saving}>
                Them dich vu
              </button>
              <button className="doctor-primary-button" type="button" onClick={handleCreateOrder} disabled={readOnly || saving}>
                Tao order
              </button>
            </div>

            {items.length ? (
              <div className="doctor-list-stack">
                {items.map((item, index) => (
                  <div key={`${item.service_name}-${index}`} className="doctor-list-row">
                    <div>
                      <strong>{item.service_name}</strong>
                      <p>{item.specimen_type || '--'} | {item.quantity} | {Number(item.unit_price || 0).toLocaleString('vi-VN')} VND</p>
                    </div>
                    <button
                      className="doctor-secondary-button doctor-button-danger-soft"
                      type="button"
                      onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      disabled={readOnly || saving}
                    >
                      Bo
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="doctor-muted-card">Them mot hoac nhieu dich vu vao danh sach order truoc khi gui.</div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

export function DoctorOrdersScreen({ user }) {
  const location = useLocation()
  const navigate = useNavigate()
  const doctorId = getDoctorId(user)
  const capabilities = getDoctorCapabilities(user)
  const pageSize = 20
  const [status, setStatus] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const searchTerm = useDebouncedSearch(searchInput)
  const allowRead = canReadOrders(capabilities)

  const query = useMemo(
    () => ({
      page,
      limit: pageSize,
      ...(status !== 'all' ? { status } : {}),
      ...(searchTerm ? { search: searchTerm } : {}),
    }),
    [page, pageSize, searchTerm, status],
  )

  const [ordersState, reloadOrders] = useAsyncResource(
    async () => (doctorId && allowRead ? doctorApi.orders.listByDoctorPage(doctorId, query) : { items: [], pagination: null }),
    [doctorId, allowRead, query],
    { items: [], pagination: null },
    { fallbackMessage: 'Khong the tai danh sach orders cua bac si.' },
  )
  const [summaryState, reloadSummary] = useAsyncResource(
    async () => (doctorId && allowRead ? doctorApi.orders.getSummary({ doctor_id: doctorId }) : null),
    [doctorId, allowRead],
    null,
    { fallbackMessage: 'Khong the tai tong quan orders.' },
  )

  useEffect(() => {
    const requestedOrderId = location.state?.selectedOrderId
    if (!requestedOrderId) {
      return
    }
    navigate(`/doctor/orders/${requestedOrderId}`, { replace: true })
  }, [location.state, navigate])

  const orders = safeArray(ordersState.data?.items)
  const pagination = ordersState.data?.pagination || null
  const summary = summaryState.data || {
    total: 0,
    draft: 0,
    confirmed: 0,
    in_progress: 0,
    result_ready: 0,
    completed: 0,
    cancelled: 0,
    pending: 0,
  }
  const currentPage = Number(pagination?.page || page)
  const totalPages = Math.max(Number(pagination?.total_pages || 1), 1)

  function refreshWorkspace() {
    reloadOrders()
    reloadSummary()
  }

  return (
    <div className="doctor-page-stack">
      <section className="doctor-page-heading">
        <div>
          <h2>Orders cua toi</h2>
          <p>Danh sach chi dinh can lam sang theo bac si, doc tu backend orders moi.</p>
        </div>
        <button className="doctor-secondary-button" type="button" onClick={refreshWorkspace}>
          Lam moi
        </button>
      </section>

      <div className="doctor-encounter-command-strip">
        <div className="doctor-kpi-tile"><strong>{summaryState.loading ? '...' : summary.total}</strong><span>Tong order</span></div>
        <div className="doctor-kpi-tile"><strong>{summaryState.loading ? '...' : summary.pending}</strong><span>Cho xu ly</span></div>
        <div className="doctor-kpi-tile"><strong>{summaryState.loading ? '...' : summary.completed}</strong><span>Hoan tat</span></div>
        <div className="doctor-kpi-tile"><strong>{summaryState.loading ? '...' : summary.cancelled}</strong><span>Da huy</span></div>
      </div>

      <SectionCard
        title="Danh sach orders"
        subtitle="Loc theo trang thai, tim theo ma order, ten benh nhan hoac ghi chu lam sang."
        actions={!allowRead ? <SurfaceHint tone="warning">Can encounters.read</SurfaceHint> : null}
      >
        <div className="doctor-filter-bar doctor-filter-bar-split">
          <label>
            <span>Trang thai</span>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
              <option value="all">Tat ca</option>
              <option value="draft">Ban nhap</option>
              <option value="confirmed">Da xac nhan</option>
              <option value="in_progress">Dang thuc hien</option>
              <option value="result_ready">Co ket qua</option>
              <option value="completed">Hoan tat</option>
              <option value="cancelled">Da huy</option>
            </select>
          </label>
          <label>
            <span>Tim kiem</span>
            <input value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setPage(1) }} placeholder="Ma order, benh nhan, chan doan..." />
          </label>
          {searchInput ? (
            <button className="doctor-secondary-button doctor-filter-clear-button" type="button" onClick={() => { setSearchInput(''); setPage(1) }}>
              Xoa
            </button>
          ) : null}
        </div>

        {ordersState.loading ? <LoadingState label="Dang tai orders..." /> : null}
        {ordersState.error ? <ErrorState title="Khong the tai orders" message={ordersState.error} onRetry={refreshWorkspace} /> : null}
        {!allowRead ? (
          <EmptyState title="Khong co quyen doc orders" description="Backend orders module dang duoc gate bang quyen encounter." />
        ) : null}
        {allowRead && !ordersState.loading && !orders.length ? (
          <EmptyState title="Chua co order phu hop" description="Khong tim thay order nao theo bo loc hien tai." />
        ) : null}

        {allowRead && orders.length ? (
          <div className="doctor-table-wrap">
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Benh nhan</th>
                  <th>Encounter</th>
                  <th>Loai / uu tien</th>
                  <th>Trang thai</th>
                  <th>Cap nhat</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.order_id} onClick={() => navigate(`/doctor/orders/${order.order_id}`)}>
                    <td>
                      <div className="doctor-table-cell-stack">
                        <strong>{order.order_code || order.order_id}</strong>
                        <span>{order.title || getOrderTypeLabel(order.order_type)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="doctor-table-cell-stack">
                        <strong>{order.patient_name || '--'}</strong>
                        <span>{order.patient_code || order.patient_id || '--'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="doctor-table-cell-stack">
                        <strong>{order.encounter_code || order.encounter_id || '--'}</strong>
                        <span>{order.department_name || '--'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="doctor-table-cell-stack">
                        <strong>{getOrderTypeLabel(order.order_type)}</strong>
                        <span>{getOrderPriorityLabel(order.priority)}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={order.status || 'draft'} /></td>
                    <td>{formatDate(order.updated_at || order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {pagination ? (
          <div className="doctor-pagination-bar">
            <span>Trang {currentPage}/{totalPages} - {pagination.total} order.</span>
            <div className="doctor-inline-actions">
              <button className="doctor-secondary-button" type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={ordersState.loading || currentPage <= 1}>
                Truoc
              </button>
              <button className="doctor-secondary-button" type="button" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={ordersState.loading || currentPage >= totalPages}>
                Sau
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}

export function DoctorOrderDetailScreen({ user }) {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const capabilities = getDoctorCapabilities(user)
  const allowRead = canReadOrders(capabilities)
  const allowWrite = capabilities.canEncounterActions
  const [cancelReason, setCancelReason] = useState('')
  const [cancelNote, setCancelNote] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const [orderState, reloadOrder] = useAsyncResource(
    async () => (allowRead && orderId ? doctorApi.orders.getDetail(orderId) : null),
    [allowRead, orderId],
    null,
    { fallbackMessage: 'Khong the tai chi tiet order.' },
  )
  const [timelineState, reloadTimeline] = useAsyncResource(
    async () => (allowRead && orderId ? doctorApi.orders.getTimeline(orderId) : []),
    [allowRead, orderId],
    [],
    { fallbackMessage: 'Khong the tai lich su xu ly order.' },
  )

  const order = orderState.data?.order || null
  const items = safeArray(orderState.data?.items)
  const summary = orderState.data?.summary || null
  const progress = orderState.data?.progress || null
  const timeline = safeArray(timelineState.data)
  const isFinal = ['completed', 'cancelled'].includes(String(order?.status || '').toLowerCase())

  async function handleCancelOrder() {
    if (!String(cancelReason || '').trim()) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Thieu ly do',
        message: 'Can chon ly do huy order truoc khi xac nhan.',
      })
      return
    }

    setBusy(true)
    try {
      await doctorApi.orders.cancel(orderId, {
        cancel_reason: cancelReason,
        cancel_note: cancelNote,
      })
      reloadOrder()
      reloadTimeline()
      setDialogOpen(false)
      notifyDoctorSuccess(toast, 'Da huy order thanh cong.', 'Order da cap nhat')
    } catch (error) {
      handleDoctorApiError(error, toast, 'Khong the huy order.', { permission: 'encounters.write' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="doctor-page-stack doctor-order-detail-page">
      <div className="doctor-inline-actions doctor-inline-actions-wrap">
        <button className="doctor-link-button" type="button" onClick={() => navigate('/doctor/orders')}>
          <DoctorIcon name="arrow_left" />
          <span>Quay lại danh sách orders</span>
        </button>
      </div>

      <section className="doctor-page-heading doctor-order-detail-heading">
        <div>
          <div className="doctor-order-heading-inline">
            <h2>Chi tiết order</h2>
            <span className="doctor-order-id-chip">ID: {order?.order_code || orderId}</span>
          </div>
        </div>
        {order?.order_code ? (
          <button
            className="doctor-secondary-button"
            type="button"
            onClick={() => navigator.clipboard?.writeText(order.order_code)}
          >
            Sao chép ID
          </button>
        ) : null}
      </section>

      {!allowRead ? (
        <EmptyState title="Khong co quyen xem order" description="Role hien tai can encounters.read hoac encounters.write de doc orders." />
      ) : null}
      {orderState.loading ? <LoadingState label="Dang tai chi tiet order..." /> : null}
      {orderState.error && !order ? <ErrorState title="Khong the tai chi tiet order" message={orderState.error} onRetry={reloadOrder} /> : null}

      {order ? (
        <div className="doctor-order-detail-layout">
          <div className="doctor-panel-stack">
            <SectionCard title={order.patient_name || 'Benh nhan'} subtitle={`${order.patient_code || order.patient_id || '--'} | ${order.patient_gender || '--'} ${order.patient_age ? `| ${order.patient_age} tuoi` : ''}`}>
              <div className="doctor-order-overview-grid">
                <div className="doctor-order-patient-chip">
                  <div className="doctor-order-avatar">
                    <span>{String(order.patient_name || 'BN').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="doctor-order-patient-name">
                      <strong>{order.patient_name || '--'}</strong>
                      {order.patient_gender ? <span className="doctor-order-inline-chip">{order.patient_gender}</span> : null}
                      {order.patient_age ? <span className="doctor-order-inline-chip">{order.patient_age} tuổi</span> : null}
                    </div>
                    <small>{order.patient_code || order.patient_id || '--'}</small>
                    <p>{order.patient_phone || 'Chua co so dien thoai'}</p>
                    <div className="doctor-inline-actions doctor-inline-actions-wrap">
                      {order.patient_id ? (
                        <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/patients/${order.patient_id}`)}>
                          Mở hồ sơ bệnh nhân
                        </button>
                      ) : null}
                      {order.encounter_id ? (
                        <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/encounters/${order.encounter_id}?tab=orders`, { state: { activeTab: 'orders' } })}>
                          Mở encounter
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="doctor-order-meta-grid">
                  <div><span>Encounter</span><strong>{order.encounter_code || order.encounter_id || '--'}</strong></div>
                  <div><span>Loai order</span><strong>{getOrderTypeLabel(order.order_type)}</strong></div>
                  <div><span>Uu tien</span><strong>{getOrderPriorityLabel(order.priority)}</strong></div>
                  <div><span>Bac si yeu cau</span><strong>{order.doctor_name || '--'}</strong></div>
                  <div><span>Khoa gui</span><strong>{order.department_name || '--'}</strong></div>
                  <div><span>Khoa nhan</span><strong>{order.receiving_department_name || '--'}</strong></div>
                  <div><span>Trang thai hien tai</span><strong><StatusBadge status={order.status || 'draft'} /></strong></div>
                  <div><span>Cap nhat</span><strong>{formatDateTime(order.updated_at || order.created_at)}</strong></div>
                </div>
              </div>

              {progress?.steps?.length ? (
                <div className="doctor-order-progress">
                  {progress.steps.map((step, index) => (
                    <div key={step.id} className={`doctor-order-progress-step ${getProgressClass(step.state)}`}>
                      <span>{index + 1}</span>
                      <strong>{step.label}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </SectionCard>

            <div className="doctor-two-column doctor-order-detail-grid">
              <SectionCard title={`Danh sach chi dinh (${items.length})`} subtitle="Cac dich vu/chi dinh thuoc order hien tai.">
                {!items.length ? (
                  <EmptyState title="Order chua co item" description="Danh sach dich vu dang trong." />
                ) : (
                  <div className="doctor-table-wrap">
                    <table className="doctor-table">
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Dich vu</th>
                          <th>Mau benh pham</th>
                          <th>Don gia</th>
                          <th>Trang thai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={item.order_item_id || index}>
                            <td>{index + 1}</td>
                            <td>
                              <div className="doctor-table-cell-stack">
                                <strong>{item.service_name}</strong>
                                <span>{item.service_code || '--'}</span>
                              </div>
                            </td>
                            <td>{item.specimen_type || '--'}</td>
                            <td>{Number(item.unit_price || 0).toLocaleString('vi-VN')} VND</td>
                            <td><StatusBadge status={item.status || 'pending'} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Lịch sử xử lý" subtitle="Timeline xử lý order từ backend audit log.">
                {timelineState.loading ? <LoadingState label="Dang tai timeline..." /> : null}
                {timelineState.error && !timeline.length ? <ErrorState title="Khong the tai timeline" message={timelineState.error} onRetry={reloadTimeline} /> : null}
                {!timelineState.loading && !timelineState.error && !timeline.length ? (
                  <EmptyState title="Chua co lich su" description="Order nay chua co su kien xu ly nao." />
                ) : null}
                {timeline.length ? (
                  <div className="doctor-order-timeline">
                    {timeline.map((item, index) => {
                      const isCurrent = index === timeline.length - 1
                      const toneClass = isCurrent ? 'is-current' : 'is-complete'
                      return (
                        <article key={item._id || index} className={`doctor-order-timeline-item ${toneClass}`}>
                          <div className="doctor-order-timeline-marker" />
                          <div className="doctor-order-timeline-copy">
                            <div className="doctor-order-timeline-head">
                              <div>
                                <strong>{item.message || item.action || 'Sự kiện order'}</strong>
                                <small>{formatDateTime(item.created_at)}</small>
                              </div>
                              {item.status ? <StatusBadge status={item.status} /> : null}
                            </div>
                            <p>{item.actor_name || item.actor_id || item.actor_type || '--'}</p>
                            {item.action ? (
                              <ul>
                                <li>{item.action}</li>
                              </ul>
                            ) : null}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : null}
              </SectionCard>
            </div>

            <SectionCard title="Chi dinh lam sang" subtitle="Thong tin dieu kien lam sang di kem order hien tai.">
              <div className="doctor-order-clinical-notes">
                <div>
                  <span>Chan doan</span>
                  <strong>{order.clinical_diagnosis || '--'}</strong>
                </div>
                <div>
                  <span>Trieu chung/ghi chu lam sang</span>
                  <p>{order.clinical_symptoms || 'Khong co mo ta lam sang bo sung.'}</p>
                </div>
                <div>
                  <span>Ghi chu cua bac si</span>
                  <p>{order.doctor_note || 'Khong co ghi chu rieng cho khoa nhan order.'}</p>
                </div>
              </div>
              {summary ? (
                <div className="doctor-kpi-mini-grid">
                  <div className="doctor-kpi-tile"><strong>{summary.items_count}</strong><span>Tong item</span></div>
                  <div className="doctor-kpi-tile"><strong>{summary.pending_items_count}</strong><span>Cho lay mau</span></div>
                  <div className="doctor-kpi-tile"><strong>{summary.in_progress_items_count}</strong><span>Dang xu ly</span></div>
                  <div className="doctor-kpi-tile"><strong>{summary.completed_items_count}</strong><span>Hoan tat</span></div>
                </div>
              ) : null}
            </SectionCard>
          </div>

          <aside className="doctor-order-cancel-sidebar">
            <SectionCard
              title="Hủy order"
              subtitle={order.order_code || order.order_id}
              actions={(
                <button className="doctor-icon-button" type="button" onClick={() => navigate('/doctor/orders')} aria-label="Đóng">
                  <DoctorIcon name="cancel" />
                </button>
              )}
            >
              {!allowWrite ? (
                <SurfaceHint tone="warning">Không có quyền ghi order</SurfaceHint>
              ) : null}
              <div className="doctor-alert-card doctor-alert-danger">
                <div className="doctor-alert-head">
                  <StatusBadge status="cancelled" />
                  <strong>Hủy order sẽ dừng toàn bộ dịch vụ chưa hoàn tất.</strong>
                </div>
                <p>Chỉ hủy order khi đã kiểm tra kỹ ảnh hưởng tới bệnh nhân và đơn vị nhận.</p>
              </div>
              <label className="doctor-section-field">
                <span>Lý do hủy</span>
                <select value={cancelReason} disabled={!allowWrite || isFinal || busy} onChange={(event) => setCancelReason(event.target.value)}>
                  <option value="">Chọn lý do hủy order</option>
                  <option value="clinical_change">Thay đổi đánh giá lâm sàng</option>
                  <option value="duplicate_request">Chỉ định trùng lặp</option>
                  <option value="patient_declined">Bệnh nhân từ chối</option>
                  <option value="wrong_order">Tạo nhầm chỉ định</option>
                </select>
              </label>
              <label className="doctor-section-field">
                <span>Ghi chú</span>
                <textarea value={cancelNote} disabled={!allowWrite || isFinal || busy} onChange={(event) => setCancelNote(event.target.value)} placeholder="Nhap ghi chu chi tiet cho ly do huy order..." />
                <small className="doctor-order-note-counter">{String(cancelNote || '').length}/300</small>
              </label>
              <div className="doctor-order-risk-card">
                <strong>Đánh giá rủi ro</strong>
                <ul>
                  <li>Kiểm tra các dịch vụ đã lấy mẫu hoặc đang xử lý.</li>
                  <li>Đảm bảo khoa nhận order đã được thông báo.</li>
                  <li>Kết quả đã phát hành sẽ không tự động bị thu hồi.</li>
                </ul>
              </div>
              <label className="doctor-checkbox-field">
                <input type="checkbox" checked={confirmCancel} disabled={!allowWrite || isFinal || busy} onChange={(event) => setConfirmCancel(event.target.checked)} />
                <span>Tôi xác nhận đã kiểm tra tác động trước khi hủy order này.</span>
              </label>
              <div className="doctor-inline-actions doctor-inline-actions-wrap">
                <button className="doctor-secondary-button" type="button" onClick={() => navigate('/doctor/orders')}>
                  Đóng
                </button>
                <button
                  className="doctor-primary-button doctor-order-cancel-button"
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  disabled={!allowWrite || isFinal || !confirmCancel || busy}
                >
                  Xác nhận hủy order
                </button>
              </div>
            </SectionCard>
          </aside>
        </div>
      ) : null}

      <ConfirmActionDialog
        open={dialogOpen}
        title="Huy order nay?"
        description="Thao tac nay se chuyen order sang trang thai da huy va cap nhat cac item chua hoan tat."
        confirmLabel="Huy order"
        busy={busy}
        onCancel={() => setDialogOpen(false)}
        onConfirm={handleCancelOrder}
      />
    </div>
  )
}
