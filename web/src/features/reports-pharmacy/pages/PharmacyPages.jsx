import { useState } from 'react';
import {
  BatchStatusDonut,
  DataErrorStrip,
  DispenseStatusDonut,
  DispenseTable,
  ExportHistoryDrawer,
  InventoryMovementChart,
  InventoryTransactionTable,
  LowStockSeverityBadge,
  MedicationTable,
  PharmacyDataTable,
  PharmacyDetailDrawer,
  PharmacyFilterBar,
  PharmacyHealthScore,
  PharmacyInsightGrid,
  PharmacyKpiGrid,
  PharmacyStatusBadge,
  PharmacyTrendChart,
  PrescriptionTable,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  StockBatchTable,
  UrgentPharmacyWorklist,
  abcClass,
  summaryCards,
} from '../components/PharmacyComponents';
import {
  useDispensingReport,
  useExpiredRecalledBatchesReport,
  useExpiringBatchesReport,
  useInventoryMovementReport,
  useInventoryReport,
  useInventoryTurnoverReport,
  useInventoryValueReport,
  useLowStockReport,
  usePharmacyDashboardReport,
  usePrescriptionPharmacyReport,
} from '../hooks/usePharmacyReports';
import { formatCurrency, formatDateTime, formatNumber, formatPercent, safeNumber } from '../../reports-overview/utils/formatters';
import '../styles/reportsPharmacy.css';

function chartRows(rows = [], labelKeys = ['label', 'status', 'transaction_type', 'direction', 'medication_name', 'supplier_name', 'storage_location', 'movement_class']) {
  return (rows || []).map((row) => {
    const labelKey = labelKeys.find((key) => row?.[key] !== undefined && row?.[key] !== null);
    return {
      ...row,
      label: row.label || row.name || row.date || row[labelKey] || 'Chưa rõ',
      value: safeNumber(row.value ?? row.amount ?? row.count ?? row.quantity ?? row.inventory_value ?? row.dispensed_quantity),
    };
  });
}

function TodoPanel({ todos = [] }) {
  if (!todos.length) return null;
  return (
    <ReportSectionCard title="Backend TODO analytics">
      <ul className="pharmacy-todo-list">
        {todos.map((todo) => <li key={todo}>{todo}</li>)}
      </ul>
    </ReportSectionCard>
  );
}

function PageFrame({ query, title, subtitle, reportType, children }) {
  const [drawer, setDrawer] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <ReportErrorState error={query.error} onRetry={query.refresh} />;

  return (
    <div className="executive-overview-page operation-page finance-page pharmacy-page">
      <PharmacyFilterBar
        title={title}
        subtitle={subtitle}
        filters={query.filters}
        onChange={query.setFilters}
        onReset={query.resetFilters}
        onRefresh={query.refresh}
        isRefreshing={query.isRefreshing}
        lastUpdatedAt={query.lastUpdatedAt || query.data?.generated_at}
        reportType={reportType}
        onHistory={() => setHistoryOpen(true)}
      />
      <DataErrorStrip errors={query.data?.data_errors} />
      {children(query.data || {}, (item, type = title) => setDrawer({ item, type }), query)}
      <PharmacyDetailDrawer item={drawer?.item} type={drawer?.type || title} onClose={() => setDrawer(null)} />
      <ExportHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} filters={query.filters} />
    </div>
  );
}

function StandardPharmacyPage({ query, title, subtitle, reportType, labels, tableTitle, tableRows, table, children }) {
  return (
    <PageFrame query={query} title={title} subtitle={subtitle} reportType={reportType}>
      {(data, open) => (
        <>
          <PharmacyKpiGrid cards={summaryCards(data.summary || {}, labels)} onOpen={open} />
          {children?.(data, open)}
          <ReportSectionCard title={tableTitle}>
            {table ? table(data, open) : <MedicationTable rows={tableRows(data)} onOpen={(item) => open(item, tableTitle)} />}
          </ReportSectionCard>
          <div className="executive-layout">
            <ReportSectionCard title="Pharmacy health"><PharmacyHealthScore data={data} /></ReportSectionCard>
            <ReportSectionCard title="Insight"><PharmacyInsightGrid insights={data.insights || []} /></ReportSectionCard>
          </div>
          <TodoPanel todos={data.backend_todo || []} />
        </>
      )}
    </PageFrame>
  );
}

const dashboardLabels = {
  total_active_medications: 'Tổng thuốc active',
  total_batches: 'Tổng lô thuốc',
  total_on_hand: 'Tổng tồn hiện tại',
  inventory_value: 'Giá trị tồn kho',
  low_stock_medication_count: 'Thuốc dưới tồn tối thiểu',
  out_of_stock_medication_count: 'Thuốc hết tồn',
  near_expiry_batch_count: 'Lô sắp hết hạn',
  expired_batch_count: 'Lô hết hạn',
  recalled_batch_count: 'Lô thu hồi',
  receipt_quantity: 'Số lượng nhập',
  dispense_quantity: 'Số lượng cấp phát',
  return_quantity: 'Số lượng trả kho',
  adjustment_quantity: 'Số lượng điều chỉnh',
  waste_quantity: 'Số lượng hủy/hao hụt',
  dispense_count: 'Số lượt cấp phát',
  partial_dispense_count: 'Cấp phát một phần',
  returned_dispense_count: 'Cấp phát bị trả',
  estimated_waste_value: 'Giá trị hao hụt ước tính',
};

export function PharmacyDashboardPage() {
  const query = usePharmacyDashboardReport();
  return (
    <PageFrame query={query} title="Dashboard kho dược" subtitle="Tổng quan tồn kho, cấp phát, cảnh báo, giá trị kho và rủi ro dược" reportType="dashboard">
      {(data, open) => (
        <>
          <PharmacyKpiGrid cards={summaryCards(data.summary || {}, dashboardLabels)} onOpen={open} />
          <div className="executive-layout">
            <ReportSectionCard title="Inventory movement"><InventoryMovementChart rows={data.trends?.inventory_movement_by_day || []} /></ReportSectionCard>
            <ReportSectionCard title="Dispense by day"><PharmacyTrendChart rows={data.trends?.dispense_by_day || []} /></ReportSectionCard>
            <ReportSectionCard title="Inventory value trend"><PharmacyTrendChart rows={data.trends?.inventory_value_by_day || []} /></ReportSectionCard>
          </div>
          <div className="executive-layout">
            <ReportSectionCard title="Transactions by type"><BatchStatusDonut rows={chartRows(data.breakdowns?.transactions_by_type || [], ['transaction_type'])} /></ReportSectionCard>
            <ReportSectionCard title="Batch value by status"><BatchStatusDonut rows={chartRows(data.breakdowns?.batch_value_by_status || [], ['status'])} /></ReportSectionCard>
            <ReportSectionCard title="Dispense by status"><DispenseStatusDonut rows={chartRows(data.breakdowns?.dispense_by_status || [], ['status'])} /></ReportSectionCard>
          </div>
          <div className="pharmacy-command-grid">
            <ReportSectionCard title="Top thuốc cấp phát"><MedicationTable rows={data.top_lists?.top_dispensed_medications || []} onOpen={(item) => open(item, 'Thuốc cấp phát nhiều')} /></ReportSectionCard>
            <ReportSectionCard title="Top low stock"><MedicationTable rows={data.top_lists?.top_low_stock || []} onOpen={(item) => open(item, 'Low stock')} /></ReportSectionCard>
            <ReportSectionCard title="Top gần hết hạn theo giá trị"><StockBatchTable rows={data.top_lists?.top_near_expiry_by_value || []} onOpen={(item) => open(item, 'Lô gần hết hạn')} /></ReportSectionCard>
            <ReportSectionCard title="Việc cần xử lý"><UrgentPharmacyWorklist rows={data.urgent_worklist || []} onOpen={open} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Giá trị tồn kho cao nhất"><MedicationTable rows={data.top_lists?.top_inventory_value || []} onOpen={(item) => open(item, 'Giá trị tồn kho')} /></ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function PharmacyInventoryPage() {
  const query = useInventoryReport();
  return (
    <StandardPharmacyPage
      query={query}
      title="Tồn kho"
      subtitle="Theo dõi thuốc, batch, vị trí lưu trữ, trạng thái tồn và giá trị hiện tại"
      reportType="inventory-overview"
      labels={{
        total_medications: 'Tổng thuốc',
        active_medications: 'Thuốc active',
        total_batches: 'Tổng batch',
        available_batches: 'Batch available',
        quarantined_batches: 'Batch cách ly',
        expired_batches: 'Batch hết hạn',
        recalled_batches: 'Batch thu hồi',
        total_stock_on_hand: 'Tổng tồn',
        inventory_value: 'Tổng giá trị tồn',
        in_stock_medications: 'Thuốc có tồn',
        out_of_stock_medications: 'Thuốc hết tồn',
        low_stock_medications: 'Thuốc dưới min stock',
        average_unit_cost: 'Average unit cost',
      }}
      tableTitle="Danh sách thuốc tồn kho"
      tableRows={(data) => data.items || []}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Inventory value"><PharmacyTrendChart rows={chartRows(data.items || [], ['medication_name'])} /></ReportSectionCard>
          <ReportSectionCard title="Batch status"><BatchStatusDonut rows={chartRows(data.breakdowns?.by_batch_status || [], ['status'])} /></ReportSectionCard>
        </div>
      )}
    </StandardPharmacyPage>
  );
}

export function PharmacyMovementPage() {
  const query = useInventoryMovementReport();
  return (
    <StandardPharmacyPage
      query={query}
      title="Nhập xuất tồn"
      subtitle="Stock card, transaction ledger, receipt, dispense, return, adjustment và waste"
      reportType="inventory-movement"
      labels={{
        opening_quantity: 'Opening quantity',
        receipt_quantity: 'Receipt quantity',
        dispense_quantity: 'Dispense quantity',
        return_quantity: 'Return quantity',
        adjustment_in_quantity: 'Adjustment in',
        adjustment_out_quantity: 'Adjustment out',
        waste_quantity: 'Waste quantity',
        closing_quantity: 'Closing quantity',
        opening_value: 'Opening value',
        closing_value: 'Closing value',
      }}
      tableTitle="Stock card"
      tableRows={(data) => data.items || []}
    >
      {(data, open) => (
        <>
          <div className="executive-layout">
            <ReportSectionCard title="Movement by day"><InventoryMovementChart rows={data.trends?.inventory_movement_by_day || []} /></ReportSectionCard>
            <ReportSectionCard title="Transaction type"><BatchStatusDonut rows={chartRows(data.breakdowns?.by_type || [], ['transaction_type'])} /></ReportSectionCard>
            <ReportSectionCard title="Direction"><BatchStatusDonut rows={chartRows(data.breakdowns?.by_direction || [], ['direction'])} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Transaction ledger">
            <InventoryTransactionTable rows={data.transactions || []} onOpen={(item) => open(item, 'Transaction')} />
          </ReportSectionCard>
        </>
      )}
    </StandardPharmacyPage>
  );
}

export function PharmacyLowStockPage() {
  const query = useLowStockReport();
  return (
    <StandardPharmacyPage
      query={query}
      title="Low stock"
      subtitle="Phát hiện thiếu tồn, hết tồn, pending dispense và gợi ý reorder"
      reportType="low-stock"
      labels={{
        low_stock_count: 'Low stock count',
        out_of_stock_count: 'Out of stock count',
        critical_shortage_count: 'Critical shortage',
        total_reorder_suggested_quantity: 'Suggested reorder quantity',
      }}
      tableTitle="Danh sách low stock"
      tableRows={(data) => data.items || []}
      table={(data, open) => (
        <PharmacyDataTable rows={data.items || []} onRowClick={(item) => open(item, 'Low stock')} columns={[
          { key: 'medication_code', label: 'Mã thuốc' },
          { key: 'medication_name', label: 'Tên thuốc' },
          { key: 'current_on_hand', label: 'Tồn hiện tại', render: (row) => formatNumber(row.current_on_hand) },
          { key: 'min_stock_level', label: 'Min stock', render: (row) => formatNumber(row.min_stock_level) },
          { key: 'shortage_quantity', label: 'Thiếu', render: (row) => formatNumber(row.shortage_quantity) },
          { key: 'pending_dispense_quantity', label: 'Chờ cấp phát', render: (row) => formatNumber(row.pending_dispense_quantity) },
          { key: 'days_of_stock_remaining', label: 'Ngày còn tồn', render: (row) => row.days_of_stock_remaining == null ? 'Chưa tính' : formatNumber(row.days_of_stock_remaining) },
          { key: 'suggested_reorder_quantity', label: 'Gợi ý nhập', render: (row) => formatNumber(row.suggested_reorder_quantity) },
          { key: 'severity', label: 'Mức độ', render: (row) => <LowStockSeverityBadge status={row.severity} /> },
        ]} />
      )}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Severity"><BatchStatusDonut rows={chartRows(data.items || [], ['severity'])} /></ReportSectionCard>
          <ReportSectionCard title="Suggested reorder"><PharmacyTrendChart rows={chartRows(data.items || [], ['medication_name'])} /></ReportSectionCard>
        </div>
      )}
    </StandardPharmacyPage>
  );
}

export function PharmacyExpiringBatchesPage() {
  const query = useExpiringBatchesReport();
  return (
    <StandardPharmacyPage
      query={query}
      title="Expiring batches"
      subtitle="Quản trị lô sắp hết hạn theo bucket 7/15/30/60/90 ngày, giá trị rủi ro và FEFO"
      reportType="expiring-stock"
      labels={{
        expiring_7_days: 'Expiring in 7 days',
        expiring_15_days: 'Expiring in 15 days',
        expiring_30_days: 'Expiring in 30 days',
        expiring_60_days: 'Expiring in 60 days',
        expiring_90_days: 'Expiring in 90 days',
        total_risk_quantity: 'Total risk quantity',
        total_risk_value: 'Total risk value',
      }}
      tableTitle="Lô sắp hết hạn"
      tableRows={(data) => data.items || []}
      table={(data, open) => <StockBatchTable rows={data.items || []} onOpen={(item) => open(item, 'Expiring batch')} />}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Expiry severity"><BatchStatusDonut rows={chartRows(data.items || [], ['severity'])} /></ReportSectionCard>
          <ReportSectionCard title="Risk value"><PharmacyTrendChart rows={chartRows(data.items || [], ['medication_name'])} /></ReportSectionCard>
        </div>
      )}
    </StandardPharmacyPage>
  );
}

export function PharmacyExpiredRecalledBatchesPage() {
  const query = useExpiredRecalledBatchesReport();
  return (
    <StandardPharmacyPage
      query={query}
      title="Expired / recalled batches"
      subtitle="Theo dõi batch hết hạn, thu hồi, tác động cấp phát và trạng thái disposal"
      reportType="expired-recalled-batches"
      labels={{
        expired_batch_count: 'Expired batch count',
        recalled_batch_count: 'Recalled batch count',
        expired_quantity: 'Expired quantity',
        recalled_quantity: 'Recalled quantity',
        expired_value: 'Expired value',
        recalled_value: 'Recalled value',
        disposal_pending: 'Disposal pending',
        disposal_posted: 'Disposal posted',
        recall_impact_dispenses: 'Recall impact dispenses',
      }}
      tableTitle="Expired / recalled ledger"
      tableRows={(data) => data.items || []}
      table={(data, open) => <StockBatchTable rows={data.items || []} onOpen={(item) => open(item, 'Expired / recalled batch')} />}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Expired vs recalled"><BatchStatusDonut rows={chartRows(data.breakdowns?.by_status || [], ['status'])} /></ReportSectionCard>
          <ReportSectionCard title="Impact by medication"><PharmacyTrendChart rows={chartRows(data.breakdowns?.by_medication || [], ['medication_name'])} /></ReportSectionCard>
        </div>
      )}
    </StandardPharmacyPage>
  );
}

export function PharmacyDispensingPage() {
  const query = useDispensingReport();
  return (
    <StandardPharmacyPage
      query={query}
      title="Cấp phát thuốc"
      subtitle="Theo dõi dispense queue, trạng thái cấp phát, hold, return và hiệu suất dược sĩ"
      reportType="dispensing"
      labels={{
        dispense_count: 'Dispense count',
        dispensed_count: 'Dispensed',
        partial_dispensed_count: 'Partial dispensed',
        cancelled_count: 'Cancelled',
        returned_count: 'Returned',
        dispense_item_count: 'Dispense item count',
        total_dispensed_quantity: 'Total quantity',
        estimated_dispense_value: 'Estimated value',
        completion_rate: 'Completion rate',
        return_rate: 'Return rate',
      }}
      tableTitle="Danh sách cấp phát"
      tableRows={(data) => data.items || []}
      table={(data, open) => <DispenseTable rows={data.items || []} onOpen={(item) => open(item, 'Dispense')} />}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Dispense by day"><PharmacyTrendChart rows={data.breakdowns?.by_day || []} /></ReportSectionCard>
          <ReportSectionCard title="Dispense status"><DispenseStatusDonut rows={chartRows(data.breakdowns?.by_status || [], ['status'])} /></ReportSectionCard>
          <ReportSectionCard title="Top medications"><PharmacyTrendChart rows={chartRows(data.breakdowns?.by_medication || [], ['medication_name'])} /></ReportSectionCard>
        </div>
      )}
    </StandardPharmacyPage>
  );
}

export function PharmacyPrescriptionsPage() {
  const query = usePrescriptionPharmacyReport();
  return (
    <StandardPharmacyPage
      query={query}
      title="Đơn thuốc"
      subtitle="Báo cáo prescription, trạng thái xác minh/cấp phát, risk queue và thuốc được kê nhiều"
      reportType="prescriptions"
      labels={{
        prescription_count: 'Tổng đơn thuốc',
        draft_count: 'Draft',
        active_count: 'Active',
        verified_count: 'Verified',
        partially_dispensed_count: 'Partially dispensed',
        fully_dispensed_count: 'Fully dispensed',
        cancelled_count: 'Cancelled',
        completed_count: 'Completed',
        waiting_dispense_count: 'Chờ cấp phát',
        risk_allergy_count: 'Risk allergy',
        risk_interaction_count: 'Risk interaction',
        risk_duplicate_count: 'Risk duplicate',
      }}
      tableTitle="Danh sách đơn thuốc"
      tableRows={(data) => data.items || []}
      table={(data, open) => <PrescriptionTable rows={data.items || []} onOpen={(item) => open(item, 'Prescription')} />}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Prescription status"><BatchStatusDonut rows={chartRows(data.breakdowns?.by_status || [], ['status'])} /></ReportSectionCard>
          <ReportSectionCard title="By doctor"><PharmacyTrendChart rows={chartRows(data.breakdowns?.by_doctor || [], ['doctor_name'])} /></ReportSectionCard>
          <ReportSectionCard title="By medication"><PharmacyTrendChart rows={chartRows(data.breakdowns?.by_medication || [], ['medication_name'])} /></ReportSectionCard>
        </div>
      )}
    </StandardPharmacyPage>
  );
}

export function PharmacyInventoryValuePage() {
  const query = useInventoryValueReport();
  return (
    <StandardPharmacyPage
      query={query}
      title="Giá trị tồn kho"
      subtitle="Phân tích giá trị kho theo thuốc, supplier, vị trí, batch status và Pareto ABC"
      reportType="inventory-valuation"
      labels={{
        total_value: 'Total inventory value',
        available_value: 'Available value',
        near_expiry_value: 'Near expiry value',
        expired_value: 'Expired value',
        recalled_value: 'Recalled value',
        depleted_value: 'Depleted value',
      }}
      tableTitle="Pareto ABC theo thuốc"
      tableRows={(data) => data.by_medication || []}
      table={(data, open) => (
        <PharmacyDataTable rows={data.by_medication || []} onRowClick={(item) => open(item, 'Inventory value')} columns={[
          { key: 'medication_code', label: 'Mã thuốc' },
          { key: 'medication_name', label: 'Tên thuốc' },
          { key: 'total_on_hand', label: 'Tồn', render: (row) => formatNumber(row.total_on_hand) },
          { key: 'average_unit_cost', label: 'Avg cost', money: true, render: (row) => formatCurrency(row.average_unit_cost) },
          { key: 'inventory_value', label: 'Inventory value', money: true, render: (row) => formatCurrency(row.inventory_value) },
          { key: 'total_value_percent', label: 'Value %', render: (row) => formatPercent(row.total_value_percent) },
          { key: 'abc', label: 'ABC', render: (row) => abcClass((data.pareto || []).find((item) => item.medication_id === row.medication_id)?.cumulative_percent) },
          { key: 'stock_status', label: 'Status', render: (row) => <PharmacyStatusBadge status={row.stock_status || row.status} /> },
        ]} />
      )}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Value by supplier"><PharmacyTrendChart rows={chartRows(data.by_supplier || [], ['supplier_name'])} /></ReportSectionCard>
          <ReportSectionCard title="Value by location"><PharmacyTrendChart rows={chartRows(data.by_storage_location || [], ['storage_location'])} /></ReportSectionCard>
          <ReportSectionCard title="Value by batch status"><BatchStatusDonut rows={chartRows(data.by_batch_status || [], ['status'])} /></ReportSectionCard>
        </div>
      )}
    </StandardPharmacyPage>
  );
}

export function PharmacyTurnoverPage() {
  const query = useInventoryTurnoverReport();
  return (
    <StandardPharmacyPage
      query={query}
      title="Vòng quay tồn kho"
      subtitle="Ước tính turnover, days inventory on hand, fast/slow/dead stock và tăng dùng bất thường"
      reportType="turnover"
      labels={{
        total_dispensed_quantity: 'Total dispensed quantity',
        total_dispense_value: 'Total dispense value',
        medication_count: 'Medication count',
        abnormal_increase_count: 'Abnormal increase',
        average_days_remaining: 'Average days remaining',
        slow_moving_count: 'Slow moving',
        fast_moving_count: 'Fast moving',
        dead_stock_count: 'Dead stock',
        estimated_turnover_ratio: 'Turnover ratio',
        estimated_days_inventory_on_hand: 'Days inventory on hand',
      }}
      tableTitle="Turnover classification"
      tableRows={(data) => data.items || []}
      table={(data, open) => (
        <PharmacyDataTable rows={data.items || []} onRowClick={(item) => open(item, 'Turnover')} columns={[
          { key: 'rank', label: 'Rank', render: (row) => formatNumber(row.rank) },
          { key: 'medication_code', label: 'Mã thuốc' },
          { key: 'medication_name', label: 'Tên thuốc' },
          { key: 'dispensed_quantity', label: 'Dispensed qty', render: (row) => formatNumber(row.dispensed_quantity) },
          { key: 'dispense_value', label: 'Dispense value', money: true, render: (row) => formatCurrency(row.dispense_value) },
          { key: 'current_on_hand', label: 'Tồn', render: (row) => formatNumber(row.current_on_hand) },
          { key: 'days_remaining', label: 'Ngày còn tồn', render: (row) => row.days_remaining == null ? 'Chưa tính' : formatNumber(row.days_remaining) },
          { key: 'turnover_ratio', label: 'Turnover', render: (row) => formatNumber(row.turnover_ratio) },
          { key: 'movement_class', label: 'Class', render: (row) => <PharmacyStatusBadge status={row.movement_class} /> },
          { key: 'suggested_action', label: 'Suggested action' },
        ]} />
      )}
    >
      {(data) => (
        <div className="executive-layout">
          <ReportSectionCard title="Movement class"><BatchStatusDonut rows={chartRows(data.breakdowns?.movement_class || [], ['movement_class'])} /></ReportSectionCard>
          <ReportSectionCard title="Turnover ranking"><PharmacyTrendChart rows={chartRows(data.items || [], ['medication_name'])} /></ReportSectionCard>
          <ReportSectionCard title="Ngày tồn còn lại">
            {data.summary?.estimated_days_inventory_on_hand == null
              ? <ReportEmptyState title="Chưa đủ dữ liệu days inventory on hand" compact />
              : <strong className="pharmacy-big-number">{formatNumber(data.summary.estimated_days_inventory_on_hand)} ngày</strong>}
          </ReportSectionCard>
        </div>
      )}
    </StandardPharmacyPage>
  );
}
