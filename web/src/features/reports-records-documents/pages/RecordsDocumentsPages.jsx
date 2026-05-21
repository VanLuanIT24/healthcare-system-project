import { useState } from 'react';
import {
  AttachmentStatusDonut,
  AttachmentTable,
  DataErrorStrip,
  DocumentExportTable,
  DocumentSourceChart,
  DocumentTimeline,
  FileSizeChart,
  MedicalRecordTable,
  MissingDocumentTable,
  RecordsDocumentsDetailDrawer,
  RecordsDocumentsFilterBar,
  RecordsDocumentsKpiGrid,
  RecordsInsightCard,
  RecordsStatusDonut,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  ReviewStatusDonut,
  ScanStatusDonut,
  TrendChart,
  recordsDocumentsCards,
} from '../components/RecordsDocumentsComponents';
import {
  useAttachmentReport,
  useDocumentTimelineReport,
  useFinalizedRecordsReport,
  useMedicalRecordsReport,
  useRecordExportReport,
  useReleasedRecordsReport,
  useVoidArchiveRecordsReport,
} from '../hooks/useRecordsDocumentsReports';
import { rdLabel } from '../utils/recordsDocumentsFormatters';
import '../styles/reportsRecordsDocuments.css';

function chartRows(rows = [], keys = ['label', 'status', 'record_type', 'department_name', 'date', 'category', 'source', 'entity_type', 'mime_type', 'bucket']) {
  return (rows || []).map((row) => {
    const key = keys.find((item) => row?.[item] !== undefined && row?.[item] !== null);
    const label = rdLabel(row.label || row[key] || 'Chưa rõ');
    return { ...row, status: row.status ? rdLabel(row.status) : row.status, label, value: row.value ?? row.count ?? row.total_size };
  });
}

function TodoPanel({ todos = [] }) {
  if (!todos.length) return null;
  return (
    <ReportSectionCard title="Backend TODO analytics">
      <ul className="rd-todo-list">{todos.map((todo) => <li key={todo}>{todo}</li>)}</ul>
    </ReportSectionCard>
  );
}

function PageFrame({ query, title, subtitle, children }) {
  const [drawer, setDrawer] = useState(null);
  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <ReportErrorState error={query.error} onRetry={query.refresh} />;
  return (
    <div className="executive-overview-page operation-page finance-page rd-page">
      <RecordsDocumentsFilterBar
        title={title}
        subtitle={subtitle}
        filters={query.filters}
        onChange={query.setFilters}
        onReset={query.resetFilters}
        onRefresh={query.refresh}
        isRefreshing={query.isRefreshing}
        lastUpdatedAt={query.lastUpdatedAt || query.data?.generated_at}
      />
      <DataErrorStrip errors={query.data?.data_errors} />
      {children(query.data || {}, (item, type = title) => setDrawer({ item, type }), query)}
      <RecordsDocumentsDetailDrawer item={drawer?.item} type={drawer?.type || title} onClose={() => setDrawer(null)} />
    </div>
  );
}

function StandardRecordPage({ query, title, subtitle, labels, tableTitle, table, children }) {
  return (
    <PageFrame query={query} title={title} subtitle={subtitle}>
      {(data, open, currentQuery) => (
        <>
          <RecordsDocumentsKpiGrid cards={recordsDocumentsCards(data.summary || {}, labels)} onOpen={open} />
          {children?.(data, open, currentQuery)}
          <ReportSectionCard title={tableTitle}>
            {table(data, open, currentQuery)}
          </ReportSectionCard>
          <TodoPanel todos={data.backend_todo || []} />
        </>
      )}
    </PageFrame>
  );
}

export function MedicalRecordsPage() {
  const query = useMedicalRecordsReport();
  return (
    <StandardRecordPage
      query={query}
      title="Hồ sơ bệnh án"
      subtitle="Theo dõi hồ sơ bệnh án, trạng thái xử lý, tài liệu đính kèm, missing document và release cho người bệnh"
      labels={{
        total_records: 'Tổng hồ sơ',
        active_records: 'Active',
        draft_records: 'Nháp',
        finalized_records: 'Finalized',
        sealed_records: 'Sealed',
        archived_records: 'Archived',
        voided_records: 'Voided',
        released_records: 'Đã release',
        unreleased_records: 'Chưa release',
        records_with_attachments: 'Có attachment',
        records_with_missing_documents: 'Thiếu tài liệu',
        opened_in_period: 'Mở trong kỳ',
      }}
      tableTitle="Danh sách hồ sơ bệnh án"
      table={(data, open, currentQuery) => <MedicalRecordTable rows={data.items || []} pagination={data.pagination} onPageChange={(page) => currentQuery.setFilters({ page })} onOpen={(item) => open(item, 'Hồ sơ bệnh án')} />}
    >
      {(data, open) => (
        <>
          <div className="rd-chart-grid">
            <ReportSectionCard title="Theo trạng thái"><RecordsStatusDonut rows={data.charts?.by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Theo loại hồ sơ"><TrendChart data={chartRows(data.charts?.by_record_type)} type="bar" /></ReportSectionCard>
            <ReportSectionCard title="Theo khoa"><TrendChart data={chartRows(data.charts?.by_department)} type="bar" /></ReportSectionCard>
            <ReportSectionCard title="Mở hồ sơ theo ngày"><TrendChart data={chartRows(data.charts?.opened_by_day)} series={[{ key: 'value', label: 'Hồ sơ' }]} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Missing document">
            <MissingDocumentTable rows={data.missing_documents || []} onOpen={(item) => open(item, 'Missing document')} />
          </ReportSectionCard>
        </>
      )}
    </StandardRecordPage>
  );
}

export function FinalizedRecordsPage() {
  const query = useFinalizedRecordsReport();
  return (
    <StandardRecordPage
      query={query}
      title="Hồ sơ đã finalize"
      subtitle="Kiểm soát hồ sơ đã finalize/seal, thời gian finalize, hồ sơ chưa release và hồ sơ còn thiếu attachment"
      labels={{
        total_finalized_records: 'Tổng finalized',
        finalized_today: 'Finalize hôm nay',
        finalized_this_week: 'Finalize tuần này',
        sealed_records: 'Sealed',
        finalized_not_released: 'Chưa release',
        finalized_with_missing_attachments: 'Thiếu attachment',
        average_time_to_finalize_hours: 'Avg giờ finalize',
      }}
      tableTitle="Hồ sơ finalized / sealed"
      table={(data, open, currentQuery) => <MedicalRecordTable rows={data.items || []} pagination={data.pagination} onPageChange={(page) => currentQuery.setFilters({ page })} onOpen={(item) => open(item, 'Hồ sơ finalized')} />}
    >
      {(data) => (
        <div className="rd-chart-grid">
          <ReportSectionCard title="Finalize theo ngày"><TrendChart data={chartRows(data.charts?.finalized_by_day)} series={[{ key: 'value', label: 'Finalized' }]} /></ReportSectionCard>
          <ReportSectionCard title="Theo khoa"><TrendChart data={chartRows(data.charts?.by_department)} type="bar" /></ReportSectionCard>
          <ReportSectionCard title="Theo loại hồ sơ"><TrendChart data={chartRows(data.charts?.by_record_type)} type="bar" /></ReportSectionCard>
          <ReportSectionCard title="Finalize vs sealed"><RecordsStatusDonut rows={data.charts?.finalized_vs_sealed || []} /></ReportSectionCard>
        </div>
      )}
    </StandardRecordPage>
  );
}

export function ReleasedRecordsPage() {
  const query = useReleasedRecordsReport();
  return (
    <StandardRecordPage
      query={query}
      title="Hồ sơ đã release"
      subtitle="Theo dõi hồ sơ và attachment đã phát hành cho người bệnh, visibility, revoke và download/access log"
      labels={{
        released_records: 'Record released',
        released_attachments: 'Attachment released',
        released_today: 'Release hôm nay',
        released_this_week: 'Release tuần này',
        revoked_attachments: 'Revoked',
        patient_visible_documents: 'Patient visible',
        shared_with_relative: 'Share người thân',
        downloads_after_release: 'Download/access',
        finalized_not_released: 'Finalized chưa release',
      }}
      tableTitle="Ledger release record / attachment"
      table={(data, open, currentQuery) => <AttachmentTable rows={data.items || []} pagination={data.pagination} onPageChange={(page) => currentQuery.setFilters({ page })} onOpen={(item) => open(item, 'Release detail')} />}
    >
      {(data) => (
        <div className="rd-chart-grid">
          <ReportSectionCard title="Release theo ngày"><TrendChart data={chartRows(data.charts?.released_by_day)} series={[{ key: 'value', label: 'Release' }]} /></ReportSectionCard>
          <ReportSectionCard title="Theo khoa"><TrendChart data={chartRows(data.charts?.by_department)} type="bar" /></ReportSectionCard>
          <ReportSectionCard title="Visibility"><TrendChart data={chartRows(data.charts?.visibility_breakdown)} type="donut" /></ReportSectionCard>
          <ReportSectionCard title="Download trend"><TrendChart data={chartRows(data.charts?.download_trend)} series={[{ key: 'value', label: 'Download' }]} /></ReportSectionCard>
        </div>
      )}
    </StandardRecordPage>
  );
}

export function VoidArchivePage() {
  const query = useVoidArchiveRecordsReport();
  return (
    <StandardRecordPage
      query={query}
      title="Hồ sơ void / archive"
      subtitle="Ledger thống nhất cho hồ sơ void/archive và attachment archive/delete/restore, kèm dấu hiệu rủi ro audit"
      labels={{
        voided_records: 'Voided records',
        archived_records: 'Archived records',
        archived_attachments: 'Archived attachments',
        deleted_attachments: 'Deleted attachments',
        restored_attachments: 'Restored',
        void_today: 'Void hôm nay',
        archive_today: 'Archive hôm nay',
        void_reason_missing: 'Thiếu lý do void',
        archive_reason_missing: 'Thiếu lý do archive',
      }}
      tableTitle="Void / archive ledger"
      table={(data, open, currentQuery) => <MedicalRecordTable rows={data.items || []} pagination={data.pagination} onPageChange={(page) => currentQuery.setFilters({ page })} onOpen={(item) => open(item, 'Void/archive detail')} />}
    >
      {(data) => (
        <>
          <div className="rd-chart-grid">
            <ReportSectionCard title="Void/archive theo ngày"><TrendChart data={chartRows(data.charts?.by_day)} series={[{ key: 'value', label: 'Events' }]} /></ReportSectionCard>
            <ReportSectionCard title="Theo khoa"><TrendChart data={chartRows(data.charts?.by_department)} type="bar" /></ReportSectionCard>
            <ReportSectionCard title="Reason void"><TrendChart data={chartRows(data.charts?.void_reason_breakdown)} type="bar" /></ReportSectionCard>
            <ReportSectionCard title="Reason archive"><TrendChart data={chartRows(data.charts?.archive_reason_breakdown)} type="bar" /></ReportSectionCard>
          </div>
          <RecordsInsightCard title="Risk panel">
            <ul>{(data.risk_items || []).map((item) => <li key={item.id || item.title}>{item.title || item.message || JSON.stringify(item)}</li>)}</ul>
          </RecordsInsightCard>
        </>
      )}
    </StandardRecordPage>
  );
}

export function AttachmentsPage() {
  const query = useAttachmentReport();
  return (
    <StandardRecordPage
      query={query}
      title="Attachment report"
      subtitle="Quản trị tệp đính kèm, scan queue, scan lỗi, review queue, missing document, release và access logs"
      labels={{
        total_attachments: 'Tổng attachment',
        active_attachments: 'Active',
        archived_attachments: 'Archived',
        deleted_attachments: 'Deleted',
        quarantined_attachments: 'Quarantined',
        review_pending: 'Review pending',
        review_accepted: 'Review accepted',
        review_rejected: 'Review rejected',
        scan_pending: 'Scan pending',
        scan_clean: 'Scan clean',
        scan_infected: 'Scan infected',
        scan_failed: 'Scan failed',
        released_to_patient: 'Released',
        missing_document_tasks: 'Missing tasks',
        total_storage_size: 'Dung lượng',
      }}
      tableTitle="Danh sách attachment"
      table={(data, open, currentQuery) => <AttachmentTable rows={data.items || []} pagination={data.pagination} onPageChange={(page) => currentQuery.setFilters({ page })} onOpen={(item) => open(item, 'Attachment detail')} />}
    >
      {(data, open) => (
        <>
          <div className="rd-chart-grid">
            <ReportSectionCard title="Attachment status"><AttachmentStatusDonut rows={data.charts?.by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Review status"><ReviewStatusDonut rows={data.charts?.by_review_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Scan status"><ScanStatusDonut rows={data.charts?.by_scan_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Nguồn tài liệu"><DocumentSourceChart rows={data.charts?.by_source || []} /></ReportSectionCard>
            <ReportSectionCard title="Entity type"><TrendChart data={chartRows(data.charts?.by_entity_type)} type="bar" /></ReportSectionCard>
            <ReportSectionCard title="Category"><TrendChart data={chartRows(data.charts?.by_category)} type="bar" /></ReportSectionCard>
            <ReportSectionCard title="MIME type"><TrendChart data={chartRows(data.charts?.by_mime_type)} type="bar" /></ReportSectionCard>
            <ReportSectionCard title="File size bucket"><FileSizeChart rows={data.charts?.file_size_buckets || []} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Missing document panel">
            <MissingDocumentTable rows={data.missing_documents || []} onOpen={(item) => open(item, 'Missing document')} />
          </ReportSectionCard>
        </>
      )}
    </StandardRecordPage>
  );
}

export function RecordExportsPage() {
  const query = useRecordExportReport();
  return (
    <StandardRecordPage
      query={query}
      title="Export hồ sơ"
      subtitle="Theo dõi export hồ sơ, export ZIP, trạng thái xử lý, file sẵn sàng tải, lỗi và hết hạn"
      labels={{
        total_exports: 'Tổng export',
        pending_exports: 'Pending',
        processing_exports: 'Processing',
        ready_exports: 'Ready',
        failed_exports: 'Failed',
        expired_exports: 'Expired',
        downloads: 'Downloads',
        exports_today: 'Hôm nay',
        failed_export_rate: 'Tỷ lệ lỗi',
      }}
      tableTitle="Document export requests"
      table={(data, open, currentQuery) => <DocumentExportTable rows={data.items || []} pagination={data.pagination} onPageChange={(page) => currentQuery.setFilters({ page })} onOpen={(item) => open(item, 'Export detail')} />}
    >
      {(data) => (
        <>
          <div className="rd-chart-grid">
            <ReportSectionCard title="Export status"><RecordsStatusDonut rows={data.charts?.by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Export type"><TrendChart data={chartRows(data.charts?.by_export_type)} type="bar" /></ReportSectionCard>
            <ReportSectionCard title="Export theo ngày"><TrendChart data={chartRows(data.charts?.by_day)} series={[{ key: 'value', label: 'Export' }]} /></ReportSectionCard>
            <ReportSectionCard title="Processing bucket"><TrendChart data={chartRows(data.charts?.processing_buckets)} type="bar" /></ReportSectionCard>
          </div>
          <RecordsInsightCard title="Export command center">
            <div className="rd-command-list">
              {['Export medical record package', 'Export attachments ZIP', 'Export selected attachments', 'Export patient document package', 'Export audit trail'].map((item) => <span key={item}>{item}</span>)}
            </div>
          </RecordsInsightCard>
        </>
      )}
    </StandardRecordPage>
  );
}

export function DocumentTimelinePage() {
  const query = useDocumentTimelineReport();
  return (
    <StandardRecordPage
      query={query}
      title="Document timeline report"
      subtitle="Dòng thời gian toàn hệ thống cho hồ sơ, attachment, release, archive, download và audit tài liệu"
      labels={{
        total_timeline_events: 'Tổng events',
        medical_record_events: 'Record events',
        attachment_events: 'Attachment events',
        lab_result_events: 'Lab events',
        imaging_report_events: 'Imaging events',
        procedure_result_events: 'Procedure events',
        upload_events: 'Upload',
        release_events: 'Release',
        download_events: 'Download',
        archive_void_events: 'Archive/Void',
        missing_document_events: 'Missing document',
      }}
      tableTitle="Timeline events"
      table={(data, open, currentQuery) => <DocumentTimeline rows={data.items || []} pagination={data.pagination} onPageChange={(page) => currentQuery.setFilters({ page })} onOpen={(item) => open(item, 'Timeline event')} />}
    >
      {(data) => (
        <>
          <div className="rd-chart-grid">
            <ReportSectionCard title="Events theo ngày"><TrendChart data={chartRows(data.charts?.by_day)} series={[{ key: 'value', label: 'Events' }]} /></ReportSectionCard>
            <ReportSectionCard title="Theo module"><TrendChart data={chartRows(data.charts?.by_module)} type="bar" /></ReportSectionCard>
            <ReportSectionCard title="Theo action"><TrendChart data={chartRows(data.charts?.by_action)} type="bar" /></ReportSectionCard>
            <ReportSectionCard title="Theo actor"><TrendChart data={chartRows(data.charts?.by_actor)} type="bar" /></ReportSectionCard>
            <ReportSectionCard title="Theo entity"><TrendChart data={chartRows(data.charts?.by_entity_type)} type="bar" /></ReportSectionCard>
            <ReportSectionCard title="Release/download trend"><TrendChart data={chartRows(data.charts?.release_download_trend)} series={[{ key: 'release_count', label: 'Release' }, { key: 'download_count', label: 'Download' }]} /></ReportSectionCard>
          </div>
          {!(data.items || []).length ? <ReportEmptyState title="Chưa có timeline toàn hệ thống" description="Có thể cần bổ sung API timeline report tổng hợp nếu chỉ có timeline theo patient." /> : null}
        </>
      )}
    </StandardRecordPage>
  );
}
