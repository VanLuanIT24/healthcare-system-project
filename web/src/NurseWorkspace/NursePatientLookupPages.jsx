import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  HeartPulse,
  History,
  IdCard,
  Image as ImageIcon,
  Layers3,
  Loader2,
  LockKeyhole,
  Mail,
  MoreHorizontal,
  Phone,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Table2,
  UserRound,
  Users,
} from 'lucide-react';
import { nursePatientLookupApi } from './nurseApi';

const STORAGE_KEY = 'nurse.patientLookup.selectedPatientId';

const tabs = [
  { key: 'profile', label: 'Hồ sơ', to: '/nurse/patient-lookup/profile', icon: UserRound },
  { key: 'encounters', label: 'Lượt khám', to: '/nurse/patient-lookup/encounter-history', icon: History },
  { key: 'vitals', label: 'Sinh hiệu', to: '/nurse/patient-lookup/vitals-history', icon: HeartPulse },
  { key: 'risks', label: 'Dị ứng / vấn đề', to: '/nurse/patient-lookup/allergies-problems', icon: ShieldAlert },
  { key: 'documents', label: 'Tài liệu', to: '/nurse/patient-lookup/clinical-documents', icon: FileText },
];

const demoPatientId = 'demo-patient-lookup';

const demoPatients = [
  {
    patient_id: demoPatientId,
    patient_code: 'BN-2026-001284',
    full_name: 'Nguyễn Minh An',
    date_of_birth: '1972-11-08T00:00:00.000Z',
    age: 53,
    gender: 'male',
    phone: '090****842',
    status: 'active',
  },
  {
    patient_id: 'demo-patient-lookup-2',
    patient_code: 'BN-2026-001512',
    full_name: 'Trần Hà My',
    date_of_birth: '1991-03-14T00:00:00.000Z',
    age: 35,
    gender: 'female',
    phone: '093****118',
    status: 'active',
  },
];

const demoSnapshot = {
  patient: {
    patient_id: demoPatientId,
    patient_code: 'BN-2026-001284',
    full_name: 'Nguyễn Minh An',
    date_of_birth: '1972-11-08T00:00:00.000Z',
    age: 53,
    gender: 'male',
    phone: '090****842',
    email: 'minhan@example.com',
    address: '12 Nguyễn Văn Trỗi, Phường 8, Quận Phú Nhuận, TP.HCM',
    national_id: '********8342',
    insurance_number: 'BHYT-79-***-2218',
    identity_verified: true,
    status: 'active',
    created_at: '2025-09-12T08:30:00.000Z',
    updated_at: '2026-05-18T09:42:00.000Z',
  },
  identifiers: [
    { identifier_id: 'id-1', identifier_type: 'mrn', identifier_value: 'MRN-001284', is_primary: true, issued_by: 'HIS', status: 'active' },
    { identifier_id: 'id-2', identifier_type: 'national_id', identifier_value: '********8342', issued_by: 'CCCD', status: 'active' },
    { identifier_id: 'id-3', identifier_type: 'insurance', identifier_value: 'BHYT-79-***-2218', issued_by: 'VSS', status: 'active' },
  ],
  account: { account_id: 'acc-1', username: 'minhan', status: 'active', email_verified: true, phone_verified: true, last_login_at: '2026-05-18T20:15:00.000Z' },
  relatives: [
    { relative_id: 'rel-1', full_name: 'Nguyễn Hoàng Nam', relationship: 'Con trai', phone: '091****992', is_primary_contact: true, is_emergency_contact: true, relationship_verified: true, status: 'active' },
    { relative_id: 'rel-2', full_name: 'Lê Thanh Bình', relationship: 'Vợ', phone: '098****742', is_primary_contact: false, is_emergency_contact: false, relationship_verified: true, status: 'active' },
  ],
  authorizations: [
    { authorization_id: 'auth-1', relative: { full_name: 'Nguyễn Hoàng Nam', relationship: 'Con trai' }, authorization_type: 'view_records', permissions: ['records.read', 'appointments.read'], status: 'approved', valid_from: '2026-01-01T00:00:00.000Z', valid_to: '2026-12-31T00:00:00.000Z' },
    { authorization_id: 'auth-2', relative: { full_name: 'Lê Thanh Bình', relationship: 'Vợ' }, authorization_type: 'payment', permissions: ['billing.pay'], status: 'pending', valid_from: '2026-05-18T00:00:00.000Z' },
  ],
  active_allergies: [
    { _id: 'alg-1', allergen: 'Penicillin', allergy_type: 'medication', reaction: 'Khó thở, nổi mề đay', severity: 'severe', status: 'active', onset_date: '2021-02-10T00:00:00.000Z' },
    { _id: 'alg-2', allergen: 'Iodinated contrast', allergy_type: 'contrast', reaction: 'Ban đỏ', severity: 'moderate', status: 'active', onset_date: '2024-08-20T00:00:00.000Z' },
  ],
  active_problems: [
    { _id: 'prob-1', problem_name: 'Tăng huyết áp', icd10_code: 'I10', severity: 'severe', status: 'active', onset_date: '2018-01-01T00:00:00.000Z' },
    { _id: 'prob-2', problem_name: 'Đái tháo đường type 2', icd10_code: 'E11', severity: 'moderate', status: 'active', onset_date: '2019-04-16T00:00:00.000Z' },
  ],
  latest_vitals: {
    vital_sign_id: 'vital-1',
    temperature: 37.9,
    heart_rate: 112,
    respiratory_rate: 22,
    systolic_bp: 168,
    diastolic_bp: 96,
    spo2: 94,
    weight: 72,
    height: 168,
    bmi: 25.5,
    pain_score: 3,
    severity: 'warning',
    recorded_at: '2026-05-19T08:45:00.000Z',
    recorded_by: { full_name: 'ĐD Hồng Mai' },
    abnormal_flags: [
      { field: 'heart_rate', message: 'Mạch nhanh', severity: 'warning', value: 112 },
      { field: 'systolic_bp', message: 'Huyết áp cao', severity: 'warning', value: 168 },
    ],
  },
  active_encounter: {
    encounter_id: 'enc-003',
    encounter_code: 'ENC-2026-003884',
    encounter_type: 'outpatient',
    status: 'in_progress',
    nursing_status: 'vital_done',
    start_time: '2026-05-19T07:35:00.000Z',
    chief_reason: 'Đau đầu, huyết áp tăng',
    department: { department_name: 'Tim mạch' },
    attending_doctor: { full_name: 'BS Trần Quốc Minh' },
  },
  latest_encounter: {
    encounter_id: 'enc-003',
    encounter_code: 'ENC-2026-003884',
    encounter_type: 'outpatient',
    status: 'in_progress',
    start_time: '2026-05-19T07:35:00.000Z',
    chief_reason: 'Đau đầu, huyết áp tăng',
    department: { department_name: 'Tim mạch' },
    attending_doctor: { full_name: 'BS Trần Quốc Minh' },
  },
  upcoming_appointments: [
    { _id: 'appt-1', appointment_time: '2026-05-26T02:00:00.000Z', appointment_type: 'outpatient', status: 'confirmed', department_id: { department_name: 'Nội tiết' }, doctor_id: { full_name: 'BS Nguyễn Lan' } },
  ],
  recent_prescriptions: [
    { _id: 'rx-1', prescription_no: 'RX-2026-00218', status: 'active', prescribed_at: '2026-05-19T09:15:00.000Z', note: 'Điều chỉnh thuốc huyết áp' },
  ],
  recent_lab_results: [
    { _id: 'lab-1', result_no: 'LAB-2026-00112', status: 'final', is_critical: false, reported_at: '2026-05-18T10:00:00.000Z', interpretation: 'HbA1c tăng' },
  ],
  recent_imaging_reports: [
    { _id: 'img-1', report_no: 'IMG-2026-00044', status: 'final', is_critical: false, reported_at: '2026-05-10T10:20:00.000Z', impression: 'Không ghi nhận tổn thương cấp' },
  ],
  recent_documents: [
    { _id: 'doc-1', type: 'medical_record', record_no: 'MR-2026-00288', title: 'Hồ sơ khám tim mạch', status: 'active', created_at: '2026-05-19T09:30:00.000Z' },
    { _id: 'att-1', type: 'attachment', original_name: 'dien-tim.pdf', mime_type: 'application/pdf', review_status: 'pending', scan_status: 'clean', created_at: '2026-05-19T09:40:00.000Z' },
  ],
  document_counters: {
    total_records: 9,
    finalized_records: 5,
    sealed_records: 2,
    archived_records: 1,
    voided_records: 0,
    total_attachments: 18,
    pending_review: 2,
    scan_pending: 1,
    scan_failed: 0,
    released_to_patient: 7,
  },
  billing_warning: { has_unpaid_invoice: true, unpaid_count: 1, total_balance_due: 750000, currency: 'VND', items: [{ invoice_no: 'INV-2026-0091', balance_due: 750000, status: 'issued' }] },
  duplicate_warning: { has_duplicate_warning: false, duplicate_count: 0, candidates: [] },
  risk_flags: {
    has_active_allergy: true,
    has_severe_allergy: true,
    has_active_problem: true,
    has_severe_problem: true,
    has_open_encounter: true,
    has_abnormal_latest_vitals: true,
    has_critical_lab_result: false,
    has_critical_imaging_result: false,
    has_pending_document_review: true,
    has_unpaid_invoice: true,
    identity_not_verified: false,
    has_duplicate_warning: false,
    has_pending_relative_authorization: true,
  },
  allowed_actions: {
    can_update_patient: true,
    can_update_sensitive: false,
    can_add_identifier: true,
    can_add_relative: true,
    can_create_authorization: true,
    can_view_clinical_summary: true,
    can_add_allergy: true,
    can_add_problem: true,
    can_record_vitals: true,
    can_create_nursing_note: true,
    can_view_documents: true,
    can_download_attachment: true,
    can_upload_attachment: true,
    can_export_record: true,
    can_start_break_glass: true,
  },
  recent_timeline: [
    { event_type: 'vital', title: 'Sinh hiệu', status: 'warning', description: 'T 37.9°C · M 112 · HA 168/96 · SpO2 94%', occurred_at: '2026-05-19T08:45:00.000Z' },
    { event_type: 'encounter', title: 'ENC-2026-003884', status: 'in_progress', description: 'Đau đầu, huyết áp tăng', occurred_at: '2026-05-19T07:35:00.000Z' },
    { event_type: 'attachment', title: 'dien-tim.pdf', status: 'active', description: 'Điện tim 12 chuyển đạo', occurred_at: '2026-05-19T09:40:00.000Z' },
  ],
};

const demoEncounterHistory = {
  patient_id: demoPatientId,
  items: [
    {
      encounter_id: 'enc-003',
      encounter_code: 'ENC-2026-003884',
      encounter_type: 'outpatient',
      status: 'in_progress',
      nursing_status: 'vital_done',
      start_time: '2026-05-19T07:35:00.000Z',
      chief_reason: 'Đau đầu, huyết áp tăng',
      department: { department_name: 'Tim mạch' },
      attending_doctor: { full_name: 'BS Trần Quốc Minh' },
      latest_vitals: demoSnapshot.latest_vitals,
      primary_diagnosis: { diagnosis_name: 'Tăng huyết áp chưa kiểm soát', icd10_code: 'I10', is_primary: true },
      orders_count: 4,
      lab_results_count: 2,
      imaging_reports_count: 1,
      prescriptions_count: 1,
      notes_count: 3,
      documents_count: 4,
      has_critical_lab: false,
      has_critical_imaging: false,
      has_unfinalized_record: true,
      allowed_actions: { can_hold: true, can_record_vitals: true, can_create_note: true, can_view_documents: true },
    },
    {
      encounter_id: 'enc-002',
      encounter_code: 'ENC-2026-002841',
      encounter_type: 'outpatient',
      status: 'completed',
      start_time: '2026-04-22T02:10:00.000Z',
      chief_reason: 'Tái khám nội tiết',
      department: { department_name: 'Nội tiết' },
      attending_doctor: { full_name: 'BS Nguyễn Lan' },
      latest_vitals: { temperature: 36.7, heart_rate: 84, systolic_bp: 138, diastolic_bp: 82, spo2: 97, severity: 'normal', recorded_at: '2026-04-22T02:20:00.000Z' },
      primary_diagnosis: { diagnosis_name: 'Đái tháo đường type 2', icd10_code: 'E11', is_primary: true },
      orders_count: 2,
      lab_results_count: 2,
      imaging_reports_count: 0,
      prescriptions_count: 1,
      notes_count: 2,
      documents_count: 2,
      has_critical_lab: false,
      has_critical_imaging: false,
      has_unfinalized_record: false,
    },
  ],
  pagination: { page: 1, limit: 20, total: 2, total_pages: 1 },
};

const demoVitalHistory = {
  patient_id: demoPatientId,
  latest: demoSnapshot.latest_vitals,
  summary: { total_records: 12, abnormal_count: 4, amended_count: 1, entered_in_error_count: 1, latest_recorded_at: demoSnapshot.latest_vitals.recorded_at },
  items: [
    { vital_sign: demoSnapshot.latest_vitals, encounter: demoSnapshot.active_encounter, recorded_by: { full_name: 'ĐD Hồng Mai' } },
    { vital_sign: { vital_sign_id: 'vital-2', temperature: 37.2, heart_rate: 98, respiratory_rate: 20, systolic_bp: 156, diastolic_bp: 92, spo2: 96, bmi: 25.4, pain_score: 2, severity: 'warning', recorded_at: '2026-05-19T07:50:00.000Z', abnormal_flags: [{ field: 'systolic_bp', message: 'Huyết áp cao', severity: 'warning' }] }, encounter: demoSnapshot.active_encounter, recorded_by: { full_name: 'ĐD Hồng Mai' } },
    { vital_sign: { vital_sign_id: 'vital-3', temperature: 36.8, heart_rate: 84, respiratory_rate: 18, systolic_bp: 134, diastolic_bp: 84, spo2: 98, bmi: 25.3, pain_score: 1, severity: 'normal', status: 'amended', recorded_at: '2026-05-01T03:00:00.000Z', abnormal_flags: [] }, encounter: { encounter_code: 'ENC-2026-002999' }, recorded_by: { full_name: 'ĐD Lan' } },
  ],
  pagination: { page: 1, limit: 25, total: 3, total_pages: 1 },
};

const demoTrends = {
  series: {
    systolic_bp: [
      { time: '2026-04-22T02:20:00.000Z', value: 138 },
      { time: '2026-05-01T03:00:00.000Z', value: 134 },
      { time: '2026-05-19T07:50:00.000Z', value: 156 },
      { time: '2026-05-19T08:45:00.000Z', value: 168 },
    ],
    diastolic_bp: [
      { time: '2026-04-22T02:20:00.000Z', value: 82 },
      { time: '2026-05-01T03:00:00.000Z', value: 84 },
      { time: '2026-05-19T07:50:00.000Z', value: 92 },
      { time: '2026-05-19T08:45:00.000Z', value: 96 },
    ],
    heart_rate: [
      { time: '2026-04-22T02:20:00.000Z', value: 84 },
      { time: '2026-05-01T03:00:00.000Z', value: 84 },
      { time: '2026-05-19T07:50:00.000Z', value: 98 },
      { time: '2026-05-19T08:45:00.000Z', value: 112 },
    ],
    temperature: [
      { time: '2026-04-22T02:20:00.000Z', value: 36.7 },
      { time: '2026-05-01T03:00:00.000Z', value: 36.8 },
      { time: '2026-05-19T07:50:00.000Z', value: 37.2 },
      { time: '2026-05-19T08:45:00.000Z', value: 37.9 },
    ],
    spo2: [
      { time: '2026-04-22T02:20:00.000Z', value: 97 },
      { time: '2026-05-01T03:00:00.000Z', value: 98 },
      { time: '2026-05-19T07:50:00.000Z', value: 96 },
      { time: '2026-05-19T08:45:00.000Z', value: 94 },
    ],
  },
};

const demoDocuments = {
  patient_id: demoPatientId,
  counters: demoSnapshot.document_counters,
  records: [
    { _id: 'rec-1', record_no: 'MR-2026-00288', title: 'Hồ sơ khám tim mạch', record_type: 'outpatient', summary: 'Đánh giá huyết áp, điều chỉnh thuốc.', status: 'active', opened_at: '2026-05-19T07:35:00.000Z', released_to_patient: false, encounter_id: { encounter_code: 'ENC-2026-003884' }, custodian_department_id: { department_name: 'Tim mạch' } },
    { _id: 'rec-2', record_no: 'MR-2026-00142', title: 'Hồ sơ tái khám nội tiết', record_type: 'outpatient', summary: 'Theo dõi HbA1c.', status: 'finalized', finalized_at: '2026-04-22T05:00:00.000Z', released_to_patient: true, encounter_id: { encounter_code: 'ENC-2026-002841' }, custodian_department_id: { department_name: 'Nội tiết' } },
  ],
  attachments: [
    { _id: 'att-1', original_name: 'dien-tim.pdf', file_name: 'ecg-12-leads.pdf', mime_type: 'application/pdf', file_size: 1280000, category: 'clinical', source: 'staff_upload', review_status: 'pending', scan_status: 'clean', visibility: 'care_team', released_to_patient: false, download_count: 2, created_at: '2026-05-19T09:40:00.000Z', can_preview: true },
    { _id: 'att-2', original_name: 'xet-nghiem-hba1c.pdf', file_name: 'hba1c.pdf', mime_type: 'application/pdf', file_size: 640000, category: 'lab', source: 'system', review_status: 'accepted', scan_status: 'clean', visibility: 'patient_visible', released_to_patient: true, download_count: 5, created_at: '2026-04-22T06:10:00.000Z', can_preview: true },
  ],
  timeline: demoSnapshot.recent_timeline,
  allowed_actions: demoSnapshot.allowed_actions,
};

const genderLabels = { male: 'Nam', female: 'Nữ', other: 'Khác', unknown: 'Chưa rõ' };
const statusLabels = {
  active: 'Hoạt động',
  inactive: 'Ngưng hoạt động',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  revoked: 'Đã thu hồi',
  draft: 'Nháp',
  finalized: 'Đã hoàn tất',
  sealed: 'Đã niêm phong',
  archived: 'Đã lưu trữ',
  voided: 'Đã hủy hiệu lực',
  completed: 'Hoàn tất',
  in_progress: 'Đang khám',
  on_hold: 'Tạm giữ',
  arrived: 'Đã đến',
  planned: 'Dự kiến',
  cancelled: 'Đã hủy',
  recorded: 'Đã ghi',
  amended: 'Đã sửa',
  entered_in_error: 'Nhập sai',
  warning: 'Cảnh báo',
  severe: 'Nặng',
  moderate: 'Vừa',
  mild: 'Nhẹ',
  life_threatening: 'Nguy hiểm',
  normal: 'Bình thường',
  critical: 'Nguy kịch',
  high: 'Cao',
  chronic: 'Mạn tính',
  resolved: 'Đã xử lý',
  primary: 'Chính',
  no_account: 'Chưa có tài khoản',
  confirmed: 'Đã xác nhận',
  final: 'Đã hoàn tất',
  issued: 'Đã phát hành',
  clean: 'Đã quét sạch',
  failed: 'Quét lỗi',
  infected: 'Có nguy cơ',
  accepted: 'Đã chấp nhận',
  care_team: 'Nhóm chăm sóc',
  patient_visible: 'Bệnh nhân xem được',
  staff_only: 'Chỉ nhân viên',
};

const identifierTypeLabels = {
  mrn: 'Mã hồ sơ',
  national_id: 'CCCD',
  insurance: 'BHYT',
  legacy: 'Mã cũ',
};

const authorizationTypeLabels = {
  view_records: 'Xem hồ sơ',
  payment: 'Thanh toán',
  appointments: 'Lịch hẹn',
};

const permissionLabels = {
  'records.read': 'Xem hồ sơ',
  'appointments.read': 'Xem lịch hẹn',
  'billing.pay': 'Thanh toán viện phí',
};

const allergyTypeLabels = {
  medication: 'Thuốc',
  contrast: 'Thuốc cản quang',
  food: 'Thực phẩm',
  environmental: 'Môi trường',
};

const encounterTypeLabels = {
  outpatient: 'Ngoại trú',
  inpatient: 'Nội trú',
  emergency: 'Cấp cứu',
};

const attachmentCategoryLabels = {
  clinical: 'Lâm sàng',
  lab: 'Xét nghiệm',
  imaging: 'CĐHA',
  system: 'Hệ thống',
};

const severityTone = {
  life_threatening: 'red',
  critical: 'red',
  severe: 'red',
  high: 'red',
  warning: 'amber',
  moderate: 'amber',
  mild: 'blue',
  normal: 'green',
  active: 'green',
  approved: 'green',
  pending: 'amber',
  in_progress: 'blue',
};

function textValue(value, fallback = '--') {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'object') {
    return value.full_name
      || value.patient_name
      || value.patient_code
      || value.department_name
      || value.encounter_code
      || value.record_no
      || value.title
      || value.original_name
      || fallback;
  }
  return fallback;
}

function listOf(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function getPatientId(value = {}) {
  return value.patient_id || value.id || value._id || '';
}

function formatDate(value, options = {}) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--/--/----';
  return date.toLocaleDateString('vi-VN', options);
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMoney(value, currency = 'VND') {
  const amount = Number(value || 0);
  return amount.toLocaleString('vi-VN', { style: 'currency', currency });
}

function vitalText(vital = {}) {
  if (!vital) return 'Chưa có sinh hiệu';
  const bp = vital.systolic_bp && vital.diastolic_bp ? `HA ${vital.systolic_bp}/${vital.diastolic_bp}` : null;
  return [
    vital.temperature !== undefined && vital.temperature !== null ? `T ${vital.temperature}°C` : null,
    vital.heart_rate !== undefined && vital.heart_rate !== null ? `M ${vital.heart_rate}` : null,
    vital.respiratory_rate !== undefined && vital.respiratory_rate !== null ? `NT ${vital.respiratory_rate}` : null,
    bp,
    vital.spo2 !== undefined && vital.spo2 !== null ? `SpO2 ${vital.spo2}%` : null,
  ].filter(Boolean).join(' · ') || 'Chưa có sinh hiệu';
}

function metricStatus(metric, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'empty';
  if (metric === 'temperature') return number >= 39 || number < 35 ? 'danger' : number >= 37.8 ? 'warning' : 'normal';
  if (metric === 'heart_rate') return number >= 130 || number < 50 ? 'danger' : number >= 110 ? 'warning' : 'normal';
  if (metric === 'spo2') return number < 90 ? 'danger' : number < 95 ? 'warning' : 'normal';
  if (metric === 'respiratory_rate') return number >= 30 || number < 8 ? 'danger' : number >= 22 ? 'warning' : 'normal';
  if (metric === 'systolic_bp') return number >= 180 || number < 90 ? 'danger' : number >= 140 ? 'warning' : 'normal';
  return 'normal';
}

function StatusPill({ value, tone }) {
  const resolvedTone = tone || severityTone[value] || 'slate';
  return <span className={`npl-pill npl-pill--${resolvedTone}`}>{statusLabels[value] || value || '--'}</span>;
}

function IconButton({ icon: Icon, label, disabled, onClick }) {
  return (
    <button type="button" className="npl-icon-action" title={label} disabled={disabled} onClick={onClick}>
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function KpiTile({ icon: Icon, label, value, detail, tone = 'blue' }) {
  return (
    <article className={`npl-kpi npl-kpi--${tone}`}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function EmptyState({ title = 'Chưa có dữ liệu', detail = 'Dữ liệu sẽ hiển thị khi hệ thống trả kết quả.' }) {
  return (
    <div className="npl-empty">
      <FileText size={22} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function PatientSearchBar({ query, setQuery, results, selectedPatientId, onSearch, onSelect, loading }) {
  return (
    <section className="npl-search-panel">
      <div className="npl-search-command">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSearch();
          }}
          placeholder="Tìm theo mã BN, họ tên, SĐT, thư điện tử, CCCD, BHYT"
        />
        <button type="button" onClick={onSearch}>
          {loading ? <Loader2 size={16} className="npl-spin" /> : <Search size={16} />}
          <span>Tìm</span>
        </button>
      </div>

      <div className="npl-search-filters">
        {['Mã BN', 'Họ tên', 'SĐT', 'Ngày sinh', 'CCCD', 'BHYT', 'Dị ứng đang hoạt động', 'Lượt khám đang mở', 'Chờ gộp hồ sơ'].map((item) => (
          <button key={item} type="button">
            <Filter size={13} />
            {item}
          </button>
        ))}
      </div>

      <div className="npl-search-results">
        {results.map((patient) => {
          const id = getPatientId(patient);
          return (
            <button
              key={id || patient.patient_code}
              type="button"
              className={selectedPatientId === id ? 'is-active' : ''}
              onClick={() => onSelect(patient)}
            >
              <span>
                <strong>{patient.patient_code || '--'}</strong>
                <small>{patient.full_name || patient.patient_name || 'Chưa rõ tên'}</small>
              </span>
              <span>{patient.age || '--'} tuổi · {genderLabels[patient.gender] || patient.gender || '--'}</span>
              <span>{patient.phone || '--'}</span>
              <StatusPill value={patient.status || 'active'} />
              <em>
                <Eye size={13} />
                Mở hồ sơ
              </em>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RiskFlagBar({ flags = {} }) {
  const entries = [
    ['has_severe_allergy', 'Dị ứng nặng', ShieldAlert, 'red'],
    ['has_active_problem', 'Vấn đề đang có', ClipboardList, 'amber'],
    ['has_open_encounter', 'Lượt khám đang mở', Stethoscope, 'blue'],
    ['has_abnormal_latest_vitals', 'Sinh hiệu bất thường', HeartPulse, 'red'],
    ['has_critical_lab_result', 'Xét nghiệm nguy kịch', Bell, 'red'],
    ['has_critical_imaging_result', 'CĐHA nguy kịch', ImageIcon, 'red'],
    ['has_pending_document_review', 'Tài liệu chờ rà soát', FileText, 'amber'],
    ['has_unpaid_invoice', 'Công nợ', AlertTriangle, 'amber'],
    ['has_duplicate_warning', 'Nghi trùng hồ sơ', Users, 'violet'],
    ['has_pending_relative_authorization', 'Ủy quyền chờ duyệt', LockKeyhole, 'amber'],
  ];
  return (
    <div className="npl-risk-bar">
      {entries.filter(([key]) => flags[key]).map(([key, label, Icon, tone]) => (
        <span key={key} className={`npl-risk-chip npl-risk-chip--${tone}`}>
          <Icon size={14} />
          {label}
        </span>
      ))}
      {!entries.some(([key]) => flags[key]) ? (
        <span className="npl-risk-chip npl-risk-chip--green">
          <CheckCircle2 size={14} />
          Chưa có cảnh báo nổi bật
        </span>
      ) : null}
    </div>
  );
}

function PatientStickyHeader({ snapshot, isDemo, loading, onRefresh }) {
  const patient = snapshot.patient || {};
  const actions = snapshot.allowed_actions || {};
  return (
    <header className="npl-sticky-header">
      <div className="npl-patient-identity">
        <span className="npl-avatar">{String(patient.full_name || 'BN').split(' ').slice(-2).map((part) => part[0]).join('').toUpperCase()}</span>
        <div>
          <span className="npl-eyebrow">{patient.patient_code || '--'} · {patient.identity_verified ? 'Đã xác thực danh tính' : 'Chưa xác thực'}</span>
          <h1>{patient.full_name || 'Chưa chọn bệnh nhân'}</h1>
          <p>
            {patient.age || '--'} tuổi · {genderLabels[patient.gender] || patient.gender || '--'} · NS {formatDate(patient.date_of_birth)} · {patient.phone || '--'} · {patient.email || '--'}
          </p>
        </div>
      </div>
      <div className="npl-header-side">
        <div className="npl-header-badges">
          <StatusPill value={patient.status || 'active'} />
          <StatusPill value={snapshot.account?.status || 'no_account'} tone={snapshot.account ? 'blue' : 'slate'} />
          {isDemo ? <StatusPill value="Dữ liệu mẫu" tone="amber" /> : null}
        </div>
        <RiskFlagBar flags={snapshot.risk_flags} />
        <div className="npl-header-actions">
          <IconButton icon={RefreshCw} label={loading ? 'Đang tải' : 'Làm mới'} onClick={onRefresh} />
          <IconButton icon={Copy} label="Sao chép mã BN" onClick={() => navigator.clipboard?.writeText(patient.patient_code || '')} />
          <IconButton icon={Plus} label="Ghi sinh hiệu" disabled={!actions.can_record_vitals} />
          <IconButton icon={FileText} label="Tạo ghi chú" disabled={!actions.can_create_nursing_note} />
          <IconButton icon={LockKeyhole} label="Mở khẩn cấp" disabled={!actions.can_start_break_glass} />
        </div>
      </div>
    </header>
  );
}

function PatientSidePanel({ snapshot }) {
  const patient = snapshot.patient || {};
  const latestVitals = snapshot.latest_vitals;
  return (
    <aside className="npl-side-panel">
      <section>
        <h2>Nhân khẩu</h2>
        <dl className="npl-definition-list">
          <div><dt>Mã chính</dt><dd>{patient.patient_code || '--'}</dd></div>
          <div><dt>Ngày sinh</dt><dd>{formatDate(patient.date_of_birth)}</dd></div>
          <div><dt>Giới tính</dt><dd>{genderLabels[patient.gender] || patient.gender || '--'}</dd></div>
          <div><dt>Điện thoại</dt><dd>{patient.phone || '--'}</dd></div>
          <div><dt>Thư điện tử</dt><dd>{patient.email || '--'}</dd></div>
          <div><dt>CCCD</dt><dd>{patient.national_id || '--'}</dd></div>
          <div><dt>BHYT</dt><dd>{patient.insurance_number || '--'}</dd></div>
        </dl>
      </section>

      <section>
        <h2>Cảnh báo</h2>
        <RiskFlagBar flags={snapshot.risk_flags} />
      </section>

      <section>
        <h2>Sinh hiệu gần nhất</h2>
        <VitalMiniGrid vital={latestVitals} />
        <p className="npl-side-note">{latestVitals ? `Đo lúc ${formatDateTime(latestVitals.recorded_at)} bởi ${textValue(latestVitals.recorded_by)}` : 'Chưa có sinh hiệu.'}</p>
      </section>

      <section>
        <h2>Dị ứng đang hoạt động</h2>
        <CompactList
          items={snapshot.active_allergies}
          empty="Không có dị ứng đang hoạt động"
          render={(item) => (
            <>
              <strong>{item.allergen}</strong>
              <span>{item.reaction || allergyTypeLabels[item.allergy_type] || item.allergy_type} · <StatusPill value={item.severity} /></span>
            </>
          )}
        />
      </section>

      <section>
        <h2>Thao tác nhanh</h2>
        <div className="npl-side-actions">
          <IconButton icon={UserRound} label="Cập nhật hồ sơ" disabled={!snapshot.allowed_actions?.can_update_patient} />
          <IconButton icon={IdCard} label="Thêm định danh" disabled={!snapshot.allowed_actions?.can_add_identifier} />
          <IconButton icon={Users} label="Thêm người thân" disabled={!snapshot.allowed_actions?.can_add_relative} />
          <IconButton icon={ShieldAlert} label="Thêm dị ứng" disabled={!snapshot.allowed_actions?.can_add_allergy} />
        </div>
      </section>
    </aside>
  );
}

function VitalMiniGrid({ vital }) {
  const cells = [
    ['temperature', 'Nhiệt độ', vital?.temperature, '°C'],
    ['heart_rate', 'Mạch', vital?.heart_rate, 'bpm'],
    ['systolic_bp', 'Huyết áp', vital?.systolic_bp && vital?.diastolic_bp ? `${vital.systolic_bp}/${vital.diastolic_bp}` : null, ''],
    ['spo2', 'SpO2', vital?.spo2, '%'],
    ['respiratory_rate', 'Nhịp thở', vital?.respiratory_rate, '/phút'],
    ['bmi', 'BMI', vital?.bmi, ''],
  ];
  return (
    <div className="npl-vital-mini-grid">
      {cells.map(([metric, label, value, unit]) => (
        <span key={metric} className={`is-${metricStatus(metric, typeof value === 'string' ? Number(value.split('/')[0]) : value)}`}>
          <small>{label}</small>
          <strong>{value ?? '--'}{value ? unit : ''}</strong>
        </span>
      ))}
    </div>
  );
}

function CompactList({ items = [], render, empty }) {
  if (!items?.length) return <p className="npl-muted">{empty}</p>;
  return (
    <div className="npl-compact-list">
      {items.slice(0, 5).map((item, index) => (
        <article key={item._id || item.id || index}>
          {render(item)}
        </article>
      ))}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, detail, actions }) {
  return (
    <header className="npl-section-header">
      <div>
        <Icon size={18} />
        <span>
          <strong>{title}</strong>
          {detail ? <small>{detail}</small> : null}
        </span>
      </div>
      {actions ? <aside>{actions}</aside> : null}
    </header>
  );
}

function ProfileView({ snapshot }) {
  const patient = snapshot.patient || {};
  return (
    <div className="npl-view-grid">
      <section className="npl-panel npl-panel--wide">
        <SectionHeader icon={UserRound} title="Thông tin hành chính" detail="Hồ sơ nhân khẩu, liên hệ và trạng thái xác thực" />
        <div className="npl-admin-grid">
          {[
            ['Họ tên', patient.full_name],
            ['Mã bệnh nhân', patient.patient_code],
            ['Ngày sinh', formatDate(patient.date_of_birth)],
            ['Tuổi', patient.age],
            ['Giới tính', genderLabels[patient.gender] || patient.gender],
            ['Số điện thoại', patient.phone],
            ['Thư điện tử', patient.email],
            ['Địa chỉ', patient.address],
            ['Trạng thái hồ sơ', statusLabels[patient.status] || patient.status],
            ['Xác thực danh tính', patient.identity_verified ? 'Đã xác thực' : 'Chưa xác thực'],
            ['Ngày tạo', formatDateTime(patient.created_at)],
            ['Cập nhật cuối', formatDateTime(patient.updated_at)],
          ].map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value || '--'}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="npl-panel">
        <SectionHeader icon={IdCard} title="Định danh" detail="MRN, CCCD, BHYT và mã legacy" actions={<IconButton icon={Plus} label="Thêm" disabled={!snapshot.allowed_actions?.can_add_identifier} />} />
        <div className="npl-entity-list">
          {snapshot.identifiers?.map((item) => (
            <article key={item.identifier_id}>
              <div>
                <strong>{item.identifier_value}</strong>
                <span>{identifierTypeLabels[item.identifier_type] || item.identifier_type} · {item.issued_by || 'Không rõ nơi cấp'}</span>
              </div>
              {item.is_primary ? <StatusPill value="primary" tone="blue" /> : <button type="button"><Copy size={14} /></button>}
            </article>
          ))}
        </div>
      </section>

      <section className="npl-panel">
        <SectionHeader icon={Users} title="Người thân" detail="Liên hệ chính và khẩn cấp" actions={<IconButton icon={Plus} label="Thêm" disabled={!snapshot.allowed_actions?.can_add_relative} />} />
        <div className="npl-entity-list">
          {snapshot.relatives?.map((item) => (
            <article key={item.relative_id}>
              <div>
                <strong>{item.full_name}</strong>
                <span>{item.relationship} · {item.phone || '--'}</span>
              </div>
              <div className="npl-inline-pills">
                {item.is_primary_contact ? <StatusPill value="Chính" tone="green" /> : null}
                {item.is_emergency_contact ? <StatusPill value="Khẩn cấp" tone="red" /> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="npl-panel">
        <SectionHeader icon={LockKeyhole} title="Ủy quyền" detail="Quyền người thân và trạng thái duyệt" actions={<IconButton icon={Plus} label="Tạo" disabled={!snapshot.allowed_actions?.can_create_authorization} />} />
        <div className="npl-entity-list">
          {snapshot.authorizations?.map((item) => (
            <article key={item.authorization_id}>
              <div>
                <strong>{textValue(item.relative)}</strong>
                <span>{authorizationTypeLabels[item.authorization_type] || item.authorization_type} · {(item.permissions || []).map((permission) => permissionLabels[permission] || permission).join(', ') || '--'}</span>
              </div>
              <StatusPill value={item.status} />
            </article>
          ))}
        </div>
      </section>

      <section className="npl-panel npl-panel--wide">
        <SectionHeader icon={History} title="Dòng thời gian tổng hợp" detail="Lượt khám, sinh hiệu, tài liệu, xét nghiệm, CĐHA và đơn thuốc" />
        <TimelineList items={snapshot.recent_timeline || []} />
      </section>
    </div>
  );
}

function TimelineList({ items = [] }) {
  if (!items.length) return <EmptyState title="Chưa có dòng thời gian" />;
  return (
    <ol className="npl-timeline">
      {items.map((item, index) => (
        <li key={`${item.event_type}-${item.entity_id || index}`}>
          <span />
          <div>
            <time>{formatDateTime(item.occurred_at || item.created_at)}</time>
            <strong>{item.title || item.event_type}</strong>
            <small>{item.description || statusLabels[item.status] || item.status}</small>
          </div>
          <StatusPill value={item.status || item.event_type} tone={item.is_critical ? 'red' : undefined} />
        </li>
      ))}
    </ol>
  );
}

function EncounterHistoryView({ data }) {
  const items = listOf(data.items);
  const [selectedId, setSelectedId] = useState(items[0]?.encounter_id || '');
  const selected = items.find((item) => item.encounter_id === selectedId) || items[0];

  useEffect(() => {
    if (!items.some((item) => item.encounter_id === selectedId)) setSelectedId(items[0]?.encounter_id || '');
  }, [items, selectedId]);

  return (
    <div className="npl-encounter-layout">
      <section className="npl-panel">
        <SectionHeader icon={History} title="Lịch sử lượt khám" detail={`${data.pagination?.total ?? items.length} lượt khám`} actions={<IconButton icon={RefreshCw} label="Làm mới" />} />
        <div className="npl-filter-row">
          <button type="button"><CalendarClock size={14} />30 ngày</button>
          <button type="button"><Stethoscope size={14} />Khoa</button>
          <button type="button"><AlertTriangle size={14} />Có nguy kịch</button>
          <button type="button"><FileText size={14} />Có tài liệu</button>
        </div>
        <div className="npl-encounter-feed">
          {items.map((item) => (
            <button key={item.encounter_id} type="button" className={selected?.encounter_id === item.encounter_id ? 'is-active' : ''} onClick={() => setSelectedId(item.encounter_id)}>
              <header>
                <strong>{item.encounter_code}</strong>
                <StatusPill value={item.status} />
              </header>
              <p>{item.chief_reason || 'Không ghi nhận lý do khám'}</p>
              <small>{formatDateTime(item.start_time)} · {textValue(item.department)} · {textValue(item.attending_doctor)}</small>
              <div>
                {item.has_critical_lab ? <StatusPill value="Xét nghiệm nguy kịch" tone="red" /> : null}
                {item.has_critical_imaging ? <StatusPill value="CĐHA nguy kịch" tone="red" /> : null}
                {item.has_unfinalized_record ? <StatusPill value="Record mở" tone="amber" /> : null}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="npl-panel npl-encounter-detail">
        {selected ? (
          <>
            <SectionHeader icon={Layers3} title={selected.encounter_code} detail={`${statusLabels[selected.status] || selected.status} · ${encounterTypeLabels[selected.encounter_type] || selected.encounter_type}`} />
            <div className="npl-encounter-summary-grid">
              <KpiTile icon={ClipboardList} label="Y lệnh" value={selected.orders_count || 0} detail="Y lệnh" tone="blue" />
              <KpiTile icon={Activity} label="Sinh hiệu" value={selected.latest_vitals ? 'Có' : 'Chưa'} detail={vitalText(selected.latest_vitals)} tone="green" />
              <KpiTile icon={FileText} label="Ghi chú" value={selected.notes_count || 0} detail="Ghi chú" tone="violet" />
              <KpiTile icon={FileText} label="Tài liệu" value={selected.documents_count || 0} detail="Hồ sơ/tệp" tone="amber" />
            </div>
            <section className="npl-clinical-snapshot">
              <h3>Tóm tắt lâm sàng</h3>
              <article>
                <span>Chẩn đoán chính</span>
                <strong>{selected.primary_diagnosis?.diagnosis_name || '--'}</strong>
                <small>{selected.primary_diagnosis?.icd10_code || ''}</small>
              </article>
              <article>
                <span>Sinh hiệu gần nhất</span>
                <strong>{vitalText(selected.latest_vitals)}</strong>
                <small>{formatDateTime(selected.latest_vitals?.recorded_at)}</small>
              </article>
              <article>
                <span>CLS</span>
                <strong>{selected.lab_results_count || 0} xét nghiệm · {selected.imaging_reports_count || 0} CĐHA</strong>
                <small>{selected.has_critical_lab || selected.has_critical_imaging ? 'Có kết quả nguy kịch' : 'Không có kết quả nguy kịch'}</small>
              </article>
            </section>
            <footer className="npl-action-grid">
              <IconButton icon={Eye} label="Mở chi tiết" />
              <IconButton icon={HeartPulse} label="Ghi sinh hiệu" disabled={!selected.allowed_actions?.can_record_vitals} />
              <IconButton icon={FileText} label="Tạo ghi chú" disabled={!selected.allowed_actions?.can_create_note} />
              <IconButton icon={ClipboardList} label="Xem y lệnh" />
              <IconButton icon={MoreHorizontal} label="Tạm giữ / tiếp tục" disabled={!selected.allowed_actions?.can_hold && !selected.allowed_actions?.can_resume} />
            </footer>
          </>
        ) : <EmptyState title="Chưa có lượt khám" />}
      </section>
    </div>
  );
}

function VitalHistoryView({ data, trends }) {
  const items = listOf(data.items);
  const latest = data.latest || items[0]?.vital_sign;
  return (
    <div className="npl-view-grid">
      <section className="npl-panel npl-panel--wide">
        <SectionHeader icon={HeartPulse} title="Sinh hiệu gần nhất" detail={latest ? `Đo lúc ${formatDateTime(latest.recorded_at)}` : 'Chưa có dữ liệu'} actions={<IconButton icon={Plus} label="Ghi sinh hiệu" />} />
        <VitalMiniGrid vital={latest} />
        <div className="npl-vital-alerts">
          {(latest?.abnormal_flags || []).map((flag, index) => (
            <span key={`${flag.field}-${index}`}>
              <AlertTriangle size={14} />
              {flag.message || flag.field}: {flag.value ?? '--'}
            </span>
          ))}
        </div>
      </section>

      <section className="npl-panel npl-panel--wide">
        <SectionHeader icon={Activity} title="Xu hướng sinh hiệu" detail="Huyết áp, mạch, nhiệt độ và SpO2" />
        <TrendBoard trends={trends} />
      </section>

      <section className="npl-panel npl-panel--wide">
        <SectionHeader icon={Table2} title="Bảng lịch sử sinh hiệu" detail={`${data.summary?.total_records ?? items.length} bản ghi`} actions={<><IconButton icon={Download} label="CSV" /><IconButton icon={FileText} label="PDF" /></>} />
        <div className="npl-table-wrap">
          <table className="npl-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Lượt khám</th>
                <th>Người đo</th>
                <th>Nhiệt độ</th>
                <th>Mạch</th>
                <th>HA</th>
                <th>SpO2</th>
                <th>BMI</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ vital_sign: vital, encounter, recorded_by }) => (
                <tr key={vital?.vital_sign_id || vital?._id}>
                  <td><strong>{formatDateTime(vital?.recorded_at)}</strong></td>
                  <td>{textValue(encounter)}</td>
                  <td>{textValue(recorded_by || vital?.recorded_by)}</td>
                  <td>{vital?.temperature ?? '--'}°C</td>
                  <td>{vital?.heart_rate ?? '--'}</td>
                  <td>{vital?.systolic_bp && vital?.diastolic_bp ? `${vital.systolic_bp}/${vital.diastolic_bp}` : '--'}</td>
                  <td>{vital?.spo2 ?? '--'}%</td>
                  <td>{vital?.bmi ?? '--'}</td>
                  <td><StatusPill value={vital?.severity || vital?.status || 'normal'} /></td>
                  <td><div className="npl-row-actions"><button type="button">Sửa</button><button type="button">So sánh</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="npl-panel npl-panel--wide">
        <SectionHeader icon={AlertTriangle} title="Phân tích bất thường" detail="Rule engine và trạng thái bản ghi" />
        <div className="npl-kpi-strip">
          <KpiTile icon={AlertTriangle} label="Bất thường" value={data.summary?.abnormal_count || 0} detail="Trong bộ lọc" tone="red" />
          <KpiTile icon={FileText} label="Đã chỉnh sửa" value={data.summary?.amended_count || 0} detail="Đã sửa" tone="amber" />
          <KpiTile icon={ShieldAlert} label="Nhập sai" value={data.summary?.entered_in_error_count || 0} detail="Bị loại" tone="slate" />
          <KpiTile icon={HeartPulse} label="Tổng bản ghi" value={data.summary?.total_records || items.length} detail="Lịch sử" tone="blue" />
        </div>
      </section>
    </div>
  );
}

function TrendBoard({ trends }) {
  const series = trends?.series || {};
  return (
    <div className="npl-trend-board">
      <TrendChart title="Huyết áp tâm thu" color="#dc2626" items={series.systolic_bp || []} unit="mmHg" />
      <TrendChart title="Mạch" color="#2563eb" items={series.heart_rate || []} unit="bpm" />
      <TrendChart title="Nhiệt độ" color="#d97706" items={series.temperature || []} unit="°C" />
      <TrendChart title="SpO2" color="#059669" items={series.spo2 || []} unit="%" />
    </div>
  );
}

function TrendChart({ title, items = [], color, unit }) {
  const values = items.map((item) => Number(item.value)).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;
  const points = items.map((item, index) => {
    const x = items.length === 1 ? 50 : (index / (items.length - 1)) * 100;
    const y = 88 - ((Number(item.value) - min) / range) * 72;
    return `${x},${y}`;
  }).join(' ');
  return (
    <article className="npl-trend-chart">
      <header>
        <span>{title}</span>
        <strong>{values.at(-1) ?? '--'}{values.length ? unit : ''}</strong>
      </header>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="88" x2="100" y2="88" />
        <line x1="0" y1="16" x2="100" y2="16" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <footer>
        <span>Min {values.length ? min : '--'}</span>
        <span>Max {values.length ? max : '--'}</span>
      </footer>
    </article>
  );
}

function RisksView({ data, snapshot }) {
  const allergies = data.active_allergies || snapshot.active_allergies || [];
  const problems = data.active_problems || snapshot.active_problems || [];
  const summary = data.risk_summary || {};
  return (
    <div className="npl-view-grid">
      <section className={`npl-allergy-banner ${summary.severe_allergy_count ? 'is-danger' : ''}`}>
        <ShieldAlert size={22} />
        <div>
          <span>{summary.severe_allergy_count ? 'CẢNH BÁO DỊ ỨNG NGUY HIỂM' : 'Dị ứng và vấn đề đang có'}</span>
          <strong>{summary.allergy_count ?? allergies.length} dị ứng đang hoạt động · {summary.problem_count ?? problems.length} vấn đề đang có</strong>
        </div>
        <button type="button"><Bell size={16} />Báo bác sĩ</button>
        <button type="button"><Copy size={16} />Sao chép cảnh báo</button>
      </section>

      <section className="npl-panel npl-panel--wide">
        <SectionHeader icon={ShieldAlert} title="Bảng dị ứng" detail="Tác nhân, phản ứng, mức độ và lượt khám ghi nhận" actions={<IconButton icon={Plus} label="Thêm dị ứng" disabled={!snapshot.allowed_actions?.can_add_allergy} />} />
        <div className="npl-table-wrap">
          <table className="npl-table">
            <thead><tr><th>Tác nhân</th><th>Loại</th><th>Phản ứng</th><th>Mức độ</th><th>Khởi phát</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {allergies.map((item) => (
                <tr key={item._id || item.allergy_id}>
                  <td><strong>{item.allergen}</strong></td>
                  <td>{allergyTypeLabels[item.allergy_type] || item.allergy_type || '--'}</td>
                  <td>{item.reaction || '--'}</td>
                  <td><StatusPill value={item.severity} /></td>
                  <td>{formatDate(item.onset_date)}</td>
                  <td><StatusPill value={item.status} /></td>
                  <td><div className="npl-row-actions"><button type="button">Sửa</button><button type="button">Xử lý xong</button><button type="button">Sao chép</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="npl-panel npl-panel--wide">
        <SectionHeader icon={ClipboardList} title="Bảng vấn đề lâm sàng" detail="Đang có, mạn tính, đã xử lý và nhập sai" actions={<IconButton icon={Plus} label="Thêm vấn đề" disabled={!snapshot.allowed_actions?.can_add_problem} />} />
        <div className="npl-problem-board">
          {['active', 'chronic', 'resolved', 'entered_in_error'].map((status) => {
            const laneItems = status === 'chronic'
              ? problems.filter((item) => ['moderate', 'severe'].includes(item.severity))
              : problems.filter((item) => (item.status || 'active') === status);
            return (
              <section key={status}>
                <h3>{statusLabels[status] || status}</h3>
                {laneItems.length ? laneItems.map((item) => (
                  <article key={`${status}-${item._id || item.problem_name}`}>
                    <strong>{item.problem_name}</strong>
                    <span>{item.icd10_code || '--'} · <StatusPill value={item.severity} /></span>
                    <small>Khởi phát {formatDate(item.onset_date)}</small>
                  </article>
                )) : <p>Không có</p>}
              </section>
            );
          })}
        </div>
      </section>

      <section className="npl-panel npl-panel--wide">
        <SectionHeader icon={Sparkles} title="Tóm tắt nguy cơ lâm sàng" detail="Dị ứng thuốc/cản quang, vấn đề nặng và kiểm tra nguy cơ thuốc" />
        <div className="npl-kpi-strip">
          <KpiTile icon={Pill} label="Dị ứng thuốc" value={summary.has_medication_allergy ? 'Có' : 'Không'} detail={`${data.medication_allergies?.length || 0} tác nhân`} tone={summary.has_medication_allergy ? 'red' : 'green'} />
          <KpiTile icon={ImageIcon} label="Cản quang" value={summary.has_contrast_allergy ? 'Có' : 'Không'} detail="CĐHA cần lưu ý" tone={summary.has_contrast_allergy ? 'red' : 'green'} />
          <KpiTile icon={Stethoscope} label="Cần báo BS" value={summary.needs_doctor_alert ? 'Có' : 'Không'} detail="Theo risk center" tone={summary.needs_doctor_alert ? 'red' : 'green'} />
          <KpiTile icon={ClipboardCheck} label="Vấn đề nặng" value={summary.severe_problem_count || 0} detail="Vấn đề nặng" tone="amber" />
        </div>
        <div className="npl-action-grid">
          <IconButton icon={Pill} label="Kiểm tra nguy cơ thuốc" />
          <IconButton icon={ShieldAlert} label="Kiểm tra dị ứng thuốc đang dùng" />
          <IconButton icon={Copy} label="Sao chép vào ghi chú điều dưỡng" />
        </div>
      </section>
    </div>
  );
}

function DocumentsView({ data, snapshot }) {
  const counters = data.counters || snapshot.document_counters || {};
  return (
    <div className="npl-document-layout">
      <section className="npl-panel npl-panel--full">
        <SectionHeader icon={FileText} title="Trung tâm tài liệu" detail="Hồ sơ bệnh án, tệp đính kèm, rà soát và phát hành" actions={<><IconButton icon={Plus} label="Tải lên" disabled={!snapshot.allowed_actions?.can_upload_attachment} /><IconButton icon={Download} label="Xuất hàng loạt" disabled={!snapshot.allowed_actions?.can_export_record} /></>} />
        <div className="npl-kpi-strip">
          <KpiTile icon={FileText} label="Tổng hồ sơ" value={counters.total_records || 0} detail="Hồ sơ bệnh án" tone="blue" />
          <KpiTile icon={BadgeCheck} label="Đã chốt" value={counters.finalized_records || 0} detail="Đã chốt" tone="green" />
          <KpiTile icon={LockKeyhole} label="Niêm phong" value={counters.sealed_records || 0} detail="Niêm phong" tone="violet" />
          <KpiTile icon={Layers3} label="Tệp đính kèm" value={counters.total_attachments || 0} detail="Tệp đính kèm" tone="amber" />
          <KpiTile icon={AlertTriangle} label="Chờ rà soát" value={counters.pending_review || 0} detail="Cần xử lý" tone="red" />
          <KpiTile icon={ShieldAlert} label="Quét lỗi" value={counters.scan_failed || 0} detail="Bảo mật" tone={counters.scan_failed ? 'red' : 'green'} />
        </div>
      </section>

      <aside className="npl-panel npl-document-filters">
        <h2>Bộ lọc</h2>
        {['Loại hồ sơ', 'Trạng thái', 'Lượt khám', 'Khoa lưu trữ', 'Trạng thái rà soát', 'Trạng thái quét', 'Hiển thị', 'Phát hành'].map((item) => (
          <button key={item} type="button"><Filter size={14} />{item}</button>
        ))}
      </aside>

      <section className="npl-panel npl-document-list">
        <SectionHeader icon={FileText} title="Hồ sơ bệnh án" detail={`${data.records?.length || 0} hồ sơ`} />
        <div className="npl-doc-card-list">
          {(data.records || []).map((record) => (
            <article key={record._id}>
              <header>
                <strong>{record.record_no}</strong>
                <StatusPill value={record.status} />
              </header>
              <h3>{record.title}</h3>
              <p>{record.summary || 'Không có tóm tắt'}</p>
              <footer>
                <span>{textValue(record.encounter_id)}</span>
                <span>{textValue(record.custodian_department_id)}</span>
                <span>{record.released_to_patient ? 'Đã phát hành' : 'Chỉ nhân viên'}</span>
              </footer>
              <div className="npl-row-actions"><button type="button">Xem</button><button type="button">Xuất</button><button type="button">Phát hành</button></div>
            </article>
          ))}
        </div>
      </section>

      <section className="npl-panel npl-document-preview">
        <SectionHeader icon={Eye} title="Xem trước và metadata" detail="Tệp được chọn gần nhất" />
        {(data.attachments || [])[0] ? (
          <AttachmentPreview attachment={data.attachments[0]} />
        ) : <EmptyState title="Chưa có tệp đính kèm" />}
      </section>

      <section className="npl-panel npl-panel--full">
        <SectionHeader icon={Layers3} title="Tệp đính kèm" detail="Xem trước, tải xuống, lưu trữ, khôi phục và phát hành" />
        <div className="npl-attachment-grid">
          {(data.attachments || []).map((attachment) => (
            <article key={attachment._id}>
              <div className="npl-attachment-thumb">
                {String(attachment.mime_type || '').startsWith('image/') ? <ImageIcon size={26} /> : <FileText size={26} />}
              </div>
              <strong>{attachment.original_name || attachment.file_name}</strong>
              <span>{attachmentCategoryLabels[attachment.category] || attachment.mime_type || '--'} · {Math.round(Number(attachment.file_size || 0) / 1024)} KB</span>
              <div className="npl-inline-pills">
                <StatusPill value={attachment.review_status} />
                <StatusPill value={attachment.scan_status} tone={attachment.scan_status === 'clean' ? 'green' : 'amber'} />
              </div>
              <footer>
                <button type="button" disabled={!attachment.can_preview}>Xem trước</button>
                <button type="button">Tải xuống</button>
                <button type="button">Lưu trữ</button>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AttachmentPreview({ attachment }) {
  const blocked = !attachment.can_preview || ['failed', 'infected'].includes(attachment.scan_status);
  return (
    <div className={`npl-preview-box ${blocked ? 'is-blocked' : ''}`}>
      {blocked ? <ShieldAlert size={36} /> : <FileText size={36} />}
      <strong>{attachment.original_name || attachment.file_name}</strong>
      <span>{blocked ? `Không xem trước: ${attachment.preview_blocked_reason || statusLabels[attachment.scan_status] || attachment.scan_status}` : 'Sẵn sàng xem trước'}</span>
      <dl className="npl-definition-list">
        <div><dt>Rà soát</dt><dd>{statusLabels[attachment.review_status] || attachment.review_status || '--'}</dd></div>
        <div><dt>Quét</dt><dd>{statusLabels[attachment.scan_status] || attachment.scan_status || '--'}</dd></div>
        <div><dt>Hiển thị</dt><dd>{statusLabels[attachment.visibility] || attachment.visibility || '--'}</dd></div>
        <div><dt>Lượt tải</dt><dd>{attachment.download_count || 0}</dd></div>
      </dl>
      <div className="npl-action-grid">
        <IconButton icon={Download} label="Tải xuống" />
        <IconButton icon={LockKeyhole} label="Liên kết bảo mật" />
        <IconButton icon={BadgeCheck} label="Phát hành" />
      </div>
    </div>
  );
}

function useLookupLoader(activeView, selectedPatientId, refreshToken) {
  const [state, setState] = useState({
    snapshot: demoSnapshot,
    viewData: null,
    trends: demoTrends,
    loading: true,
    isDemo: true,
    error: '',
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedPatientId || selectedPatientId.startsWith('demo')) {
        setState({
          snapshot: demoSnapshot,
          viewData: fallbackViewData(activeView),
          trends: demoTrends,
          loading: false,
          isDemo: true,
          error: '',
        });
        return;
      }

      setState((current) => ({ ...current, loading: true }));
      const snapshotPromise = activeView === 'profile'
        ? nursePatientLookupApi.getProfileCenter(selectedPatientId)
        : nursePatientLookupApi.getSnapshot(selectedPatientId);
      const viewPromise = loadViewData(activeView, selectedPatientId);
      const trendPromise = activeView === 'vitals' ? nursePatientLookupApi.getVitalTrends(selectedPatientId, { limit: 120 }) : Promise.resolve(null);
      const [snapshotResult, viewResult, trendResult] = await Promise.allSettled([snapshotPromise, viewPromise, trendPromise]);
      if (cancelled) return;

      const failed = [snapshotResult, viewResult, trendResult].find((result) => result.status === 'rejected');
      setState({
        snapshot: snapshotResult.status === 'fulfilled' ? snapshotResult.value : demoSnapshot,
        viewData: viewResult.status === 'fulfilled' ? viewResult.value : fallbackViewData(activeView),
        trends: trendResult.status === 'fulfilled' && trendResult.value ? trendResult.value : demoTrends,
        loading: false,
        isDemo: Boolean(failed),
        error: failed?.reason?.message || '',
      });
    }
    load().catch((error) => {
      if (!cancelled) {
        setState({
          snapshot: demoSnapshot,
          viewData: fallbackViewData(activeView),
          trends: demoTrends,
          loading: false,
          isDemo: true,
          error: error?.message || 'Không thể tải dữ liệu tra cứu bệnh nhân.',
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeView, selectedPatientId, refreshToken]);

  return state;
}

function loadViewData(activeView, patientId) {
  if (activeView === 'encounters') return nursePatientLookupApi.getEncounterHistory(patientId, { limit: 30 });
  if (activeView === 'vitals') return nursePatientLookupApi.getVitalHistory(patientId, { limit: 60 });
  if (activeView === 'risks') return nursePatientLookupApi.getClinicalRisks(patientId);
  if (activeView === 'documents') return nursePatientLookupApi.getDocumentCenter(patientId, { limit: 30 });
  return nursePatientLookupApi.getProfileCenter(patientId);
}

function fallbackViewData(activeView) {
  if (activeView === 'encounters') return demoEncounterHistory;
  if (activeView === 'vitals') return demoVitalHistory;
  if (activeView === 'risks') return {
    patient_id: demoPatientId,
    active_allergies: demoSnapshot.active_allergies,
    active_problems: demoSnapshot.active_problems,
    severe_allergies: demoSnapshot.active_allergies.filter((item) => item.severity === 'severe'),
    severe_problems: demoSnapshot.active_problems.filter((item) => item.severity === 'severe'),
    medication_allergies: demoSnapshot.active_allergies.filter((item) => item.allergy_type === 'medication'),
    contrast_allergies: demoSnapshot.active_allergies.filter((item) => item.allergy_type === 'contrast'),
    risk_summary: { allergy_count: 2, severe_allergy_count: 1, problem_count: 2, severe_problem_count: 1, has_contrast_allergy: true, has_medication_allergy: true, needs_doctor_alert: true },
    allowed_actions: demoSnapshot.allowed_actions,
  };
  if (activeView === 'documents') return demoDocuments;
  return demoSnapshot;
}

function PatientLookupWorkspace({ activeView }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(demoPatients);
  const [selectedPatientId, setSelectedPatientId] = useState(() => localStorage.getItem(STORAGE_KEY) || demoPatientId);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [searchError, setSearchError] = useState('');
  const { snapshot, viewData, trends, loading, isDemo, error } = useLookupLoader(activeView, selectedPatientId, refreshToken);

  useEffect(() => {
    handleSearch('');
  }, []);

  async function handleSearch(nextQuery = query) {
    setSearchLoading(true);
    try {
      const payload = await nursePatientLookupApi.searchPatients({ search: nextQuery, keyword: nextQuery, q: nextQuery, limit: 8 });
      const items = listOf(payload.items || payload);
      const normalized = items.length ? items : demoPatients;
      setResults(normalized);
      setSearchError('');
      const currentStillVisible = normalized.some((patient) => getPatientId(patient) === selectedPatientId);
      if (!currentStillVisible && normalized[0]) {
        const id = getPatientId(normalized[0]);
        setSelectedPatientId(id);
        localStorage.setItem(STORAGE_KEY, id);
      }
    } catch (searchLoadError) {
      setResults(demoPatients);
      setSearchError(searchLoadError?.message || 'Không thể tìm bệnh nhân.');
    } finally {
      setSearchLoading(false);
    }
  }

  function selectPatient(patient) {
    const id = getPatientId(patient);
    setSelectedPatientId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const activeContent = useMemo(() => {
    if (activeView === 'encounters') return <EncounterHistoryView data={viewData || demoEncounterHistory} />;
    if (activeView === 'vitals') return <VitalHistoryView data={viewData || demoVitalHistory} trends={trends || demoTrends} />;
    if (activeView === 'risks') return <RisksView data={viewData || fallbackViewData('risks')} snapshot={snapshot} />;
    if (activeView === 'documents') return <DocumentsView data={viewData || demoDocuments} snapshot={snapshot} />;
    return <ProfileView snapshot={snapshot} />;
  }, [activeView, snapshot, viewData, trends]);

  return (
    <section className="npl-page">
      <PatientSearchBar
        query={query}
        setQuery={setQuery}
        results={results}
        selectedPatientId={selectedPatientId}
        onSearch={() => handleSearch()}
        onSelect={selectPatient}
        loading={searchLoading}
      />

      {searchError ? <div className="nurse-dashboard-demo-note"><AlertTriangle size={16} />{searchError}</div> : null}
      {isDemo && error ? <div className="nurse-dashboard-demo-note"><AlertTriangle size={16} />API chưa phản hồi đầy đủ nên đang hiển thị dữ liệu mẫu. {error}</div> : null}

      <PatientStickyHeader
        snapshot={snapshot}
        isDemo={isDemo}
        loading={loading}
        onRefresh={() => setRefreshToken((value) => value + 1)}
      />

      <nav className="npl-tabs" aria-label="Tra cứu bệnh nhân">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink key={tab.key} to={tab.to} className={activeView === tab.key ? 'is-active' : ''}>
              <Icon size={16} />
              {tab.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="npl-layout">
        <PatientSidePanel snapshot={snapshot} />
        <main className="npl-content">
          {loading ? (
            <div className="npl-loading">
              <Loader2 size={26} className="npl-spin" />
              <strong>Đang đồng bộ hồ sơ bệnh nhân</strong>
            </div>
          ) : activeContent}
        </main>
      </div>
    </section>
  );
}

export function PatientProfileLookupPage() {
  return <PatientLookupWorkspace activeView="profile" />;
}

export function PatientEncounterHistoryLookupPage() {
  return <PatientLookupWorkspace activeView="encounters" />;
}

export function PatientVitalsHistoryLookupPage() {
  return <PatientLookupWorkspace activeView="vitals" />;
}

export function PatientAllergiesProblemsLookupPage() {
  return <PatientLookupWorkspace activeView="risks" />;
}

export function PatientClinicalDocumentsLookupPage() {
  return <PatientLookupWorkspace activeView="documents" />;
}
