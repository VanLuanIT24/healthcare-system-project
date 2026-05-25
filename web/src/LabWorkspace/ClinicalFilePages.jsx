import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileCheck2,
  FileText,
  History,
  Image as ImageIcon,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  Trash2,
  Undo2,
  UploadCloud,
} from 'lucide-react';
import { downloadClinicalOpsJson, promptClinicalOpsText } from '../ClinicalOpsWorkspace/clinicalOpsActions';
import { clinicalFilesApi, getClinicalFilesErrorMessage } from './clinicalFilesApi';

const MODULE_LABEL = {
  lab: 'Lab',
  imaging: 'CĐHA',
  procedure: 'Thủ thuật',
  medical_record: 'Hồ sơ',
  other: 'Khác',
};

const SCAN_LABEL = {
  pending: 'Pending',
  clean: 'Clean',
  infected: 'Infected',
  failed: 'Failed',
  skipped: 'Skipped',
};

const REVIEW_LABEL = {
  pending: 'Chờ review',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export const CLINICAL_FILE_PAGE_CONFIG = {
  imaging: {
    title: 'File imaging',
    subtitle: 'Quản lý DICOM/PACS, file ảnh, report PDF, contrast consent và tài liệu release của CĐHA.',
    module: 'imaging',
    source: 'files',
    accent: 'blue',
  },
  procedure: {
    title: 'File thủ thuật',
    subtitle: 'Quản lý consent, checklist, biên bản, ảnh/media thủ thuật và file hậu thủ thuật.',
    module: 'procedure',
    source: 'files',
    accent: 'violet',
  },
  lab: {
    title: 'File xét nghiệm',
    subtitle: 'Quản lý PDF kết quả, file máy xét nghiệm, external lab và file critical/amend.',
    module: 'lab',
    source: 'files',
    accent: 'green',
  },
  missing: {
    title: 'File thiếu',
    subtitle: 'Theo dõi nghĩa vụ tài liệu còn thiếu theo rule, SLA, module, severity và responsible role.',
    source: 'missing',
    accent: 'amber',
  },
  scanErrors: {
    title: 'File lỗi scan',
    subtitle: 'Điều phối pending scan quá lâu, scan failed, infected, skipped và quarantine.',
    source: 'scanErrors',
    accent: 'red',
  },
  review: {
    title: 'File chờ review',
    subtitle: 'Duyệt file patient upload, external import và tài liệu cần xác nhận trước khi dùng trong hồ sơ.',
    source: 'review',
    accent: 'teal',
  },
  released: {
    title: 'File đã release',
    subtitle: 'Theo dõi file đã trả patient portal, download count, visibility và thu hồi release khi cần.',
    source: 'released',
    accent: 'indigo',
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

function formatSize(value) {
  const size = Number(value || 0);
  if (!size) return '--';
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function getId(row) {
  return row?.id || row?._id;
}

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function FileKpis({ summary = {} }) {
  const cards = [
    ['Tổng file', summary.total_files || 0, FileText],
    ['File hôm nay', summary.files_today || 0, UploadCloud],
    ['Pending scan', summary.pending_scan || 0, RefreshCw],
    ['Lỗi scan', summary.scan_errors || 0, ShieldAlert],
    ['Chờ review', summary.pending_review || 0, ClipboardCheck],
    ['Đã release', summary.released_to_patient || 0, FileCheck2],
    ['File thiếu', summary.missing_files || 0, AlertTriangle],
    ['Download hôm nay', summary.downloads_today || 0, Download],
  ];
  return (
    <div className="clinical-file-kpis">
      {cards.map(([label, value, Icon]) => (
        <div className="clinical-file-kpi" key={label}>
          <Icon size={18} />
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function FileFilterBar({ filters, setFilters, fixedModule, onRefresh, loading }) {
  return (
    <div className="clinical-file-filters">
      <label>
        <span>Module</span>
        <select
          value={fixedModule || filters.module}
          disabled={Boolean(fixedModule)}
          onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value }))}
        >
          <option value="all">Tất cả</option>
          <option value="lab">Lab</option>
          <option value="imaging">CĐHA</option>
          <option value="procedure">Thủ thuật</option>
          <option value="medical_record">Hồ sơ</option>
        </select>
      </label>
      <label>
        <span>Scan</span>
        <select value={filters.scan_status} onChange={(event) => setFilters((current) => ({ ...current, scan_status: event.target.value }))}>
          <option value="">Tất cả</option>
          <option value="pending">Pending</option>
          <option value="clean">Clean</option>
          <option value="infected">Infected</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </label>
      <label>
        <span>Review</span>
        <select value={filters.review_status} onChange={(event) => setFilters((current) => ({ ...current, review_status: event.target.value }))}>
          <option value="">Tất cả</option>
          <option value="pending">Chờ review</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      <label>
        <span>Release</span>
        <select value={filters.released_to_patient} onChange={(event) => setFilters((current) => ({ ...current, released_to_patient: event.target.value }))}>
          <option value="">Tất cả</option>
          <option value="true">Đã release</option>
          <option value="false">Chưa release</option>
        </select>
      </label>
      <label className="clinical-file-search">
        <span>Tìm kiếm</span>
        <Search size={16} />
        <input
          value={filters.q}
          placeholder="Tên file, category, mime..."
          onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
        />
      </label>
      <button type="button" className="clinical-file-icon-btn" onClick={onRefresh} disabled={loading} title="Làm mới">
        <RefreshCw size={17} className={loading ? 'clinical-file-spin' : ''} />
      </button>
    </div>
  );
}

function Badge({ tone = 'default', children }) {
  return <span className={cx('clinical-file-badge', tone)}>{children}</span>;
}

function FileTable({ items, selected, onSelect, onAction, loading }) {
  if (loading && !items.length) return <div className="clinical-file-empty">Đang tải danh sách file...</div>;
  if (!items.length) return <div className="clinical-file-empty">Không có file phù hợp.</div>;
  return (
    <div className="clinical-file-table">
      <div className="clinical-file-table__head">
        <span>File</span>
        <span>Bệnh nhân</span>
        <span>Entity</span>
        <span>Scan</span>
        <span>Review</span>
        <span>Release</span>
        <span>Uploaded</span>
        <span>Actions</span>
      </div>
      {items.map((item) => (
        <button
          type="button"
          className={cx('clinical-file-row', selected && getId(selected) === getId(item) && 'is-selected')}
          key={getId(item)}
          onClick={() => onSelect(item)}
        >
          <span className="clinical-file-main-cell">
            <span className="clinical-file-preview-mark">
              {String(item.mimeType || item.mime_type || '').startsWith('image/') ? <ImageIcon size={18} /> : <FileText size={18} />}
            </span>
            <span>
              <strong>{item.originalName || item.original_name || item.fileName || item.file_name}</strong>
              <small>{item.category || '--'} · {formatSize(item.fileSize || item.file_size)}</small>
            </span>
          </span>
          <span>
            <strong>{item.patient?.full_name || '--'}</strong>
            <small>{item.patient?.patient_code || item.patient?.code || '--'}</small>
          </span>
          <span>
            <Badge tone={item.module}>{MODULE_LABEL[item.module] || item.module}</Badge>
            <small>{item.entity?.code || item.entity?.title || item.entity?.type || '--'}</small>
          </span>
          <span><Badge tone={item.scanStatus || item.scan_status}>{SCAN_LABEL[item.scanStatus || item.scan_status] || '--'}</Badge></span>
          <span><Badge tone={item.reviewStatus || item.review_status}>{REVIEW_LABEL[item.reviewStatus || item.review_status] || '--'}</Badge></span>
          <span><Badge tone={item.releasedToPatient || item.released_to_patient ? 'released' : 'unreleased'}>{item.releasedToPatient || item.released_to_patient ? 'Đã release' : 'Chưa release'}</Badge></span>
          <span>
            <strong>{item.uploaded_by?.name || item.uploaded_by?.full_name || '--'}</strong>
            <small>{formatDateTime(item.createdAt || item.created_at)}</small>
          </span>
          <span className="clinical-file-row-actions" onClick={(event) => event.stopPropagation()}>
            <button type="button" title="Preview" onClick={() => onSelect(item)}><Eye size={15} /></button>
            <button type="button" title="Release" onClick={() => onAction('release', item)}><Send size={15} /></button>
            <button type="button" title="Review" onClick={() => onAction('review_accept', item)}><CheckCircle2 size={15} /></button>
            <button type="button" title="Rescan" onClick={() => onAction('rescan', item)}><RefreshCw size={15} /></button>
          </span>
        </button>
      ))}
    </div>
  );
}

function MissingTable({ items, loading, onAction }) {
  if (loading && !items.length) return <div className="clinical-file-empty">Đang tải file thiếu...</div>;
  if (!items.length) return <div className="clinical-file-empty">Không có nghĩa vụ tài liệu còn thiếu.</div>;
  return (
    <div className="clinical-file-table missing">
      <div className="clinical-file-table__head">
        <span>Severity</span>
        <span>Required file</span>
        <span>Module</span>
        <span>Entity</span>
        <span>Due</span>
        <span>Responsible</span>
        <span>Status</span>
        <span>Actions</span>
      </div>
      {items.map((item) => (
        <div className="clinical-file-row missing" key={getId(item)}>
          <span><Badge tone={item.severity}>{item.severity}</Badge></span>
          <span>
            <strong>{item.expected_file_label || item.required_category}</strong>
            <small>{item.required_category}</small>
          </span>
          <span><Badge tone={item.module}>{MODULE_LABEL[item.module] || item.module}</Badge></span>
          <span>
            <strong>{item.entity_code || '--'}</strong>
            <small>{item.entity_title || item.entity_type}</small>
          </span>
          <span>{formatDateTime(item.due_at)}</span>
          <span>{item.responsible_role || item.assigned_to?.full_name || '--'}</span>
          <span><Badge tone={item.status}>{item.status}</Badge></span>
          <span className="clinical-file-row-actions">
            <button type="button" title="Waive" onClick={() => onAction('waive_missing', item)}><Undo2 size={15} /></button>
            <button type="button" title="Resolve" onClick={() => onAction('resolve_missing', item)}><CheckCircle2 size={15} /></button>
          </span>
        </div>
      ))}
    </div>
  );
}

function DetailPanel({ item, detail, onAction }) {
  if (!item) {
    return (
      <aside className="clinical-file-detail empty">
        <Eye size={28} />
        <span>Chọn một file để xem preview, metadata, entity link, audit và access log.</span>
      </aside>
    );
  }
  const file = detail?.file || item;
  const audit = detail?.audit || [];
  const accessLogs = detail?.access_logs || [];
  return (
    <aside className="clinical-file-detail">
      <div className="clinical-file-preview-box">
        {file.thumbnailUrl || file.thumbnail_url || file.previewUrl || file.preview_url ? (
          <img src={file.thumbnailUrl || file.thumbnail_url || file.previewUrl || file.preview_url} alt="" />
        ) : (
          <FileText size={44} />
        )}
      </div>
      <div className="clinical-file-detail-title">
        <strong>{file.originalName || file.original_name || file.fileName || file.file_name}</strong>
        <span>{file.mimeType || file.mime_type || '--'} · {formatSize(file.fileSize || file.file_size)}</span>
      </div>
      <div className="clinical-file-action-grid">
        <button type="button" onClick={() => onAction('release', file)}><Send size={16} /> Release</button>
        <button type="button" onClick={() => onAction('revoke', file)}><Undo2 size={16} /> Revoke</button>
        <button type="button" onClick={() => onAction('review_accept', file)}><ClipboardCheck size={16} /> Approve</button>
        <button type="button" onClick={() => onAction('review_reject', file)}><AlertTriangle size={16} /> Reject</button>
        <button type="button" onClick={() => onAction('rescan', file)}><RefreshCw size={16} /> Rescan</button>
        <button type="button" onClick={() => onAction('quarantine', file)}><ShieldAlert size={16} /> Quarantine</button>
        <button type="button" onClick={() => onAction('archive', file)}><Archive size={16} /> Archive</button>
        <button type="button" onClick={() => onAction('delete', file)}><Trash2 size={16} /> Delete</button>
      </div>
      <section>
        <h3>Metadata</h3>
        <div className="clinical-file-kv">
          <span>Module</span><strong>{MODULE_LABEL[file.module] || file.module}</strong>
          <span>Entity</span><strong>{file.entity?.code || file.entity?.title || file.entity?.type || '--'}</strong>
          <span>Category</span><strong>{file.category || '--'}</strong>
          <span>Source</span><strong>{file.source || '--'}</strong>
          <span>Visibility</span><strong>{file.visibility || '--'}</strong>
          <span>Token version</span><strong>{file.signed_download_token_version || '--'}</strong>
        </div>
      </section>
      <section>
        <h3>Scan & review</h3>
        <div className="clinical-file-kv">
          <span>Scan</span><strong>{SCAN_LABEL[file.scanStatus || file.scan_status] || '--'}</strong>
          <span>Review</span><strong>{REVIEW_LABEL[file.reviewStatus || file.review_status] || '--'}</strong>
          <span>Reviewed by</span><strong>{file.reviewed_by?.name || file.reviewed_by?.full_name || '--'}</strong>
          <span>Note</span><strong>{file.review_note || '--'}</strong>
        </div>
      </section>
      <section>
        <h3>Access log</h3>
        <div className="clinical-file-mini-list">
          {accessLogs.slice(0, 5).map((log) => (
            <div key={getId(log)}>
              <History size={14} />
              <span>{log.action} · {log.result}</span>
              <strong>{formatDateTime(log.occurred_at)}</strong>
            </div>
          ))}
          {!accessLogs.length && <span className="clinical-file-muted">Chưa có access log.</span>}
        </div>
      </section>
      <section>
        <h3>Audit</h3>
        <div className="clinical-file-mini-list">
          {audit.slice(0, 5).map((event) => (
            <div key={getId(event)}>
              <History size={14} />
              <span>{event.action}</span>
              <strong>{formatDateTime(event.created_at)}</strong>
            </div>
          ))}
          {!audit.length && <span className="clinical-file-muted">Chưa có audit.</span>}
        </div>
      </section>
    </aside>
  );
}

export function ClinicalFilePage({ pageKey = 'imaging' }) {
  const config = CLINICAL_FILE_PAGE_CONFIG[pageKey] || CLINICAL_FILE_PAGE_CONFIG.imaging;
  const [summary, setSummary] = useState({});
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    module: 'all',
    scan_status: '',
    review_status: '',
    released_to_patient: '',
    q: '',
  });

  const query = useMemo(() => ({
    module: config.module || filters.module,
    scan_status: filters.scan_status,
    review_status: filters.review_status,
    released_to_patient: filters.released_to_patient,
    q: filters.q,
    live: config.source === 'missing' ? 'true' : undefined,
  }), [config.module, config.source, filters]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const listCall = (() => {
        if (config.source === 'missing') return clinicalFilesApi.missing(query);
        if (config.source === 'scanErrors') return clinicalFilesApi.scanErrors(query);
        if (config.source === 'review') return clinicalFilesApi.reviewQueue(query);
        if (config.source === 'released') return clinicalFilesApi.released(query);
        return clinicalFilesApi.list(query);
      })();
      const [summaryResponse, listResponse] = await Promise.all([
        clinicalFilesApi.summary(config.module ? { module: config.module } : {}),
        listCall,
      ]);
      setSummary(summaryResponse);
      setItems(listResponse.items || []);
      if (!selected && listResponse.items?.[0] && config.source !== 'missing') setSelected(listResponse.items[0]);
    } catch (loadError) {
      setError(getClinicalFilesErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [config.module, config.source, query, selected]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!selected || config.source === 'missing') {
        setDetail(null);
        return;
      }
      setDetailLoading(true);
      try {
        const response = await clinicalFilesApi.detail(getId(selected));
        if (!cancelled) setDetail(response);
      } catch (detailError) {
        if (!cancelled) setError(getClinicalFilesErrorMessage(detailError));
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [selected, config.source]);

  const handleAction = useCallback(async (action, item) => {
    if (!item) return;
    setError('');
    try {
      if (action === 'release') await clinicalFilesApi.release(getId(item));
      if (action === 'revoke') {
        const reason = promptClinicalOpsText({ title: 'Thu hồi release file', message: 'Lý do thu hồi release' });
        if (!reason) return;
        await clinicalFilesApi.revokeRelease(getId(item), { reason });
      }
      if (action === 'review_accept') await clinicalFilesApi.review(getId(item), { decision: 'accepted', review_note: 'Accepted from file workspace' });
      if (action === 'review_reject') {
        const reason = promptClinicalOpsText({ title: 'Reject file', message: 'Lý do reject file' });
        if (!reason) return;
        await clinicalFilesApi.review(getId(item), { decision: 'rejected', reason });
      }
      if (action === 'rescan') await clinicalFilesApi.rescan(getId(item), { reason: 'manual_rescan' });
      if (action === 'quarantine') {
        const reason = promptClinicalOpsText({ title: 'Quarantine file', message: 'Lý do quarantine file' });
        if (!reason) return;
        await clinicalFilesApi.quarantine(getId(item), { reason });
      }
      if (action === 'archive') await clinicalFilesApi.archive(getId(item), { reason: 'workspace_archive' });
      if (action === 'delete') {
        const reason = promptClinicalOpsText({ title: 'Xóa mềm file', message: 'Lý do xóa mềm file' });
        if (!reason) return;
        await clinicalFilesApi.delete(getId(item), { reason });
      }
      if (action === 'waive_missing') {
        const reason = promptClinicalOpsText({ title: 'Waive file thiếu', message: 'Lý do waive file thiếu' });
        if (!reason) return;
        await clinicalFilesApi.waiveMissing(getId(item), { reason });
      }
      if (action === 'resolve_missing') await clinicalFilesApi.resolveMissing(getId(item), {});
      await loadData();
      if (selected && config.source !== 'missing') setDetail(await clinicalFilesApi.detail(getId(selected)));
    } catch (actionError) {
      setError(getClinicalFilesErrorMessage(actionError, 'Không thể xử lý thao tác file.'));
    }
  }, [config.source, loadData, selected]);

  const recomputeMissing = useCallback(async () => {
    try {
      await clinicalFilesApi.recomputeMissing(config.module ? { module: config.module } : {});
      await loadData();
    } catch (err) {
      setError(getClinicalFilesErrorMessage(err, 'Không thể recompute file thiếu.'));
    }
  }, [config.module, loadData]);

  return (
    <section className={cx('clinical-file-shell', `accent-${config.accent}`)}>
      <header className="clinical-file-hero">
        <div>
          <span>File & tài liệu kết quả</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <div className="clinical-file-hero-actions">
          <button type="button" onClick={loadData}><RefreshCw size={17} /> Làm mới</button>
          {config.source === 'missing' && <button type="button" onClick={recomputeMissing}><AlertTriangle size={17} /> Recompute</button>}
          <button type="button" onClick={() => downloadClinicalOpsJson(`clinical-files-${pageKey}.json`, { filters, items, summary }, 'Xuất file cận lâm sàng')}><Download size={17} /> Export</button>
        </div>
      </header>
      <FileKpis summary={summary} />
      <FileFilterBar filters={filters} setFilters={setFilters} fixedModule={config.module} onRefresh={loadData} loading={loading} />
      {error && <div className="clinical-file-error">{error}</div>}
      <div className={cx('clinical-file-workspace', config.source === 'missing' && 'missing-mode')}>
        <main className="clinical-file-list-pane">
          {config.source === 'missing' ? (
            <MissingTable items={items} loading={loading} onAction={handleAction} />
          ) : (
            <FileTable items={items} selected={selected} onSelect={setSelected} onAction={handleAction} loading={loading} />
          )}
        </main>
        {config.source !== 'missing' && (
          detailLoading ? <aside className="clinical-file-detail empty">Đang tải chi tiết...</aside> : <DetailPanel item={selected} detail={detail} onAction={handleAction} />
        )}
      </div>
    </section>
  );
}
