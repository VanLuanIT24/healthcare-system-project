import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Clock3,
  FileCheck2,
  FileClock,
  FileText,
  FlaskConical,
  HardDrive,
  History,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  Microscope,
  RefreshCw,
  ScanLine,
  Search,
  Settings2,
  ShieldAlert,
  Siren,
  Stethoscope,
  Timer,
  TimerOff,
  UserSquare2,
  UserRound,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { AppLogo, APP_BRAND_NAME } from '../app/AppLogo';
import { clearStoredAuth, readStoredAuth } from '../lib/storage';
import { getStaffActorName } from '../receptionist/workspaceAccess';
import { clinicalOpsAPI } from './clinicalOpsApi';
import { notifyClinicalOps, promptClinicalOpsText, runClinicalOpsAction } from './clinicalOpsActions';
import { ClinicalOpsToastStack, useClinicalOpsToasts } from './ClinicalOpsToastStack';

const ICONS = {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Clock3,
  FileCheck2,
  FileClock,
  FileText,
  FlaskConical,
  HardDrive,
  History,
  LayoutGrid,
  ListChecks,
  Microscope,
  ShieldAlert,
  Siren,
  ScanLine,
  Settings2,
  Stethoscope,
  Timer,
  TimerOff,
  UserSquare2,
  Users,
  WalletCards,
};

const FALLBACK_SIDEBAR = {
  sections: [
    {
      id: 'overview',
      label: 'Tổng quan',
      items: [
        { id: 'dashboard', label: 'Dashboard cận lâm sàng', path: '/clinical-ops/overview/dashboard', icon: 'LayoutGrid' },
        { id: 'today-worklist', label: 'Việc cần xử lý hôm nay', path: '/clinical-ops/overview/today-worklist', icon: 'ClipboardCheck' },
        { id: 'stat-urgent', label: 'STAT / Urgent orders', path: '/clinical-ops/overview/stat-urgent', icon: 'ShieldAlert' },
        { id: 'critical-results', label: 'Critical results', path: '/clinical-ops/overview/critical-results', icon: 'Siren' },
        { id: 'pending-completion', label: 'Kết quả chờ hoàn tất', path: '/clinical-ops/overview/pending-completion', icon: 'FileClock' },
        { id: 'pending-approval', label: 'Kết quả chờ duyệt / ký', path: '/clinical-ops/overview/pending-approval', icon: 'BadgeCheck' },
        { id: 'overdue-orders', label: 'Order quá hạn', path: '/clinical-ops/overview/overdue-orders', icon: 'TimerOff' },
      ],
    },
    {
      id: 'order-center',
      label: 'Trung tâm chỉ định',
      items: [
        { id: 'orders-all', label: 'Tất cả chỉ định cận lâm sàng', path: '/clinical-ops/orders/all', icon: 'ClipboardList' },
        { id: 'orders-pending-receive', label: 'Chỉ định chờ tiếp nhận', path: '/clinical-ops/orders/pending-receive', icon: 'Clock3' },
        { id: 'orders-received', label: 'Chỉ định đã tiếp nhận', path: '/clinical-ops/orders/received', icon: 'CheckCircle2' },
        { id: 'orders-in-progress', label: 'Chỉ định đang thực hiện', path: '/clinical-ops/orders/in-progress', icon: 'Activity' },
        { id: 'orders-completed', label: 'Chỉ định hoàn tất', path: '/clinical-ops/orders/completed', icon: 'BadgeCheck' },
        { id: 'orders-cancelled', label: 'Chỉ định bị hủy', path: '/clinical-ops/orders/cancelled', icon: 'AlertTriangle' },
        { id: 'orders-entry-errors', label: 'Chỉ định nhập sai', path: '/clinical-ops/orders/entry-errors', icon: 'FileText' },
        { id: 'orders-timeline', label: 'Dòng thời gian chỉ định', path: '/clinical-ops/orders/timeline', icon: 'History' },
      ],
    },
    {
      id: 'tests',
      label: 'Xét nghiệm',
      items: [
        { id: 'tests-orders', label: 'Chỉ định xét nghiệm', path: '/clinical-ops/tests/orders', icon: 'ClipboardList' },
        { id: 'tests-waiting-specimen', label: 'Chờ lấy mẫu', path: '/clinical-ops/tests/waiting-specimen', icon: 'Clock3' },
        { id: 'tests-collected', label: 'Đã lấy mẫu', path: '/clinical-ops/tests/specimen-collected', icon: 'BadgeCheck' },
        { id: 'tests-waiting-receive', label: 'Chờ nhận mẫu', path: '/clinical-ops/tests/waiting-receive', icon: 'Clock3' },
        { id: 'tests-processing', label: 'Đang xét nghiệm', path: '/clinical-ops/tests/processing', icon: 'Activity' },
        { id: 'tests-result-entry', label: 'Nhập kết quả', path: '/clinical-ops/tests/result-entry', icon: 'FileText' },
        { id: 'tests-pending-approval', label: 'Kết quả chờ duyệt', path: '/clinical-ops/tests/pending-approval', icon: 'ClipboardCheck' },
        { id: 'tests-approved-results', label: 'Kết quả đã duyệt', path: '/clinical-ops/tests/approved-results', icon: 'BadgeCheck' },
        { id: 'tests-corrections-needed', label: 'Kết quả cần sửa', path: '/clinical-ops/tests/corrections-needed', icon: 'AlertTriangle' },
        { id: 'tests-critical-results', label: 'Kết quả xét nghiệm nguy cấp', path: '/clinical-ops/tests/critical-results', icon: 'ShieldAlert' },
      ],
    },
    {
      id: 'specimens',
      label: 'Mẫu bệnh phẩm',
      items: [
        { id: 'specimens-list', label: 'Danh sách mẫu', path: '/clinical-ops/specimens', icon: 'ClipboardList' },
        { id: 'specimens-waiting-collection', label: 'Mẫu chờ lấy', path: '/clinical-ops/specimens/waiting-collection', icon: 'Clock3' },
        { id: 'specimens-collected', label: 'Mẫu đã lấy', path: '/clinical-ops/specimens/collected', icon: 'BadgeCheck' },
        { id: 'specimens-receive', label: 'Nhận mẫu', path: '/clinical-ops/specimens/receive', icon: 'ClipboardPlus' },
        { id: 'specimens-reject', label: 'Từ chối mẫu', path: '/clinical-ops/specimens/reject', icon: 'AlertTriangle' },
        { id: 'specimens-testing', label: 'Mẫu đang xét nghiệm', path: '/clinical-ops/specimens/testing', icon: 'Activity' },
        { id: 'specimens-storage', label: 'Mẫu lưu kho', path: '/clinical-ops/specimens/storage', icon: 'Microscope' },
        { id: 'specimens-destroyed', label: 'Mẫu đã hủy', path: '/clinical-ops/specimens/destroyed', icon: 'AlertTriangle' },
        { id: 'specimens-history', label: 'Lịch sử mẫu', path: '/clinical-ops/specimens/history', icon: 'History' },
      ],
    },
    {
      id: 'imaging',
      label: 'Chẩn đoán hình ảnh',
      items: [
        { id: 'imaging-orders', label: 'Chỉ định chẩn đoán hình ảnh', path: '/clinical-ops/imaging/orders', icon: 'ClipboardList' },
        { id: 'imaging-waiting-schedule', label: 'Chờ xếp lịch', path: '/clinical-ops/imaging/waiting-schedule', icon: 'Clock3' },
        { id: 'imaging-schedule', label: 'Lịch thực hiện', path: '/clinical-ops/imaging/schedule', icon: 'CalendarDays' },
        { id: 'imaging-in-progress', label: 'Đang thực hiện', path: '/clinical-ops/imaging/in-progress', icon: 'Activity' },
        { id: 'imaging-tech-complete', label: 'Hoàn tất kỹ thuật', path: '/clinical-ops/imaging/technical-complete', icon: 'BadgeCheck' },
        { id: 'imaging-upload', label: 'Tải hình ảnh / tệp kết quả', path: '/clinical-ops/imaging/upload-files', icon: 'FileText' },
        { id: 'imaging-no-show', label: 'Không đến thực hiện', path: '/clinical-ops/imaging/no-show', icon: 'AlertTriangle' },
        { id: 'imaging-reports', label: 'Báo cáo chẩn đoán hình ảnh', path: '/clinical-ops/imaging/reports', icon: 'FileText' },
        { id: 'imaging-pending-signature', label: 'Báo cáo chờ ký', path: '/clinical-ops/imaging/pending-signature', icon: 'ClipboardCheck' },
        { id: 'imaging-signed', label: 'Báo cáo đã ký', path: '/clinical-ops/imaging/signed-reports', icon: 'FileCheck2' },
        { id: 'imaging-corrections', label: 'Báo cáo cần sửa', path: '/clinical-ops/imaging/corrections-needed', icon: 'AlertTriangle' },
        { id: 'imaging-critical-findings', label: 'Phát hiện hình ảnh nguy cấp', path: '/clinical-ops/imaging/critical-findings', icon: 'ShieldAlert' },
      ],
    },
    {
      id: 'procedures',
      label: 'Thủ thuật',
      items: [
        { id: 'procedures-orders', label: 'Chỉ định thủ thuật', path: '/clinical-ops/procedures/orders', icon: 'ClipboardList' },
        { id: 'procedures-waiting-schedule', label: 'Chờ xếp lịch', path: '/clinical-ops/procedures/waiting-schedule', icon: 'Clock3' },
        { id: 'procedures-schedule', label: 'Lịch thủ thuật', path: '/clinical-ops/procedures/schedule', icon: 'CalendarDays' },
        { id: 'procedures-prep', label: 'Chuẩn bị thủ thuật', path: '/clinical-ops/procedures/preparation', icon: 'ClipboardCheck' },
        { id: 'procedures-in-progress', label: 'Đang thực hiện', path: '/clinical-ops/procedures/in-progress', icon: 'Activity' },
        { id: 'procedures-results', label: 'Kết quả thủ thuật', path: '/clinical-ops/procedures/results', icon: 'FileText' },
        { id: 'procedures-complete', label: 'Hoàn tất thủ thuật', path: '/clinical-ops/procedures/complete', icon: 'BadgeCheck' },
        { id: 'procedures-no-show', label: 'Không đến thực hiện', path: '/clinical-ops/procedures/no-show', icon: 'AlertTriangle' },
        { id: 'procedures-files', label: 'Tệp thủ thuật', path: '/clinical-ops/procedures/files', icon: 'FileText' },
        { id: 'procedures-fees', label: 'Chi phí thủ thuật', path: '/clinical-ops/procedures/fees', icon: 'WalletCards' },
      ],
    },
    {
      id: 'approvals',
      label: 'Duyệt và trả kết quả',
      items: [
        { id: 'approvals-lab', label: 'Chờ duyệt xét nghiệm', path: '/clinical-ops/approvals/lab', icon: 'FlaskConical' },
        { id: 'approvals-imaging', label: 'Chờ ký chẩn đoán hình ảnh', path: '/clinical-ops/approvals/imaging-signature', icon: 'ScanLine' },
        { id: 'approvals-procedure', label: 'Chờ xác nhận thủ thuật', path: '/clinical-ops/approvals/procedure-confirmation', icon: 'ClipboardCheck' },
        { id: 'approvals-returned-doctor', label: 'Kết quả đã trả bác sĩ', path: '/clinical-ops/approvals/returned-to-doctor', icon: 'Stethoscope' },
        { id: 'approvals-returned-patient', label: 'Kết quả đã trả bệnh nhân', path: '/clinical-ops/approvals/returned-to-patient', icon: 'UserSquare2' },
        { id: 'approvals-amend-needed', label: 'Kết quả cần điều chỉnh', path: '/clinical-ops/approvals/amend-needed', icon: 'AlertTriangle' },
        { id: 'approvals-history', label: 'Lịch sử duyệt / ký', path: '/clinical-ops/approvals/history', icon: 'History' },
      ],
    },
    {
      id: 'result-files',
      label: 'Tệp và tài liệu kết quả',
      items: [
        { id: 'files-imaging', label: 'Tệp chẩn đoán hình ảnh', path: '/clinical-ops/result-files/imaging', icon: 'ScanLine' },
        { id: 'files-procedure', label: 'Tệp thủ thuật', path: '/clinical-ops/result-files/procedure', icon: 'ClipboardPlus' },
        { id: 'files-lab', label: 'Tệp xét nghiệm', path: '/clinical-ops/result-files/lab', icon: 'FlaskConical' },
        { id: 'files-missing', label: 'Tệp còn thiếu', path: '/clinical-ops/result-files/missing', icon: 'AlertTriangle' },
        { id: 'files-scan-errors', label: 'Tệp lỗi quét', path: '/clinical-ops/result-files/scan-errors', icon: 'AlertTriangle' },
        { id: 'files-review', label: 'Tệp chờ rà soát', path: '/clinical-ops/result-files/pending-review', icon: 'ClipboardCheck' },
        { id: 'files-released', label: 'Tệp đã phát hành', path: '/clinical-ops/result-files/released', icon: 'FileCheck2' },
      ],
    },
    {
      id: 'alerts',
      label: 'Cảnh báo',
      items: [
        { id: 'alerts-command-center', label: 'Trung tâm cảnh báo', path: '/clinical-ops/alerts', icon: 'ShieldAlert' },
        { id: 'alerts-critical-unhandled', label: 'Kết quả nguy cấp chưa xử lý', path: '/clinical-ops/alerts/critical-unhandled', icon: 'ShieldAlert' },
        { id: 'alerts-critical-overdue', label: 'Kết quả nguy cấp quá hạn xác nhận', path: '/clinical-ops/alerts/critical-overdue-confirmation', icon: 'Clock3' },
        { id: 'alerts-rejected-specimens', label: 'Mẫu bị từ chối', path: '/clinical-ops/alerts/rejected-specimens', icon: 'AlertTriangle' },
        { id: 'alerts-overdue-orders', label: 'Chỉ định quá hạn', path: '/clinical-ops/alerts/overdue-orders', icon: 'Clock3' },
        { id: 'alerts-missing-files', label: 'Thiếu tệp kết quả', path: '/clinical-ops/alerts/missing-result-files', icon: 'FileText' },
        { id: 'alerts-corrections', label: 'Kết quả cần sửa', path: '/clinical-ops/alerts/corrections-needed', icon: 'ClipboardCheck' },
        { id: 'alerts-no-show-cancel', label: 'Không đến thực hiện / hủy bất thường', path: '/clinical-ops/alerts/no-show-abnormal-cancel', icon: 'AlertTriangle' },
      ],
    },
    {
      id: 'patient-lookup',
      label: 'Tra cứu bệnh nhân',
      items: [
        { id: 'lookup-by-patient', label: 'Theo bệnh nhân', path: '/clinical-ops/patient-lookup/by-patient', icon: 'Users' },
        { id: 'lookup-by-encounter', label: 'Theo lượt khám', path: '/clinical-ops/patient-lookup/by-visit', icon: 'ClipboardList' },
        { id: 'lookup-lab-history', label: 'Lịch sử xét nghiệm', path: '/clinical-ops/patient-lookup/lab-history', icon: 'FlaskConical' },
        { id: 'lookup-imaging-history', label: 'Lịch sử chẩn đoán hình ảnh', path: '/clinical-ops/patient-lookup/imaging-history', icon: 'ScanLine' },
        { id: 'lookup-procedure-history', label: 'Lịch sử thủ thuật', path: '/clinical-ops/patient-lookup/procedure-history', icon: 'ClipboardPlus' },
        { id: 'lookup-clinical-summary', label: 'Tổng hợp cận lâm sàng', path: '/clinical-ops/patient-lookup/clinical-summary', icon: 'FileText' },
      ],
    },
    {
      id: 'config',
      label: 'Danh mục & cấu hình',
      items: [
        { id: 'config-command-center', label: 'Configuration Command Center', path: '/clinical-ops/config', icon: 'Settings2' },
        { id: 'config-lab-tests', label: 'Lab test catalog', path: '/clinical-ops/config/lab-tests', icon: 'FlaskConical' },
        { id: 'config-specimen-types', label: 'Loại mẫu bệnh phẩm', path: '/clinical-ops/config/specimen-types', icon: 'Microscope' },
        { id: 'config-imaging-modalities', label: 'Imaging modality', path: '/clinical-ops/config/imaging-modalities', icon: 'ScanLine' },
        { id: 'config-imaging-rooms', label: 'Phòng / thiết bị CĐHA', path: '/clinical-ops/config/imaging-rooms-equipment', icon: 'HardDrive' },
        { id: 'config-procedures', label: 'Danh mục thủ thuật', path: '/clinical-ops/config/procedures', icon: 'Stethoscope' },
        { id: 'config-checklists', label: 'Checklist thủ thuật', path: '/clinical-ops/config/procedure-checklists', icon: 'ListChecks' },
        { id: 'config-sla-alerts', label: 'SLA & cảnh báo', path: '/clinical-ops/config/sla-alerts', icon: 'Timer' },
        { id: 'config-report-templates', label: 'Mẫu báo cáo kết quả', path: '/clinical-ops/config/result-report-templates', icon: 'FileText' },
      ],
    },
    {
      id: 'nursing-related',
      label: 'Cận lâm sàng liên quan',
      items: [
        { id: 'nursing-patient-preparation', label: 'Bệnh nhân cần chuẩn bị', path: '/clinical-ops/nursing-related/patient-preparation', icon: 'Users' },
        { id: 'nursing-waiting-specimen', label: 'Chờ lấy mẫu', path: '/clinical-ops/nursing-related/waiting-specimen', icon: 'FlaskConical' },
        { id: 'nursing-imaging-schedule', label: 'Lịch chẩn đoán hình ảnh của bệnh nhân', path: '/clinical-ops/nursing-related/patient-imaging-schedule', icon: 'ScanLine' },
        { id: 'nursing-procedure-schedule', label: 'Lịch thủ thuật của bệnh nhân', path: '/clinical-ops/nursing-related/patient-procedure-schedule', icon: 'CalendarDays' },
        { id: 'nursing-following-orders', label: 'Chỉ định đang theo dõi', path: '/clinical-ops/nursing-related/following-orders', icon: 'ClipboardList' },
        { id: 'nursing-available-results', label: 'Kết quả đã có', path: '/clinical-ops/nursing-related/available-results', icon: 'FileCheck2' },
        { id: 'nursing-related-critical-alerts', label: 'Cảnh báo nguy cấp liên quan', path: '/clinical-ops/nursing-related/related-critical-alerts', icon: 'ShieldAlert' },
      ],
    },
  ],
};

function getInitials(name = '') {
  const initials = String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return initials || 'CO';
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function iconFor(name) {
  return ICONS[name] || LayoutGrid;
}

function flattenSidebar(sidebar) {
  return (sidebar?.sections || []).flatMap((section) =>
    (section.items || []).map((item) => ({
      ...item,
      sectionId: section.id,
      sectionLabel: section.label,
    })),
  );
}

function getAuthRoleCodes(auth = {}) {
  const roleSources = [
    auth?.user?.roles,
    auth?.roles,
    auth?.user?.role_codes,
    auth?.role_codes,
    auth?.user?.role_code,
    auth?.role_code,
    auth?.user?.role,
    auth?.role,
  ];

  return roleSources
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      return value.role_code || value.code || value.name || '';
    })
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
}

function isSuperAdminAuth(auth = {}) {
  const roles = getAuthRoleCodes(auth);
  const username = String(auth?.user?.username || auth?.username || '').toLowerCase();
  const email = String(auth?.user?.email || auth?.email || '').toLowerCase();
  return (
    roles.includes('super_admin')
    || Boolean(auth?.user?.is_super_admin || auth?.is_super_admin)
    || username === 'superadmin'
    || email.startsWith('superadmin@')
  );
}

export function getClinicalOpsPageMeta(pathname = '/clinical-ops/overview/dashboard') {
  const normalized = pathname === '/clinical-ops' ? '/clinical-ops/overview/dashboard' : pathname;
  return flattenSidebar(FALLBACK_SIDEBAR).find((item) => item.path === normalized) || FALLBACK_SIDEBAR.sections[0].items[0];
}

function RoleAwareMenuRenderer({ sidebar, collapsed, onNavigate }) {
  const location = useLocation();
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries((sidebar.sections || []).map((section) => [section.id, true])),
  );

  useEffect(() => {
    setOpenSections((current) => {
      const next = { ...current };
      (sidebar.sections || []).forEach((section) => {
        if (next[section.id] === undefined) next[section.id] = true;
      });
      return next;
    });
  }, [sidebar]);

  return (
    <nav className="clinical-ops-sidebar__nav">
      {(sidebar.sections || []).map((section) => {
        const SectionIcon = iconFor({
          overview: 'LayoutGrid',
          'order-center': 'ClipboardList',
          tests: 'FlaskConical',
          specimens: 'Microscope',
          imaging: 'ScanLine',
          procedures: 'ClipboardPlus',
          approvals: 'BadgeCheck',
          'result-files': 'FileText',
          alerts: 'ShieldAlert',
          'patient-lookup': 'Users',
          config: 'Settings2',
          'nursing-related': 'Users',
        }[section.id]);
        const isOpen = Boolean(openSections[section.id]) && !collapsed;
        const isActive = (section.items || []).some((item) => location.pathname === item.path);

        return (
          <div key={section.id} className={`clinical-ops-nav-group${isOpen ? ' is-open' : ''}${isActive ? ' is-active' : ''}`}>
            <button
              type="button"
              className="clinical-ops-nav-group__trigger"
              title={section.label}
              aria-expanded={isOpen}
              onClick={() => setOpenSections((current) => ({ ...current, [section.id]: !current[section.id] }))}
            >
              <SectionIcon size={18} strokeWidth={2.2} />
              {!collapsed ? <span>{section.label}</span> : null}
              {!collapsed ? <ChevronDown size={16} strokeWidth={2.2} /> : null}
            </button>

            {isOpen ? (
              <div className="clinical-ops-nav-group__children">
                {(section.items || []).map((item) => {
                  const Icon = iconFor(item.icon);
                  return (
                    <NavLink
                      key={item.id}
                      end
                      to={item.path}
                      title={item.label}
                      className={({ isActive: active }) => `clinical-ops-nav-link${active ? ' is-active' : ''}`}
                      onClick={onNavigate}
                    >
                      <Icon size={collapsed ? 18 : 15} strokeWidth={2.2} />
                      {!collapsed ? <span>{item.label}</span> : null}
                    </NavLink>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

const WORKLIST_TABS = [
  ['all', 'Tất cả'],
  ['stat', 'STAT / Urgent'],
  ['lab', 'Xét nghiệm'],
  ['specimen', 'Mẫu bệnh phẩm'],
  ['imaging', 'CĐHA'],
  ['procedure', 'Thủ thuật'],
  ['pending', 'Chờ duyệt / ký'],
  ['overdue', 'Quá SLA'],
  ['critical', 'Critical'],
];

const NOTIFICATION_TABS = [
  ['all', 'Tất cả'],
  ['critical', 'Critical'],
  ['stat', 'STAT / Urgent'],
  ['sla', 'Quá SLA'],
  ['specimen', 'Mẫu bệnh phẩm'],
  ['approval', 'Chờ duyệt'],
  ['imaging', 'CĐHA'],
  ['procedure', 'Thủ thuật'],
  ['system', 'Hệ thống'],
];

const SEARCH_GROUP_LABELS = {
  orders: 'Order',
  patients: 'Bệnh nhân',
  specimens: 'Specimen',
  lab_results: 'Lab result',
  imaging_reports: 'Imaging report',
  procedure_orders: 'Thủ thuật',
  attachments: 'Tệp',
  menus: 'Menu',
  quick_actions: 'Quick actions',
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCompactNumber(value) {
  const number = toNumber(value);
  if (number >= 1000) return `${Math.round(number / 100) / 10}k`;
  return String(number);
}

function relativeTime(value) {
  if (!value) return 'chưa đồng bộ';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'chưa đồng bộ';
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s trước`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

function routeForWorkItem(item = {}) {
  if (item.module === 'lab') return '/clinical-ops/tests/orders';
  if (item.module === 'imaging') return '/clinical-ops/imaging/orders';
  if (item.module === 'procedure') return '/clinical-ops/procedures/orders';
  return '/clinical-ops/orders/timeline';
}

function labelForWorkItem(item = {}) {
  return item.order_no
    || item.lab_order_no
    || item.imaging_order_no
    || item.procedure_order_no
    || item.title
    || item.entity_id
    || 'Work item';
}

function worklistItemMatchesTab(item = {}, tab = 'all') {
  if (tab === 'all') return true;
  if (tab === 'stat') return ['stat', 'urgent'].includes(item.priority);
  if (tab === 'lab') return item.module === 'lab';
  if (tab === 'specimen') return item.module === 'lab' && ['waiting_collection', 'waiting_receive', 'waiting_process', 'specimen_rejected'].includes(item.stage_code);
  if (tab === 'imaging') return item.module === 'imaging';
  if (tab === 'procedure') return item.module === 'procedure';
  if (tab === 'pending') return ['result_preliminary', 'report_draft', 'report_preliminary', 'technical_completed'].includes(item.stage_code);
  if (tab === 'overdue') return item.sla?.state === 'breached';
  if (tab === 'critical') return item.warnings?.includes('critical_unacknowledged');
  return true;
}

function notificationMatchesTab(item = {}, tab = 'all') {
  const text = normalizeText(`${item.title} ${item.message} ${item.event_type} ${item.notification_type}`);
  if (tab === 'all') return true;
  if (tab === 'critical') return item.priority === 'critical' || text.includes('critical');
  if (tab === 'stat') return text.includes('stat') || text.includes('urgent');
  if (tab === 'sla') return text.includes('sla') || text.includes('overdue') || text.includes('qua han');
  if (tab === 'specimen') return text.includes('specimen') || text.includes('mau');
  if (tab === 'approval') return text.includes('approval') || text.includes('duyet') || text.includes('ky');
  if (tab === 'imaging') return text.includes('imaging') || text.includes('cdha');
  if (tab === 'procedure') return text.includes('procedure') || text.includes('thu thuat');
  if (tab === 'system') return text.includes('system') || item.notification_type === 'system';
  return true;
}

function fallbackSearchGroups(menuItems = [], query = '') {
  const needle = normalizeText(query);
  const menus = menuItems
    .filter((item) => !needle || normalizeText(`${item.label} ${item.sectionLabel}`).includes(needle))
    .slice(0, 12)
    .map((item) => ({
      id: item.id,
      title: item.label,
      subtitle: item.sectionLabel,
      route: item.path,
      actions: [{ label: 'Mở', route: item.path }],
    }));
  return [{ key: 'menus', label: SEARCH_GROUP_LABELS.menus, items: menus }];
}

function searchGroupsFromPayload(payload, menuItems, query) {
  if (!payload) return fallbackSearchGroups(menuItems, query);
  return Object.entries(SEARCH_GROUP_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      items: Array.isArray(payload[key]) ? payload[key] : [],
    }))
    .filter((group) => group.items.length);
}

export function ClinicalOpsShell({ children }) {
  const auth = readStoredAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  const [sidebar, setSidebar] = useState(FALLBACK_SIDEBAR);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchPayload, setSearchPayload] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [syncStatus, setSyncStatus] = useState('connected');
  const [topbar, setTopbar] = useState(null);
  const [worklistOpen, setWorklistOpen] = useState(false);
  const [worklistTab, setWorklistTab] = useState('all');
  const [worklist, setWorklist] = useState({ summary: {}, items: [] });
  const [worklistLoading, setWorklistLoading] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [workItemBusy, setWorkItemBusy] = useState('');
  const { toasts, closeToast } = useClinicalOpsToasts();

  const menuItems = useMemo(() => flattenSidebar(sidebar), [sidebar]);
  const pageMeta = menuItems.find((item) => item.path === location.pathname) || getClinicalOpsPageMeta(location.pathname);
  const profile = topbar?.profile;
  const displayName = profile?.display_name || getStaffActorName(auth);
  const roleCodes = profile?.roles || auth?.user?.roles || [];
  const roleLabel = roleCodes?.includes('lab_manager')
    ? 'Điều phối cận lâm sàng'
    : roleCodes?.includes('radiologist')
      ? 'Bác sĩ CĐHA'
      : roleCodes?.includes('procedure_staff')
        ? 'Nhân sự thủ thuật'
        : 'Vận hành cận lâm sàng';
  const counters = topbar?.counters || {};
  const safetySummary = topbar?.safety_summary || {};
  const notifications = topbar?.notification_preview || [];
  const workspace = topbar?.workspace || {};
  const workspaceSwitcher = workspace?.workspace_switcher?.available_workspaces || [];
  const searchGroups = useMemo(
    () => searchGroupsFromPayload(searchPayload, menuItems, searchQuery),
    [searchPayload, menuItems, searchQuery],
  );
  const visibleWorklistItems = useMemo(
    () => (worklist.items || []).filter((item) => worklistItemMatchesTab(item, worklistTab)).slice(0, 80),
    [worklist.items, worklistTab],
  );
  const visibleNotifications = useMemo(
    () => notifications.filter((item) => notificationMatchesTab(item, notificationTab)).slice(0, 12),
    [notifications, notificationTab],
  );
  const alertTotal = toNumber(safetySummary.critical_total) + toNumber(safetySummary.sla_breached_total) + toNumber(safetySummary.escalation_total);

  async function syncCommandBar({ silent = false } = {}) {
    if (!silent) setSyncing(true);
    try {
      const payload = await clinicalOpsAPI.topbarBootstrap({ scope: 'all' });
      setTopbar(payload);
      setSyncStatus('connected');
      setLastSyncedAt(new Date());
      if (!silent) notifyClinicalOps({ tone: 'success', title: 'Đồng bộ ClinicalOps', message: 'Đã đồng bộ topbar và cảnh báo vận hành.' });
      if (payload?.sidebar?.sections?.length) {
        const apiLooksNarrow = payload.sidebar.role_scope === 'all' && payload.sidebar.sections.length < FALLBACK_SIDEBAR.sections.length;
        setSidebar(apiLooksNarrow || isSuperAdminAuth(auth) ? FALLBACK_SIDEBAR : payload.sidebar);
      }
    } catch (error) {
      setSyncStatus('degraded');
      if (!silent) notifyClinicalOps({ tone: 'danger', title: 'Đồng bộ ClinicalOps', message: 'Không thể đồng bộ realtime, đang dùng dữ liệu gần nhất.' });
      if (!topbar) {
        setTopbar({
          workspace: {
            code: 'clinical_operations',
            name: 'Cận lâm sàng & Thủ thuật',
            current_unit: 'Toàn bộ clinical ops',
            scope: 'all',
          },
          counters: {},
          safety_summary: {},
          notification_preview: [],
          quick_actions: [],
        });
      }
    } finally {
      if (!silent) setSyncing(false);
    }
  }

  useEffect(() => {
    syncCommandBar({ silent: true });
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setNotificationsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setWorklistOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const timer = window.setTimeout(async () => {
      const query = searchQuery.trim();
      if (!query) {
        setSearchPayload(null);
        return;
      }
      setSearchLoading(true);
      try {
        setSearchPayload(await clinicalOpsAPI.search({ q: query, scope: 'all', limit: 8 }));
      } catch (error) {
        setSearchPayload(null);
      } finally {
        setSearchLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchOpen, searchQuery]);

  async function openWorklistDrawer(nextTab = worklistTab) {
    setWorklistOpen(true);
    setWorklistTab(nextTab);
    setWorklistLoading(true);
    try {
      const payload = await clinicalOpsAPI.worklistToday({ scope: 'all', limit: 320 });
      setWorklist(payload || { summary: {}, items: [] });
      setLastSyncedAt(new Date());
      notifyClinicalOps({ title: 'Worklist hôm nay', message: `Đã tải ${formatCompactNumber(payload?.summary?.total || payload?.items?.length || 0)} việc.` });
    } catch (error) {
      setWorklist((current) => current || { summary: {}, items: [] });
      setSyncStatus('degraded');
      notifyClinicalOps({ tone: 'danger', title: 'Worklist hôm nay', message: 'Không thể tải worklist, vui lòng thử lại.' });
    } finally {
      setWorklistLoading(false);
    }
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  function handleLogout() {
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  function navigateFromSearch(path) {
    setSearchQuery('');
    setSearchOpen(false);
    if (path) navigate(path);
  }

  async function claimItem(item) {
    if (!item?.work_item_id) return;
    await runClinicalOpsAction({
      label: 'Nhận xử lý work item',
      run: () => clinicalOpsAPI.claimWorklistItem(item.work_item_id, { source: 'clinical_ops_command_bar' }),
      successMessage: `${labelForWorkItem(item)} đã được nhận xử lý.`,
      errorMessage: 'Không thể nhận xử lý work item.',
      setBusy: (busy) => setWorkItemBusy(busy ? item.work_item_id : ''),
      onSuccess: async () => {
        await openWorklistDrawer(worklistTab);
        await syncCommandBar({ silent: true });
      },
    });
  }

  async function releaseItem(item) {
    if (!item?.work_item_id) return;
    const reason = promptClinicalOpsText({
      title: 'Release work item',
      message: labelForWorkItem(item),
      defaultValue: 'release_from_command_bar',
    });
    if (!reason) return;
    await runClinicalOpsAction({
      label: 'Release work item',
      run: () => clinicalOpsAPI.releaseWorklistItem(item.work_item_id, { reason }),
      successMessage: `${labelForWorkItem(item)} đã được release.`,
      errorMessage: 'Không thể release work item.',
      setBusy: (busy) => setWorkItemBusy(busy ? item.work_item_id : ''),
      onSuccess: async () => {
        await openWorklistDrawer(worklistTab);
        await syncCommandBar({ silent: true });
      },
    });
  }

  return (
    <main className={`clinical-ops-workspace${collapsed ? ' is-sidebar-collapsed' : ''}${mobileOpen ? ' is-mobile-sidebar-open' : ''}`}>
      <aside className="clinical-ops-sidebar" aria-label="Menu vận hành cận lâm sàng">
        <div className="clinical-ops-sidebar__brand">
          <Link to="/staff/select-workspace" className="clinical-ops-sidebar__brand-link" onClick={closeMobile}>
            <span className="clinical-ops-sidebar__brand-mark" aria-hidden="true">
              <AppLogo variant="mark" alt="" aria-hidden="true" />
            </span>
            {!collapsed ? (
              <span className="clinical-ops-sidebar__brand-copy">
                <strong>{APP_BRAND_NAME}</strong>
                <small>Cận lâm sàng, CĐHA, thủ thuật</small>
              </span>
            ) : null}
          </Link>
        </div>

        <RoleAwareMenuRenderer sidebar={sidebar} collapsed={collapsed} onNavigate={closeMobile} />

        <div className="clinical-ops-sidebar__footer">
          {!collapsed ? (
            <button type="button" className="clinical-ops-sidebar__alert" onClick={() => setSafetyOpen((current) => !current)}>
              <Siren size={17} strokeWidth={2.2} />
              <span>
                <strong>Trung tâm an toàn trọng yếu</strong>
                <small>{formatCompactNumber(alertTotal)} critical · SLA · escalation</small>
              </span>
            </button>
          ) : null}
          {safetyOpen && !collapsed ? (
            <div className="clinical-safety-panel">
              <header>
                <strong>Trung tâm an toàn trọng yếu</strong>
                <small>{relativeTime(safetySummary.last_updated_at || lastSyncedAt)}</small>
              </header>
              {(safetySummary.items || []).map((item) => (
                <button key={item.code} type="button" onClick={() => navigate(item.route)}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.severity}</small>
                  </span>
                  <b>{formatCompactNumber(item.count)}</b>
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="clinical-ops-sidebar__collapse"
            aria-label={collapsed ? 'Mở rộng menu bên' : 'Thu gọn menu bên'}
            onClick={() => setCollapsed((current) => !current)}
          >
            <ChevronsLeft className={collapsed ? 'is-rotated' : ''} size={18} strokeWidth={2.2} />
            {!collapsed ? <span>Thu gọn</span> : null}
          </button>
        </div>
      </aside>

      <div className="clinical-ops-mobile-backdrop" onClick={closeMobile} />

      <section className="clinical-ops-main">
        <header className="clinical-ops-topbar">
          <div className="clinical-ops-topbar__left">
            <button
              type="button"
              className="clinical-ops-icon-button clinical-ops-topbar__menu"
              aria-label="Mở menu vận hành cận lâm sàng"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} strokeWidth={2.2} />
            </button>
            <div className="clinical-ops-topbar__title">
              <span>{pageMeta.sectionLabel || 'Tổng quan'}</span>
              <strong>{pageMeta.label}</strong>
              <small>
                Scope: {workspace.current_unit || 'Toàn viện'} · Hôm nay · {syncStatus === 'connected' ? 'Realtime connected' : 'Realtime degraded'}
              </small>
              <div className="clinical-ops-scope-filters" aria-label="Bộ lọc nhanh vận hành cận lâm sàng">
                <button type="button" onClick={() => openWorklistDrawer('all')}>Hôm nay</button>
                <button type="button" onClick={() => openWorklistDrawer('stat')}>STAT</button>
                <button type="button" onClick={() => openWorklistDrawer('overdue')}>Quá SLA</button>
                <button type="button" onClick={() => openWorklistDrawer('critical')}>Critical</button>
              </div>
            </div>
          </div>

          <div className="clinical-ops-topbar__tools">
            <div className={`clinical-ops-search${searchOpen ? ' is-open' : ''}`} ref={searchRef}>
              <Search size={17} strokeWidth={2.2} aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setSearchOpen(true)}
                placeholder="Tìm order, BN, specimen, kết quả, report..."
                aria-label="Tìm order, bệnh nhân, specimen, kết quả, report, thủ thuật"
              />
              <kbd>Ctrl K</kbd>
              {searchQuery ? (
                <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearchQuery('')}>
                  <X size={15} strokeWidth={2.2} />
                </button>
              ) : null}

              {searchOpen ? (
                <div className="clinical-ops-search__panel clinical-command-palette">
                  <header>
                    <strong>Tìm kiếm cận lâm sàng</strong>
                    <small>{searchLoading ? 'Đang tìm...' : 'Order · BN · specimen · result · report · menu'}</small>
                  </header>
                  <div className="clinical-command-palette__body">
                    {searchGroups.map((group) => (
                      <section key={group.key}>
                        <span>{group.label}</span>
                        {group.items.map((item) => (
                          <button key={`${group.key}-${item.id || item.route || item.title}`} type="button" onClick={() => navigateFromSearch(item.route || item.actions?.[0]?.route)}>
                            <strong>{item.title || item.label}</strong>
                            <small>{item.subtitle || item.description || group.label}</small>
                            {item.chips?.length ? (
                              <em>{item.chips.slice(0, 3).join(' · ')}</em>
                            ) : null}
                          </button>
                        ))}
                      </section>
                    ))}
                    {!searchGroups.some((group) => group.items.length) ? <div className="clinical-ops-search__empty">Không tìm thấy dữ liệu phù hợp.</div> : null}
                  </div>
                </div>
              ) : null}
            </div>

            <button type="button" className="clinical-ops-topbar__quick" onClick={() => openWorklistDrawer('all')}>
              <ClipboardCheck size={18} strokeWidth={2.25} />
              <span>Worklist hôm nay</span>
              <strong>{formatCompactNumber(counters.today_worklist)}</strong>
            </button>

            <div className="clinical-ops-dropdown" ref={notificationRef}>
              <button
                type="button"
                className="clinical-ops-icon-button"
                aria-label="Mở cảnh báo vận hành"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((current) => !current)}
              >
                <Bell size={19} strokeWidth={2.2} />
                {notifications.some((item) => !item.read_at) ? <span className="clinical-ops-icon-button__dot" /> : null}
              </button>
              {notificationsOpen ? (
                <div className="clinical-ops-dropdown__panel clinical-notification-center">
                  <header>
                    <strong>Thông báo vận hành</strong>
                    <span>{notifications.filter((item) => !item.read_at).length} chưa đọc</span>
                  </header>
                  <div className="clinical-notification-tabs">
                    {NOTIFICATION_TABS.map(([key, label]) => (
                      <button key={key} type="button" className={notificationTab === key ? 'is-active' : ''} onClick={() => setNotificationTab(key)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="clinical-notification-list">
                    {visibleNotifications.map((item) => (
                      <article key={item.id} className={`clinical-notification-card is-${item.priority || 'normal'}`}>
                        <span className="clinical-notification-card__icon"><Siren size={15} strokeWidth={2.2} /></span>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.message}</p>
                          <small>{relativeTime(item.created_at)} · {item.priority || 'normal'}</small>
                          <div>
                            <button type="button" onClick={() => navigate(item.route || '/clinical-ops/alerts')}>Mở liên quan</button>
                            <button type="button" onClick={() => openWorklistDrawer(item.priority === 'critical' ? 'critical' : 'all')}>Worklist</button>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!visibleNotifications.length ? (
                      <div className="clinical-ops-search__empty">Chưa có thông báo trong nhóm này.</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={`clinical-ops-icon-button clinical-sync-status is-${syncStatus}`}
              aria-label="Đồng bộ vận hành cận lâm sàng"
              title={syncStatus === 'connected' ? `Đã đồng bộ ${relativeTime(lastSyncedAt)}` : 'Mất realtime, bấm để đồng bộ lại'}
              onClick={() => syncCommandBar()}
            >
              <RefreshCw className={syncing ? 'is-spinning' : ''} size={18} strokeWidth={2.2} />
            </button>

            <div className="clinical-ops-profile" ref={profileRef}>
              <button
                type="button"
                className="clinical-ops-profile__trigger"
                aria-label="Mở menu tài khoản"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((current) => !current)}
              >
                <span className="clinical-ops-avatar">{getInitials(displayName)}</span>
                <span className="clinical-ops-profile__copy">
                  <strong>{displayName}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>

              {profileOpen ? (
                <div className="clinical-ops-profile__panel">
                  <div className="clinical-ops-profile__summary">
                    <span className="clinical-ops-avatar clinical-ops-avatar--large">{getInitials(displayName)}</span>
                    <div>
                      <strong>{displayName}</strong>
                      <span>{profile?.email || auth?.user?.email || auth?.user?.username || 'Tài khoản nhân sự'}</span>
                    </div>
                  </div>
                  <div className="clinical-profile-context">
                    <span>Không gian: Cận lâm sàng và thủ thuật</span>
                    <span>Scope: {workspace.current_unit || 'Toàn viện'}</span>
                    <span>Vai trò: {roleLabel}</span>
                    <span>Realtime: {syncStatus === 'connected' ? 'Online' : 'Degraded'}</span>
                  </div>
                  <Link to="/staff/account" onClick={() => setProfileOpen(false)}>
                    <UserRound size={16} strokeWidth={2.2} />
                    Hồ sơ của tôi
                  </Link>
                  <Link to="/staff/security" onClick={() => setProfileOpen(false)}>
                    <ShieldAlert size={16} strokeWidth={2.2} />
                    Tài khoản & bảo mật
                  </Link>
                  <div className="clinical-workspace-switcher">
                    <span>Chọn không gian khác</span>
                    {workspaceSwitcher.slice(0, 8).map((item) => (
                      <Link key={item.code} to={item.route || '/staff/select-workspace'} onClick={() => setProfileOpen(false)}>
                        {item.name}
                      </Link>
                    ))}
                  </div>
                  <Link to="/staff/select-workspace" onClick={() => setProfileOpen(false)}>
                    <UserRound size={16} strokeWidth={2.2} />
                    Chọn không gian khác
                  </Link>
                  <button type="button" onClick={handleLogout}>
                    <LogOut size={16} strokeWidth={2.2} />
                    Đăng xuất
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="clinical-ops-content">{children}</div>
      </section>

      {worklistOpen ? (
        <div className="clinical-worklist-drawer" role="dialog" aria-modal="true" aria-label="Worklist hôm nay">
          <div className="clinical-worklist-drawer__backdrop" onClick={() => setWorklistOpen(false)} />
          <aside>
            <header>
              <div>
                <span>Clinical worklist</span>
                <strong>Worklist hôm nay</strong>
                <small>{worklistLoading ? 'Đang đồng bộ...' : `${formatCompactNumber(worklist.summary?.total || visibleWorklistItems.length)} việc · ${relativeTime(lastSyncedAt)}`}</small>
              </div>
              <button type="button" className="clinical-ops-icon-button" aria-label="Đóng worklist" onClick={() => setWorklistOpen(false)}>
                <X size={18} strokeWidth={2.2} />
              </button>
            </header>
            <div className="clinical-worklist-drawer__tabs">
              {WORKLIST_TABS.map(([key, label]) => (
                <button key={key} type="button" className={worklistTab === key ? 'is-active' : ''} onClick={() => setWorklistTab(key)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="clinical-worklist-drawer__list">
              {visibleWorklistItems.map((item) => (
                <article key={item.work_item_id || item.entity_id} className={`clinical-worklist-item is-${item.priority || 'routine'}`}>
                  <div className="clinical-worklist-item__main">
                    <div>
                      <span>{item.module || 'ops'} · {item.priority || 'routine'} · {item.stage_label || item.status}</span>
                      <strong>{labelForWorkItem(item)}</strong>
                      <p>
                        {item.patient?.full_name || 'Chưa có BN'} · {item.department?.department_name || item.encounter?.encounter_code || 'Clinical Ops'}
                      </p>
                    </div>
                    <b className={`clinical-worklist-item__sla is-${item.sla?.state || 'normal'}`}>
                      {item.sla?.state === 'breached'
                        ? `Quá ${item.sla?.breached_minutes || 0}p`
                        : item.sla?.remaining_minutes !== undefined
                          ? `${item.sla.remaining_minutes}p`
                          : 'SLA'}
                    </b>
                  </div>
                  {item.warnings?.length || item.missing?.length ? (
                    <div className="clinical-worklist-item__chips">
                      {[...(item.warnings || []), ...(item.missing || [])].slice(0, 5).map((chip) => <span key={chip}>{chip}</span>)}
                    </div>
                  ) : null}
                  {item.lock ? (
                    <small className="clinical-worklist-item__lock">Đang xử lý bởi {item.lock.claimed_by?.name || 'nhân sự khác'}</small>
                  ) : null}
                  <div className="clinical-worklist-item__actions">
                    {item.lock ? (
                      <button type="button" disabled={workItemBusy === item.work_item_id} onClick={() => releaseItem(item)}>Release</button>
                    ) : (
                      <button type="button" disabled={workItemBusy === item.work_item_id} onClick={() => claimItem(item)}>Nhận xử lý</button>
                    )}
                    <button type="button" onClick={() => navigate(routeForWorkItem(item))}>Mở order</button>
                    <button type="button" onClick={() => navigate(`/clinical-ops/orders/timeline?item=${encodeURIComponent(item.work_item_id || item.entity_id || '')}`)}>Timeline</button>
                  </div>
                </article>
              ))}
              {!visibleWorklistItems.length ? (
                <div className="clinical-worklist-empty">Không có work item trong tab này.</div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
      <ClinicalOpsToastStack
        items={toasts}
        onClose={closeToast}
      />
    </main>
  );
}
