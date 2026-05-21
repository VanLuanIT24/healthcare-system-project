import { useState } from 'react';
import {
  AlertSeverityDonut,
  BreakGlassTable,
  BreakGlassTimeline,
  ComplaintRatingPanel,
  CriticalAlertBoard,
  CriticalAlertTable,
  DataErrorStrip,
  JobFailureTable,
  NotificationDeliveryTable,
  NotificationFailurePanel,
  QualityRiskDetailDrawer,
  QualityRiskFilterBar,
  QualityRiskKpiGrid,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  RiskCommandCenter,
  RiskHeatmap,
  RiskInsightCard,
  SecurityAuditTable,
  SensitiveAccessTable,
  SlaBreachTable,
  SlaComplianceChart,
  SupportTicketBoard,
  SupportTicketTable,
  TrendChart,
  qualityRiskCards,
} from '../components/QualityRiskComponents';
import {
  useBreakGlassReport,
  useComplaintsRatingsReport,
  useCriticalAlertsReport,
  useJobFailureReport,
  useNotificationDeliveryReport,
  useQualityRiskDashboard,
  useSecurityAuditReport,
  useSensitiveAccessReport,
  useSlaReport,
  useSupportTicketsReport,
} from '../hooks/useQualityRiskReports';
import '../styles/reportsQualityRisk.css';

function chartRows(rows = [], keys = ['label', 'status', 'severity', 'module', 'priority', 'date', 'channel', 'job_name']) {
  return (rows || []).map((row) => {
    const key = keys.find((item) => row?.[item] !== undefined && row?.[item] !== null);
    return { ...row, label: row.label || row[key] || 'Chưa rõ', value: row.value ?? row.count ?? row.score };
  });
}

function PageFrame({ query, title, subtitle, children }) {
  const [drawer, setDrawer] = useState(null);
  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <ReportErrorState error={query.error} onRetry={query.refresh} />;
  return (
    <div className="executive-overview-page operation-page finance-page qr-page">
      <QualityRiskFilterBar
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
      <QualityRiskDetailDrawer item={drawer?.item} type={drawer?.type || title} onClose={() => setDrawer(null)} />
    </div>
  );
}

function TodoPanel({ todos = [] }) {
  if (!todos.length) return null;
  return (
    <ReportSectionCard title="Backend TODO analytics">
      <ul className="qr-todo-list">{todos.map((todo) => <li key={todo}>{todo}</li>)}</ul>
    </ReportSectionCard>
  );
}

function StandardPage({ query, title, subtitle, labels, tableTitle, table, children }) {
  return (
    <PageFrame query={query} title={title} subtitle={subtitle}>
      {(data, open) => (
        <>
          <QualityRiskKpiGrid cards={qualityRiskCards(data.summary || {}, labels)} onOpen={open} />
          {children?.(data, open)}
          <ReportSectionCard title={tableTitle}>{table(data, open)}</ReportSectionCard>
          <TodoPanel todos={data.backend_todo || []} />
        </>
      )}
    </PageFrame>
  );
}

export function QualityRiskDashboardPage() {
  const query = useQualityRiskDashboard();
  return (
    <PageFrame query={query} title="Dashboard chất lượng / rủi ro" subtitle="Theo dõi rủi ro an toàn người bệnh, bảo mật, SLA, hỗ trợ, job và notification">
      {(data, open) => (
        <>
          <QualityRiskKpiGrid cards={qualityRiskCards(data.summary || {}, {
            critical_alerts_open: 'Critical đang mở',
            critical_overdue: 'Critical overdue',
            clinical_alerts: 'Clinical alerts',
            break_glass_active: 'Break-glass active',
            sensitive_access: 'Sensitive access',
            audit_warning_error: 'Audit warning/error',
            login_failure: 'Login failure',
            support_ticket_open: 'Ticket open',
            support_ticket_overdue: 'Ticket quá SLA',
            average_rating: 'Average rating',
            sla_breached: 'SLA breached',
            notification_failed: 'Notification failed',
            job_failed: 'Job failed',
            risk_score: 'Risk score',
          })}
          onOpen={open}
          />
          <RiskHeatmap rows={data.risk_panels || []} onOpen={open} />
          <div className="qr-chart-grid">
            <ReportSectionCard title="Risk by module"><TrendChart data={chartRows(data.charts?.risk_by_module)} /></ReportSectionCard>
            <ReportSectionCard title="Alert severity"><AlertSeverityDonut rows={data.charts?.alert_severity || []} /></ReportSectionCard>
            <ReportSectionCard title="SLA status"><SlaComplianceChart rows={data.charts?.sla_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Support priority"><TrendChart data={chartRows(data.charts?.support_priority)} /></ReportSectionCard>
          </div>
          <RiskCommandCenter actionCenter={data.action_center || {}} onOpen={open} />
          <TodoPanel todos={data.backend_todo || []} />
        </>
      )}
    </PageFrame>
  );
}

export function CriticalAlertsPage() {
  const query = useCriticalAlertsReport();
  return (
    <StandardPage
      query={query}
      title="Critical alerts"
      subtitle="Gom diagnostic và clinical alerts nguy cấp, quá SLA, chưa acknowledge và đã escalate"
      labels={{
        total_alerts: 'Tổng alerts',
        critical_alerts: 'Critical/high',
        open_alerts: 'Đang mở',
        unacknowledged: 'Chưa acknowledge',
        acknowledged: 'Đã acknowledge',
        escalated: 'Escalated',
        resolved: 'Resolved',
        dismissed: 'Dismissed',
        overdue: 'Overdue',
        median_acknowledge_minutes: 'Median ack phút',
        sla_compliance_rate: 'SLA compliance',
      }}
      tableTitle="Danh sách critical alerts"
      table={(data, open) => <CriticalAlertTable rows={data.items || []} onOpen={(item) => open(item, 'Critical alert')} />}
    >
      {(data, open) => (
        <>
          <CriticalAlertBoard boards={data.boards || {}} onOpen={open} />
          <div className="qr-chart-grid">
            <ReportSectionCard title="Theo type"><TrendChart data={chartRows(data.charts?.by_type)} /></ReportSectionCard>
            <ReportSectionCard title="Theo severity"><AlertSeverityDonut rows={data.charts?.by_severity || []} /></ReportSectionCard>
            <ReportSectionCard title="Theo khoa"><TrendChart data={chartRows(data.charts?.by_department)} /></ReportSectionCard>
            <ReportSectionCard title="Acknowledge bucket"><TrendChart data={chartRows(data.charts?.ack_bucket, ['bucket', 'label'])} /></ReportSectionCard>
          </div>
        </>
      )}
    </StandardPage>
  );
}

export function BreakGlassPage() {
  const query = useBreakGlassReport();
  return (
    <StandardPage
      query={query}
      title="Break-glass report"
      subtitle="Kiểm soát phiên truy cập khẩn cấp, thời lượng, lý do, audit liên quan và dấu hiệu rủi ro"
      labels={{
        total_break_glass: 'Tổng break-glass',
        active_sessions: 'Active sessions',
        ended_sessions: 'Ended sessions',
        today_sessions: 'Hôm nay',
        after_hours_sessions: 'Ngoài giờ',
        long_active_sessions: 'Active quá lâu',
        audit_actions: 'Audit actions',
        suspicious_sessions: 'Suspicious',
        average_duration_minutes: 'Avg duration phút',
      }}
      tableTitle="Danh sách break-glass"
      table={(data, open) => <BreakGlassTable rows={data.items || []} onOpen={(item) => open(item, 'Break-glass')} />}
    >
      {(data) => (
        <div className="qr-chart-grid">
          <ReportSectionCard title="Break-glass by day"><BreakGlassTimeline rows={data.charts?.by_day || []} /></ReportSectionCard>
          <ReportSectionCard title="Status"><SlaComplianceChart rows={data.charts?.by_status || []} /></ReportSectionCard>
          <ReportSectionCard title="Top user"><TrendChart data={chartRows(data.charts?.by_user)} /></ReportSectionCard>
          <ReportSectionCard title="Duration buckets"><TrendChart data={chartRows(data.charts?.duration_buckets, ['bucket', 'label'])} /></ReportSectionCard>
        </div>
      )}
    </StandardPage>
  );
}

export function SensitiveAccessPage() {
  const query = useSensitiveAccessReport();
  return (
    <StandardPage
      query={query}
      title="Audit sensitive access"
      subtitle="Phân tích truy cập hồ sơ, viện phí, thuốc, tài liệu và break-glass từ audit log"
      labels={{
        sensitive_access_count: 'Sensitive access',
        patient_record_access: 'Patient/record',
        billing_access: 'Billing',
        medication_access: 'Medication',
        document_access: 'Document',
        failed_sensitive_access: 'Failed access',
        warning_severity: 'Warning/error',
        unique_actors: 'Unique actors',
        unique_targets: 'Unique targets',
      }}
      tableTitle="Sensitive audit log"
      table={(data, open) => <SensitiveAccessTable rows={data.items || []} onOpen={(item) => open(item, 'Sensitive audit')} />}
    >
      {(data) => (
        <div className="qr-chart-grid">
          <ReportSectionCard title="Theo module"><TrendChart data={chartRows(data.charts?.by_module)} /></ReportSectionCard>
          <ReportSectionCard title="Actor type"><TrendChart data={chartRows(data.charts?.by_actor_type)} /></ReportSectionCard>
          <ReportSectionCard title="Target type"><TrendChart data={chartRows(data.charts?.by_target_type)} /></ReportSectionCard>
          <ReportSectionCard title="Failed trend"><TrendChart data={chartRows(data.charts?.failed_trend)} /></ReportSectionCard>
        </div>
      )}
    </StandardPage>
  );
}

export function SecurityAuditPage() {
  const query = useSecurityAuditReport();
  return (
    <StandardPage
      query={query}
      title="Login / security audit"
      subtitle="Theo dõi login, failed auth, password/session events, IP bất thường và severity audit"
      labels={{
        total_security_events: 'Security events',
        login_events: 'Login events',
        successful_logins: 'Login success',
        failed_logins: 'Login failed',
        failed_rate: 'Failed rate',
        password_reset_events: 'Password events',
        session_events: 'Session events',
        suspicious_ip_count: 'Suspicious IP',
        top_failed_ip_count: 'Top failed IP count',
      }}
      tableTitle="Security audit log"
      table={(data, open) => <SecurityAuditTable rows={data.items || []} onOpen={(item) => open(item, 'Security audit')} />}
    >
      {(data) => (
        <div className="qr-chart-grid">
          <ReportSectionCard title="Security trend"><TrendChart data={chartRows(data.charts?.by_day)} /></ReportSectionCard>
          <ReportSectionCard title="Success vs failure"><SlaComplianceChart rows={data.charts?.by_status || []} /></ReportSectionCard>
          <ReportSectionCard title="Failed by IP"><TrendChart data={chartRows(data.charts?.failed_by_ip)} /></ReportSectionCard>
          <RiskInsightCard title="Security insights">{(data.insights || []).map((item) => <p key={item}>{item}</p>)}</RiskInsightCard>
        </div>
      )}
    </StandardPage>
  );
}

export function SupportTicketsPage() {
  const query = useSupportTicketsReport();
  return (
    <StandardPage
      query={query}
      title="Support tickets"
      subtitle="Theo dõi ticket hỗ trợ, ưu tiên, SLA, phân công và thời gian xử lý"
      labels={{
        total_tickets: 'Total tickets',
        open: 'Open',
        pending: 'Pending',
        in_progress: 'In progress',
        resolved: 'Resolved',
        closed: 'Closed',
        reopened: 'Reopened',
        urgent_high_priority: 'Urgent/high',
        sla_overdue: 'SLA overdue',
        average_resolution_minutes: 'Avg resolution phút',
        assigned_tickets: 'Assigned',
        unassigned_tickets: 'Unassigned',
      }}
      tableTitle="Danh sách support tickets"
      table={(data, open) => <SupportTicketTable rows={data.items || []} onOpen={(item) => open(item, 'Support ticket')} />}
    >
      {(data, open) => (
        <>
          <SupportTicketBoard boards={data.boards || {}} onOpen={open} />
          <div className="qr-chart-grid">
            <ReportSectionCard title="Status"><SlaComplianceChart rows={data.charts?.by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Category"><TrendChart data={chartRows(data.charts?.by_category)} /></ReportSectionCard>
            <ReportSectionCard title="Priority"><TrendChart data={chartRows(data.charts?.by_priority)} /></ReportSectionCard>
            <ReportSectionCard title="Assignee"><TrendChart data={chartRows(data.charts?.by_assignee)} /></ReportSectionCard>
          </div>
        </>
      )}
    </StandardPage>
  );
}

export function ComplaintsRatingsPage() {
  const query = useComplaintsRatingsReport();
  return (
    <StandardPage
      query={query}
      title="Complaint / rating"
      subtitle="Phân tích khiếu nại, đánh giá thấp, ticket quá SLA và điểm hài lòng theo khoa/category"
      labels={{
        total_rated_tickets: 'Rated tickets',
        average_satisfaction_rating: 'Avg rating',
        one_star_count: '1 sao',
        two_star_count: '2 sao',
        three_star_count: '3 sao',
        four_star_count: '4 sao',
        five_star_count: '5 sao',
        negative_feedback_count: 'Negative feedback',
        complaint_tickets: 'Complaint tickets',
        complaint_unresolved: 'Unresolved',
        complaint_sla_overdue: 'Complaint quá SLA',
      }}
      tableTitle="Complaint / rating tickets"
      table={(data, open) => <SupportTicketTable rows={data.items || []} onOpen={(item) => open(item, 'Complaint/rating')} />}
    >
      {(data) => (
        <>
          <ComplaintRatingPanel data={data.summary || {}} />
          <div className="qr-chart-grid">
            <ReportSectionCard title="Rating distribution"><TrendChart data={chartRows(data.charts?.rating_distribution, ['satisfaction_rating', 'label'])} /></ReportSectionCard>
            <ReportSectionCard title="Rating category"><TrendChart data={chartRows(data.charts?.rating_by_category)} /></ReportSectionCard>
            <ReportSectionCard title="Complaint trend"><TrendChart data={chartRows(data.charts?.complaint_trend)} /></ReportSectionCard>
            <RiskInsightCard title="Complaint insights">{(data.insights || []).map((item) => <p key={item}>{item}</p>)}</RiskInsightCard>
          </div>
        </>
      )}
    </StandardPage>
  );
}

export function SlaPage() {
  const query = useSlaReport();
  return (
    <StandardPage
      query={query}
      title="SLA"
      subtitle="Unified SLA từ diagnostic, clinical, support, emergency và inpatient task"
      labels={{
        total_sla_items: 'Total SLA items',
        within_sla: 'Within SLA',
        at_risk: 'At risk',
        breached: 'Breached',
        escalated: 'Escalated',
        completed: 'Completed',
        sla_compliance_rate: 'SLA compliance',
        critical_breach_count: 'Critical breach',
        average_breach_minutes: 'Avg breach phút',
        longest_breach_minutes: 'Longest breach phút',
      }}
      tableTitle="Unified SLA breach table"
      table={(data, open) => <SlaBreachTable rows={data.items || []} onOpen={(item) => open(item, 'SLA item')} />}
    >
      {(data) => (
        <div className="qr-chart-grid">
          <ReportSectionCard title="SLA by module"><TrendChart data={chartRows(data.charts?.by_module)} /></ReportSectionCard>
          <ReportSectionCard title="SLA status"><SlaComplianceChart rows={data.charts?.by_status || []} /></ReportSectionCard>
          <ReportSectionCard title="Breach trend"><TrendChart data={chartRows(data.charts?.breach_trend)} /></ReportSectionCard>
          <ReportSectionCard title="Breach buckets"><TrendChart data={chartRows(data.charts?.breach_buckets, ['bucket', 'label'])} /></ReportSectionCard>
        </div>
      )}
    </StandardPage>
  );
}

export function JobFailurePage() {
  const query = useJobFailureReport();
  return (
    <StandardPage
      query={query}
      title="Job failure"
      subtitle="Đọc JobRunLog để kiểm soát job failed, duration, retry attempt và worker/correlation"
      labels={{
        total_job_runs: 'Total job runs',
        running: 'Running',
        success: 'Success',
        failed: 'Failed',
        failure_rate: 'Failure rate',
        retry_attempts: 'Retry attempts',
        average_duration_seconds: 'Avg duration giây',
        p95_duration_seconds: 'P95 duration giây',
        records_processed: 'Records processed',
        most_failed_job_count: 'Most failed count',
      }}
      tableTitle="Job run logs"
      table={(data, open) => <JobFailureTable rows={data.items || []} onOpen={(item) => open(item, 'Job run')} />}
    >
      {(data) => (
        <div className="qr-chart-grid">
          <ReportSectionCard title="Job status"><SlaComplianceChart rows={data.charts?.by_status || []} /></ReportSectionCard>
          <ReportSectionCard title="Failure trend"><TrendChart data={chartRows(data.charts?.by_day)} /></ReportSectionCard>
          <ReportSectionCard title="Failed by job"><TrendChart data={chartRows(data.charts?.by_job)} /></ReportSectionCard>
          <ReportSectionCard title="Failed by queue"><TrendChart data={chartRows(data.charts?.by_queue)} /></ReportSectionCard>
        </div>
      )}
    </StandardPage>
  );
}

export function NotificationDeliveryPage() {
  const query = useNotificationDeliveryReport();
  return (
    <StandardPage
      query={query}
      title="Notification delivery"
      subtitle="Theo dõi gửi thông báo, failed queue, retry, provider/channel và delivery/read rate"
      labels={{
        total_notifications: 'Total notifications',
        queued: 'Queued',
        sent: 'Sent',
        delivered: 'Delivered',
        read: 'Read',
        failed: 'Failed',
        cancelled: 'Cancelled',
        delivery_rate: 'Delivery rate',
        read_rate: 'Read rate',
        failure_rate: 'Failure rate',
        retry_pending: 'Retry pending',
        scheduled_future: 'Scheduled future',
      }}
      tableTitle="Notification delivery table"
      table={(data, open) => <NotificationDeliveryTable rows={data.items || []} onOpen={(item) => open(item, 'Notification')} />}
    >
      {(data, open) => (
        <>
          <ReportSectionCard title="Failed notification panel"><NotificationFailurePanel rows={data.panels?.failed_recent || []} onOpen={open} /></ReportSectionCard>
          <div className="qr-chart-grid">
            <ReportSectionCard title="Notification status"><SlaComplianceChart rows={data.charts?.by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Channel"><TrendChart data={chartRows(data.charts?.by_channel)} /></ReportSectionCard>
            <ReportSectionCard title="Provider"><TrendChart data={chartRows(data.charts?.by_provider)} /></ReportSectionCard>
            <ReportSectionCard title="Failed reason"><TrendChart data={chartRows(data.charts?.failed_by_reason, ['failure_reason', 'label'])} /></ReportSectionCard>
          </div>
        </>
      )}
    </StandardPage>
  );
}
