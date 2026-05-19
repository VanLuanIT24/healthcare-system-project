import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Clock3,
  FileCheck2,
  FileText,
  FlaskConical,
  History,
  LayoutGrid,
  Microscope,
  ScanLine,
  Settings,
  ShieldAlert,
  Stethoscope,
  UserSquare2,
  Users,
  WalletCards,
} from 'lucide-react';

export const LAB_ACTORS = {
  LAB_TECHNICIAN: 'lab_technician',
  LAB_MANAGER: 'lab_manager',
  IMAGING_TECHNICIAN: 'imaging_technician',
  RADIOLOGIST: 'radiologist',
  PROCEDURE_STAFF: 'procedure_staff',
  DOCTOR: 'doctor',
  NURSE: 'nurse',
};

const {
  LAB_TECHNICIAN,
  LAB_MANAGER,
  IMAGING_TECHNICIAN,
  RADIOLOGIST,
  PROCEDURE_STAFF,
  DOCTOR,
  NURSE,
} = LAB_ACTORS;

const FULL_LAB_ROLES = new Set(['super_admin', 'admin']);

function menuItem(id, label, to, icon, actors = []) {
  return { id, label, to, icon, actors };
}

export const labMenuSections = [
  {
    id: 'overview',
    label: 'Tổng quan',
    icon: LayoutGrid,
    defaultOpen: true,
    children: [
      menuItem('overview-dashboard', 'Bảng điều khiển cận lâm sàng', '/lab/dashboard', LayoutGrid, [LAB_MANAGER]),
      menuItem('overview-action-items', 'Việc cần xử lý hôm nay', '/lab/overview/action-items', ClipboardCheck, [LAB_TECHNICIAN, IMAGING_TECHNICIAN, RADIOLOGIST, PROCEDURE_STAFF, DOCTOR]),
      menuItem('overview-urgent-orders', 'Chỉ định khẩn', '/lab/overview/urgent-orders', ShieldAlert, [LAB_TECHNICIAN, IMAGING_TECHNICIAN, PROCEDURE_STAFF]),
      menuItem('overview-critical-results', 'Kết quả nguy cấp', '/lab/overview/critical-results', ShieldAlert, [LAB_TECHNICIAN, LAB_MANAGER, RADIOLOGIST, DOCTOR]),
      menuItem('overview-pending-completion', 'Kết quả chờ hoàn tất', '/lab/overview/pending-completion', FileText, [DOCTOR]),
      menuItem('overview-pending-approval', 'Kết quả chờ duyệt / ký', '/lab/overview/pending-approval-signature', ClipboardCheck, [LAB_MANAGER, RADIOLOGIST]),
      menuItem('overview-overdue-orders', 'Chỉ định quá hạn', '/lab/overview/overdue-orders', Clock3, [LAB_MANAGER, IMAGING_TECHNICIAN, PROCEDURE_STAFF]),
    ],
  },
  {
    id: 'order-center',
    label: 'Trung tâm chỉ định',
    icon: ClipboardList,
    defaultOpen: true,
    children: [
      menuItem('orders-all', 'Tất cả chỉ định cận lâm sàng', '/lab/orders/all', ClipboardList, [DOCTOR]),
      menuItem('orders-pending-receive', 'Chỉ định chờ tiếp nhận', '/lab/orders/pending-receive', Clock3),
      menuItem('orders-received', 'Chỉ định đã tiếp nhận', '/lab/orders/received', CheckCircle2),
      menuItem('orders-in-progress', 'Chỉ định đang thực hiện', '/lab/orders/in-progress', Activity, [DOCTOR]),
      menuItem('orders-completed', 'Chỉ định hoàn tất', '/lab/orders/completed', BadgeCheck, [DOCTOR]),
      menuItem('orders-cancelled', 'Chỉ định bị hủy', '/lab/orders/cancelled', AlertTriangle),
      menuItem('orders-entry-errors', 'Chỉ định nhập sai', '/lab/orders/entry-errors', FileText),
      menuItem('orders-timeline', 'Dòng thời gian chỉ định', '/lab/orders/timeline', History, [DOCTOR]),
    ],
  },
  {
    id: 'tests',
    label: 'Xét nghiệm',
    icon: FlaskConical,
    defaultOpen: true,
    children: [
      menuItem('tests-orders', 'Chỉ định xét nghiệm', '/lab/tests/orders', ClipboardList, [LAB_TECHNICIAN, LAB_MANAGER]),
      menuItem('tests-waiting-specimen', 'Chờ lấy mẫu', '/lab/tests/waiting-specimen', Clock3, [LAB_TECHNICIAN]),
      menuItem('tests-collected', 'Đã lấy mẫu', '/lab/tests/specimen-collected', CheckCircle2, [LAB_TECHNICIAN]),
      menuItem('tests-waiting-receive', 'Chờ nhận mẫu', '/lab/tests/waiting-receive', Clock3, [LAB_TECHNICIAN]),
      menuItem('tests-processing', 'Đang xét nghiệm', '/lab/tests/processing', Activity, [LAB_TECHNICIAN]),
      menuItem('tests-result-entry', 'Nhập kết quả', '/lab/tests/result-entry', FileText, [LAB_TECHNICIAN]),
      menuItem('tests-pending-approval', 'Kết quả chờ duyệt', '/lab/tests/pending-approval', ClipboardCheck, [LAB_MANAGER]),
      menuItem('tests-approved-results', 'Kết quả đã duyệt', '/lab/tests/approved-results', BadgeCheck, [LAB_MANAGER]),
      menuItem('tests-corrections-needed', 'Kết quả cần sửa', '/lab/tests/corrections-needed', AlertTriangle, [LAB_TECHNICIAN, LAB_MANAGER]),
      menuItem('tests-critical-results', 'Kết quả xét nghiệm nguy cấp', '/lab/tests/critical-results', ShieldAlert, [LAB_MANAGER]),
    ],
  },
  {
    id: 'specimens',
    label: 'Mẫu bệnh phẩm',
    icon: Microscope,
    defaultOpen: false,
    children: [
      menuItem('specimens-list', 'Danh sách mẫu', '/lab/specimens', ClipboardList, [LAB_TECHNICIAN, LAB_MANAGER]),
      menuItem('specimens-waiting-collection', 'Mẫu chờ lấy', '/lab/specimens/waiting-collection', Clock3, [LAB_TECHNICIAN]),
      menuItem('specimens-collected', 'Mẫu đã lấy', '/lab/specimens/collected', CheckCircle2),
      menuItem('specimens-receive', 'Nhận mẫu', '/lab/specimens/receive', ClipboardPlus, [LAB_TECHNICIAN]),
      menuItem('specimens-reject', 'Từ chối mẫu', '/lab/specimens/reject', AlertTriangle, [LAB_TECHNICIAN, LAB_MANAGER]),
      menuItem('specimens-testing', 'Mẫu đang xét nghiệm', '/lab/specimens/testing', Activity, [LAB_TECHNICIAN]),
      menuItem('specimens-storage', 'Mẫu lưu kho', '/lab/specimens/storage', Microscope, [LAB_TECHNICIAN]),
      menuItem('specimens-destroyed', 'Mẫu đã hủy', '/lab/specimens/destroyed', AlertTriangle),
      menuItem('specimens-history', 'Lịch sử mẫu', '/lab/specimens/history', History, [LAB_MANAGER]),
    ],
  },
  {
    id: 'imaging',
    label: 'Chẩn đoán hình ảnh',
    icon: ScanLine,
    defaultOpen: true,
    children: [
      menuItem('imaging-orders', 'Chỉ định chẩn đoán hình ảnh', '/lab/imaging/orders', ClipboardList, [IMAGING_TECHNICIAN]),
      menuItem('imaging-waiting-schedule', 'Chờ xếp lịch', '/lab/imaging/waiting-schedule', Clock3, [IMAGING_TECHNICIAN]),
      menuItem('imaging-schedule', 'Lịch thực hiện', '/lab/imaging/schedule', CalendarDays, [IMAGING_TECHNICIAN]),
      menuItem('imaging-in-progress', 'Đang thực hiện', '/lab/imaging/in-progress', Activity, [IMAGING_TECHNICIAN]),
      menuItem('imaging-tech-complete', 'Hoàn tất kỹ thuật', '/lab/imaging/technical-complete', CheckCircle2, [IMAGING_TECHNICIAN]),
      menuItem('imaging-upload', 'Tải hình ảnh / tệp kết quả', '/lab/imaging/upload-files', FileText, [IMAGING_TECHNICIAN]),
      menuItem('imaging-no-show', 'Không đến thực hiện', '/lab/imaging/no-show', AlertTriangle, [IMAGING_TECHNICIAN]),
      menuItem('imaging-reports', 'Báo cáo chẩn đoán hình ảnh', '/lab/imaging/reports', FileText, [RADIOLOGIST]),
      menuItem('imaging-pending-signature', 'Báo cáo chờ ký', '/lab/imaging/pending-signature', ClipboardCheck, [RADIOLOGIST]),
      menuItem('imaging-signed', 'Báo cáo đã ký', '/lab/imaging/signed-reports', FileCheck2, [RADIOLOGIST]),
      menuItem('imaging-corrections', 'Báo cáo cần sửa', '/lab/imaging/corrections-needed', AlertTriangle, [RADIOLOGIST]),
      menuItem('imaging-critical-findings', 'Phát hiện hình ảnh nguy cấp', '/lab/imaging/critical-findings', ShieldAlert, [RADIOLOGIST]),
    ],
  },
  {
    id: 'procedures',
    label: 'Thủ thuật',
    icon: ClipboardPlus,
    defaultOpen: false,
    children: [
      menuItem('procedures-orders', 'Chỉ định thủ thuật', '/lab/procedures/orders', ClipboardList, [PROCEDURE_STAFF]),
      menuItem('procedures-waiting-schedule', 'Chờ xếp lịch', '/lab/procedures/waiting-schedule', Clock3, [PROCEDURE_STAFF]),
      menuItem('procedures-schedule', 'Lịch thủ thuật', '/lab/procedures/schedule', CalendarDays, [PROCEDURE_STAFF]),
      menuItem('procedures-prep', 'Chuẩn bị thủ thuật', '/lab/procedures/preparation', ClipboardCheck, [PROCEDURE_STAFF]),
      menuItem('procedures-in-progress', 'Đang thực hiện', '/lab/procedures/in-progress', Activity, [PROCEDURE_STAFF]),
      menuItem('procedures-results', 'Kết quả thủ thuật', '/lab/procedures/results', FileText, [PROCEDURE_STAFF]),
      menuItem('procedures-complete', 'Hoàn tất thủ thuật', '/lab/procedures/complete', CheckCircle2, [PROCEDURE_STAFF]),
      menuItem('procedures-no-show', 'Không đến thực hiện', '/lab/procedures/no-show', AlertTriangle, [PROCEDURE_STAFF]),
      menuItem('procedures-files', 'Tệp thủ thuật', '/lab/procedures/files', FileText, [PROCEDURE_STAFF]),
      menuItem('procedures-fees', 'Chi phí thủ thuật', '/lab/procedures/fees', WalletCards, [PROCEDURE_STAFF]),
    ],
  },
  {
    id: 'approvals',
    label: 'Duyệt và trả kết quả',
    icon: BadgeCheck,
    defaultOpen: false,
    children: [
      menuItem('approvals-lab', 'Chờ duyệt xét nghiệm', '/lab/approvals/lab', FlaskConical, [LAB_MANAGER]),
      menuItem('approvals-imaging', 'Chờ ký chẩn đoán hình ảnh', '/lab/approvals/imaging-signature', ScanLine, [RADIOLOGIST]),
      menuItem('approvals-procedure', 'Chờ xác nhận thủ thuật', '/lab/approvals/procedure-confirmation', ClipboardCheck),
      menuItem('approvals-returned-doctor', 'Kết quả đã trả bác sĩ', '/lab/approvals/returned-to-doctor', Stethoscope, [LAB_MANAGER, RADIOLOGIST]),
      menuItem('approvals-returned-patient', 'Kết quả đã trả bệnh nhân', '/lab/approvals/returned-to-patient', UserSquare2, [LAB_MANAGER, RADIOLOGIST]),
      menuItem('approvals-amend-needed', 'Kết quả cần điều chỉnh', '/lab/approvals/amend-needed', AlertTriangle, [LAB_MANAGER, RADIOLOGIST]),
      menuItem('approvals-history', 'Lịch sử duyệt / ký', '/lab/approvals/history', History, [LAB_MANAGER, RADIOLOGIST]),
    ],
  },
  {
    id: 'result-files',
    label: 'Tệp và tài liệu kết quả',
    icon: FileText,
    defaultOpen: false,
    children: [
      menuItem('files-imaging', 'Tệp chẩn đoán hình ảnh', '/lab/result-files/imaging', ScanLine, [IMAGING_TECHNICIAN]),
      menuItem('files-procedure', 'Tệp thủ thuật', '/lab/result-files/procedure', ClipboardPlus),
      menuItem('files-lab', 'Tệp xét nghiệm', '/lab/result-files/lab', FlaskConical),
      menuItem('files-missing', 'Tệp còn thiếu', '/lab/result-files/missing', AlertTriangle),
      menuItem('files-scan-errors', 'Tệp lỗi quét', '/lab/result-files/scan-errors', AlertTriangle, [IMAGING_TECHNICIAN]),
      menuItem('files-review', 'Tệp chờ rà soát', '/lab/result-files/pending-review', ClipboardCheck, [IMAGING_TECHNICIAN]),
      menuItem('files-released', 'Tệp đã phát hành', '/lab/result-files/released', FileCheck2),
    ],
  },
  {
    id: 'alerts',
    label: 'Cảnh báo',
    icon: ShieldAlert,
    defaultOpen: false,
    children: [
      menuItem('alerts-critical-unhandled', 'Kết quả nguy cấp chưa xử lý', '/lab/alerts/critical-unhandled', ShieldAlert),
      menuItem('alerts-critical-overdue', 'Kết quả nguy cấp quá hạn xác nhận', '/lab/alerts/critical-overdue-confirmation', Clock3),
      menuItem('alerts-rejected-specimens', 'Mẫu bị từ chối', '/lab/alerts/rejected-specimens', AlertTriangle),
      menuItem('alerts-overdue-orders', 'Chỉ định quá hạn', '/lab/alerts/overdue-orders', Clock3),
      menuItem('alerts-missing-files', 'Thiếu tệp kết quả', '/lab/alerts/missing-result-files', FileText),
      menuItem('alerts-corrections', 'Kết quả cần sửa', '/lab/alerts/corrections-needed', ClipboardCheck),
      menuItem('alerts-no-show-cancel', 'Không đến thực hiện / hủy bất thường', '/lab/alerts/no-show-abnormal-cancel', AlertTriangle),
    ],
  },
  {
    id: 'patient-lookup',
    label: 'Tra cứu bệnh nhân',
    icon: Users,
    defaultOpen: false,
    children: [
      menuItem('lookup-by-patient', 'Theo bệnh nhân', '/lab/patient-lookup/by-patient', Users, [DOCTOR]),
      menuItem('lookup-by-encounter', 'Theo lượt khám', '/lab/patient-lookup/by-visit', ClipboardList, [DOCTOR]),
      menuItem('lookup-lab-history', 'Lịch sử xét nghiệm', '/lab/patient-lookup/lab-history', FlaskConical, [DOCTOR]),
      menuItem('lookup-imaging-history', 'Lịch sử chẩn đoán hình ảnh', '/lab/patient-lookup/imaging-history', ScanLine, [DOCTOR]),
      menuItem('lookup-procedure-history', 'Lịch sử thủ thuật', '/lab/patient-lookup/procedure-history', ClipboardPlus, [DOCTOR]),
      menuItem('lookup-clinical-summary', 'Tổng hợp cận lâm sàng', '/lab/patient-lookup/clinical-summary', FileText, [DOCTOR]),
    ],
  },
  {
    id: 'catalog-settings',
    label: 'Danh mục và cấu hình',
    icon: Settings,
    defaultOpen: false,
    children: [
      menuItem('settings-lab-tests', 'Danh mục xét nghiệm', '/lab/settings/lab-test-catalog', Microscope, [LAB_MANAGER]),
      menuItem('settings-specimen-types', 'Loại mẫu bệnh phẩm', '/lab/settings/specimen-types', FlaskConical, [LAB_MANAGER]),
      menuItem('settings-imaging-modality', 'Danh mục phương tiện chẩn đoán hình ảnh', '/lab/settings/imaging-modalities', ScanLine),
      menuItem('settings-imaging-room-equipment', 'Phòng / thiết bị chẩn đoán hình ảnh', '/lab/settings/imaging-room-equipment', ScanLine),
      menuItem('settings-procedure-catalog', 'Danh mục thủ thuật', '/lab/settings/procedure-catalog', ClipboardList),
      menuItem('settings-procedure-checklist', 'Bảng kiểm thủ thuật', '/lab/settings/procedure-checklist', ClipboardCheck),
      menuItem('settings-time-commitments', 'Cam kết thời gian và cảnh báo', '/lab/settings/time-commitments-alerts', Bell, [LAB_MANAGER]),
      menuItem('settings-result-templates', 'Mẫu báo cáo kết quả', '/lab/settings/result-report-templates', FileText),
    ],
  },
  {
    id: 'nursing-related',
    label: 'Cận lâm sàng liên quan',
    icon: Activity,
    defaultOpen: true,
    actorOnly: true,
    children: [
      menuItem('nursing-patient-preparation', 'Bệnh nhân cần chuẩn bị', '/lab/nursing-related/patient-preparation', Users, [NURSE]),
      menuItem('nursing-waiting-specimen', 'Chờ lấy mẫu', '/lab/nursing-related/waiting-specimen', FlaskConical, [NURSE]),
      menuItem('nursing-imaging-schedule', 'Lịch chẩn đoán hình ảnh của bệnh nhân', '/lab/nursing-related/patient-imaging-schedule', ScanLine, [NURSE]),
      menuItem('nursing-procedure-schedule', 'Lịch thủ thuật của bệnh nhân', '/lab/nursing-related/patient-procedure-schedule', CalendarDays, [NURSE]),
      menuItem('nursing-following-orders', 'Chỉ định đang theo dõi', '/lab/nursing-related/following-orders', ClipboardList, [NURSE]),
      menuItem('nursing-available-results', 'Kết quả đã có', '/lab/nursing-related/available-results', FileCheck2, [NURSE]),
      menuItem('nursing-related-critical-alerts', 'Cảnh báo nguy cấp liên quan', '/lab/nursing-related/related-critical-alerts', ShieldAlert, [NURSE]),
    ],
  },
];

export function getLabRoles(authOrRoles = []) {
  const roles = Array.isArray(authOrRoles)
    ? authOrRoles
    : authOrRoles?.user?.roles || authOrRoles?.roles || [];
  return Array.isArray(roles) ? roles : [];
}

export function hasFullLabMenuAccess(roles = []) {
  return getLabRoles(roles).some((role) => FULL_LAB_ROLES.has(role));
}

export function getLabActorsForRoles(authOrRoles = []) {
  const roles = getLabRoles(authOrRoles);
  const actorSet = new Set();

  if (roles.includes('lab_technician')) actorSet.add(LAB_TECHNICIAN);
  if (roles.includes('lab_manager')) actorSet.add(LAB_MANAGER);
  if (roles.includes('imaging_technician')) actorSet.add(IMAGING_TECHNICIAN);
  if (roles.includes('radiologist')) actorSet.add(RADIOLOGIST);
  if (roles.includes('procedure_staff')) actorSet.add(PROCEDURE_STAFF);
  if (roles.includes('doctor')) actorSet.add(DOCTOR);
  if (roles.includes('nurse')) actorSet.add(NURSE);

  if (!actorSet.size && !hasFullLabMenuAccess(roles)) actorSet.add(LAB_TECHNICIAN);
  return Array.from(actorSet);
}

export function getLabMenuSectionsForRoles(authOrRoles = []) {
  const roles = getLabRoles(authOrRoles);

  if (hasFullLabMenuAccess(roles)) {
    return labMenuSections
      .filter((section) => !section.actorOnly)
      .map((section) => ({
        ...section,
        children: [...(section.children || [])],
      }));
  }

  const actors = getLabActorsForRoles(roles);
  return labMenuSections
    .map((section) => {
      const children = (section.children || []).filter((item) =>
        item.actors?.some((actor) => actors.includes(actor)),
      );

      if (!children.length) return null;
      return { ...section, children };
    })
    .filter(Boolean);
}

export function flattenLabMenu(sections = labMenuSections) {
  return sections.flatMap((section) =>
    (section.children || []).map((item) => ({
      ...item,
      sectionId: section.id,
      sectionLabel: section.label,
    })),
  );
}

export function getLabPageMeta(pathname = '/lab/dashboard') {
  const normalizedPath = pathname === '/lab' ? '/lab/dashboard' : pathname;
  const item = flattenLabMenu().find((entry) => entry.to === normalizedPath);

  return item || {
    id: 'overview-dashboard',
    label: 'Bảng điều khiển cận lâm sàng',
    sectionLabel: 'Tổng quan',
    to: '/lab/dashboard',
    icon: LayoutGrid,
  };
}
