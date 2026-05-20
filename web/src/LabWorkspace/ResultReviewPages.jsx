import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileClock,
  FileText,
  History,
  MailCheck,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  Undo2,
  UserCheck,
} from 'lucide-react';
import { getResultReviewErrorMessage, resultReviewApi } from './resultReviewApi';

const TYPE_LABEL = {
  lab_result: 'Lab',
  imaging_report: 'CĐHA',
  procedure_result: 'Thủ thuật',
  procedure_order: 'Thủ thuật',
};

const STATUS_LABEL = {
  draft: 'Draft',
  preliminary: 'Preliminary',
  final: 'Final',
  amended: 'Amended',
  cancelled: 'Đã hủy',
  entered_in_error: 'Nhập sai',
  pending_confirmation: 'Chờ xác nhận',
};

const PRIORITY_LABEL = {
  stat: 'STAT',
  urgent: 'Urgent',
  routine: 'Routine',
};

export const RESULT_REVIEW_PAGE_CONFIG = {
  labPending: {
    title: 'Chờ duyệt lab',
    subtitle: 'Duyệt kết quả xét nghiệm preliminary với checklist specimen, abnormal/critical và validation trước khi final.',
    tab: 'lab-pending',
    type: 'lab_result',
    accent: 'green',
  },
  imagingSigning: {
    title: 'Chờ ký CĐHA',
    subtitle: 'Workstation ký báo cáo CĐHA: clinical context, PACS/file, findings, impression và critical finding.',
    tab: 'imaging-signing',
    type: 'imaging_report',
    accent: 'blue',
  },
  procedureConfirmation: {
    title: 'Chờ xác nhận thủ thuật',
    subtitle: 'Xác nhận structured result thủ thuật, kiểm tra result note, file, charge và release sau hoàn tất.',
    tab: 'procedure-confirmation',
    type: 'procedure_result',
    accent: 'violet',
  },
  releasedDoctor: {
    title: 'Kết quả đã trả bác sĩ',
    subtitle: 'Theo dõi kết quả đã gửi bác sĩ, read receipt, acknowledge critical và delivery log.',
    tab: 'released-to-doctor',
    accent: 'teal',
  },
  releasedPatient: {
    title: 'Kết quả đã trả bệnh nhân',
    subtitle: 'Quản trị release patient portal, file đi kèm, download/read receipt và thu hồi release khi cần.',
    tab: 'released-to-patient',
    accent: 'indigo',
  },
  amendNeeded: {
    title: 'Kết quả cần amend',
    subtitle: 'Kiểm soát request amend, version chain, rủi ro amend sau khi đã trả bác sĩ hoặc bệnh nhân.',
    tab: 'amend-needed',
    accent: 'amber',
  },
  auditHistory: {
    title: 'Lịch sử duyệt / ký',
    subtitle: 'Audit trail tập trung cho finalize, ký, release, critical acknowledge, amend và thu hồi release.',
    tab: 'audit-history',
    accent: 'slate',
    audit: true,
  },
};

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getId(item) {
  return item?._id || item?.id;
}

function getPatientName(item) {
  return item?.patient?.full_name || item?.patient?.name || '--';
}

function getResultLabel(item) {
  return item?.result_no || item?.order?.child_no || getId(item) || '--';
}

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function KpiStrip({ summary = {} }) {
  const cards = [
    ['Chờ duyệt lab', summary.lab_pending || 0, ClipboardCheck],
    ['Chờ ký CĐHA', summary.imaging_signing || 0, BadgeCheck],
    ['Chờ xác nhận thủ thuật', summary.procedure_confirmation || 0, FileText],
    ['Critical chưa xử lý', summary.critical_unacknowledged || 0, ShieldAlert],
    ['Trả bác sĩ hôm nay', summary.released_to_doctor_today || 0, Stethoscope],
    ['Trả bệnh nhân hôm nay', summary.released_to_patient_today || 0, UserCheck],
    ['Cần amend', summary.amend_needed || 0, AlertTriangle],
  ];
  return (
    <div className="review-kpi-strip">
      {cards.map(([label, value, Icon]) => (
        <div className="review-kpi" key={label}>
          <Icon size={18} />
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function FilterBar({ filters, setFilters, fixedType, onRefresh, loading }) {
  return (
    <div className="review-filter-bar">
      <label>
        <span>Loại</span>
        <select
          value={fixedType || filters.type}
          disabled={Boolean(fixedType)}
          onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
        >
          <option value="all">Tất cả</option>
          <option value="lab_result">Lab</option>
          <option value="imaging_report">CĐHA</option>
          <option value="procedure_result">Thủ thuật</option>
        </select>
      </label>
      <label>
        <span>Trạng thái</span>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">Theo màn</option>
          <option value="draft">Draft</option>
          <option value="preliminary">Preliminary</option>
          <option value="final">Final</option>
          <option value="amended">Amended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label>
        <span>Critical</span>
        <select value={filters.critical} onChange={(event) => setFilters((current) => ({ ...current, critical: event.target.value }))}>
          <option value="">Tất cả</option>
          <option value="true">Có critical</option>
          <option value="unack">Chưa acknowledge</option>
        </select>
      </label>
      <label className="review-search">
        <span>Tìm kiếm</span>
        <Search size={16} />
        <input
          value={filters.search}
          placeholder="Mã result, tên dịch vụ..."
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
        />
      </label>
      <button className="review-icon-button" type="button" onClick={onRefresh} disabled={loading} title="Làm mới">
        <RefreshCw size={17} className={loading ? 'review-spin' : ''} />
      </button>
    </div>
  );
}

function WorklistRow({ item, selected, onSelect, onAction }) {
  const critical = item?.risk?.critical_unacknowledged || item?.risk?.is_critical;
  return (
    <button type="button" className={cx('review-row', selected && 'is-selected')} onClick={() => onSelect(item)}>
      <div className="review-row__topline">
        <span className={cx('review-pill', `type-${item.type}`)}>{TYPE_LABEL[item.type] || item.type}</span>
        <span className={cx('review-priority', item.priority)}>{PRIORITY_LABEL[item.priority] || item.priority || 'Routine'}</span>
        {critical && <span className="review-risk-pill critical">Critical</span>}
        {item.risk?.file_scan_issue && <span className="review-risk-pill">File lỗi scan</span>}
        {item.risk?.missing_file && <span className="review-risk-pill">Thiếu file</span>}
      </div>
      <div className="review-row__title">
        <strong>{getResultLabel(item)}</strong>
        <span>{item.title}</span>
      </div>
      <div className="review-row__meta">
        <span>{getPatientName(item)}</span>
        <span>{item.patient?.gender || '--'} · {item.patient?.age ?? '--'}T</span>
        <span>{item.encounter?.encounter_code || 'Chưa có encounter'}</span>
      </div>
      <div className="review-row__meta">
        <span>BS chỉ định: {item.order?.ordered_by?.name || '--'}</span>
        <span>File: {item.counts?.attachments || 0}</span>
        <span>Abnormal/Critical: {item.counts?.abnormal_items || 0}/{item.counts?.critical_items || 0}</span>
      </div>
      <div className="review-row__footer">
        <span className="review-status">{STATUS_LABEL[item.status] || item.status || '--'}</span>
        <span>{formatDateTime(item.review?.reported_at || item.order?.completed_at || item.order?.ordered_at)}</span>
        <div className="review-row-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" title="Duyệt/ký" onClick={() => onAction('finalize', item)}><BadgeCheck size={15} /></button>
          <button type="button" title="Trả bác sĩ" onClick={() => onAction('release_doctor', item)}><Send size={15} /></button>
          <button type="button" title="Trả bệnh nhân" onClick={() => onAction('release_patient', item)}><UserCheck size={15} /></button>
          <button type="button" title="Request amend" onClick={() => onAction('amend', item)}><AlertTriangle size={15} /></button>
        </div>
      </div>
    </button>
  );
}

function Worklist({ items, selectedId, onSelect, onAction, loading }) {
  if (loading && !items.length) {
    return <div className="review-empty">Đang tải worklist...</div>;
  }
  if (!items.length) {
    return <div className="review-empty">Không có kết quả phù hợp.</div>;
  }
  return (
    <div className="review-worklist">
      {items.map((item) => (
        <WorklistRow
          key={`${item.type}-${getId(item)}`}
          item={item}
          selected={selectedId === `${item.type}-${getId(item)}`}
          onSelect={onSelect}
          onAction={onAction}
        />
      ))}
    </div>
  );
}

function RiskPanel({ item, validation, onAction }) {
  if (!item) return null;
  const checks = [
    ['Đã có file', !item.risk?.missing_file, item.counts?.attachments || 0],
    ['Không lỗi scan', !item.risk?.file_scan_issue, item.attachment_summary?.scan_issue_count || 0],
    ['Không chờ review file', !item.risk?.file_pending_review, item.attachment_summary?.pending_review_count || 0],
    ['Critical acknowledged', !item.risk?.critical_unacknowledged, item.risk?.critical_acknowledged_at ? formatDateTime(item.risk.critical_acknowledged_at) : '--'],
    ['Đã gửi bác sĩ', Boolean(item.review?.released_to_doctor), item.review?.doctor_delivery_status || '--'],
    ['Đã trả bệnh nhân', Boolean(item.review?.released_to_patient), item.review?.patient_delivery_status || '--'],
  ];
  return (
    <aside className="review-action-panel">
      <div className="review-panel-title">
        <ShieldAlert size={18} />
        <strong>Validation & risk</strong>
      </div>
      <div className="review-checklist">
        {checks.map(([label, ok, value]) => (
          <div className={cx('review-check', ok ? 'ok' : 'warn')} key={label}>
            <CheckCircle2 size={15} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {validation && (
        <div className="review-validation-box">
          <strong>{validation.can_finalize ? 'Có thể finalize' : 'Chưa thể finalize'}</strong>
          {(validation.blocking_errors || []).map((error) => (
            <span key={error.code || error.message}>{error.message}</span>
          ))}
          {(validation.warnings || []).map((warning) => (
            <span key={warning.code || warning.message}>{warning.message}</span>
          ))}
        </div>
      )}
      <div className="review-action-grid">
        <button type="button" onClick={() => onAction('validate', item)}><ClipboardCheck size={16} /> Validate</button>
        <button type="button" onClick={() => onAction('finalize', item)}><BadgeCheck size={16} /> Duyệt/Ký</button>
        <button type="button" onClick={() => onAction('release_doctor', item)}><Send size={16} /> Trả bác sĩ</button>
        <button type="button" onClick={() => onAction('doctor_ack', item)}><MailCheck size={16} /> Doctor ack</button>
        <button type="button" onClick={() => onAction('release_patient', item)}><UserCheck size={16} /> Trả patient</button>
        <button type="button" onClick={() => onAction('revoke_patient', item)}><Undo2 size={16} /> Thu hồi</button>
        <button type="button" onClick={() => onAction('ack_critical', item)}><BellRing size={16} /> Ack critical</button>
        <button type="button" onClick={() => onAction('amend', item)}><AlertTriangle size={16} /> Request amend</button>
      </div>
    </aside>
  );
}

function DetailCard({ title, children }) {
  return (
    <section className="review-detail-card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function KeyValueGrid({ rows }) {
  return (
    <div className="review-kv-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value || '--'}</strong>
        </div>
      ))}
    </div>
  );
}

function extractRawResult(detail) {
  const data = detail?.detail || {};
  return data.result || data.report || data.procedure_order || data;
}

function ResultBody({ item, detail }) {
  const raw = extractRawResult(detail);
  if (!item) {
    return (
      <div className="review-detail-empty">
        <Eye size={26} />
        <span>Chọn một kết quả để xem clinical context, file, delivery và audit.</span>
      </div>
    );
  }
  const labItems = detail?.detail?.items || [];
  const attachments = detail?.attachments || detail?.detail?.attachments || [];
  const deliveries = detail?.deliveries || [];
  const audit = detail?.audit || [];
  return (
    <div className="review-detail-stack">
      <DetailCard title="Clinical context">
        <KeyValueGrid rows={[
          ['Bệnh nhân', getPatientName(item)],
          ['Mã BN', item.patient?.patient_code || item.patient?.code],
          ['Encounter', item.encounter?.encounter_code],
          ['Dịch vụ', item.title],
          ['Bác sĩ chỉ định', item.order?.ordered_by?.name],
          ['Chỉ định', item.order?.clinical_indication],
        ]}
        />
      </DetailCard>
      <DetailCard title="Result workspace">
        {item.type === 'lab_result' && (
          <div className="review-result-table">
            {(labItems.length ? labItems : []).slice(0, 12).map((labItem) => (
              <div className="review-result-table__row" key={getId(labItem)}>
                <strong>{labItem.item_name}</strong>
                <span>{labItem.result_value || labItem.numeric_value || '--'} {labItem.unit || ''}</span>
                <span>{labItem.reference_range || '--'}</span>
                <span className={cx('review-status', labItem.is_critical && 'critical')}>{labItem.abnormal_flag || labItem.status}</span>
              </div>
            ))}
            {!labItems.length && <p>{raw?.interpretation || raw?.notes || 'Chưa có item chi tiết trong payload trả về.'}</p>}
          </div>
        )}
        {item.type === 'imaging_report' && (
          <div className="review-report-text">
            <label>Findings</label>
            <p>{raw?.findings || '--'}</p>
            <label>Impression</label>
            <p>{raw?.impression || '--'}</p>
            <label>Recommendation</label>
            <p>{raw?.recommendation || '--'}</p>
          </div>
        )}
        {['procedure_result', 'procedure_order'].includes(item.type) && (
          <div className="review-report-text">
            <label>Technique / ghi chú</label>
            <p>{raw?.technique || raw?.result_note || '--'}</p>
            <label>Findings</label>
            <p>{raw?.findings || '--'}</p>
            <label>Conclusion</label>
            <p>{raw?.conclusion || raw?.result_note || '--'}</p>
            <label>Plan</label>
            <p>{raw?.recommendation || raw?.post_procedure_instruction || '--'}</p>
          </div>
        )}
      </DetailCard>
      <div className="review-detail-grid">
        <DetailCard title="Files">
          <div className="review-mini-list">
            {attachments.slice(0, 8).map((file) => (
              <div key={getId(file)}>
                <FileText size={15} />
                <span>{file.original_name || file.file_name}</span>
                <strong>{file.scan_status || file.review_status || '--'}</strong>
              </div>
            ))}
            {!attachments.length && <span className="review-muted">Chưa có file.</span>}
          </div>
        </DetailCard>
        <DetailCard title="Delivery log">
          <div className="review-mini-list">
            {deliveries.slice(0, 8).map((delivery) => (
              <div key={getId(delivery)}>
                <Send size={15} />
                <span>{delivery.recipient_type} · {delivery.channel}</span>
                <strong>{delivery.delivery_status}</strong>
              </div>
            ))}
            {!deliveries.length && <span className="review-muted">Chưa có delivery log.</span>}
          </div>
        </DetailCard>
      </div>
      <DetailCard title="Audit">
        <div className="review-mini-list">
          {audit.slice(0, 8).map((event) => (
            <div key={getId(event)}>
              <History size={15} />
              <span>{event.action}</span>
              <strong>{formatDateTime(event.created_at || event.event_time)}</strong>
            </div>
          ))}
          {!audit.length && <span className="review-muted">Chưa có audit trong chi tiết.</span>}
        </div>
      </DetailCard>
    </div>
  );
}

function AuditHistory({ auditRows = [], loading }) {
  if (loading && !auditRows.length) return <div className="review-empty">Đang tải audit...</div>;
  if (!auditRows.length) return <div className="review-empty">Không có audit trail phù hợp.</div>;
  return (
    <div className="review-audit-table">
      <div className="review-audit-table__head">
        <span>Time</span>
        <span>Action</span>
        <span>Target</span>
        <span>Actor</span>
        <span>Status</span>
      </div>
      {auditRows.map((row) => (
        <div className="review-audit-table__row" key={row.event_id || getId(row)}>
          <span>{formatDateTime(row.event_time || row.created_at)}</span>
          <strong>{row.action}</strong>
          <span>{TYPE_LABEL[row.result_type] || row.result_type} · {row.result_id}</span>
          <span>{row.actor?.actor_type || row.actor_type} · {row.actor?.id || row.actor_id || '--'}</span>
          <span>{row.status}</span>
        </div>
      ))}
    </div>
  );
}

export function ResultReviewPage({ pageKey = 'labPending' }) {
  const config = RESULT_REVIEW_PAGE_CONFIG[pageKey] || RESULT_REVIEW_PAGE_CONFIG.labPending;
  const [summary, setSummary] = useState({});
  const [items, setItems] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [validation, setValidation] = useState(null);
  const [filters, setFilters] = useState({ type: 'all', status: '', critical: '', search: '' });
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const queryParams = useMemo(() => {
    const params = {
      tab: config.tab,
      type: config.type || filters.type,
      search: filters.search,
      status: filters.status,
    };
    if (filters.critical === 'true') params.is_critical = true;
    if (filters.critical === 'unack') params.critical_unacknowledged = true;
    return params;
  }, [config.tab, config.type, filters]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryResponse, listResponse] = await Promise.all([
        resultReviewApi.summary(),
        config.audit
          ? resultReviewApi.auditTrail(queryParams)
          : resultReviewApi.worklist(queryParams),
      ]);
      setSummary(summaryResponse);
      if (config.audit) {
        setAuditRows(listResponse.items || []);
        setItems([]);
      } else {
        setItems(listResponse.items || []);
        if (!selected && listResponse.items?.[0]) setSelected(listResponse.items[0]);
      }
    } catch (loadError) {
      setError(getResultReviewErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [config.audit, queryParams, selected]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!selected || config.audit) {
        setDetail(null);
        return;
      }
      setDetailLoading(true);
      setValidation(null);
      try {
        const response = await resultReviewApi.detail(selected.type, getId(selected));
        if (!cancelled) setDetail(response);
      } catch (detailError) {
        if (!cancelled) setError(getResultReviewErrorMessage(detailError));
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selected, config.audit]);

  const handleAction = useCallback(async (action, item) => {
    if (!item) return;
    setError('');
    try {
      if (action === 'validate') {
        setValidation(await resultReviewApi.validateFinalize(item.type, getId(item)));
        return;
      }
      if (action === 'finalize') {
        await resultReviewApi.finalize(item.type, getId(item));
      } else if (action === 'release_doctor') {
        await resultReviewApi.releaseToDoctor(item.type, getId(item));
      } else if (action === 'release_patient') {
        await resultReviewApi.releaseToPatient(item.type, getId(item));
      } else if (action === 'doctor_ack') {
        await resultReviewApi.doctorAcknowledge(item.type, getId(item));
      } else if (action === 'ack_critical') {
        await resultReviewApi.acknowledgeCritical(item.type, getId(item));
      } else if (action === 'revoke_patient') {
        const reason = window.prompt('Lý do thu hồi release patient');
        if (!reason) return;
        await resultReviewApi.revokePatientRelease(item.type, getId(item), { reason });
      } else if (action === 'amend') {
        const reason = window.prompt('Lý do request amend');
        if (!reason) return;
        await resultReviewApi.requestAmend(item.type, getId(item), { reason, severity: item.risk?.is_critical ? 'critical' : 'minor' });
      }
      await loadData();
      if (selected) {
        const refreshed = await resultReviewApi.detail(item.type, getId(item));
        setDetail(refreshed);
      }
    } catch (actionError) {
      setError(getResultReviewErrorMessage(actionError, 'Không thể xử lý thao tác result.'));
    }
  }, [loadData, selected]);

  const selectedKey = selected ? `${selected.type}-${getId(selected)}` : '';

  return (
    <section className={cx('review-shell', `accent-${config.accent}`)}>
      <header className="review-hero">
        <div>
          <span>Duyệt & trả kết quả</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <div className="review-hero-actions">
          <button type="button" onClick={loadData}><RefreshCw size={17} /> Làm mới</button>
          <button type="button"><FileClock size={17} /> SLA</button>
          <button type="button"><History size={17} /> Audit</button>
        </div>
      </header>
      <KpiStrip summary={summary} />
      <FilterBar filters={filters} setFilters={setFilters} fixedType={config.type} onRefresh={loadData} loading={loading} />
      {error && <div className="review-error">{error}</div>}
      {config.audit ? (
        <AuditHistory auditRows={auditRows} loading={loading} />
      ) : (
        <div className="review-command-center">
          <div className="review-left-pane">
            <Worklist
              items={items}
              selectedId={selectedKey}
              onSelect={setSelected}
              onAction={handleAction}
              loading={loading}
            />
          </div>
          <main className="review-center-pane">
            {detailLoading ? <div className="review-empty">Đang tải chi tiết...</div> : <ResultBody item={selected} detail={detail} />}
          </main>
          <RiskPanel item={selected} validation={validation} onAction={handleAction} />
        </div>
      )}
    </section>
  );
}
