const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const models = require('../models');
const { hashPassword } = require('../common/auth/password-hash');
const pharmacyOverviewCoverage = require('./pharmacy-overview-coverage');

const BASE_COUNT = 60;
const NURSE_WORKSPACE_COUNT = 96;
const DOCTOR_COUNT = 12;
const NURSE_COVERAGE_OFFSET = 1000;
const NURSE_COVERAGE_COUNT = 72;
const SEED_NAMESPACE = 'healthcare-vietnamese-demo-2026-05';
const DRY_RUN = process.argv.includes('--dry-run');
const SKIPPED_MODELS = new Set([
  'AuditLog',
  'AuthSession',
  'PasswordResetToken',
  'Counter',
  'IdempotencyRecord',
  'JobRunLog',
  'EventOutbox',
  'BreakGlassAccess',
]);
const RESET_BEFORE_UPSERT_MODELS = new Set([
  'ServicePreparationChecklist',
]);

const DAY_OFFSETS = [-30, -21, -14, -10, -7, -3, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 7, 14, 24];

const departmentSeeds = [
  ['KCC', 'Khoa Cấp cứu', 'clinical', 'Tầng trệt, khu tiếp nhận cấp cứu 24/7'],
  ['KTM', 'Khoa Tim mạch', 'clinical', 'Tòa A, tầng 3, khu can thiệp tim mạch'],
  ['KNT', 'Khoa Nội tổng quát', 'clinical', 'Tòa A, tầng 2, khu khám nội tổng hợp'],
  ['KNI', 'Khoa Nhi', 'clinical', 'Tòa B, tầng 2, khu khám và điều trị nhi'],
  ['KSP', 'Khoa Sản phụ khoa', 'clinical', 'Tòa B, tầng 4, khu chăm sóc mẹ và bé'],
  ['KNG', 'Khoa Ngoại tổng hợp', 'clinical', 'Tòa A, tầng 4, khu thủ thuật ngoại'],
  ['CDHA', 'Chẩn đoán hình ảnh', 'imaging', 'Tòa C, tầng 1, phòng X-quang, CT, MRI'],
  ['XN', 'Trung tâm Xét nghiệm', 'lab', 'Tòa C, tầng 2, hóa sinh, huyết học, vi sinh'],
  ['DUOC', 'Khoa Dược', 'pharmacy', 'Tòa D, tầng 1, nhà thuốc nội bộ'],
  ['TC', 'Phòng Tài chính - Thu ngân', 'non_clinical', 'Tòa hành chính, tầng 2'],
  ['CSKH', 'Phòng Chăm sóc khách hàng', 'admin', 'Sảnh chính, quầy hỗ trợ bệnh nhân'],
  ['CNTT', 'Trung tâm Công nghệ thông tin', 'admin', 'Tòa hành chính, tầng 4'],
];

const doctorDepartments = [1, 2, 3, 4, 5, 0, 6, 7, 1, 2, 4, 5];
const doctorSpecialties = [
  'Tim mạch can thiệp',
  'Nội tiết - Đái tháo đường',
  'Nhi hô hấp',
  'Sản phụ khoa',
  'Ngoại tiêu hóa',
  'Hồi sức cấp cứu',
  'Chẩn đoán hình ảnh',
  'Huyết học xét nghiệm',
  'Tim mạch tổng quát',
  'Nội thận',
  'Sản khoa nguy cơ cao',
  'Chấn thương chỉnh hình',
];

const staffProfiles = [
  ['Nguyễn Minh Quân', 'bs.minhquan', 1, 0, 'doctor'],
  ['Trần Hoài An', 'bs.hoaian', 2, 0, 'doctor'],
  ['Lê Thị Bảo Ngọc', 'bs.baongoc', 3, 0, 'doctor'],
  ['Phạm Gia Hân', 'bs.giahan', 4, 0, 'doctor'],
  ['Võ Đức Khang', 'bs.duckhang', 5, 0, 'doctor'],
  ['Đặng Quốc Bảo', 'bs.quocbao', 0, 0, 'doctor'],
  ['Bùi Thanh Tùng', 'bs.thanhtung', 6, 0, 'doctor'],
  ['Ngô Thùy Linh', 'bs.thuylinh', 7, 0, 'doctor'],
  ['Huỳnh Nam Phong', 'bs.namphong', 1, 0, 'doctor'],
  ['Đỗ Khánh Vy', 'bs.khanhvy', 2, 0, 'doctor'],
  ['Mai Phương Thảo', 'bs.phuongthao', 4, 0, 'doctor'],
  ['Cao Anh Dũng', 'bs.anhdung', 5, 0, 'doctor'],
  ['Nguyễn Thị Mai Hương', 'dd.maihuong', 0, 1, 'nurse'],
  ['Trần Quang Huy', 'dd.quanghuy', 2, 1, 'nurse'],
  ['Lê Kim Chi', 'dd.kimchi', 3, 1, 'nurse'],
  ['Phạm Thanh Tâm', 'dd.thanhtam', 4, 1, 'nurse'],
  ['Vũ Minh Châu', 'dd.minhchau', 5, 1, 'nurse'],
  ['Đặng Hải Yến', 'dd.haiyen', 1, 1, 'nurse'],
  ['Hoàng Tuấn Kiệt', 'xn.tuankiet', 7, 2, 'lab'],
  ['Nguyễn Thảo My', 'xn.thaomy', 7, 2, 'lab'],
  ['Trịnh Bảo Trâm', 'xn.baotram', 7, 2, 'lab'],
  ['Lê Quốc Việt', 'cdha.quocviet', 6, 3, 'imaging'],
  ['Phan Nhật Nam', 'cdha.nhatnam', 6, 3, 'imaging'],
  ['Võ Hồng Nhung', 'cdha.hongnhung', 6, 3, 'imaging'],
  ['Đinh Ngọc Khánh', 'duoc.ngockhanh', 8, 4, 'pharmacy'],
  ['Bùi Khánh Linh', 'duoc.khanhlinh', 8, 4, 'pharmacy'],
  ['Nguyễn Hữu Phúc', 'tn.huuphuc', 9, 5, 'billing'],
  ['Trần Diễm My', 'tn.diemmy', 9, 5, 'billing'],
  ['Lâm Gia Bảo', 'admin.giabao', 11, 6, 'admin'],
  ['Phạm Ánh Tuyết', 'cskh.anhtuyet', 10, 7, 'support'],
];

const patientProfiles = [
  ['Nguyễn Duy Khải', 'male', '1984-03-12', '12 Nguyễn Trãi, phường Bến Thành, Quận 1, TP. Hồ Chí Minh'],
  ['Trần Thị Thu Hà', 'female', '1991-07-25', '48 Lê Lợi, phường 4, TP. Mỹ Tho, Tiền Giang'],
  ['Lê Minh Khoa', 'male', '1978-11-02', '91 Phan Đình Phùng, phường 2, TP. Đà Lạt, Lâm Đồng'],
  ['Phạm Ngọc Lan', 'female', '1989-01-16', '23 Nguyễn Văn Cừ, phường An Hòa, TP. Cần Thơ'],
  ['Võ Thành Đạt', 'male', '2000-09-04', '16 Hai Bà Trưng, phường Vĩnh Ninh, TP. Huế'],
  ['Đặng Thùy Dương', 'female', '1996-05-29', '71 Trần Phú, phường Lộc Thọ, TP. Nha Trang'],
  ['Bùi Quang Hưng', 'male', '1969-12-11', '05 Nguyễn Du, phường 7, TP. Tuy Hòa, Phú Yên'],
  ['Ngô Phương Linh', 'female', '2012-08-21', '37 Lý Thường Kiệt, phường 6, TP. Vũng Tàu'],
  ['Huỳnh Đức Long', 'male', '1981-10-18', '128 Hoàng Văn Thụ, phường 9, quận Phú Nhuận, TP. Hồ Chí Minh'],
  ['Đỗ Bảo Châu', 'female', '1994-02-09', '42 Nguyễn Hữu Cảnh, phường 22, quận Bình Thạnh, TP. Hồ Chí Minh'],
  ['Mai Anh Tuấn', 'male', '1975-06-30', '19 Võ Văn Kiệt, phường Cầu Kho, Quận 1, TP. Hồ Chí Minh'],
  ['Cao Thị Thanh Bình', 'female', '1987-04-14', '83 Nguyễn Huệ, phường 1, TP. Bến Tre'],
  ['Tạ Hoàng Nam', 'male', '1999-03-05', '56 Cách Mạng Tháng Tám, phường 5, TP. Tây Ninh'],
  ['Dương Mỹ Hạnh', 'female', '1965-01-22', '11 Trần Hưng Đạo, phường Mỹ Bình, TP. Long Xuyên'],
  ['Phan Gia Huy', 'male', '2016-12-03', '24 Nguyễn Thị Minh Khai, TP. Thủ Đức, TP. Hồ Chí Minh'],
  ['Vũ Ngọc Mai', 'female', '1992-09-17', '68 Lạc Long Quân, phường 5, quận 11, TP. Hồ Chí Minh'],
  ['Lương Nhật Minh', 'male', '1983-08-08', '101 Nguyễn Kiệm, phường 3, quận Gò Vấp, TP. Hồ Chí Minh'],
  ['Châu Khánh Ly', 'female', '1972-05-19', '14 Pasteur, phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'],
  ['Hồ Việt Anh', 'male', '1990-10-27', '39 Điện Biên Phủ, phường 15, quận Bình Thạnh, TP. Hồ Chí Minh'],
  ['Kiều Minh Tâm', 'female', '1986-11-23', '07 Nguyễn Văn Linh, phường Tân Phong, Quận 7, TP. Hồ Chí Minh'],
  ['Trương Gia Bảo', 'male', '2007-02-18', '51 Quốc lộ 13, phường Hiệp Bình Phước, TP. Thủ Đức'],
  ['Hà Thuỳ Trang', 'female', '1998-07-07', '22 Lê Duẩn, phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'],
  ['Lý Quang Minh', 'male', '1958-04-01', '75 Nguyễn Chí Thanh, phường 12, Quận 5, TP. Hồ Chí Minh'],
  ['Đoàn Ngọc Ánh', 'female', '2002-06-15', '63 Trường Sơn, phường 2, quận Tân Bình, TP. Hồ Chí Minh'],
];

function buildAdditionalPatientProfiles() {
  const familyNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Cao', 'Dương'];
  const middleNames = ['Minh', 'Thanh', 'Quỳnh', 'Gia', 'Bảo', 'Ngọc', 'Khánh', 'Hoài', 'Thùy', 'Đức', 'Nhật', 'Phương'];
  const givenNames = [
    ['An', 'female'],
    ['Bình', 'male'],
    ['Chi', 'female'],
    ['Duy', 'male'],
    ['Hạnh', 'female'],
    ['Khôi', 'male'],
    ['Lâm', 'male'],
    ['My', 'female'],
    ['Nhi', 'female'],
    ['Phúc', 'male'],
    ['Quân', 'male'],
    ['Trang', 'female'],
    ['Uyên', 'female'],
    ['Việt', 'male'],
    ['Yến', 'female'],
    ['Sơn', 'male'],
  ];
  const addresses = [
    'đường Hải Phòng, phường Thạch Thang, quận Hải Châu, Đà Nẵng',
    'đường Nguyễn Văn Linh, phường Vĩnh Trung, quận Thanh Khê, Đà Nẵng',
    'đường Lê Duẩn, phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    'đường Cách Mạng Tháng Tám, phường 13, Quận 10, TP. Hồ Chí Minh',
    'phố Kim Mã, phường Ngọc Khánh, quận Ba Đình, Hà Nội',
    'phố Trần Duy Hưng, phường Trung Hòa, quận Cầu Giấy, Hà Nội',
    'đường Phan Chu Trinh, phường Tân Lợi, TP. Buôn Ma Thuột, Đắk Lắk',
    'đường Lê Thánh Tông, phường Ia Kring, TP. Pleiku, Gia Lai',
    'đường Nguyễn Huệ, phường Vĩnh Ninh, TP. Huế',
    'đường Tây Sơn, phường Ghềnh Ráng, TP. Quy Nhơn, Bình Định',
  ];

  return indexes(48).map((index) => {
    const [givenName, gender] = givenNames[index % givenNames.length];
    const fullName = `${familyNames[index % familyNames.length]} ${middleNames[(index + 3) % middleNames.length]} ${givenName}`;
    const birthYear = 1948 + ((index * 7) % 65);
    const birthMonth = String(1 + (index % 12)).padStart(2, '0');
    const birthDay = String(1 + ((index * 3) % 27)).padStart(2, '0');
    const houseNo = 12 + index * 3;
    return [
      fullName,
      gender,
      `${birthYear}-${birthMonth}-${birthDay}`,
      `${houseNo} ${addresses[index % addresses.length]}`,
    ];
  });
}

patientProfiles.push(...buildAdditionalPatientProfiles());

const roleSeeds = [
  ['vn_seed_bac_si', 'Bác sĩ khám bệnh', 90],
  ['vn_seed_dieu_duong', 'Điều dưỡng tiếp nhận', 70],
  ['vn_seed_ky_thuat_xet_nghiem', 'Kỹ thuật viên xét nghiệm', 60],
  ['vn_seed_ky_thuat_cdha', 'Kỹ thuật viên chẩn đoán hình ảnh', 60],
  ['vn_seed_duoc_si', 'Dược sĩ cấp phát', 60],
  ['vn_seed_thu_ngan', 'Nhân viên thu ngân', 55],
  ['vn_seed_quan_tri', 'Quản trị hệ thống bệnh viện', 100],
  ['vn_seed_cham_soc_khach_hang', 'Chăm sóc khách hàng', 45],
  ['vn_seed_quan_ly_khoa', 'Quản lý khoa', 80],
  ['vn_seed_bao_hiem', 'Chuyên viên bảo hiểm', 50],
  ['vn_seed_ho_so_benh_an', 'Nhân viên hồ sơ bệnh án', 50],
  ['vn_seed_dieu_phoi', 'Điều phối lịch khám', 65],
];

const permissionSeeds = [
  ['vn_seed.patient.read', 'Xem hồ sơ bệnh nhân', 'patients', 'read'],
  ['vn_seed.patient.update', 'Cập nhật hồ sơ bệnh nhân', 'patients', 'update'],
  ['vn_seed.appointment.manage', 'Quản lý lịch hẹn', 'appointments', 'manage'],
  ['vn_seed.queue.manage', 'Quản lý hàng đợi khám', 'queue', 'manage'],
  ['vn_seed.encounter.write', 'Ghi nhận lượt khám', 'encounters', 'write'],
  ['vn_seed.vital.create', 'Ghi sinh hiệu', 'vital_signs', 'create'],
  ['vn_seed.lab.process', 'Xử lý xét nghiệm', 'laboratory', 'process'],
  ['vn_seed.imaging.report', 'Lập báo cáo chẩn đoán hình ảnh', 'imaging', 'report'],
  ['vn_seed.prescription.verify', 'Kiểm tra đơn thuốc', 'pharmacy', 'verify'],
  ['vn_seed.dispense.create', 'Cấp phát thuốc', 'pharmacy', 'dispense'],
  ['vn_seed.invoice.issue', 'Phát hành hóa đơn', 'billing', 'issue'],
  ['vn_seed.payment.confirm', 'Xác nhận thanh toán', 'billing', 'confirm'],
  ['vn_seed.insurance.review', 'Duyệt hồ sơ bảo hiểm', 'insurance', 'review'],
  ['vn_seed.record.finalize', 'Hoàn tất bệnh án', 'records', 'finalize'],
  ['vn_seed.notification.send', 'Gửi thông báo', 'notifications', 'send'],
  ['vn_seed.support.reply', 'Phản hồi hỗ trợ', 'support', 'reply'],
  ['vn_seed.room.manage', 'Quản lý buồng giường', 'inpatient', 'manage_room'],
  ['vn_seed.admission.manage', 'Quản lý nhập viện', 'inpatient', 'manage_admission'],
  ['vn_seed.catalog.manage', 'Quản lý danh mục dịch vụ', 'catalog', 'manage'],
  ['vn_seed.stock.adjust', 'Điều chỉnh tồn kho thuốc', 'inventory', 'adjust'],
  ['vn_seed.report.read', 'Xem báo cáo vận hành', 'reports', 'read'],
  ['vn_seed.setting.update', 'Cập nhật cấu hình hệ thống', 'settings', 'update'],
  ['vn_seed.message.send', 'Gửi tin nhắn chăm sóc', 'messaging', 'send'],
  ['vn_seed.emergency.handle', 'Xử lý tình huống khẩn cấp', 'emergency', 'handle'],
];

const serviceSeeds = [
  ['KHAM-TM', 'Khám chuyên khoa Tim mạch', 'consultation', 250000],
  ['KHAM-NT', 'Khám Nội tổng quát', 'consultation', 220000],
  ['KHAM-NHI', 'Khám Nhi', 'consultation', 200000],
  ['XN-CBC', 'Tổng phân tích tế bào máu', 'lab', 120000],
  ['XN-GLU', 'Định lượng Glucose máu', 'lab', 90000],
  ['SA-BUNG', 'Siêu âm ổ bụng tổng quát', 'imaging', 280000],
  ['XQ-NGUC', 'Chụp X-quang ngực thẳng', 'imaging', 180000],
  ['CT-NAO', 'Chụp CT sọ não không cản quang', 'imaging', 1200000],
  ['TT-KHAU', 'Khâu vết thương phần mềm', 'procedure', 450000],
  ['GIUONG-NOI', 'Giường nội trú phòng thường', 'room', 650000],
  ['DD-TIEM', 'Dịch vụ tiêm truyền tại phòng khám', 'nursing', 150000],
  ['THUOC-DV', 'Dịch vụ cấp phát thuốc ngoại trú', 'pharmacy', 50000],
];

const labTests = [
  ['CBC', 'Tổng phân tích tế bào máu', 'Huyết học', 'Máu toàn phần', '10^9/L'],
  ['GLU', 'Glucose máu lúc đói', 'Hóa sinh', 'Huyết thanh', 'mmol/L'],
  ['CRE', 'Creatinine máu', 'Hóa sinh', 'Huyết thanh', 'µmol/L'],
  ['ALT', 'Men gan ALT', 'Hóa sinh', 'Huyết thanh', 'U/L'],
  ['AST', 'Men gan AST', 'Hóa sinh', 'Huyết thanh', 'U/L'],
  ['CRP', 'CRP định lượng', 'Miễn dịch', 'Huyết thanh', 'mg/L'],
  ['HbA1c', 'HbA1c', 'Hóa sinh', 'Máu toàn phần', '%'],
  ['TSH', 'TSH', 'Nội tiết', 'Huyết thanh', 'mIU/L'],
  ['UA', 'Tổng phân tích nước tiểu', 'Nước tiểu', 'Nước tiểu', ''],
  ['LIPID', 'Bộ mỡ máu', 'Hóa sinh', 'Huyết thanh', 'mmol/L'],
  ['DENGUE', 'Test nhanh Dengue NS1', 'Miễn dịch', 'Huyết thanh', ''],
  ['COVID-AG', 'Test nhanh kháng nguyên SARS-CoV-2', 'Vi sinh', 'Dịch tỵ hầu', ''],
];

const imagingSeeds = [
  ['XR-01', 'Máy X-quang kỹ thuật số 1', 'xray', 'Phòng XQ-101'],
  ['XR-02', 'Máy X-quang kỹ thuật số 2', 'xray', 'Phòng XQ-102'],
  ['US-01', 'Máy siêu âm tổng quát 1', 'ultrasound', 'Phòng SA-201'],
  ['US-02', 'Máy siêu âm tim mạch', 'ultrasound', 'Phòng SA-202'],
  ['CT-01', 'Máy CT 128 lát cắt', 'ct', 'Phòng CT-301'],
  ['MRI-01', 'Máy MRI 1.5 Tesla', 'mri', 'Phòng MRI-401'],
  ['MG-01', 'Máy chụp nhũ ảnh', 'mammography', 'Phòng MG-101'],
  ['FL-01', 'Máy tăng sáng truyền hình', 'fluoroscopy', 'Phòng FL-102'],
  ['XR-MOB', 'Máy X-quang di động', 'xray', 'Khu nội trú'],
  ['US-ER', 'Máy siêu âm cấp cứu', 'ultrasound', 'Khoa Cấp cứu'],
  ['CT-ER', 'Máy CT cấp cứu', 'ct', 'Khoa Cấp cứu'],
  ['MRI-02', 'Máy MRI 3.0 Tesla', 'mri', 'Phòng MRI-402'],
];

const medicationSeeds = [
  ['PARA500', 'Paracetamol', 'Hapacol 500', 'Viên nén', '500 mg', 'uống', 'viên', 1200],
  ['AMOX500', 'Amoxicillin', 'Amox 500', 'Viên nang', '500 mg', 'uống', 'viên', 2500],
  ['MET500', 'Metformin', 'Glucophage', 'Viên nén', '500 mg', 'uống', 'viên', 3200],
  ['ATOR20', 'Atorvastatin', 'Lipitor', 'Viên nén', '20 mg', 'uống', 'viên', 8500],
  ['LOS50', 'Losartan', 'Cozaar', 'Viên nén', '50 mg', 'uống', 'viên', 6200],
  ['OMEP20', 'Omeprazole', 'Omez', 'Viên nang', '20 mg', 'uống', 'viên', 3000],
  ['CET10', 'Cetirizine', 'Cetirizin 10', 'Viên nén', '10 mg', 'uống', 'viên', 1800],
  ['SALB100', 'Salbutamol', 'Ventolin', 'Bình xịt', '100 mcg/liều', 'hít', 'bình', 78000],
  ['INSGLA', 'Insulin glargine', 'Lantus', 'Bút tiêm', '100 IU/ml', 'tiêm dưới da', 'bút', 310000],
  ['CEF1G', 'Ceftriaxone', 'Rocephin', 'Lọ bột pha tiêm', '1 g', 'tiêm tĩnh mạch', 'lọ', 56000],
  ['ORS', 'Oresol', 'Oresol 245', 'Gói bột', '27.9 g', 'uống', 'gói', 1500],
  ['DIC50', 'Diclofenac', 'Voltaren', 'Viên nén', '50 mg', 'uống', 'viên', 2200],
];

const procedureSeeds = [
  ['PROC-KVT', 'Khâu vết thương phần mềm'],
  ['PROC-THAYBANG', 'Thay băng vết mổ'],
  ['PROC-NEP', 'Nẹp cố định chi'],
  ['PROC-CHICHAPXE', 'Chích rạch áp xe nhỏ'],
  ['PROC-NOISOI', 'Nội soi tiêu hóa chẩn đoán'],
  ['PROC-DIENTIM', 'Đo điện tim gắng sức'],
  ['PROC-KHIDUNG', 'Khí dung điều trị cơn hen'],
  ['PROC-TIEMKHOP', 'Tiêm thuốc nội khớp'],
  ['PROC-DATSONDE', 'Đặt sonde tiểu'],
  ['PROC-RUADAY', 'Rửa dạ dày cấp cứu'],
  ['PROC-THOCAT', 'Tháo bột cẳng tay'],
  ['PROC-TRUYENDICH', 'Truyền dịch theo dõi'],
];

const diagnosisSeeds = [
  ['I10', 'Tăng huyết áp vô căn'],
  ['E11.9', 'Đái tháo đường type 2 không biến chứng'],
  ['J20.9', 'Viêm phế quản cấp'],
  ['K29.7', 'Viêm dạ dày tá tràng'],
  ['M54.5', 'Đau thắt lưng'],
  ['R50.9', 'Sốt chưa rõ nguyên nhân'],
  ['J45.9', 'Hen phế quản'],
  ['N39.0', 'Nhiễm khuẩn tiết niệu'],
  ['E78.5', 'Rối loạn lipid máu'],
  ['H10.9', 'Viêm kết mạc'],
  ['S61.0', 'Vết thương hở ngón tay'],
  ['O21.0', 'Nôn nghén nhẹ'],
];

const allergySeeds = [
  ['medication', 'Penicillin', 'Nổi mề đay sau dùng kháng sinh nhóm beta-lactam'],
  ['food', 'Hải sản', 'Ngứa da và đỏ mắt sau ăn tôm cua'],
  ['environment', 'Phấn hoa', 'Hắt hơi, chảy mũi khi thay đổi thời tiết'],
  ['contrast', 'Thuốc cản quang iod', 'Mẩn đỏ sau chụp CT có cản quang'],
  ['latex', 'Latex', 'Ngứa vùng tiếp xúc găng tay y tế'],
  ['medication', 'Diclofenac', 'Đau thượng vị và nổi ban nhẹ'],
  ['food', 'Đậu phộng', 'Khó chịu họng sau ăn thực phẩm chứa đậu'],
  ['environment', 'Bụi nhà', 'Viêm mũi dị ứng kéo dài'],
  ['medication', 'Aspirin', 'Khó thở nhẹ sau dùng thuốc giảm đau'],
  ['food', 'Sữa bò', 'Đau bụng và tiêu chảy sau uống sữa'],
  ['other', 'Cồn sát khuẩn', 'Kích ứng da tại chỗ'],
  ['unknown', 'Chưa xác định', 'Bệnh nhân nhớ có tiền sử dị ứng nhưng chưa rõ tác nhân'],
];

const supportSubjects = [
  'Cần đổi lịch tái khám sang buổi chiều',
  'Hỏi về cách tải kết quả xét nghiệm',
  'Cần hỗ trợ xác nhận thanh toán QR',
  'Bổ sung thông tin bảo hiểm y tế',
  'Phản ánh thời gian chờ khám kéo dài',
  'Hỏi tình trạng cấp phát thuốc',
  'Yêu cầu chỉnh số điện thoại liên hệ',
  'Cần hướng dẫn đặt lịch cho người nhà',
  'Hỏi chi phí chụp CT sọ não',
  'Cần bản sao hồ sơ bệnh án',
  'Thông báo không nhận được email nhắc lịch',
  'Hỏi thủ tục nhập viện theo lịch hẹn',
];

function stableObjectId(label) {
  return new mongoose.Types.ObjectId(
    crypto.createHash('sha1').update(`${SEED_NAMESPACE}:${label}`).digest('hex').slice(0, 24),
  );
}

function idFor(modelName, index) {
  return stableObjectId(`${modelName}:${index}`);
}

function indexes(count = BASE_COUNT) {
  return Array.from({ length: count }, (_, index) => index);
}

function pad(index, length = 3) {
  return String(index + 1).padStart(length, '0');
}

function code(prefix, index) {
  return `${prefix}-${pad(index)}`;
}

function dateAt(index, hour = 8, minute = 0, extraDays = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + DAY_OFFSETS[index % DAY_OFFSETS.length] + extraDays);
  return date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function todayAt(hour = 8, minute = 0, extraDays = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + extraDays);
  return date;
}

function temporalBucket(index) {
  const offset = DAY_OFFSETS[index % DAY_OFFSETS.length];
  if (offset < -2) return 'past';
  if (offset <= 1) return 'present';
  return 'future';
}

function dayOffset(index) {
  return DAY_OFFSETS[index % DAY_OFFSETS.length];
}

function isTodaySeed(index) {
  return dayOffset(index) === 0;
}

function shiftName(index) {
  return pick(['morning', 'afternoon', 'night'], index);
}

function shiftStartHour(index) {
  return { morning: 7, afternoon: 14, night: 22 }[shiftName(index)] || 7;
}

function queueStatusForIndex(index) {
  if (isTodaySeed(index)) {
    return pick(['waiting', 'called', 'in_service', 'skipped', 'recalled', 'completed', 'no_show', 'waiting', 'called', 'in_service'], index);
  }
  if (temporalBucket(index) === 'past') return pick(['completed', 'completed', 'no_show', 'cancelled'], index);
  if (temporalBucket(index) === 'present') return pick(['waiting', 'called', 'in_service', 'skipped'], index);
  return 'waiting';
}

function nursingStageForIndex(index) {
  if (isTodaySeed(index)) {
    return pick([
      'waiting_nurse',
      'nurse_in_progress',
      'triage_pending',
      'triage_in_progress',
      'vital_pending',
      'triage_done',
      'vital_done',
      'ready_for_doctor',
      'completed',
      'waiting_nurse',
    ], index);
  }
  return temporalBucket(index) === 'future'
    ? 'waiting_nurse'
    : pick(['triage_done', 'vital_done', 'ready_for_doctor', 'completed'], index);
}

function taskStatusForIndex(index) {
  if (isTodaySeed(index)) {
    return pick(['assigned', 'accepted', 'todo', 'in_progress', 'blocked', 'waiting_doctor', 'done', 'assigned', 'in_progress', 'todo'], index);
  }
  if (temporalBucket(index) === 'past') return 'done';
  if (temporalBucket(index) === 'present') return pick(['assigned', 'in_progress', 'blocked', 'todo'], index);
  return 'todo';
}

function taskDueAt(index) {
  const base = dateAt(index, shiftStartHour(index), 20 + (index % 4) * 20);
  if (isTodaySeed(index) && index % 4 === 0) return addMinutes(base, -180);
  if (isTodaySeed(index) && index % 4 === 1) return addMinutes(base, -40);
  return base;
}

function pick(list, index) {
  return list[index % list.length];
}

function patientSeed(index) {
  return pick(patientProfiles, index);
}

function diagnosisSeed(index) {
  return pick(diagnosisSeeds, index);
}

function allergySeed(index) {
  return pick(allergySeeds, index);
}

function labTestSeed(index) {
  return pick(labTests, index);
}

function medicationSeed(index) {
  return pick(medicationSeeds, index);
}

function procedureSeed(index) {
  return pick(procedureSeeds, index);
}

function serviceSeed(index) {
  return pick(serviceSeeds, index);
}

function doctorSpecialty(index) {
  return pick(doctorSpecialties, index);
}

function supportSubject(index) {
  return pick(supportSubjects, index);
}

function stripVietnamese(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function phone(prefix, index) {
  return `${prefix}${String(1000000 + index).slice(-7)}`;
}

function patientId(index) {
  return idFor('Patient', index % patientProfiles.length);
}

function patientAccountId(index) {
  return idFor('PatientAccount', index % patientProfiles.length);
}

function relativeId(index) {
  return idFor('PatientRelative', index % patientProfiles.length);
}

function userId(index) {
  return idFor('User', index % staffProfiles.length);
}

function doctorId(index) {
  return userId(index % 12);
}

function nurseId(index) {
  return userId(12 + (index % 6));
}

function labUserId(index) {
  return userId(18 + (index % 3));
}

function radiologyUserId(index) {
  return userId(21 + (index % 3));
}

function pharmacistId(index) {
  return userId(24 + (index % 2));
}

function cashierId(index) {
  return userId(26 + (index % 2));
}

function adminUserId(index = 0) {
  return userId(28 + (index % 2));
}

function departmentId(index) {
  return idFor('Department', index % departmentSeeds.length);
}

function doctorDepartmentId(index) {
  return departmentId(doctorDepartments[index % doctorDepartments.length]);
}

function roleId(index) {
  return idFor('Role', index % roleSeeds.length);
}

function permissionId(index) {
  return idFor('Permission', index % permissionSeeds.length);
}

const orderOffsets = {
  lab: 0,
  imaging: BASE_COUNT,
  procedure: BASE_COUNT * 2,
  service: BASE_COUNT * 3,
  medication: BASE_COUNT * 4,
};

function orderId(type, index) {
  return idFor('Order', orderOffsets[type] + (index % BASE_COUNT));
}

function actorSnapshot(index, type = index % 2 === 0 ? 'patient' : 'staff') {
  return {
    actor_type: type,
    actor_id: type === 'patient' ? patientAccountId(index) : userId(index),
  };
}

function actorIdFor(type, index) {
  if (type === 'staff') return userId(index);
  if (type === 'patient') return patientAccountId(index);
  if (type === 'patient_relative') return relativeId(index);
  return stableObjectId(`${type}:${index}`);
}

function make(modelName, index, data) {
  const Model = models[modelName];
  const doc = {
    _id: idFor(modelName, index),
    ...data,
    created_at: dateAt(index, 7, index % 60),
    updated_at: dateAt(index, 9, index % 60),
  };

  if (Model?.schema?.path('created_by') && !doc.created_by) doc.created_by = adminUserId(index);
  if (Model?.schema?.path('updated_by') && !doc.updated_by) doc.updated_by = adminUserId(index);
  if (Model?.schema?.path('is_deleted')) doc.is_deleted = false;
  return doc;
}

function statusForAppointment(index) {
  const bucket = temporalBucket(index);
  if (bucket === 'past') return pick(['completed', 'completed', 'cancelled', 'no_show'], index);
  if (bucket === 'present') return pick(['confirmed', 'checked_in', 'in_consultation'], index);
  return pick(['booked', 'confirmed'], index);
}

function statusForEncounter(index) {
  const bucket = temporalBucket(index);
  if (bucket === 'past') return pick(['completed', 'completed', 'cancelled'], index);
  if (bucket === 'present') return pick(['arrived', 'in_progress', 'on_hold'], index);
  return 'planned';
}

function statusForOrder(index) {
  const bucket = temporalBucket(index);
  if (bucket === 'past') return pick(['completed', 'completed', 'cancelled'], index);
  if (bucket === 'present') return pick(['ordered', 'acknowledged', 'in_progress'], index);
  return pick(['draft', 'ordered'], index);
}

function statusForSchedule(index) {
  const bucket = temporalBucket(index);
  if (bucket === 'past') return 'completed';
  if (bucket === 'present') return 'active';
  return 'published';
}

function money(index, base = 180000) {
  return base + (index % 6) * 45000;
}

function invoiceMoney(index) {
  const subtotal = 420000 + (index % 8) * 85000;
  const discount = index % 4 === 0 ? 30000 : 0;
  const tax = 0;
  const insurance = index % 3 === 0 ? 120000 : 0;
  const total = subtotal - discount + tax;
  const paid = temporalBucket(index) === 'past' ? total : index % 2 === 0 ? Math.floor(total / 2) : 0;
  return {
    subtotal,
    discount,
    tax,
    insurance,
    total,
    paid,
    balance: Math.max(total - paid, 0),
  };
}

function buildDepartmentDocs() {
  return departmentSeeds.map(([codeValue, name, type, location], index) => make('Department', index, {
    department_code: `VN-${codeValue}`,
    department_name: name,
    department_type: type,
    location_note: location,
    head_user_id: index < 8 ? doctorId(index) : adminUserId(index),
    status: 'active',
  }));
}

function buildUserDocs(passwordHash) {
  return staffProfiles.map(([fullName, username, departmentIndex], index) => make('User', index, {
    department_id: departmentId(departmentIndex),
    username,
    password_hash: passwordHash,
    full_name: fullName,
    phone: phone('09', 2100000 + index),
    employee_code: `NV-2026-${pad(index)}`,
    email: `${username}@benhvienminhchau.vn`,
    status: 'active',
    last_login_at: dateAt(index, 8, 30),
    last_login_ip: `10.10.${Math.floor(index / 10)}.${20 + index}`,
    must_change_password: false,
    permission_version: 1,
    password_changed_at: dateAt(index, 6, 20),
    failed_login_attempts: 0,
    auth_provider: 'local',
    email_verified: true,
    email_verified_at: dateAt(index, 6, 30),
    phone_verified_at: dateAt(index, 6, 35),
  }));
}

function buildRoleDocs() {
  return roleSeeds.map(([roleCode, roleName, priority], index) => make('Role', index, {
    role_code: roleCode,
    role_name: roleName,
    description: `${roleName} dùng cho dữ liệu mẫu tiếng Việt.`,
    is_system: false,
    is_mutable: true,
    role_version: 1,
    priority_level: priority,
    status: 'active',
  }));
}

function buildPermissionDocs() {
  return permissionSeeds.map(([permissionCode, permissionName, moduleKey, actionKey], index) => make('Permission', index, {
    permission_code: permissionCode,
    permission_name: permissionName,
    module_key: moduleKey,
    action_key: actionKey,
    description: `${permissionName} trong bộ dữ liệu mẫu.`,
    is_system: false,
    is_mutable: true,
    permission_version: 1,
  }));
}

function buildRolePermissionDocs() {
  return indexes(permissionSeeds.length).map((index) => make('RolePermission', index, {
    role_id: roleId(index),
    permission_id: permissionId(index),
    is_active: true,
  }));
}

function buildUserRoleDocs() {
  return staffProfiles.map((staff, index) => make('UserRole', index, {
    user_id: userId(index),
    role_id: roleId(staff[3]),
    is_active: true,
  }));
}

function buildUserPreferenceDocs() {
  const actors = [
    ...staffProfiles.map((_, index) => ({ type: 'staff', id: userId(index), patientIndex: index })),
    ...patientProfiles.map((_, index) => ({ type: 'patient', id: patientAccountId(index), patientIndex: index })),
  ];
  return actors.map((actor, index) => {
    const type = actor.type;
    return make('UserPreference', index, {
      actor_type: type,
      actor_id: actor.id,
      default_patient_profile_id: type === 'patient' ? patientId(actor.patientIndex) : undefined,
      locale: 'vi-VN',
      timezone: 'Asia/Ho_Chi_Minh',
      theme: index % 2 === 0 ? 'light' : 'system',
      notification_channels: ['in_app', 'email'],
      critical_notifications_enabled: true,
    });
  });
}

function buildDoctorProfileDocs() {
  return indexes(DOCTOR_COUNT).map((index) => make('DoctorProfile', index, {
    user_id: doctorId(index),
    department_id: doctorDepartmentId(index),
    license_number: `CCHN-${2026}${pad(index)}`,
    specialty: doctorSpecialty(index),
    subspecialty: pick(['Điều trị ngoại trú', 'Theo dõi bệnh mạn tính', 'Can thiệp tối thiểu', 'Tư vấn phòng bệnh'], index),
    qualification: pick(['Bác sĩ chuyên khoa I', 'Thạc sĩ y khoa', 'Bác sĩ chuyên khoa II', 'Tiến sĩ y khoa'], index),
    academic_title: pick(['BS.CKI', 'ThS.BS', 'BS.CKII', 'TS.BS'], index),
    years_of_experience: 6 + index,
    consultation_duration_minutes: 20,
    consultation_fee: money(index, 220000),
    biography: `${staffProfiles[index][0]} có kinh nghiệm điều trị ${doctorSpecialties[index].toLowerCase()} và tư vấn chăm sóc sức khỏe bằng tiếng Việt.`,
    languages: ['Tiếng Việt', index % 3 === 0 ? 'Tiếng Anh' : 'Tiếng Việt chuyên ngành'],
    public_profile_enabled: true,
    status: 'active',
  }));
}

function buildSystemSettingDocs() {
  const settings = [
    ['vn.hospital.name', 'Tên bệnh viện', 'general', 'string', 'Bệnh viện Đa khoa Minh Châu'],
    ['vn.appointment.default_slot_minutes', 'Thời lượng khám mặc định', 'scheduling', 'number', 20],
    ['vn.queue.enable_sms', 'Bật nhắc số thứ tự qua SMS', 'queue', 'boolean', true],
    ['vn.billing.tax_rate', 'Thuế dịch vụ y tế', 'billing', 'number', 0],
    ['vn.portal.support_hours', 'Giờ hỗ trợ cổng bệnh nhân', 'portal', 'json', { from: '07:00', to: '20:00' }],
    ['vn.notification.channels', 'Kênh thông báo mặc định', 'notifications', 'array', ['in_app', 'email']],
    ['vn.pharmacy.low_stock_days', 'Số ngày cảnh báo tồn kho thuốc', 'pharmacy', 'number', 14],
    ['vn.lab.critical_notify_minutes', 'Thời gian báo kết quả nguy cấp', 'laboratory', 'number', 10],
    ['vn.imaging.release_final_only', 'Chỉ trả báo cáo hình ảnh đã duyệt', 'imaging', 'boolean', true],
    ['vn.records.release_language', 'Ngôn ngữ hồ sơ xuất cho bệnh nhân', 'records', 'string', 'vi-VN'],
    ['vn.inpatient.default_round_time', 'Giờ đi buồng mặc định', 'inpatient', 'string', '08:00'],
    ['vn.support.sla_hours', 'SLA hỗ trợ bệnh nhân', 'support', 'number', 24],
  ];
  return settings.map(([key, name, moduleKey, valueType, value], index) => make('SystemSetting', index, {
    setting_key: key,
    setting_name: name,
    module_key: moduleKey,
    value_type: valueType,
    setting_value: value,
    default_value: value,
    description: `${name} dùng trong môi trường dữ liệu mẫu.`,
    is_public: index % 3 === 0,
    is_sensitive: false,
    is_encrypted: false,
    status: 'active',
  }));
}

function buildPatientDocs() {
  return patientProfiles.map(([fullName, gender, birthDate, address], index) => {
    const slug = stripVietnamese(fullName).replace(/\s+/g, '.');
    return make('Patient', index, {
      patient_code: `BN-2026-${pad(index)}`,
      full_name: fullName,
      date_of_birth: new Date(`${birthDate}T00:00:00+07:00`),
      gender,
      phone: phone('08', 3300000 + index),
      email: `${slug}@gmail.com`,
      address,
      national_id: `079${String(100000000 + index).slice(-9)}`,
      insurance_number: `BHYT-${String(790000000000000 + index)}`,
      identity_verified_at: dateAt(index, 10, 0),
      identity_verified_by: userId(index),
      emergency_contact_name: patientProfiles[(index + 5) % patientProfiles.length][0],
      emergency_contact_phone: phone('07', 4400000 + index),
      status: 'active',
    });
  });
}

function buildPatientIdentifierDocs() {
  return patientProfiles.map((_, index) => make('PatientIdentifier', index, {
    patient_id: patientId(index),
    identifier_type: index % 2 === 0 ? 'mrn' : 'national_id',
    identifier_value: index % 2 === 0 ? `MRN-2026-${pad(index)}` : `079${String(100000000 + index).slice(-9)}`,
    is_primary: true,
  }));
}

function buildPatientAccountDocs(passwordHash) {
  return patientProfiles.map(([fullName], index) => {
    const slug = stripVietnamese(fullName).replace(/\s+/g, '.');
    return make('PatientAccount', index, {
      patient_id: patientId(index),
      username: `bn.${slug}.${pad(index)}`,
      email: `${slug}.portal@minhchau.example`,
      phone: phone('08', 3300000 + index),
      password_hash: passwordHash,
      status: 'active',
      last_login_at: dateAt(index, 19, 15),
      last_login_ip: `113.161.${index}.${30 + index}`,
      password_changed_at: dateAt(index, 8, 45),
      failed_login_attempts: 0,
      auth_provider: 'local',
      email_verified: true,
      email_verified_at: dateAt(index, 8, 50),
      phone_verified_at: dateAt(index, 8, 55),
    });
  });
}

function buildPatientRelativeDocs() {
  return patientProfiles.map((_, index) => {
    const relativeName = patientProfiles[(index + 7) % patientProfiles.length][0];
    return make('PatientRelative', index, {
      patient_id: patientId(index),
      full_name: relativeName,
      relationship: pick(['Vợ', 'Chồng', 'Mẹ', 'Cha', 'Anh trai', 'Em gái', 'Con gái', 'Con trai'], index),
      phone: phone('07', 5100000 + index),
      email: `${stripVietnamese(relativeName).replace(/\s+/g, '.')}.relative@minhchau.example`,
      national_id: `080${String(200000000 + index).slice(-9)}`,
      address: patientProfiles[index][3],
      is_emergency_contact: true,
      is_primary_contact: index % 2 === 0,
      relationship_verified: true,
      verified_by: userId(index),
      verified_at: dateAt(index, 9, 15),
      status: 'active',
    });
  });
}

function buildPatientAuthorizationDocs() {
  return indexes(BASE_COUNT).map((index) => make('PatientAuthorization', index, {
    patient_id: patientId(index),
    relative_id: relativeId(index),
    authorization_type: pick(['view_records', 'book_appointments', 'billing', 'receive_notifications', 'full_access'], index),
    valid_from: dateAt(index, 0, 0),
    valid_to: addDays(dateAt(index, 0, 0), 180),
    approved_by: userId(index),
    approved_at: dateAt(index, 10, 20),
    status: pick(['active', 'active', 'pending', 'expired'], index),
  }));
}

function buildPatientProfileChangeRequestDocs() {
  return indexes(BASE_COUNT).map((index) => make('PatientProfileChangeRequest', index, {
    patient_id: patientId(index),
    requested_by_actor: actorSnapshot(index, index % 3 === 0 ? 'patient_relative' : 'patient'),
    change_type: pick(['contact', 'address', 'identity', 'emergency_contact', 'basic_info'], index),
    old_value_snapshot: { phone: phone('08', 3300000 + index), ghi_chu: 'Thông tin trước khi bệnh nhân gửi yêu cầu.' },
    new_value: { phone: phone('08', 6600000 + index), ghi_chu: 'Bệnh nhân cung cấp số điện thoại mới.' },
    status: pick(['pending', 'approved', 'rejected', 'cancelled'], index),
    reviewed_by: index % 2 === 0 ? actorSnapshot(index, 'staff') : undefined,
    reviewed_at: index % 2 === 0 ? dateAt(index, 14, 0) : undefined,
    reason: 'Yêu cầu cập nhật thông tin hành chính từ cổng bệnh nhân.',
  }));
}

function buildDoctorScheduleDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const dayShift = index;
    const start = dateAt(index, 7 + (index % 2) * 6, 30, dayShift);
    const end = addMinutes(start, 240);
    return make('DoctorSchedule', index, {
      doctor_id: doctorId(index),
      department_id: doctorDepartmentId(index),
      work_date: dateAt(index, 0, 0, dayShift),
      shift_start: start,
      shift_end: end,
      schedule_type: pick(['outpatient_regular', 'outpatient_followup', 'emergency_oncall', 'procedure_block'], index),
      slot_duration_minutes: 20,
      max_patients: 12,
      room_note: `Phòng khám ${100 + index}`,
      status: statusForSchedule(index),
    });
  });
}

function buildScheduleSlotDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const start = dateAt(index, 8 + (index % 4), (index % 3) * 15, index);
    const appointmentStatus = statusForAppointment(index);
    const isActiveBooking = ['booked', 'confirmed', 'checked_in', 'in_consultation'].includes(appointmentStatus);
    return make('ScheduleSlot', index, {
      doctor_schedule_id: idFor('DoctorSchedule', index),
      doctor_id: doctorId(index),
      department_id: doctorDepartmentId(index),
      start_time: start,
      end_time: addMinutes(start, 20),
      capacity: 1,
      booked_count: isActiveBooking ? 1 : 0,
      appointment_id: isActiveBooking ? idFor('Appointment', index) : undefined,
      patient_id: isActiveBooking ? patientId(index) : undefined,
      status: isActiveBooking ? 'booked' : temporalBucket(index) === 'past' ? 'completed' : 'available',
    });
  });
}

function buildAppointmentDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const appointmentTime = dateAt(index, 8 + (index % 4), (index % 3) * 15);
    const status = statusForAppointment(index);
    return make('Appointment', index, {
      patient_id: patientId(index),
      doctor_id: doctorId(index),
      department_id: doctorDepartmentId(index),
      doctor_schedule_id: idFor('DoctorSchedule', index),
      schedule_slot_id: idFor('ScheduleSlot', index),
      appointment_time: appointmentTime,
      appointment_type: pick(['outpatient', 'inpatient_followup', 'emergency', 'telemedicine', 'vaccination', 'procedure'], index),
      reason: pick([
        'Tái khám theo lịch hẹn',
        'Đau ngực nhẹ khi gắng sức',
        'Ho kéo dài và sốt nhẹ',
        'Theo dõi thai kỳ định kỳ',
        'Đau bụng vùng thượng vị',
        'Kiểm tra vết thương sau thủ thuật',
      ], index),
      source: pick(['reception', 'patient_portal', 'phone_call', 'doctor_followup'], index),
      status,
      notes: 'Dữ liệu lịch hẹn mẫu có mốc thời gian quá khứ, hiện tại và tương lai.',
      confirmed_at: ['confirmed', 'checked_in', 'in_consultation', 'completed'].includes(status) ? addMinutes(appointmentTime, -120) : undefined,
      checked_in_at: ['checked_in', 'in_consultation', 'completed'].includes(status) ? addMinutes(appointmentTime, -15) : undefined,
      completed_at: status === 'completed' ? addMinutes(appointmentTime, 45) : undefined,
      no_show_at: status === 'no_show' ? addMinutes(appointmentTime, 30) : undefined,
      cancelled_by: status === 'cancelled' ? userId(index) : undefined,
      cancelled_at: status === 'cancelled' ? addMinutes(appointmentTime, -240) : undefined,
      cancel_reason: status === 'cancelled' ? 'Bệnh nhân báo bận việc gia đình.' : undefined,
    });
  });
}

function buildAppointmentWaitlistDocs() {
  return indexes(BASE_COUNT).map((index) => make('AppointmentWaitlist', index, {
    patient_id: patientId(index + BASE_COUNT),
    doctor_id: doctorId(index),
    department_id: doctorDepartmentId(index),
    preferred_date: addDays(dateAt(index, 0, 0), 2),
    preferred_time_range: pick(['07:30-09:30', '09:30-11:30', '13:30-15:30', '15:30-17:00'], index),
    reason: 'Bệnh nhân muốn được báo khi có slot khám trống sớm hơn.',
    status: pick(['waiting', 'offered', 'booked', 'cancelled', 'expired'], index),
    offered_slot_id: index % 4 === 1 ? idFor('ScheduleSlot', index) : undefined,
    offered_until: index % 4 === 1 ? addDays(dateAt(index, 10, 0), 1) : undefined,
    booked_appointment_id: index % 4 === 2 ? idFor('Appointment', index) : undefined,
    metadata: { nguon_yeu_cau: 'Cổng bệnh nhân', muc_uu_tien: index % 3 === 0 ? 'cao' : 'thường' },
  }));
}

function buildQueueTicketDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const status = queueStatusForIndex(index);
    const queueDate = dateAt(index, 0, 0);
    const checkin = addMinutes(queueDate, shiftStartHour(index) * 60 + 5 + (index % 5) * 8);
    return make('QueueTicket', index, {
      patient_id: patientId(index),
      appointment_id: idFor('Appointment', index),
      encounter_id: idFor('Encounter', index),
      doctor_id: doctorId(index),
      department_id: doctorDepartmentId(index),
      queue_date: queueDate,
      queue_number: `A${pad(index)}`,
      queue_type: pick(['normal', 'priority', 'vip'], index),
      status,
      checkin_time: checkin,
      called_time: ['called', 'recalled', 'in_service', 'completed'].includes(status) ? addMinutes(checkin, 18 + (index % 3) * 4) : undefined,
      estimated_called_at: addMinutes(checkin, 25 + (index % 4) * 5),
      service_start_time: ['in_service', 'completed'].includes(status) ? addMinutes(checkin, 28 + (index % 4) * 5) : undefined,
      completed_time: status === 'completed' ? addMinutes(checkin, 58 + (index % 4) * 6) : undefined,
      skipped_at: status === 'skipped' ? addMinutes(checkin, 35) : undefined,
      no_show_at: status === 'no_show' ? addMinutes(checkin, 40) : undefined,
      display_number: `PK${100 + index}`,
      nursing_stage: nursingStageForIndex(index),
      assigned_nurse_id: index % 7 === 0 ? undefined : nurseId(index),
      assigned_nurse_at: index % 7 === 0 ? undefined : addMinutes(checkin, 6),
      triage_required: index % 2 === 0,
      vital_required: true,
      doctor_room_id: `P${100 + index}`,
      priority_reason: index % 3 === 0 ? pick(['Người cao tuổi chóng mặt', 'Đau ngực thoáng qua', 'Khó thở nhẹ cần theo dõi'], index) : undefined,
      sla_due_at: addMinutes(checkin, index % 4 === 0 ? 15 : 35),
      latest_vital_sign_id: idFor('VitalSign', index),
    });
  });
}

function buildEncounterDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const start = dateAt(index, shiftStartHour(index), 35 + (index % 3) * 10);
    const status = isTodaySeed(index)
      ? pick(['arrived', 'in_progress', 'on_hold', 'completed', 'arrived', 'in_progress'], index)
      : statusForEncounter(index);
    const nursingStatus = nursingStageForIndex(index);
    return make('Encounter', index, {
      patient_id: patientId(index),
      appointment_id: idFor('Appointment', index),
      department_id: doctorDepartmentId(index),
      attending_doctor_id: doctorId(index),
      encounter_code: code('LK-2026', index),
      encounter_type: pick(['outpatient', 'inpatient', 'emergency', 'telemedicine'], index),
      start_time: start,
      end_time: status === 'completed' ? addMinutes(start, 45) : undefined,
      chief_reason: pick(['Đau ngực', 'Ho kéo dài', 'Sốt', 'Đau bụng', 'Tái khám', 'Theo dõi huyết áp'], index),
      started_at: ['in_progress', 'completed', 'on_hold'].includes(status) ? start : undefined,
      started_by: ['in_progress', 'completed', 'on_hold'].includes(status) ? doctorId(index) : undefined,
      completed_by: status === 'completed' ? doctorId(index) : undefined,
      nursing_status: nursingStatus,
      assigned_nurse_id: index % 7 === 0 ? undefined : nurseId(index),
      assigned_nurse_at: addMinutes(start, -25),
      waiting_nurse_at: ['waiting_nurse', 'nurse_in_progress'].includes(nursingStatus) ? addMinutes(start, -30) : undefined,
      triage_started_at: nursingStatus === 'triage_in_progress' ? addMinutes(start, -20) : undefined,
      triage_completed_at: ['triage_done', 'vital_done', 'ready_for_doctor', 'completed'].includes(nursingStatus) ? addMinutes(start, -15) : undefined,
      vital_recorded_at: ['vital_done', 'ready_for_doctor', 'completed'].includes(nursingStatus) ? addMinutes(start, -10) : undefined,
      ready_for_doctor_at: nursingStatus === 'ready_for_doctor' || nursingStatus === 'completed' ? addMinutes(start, -5) : undefined,
      status,
    });
  });
}

function buildConsultationDocs() {
  return indexes(BASE_COUNT).map((index) => make('Consultation', index, {
    encounter_id: idFor('Encounter', index),
    doctor_id: doctorId(index),
    consultation_no: code('TV-2026', index),
    subjective: 'Bệnh nhân mô tả triệu chứng rõ, đã được hỏi bệnh bằng tiếng Việt.',
    objective: 'Khám lâm sàng ổn định, không ghi nhận dấu hiệu nguy kịch tại thời điểm thăm khám.',
    assessment: diagnosisSeed(index)[1],
    plan: 'Tư vấn điều trị, theo dõi triệu chứng và hẹn tái khám khi cần.',
    status: temporalBucket(index) === 'future' ? 'draft' : pick(['signed', 'in_progress', 'signed', 'amended'], index),
  }));
}

function buildClinicalNoteDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => make('ClinicalNote', index, {
    encounter_id: idFor('Encounter', index),
    consultation_id: index < BASE_COUNT ? idFor('Consultation', index) : undefined,
    author_id: index % 2 === 0 ? nurseId(index) : doctorId(index),
    note_type: pick(['nursing_vital_routine', 'nursing_abnormal_vital', 'progress', 'assessment', 'instruction', 'follow_up'], index),
    title: pick(['Ghi chú điều dưỡng sau đo sinh hiệu', 'Theo dõi sinh hiệu bất thường', 'Diễn tiến sau chăm sóc', 'Dặn dò trước khi vào khám'], index),
    content: index % 2 === 0
      ? pick([
        'Bệnh nhân tỉnh, tiếp xúc tốt. Đã đo lại huyết áp sau nghỉ, tiếp tục theo dõi trong ca.',
        'Đã hướng dẫn người bệnh báo ngay khi khó thở, đau ngực hoặc chóng mặt tăng.',
        'Vết thương khô, băng sạch. Đã nhắc người nhà giữ chuông gọi trong tầm tay.',
        'Sau dùng thuốc chưa ghi nhận mẩn ngứa hoặc khó thở, tiếp tục theo dõi 30 phút.',
      ], index)
      : `Ghi chú lâm sàng: ${diagnosisSeed(index)[1]}. Bệnh nhân được giải thích kế hoạch điều trị và đồng ý theo dõi.`,
    priority: index % 5 === 0 ? 'urgent' : 'normal',
    linked_vital_sign_ids: [idFor('VitalSign', index)],
    tags: index % 2 === 0 ? ['nursing', 'vital_sign'] : ['doctor_note'],
    status: temporalBucket(index) === 'future' ? 'draft' : pick(['signed', 'in_progress', 'amended', 'draft'], index),
  }));
}

function buildDiagnosisDocs() {
  return indexes(BASE_COUNT).map((index) => make('Diagnosis', index, {
    encounter_id: idFor('Encounter', index),
    consultation_id: idFor('Consultation', index),
    recorded_by: doctorId(index),
    icd10_code: diagnosisSeed(index)[0],
    diagnosis_name: diagnosisSeed(index)[1],
    diagnosis_type: pick(['provisional', 'confirmed', 'discharge', 'secondary'], index),
    is_primary: true,
    onset_date: dateAt(index, 0, 0, -2),
    recorded_at: dateAt(index, 10, 0),
    note: 'Chẩn đoán được ghi nhận từ dữ liệu mẫu phục vụ kiểm thử nghiệp vụ.',
    status: pick(['active', 'resolved', 'active'], index),
  }));
}

function buildProblemListDocs() {
  return indexes(BASE_COUNT).map((index) => make('ProblemList', index, {
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index),
    diagnosis_id: idFor('Diagnosis', index),
    recorded_by: doctorId(index),
    icd10_code: diagnosisSeed(index)[0],
    problem_name: diagnosisSeed(index)[1],
    severity: pick(['mild', 'moderate', 'severe', 'unknown'], index),
    onset_date: dateAt(index, 0, 0, -30),
    note: 'Vấn đề sức khỏe đang được theo dõi trong hồ sơ bệnh nhân.',
    status: pick(['active', 'resolved', 'inactive'], index),
  }));
}

function buildAllergyDocs() {
  return indexes(BASE_COUNT).map((index) => make('Allergy', index, {
    patient_id: patientId(index),
    recorded_by: doctorId(index),
    allergy_type: allergySeed(index)[0],
    allergen: allergySeed(index)[1],
    reaction: allergySeed(index)[2],
    severity: pick(['mild', 'moderate', 'severe', 'unknown'], index),
    recorded_at: dateAt(index, 11, 0),
    note: 'Đã nhắc bệnh nhân thông báo dị ứng khi nhận thuốc hoặc làm thủ thuật.',
    status: pick(['active', 'active', 'resolved'], index),
  }));
}

function buildVitalSignDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const nursingStage = nursingStageForIndex(index);
    const recordedAt = ['waiting_nurse', 'nurse_in_progress', 'triage_pending', 'triage_in_progress', 'vital_pending'].includes(nursingStage)
      ? dateAt(index, shiftStartHour(index), 5, -1)
      : dateAt(index, shiftStartHour(index), 20 + (index % 4) * 7);
    const critical = index % 10 === 0;
    const high = index % 5 === 0 || index % 7 === 0;
    return make('VitalSign', index, {
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index),
    queue_ticket_id: idFor('QueueTicket', index),
    appointment_id: idFor('Appointment', index),
    context: pick(['encounter', 'pre_triage', 'inpatient', 'emergency'], index),
    recorded_by: nurseId(index),
    recorded_at: recordedAt,
    temperature: critical ? 39.2 : high && index % 2 === 0 ? 38.6 : 36.4 + (index % 5) * 0.2,
    temperature_c: critical ? 39.2 : high && index % 2 === 0 ? 38.6 : 36.4 + (index % 5) * 0.2,
    heart_rate: critical ? 132 : high ? 118 : 72 + index,
    respiratory_rate: 18 + (index % 4),
    systolic_bp: critical ? 184 : high ? 166 : 112 + index,
    diastolic_bp: critical ? 112 : high ? 96 : 70 + (index % 8),
    spo2: critical ? 88 : high && index % 3 === 0 ? 93 : 96 + (index % 4),
    weight_kg: 48 + index * 2,
    height_cm: 150 + index,
    bmi: 21 + (index % 5),
    pain_score: index % 6,
    blood_glucose: index % 6 === 0 ? 268 : 92 + (index % 4) * 11,
    alerts: high ? [{ code: critical ? 'SPO2_LOW' : 'BP_HIGH', message: critical ? 'SpO2 thấp cần xử trí ngay.' : 'Huyết áp cao hơn mức nền của bệnh nhân.', severity: critical ? 'critical' : 'high' }] : [],
    abnormal_flags: high ? [{ field: critical ? 'spo2' : 'systolic_bp', value: critical ? 88 : 166, display_value: critical ? '88%' : '166 mmHg', severity: critical ? 'critical' : 'high', message: critical ? 'SpO2 thấp' : 'Huyết áp tâm thu cao' }] : [],
    overall_severity: critical ? 'critical' : high ? 'high' : 'normal',
    requires_doctor_notification: high,
    requires_recheck: high,
    doctor_notification_required: high,
    acknowledged_at: high && index % 2 === 0 ? addMinutes(recordedAt, 8) : undefined,
    doctor_notified_at: high && index % 3 === 0 ? addMinutes(recordedAt, 12) : undefined,
    status: 'recorded',
  });
  });
}

function buildCarePlanDocs() {
  return indexes(BASE_COUNT).map((index) => make('CarePlan', index, {
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index),
    diagnosis_id: idFor('Diagnosis', index),
    plan_no: code('KHCS-2026', index),
    title: `Kế hoạch chăm sóc ${diagnosisSeed(index)[1].toLowerCase()}`,
    goals: [
      { goal: 'Giảm triệu chứng chính', target_date: addDays(dateAt(index, 0, 0), 14), status: 'đang theo dõi' },
      { goal: 'Tái khám đúng hẹn', target_date: addDays(dateAt(index, 0, 0), 30), status: 'đã tư vấn' },
    ],
    interventions: [
      { description: 'Tư vấn dùng thuốc theo đơn', responsible_role: 'Bác sĩ', frequency: 'Mỗi lần tái khám' },
      { description: 'Theo dõi dấu hiệu sinh tồn khi cần', responsible_role: 'Điều dưỡng', frequency: 'Theo chỉ định' },
    ],
    start_date: dateAt(index, 0, 0),
    end_date: temporalBucket(index) === 'past' ? addDays(dateAt(index, 0, 0), 30) : undefined,
    owner_id: doctorId(index),
    status: temporalBucket(index) === 'past' ? pick(['completed', 'active'], index) : pick(['active', 'draft', 'on_hold'], index),
  }));
}

function buildOrderDocs() {
  const orderTypes = ['lab', 'imaging', 'procedure', 'service', 'medication'];
  return indexes(BASE_COUNT * orderTypes.length).map((globalIndex) => {
    const index = globalIndex % BASE_COUNT;
    const type = orderTypes[Math.floor(globalIndex / BASE_COUNT)];
    return make('Order', globalIndex, {
      patient_id: patientId(index),
      encounter_id: idFor('Encounter', index),
      admission_id: type === 'service' ? idFor('Admission', index) : undefined,
      department_id: type === 'lab' ? departmentId(7) : type === 'imaging' ? departmentId(6) : doctorDepartmentId(index),
      ordered_by: doctorId(index),
      service_id: idFor('ServiceCatalog', (globalIndex + 3) % serviceSeeds.length),
      order_no: code(`CD-${type.toUpperCase()}-2026`, index),
      order_code: code(`CD-${type.toUpperCase()}-2026`, index),
      order_type: type,
      priority: pick(['routine', 'urgent', 'stat'], index),
      is_billable: true,
      clinical_indication: `Chỉ định phục vụ đánh giá ${diagnosisSeed(index)[1].toLowerCase()}.`,
      requested_at: dateAt(index, 8, 45),
      ordered_at: dateAt(index, 9, 0),
      status: statusForOrder(index),
    });
  });
}

function buildLabOrderDocs() {
  return indexes(BASE_COUNT).map((index) => make('LabOrder', index, {
    order_id: orderId('lab', index),
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index),
    ordered_by: doctorId(index),
    lab_order_no: code('XN-2026', index),
    test_code: labTestSeed(index)[0],
    test_name: labTestSeed(index)[1],
    specimen_type: labTestSeed(index)[3],
    priority: pick(['routine', 'urgent', 'stat'], index),
    ordered_at: dateAt(index, 9, 5),
    collected_at: temporalBucket(index) !== 'future' ? dateAt(index, 9, 20) : undefined,
    completed_at: temporalBucket(index) === 'past' ? dateAt(index, 11, 0) : undefined,
    clinical_note: `Xét nghiệm theo dõi ${diagnosisSeed(index)[1].toLowerCase()}.`,
    status: temporalBucket(index) === 'past' ? 'completed' : temporalBucket(index) === 'present' ? pick(['ordered', 'collected', 'in_progress'], index) : 'ordered',
  }));
}

function buildSpecimenDocs() {
  return indexes(BASE_COUNT).map((index) => make('Specimen', index, {
    lab_order_id: idFor('LabOrder', index),
    patient_id: patientId(index),
    specimen_no: code('SP-2026', index),
    specimen_type: labTestSeed(index)[3],
    collected_by: nurseId(index),
    collected_at: temporalBucket(index) !== 'future' ? dateAt(index, 9, 25) : undefined,
    received_by: labUserId(index),
    received_at: temporalBucket(index) !== 'future' ? dateAt(index, 9, 45) : undefined,
    container_type: pick(['Ống EDTA', 'Ống serum', 'Cốc nước tiểu', 'Ống lấy dịch tỵ hầu'], index),
    status: temporalBucket(index) === 'past' ? pick(['received', 'in_testing', 'stored'], index) : temporalBucket(index) === 'present' ? pick(['collected', 'received'], index) : 'planned',
  }));
}

function buildLabResultDocs() {
  return indexes(BASE_COUNT).map((index) => make('LabResult', index, {
    lab_order_id: idFor('LabOrder', index),
    specimen_id: idFor('Specimen', index),
    patient_id: patientId(index),
    is_current: true,
    result_no: code('KQXN-2026', index),
    performed_by: labUserId(index),
    verified_by: labUserId(index + 1),
    verified_at: temporalBucket(index) === 'past' ? dateAt(index, 11, 30) : undefined,
    reported_at: temporalBucket(index) !== 'future' ? dateAt(index, 11, 45) : undefined,
    released_to_patient: temporalBucket(index) === 'past',
    released_at: temporalBucket(index) === 'past' ? dateAt(index, 12, 0) : undefined,
    released_by: labUserId(index),
    is_critical: index % 6 === 0,
    interpretation: index % 6 === 0 ? 'Có chỉ số cần bác sĩ xem xét sớm.' : 'Kết quả trong giới hạn theo dõi.',
    notes: 'Kết quả xét nghiệm mẫu bằng tiếng Việt.',
    status: temporalBucket(index) === 'past' ? pick(['final', 'final', 'amended'], index) : temporalBucket(index) === 'present' ? 'preliminary' : 'preliminary',
  }));
}

function buildLabResultItemDocs() {
  return indexes(BASE_COUNT).map((index) => make('LabResultItem', index, {
    lab_result_id: idFor('LabResult', index),
    item_code: labTestSeed(index)[0],
    item_name: labTestSeed(index)[1],
    result_value: String(4.5 + (index % 6) * 0.7),
    numeric_value: 4.5 + (index % 6) * 0.7,
    unit: labTestSeed(index)[4] || 'Âm tính',
    reference_range: pick(['3.9 - 5.6', '4.0 - 10.0', '< 5.0', 'Theo tuổi và giới'], index),
    abnormal_flag: index % 6 === 0 ? 'high' : 'normal',
    is_critical: index % 6 === 0,
    comment: index % 6 === 0 ? 'Cần đối chiếu triệu chứng lâm sàng.' : 'Không ghi nhận bất thường đáng kể.',
    display_order: index + 1,
    status: temporalBucket(index) === 'past' ? 'final' : 'preliminary',
  }));
}

function buildLabTestCatalogDocs() {
  return labTests.map((test, index) => make('LabTestCatalog', index, {
    code: test[0],
    name: test[1],
    category: test[2],
    specimen_type: test[3],
    unit: test[4],
    reference_ranges: [{ gender: 'all', age_min: 0, age_max: 120, min: 0, max: 10, unit: test[4] }],
    price_service_id: idFor('ServiceCatalog', (index + 3) % serviceSeeds.length),
    active: true,
    metadata: { ghi_chu: 'Danh mục xét nghiệm mẫu dùng tiếng Việt.' },
  }));
}

function buildImagingOrderDocs() {
  const bodyParts = ['Ngực', 'Ổ bụng', 'Sọ não', 'Cột sống thắt lưng', 'Khớp gối', 'Tuyến vú', 'Tim', 'Vai phải', 'Cổ chân', 'Xoang mặt', 'Bàn tay', 'Thai quý II'];
  const modalities = ['xray', 'ultrasound', 'ct', 'mri', 'mammography', 'fluoroscopy'];
  return indexes(BASE_COUNT).map((index) => make('ImagingOrder', index, {
    order_id: orderId('imaging', index),
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index),
    ordered_by: doctorId(index),
    imaging_order_no: code('CDHA-2026', index),
    modality: pick(modalities, index),
    body_part: pick(bodyParts, index),
    contrast_required: index % 4 === 0,
    priority: pick(['routine', 'urgent', 'stat'], index),
    clinical_indication: `Đánh giá hình ảnh liên quan ${diagnosisSeed(index)[1].toLowerCase()}.`,
    ordered_at: dateAt(index, 9, 10),
    scheduled_by: radiologyUserId(index),
    scheduled_at: dateAt(index, 10, 0),
    started_at: temporalBucket(index) !== 'future' ? dateAt(index, 10, 20) : undefined,
    completed_at: temporalBucket(index) === 'past' ? dateAt(index, 10, 50) : undefined,
    room_id: idFor('ImagingModality', index),
    status: temporalBucket(index) === 'past' ? pick(['completed', 'completed', 'cancelled'], index) : temporalBucket(index) === 'present' ? pick(['scheduled', 'in_progress'], index) : 'ordered',
  }));
}

function buildImagingReportDocs() {
  return indexes(BASE_COUNT).map((index) => make('ImagingReport', index, {
    imaging_order_id: idFor('ImagingOrder', index),
    patient_id: patientId(index),
    report_no: code('BC-HA-2026', index),
    radiologist_id: radiologyUserId(index),
    technician_id: radiologyUserId(index + 1),
    pacs_url: `/pacs/demo/${code('CDHA', index)}`,
    findings: 'Hình ảnh khảo sát rõ, không ghi nhận tổn thương cấp tính nổi bật trong dữ liệu mẫu.',
    impression: pick(['Chưa thấy bất thường cấp tính.', 'Theo dõi tổn thương viêm nhẹ.', 'Cần đối chiếu lâm sàng.', 'Hình ảnh phù hợp bệnh lý đã biết.'], index),
    recommendation: 'Mang kết quả khi tái khám để bác sĩ đối chiếu với triệu chứng.',
    reported_at: temporalBucket(index) !== 'future' ? dateAt(index, 11, 10) : undefined,
    verified_by: temporalBucket(index) === 'past' ? radiologyUserId(index + 2) : undefined,
    verified_at: temporalBucket(index) === 'past' ? dateAt(index, 11, 30) : undefined,
    released_to_patient: temporalBucket(index) === 'past',
    released_at: temporalBucket(index) === 'past' ? dateAt(index, 12, 0) : undefined,
    released_by: radiologyUserId(index),
    is_critical: index % 7 === 0,
    critical_finding: index % 7 === 0 ? 'Cần bác sĩ điều trị xem xét sớm.' : undefined,
    status: temporalBucket(index) === 'past' ? pick(['final', 'final', 'amended'], index) : temporalBucket(index) === 'present' ? 'preliminary' : 'draft',
  }));
}

function buildImagingModalityDocs() {
  return imagingSeeds.map((item, index) => make('ImagingModality', index, {
    code: item[0],
    name: item[1],
    modality: item[2],
    room_name: item[3],
    room_required: true,
    active: true,
    metadata: { vi_tri: item[3], ghi_chu: 'Thiết bị chẩn đoán hình ảnh mẫu.' },
  }));
}

function buildProcedureOrderDocs() {
  return indexes(BASE_COUNT).map((index) => make('ProcedureOrder', index, {
    order_id: orderId('procedure', index),
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index),
    requested_by: doctorId(index),
    performer_id: doctorId(index + 1),
    department_id: doctorDepartmentId(index),
    procedure_order_no: code('TT-2026', index),
    procedure_code: procedureSeed(index)[0],
    procedure_name: procedureSeed(index)[1],
    priority: pick(['routine', 'urgent', 'stat'], index),
    clinical_indication: `Thủ thuật phục vụ xử trí ${diagnosisSeed(index)[1].toLowerCase()}.`,
    scheduled_start: dateAt(index, 13, 30),
    scheduled_end: dateAt(index, 14, 15),
    scheduled_by: userId(index),
    scheduled_at: dateAt(index, 10, 30),
    performed_start: temporalBucket(index) === 'past' ? dateAt(index, 13, 35) : undefined,
    performed_end: temporalBucket(index) === 'past' ? dateAt(index, 14, 10) : undefined,
    result_note: temporalBucket(index) === 'past' ? 'Thủ thuật hoàn tất, bệnh nhân ổn định sau theo dõi.' : undefined,
    status: temporalBucket(index) === 'past' ? pick(['completed', 'completed', 'cancelled'], index) : temporalBucket(index) === 'present' ? pick(['scheduled', 'in_progress'], index) : 'ordered',
  }));
}

function buildMedicationMasterDocs() {
  return medicationSeeds.map((med, index) => make('MedicationMaster', index, {
    medication_code: med[0],
    generic_name: med[1],
    brand_name: med[2],
    dosage_form: med[3],
    strength: med[4],
    route_default: med[5],
    unit: med[6],
    service_id: idFor('ServiceCatalog', 11),
    sale_price: med[7],
    min_stock_level: 50 + index * 5,
    status: 'active',
  }));
}

function buildPrescriptionDocs() {
  return indexes(BASE_COUNT).map((index) => make('Prescription', index, {
    order_id: orderId('medication', index),
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index),
    prescribed_by: doctorId(index),
    prescription_no: code('DT-2026', index),
    prescribed_at: dateAt(index, 10, 15),
    verified_by: pharmacistId(index),
    verified_at: temporalBucket(index) !== 'future' ? dateAt(index, 10, 45) : undefined,
    version: 1,
    is_current: true,
    completed_by: temporalBucket(index) === 'past' ? pharmacistId(index) : undefined,
    completed_at: temporalBucket(index) === 'past' ? dateAt(index, 11, 30) : undefined,
    status: temporalBucket(index) === 'past' ? pick(['completed', 'fully_dispensed', 'verified'], index) : temporalBucket(index) === 'present' ? pick(['active', 'verified', 'partially_dispensed'], index) : 'draft',
    note: 'Đơn thuốc mẫu có hướng dẫn sử dụng bằng tiếng Việt.',
  }));
}

function buildPrescriptionItemDocs() {
  return indexes(BASE_COUNT).map((index) => make('PrescriptionItem', index, {
    prescription_id: idFor('Prescription', index),
    medication_id: idFor('MedicationMaster', index),
    dosage_text: pick(['1 viên/lần', '2 viên/lần', '1 gói/lần', '1 nhát xịt/lần'], index),
    frequency_text: pick(['Ngày 2 lần sau ăn', 'Ngày 1 lần buổi tối', 'Mỗi 8 giờ khi sốt', 'Theo hướng dẫn của bác sĩ'], index),
    duration_text: pick(['5 ngày', '7 ngày', '14 ngày', '30 ngày'], index),
    route: medicationSeed(index)[5],
    quantity: 10 + index,
    unit: medicationSeed(index)[6],
    dispensed_quantity: temporalBucket(index) === 'past' ? 10 + index : index % 3,
    instruction: 'Uống đúng liều, không tự ý ngưng thuốc khi chưa hỏi bác sĩ.',
    status: temporalBucket(index) === 'past' ? pick(['completed', 'active'], index) : 'active',
  }));
}

function buildPrescriptionRefillRequestDocs() {
  return indexes(BASE_COUNT).map((index) => make('PrescriptionRefillRequest', index, {
    patient_id: patientId(index),
    prescription_id: idFor('Prescription', index),
    requested_by_actor_type: index % 3 === 0 ? 'patient_relative' : 'patient',
    requested_by_actor_id: index % 3 === 0 ? relativeId(index) : patientAccountId(index),
    requested_quantity: 10 + index,
    reason: 'Bệnh nhân sắp hết thuốc duy trì và gửi yêu cầu cấp lại.',
    status: pick(['pending', 'approved', 'rejected', 'cancelled'], index),
    reviewed_by: pharmacistId(index),
    reviewed_at: index % 2 === 0 ? dateAt(index, 14, 10) : undefined,
    review_note: index % 2 === 0 ? 'Đã đối chiếu đơn thuốc gần nhất.' : undefined,
  }));
}

function buildDispenseDocs() {
  return indexes(BASE_COUNT).map((index) => make('Dispense', index, {
    prescription_id: idFor('Prescription', index),
    patient_id: patientId(index),
    dispense_no: code('CP-2026', index),
    dispensed_by: pharmacistId(index),
    dispensed_at: temporalBucket(index) !== 'future' ? dateAt(index, 11, 0) : undefined,
    picked_up_by: patientProfiles[index][0],
    note: 'Dược sĩ đã dặn dò cách dùng thuốc bằng tiếng Việt.',
    status: temporalBucket(index) === 'past' ? pick(['dispensed', 'partially_dispensed', 'returned'], index) : temporalBucket(index) === 'present' ? 'partially_dispensed' : 'draft',
  }));
}

function buildDispenseItemDocs() {
  return indexes(BASE_COUNT).map((index) => make('DispenseItem', index, {
    dispense_id: idFor('Dispense', index),
    prescription_item_id: idFor('PrescriptionItem', index),
    medication_id: idFor('MedicationMaster', index),
    stock_batch_id: idFor('StockBatch', index),
    quantity: 5 + index,
    unit: medicationSeed(index)[6],
    status: temporalBucket(index) === 'future' ? 'planned' : 'dispensed',
    note: 'Cấp phát theo đúng số lượng trên đơn.',
  }));
}

function buildMedicationAdministrationDocs() {
  return indexes(BASE_COUNT).map((index) => make('MedicationAdministration', index, {
    patient_id: patientId(index),
    admission_id: idFor('Admission', index),
    prescription_item_id: idFor('PrescriptionItem', index),
    medication_id: idFor('MedicationMaster', index),
    scheduled_at: dateAt(index, 18, 0),
    administered_at: temporalBucket(index) === 'past' ? dateAt(index, 18, 5) : undefined,
    administered_by: nurseId(index),
    dose_text: pick(['1 viên', '2 viên', '1 lọ', '1 nhát xịt'], index),
    route: medicationSeed(index)[5],
    note: 'Theo dõi phản ứng sau dùng thuốc.',
    status: temporalBucket(index) === 'past' ? pick(['given', 'held', 'refused'], index) : 'scheduled',
  }));
}

function buildStockBatchDocs() {
  return indexes(BASE_COUNT).map((index) => make('StockBatch', index, {
    medication_id: idFor('MedicationMaster', index),
    batch_no: code('LOT-2026', index),
    supplier_name: pick(['Công ty Dược Hậu Giang', 'Traphaco', 'Imexpharm', 'Pymepharco'], index),
    received_at: dateAt(index, 8, 0, -60),
    expiry_date: addDays(dateAt(index, 0, 0), 240 + index * 15),
    quantity_received: 500 + index * 20,
    quantity_on_hand: 320 + index * 10,
    unit_cost: medicationSeed(index)[7],
    status: 'available',
  }));
}

function buildInventoryTransactionDocs() {
  return indexes(BASE_COUNT).map((index) => make('InventoryTransaction', index, {
    medication_id: idFor('MedicationMaster', index),
    stock_batch_id: idFor('StockBatch', index),
    dispense_item_id: index % 2 === 0 ? idFor('DispenseItem', index) : undefined,
    transaction_no: code('KHO-2026', index),
    transaction_type: pick(['receipt', 'dispense', 'adjustment', 'return', 'transfer', 'waste'], index),
    direction: index % 3 === 0 ? 'in' : 'out',
    quantity: 10 + index,
    unit_cost: medicationSeed(index)[7],
    occurred_at: dateAt(index, 15, 0),
    performed_by: pharmacistId(index),
    reason: 'Giao dịch kho thuốc mẫu phục vụ kiểm thử tồn kho.',
  }));
}

function buildRoomDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => make('Room', index, {
    department_id: departmentId(index % 8),
    service_id: idFor('ServiceCatalog', 9),
    room_code: code('PHONG', index),
    room_name: pick(['Phòng khám', 'Phòng thủ thuật', 'Phòng siêu âm', 'Buồng bệnh', 'Phòng cấp cứu'], index) + ` ${100 + index}`,
    room_type: pick(['consultation', 'ward', 'procedure', 'operating', 'lab', 'imaging', 'pharmacy', 'storage', 'other'], index),
    floor: String(1 + (index % 5)),
    building: pick(['Tòa A', 'Tòa B', 'Tòa C', 'Tòa D'], index),
    capacity: 1 + (index % 4),
    status: 'active',
  }));
}

function buildBedDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => make('Bed', index, {
    room_id: idFor('Room', index),
    bed_code: code('GIUONG', index),
    bed_name: `Giường ${index + 1}`,
    bed_type: pick(['standard', 'icu', 'pediatric', 'maternity', 'isolation', 'other'], index),
    status: temporalBucket(index) === 'present' ? pick(['available', 'occupied', 'reserved'], index) : pick(['available', 'maintenance', 'blocked'], index),
  }));
}

function buildAdmissionDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const status = temporalBucket(index) === 'past' ? pick(['discharged', 'admitted', 'cancelled'], index) : temporalBucket(index) === 'present' ? 'admitted' : 'planned';
    return make('Admission', index, {
      patient_id: patientId(index),
      encounter_id: idFor('Encounter', index),
      department_id: doctorDepartmentId(index),
      attending_doctor_id: doctorId(index),
      admission_no: code('NV-2026', index),
      admission_type: pick(['elective', 'emergency', 'transfer', 'observation', 'day_case'], index),
      admitted_at: status !== 'planned' ? dateAt(index, 15, 0) : undefined,
      admitted_by: userId(index),
      discharged_at: status === 'discharged' ? addDays(dateAt(index, 10, 0), 2) : undefined,
      discharged_by: status === 'discharged' ? doctorId(index) : undefined,
      reason: `Nhập viện theo dõi ${diagnosisSeed(index)[1].toLowerCase()}.`,
      discharge_disposition: status === 'discharged' ? 'Ổn định, về nhà dùng thuốc theo toa' : undefined,
      discharge_summary: status === 'discharged' ? 'Bệnh nhân ổn định, đã được hẹn tái khám.' : undefined,
      status,
    });
  });
}

function buildBedAssignmentDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => make('BedAssignment', index, {
    admission_id: idFor('Admission', index),
    bed_id: idFor('Bed', index),
    assigned_from: dateAt(index, 15, 30),
    assigned_to: temporalBucket(index) === 'past' ? addDays(dateAt(index, 10, 0), 2) : undefined,
    assigned_by: nurseId(index),
    released_by: temporalBucket(index) === 'past' ? nurseId(index) : undefined,
    note: 'Phân giường theo tình trạng bệnh và khoa điều trị.',
    status: temporalBucket(index) === 'past' ? pick(['released', 'transferred'], index) : 'active',
  }));
}

function buildInpatientTaskDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const status = isTodaySeed(index) ? pick(['todo', 'in_progress', 'done', 'cancelled', 'todo'], index) : temporalBucket(index) === 'past' ? 'done' : temporalBucket(index) === 'present' ? 'in_progress' : 'todo';
    return make('InpatientTask', index, {
    admission_id: idFor('Admission', index),
    patient_id: patientId(index),
    assigned_to: index % 6 === 0 ? undefined : nurseId(index),
    type: pick(['round', 'nursing_care', 'diet', 'cleaning', 'discharge_checklist', 'other'], index),
    title: pick(['Đi buồng sáng', 'Theo dõi dấu hiệu sinh tồn', 'Nhắc chế độ ăn', 'Chuẩn bị ra viện', 'Chăm sóc vết thương'], index),
    description: 'Nhiệm vụ nội trú mẫu được ghi bằng tiếng Việt.',
    due_at: taskDueAt(index),
    completed_at: status === 'done' ? addMinutes(taskDueAt(index), 25) : undefined,
    status,
  });
  });
}

function buildNursingIntakeDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => make('NursingIntake', index, {
    queue_ticket_id: idFor('QueueTicket', index),
    appointment_id: idFor('Appointment', index),
    encounter_id: idFor('Encounter', index),
    patient_id: patientId(index),
    department_id: doctorDepartmentId(index),
    doctor_id: doctorId(index),
    assigned_nurse_id: index % 7 === 0 ? undefined : nurseId(index),
    started_at: temporalBucket(index) !== 'future' ? dateAt(index, shiftStartHour(index), 12) : undefined,
    completed_at: ['triage_done', 'vital_done', 'ready_for_doctor', 'completed'].includes(nursingStageForIndex(index)) ? dateAt(index, shiftStartHour(index), 28) : undefined,
    reason: 'Tiếp nhận điều dưỡng trước khi vào khám bác sĩ.',
    note: 'Đã kiểm tra thông tin hành chính và triệu chứng ban đầu.',
    status: ['triage_done', 'vital_done', 'ready_for_doctor', 'completed'].includes(nursingStageForIndex(index)) ? 'completed' : nursingStageForIndex(index) === 'nurse_in_progress' ? 'in_progress' : 'waiting',
  }));
}

function buildNursingTaskDocs() {
  return indexes(NURSE_WORKSPACE_COUNT * 3).map((globalIndex) => {
    const index = globalIndex % NURSE_WORKSPACE_COUNT;
    const status = taskStatusForIndex(globalIndex);
    const dueAt = taskDueAt(globalIndex);
    return make('NursingTask', globalIndex, {
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index),
    queue_ticket_id: idFor('QueueTicket', index),
    admission_id: index % 4 === 0 ? idFor('Admission', index) : undefined,
    department_id: doctorDepartmentId(index),
    assigned_to: globalIndex % 9 === 0 ? undefined : nurseId(globalIndex),
    assigned_by: nurseId(globalIndex + 1),
    task_code: code('NVDD-2026', globalIndex),
    title: pick(['Đo sinh hiệu', 'Hướng dẫn lấy mẫu', 'Chuẩn bị thủ thuật', 'Theo dõi sau tiêm', 'Bàn giao ca trực', 'Báo bác sĩ theo SBAR', 'Chăm sóc vết thương', 'Theo dõi sau dùng thuốc'], globalIndex),
    description: pick([
      'Đo sinh hiệu, ghi nhận chỉ số và báo bác sĩ nếu vượt ngưỡng.',
      'Hướng dẫn bệnh nhân chuẩn bị lấy mẫu xét nghiệm đúng quy trình.',
      'Kiểm tra checklist trước thủ thuật và xác nhận phiếu đồng ý.',
      'Theo dõi phản ứng sau dùng thuốc trong 30 phút đầu.',
      'Bàn giao tình trạng người bệnh, task còn mở và thuốc đến giờ.',
    ], globalIndex),
    task_type: pick(['triage', 'vital_sign', 'preparation', 'medication_monitoring', 'post_procedure_monitoring', 'inpatient_care', 'emergency_response', 'handoff_followup', 'doctor_report'], globalIndex),
    priority: pick(['low', 'normal', 'medium', 'high', 'urgent', 'stat', 'critical'], globalIndex),
    due_at: dueAt,
    accepted_at: ['accepted', 'in_progress', 'blocked', 'waiting_doctor', 'done'].includes(status) ? addMinutes(dueAt, -45) : undefined,
    started_at: ['in_progress', 'blocked', 'waiting_doctor', 'done'].includes(status) ? addMinutes(dueAt, -25) : undefined,
    completed_at: status === 'done' ? addMinutes(dueAt, 20) : undefined,
    completed_by: status === 'done' ? nurseId(globalIndex) : undefined,
    result_note: status === 'done' ? 'Đã hoàn tất, bệnh nhân ổn định tại thời điểm ghi nhận.' : undefined,
    blocked_reason: status === 'blocked' ? 'Chờ bác sĩ xác nhận lại y lệnh trước khi tiếp tục.' : undefined,
    escalation_level: ['waiting_doctor'].includes(status) || globalIndex % 11 === 0 ? 1 : 0,
    escalated_at: ['waiting_doctor'].includes(status) || globalIndex % 11 === 0 ? addMinutes(dueAt, -10) : undefined,
    checklist_items: [
      { title: 'Xác nhận đúng người bệnh', required: true, status: status === 'done' ? 'done' : 'pending' },
      { title: 'Ghi nhận vào hồ sơ', required: true, status: status === 'done' ? 'done' : 'pending' },
      { title: 'Báo bác sĩ nếu bất thường', required: false, status: globalIndex % 5 === 0 ? 'done' : 'pending' },
    ],
    status,
  });
  });
}

function buildTriageAssessmentDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => make('TriageAssessment', index, {
    patient_id: patientId(index),
    appointment_id: idFor('Appointment', index),
    encounter_id: idFor('Encounter', index),
    queue_ticket_id: idFor('QueueTicket', index),
    department_id: doctorDepartmentId(index),
    doctor_id: doctorId(index),
    nurse_id: nurseId(index),
    triage_by: nurseId(index),
    triage_at: temporalBucket(index) !== 'future' ? dateAt(index, shiftStartHour(index), 18) : undefined,
    chief_complaint: pick(['Đau ngực', 'Khó thở nhẹ', 'Sốt', 'Đau bụng', 'Chóng mặt', 'Ho kéo dài'], index),
    symptom_onset_at: dateAt(index, 0, 0, -2),
    symptoms: { mo_ta: 'Triệu chứng được điều dưỡng ghi nhận lúc tiếp nhận.' },
    pain_score: index % 8,
    consciousness: 'alert',
    breathing_status: index % 6 === 0 ? 'distress' : 'normal',
    circulation_status: 'stable',
    mobility_status: pick(['walked', 'wheelchair', 'stretcher'], index),
    acuity_level: pick(['green', 'yellow', 'orange', 'blue'], index),
    priority_score: 20 + index,
    red_flags: index % 6 === 0 ? ['Khó thở tăng khi gắng sức'] : [],
    triage_level: pick(['non_urgent', 'semi_urgent', 'urgent', 'emergency'], index),
    priority: pick(['medium', 'low', 'high', 'critical'], index),
    recommended_destination: pick(['doctor', 'observation', 'procedure', 'emergency'], index),
    recommended_action: pick(['normal_queue', 'priority_queue', 'direct_doctor', 'observe'], index),
    recommended_department_id: doctorDepartmentId(index),
    recommended_doctor_id: doctorId(index),
    infectious_screening: { fever: index % 4 === 0, cough: index % 5 === 0, rash: false, travel_history: false, isolation_required: false },
    fall_risk_score: index % 4,
    pregnancy_status: patientSeed(index)[1] === 'female' ? pick(['unknown', 'not_pregnant', 'pregnant'], index) : 'not_pregnant',
    allergy_reviewed: true,
    medication_reviewed: true,
    problem_reviewed: true,
    vital_sign_id: idFor('VitalSign', index),
    vital_snapshot: { mach: 72 + index, nhiet_do: 36.6, huyet_ap: `${112 + index}/75` },
    status: nursingStageForIndex(index) === 'triage_pending' ? 'draft' : nursingStageForIndex(index) === 'triage_in_progress' ? 'in_progress' : temporalBucket(index) === 'future' ? 'draft' : pick(['completed', 'in_progress', 'completed'], index),
    note: 'Phân loại ban đầu theo thông tin bệnh nhân cung cấp.',
    started_at: dateAt(index, shiftStartHour(index), 15),
    completed_at: ['triage_done', 'vital_done', 'ready_for_doctor', 'completed'].includes(nursingStageForIndex(index)) ? dateAt(index, shiftStartHour(index), 32) : undefined,
    completed_by: ['triage_done', 'vital_done', 'ready_for_doctor', 'completed'].includes(nursingStageForIndex(index)) ? nurseId(index) : undefined,
  }));
}

function buildServicePreparationChecklistDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const orderType = index < BASE_COUNT ? 'service' : pick(['lab', 'imaging', 'procedure'], index - BASE_COUNT);
    const orderIndex = index < BASE_COUNT ? index : Math.floor((index - BASE_COUNT) / 3);
    return make('ServicePreparationChecklist', index, {
      patient_id: patientId(index),
      order_id: orderId(orderType, orderIndex),
      order_type: orderType,
      department_id: doctorDepartmentId(index),
      assigned_to: nurseId(index),
      checklist_items: [
        { key: 'xac_nhan_dinh_danh', label: 'Xác nhận đúng người bệnh', checked: true, checked_at: dateAt(index, 8, 0), checked_by: nurseId(index) },
        { key: 'giai_thich_quy_trinh', label: 'Giải thích quy trình cho bệnh nhân', checked: index % 3 !== 0, checked_at: dateAt(index, 8, 5), checked_by: nurseId(index) },
      ],
      note: 'Checklist chuẩn bị dịch vụ mẫu.',
      status: temporalBucket(index) === 'past' ? 'completed' : temporalBucket(index) === 'present' ? 'in_progress' : 'pending',
    });
  });
}

function buildServiceCatalogDocs() {
  return serviceSeeds.map((service, index) => make('ServiceCatalog', index, {
    service_code: service[0],
    service_name: service[1],
    service_type: service[2],
    department_id: departmentId(index % departmentSeeds.length),
    unit_price: service[3],
    currency: 'VND',
    is_billable: true,
    description: `${service[1]} trong bảng giá mẫu của bệnh viện.`,
    status: 'active',
  }));
}

function buildChargeDocs() {
  return indexes(BASE_COUNT).map((index) => {
    const unitPrice = serviceSeed(index)[3];
    const discount = index % 4 === 0 ? 20000 : 0;
    const total = unitPrice - discount;
    return make('Charge', index, {
      patient_id: patientId(index),
      encounter_id: idFor('Encounter', index),
      admission_id: index % 4 === 0 ? idFor('Admission', index) : undefined,
      service_id: idFor('ServiceCatalog', index),
      order_id: orderId(pick(['lab', 'imaging', 'procedure', 'service'], index), index),
      invoice_id: idFor('Invoice', index),
      charge_no: code('PHI-2026', index),
      description: serviceSeed(index)[1],
      quantity: 1,
      unit_price: unitPrice,
      discount_amount: discount,
      tax_amount: 0,
      total_amount: total,
      charged_at: dateAt(index, 11, 15),
      posted_by: cashierId(index),
      posted_at: temporalBucket(index) !== 'future' ? dateAt(index, 11, 20) : undefined,
      status: temporalBucket(index) === 'past' ? pick(['billed', 'posted', 'billed'], index) : temporalBucket(index) === 'present' ? 'posted' : 'pending',
    });
  });
}

function buildInvoiceDocs() {
  return indexes(BASE_COUNT).map((index) => {
    const values = invoiceMoney(index);
    return make('Invoice', index, {
      patient_id: patientId(index),
      encounter_id: idFor('Encounter', index),
      admission_id: index % 4 === 0 ? idFor('Admission', index) : undefined,
      invoice_no: code('HD-2026', index),
      subtotal_amount: values.subtotal,
      discount_amount: values.discount,
      tax_amount: values.tax,
      insurance_amount: values.insurance,
      total_amount: values.total,
      paid_amount: values.paid,
      balance_due: values.balance,
      currency: 'VND',
      issued_at: dateAt(index, 11, 30),
      issued_by: cashierId(index),
      due_at: addDays(dateAt(index, 0, 0), 7),
      status: values.balance === 0 ? 'paid' : values.paid > 0 ? 'partially_paid' : temporalBucket(index) === 'future' ? 'draft' : 'issued',
    });
  });
}

function buildInvoiceItemDocs() {
  return indexes(BASE_COUNT).map((index) => {
    const service = serviceSeed(index);
    const discount = index % 4 === 0 ? 20000 : 0;
    return make('InvoiceItem', index, {
      invoice_id: idFor('Invoice', index),
      charge_id: idFor('Charge', index),
      service_id: idFor('ServiceCatalog', index),
      charge_no: code('PHI-2026', index),
      service_code: service[0],
      service_name: service[1],
      description: service[1],
      quantity: 1,
      unit_price: service[3],
      discount_amount: discount,
      tax_amount: 0,
      line_total: service[3] - discount,
      display_order: index + 1,
    });
  });
}

function buildPaymentIntentDocs() {
  return indexes(BASE_COUNT).map((index) => {
    const amount = invoiceMoney(index).balance || invoiceMoney(index).total;
    const status = temporalBucket(index) === 'past' ? pick(['paid', 'confirmed', 'confirmed'], index) : temporalBucket(index) === 'present' ? pick(['pending', 'submitted_receipt', 'manual_review'], index) : 'created';
    return make('PaymentIntent', index, {
      intent_code: code('PI-2026', index),
      invoice_id: idFor('Invoice', index),
      patient_id: patientId(index),
      payment_id: idFor('Payment', index),
      amount,
      currency: 'VND',
      provider: pick(['bank_qr_manual', 'momo_personal_qr', 'cash_manual', 'bank_qr'], index),
      method: pick(['qr_manual', 'qr', 'cash', 'bank_transfer'], index),
      status,
      payment_note: `Thanh toan hoa don ${code('HD-2026', index)}`,
      checkout_url: `https://pay.demo.minhchau.vn/${code('PI', index)}`,
      qr_payload: `BANKQR|MINHCHAU|${code('HD-2026', index)}|${amount}`,
      receiver_name: 'Bệnh viện Đa khoa Minh Châu',
      receiver_phone: '0900000000',
      receiver_bank_bin: '970436',
      receiver_account_no: `1903${String(100000 + index)}`,
      receiver_account_name: 'BENH VIEN DA KHOA MINH CHAU',
      transaction_reference: code('GD-QR-2026', index),
      provider_order_id: code('ORDER-QR-2026', index),
      provider_transaction_id: temporalBucket(index) === 'past' ? code('BANKTXN-2026', index) : undefined,
      expires_at: addDays(dateAt(index, 12, 0), 1),
      paid_at: ['paid', 'confirmed'].includes(status) ? dateAt(index, 12, 10) : undefined,
      confirmed_by: ['paid', 'confirmed'].includes(status) ? cashierId(index) : undefined,
      confirmed_at: ['paid', 'confirmed'].includes(status) ? dateAt(index, 12, 15) : undefined,
      metadata: { ngon_ngu: 'vi', kenh: 'qr' },
    });
  });
}

function buildPaymentDocs() {
  return indexes(BASE_COUNT).map((index) => {
    const amount = invoiceMoney(index).paid || Math.floor(invoiceMoney(index).total / 2);
    const status = temporalBucket(index) === 'past' ? pick(['completed', 'confirmed', 'completed'], index) : temporalBucket(index) === 'present' ? pick(['pending_manual_confirmation', 'submitted_receipt', 'confirmed'], index) : 'pending';
    return make('Payment', index, {
      invoice_id: idFor('Invoice', index),
      patient_id: patientId(index),
      payment_intent_id: idFor('PaymentIntent', index),
      provider: pick(['bank_qr_manual', 'momo_personal_qr', 'cash_manual', 'bank_qr'], index),
      method: pick(['qr_manual', 'qr', 'cash', 'bank_transfer'], index),
      payment_provider: pick(['bank_qr_manual', 'momo_personal_qr', 'cash_manual', 'bank_qr'], index),
      provider_transaction_id: temporalBucket(index) === 'past' ? code('PAYTXN-2026', index) : undefined,
      idempotency_key: code('IDEMP-PAY-2026', index),
      payment_no: code('TT-2026', index),
      amount,
      currency: 'VND',
      payment_method: pick(['cash', 'qr', 'card', 'bank_transfer', 'insurance', 'e_wallet'], index),
      intent_code: code('PI-2026', index),
      payment_note: `Thanh toán hóa đơn ${code('HD-2026', index)}`,
      transaction_reference: code('GD-2026', index),
      transaction_ref: code('GD-2026', index),
      paid_at: temporalBucket(index) !== 'future' ? dateAt(index, 12, 20) : undefined,
      received_by: cashierId(index),
      confirmed_by: ['completed', 'confirmed'].includes(status) ? cashierId(index) : undefined,
      confirmed_at: ['completed', 'confirmed'].includes(status) ? dateAt(index, 12, 30) : undefined,
      refund_status: 'none',
      status,
      note: 'Giao dịch thanh toán mẫu bằng VND.',
    });
  });
}

function buildInsurancePolicyDocs() {
  return indexes(BASE_COUNT).map((index) => make('InsurancePolicy', index, {
    patient_id: patientId(index),
    payer_name: pick(['Bảo hiểm Y tế Việt Nam', 'Bảo Việt An Gia', 'PVI Care', 'Bảo Minh Healthcare'], index),
    policy_no: `POL-VN-${String(20260000 + index)}`,
    member_no: `MB-${String(79000000 + index)}`,
    group_no: `GR-${100 + (index % 5)}`,
    holder_name: patientProfiles[index][0],
    valid_from: addDays(dateAt(index, 0, 0), -180),
    valid_to: addDays(dateAt(index, 0, 0), 365),
    is_primary: index % 2 === 0,
    source: pick(['staff_created', 'patient_submitted'], index),
    verification_status: pick(['verified', 'pending_review', 'submitted', 'draft'], index),
    submitted_by_actor_type: index % 2 === 0 ? 'staff' : 'patient',
    submitted_by_actor_id: index % 2 === 0 ? userId(index) : patientAccountId(index),
    verified_by: index % 3 === 0 ? cashierId(index) : undefined,
    verified_at: index % 3 === 0 ? dateAt(index, 13, 0) : undefined,
    coverage_note: 'Quyền lợi bảo hiểm mẫu, cần kiểm tra điều kiện thực tế khi phát sinh viện phí.',
    status: pick(['active', 'active', 'expired', 'inactive'], index),
  }));
}

function buildInsuranceClaimDocs() {
  return indexes(BASE_COUNT).map((index) => {
    const submitted = invoiceMoney(index).total;
    const approved = index % 4 === 0 ? Math.floor(submitted * 0.7) : Math.floor(submitted * 0.5);
    return make('InsuranceClaim', index, {
      policy_id: idFor('InsurancePolicy', index),
      patient_id: patientId(index),
      invoice_id: idFor('Invoice', index),
      claim_no: code('YC-BH-2026', index),
      submitted_amount: submitted,
      approved_amount: temporalBucket(index) === 'future' ? 0 : approved,
      paid_amount: temporalBucket(index) === 'past' ? approved : 0,
      submitted_at: temporalBucket(index) !== 'future' ? dateAt(index, 13, 20) : undefined,
      reviewed_at: temporalBucket(index) === 'past' ? dateAt(index, 14, 0) : undefined,
      external_claim_ref: code('BHXH-REF-2026', index),
      rejection_reason: index % 5 === 0 ? 'Thiếu chứng từ bổ sung trong dữ liệu mẫu.' : undefined,
      status: temporalBucket(index) === 'past' ? pick(['settled', 'approved', 'partially_approved', 'rejected'], index) : temporalBucket(index) === 'present' ? 'under_review' : 'draft',
    });
  });
}

function buildMedicalRecordDocs() {
  return indexes(BASE_COUNT).map((index) => make('MedicalRecord', index, {
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index),
    admission_id: index % 4 === 0 ? idFor('Admission', index) : undefined,
    custodian_department_id: doctorDepartmentId(index),
    record_no: code('BA-2026', index),
    record_type: pick(['outpatient', 'inpatient', 'emergency', 'lab', 'imaging', 'procedure', 'pharmacy', 'other'], index),
    title: `Bệnh án ${diagnosisSeed(index)[1].toLowerCase()}`,
    summary: 'Hồ sơ bệnh án mẫu bao gồm thông tin khám, chẩn đoán, chỉ định và kế hoạch chăm sóc.',
    opened_at: dateAt(index, 8, 0),
    closed_at: temporalBucket(index) === 'past' ? dateAt(index, 12, 30) : undefined,
    finalized_by: temporalBucket(index) === 'past' ? doctorId(index) : undefined,
    finalized_at: temporalBucket(index) === 'past' ? dateAt(index, 12, 35) : undefined,
    released_to_patient: temporalBucket(index) === 'past',
    released_at: temporalBucket(index) === 'past' ? dateAt(index, 13, 0) : undefined,
    released_by: temporalBucket(index) === 'past' ? userId(index) : undefined,
    status: temporalBucket(index) === 'past' ? pick(['finalized', 'active', 'sealed'], index) : temporalBucket(index) === 'present' ? 'active' : 'draft',
  }));
}

function buildAttachmentDocs() {
  return indexes(BASE_COUNT).map((index) => {
    const entityType = pick(['medical_record', 'lab_result', 'imaging_report', 'prescription', 'invoice', 'insurance_claim'], index);
    const entityModel = {
      medical_record: 'MedicalRecord',
      lab_result: 'LabResult',
      imaging_report: 'ImagingReport',
      prescription: 'Prescription',
      invoice: 'Invoice',
      insurance_claim: 'InsuranceClaim',
    }[entityType];
    return make('Attachment', index, {
      patient_id: patientId(index),
      encounter_id: idFor('Encounter', index),
      medical_record_id: entityType === 'medical_record' ? idFor('MedicalRecord', index) : undefined,
      order_id: orderId(pick(['lab', 'imaging', 'procedure', 'service'], index), index),
      entity_type: entityType,
      entity_id: idFor(entityModel, index),
      uploaded_by: userId(index),
      file_name: `tai-lieu-y-te-${pad(index)}.pdf`,
      original_name: `Tài liệu y tế ${pad(index)}.pdf`,
      mime_type: 'application/pdf',
      file_size: 120000 + index * 3500,
      storage_path: `/uploads/demo/2026/tai-lieu-y-te-${pad(index)}.pdf`,
      storage_provider: 'local',
      storage_key: `demo/tai-lieu-y-te-${pad(index)}.pdf`,
      checksum: crypto.createHash('md5').update(`attachment-${index}`).digest('hex'),
      checksum_sha256: crypto.createHash('sha256').update(`attachment-${index}`).digest('hex'),
      scan_status: 'clean',
      category: pick(['Bệnh án', 'Kết quả xét nghiệm', 'Chẩn đoán hình ảnh', 'Hóa đơn', 'Bảo hiểm'], index),
      description: 'Tệp đính kèm mẫu cho hồ sơ y tế.',
      source: pick(['staff_upload', 'patient_upload', 'system_generated'], index),
      review_status: 'accepted',
      reviewed_by: userId(index),
      reviewed_at: dateAt(index, 13, 30),
      visibility: pick(['staff_only', 'patient_visible', 'shared_with_relative'], index),
      released_to_patient: index % 2 === 0,
      released_at: index % 2 === 0 ? dateAt(index, 14, 0) : undefined,
      released_by: index % 2 === 0 ? userId(index) : undefined,
      status: 'active',
    });
  });
}

function buildDocumentExportRequestDocs() {
  return indexes(BASE_COUNT).map((index) => make('DocumentExportRequest', index, {
    request_code: code('XUAT-HS-2026', index),
    patient_id: patientId(index),
    requested_by_actor_type: index % 2 === 0 ? 'patient' : 'staff',
    requested_by_actor_id: index % 2 === 0 ? patientAccountId(index) : userId(index),
    export_type: pick(['attachments_zip', 'medical_record_package'], index),
    status: temporalBucket(index) === 'past' ? pick(['ready', 'expired', 'failed'], index) : temporalBucket(index) === 'present' ? 'processing' : 'pending',
    expires_at: addDays(dateAt(index, 0, 0), 7),
    file_url: temporalBucket(index) === 'past' ? `https://demo.minhchau.vn/exports/ho-so-${pad(index)}.zip` : undefined,
    failure_reason: index % 5 === 0 ? 'Mô phỏng lỗi thiếu tệp trong dữ liệu mẫu.' : undefined,
  }));
}

function buildNotificationDocs() {
  const titles = [
    'Nhắc lịch khám',
    'Có kết quả xét nghiệm mới',
    'Hóa đơn cần thanh toán',
    'Đơn thuốc đã sẵn sàng',
    'Cập nhật yêu cầu hỗ trợ',
    'Báo cáo hình ảnh đã duyệt',
  ];
  return indexes(BASE_COUNT).map((index) => {
    const recipientType = pick(['patient', 'staff', 'relative'], index);
    return make('Notification', index, {
      recipient_type: recipientType,
      recipient_id: recipientType === 'staff' ? userId(index) : recipientType === 'relative' ? relativeId(index) : patientAccountId(index),
      recipient_user_id: recipientType === 'staff' ? userId(index) : undefined,
      patient_account_id: recipientType === 'patient' ? patientAccountId(index) : undefined,
      patient_id: patientId(index),
      relative_id: recipientType === 'relative' ? relativeId(index) : undefined,
      channel: pick(['in_app', 'email', 'push'], index),
      notification_type: pick(['appointment_reminder', 'lab_result_ready', 'invoice_due', 'prescription_ready', 'support_update'], index),
      event_type: pick(['appointment.reminder', 'lab.result.final', 'billing.invoice.issued', 'pharmacy.dispense.ready'], index),
      priority: pick(['normal', 'high', 'low', 'urgent'], index),
      title: pick(titles, index),
      message: `${pick(titles, index)} cho bệnh nhân ${patientProfiles[index][0]}. Vui lòng kiểm tra cổng bệnh nhân.`,
      scheduled_at: temporalBucket(index) === 'future' ? dateAt(index, 7, 0) : undefined,
      sent_at: temporalBucket(index) !== 'future' ? dateAt(index, 7, 5) : undefined,
      read_at: temporalBucket(index) === 'past' && index % 2 === 0 ? dateAt(index, 8, 0) : undefined,
      status: temporalBucket(index) === 'future' ? 'queued' : index % 2 === 0 ? 'read' : 'sent',
      metadata: { ngon_ngu: 'vi', ma_benh_nhan: `BN-2026-${pad(index)}` },
    });
  });
}

function buildNotificationDeliveryDocs() {
  return indexes(BASE_COUNT).map((index) => make('NotificationDelivery', index, {
    notification_id: idFor('Notification', index),
    channel: pick(['in_app', 'socket', 'email', 'push'], index),
    provider: pick(['internal', 'smtp', 'firebase'], index),
    provider_message_id: code('MSG-NOTI-2026', index),
    status: temporalBucket(index) === 'future' ? 'pending' : pick(['sent', 'delivered', 'failed', 'skipped'], index),
    attempt_count: temporalBucket(index) === 'future' ? 0 : 1 + (index % 2),
    next_attempt_at: index % 5 === 0 ? addMinutes(dateAt(index, 9, 0), 30) : undefined,
    sent_at: temporalBucket(index) !== 'future' ? dateAt(index, 7, 10) : undefined,
    delivered_at: temporalBucket(index) === 'past' ? dateAt(index, 7, 12) : undefined,
    error_message: index % 5 === 0 ? 'Mô phỏng lỗi gửi email trong dữ liệu mẫu.' : undefined,
  }));
}

function buildNotificationPreferenceDocs() {
  return indexes(BASE_COUNT).map((index) => {
    const type = index % 2 === 0 ? 'patient' : 'staff';
    return make('NotificationPreference', index, {
      actor_type: type,
      actor_id: actorIdFor(type, index),
      channel: pick(['in_app', 'email', 'push'], index),
      event_type: pick(['appointment.reminder', 'lab.result.final', 'billing.invoice.issued', 'pharmacy.dispense.ready'], index),
      enabled: index % 5 !== 0,
      quiet_hours: { from: '21:00', to: '06:30' },
      language: 'vi',
    });
  });
}

function buildNotificationTemplateDocs() {
  const templates = [
    ['APPOINTMENT_REMINDER_VI', 'appointment.reminder', 'Nhắc lịch khám', 'Quý khách có lịch khám lúc {{time}} ngày {{date}}.'],
    ['LAB_RESULT_READY_VI', 'lab.result.final', 'Có kết quả xét nghiệm', 'Kết quả xét nghiệm của quý khách đã sẵn sàng.'],
    ['INVOICE_ISSUED_VI', 'billing.invoice.issued', 'Hóa đơn mới', 'Hóa đơn {{invoice_no}} đã được phát hành.'],
    ['PAYMENT_CONFIRMED_VI', 'billing.payment.confirmed', 'Thanh toán thành công', 'Thanh toán của quý khách đã được xác nhận.'],
    ['PRESCRIPTION_READY_VI', 'pharmacy.dispense.ready', 'Thuốc đã sẵn sàng', 'Đơn thuốc của quý khách đã sẵn sàng nhận.'],
    ['SUPPORT_UPDATED_VI', 'support.ticket.updated', 'Yêu cầu hỗ trợ được cập nhật', 'Yêu cầu hỗ trợ {{ticket_code}} có phản hồi mới.'],
    ['IMAGING_READY_VI', 'imaging.report.final', 'Báo cáo hình ảnh đã có', 'Báo cáo chẩn đoán hình ảnh đã được duyệt.'],
    ['QUEUE_CALL_VI', 'queue.ticket.called', 'Đến lượt khám', 'Số thứ tự {{queue_number}} vui lòng đến phòng khám.'],
    ['INSURANCE_REVIEW_VI', 'insurance.claim.review', 'Hồ sơ bảo hiểm đang xử lý', 'Hồ sơ bảo hiểm của quý khách đang được xem xét.'],
    ['PROFILE_CHANGE_VI', 'patient.profile.change', 'Cập nhật hồ sơ', 'Yêu cầu cập nhật hồ sơ đã được tiếp nhận.'],
    ['ADMISSION_NOTICE_VI', 'inpatient.admission.notice', 'Thông báo nhập viện', 'Hồ sơ nhập viện {{admission_no}} đã được tạo.'],
    ['EMERGENCY_ACK_VI', 'emergency.case.acknowledged', 'Đã tiếp nhận khẩn cấp', 'Đội trực đã tiếp nhận yêu cầu khẩn cấp của quý khách.'],
  ];
  return templates.map((template, index) => make('NotificationTemplate', index, {
    template_code: template[0],
    event_type: template[1],
    title_template: template[2],
    body_template: template[3],
    language: 'vi',
    priority: pick(['normal', 'high', 'urgent'], index),
    active: true,
  }));
}

function buildConversationDocs() {
  return indexes(BASE_COUNT).map((index) => make('Conversation', index, {
    conversation_code: code('CHAT-2026', index),
    type: pick(['doctor_patient', 'care_team_patient', 'support', 'billing', 'insurance', 'pharmacy', 'lab', 'imaging', 'internal', 'emergency'], index),
    patient_id: patientId(index),
    appointment_id: idFor('Appointment', index),
    encounter_id: idFor('Encounter', index),
    invoice_id: idFor('Invoice', index),
    prescription_id: idFor('Prescription', index),
    ticket_id: idFor('SupportTicket', index),
    subject: supportSubject(index),
    status: temporalBucket(index) === 'past' ? pick(['closed', 'archived', 'open'], index) : pick(['open', 'pending'], index),
    priority: pick(['normal', 'high', 'low', 'urgent'], index),
    created_by_actor_type: index % 2 === 0 ? 'patient' : 'staff',
    created_by_actor_id: index % 2 === 0 ? patientAccountId(index) : userId(index),
    assigned_department_id: departmentId(index % departmentSeeds.length),
    assigned_user_id: userId(index),
    last_message_at: dateAt(index, 15, 15),
  }));
}

function buildConversationParticipantDocs() {
  return indexes(BASE_COUNT * 2).map((globalIndex) => {
    const conversationIndex = globalIndex % BASE_COUNT;
    const isPatient = globalIndex < BASE_COUNT;
    return make('ConversationParticipant', globalIndex, {
      conversation_id: idFor('Conversation', conversationIndex),
      actor_type: isPatient ? 'patient' : 'staff',
      actor_id: isPatient ? patientAccountId(conversationIndex) : userId(conversationIndex),
      role_in_conversation: isPatient ? 'member' : pick(['owner', 'assignee', 'observer'], conversationIndex),
      joined_at: dateAt(conversationIndex, 14, 0),
      muted: false,
      archived: temporalBucket(conversationIndex) === 'past' && conversationIndex % 4 === 0,
      left_at: temporalBucket(conversationIndex) === 'past' && conversationIndex % 5 === 0 ? dateAt(conversationIndex, 16, 0) : undefined,
    });
  });
}

function buildMessageDocs() {
  return indexes(BASE_COUNT * 2).map((globalIndex) => {
    const conversationIndex = globalIndex % BASE_COUNT;
    const fromPatient = globalIndex % 2 === 0;
    return make('Message', globalIndex, {
      conversation_id: idFor('Conversation', conversationIndex),
      sender_actor_type: fromPatient ? 'patient' : 'staff',
      sender_actor_id: fromPatient ? patientAccountId(conversationIndex) : userId(conversationIndex),
      message_type: pick(['text', 'text', 'appointment_ref', 'payment_ref', 'prescription_ref'], globalIndex),
      body: fromPatient ? supportSubjects[conversationIndex] : 'Nhân viên đã tiếp nhận và sẽ phản hồi cho anh/chị trong thời gian sớm nhất.',
      voice_transcript_status: 'none',
      status: temporalBucket(conversationIndex) === 'past' ? pick(['read', 'delivered'], globalIndex) : 'sent',
      is_internal_note: false,
      is_clinical_advice: !fromPatient && conversationIndex % 4 === 0,
      requires_acknowledgement: !fromPatient && conversationIndex % 5 === 0,
    });
  });
}

function buildConversationCallDocs() {
  return indexes(BASE_COUNT).map((index) => make('ConversationCall', index, {
    conversation_id: idFor('Conversation', index),
    call_type: pick(['voice', 'video'], index),
    provider: 'internal',
    started_by_actor_type: index % 2 === 0 ? 'staff' : 'patient',
    started_by_actor_id: index % 2 === 0 ? userId(index) : patientAccountId(index),
    scheduled_at: temporalBucket(index) === 'future' ? dateAt(index, 16, 0) : undefined,
    started_at: temporalBucket(index) !== 'future' ? dateAt(index, 16, 5) : undefined,
    ended_at: temporalBucket(index) === 'past' ? dateAt(index, 16, 25) : undefined,
    duration_seconds: temporalBucket(index) === 'past' ? 1200 + index * 20 : undefined,
    status: temporalBucket(index) === 'past' ? pick(['completed', 'missed'], index) : temporalBucket(index) === 'present' ? 'ongoing' : 'scheduled',
    transcript_text: temporalBucket(index) === 'past' ? 'Cuộc gọi tư vấn đã được tóm tắt trong hồ sơ chăm sóc.' : undefined,
    transcript_status: temporalBucket(index) === 'past' ? 'completed' : 'none',
    consent_recorded: true,
  }));
}

function buildMessageAttachmentDocs() {
  return indexes(BASE_COUNT).map((index) => make('MessageAttachment', index, {
    message_id: idFor('Message', index),
    attachment_id: idFor('Attachment', index),
    file_name: `hinh-anh-ho-tro-${pad(index)}.jpg`,
    file_size: 250000 + index * 7000,
    mime_type: 'image/jpeg',
    uploaded_by_actor_type: index % 2 === 0 ? 'patient' : 'staff',
    uploaded_by_actor_id: index % 2 === 0 ? patientAccountId(index) : userId(index),
  }));
}

function buildSupportTicketDocs() {
  return indexes(BASE_COUNT).map((index) => make('SupportTicket', index, {
    ticket_code: code('HT-2026', index),
    patient_id: patientId(index),
    created_by_actor_type: index % 2 === 0 ? 'patient' : 'staff',
    created_by_actor_id: index % 2 === 0 ? patientAccountId(index) : userId(index),
    category: pick(['appointment', 'billing', 'insurance', 'medical_record', 'technical', 'complaint', 'pharmacy', 'other'], index),
    subject: supportSubject(index),
    description: `${supportSubject(index)}. Nội dung này được tạo để kiểm thử quy trình chăm sóc khách hàng.`,
    priority: pick(['normal', 'high', 'low', 'urgent'], index),
    status: temporalBucket(index) === 'past' ? pick(['resolved', 'closed', 'waiting_patient'], index) : pick(['open', 'waiting_staff'], index),
    assigned_department_id: departmentId(index % departmentSeeds.length),
    assigned_user_id: userId(index),
    conversation_id: idFor('Conversation', index),
    sla_due_at: addDays(dateAt(index, 10, 0), 1),
    resolved_at: temporalBucket(index) === 'past' ? dateAt(index, 17, 0) : undefined,
  }));
}

function buildApprovalRequestDocs() {
  return indexes(BASE_COUNT).map((index) => make('ApprovalRequest', index, {
    request_code: code('PD-2026', index),
    request_type: pick(['large_discount', 'refund', 'void_invoice', 'archive_medical_document', 'break_glass_review', 'role_permission_change', 'manual_stock_adjustment', 'insurance_claim_resubmit'], index),
    target_type: pick(['Invoice', 'Payment', 'MedicalRecord', 'InventoryTransaction', 'InsuranceClaim'], index),
    target_id: pick([idFor('Invoice', index), idFor('Payment', index), idFor('MedicalRecord', index), idFor('InventoryTransaction', index), idFor('InsuranceClaim', index)], index),
    requested_by_actor_type: 'staff',
    requested_by_actor_id: userId(index),
    assigned_to_user_id: adminUserId(index),
    assigned_to_role_code: 'vn_seed_quan_tri',
    reason: 'Yêu cầu phê duyệt nghiệp vụ mẫu trong môi trường kiểm thử.',
    decided_by: temporalBucket(index) === 'past' ? adminUserId(index) : undefined,
    decided_at: temporalBucket(index) === 'past' ? dateAt(index, 16, 0) : undefined,
    decision_note: temporalBucket(index) === 'past' ? 'Đã xem xét và ghi nhận quyết định mẫu.' : undefined,
    status: temporalBucket(index) === 'past' ? pick(['approved', 'rejected', 'cancelled'], index) : 'pending',
    expires_at: addDays(dateAt(index, 0, 0), 3),
  }));
}

function buildQrTokenDocs() {
  return indexes(BASE_COUNT).map((index) => {
    const type = pick(['payment', 'appointment_checkin', 'queue_ticket', 'prescription_verify', 'lab_result_verify', 'receipt_verify', 'patient_card'], index);
    const targetMap = {
      payment: ['PaymentIntent', idFor('PaymentIntent', index)],
      appointment_checkin: ['Appointment', idFor('Appointment', index)],
      queue_ticket: ['QueueTicket', idFor('QueueTicket', index)],
      prescription_verify: ['Prescription', idFor('Prescription', index)],
      lab_result_verify: ['LabResult', idFor('LabResult', index)],
      receipt_verify: ['Invoice', idFor('Invoice', index)],
      patient_card: ['Patient', patientId(index)],
    }[type];
    return make('QrToken', index, {
      token: crypto.createHash('sha256').update(`${SEED_NAMESPACE}:qr:${index}`).digest('hex'),
      type,
      target_type: targetMap[0],
      target_id: targetMap[1],
      actor_type: index % 2 === 0 ? 'patient' : 'staff',
      actor_id: index % 2 === 0 ? patientAccountId(index) : userId(index),
      expires_at: addDays(dateAt(index, 0, 0), 30),
      revoked_at: index % 7 === 0 ? dateAt(index, 18, 0) : undefined,
      metadata: { ngon_ngu: 'vi', muc_dich: 'Dữ liệu QR mẫu' },
    });
  });
}

function buildConsentRecordDocs() {
  return indexes(BASE_COUNT).map((index) => make('ConsentRecord', index, {
    patient_id: patientId(index),
    actor_type: index % 2 === 0 ? 'patient' : 'staff',
    actor_id: index % 2 === 0 ? patientAccountId(index) : userId(index),
    consent_type: pick(['consent_to_treat', 'consent_to_share_record', 'consent_for_relative_access', 'consent_for_telehealth', 'consent_for_payment', 'consent_for_data_processing', 'imaging_contrast_consent', 'procedure_consent'], index),
    status: pick(['active', 'active', 'revoked', 'expired'], index),
    signed_at: dateAt(index, 7, 30),
    expires_at: addDays(dateAt(index, 0, 0), 365),
    document_attachment_id: idFor('Attachment', index),
    note: 'Bản ghi đồng ý điều trị và chia sẻ dữ liệu mẫu.',
  }));
}

function buildBreakGlassAccessDocs() {
  return indexes(BASE_COUNT).map((index) => make('BreakGlassAccess', index, {
    patient_id: patientId(index),
    accessed_by_user_id: doctorId(index),
    reason: 'Truy cập khẩn cấp để xử trí tình huống bệnh nhân cần can thiệp nhanh trong dữ liệu mẫu.',
    started_at: dateAt(index, 6, 50),
    ended_at: temporalBucket(index) === 'past' ? dateAt(index, 7, 20) : undefined,
    status: temporalBucket(index) === 'past' ? 'ended' : 'active',
    audit_log_ids: [],
  }));
}

function buildEmergencyCaseDocs() {
  return indexes(BASE_COUNT).map((index) => make('EmergencyCase', index, {
    case_code: code('KC-2026', index),
    patient_id: patientId(index),
    triggered_by_actor_type: index % 2 === 0 ? 'patient' : 'staff',
    triggered_by_actor_id: index % 2 === 0 ? patientAccountId(index) : userId(index),
    type: pick(['sos', 'medical_emergency', 'panic', 'fall', 'other'], index),
    status: temporalBucket(index) === 'past' ? pick(['resolved', 'cancelled', 'false_alarm'], index) : temporalBucket(index) === 'present' ? pick(['acknowledged', 'triaged', 'dispatched'], index) : 'created',
    priority: pick(['urgent', 'critical'], index),
    assigned_to_user_id: doctorId(index),
    assigned_department_id: departmentId(0),
    related_appointment_id: idFor('Appointment', index),
    related_encounter_id: idFor('Encounter', index),
    location_note: pick(['Sảnh chính', 'Khu cấp cứu', 'Phòng khám tim mạch', 'Khu nội trú tầng 3'], index),
    description: 'Tình huống khẩn cấp mẫu dùng để kiểm thử điều phối.',
    resolved_at: temporalBucket(index) === 'past' ? dateAt(index, 8, 10) : undefined,
  }));
}

function buildEmergencyCaseEventDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => make('EmergencyCaseEvent', index, {
    case_id: idFor('EmergencyCase', index % BASE_COUNT),
    event_type: pick(['created', 'acknowledged', 'triage_started', 'triage_completed', 'doctor_notified', 'resolved'], index),
    actor_id: index % 2 === 0 ? nurseId(index) : doctorId(index),
    from_status: pick(['created', 'acknowledged', 'triaged', 'dispatched'], index),
    to_status: pick(['acknowledged', 'triaged', 'dispatched', 'resolved'], index),
    note: pick([
      'Tiếp nhận tín hiệu cấp cứu từ khu chờ khám.',
      'Điều dưỡng đã đánh giá nhanh tình trạng người bệnh.',
      'Bác sĩ trực được thông báo và phản hồi trong ca.',
      'Bệnh nhân ổn định hơn sau xử trí ban đầu.',
    ], index),
    payload: {
      demoCode: code('DEMO-ER-EVENT', index),
      location: pick(['Sảnh chính', 'Phòng khám tim mạch', 'Khoa cấp cứu', 'Buồng bệnh A302'], index),
    },
  }));
}

function buildEmergencyTriageDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const completed = temporalBucket(index) !== 'future';
    return make('EmergencyTriage', index, {
      emergency_case_id: idFor('EmergencyCase', index % BASE_COUNT),
      patient_id: patientId(index),
      encounter_id: idFor('Encounter', index % BASE_COUNT),
      triage_by: nurseId(index),
      triage_started_at: dateAt(index, 7, 35),
      triage_completed_at: completed ? dateAt(index, 7, 45) : undefined,
      chief_complaint: pick(['Đau ngực kèm vã mồ hôi', 'Sốt cao khó hạ', 'Khó thở tăng dần', 'Té ngã trong khu chờ'], index),
      onset_time: dateAt(index, 5, 30),
      symptoms: pick(['Mệt, chóng mặt, đau tăng khi vận động', 'Sốt 38.8°C, ho khan', 'SpO2 giảm khi đi lại', 'Đau vùng cổ tay sau té'], index),
      airway_status: 'Thông thoáng',
      breathing_status: index % 4 === 0 ? 'Thở nhanh, cần theo dõi SpO2' : 'Tự thở ổn',
      circulation_status: index % 5 === 0 ? 'Mạch nhanh, huyết áp tăng' : 'Tưới máu ngoại biên ổn',
      disability_status: 'Tỉnh, tiếp xúc được',
      exposure_status: 'Không phát hiện chảy máu ngoài',
      temperature: index % 4 === 1 ? 38.7 : 36.7 + (index % 3) * 0.2,
      heart_rate: 78 + (index % 6) * 8,
      respiratory_rate: 18 + (index % 4) * 3,
      systolic_bp: index % 5 === 0 ? 168 : 112 + (index % 8) * 3,
      diastolic_bp: index % 5 === 0 ? 96 : 70 + (index % 6) * 2,
      spo2: index % 6 === 0 ? 92 : 96 + (index % 4),
      pain_score: index % 8,
      gcs_eye: 4,
      gcs_verbal: 5,
      gcs_motor: 6,
      avpu: 'alert',
      blood_glucose: 92 + index * 3,
      esi_level: pick([2, 3, 3, 4], index),
      triage_color: pick(['orange', 'yellow', 'green', 'yellow'], index),
      final_priority: pick(['urgent', 'critical'], index),
      risk_flags: index % 3 === 0 ? ['SpO2 thấp', 'Nguy cơ té ngã'] : ['Cần theo dõi sát'],
      recommended_actions: ['Đo lại sinh hiệu sau 15 phút', 'Báo bác sĩ trực nếu triệu chứng tăng'],
      disposition: pick(['Theo dõi tại cấp cứu', 'Chuyển phòng khám ưu tiên', 'Lưu theo dõi ngắn hạn'], index),
      doctor_required: index % 3 === 0,
      dispatch_required: index % 5 === 0,
      note: 'Phân loại cấp cứu được tạo cho bộ dữ liệu demo vận hành điều dưỡng.',
      status: completed ? pick(['completed', 'signed'], index) : 'in_progress',
      signed_by: completed ? nurseId(index) : undefined,
      signed_at: completed ? dateAt(index, 7, 50) : undefined,
    });
  });
}

function buildInpatientHandoverDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const itemIndex = index % BASE_COUNT;
    return make('InpatientHandover', index, {
      handover_no: code('BGNT-2026', index),
      department_id: doctorDepartmentId(itemIndex),
      shift_date: dateAt(index, 0, 0),
      from_shift: pick(['morning', 'afternoon', 'night'], index),
      to_shift: pick(['afternoon', 'night', 'morning'], index),
      outgoing_nurse_id: nurseId(index),
      incoming_nurse_id: nurseId(index + 1),
      status: temporalBucket(index) === 'past' ? 'closed' : pick(['prepared', 'signed', 'acknowledged'], index),
      summary: 'Bàn giao người bệnh nội trú trong ca, tập trung sinh hiệu bất thường và thuốc đến giờ.',
      patient_count: 3 + (index % 5),
      high_risk_count: index % 3,
      abnormal_vital_count: index % 4,
      overdue_task_count: index % 2,
      medication_due_count: 2 + (index % 3),
      items: [{
        admission_id: idFor('Admission', itemIndex),
        patient_id: patientId(itemIndex),
        bed_assignment_id: idFor('BedAssignment', itemIndex),
        room_id: idFor('Room', itemIndex),
        bed_id: idFor('Bed', itemIndex),
        priority: pick(['normal', 'high', 'urgent'], index),
        situation: pick(['Đang theo dõi huyết áp sau điều chỉnh thuốc.', 'Sau thủ thuật cần kiểm tra vết thương.', 'Sốt nhẹ, chờ kết quả xét nghiệm.'], index),
        background: 'Bệnh nhân nhập viện trong tuần, đã có kế hoạch chăm sóc và y lệnh đang thực hiện.',
        assessment: 'Tỉnh, tiếp xúc tốt; cần theo dõi sinh hiệu và đáp ứng thuốc trong ca tới.',
        recommendation: 'Đo sinh hiệu đúng giờ, nhắc uống thuốc, báo bác sĩ nếu đau tăng hoặc SpO2 giảm.',
        nursing_note: 'Đã dặn người nhà gọi chuông khi bệnh nhân chóng mặt.',
      }],
      signed_at: temporalBucket(index) !== 'future' ? dateAt(index, 13, 45) : undefined,
      signed_by: temporalBucket(index) !== 'future' ? nurseId(index) : undefined,
      acknowledged_at: temporalBucket(index) === 'past' ? dateAt(index, 14, 5) : undefined,
      acknowledged_by: temporalBucket(index) === 'past' ? nurseId(index + 1) : undefined,
    });
  });
}

function buildNursingHandoffDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const itemIndex = index % BASE_COUNT;
    return make('NursingHandoff', index, {
      handoff_code: code('BGDD-2026', index),
      department_id: doctorDepartmentId(itemIndex),
      ward_id: doctorDepartmentId(itemIndex),
      shift_date: dateAt(index, 0, 0),
      from_shift: pick(['morning', 'afternoon', 'night'], index),
      to_shift: pick(['afternoon', 'night', 'morning'], index),
      from_user_id: nurseId(index),
      to_user_id: nurseId(index + 1),
      to_team_role: 'Điều dưỡng ca kế tiếp',
      status: temporalBucket(index) === 'future' ? 'submitted' : pick(['accepted', 'submitted', 'draft'], index),
      summary: 'Bàn giao các bệnh nhân cần theo dõi sinh hiệu, dùng thuốc và chuẩn bị dịch vụ.',
      risk_summary: pick(['Có cảnh báo huyết áp cao cần báo bác sĩ nếu lặp lại.', 'Một bệnh nhân nguy cơ té ngã, cần hỗ trợ khi đi lại.', 'Có ca theo dõi sau dùng kháng sinh.'], index),
      patient_items: [{
        patient_id: patientId(itemIndex),
        encounter_id: idFor('Encounter', itemIndex),
        admission_id: idFor('Admission', itemIndex),
        bed_id: idFor('Bed', itemIndex),
        situation: 'Đang được chăm sóc trong ca, cần đo lại sinh hiệu.',
        background: 'Có y lệnh thuốc và kế hoạch chăm sóc đang mở.',
        assessment: 'Ổn định tương đối, còn cần theo dõi sát dấu hiệu cảnh báo.',
        recommendation: 'Ưu tiên hoàn tất nhiệm vụ quá hạn và cập nhật ghi chú điều dưỡng.',
        acuity_level: pick(['medium', 'high', 'critical', 'low'], index),
        flags: {
          allergy: index % 5 === 0,
          fall_risk: index % 4 === 0,
          isolation: false,
          critical_vitals: index % 3 === 0,
          post_procedure: index % 6 === 0,
          medication_attention: index % 4 === 1,
          doctor_report_needed: index % 3 === 0,
        },
        latest_vitals_snapshot: { blood_pressure: index % 3 === 0 ? '168/96' : '122/78', pulse: 82 + index },
        pending_task_ids: [idFor('NursingTask', index)],
        overdue_task_ids: index % 4 === 0 ? [idFor('NursingTask', index)] : [],
        pending_medication_ids: [idFor('MedicationAdministration', itemIndex)],
        pending_order_ids: [orderId('service', itemIndex)],
        note: 'Người bệnh hợp tác, cần nhắc uống nước và nghỉ tại giường.',
      }],
      task_ids: [idFor('NursingTask', index)],
      submitted_at: temporalBucket(index) !== 'future' ? dateAt(index, 13, 50) : undefined,
      accepted_at: temporalBucket(index) === 'past' ? dateAt(index, 14, 10) : undefined,
      accepted_by: temporalBucket(index) === 'past' ? nurseId(index + 1) : undefined,
    });
  });
}

function buildNursingTaskTemplateDocs() {
  return indexes(12).map((index) => make('NursingTaskTemplate', index, {
    template_code: code('MNV-DD', index),
    name: pick(['Đo sinh hiệu định kỳ', 'Chuẩn bị lấy mẫu xét nghiệm', 'Theo dõi sau dùng thuốc', 'Chăm sóc vết thương', 'Báo bác sĩ theo SBAR', 'Bàn giao ca'], index),
    description: 'Mẫu nhiệm vụ chuẩn cho điều dưỡng trong ca trực.',
    department_id: doctorDepartmentId(index),
    task_type: pick(['vital_sign', 'specimen_collection', 'post_medication_monitor', 'bedside_care', 'doctor_report', 'handoff_followup'], index),
    title_template: pick(['Đo sinh hiệu cho {{patient}}', 'Chuẩn bị mẫu xét nghiệm cho {{patient}}', 'Theo dõi phản ứng thuốc của {{patient}}'], index),
    description_template: 'Thực hiện đúng quy trình, ghi nhận kết quả và báo bác sĩ khi có bất thường.',
    default_priority: pick(['normal', 'medium', 'high', 'urgent'], index),
    default_sla_minutes: pick([15, 30, 45, 60], index),
    source_module: 'manual',
    checklist_items: [
      { title: 'Xác nhận đúng người bệnh', required: true },
      { title: 'Ghi nhận kết quả vào hồ sơ', required: true },
      { title: 'Báo bác sĩ nếu có dấu hiệu cảnh báo', required: false },
    ],
    status: 'active',
  }));
}

function buildServicePreparationDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => {
    const sourceType = index < BASE_COUNT ? pick(['pre_exam', 'lab', 'imaging', 'procedure', 'service', 'nursing'], index) : 'other';
    const base = index % BASE_COUNT;
    return make('ServicePreparation', index, {
      preparation_no: code('CBDV-2026', index),
      patient_id: patientId(index),
      encounter_id: idFor('Encounter', base),
      admission_id: index % 4 === 0 ? idFor('Admission', base) : undefined,
      source_type: sourceType,
      order_id: sourceType === 'service' || sourceType === 'nursing' ? orderId('service', base) : undefined,
      lab_order_id: sourceType === 'lab' ? idFor('LabOrder', base) : undefined,
      imaging_order_id: sourceType === 'imaging' ? idFor('ImagingOrder', base) : undefined,
      procedure_order_id: sourceType === 'procedure' ? idFor('ProcedureOrder', base) : undefined,
      queue_ticket_id: sourceType === 'pre_exam' ? idFor('QueueTicket', base) : undefined,
      department_id: doctorDepartmentId(base),
      destination_department_id: sourceType === 'lab' ? departmentId(7) : sourceType === 'imaging' ? departmentId(6) : doctorDepartmentId(base),
      room_id: idFor('Room', base),
      title: pick(['Chuẩn bị lấy máu xét nghiệm', 'Chuẩn bị siêu âm ổ bụng', 'Chuẩn bị thay băng vết thương', 'Chuẩn bị khám bác sĩ'], index),
      description: 'Điều dưỡng xác nhận thông tin, hướng dẫn người bệnh và hoàn tất checklist trước khi chuyển bước.',
      priority: pick(['routine', 'urgent', 'stat'], index),
      status: temporalBucket(index) === 'past' ? 'completed' : temporalBucket(index) === 'present' ? pick(['assigned', 'in_progress', 'ready', 'blocked'], index) : 'pending',
      assigned_nurse_id: nurseId(index),
      assigned_at: dateAt(index, 7, 50),
      started_by: temporalBucket(index) !== 'future' ? nurseId(index) : undefined,
      started_at: temporalBucket(index) !== 'future' ? dateAt(index, 8, 5) : undefined,
      ready_by: ['ready', 'completed'].includes(temporalBucket(index) === 'past' ? 'completed' : pick(['assigned', 'in_progress', 'ready', 'blocked'], index)) ? nurseId(index) : undefined,
      ready_at: temporalBucket(index) === 'past' ? dateAt(index, 8, 25) : undefined,
      completed_by: temporalBucket(index) === 'past' ? nurseId(index) : undefined,
      completed_at: temporalBucket(index) === 'past' ? dateAt(index, 8, 40) : undefined,
      blocked_reason_text: index % 7 === 0 ? 'Người bệnh cần nhịn ăn thêm trước siêu âm.' : undefined,
      sla_due_at: dateAt(index, 9, 0),
      sla_level: index % 6 === 0 ? 'warning' : 'normal',
      checklist_total: 4,
      checklist_done: temporalBucket(index) === 'future' ? 0 : 3,
      checklist_required_total: 3,
      checklist_required_done: temporalBucket(index) === 'future' ? 0 : 2,
      readiness_score: temporalBucket(index) === 'future' ? 0 : 75,
      has_safety_risk: index % 5 === 0,
      safety_risk_codes: index % 5 === 0 ? ['fall_risk', 'contrast_allergy_check'] : [],
      last_note: 'Đã giải thích quy trình, người bệnh hợp tác.',
      last_activity_at: dateAt(index, 8, 15),
    });
  });
}

function buildPreparationChecklistTemplateDocs() {
  return indexes(12).map((index) => make('PreparationChecklistTemplate', index, {
    template_code: code('TPL-CBDV', index),
    name: pick(['Checklist trước xét nghiệm máu', 'Checklist trước chẩn đoán hình ảnh', 'Checklist trước thủ thuật', 'Checklist trước khám'], index),
    source_type: pick(['lab', 'imaging', 'procedure', 'pre_exam'], index),
    order_type: pick(['lab', 'imaging', 'procedure', 'service'], index),
    modality: index % 4 === 1 ? pick(['xray', 'ultrasound', 'ct', 'mri'], index) : undefined,
    procedure_code: index % 4 === 2 ? procedureSeed(index)[0] : undefined,
    test_code: index % 4 === 0 ? labTestSeed(index)[0] : undefined,
    specimen_type: index % 4 === 0 ? labTestSeed(index)[3] : undefined,
    department_id: doctorDepartmentId(index),
    version: 1,
    is_default: index % 4 === 0,
    is_active: true,
    items: [
      { code: 'identity_check', label: 'Xác nhận đúng người bệnh', category: 'identity', required: true, critical: true, sort_order: 1 },
      { code: 'allergy_check', label: 'Kiểm tra dị ứng và chống chỉ định', category: 'safety', required: true, critical: true, sort_order: 2 },
      { code: 'instruction_given', label: 'Hướng dẫn người bệnh trước dịch vụ', category: 'instruction', required: true, sort_order: 3 },
    ],
  }));
}

function buildPreparationChecklistItemDocs() {
  const itemTemplates = [
    ['identity_check', 'Xác nhận họ tên, năm sinh và mã hồ sơ', 'identity', true, true],
    ['allergy_check', 'Kiểm tra dị ứng thuốc, thức ăn, thuốc cản quang', 'safety', true, true],
    ['instruction_given', 'Hướng dẫn quy trình và lưu ý sau thực hiện', 'instruction', true, false],
    ['consent_ready', 'Kiểm tra phiếu đồng ý nếu cần', 'document', false, false],
  ];

  return indexes(NURSE_WORKSPACE_COUNT).flatMap((prepIndex) =>
    itemTemplates.map(([itemCode, label, category, required, critical], itemIndex) => {
      const done = temporalBucket(prepIndex) === 'past' || (temporalBucket(prepIndex) === 'present' && itemIndex < 2);
      return make('PreparationChecklistItem', prepIndex * itemTemplates.length + itemIndex, {
        preparation_id: idFor('ServicePreparation', prepIndex),
        template_code: code('TPL-CBDV', prepIndex % 12),
        template_item_code: itemCode,
        code: itemCode,
        label,
        description: 'Mục checklist dùng trong quy trình chuẩn bị dịch vụ điều dưỡng.',
        category,
        required,
        critical,
        status: done ? 'done' : itemIndex === 3 && prepIndex % 5 === 0 ? 'waived' : 'pending',
        value_type: 'boolean',
        value: done,
        completed_by: done ? nurseId(prepIndex) : undefined,
        completed_at: done ? dateAt(prepIndex, 8, 10 + itemIndex * 5) : undefined,
        waived_by: itemIndex === 3 && prepIndex % 5 === 0 ? nurseId(prepIndex) : undefined,
        waived_at: itemIndex === 3 && prepIndex % 5 === 0 ? dateAt(prepIndex, 8, 25) : undefined,
        waived_reason: itemIndex === 3 && prepIndex % 5 === 0 ? 'Dịch vụ không yêu cầu phiếu đồng ý riêng.' : undefined,
        note: done ? 'Đã xác nhận trong ca trực.' : undefined,
        sort_order: itemIndex + 1,
      });
    }),
  );
}

function buildPreparationActivityDocs() {
  return indexes(NURSE_WORKSPACE_COUNT * 2).map((index) => {
    const prepIndex = index % NURSE_WORKSPACE_COUNT;
    return make('PreparationActivity', index, {
      preparation_id: idFor('ServicePreparation', prepIndex),
      patient_id: patientId(prepIndex),
      encounter_id: idFor('Encounter', prepIndex % BASE_COUNT),
      actor_id: nurseId(prepIndex),
      action: pick(['created', 'assigned', 'started', 'checklist_item_done', 'ready', 'note_added'], index),
      message: pick([
        'Tạo hồ sơ chuẩn bị dịch vụ từ y lệnh.',
        'Phân công điều dưỡng phụ trách chuẩn bị.',
        'Bắt đầu hướng dẫn người bệnh trước dịch vụ.',
        'Hoàn tất một mục checklist bắt buộc.',
        'Người bệnh đã sẵn sàng chuyển bước.',
        'Bổ sung ghi chú điều dưỡng ngắn.',
      ], index),
      metadata: { demoCode: code('ACT-CBDV', index), shift: pick(['morning', 'afternoon', 'night'], index) },
      created_at: dateAt(prepIndex, 8, 5 + (index % 6) * 7),
    });
  });
}

function buildVitalSignCorrectionRequestDocs() {
  return indexes(12).map((index) => make('VitalSignCorrectionRequest', index, {
    vital_sign_id: idFor('VitalSign', index % BASE_COUNT),
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index % BASE_COUNT),
    department_id: doctorDepartmentId(index),
    requested_by: nurseId(index),
    requested_at: dateAt(index, 10, 20),
    reason: pick(['Nhập nhầm thời điểm đo', 'Cần sửa giá trị huyết áp sau đo lại', 'Thiết bị đo SpO2 báo sai lần đầu', 'Ghi trùng một lần đo'], index),
    reason_category: pick(['wrong_time', 'wrong_value', 'device_error', 'duplicate'], index),
    current_values: { blood_pressure: index % 3 === 0 ? '186/102' : '124/78', spo2: index % 4 === 0 ? 91 : 98 },
    proposed_values: { blood_pressure: index % 3 === 0 ? '166/94' : '122/76', spo2: index % 4 === 0 ? 96 : 98 },
    status: pick(['pending', 'approved', 'applied', 'rejected'], index),
    reviewed_by: index % 4 !== 0 ? doctorId(index) : undefined,
    reviewed_at: index % 4 !== 0 ? dateAt(index, 10, 45) : undefined,
    review_note: index % 4 !== 0 ? 'Đã đối chiếu phiếu theo dõi tại giường.' : undefined,
  }));
}

function buildNursingMonitoringSessionDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => make('NursingMonitoringSession', index, {
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index % BASE_COUNT),
    admission_id: index % 4 === 0 ? idFor('Admission', index % BASE_COUNT) : undefined,
    source_type: pick(['abnormal_vital', 'post_procedure', 'post_medication', 'doctor_request', 'manual'], index),
    source_id: index % 3 === 0 ? idFor('VitalSign', index % BASE_COUNT) : undefined,
    reason: pick(['Huyết áp cao cần theo dõi mỗi 30 phút', 'Theo dõi sốt sau truyền dịch', 'SpO2 thấp khi vận động', 'Theo dõi phản ứng sau dùng kháng sinh'], index),
    priority: pick(['medium', 'high', 'critical', 'low'], index),
    risk_score: 35 + (index % 6) * 10,
    status: temporalBucket(index) === 'past' ? pick(['stable', 'resolved'], index) : pick(['active', 'watching', 'doctor_notified', 'escalated'], index),
    assigned_nurse_id: nurseId(index),
    attending_doctor_id: doctorId(index),
    department_id: doctorDepartmentId(index),
    started_at: dateAt(index, 8, 0),
    last_checked_at: dateAt(index, 9, 20),
    next_check_at: temporalBucket(index) !== 'past' ? dateAt(index, 10, 0) : undefined,
    sla_due_at: temporalBucket(index) !== 'past' ? dateAt(index, 10, 15) : undefined,
    doctor_notified_at: index % 4 === 0 ? dateAt(index, 9, 35) : undefined,
    escalated_at: index % 8 === 0 ? dateAt(index, 9, 50) : undefined,
    resolved_at: temporalBucket(index) === 'past' ? dateAt(index, 11, 30) : undefined,
    tags: index % 3 === 0 ? ['huyet_ap_cao', 'can_bao_bac_si'] : ['theo_doi_dinh_ky'],
    metadata: { demoCode: code('MON-DD', index), shift: pick(['morning', 'afternoon', 'night'], index) },
  }));
}

function buildNursingMonitoringCheckDocs() {
  return indexes(NURSE_WORKSPACE_COUNT * 2).map((index) => {
    const sessionIndex = index % NURSE_WORKSPACE_COUNT;
    return make('NursingMonitoringCheck', index, {
      monitoring_session_id: idFor('NursingMonitoringSession', sessionIndex),
      patient_id: patientId(sessionIndex),
      encounter_id: idFor('Encounter', sessionIndex % BASE_COUNT),
      checked_by: nurseId(sessionIndex),
      checked_at: dateAt(sessionIndex, 8 + (index % 3), 10 + (index % 4) * 10),
      subjective_note: pick(['Bệnh nhân đỡ mệt, còn hơi chóng mặt.', 'Bệnh nhân còn sốt nhẹ, uống nước được.', 'Không đau ngực, không khó thở tăng.', 'Ngủ được, gọi hỏi đáp tốt.'], index),
      objective_note: pick(['Da niêm hồng, không co kéo hô hấp.', 'Mạch đều, SpO2 cải thiện sau nghỉ.', 'Vết thương khô, không thấm dịch.', 'Huyết áp giảm sau nghỉ tại giường.'], index),
      intervention_note: pick(['Nhắc nghỉ tại giường và báo khi chóng mặt.', 'Lau mát, khuyến khích uống nước theo chỉ định.', 'Đặt chuông gọi trong tầm tay.', 'Báo bác sĩ khi chỉ số vượt ngưỡng.'], index),
      vital_sign_id: idFor('VitalSign', sessionIndex % BASE_COUNT),
      pain_score: sessionIndex % 7,
      consciousness: 'Tỉnh, tiếp xúc tốt',
      warning_flags: sessionIndex % 5 === 0 ? ['SpO2 thấp', 'Huyết áp cao'] : [],
      next_check_at: dateAt(sessionIndex, 10, 0),
      need_doctor_notification: sessionIndex % 5 === 0,
      status_after_check: pick(['stable', 'watching', 'worse', 'critical'], index),
    });
  });
}

function buildDoctorNotificationRequestDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => make('DoctorNotificationRequest', index, {
    request_no: code('BCBS-2026', index),
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index % BASE_COUNT),
    admission_id: index % 4 === 0 ? idFor('Admission', index % BASE_COUNT) : undefined,
    from_nurse_id: nurseId(index),
    to_doctor_id: doctorId(index),
    department_id: doctorDepartmentId(index),
    priority: pick(['routine', 'urgent', 'stat', 'critical'], index),
    category: pick(['abnormal_vital', 'post_procedure', 'post_medication', 'patient_complaint', 'manual'], index),
    sbar: {
      situation: pick(['Huyết áp đo lại vẫn cao.', 'Bệnh nhân sốt sau truyền dịch.', 'Người bệnh nổi mẩn nhẹ sau thuốc.', 'SpO2 giảm khi đi lại.'], index),
      background: 'Bệnh nhân đang trong quy trình theo dõi điều dưỡng hôm nay.',
      assessment: 'Tỉnh, tiếp xúc được; cần bác sĩ xem xét y lệnh nếu triệu chứng không cải thiện.',
      recommendation: 'Đề nghị bác sĩ phản hồi hướng xử trí và ngưỡng báo lại.',
    },
    latest_vital_sign_id: idFor('VitalSign', index % BASE_COUNT),
    related_order_id: orderId('service', index % BASE_COUNT),
    related_alert_id: idFor('ClinicalAlert', index),
    status: temporalBucket(index) === 'past' ? pick(['responded', 'closed', 'acknowledged'], index) : pick(['sent', 'delivered', 'seen', 'escalated'], index),
    sent_at: dateAt(index, 9, 30),
    delivered_at: dateAt(index, 9, 31),
    seen_at: index % 3 !== 0 ? dateAt(index, 9, 40) : undefined,
    acknowledged_at: temporalBucket(index) === 'past' ? dateAt(index, 9, 45) : undefined,
    responded_at: temporalBucket(index) === 'past' ? dateAt(index, 10, 0) : undefined,
    doctor_response: temporalBucket(index) === 'past' ? 'Tiếp tục theo dõi, báo lại nếu huyết áp trên 170/100 hoặc khó thở.' : undefined,
    sla_due_at: dateAt(index, 10, 0),
    escalation_level: index % 8 === 0 ? 1 : 0,
    escalated_to_user_id: index % 8 === 0 ? doctorId(index + 1) : undefined,
    escalated_at: index % 8 === 0 ? dateAt(index, 9, 55) : undefined,
  }));
}

function buildClinicalAlertRuleDocs() {
  const rules = [
    ['BP_HIGH', 'Cảnh báo huyết áp cao', 'vital_sign', { systolic_gte: 160, diastolic_gte: 95 }, 'high'],
    ['FEVER', 'Cảnh báo sốt', 'vital_sign', { temperature_gte: 38.5 }, 'warning'],
    ['SPO2_LOW', 'Cảnh báo SpO2 thấp', 'vital_sign', { spo2_lte: 94 }, 'critical'],
    ['DRUG_ALLERGY', 'Cảnh báo dị ứng thuốc', 'medication_reaction', { suspected_allergy: true }, 'high'],
    ['FALL_RISK', 'Cảnh báo nguy cơ té ngã', 'manual', { fall_risk_score_gte: 3 }, 'warning'],
    ['POST_PROC_PAIN', 'Đau tăng sau thủ thuật', 'procedure_observation', { pain_score_gte: 7 }, 'high'],
    ['LAB_CRITICAL', 'Kết quả xét nghiệm nguy cấp', 'lab_result_item', { critical: true }, 'critical'],
    ['WOUND_BLEEDING', 'Chảy máu vết thương', 'procedure_observation', { bleeding_level: 'moderate' }, 'high'],
    ['GLUCOSE_HIGH', 'Đường huyết cao', 'vital_sign', { glucose_gte: 250 }, 'warning'],
    ['NEWS2_HIGH', 'Điểm cảnh báo sớm cao', 'vital_sign', { news2_gte: 7 }, 'critical'],
    ['MED_REACTION', 'Phản ứng sau dùng thuốc', 'medication_reaction', { severity_gte: 'moderate' }, 'high'],
    ['NURSE_ESCALATION', 'Điều dưỡng yêu cầu hỗ trợ', 'manual', { escalation_level_gte: 1 }, 'warning'],
  ];

  return rules.map(([ruleCode, name, sourceType, condition, severity], index) => make('ClinicalAlertRule', index, {
    code: ruleCode,
    name,
    source_type: sourceType,
    condition,
    severity,
    title_template: name,
    message_template: 'Người bệnh có dấu hiệu cần điều dưỡng kiểm tra và báo bác sĩ khi cần.',
    suggested_action: 'Đánh giá lại tại giường, ghi nhận sinh hiệu mới và xử trí theo quy trình khoa.',
    enabled: true,
    department_id: doctorDepartmentId(index),
  }));
}

function buildClinicalAlertDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => make('ClinicalAlert', index, {
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index % BASE_COUNT),
    admission_id: index % 4 === 0 ? idFor('Admission', index % BASE_COUNT) : undefined,
    source_type: pick(['vital_sign', 'medication_reaction', 'procedure_observation', 'manual'], index),
    source_id: idFor(index % 2 === 0 ? 'VitalSign' : 'NursingMonitoringSession', index % BASE_COUNT),
    rule_code: pick(['BP_HIGH', 'FEVER', 'SPO2_LOW', 'DRUG_ALLERGY', 'FALL_RISK'], index),
    title: pick(['Huyết áp cao cần theo dõi', 'Sốt 38.8°C', 'SpO2 thấp khi vận động', 'Nghi ngờ dị ứng thuốc', 'Nguy cơ té ngã cao'], index),
    message: pick([
      'Huyết áp sau nghỉ vẫn cao, cần đo lại và báo bác sĩ nếu không giảm.',
      'Bệnh nhân sốt nhẹ, cần theo dõi nhiệt độ và dấu hiệu nhiễm trùng.',
      'SpO2 xuống 92% khi đi lại, cần cho nghỉ và đánh giá hô hấp.',
      'Nổi mẩn sau dùng thuốc, cần theo dõi phản ứng dị ứng.',
      'Người bệnh chóng mặt khi đứng dậy, cần hỗ trợ di chuyển.',
    ], index),
    severity: pick(['high', 'warning', 'critical', 'high', 'warning'], index),
    status: temporalBucket(index) === 'past' ? pick(['resolved', 'acknowledged'], index) : pick(['open', 'doctor_notified', 'escalated'], index),
    assigned_to_user_id: nurseId(index),
    department_id: doctorDepartmentId(index),
    acknowledged_by: temporalBucket(index) !== 'future' ? nurseId(index) : undefined,
    acknowledged_at: temporalBucket(index) !== 'future' ? dateAt(index, 9, 10) : undefined,
    doctor_notification_request_id: idFor('DoctorNotificationRequest', index),
    doctor_notified_at: index % 3 === 0 ? dateAt(index, 9, 35) : undefined,
    escalated_at: index % 8 === 0 ? dateAt(index, 9, 50) : undefined,
    resolved_by: temporalBucket(index) === 'past' ? nurseId(index) : undefined,
    resolved_at: temporalBucket(index) === 'past' ? dateAt(index, 11, 0) : undefined,
    sla_due_at: dateAt(index, 10, 0),
    breached_at: index % 9 === 0 ? dateAt(index, 10, 5) : undefined,
  }));
}

function buildPostProcedureObservationDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => make('PostProcedureObservation', index, {
    procedure_order_id: idFor('ProcedureOrder', index % BASE_COUNT),
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index % BASE_COUNT),
    admission_id: index % 4 === 0 ? idFor('Admission', index % BASE_COUNT) : undefined,
    observed_by: nurseId(index),
    observed_at: dateAt(index, 10, 30),
    pain_score: index % 8,
    bleeding_level: pick(['none', 'mild', 'moderate', 'none'], index),
    wound_status: pick(['Vết thương khô, mép gọn', 'Băng hơi thấm dịch hồng nhạt', 'Không sưng nóng đỏ', 'Cần thay băng lại trong ca'], index),
    consciousness: 'alert',
    nausea: index % 6 === 0,
    vomiting: false,
    dizziness: index % 5 === 0,
    dyspnea: index % 9 === 0,
    vital_sign_id: idFor('VitalSign', index % BASE_COUNT),
    intervention_note: 'Đã kiểm tra băng, hướng dẫn người bệnh báo khi đau tăng hoặc chóng mặt.',
    patient_instruction: 'Giữ vùng thủ thuật khô, không tự tháo băng.',
    complication_flags: index % 6 === 0 ? ['pain_increase'] : [],
    severity: pick(['normal', 'watch', 'urgent'], index),
    next_check_at: dateAt(index, 11, 30),
    doctor_notified: index % 6 === 0,
    doctor_notification_request_id: index % 6 === 0 ? idFor('DoctorNotificationRequest', index) : undefined,
    status: temporalBucket(index) === 'past' ? 'resolved' : pick(['monitoring', 'stable', 'doctor_notified'], index),
  }));
}

function buildMedicationReactionObservationDocs() {
  return indexes(NURSE_WORKSPACE_COUNT).map((index) => make('MedicationReactionObservation', index, {
    medication_administration_id: idFor('MedicationAdministration', index % BASE_COUNT),
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index % BASE_COUNT),
    admission_id: index % 4 === 0 ? idFor('Admission', index % BASE_COUNT) : undefined,
    observed_by: nurseId(index),
    observed_at: dateAt(index, 10, 45),
    symptoms: index % 5 === 0 ? ['Nổi mẩn nhẹ vùng cổ tay', 'Ngứa da'] : ['Không ghi nhận phản ứng bất thường'],
    onset_at: index % 5 === 0 ? dateAt(index, 10, 30) : undefined,
    severity: index % 5 === 0 ? pick(['mild', 'moderate'], index) : 'mild',
    suspected_allergy: index % 5 === 0,
    suspected_medication_id: idFor('MedicationMaster', index % medicationSeeds.length),
    vital_sign_id: idFor('VitalSign', index % BASE_COUNT),
    intervention_note: index % 5 === 0 ? 'Tạm ngưng theo dõi thêm, báo bác sĩ nếu mẩn lan rộng.' : 'Theo dõi sau dùng thuốc ổn định.',
    medication_stopped: index % 10 === 0,
    doctor_notification_request_id: index % 5 === 0 ? idFor('DoctorNotificationRequest', index) : undefined,
    status: index % 5 === 0 ? pick(['observed', 'doctor_notified', 'allergy_recorded'], index) : 'resolved',
  }));
}

function buildFacilityLocationDocs() {
  return indexes(BASE_COUNT).map((index) => make('FacilityLocation', index, {
    name: pick([
      'Cơ sở Minh Châu Quận 1',
      'Phòng khám vệ tinh Thủ Đức',
      'Nhà thuốc Minh Châu',
      'Trung tâm Xét nghiệm Minh Châu',
      'Khu Chẩn đoán hình ảnh',
      'Chi nhánh Tân Bình',
    ], index) + ` ${index + 1}`,
    code: code('CS', index),
    type: pick(['clinic', 'pharmacy', 'lab', 'imaging', 'hospital_branch'], index),
    department_id: departmentId(index % departmentSeeds.length),
    address: pick(patientProfiles, index)[3],
    phone: phone('028', 7000000 + index),
    opening_hours: { thu_hai_thu_sau: '07:00-20:00', thu_bay: '07:00-17:00', chu_nhat: '08:00-12:00' },
    status: index % 6 === 0 ? 'maintenance' : 'active',
    public_visible: true,
  }));
}

function buildAllDocs(passwordHash) {
  const builders = {
    Department: buildDepartmentDocs,
    User: () => buildUserDocs(passwordHash),
    Role: buildRoleDocs,
    Permission: buildPermissionDocs,
    RolePermission: buildRolePermissionDocs,
    UserRole: buildUserRoleDocs,
    UserPreference: buildUserPreferenceDocs,
    DoctorProfile: buildDoctorProfileDocs,
    SystemSetting: buildSystemSettingDocs,
    Patient: buildPatientDocs,
    PatientIdentifier: buildPatientIdentifierDocs,
    PatientAccount: () => buildPatientAccountDocs(passwordHash),
    PatientRelative: buildPatientRelativeDocs,
    PatientAuthorization: buildPatientAuthorizationDocs,
    PatientProfileChangeRequest: buildPatientProfileChangeRequestDocs,
    DoctorSchedule: buildDoctorScheduleDocs,
    ScheduleSlot: buildScheduleSlotDocs,
    Appointment: buildAppointmentDocs,
    AppointmentWaitlist: buildAppointmentWaitlistDocs,
    QueueTicket: buildQueueTicketDocs,
    Encounter: buildEncounterDocs,
    Consultation: buildConsultationDocs,
    ClinicalNote: buildClinicalNoteDocs,
    Diagnosis: buildDiagnosisDocs,
    ProblemList: buildProblemListDocs,
    Allergy: buildAllergyDocs,
    VitalSign: buildVitalSignDocs,
    CarePlan: buildCarePlanDocs,
    Order: buildOrderDocs,
    LabOrder: buildLabOrderDocs,
    Specimen: buildSpecimenDocs,
    LabResult: buildLabResultDocs,
    LabResultItem: buildLabResultItemDocs,
    LabTestCatalog: buildLabTestCatalogDocs,
    ImagingOrder: buildImagingOrderDocs,
    ImagingReport: buildImagingReportDocs,
    ImagingModality: buildImagingModalityDocs,
    ProcedureOrder: buildProcedureOrderDocs,
    MedicationMaster: buildMedicationMasterDocs,
    Prescription: buildPrescriptionDocs,
    PrescriptionItem: buildPrescriptionItemDocs,
    PrescriptionRefillRequest: buildPrescriptionRefillRequestDocs,
    Dispense: buildDispenseDocs,
    DispenseItem: buildDispenseItemDocs,
    MedicationAdministration: buildMedicationAdministrationDocs,
    StockBatch: buildStockBatchDocs,
    InventoryTransaction: buildInventoryTransactionDocs,
    Room: buildRoomDocs,
    Bed: buildBedDocs,
    Admission: buildAdmissionDocs,
    BedAssignment: buildBedAssignmentDocs,
    InpatientTask: buildInpatientTaskDocs,
    InpatientHandover: buildInpatientHandoverDocs,
    NursingIntake: buildNursingIntakeDocs,
    NursingTask: buildNursingTaskDocs,
    NursingHandoff: buildNursingHandoffDocs,
    NursingTaskTemplate: buildNursingTaskTemplateDocs,
    TriageAssessment: buildTriageAssessmentDocs,
    ServicePreparationChecklist: buildServicePreparationChecklistDocs,
    ServicePreparation: buildServicePreparationDocs,
    PreparationChecklistTemplate: buildPreparationChecklistTemplateDocs,
    PreparationChecklistItem: buildPreparationChecklistItemDocs,
    PreparationActivity: buildPreparationActivityDocs,
    VitalSignCorrectionRequest: buildVitalSignCorrectionRequestDocs,
    NursingMonitoringSession: buildNursingMonitoringSessionDocs,
    NursingMonitoringCheck: buildNursingMonitoringCheckDocs,
    DoctorNotificationRequest: buildDoctorNotificationRequestDocs,
    ClinicalAlert: buildClinicalAlertDocs,
    ClinicalAlertRule: buildClinicalAlertRuleDocs,
    PostProcedureObservation: buildPostProcedureObservationDocs,
    MedicationReactionObservation: buildMedicationReactionObservationDocs,
    ServiceCatalog: buildServiceCatalogDocs,
    Charge: buildChargeDocs,
    Invoice: buildInvoiceDocs,
    InvoiceItem: buildInvoiceItemDocs,
    PaymentIntent: buildPaymentIntentDocs,
    Payment: buildPaymentDocs,
    InsurancePolicy: buildInsurancePolicyDocs,
    InsuranceClaim: buildInsuranceClaimDocs,
    MedicalRecord: buildMedicalRecordDocs,
    Attachment: buildAttachmentDocs,
    DocumentExportRequest: buildDocumentExportRequestDocs,
    Notification: buildNotificationDocs,
    NotificationDelivery: buildNotificationDeliveryDocs,
    NotificationPreference: buildNotificationPreferenceDocs,
    NotificationTemplate: buildNotificationTemplateDocs,
    Conversation: buildConversationDocs,
    ConversationParticipant: buildConversationParticipantDocs,
    Message: buildMessageDocs,
    ConversationCall: buildConversationCallDocs,
    MessageAttachment: buildMessageAttachmentDocs,
    SupportTicket: buildSupportTicketDocs,
    ApprovalRequest: buildApprovalRequestDocs,
    QrToken: buildQrTokenDocs,
    ConsentRecord: buildConsentRecordDocs,
    BreakGlassAccess: buildBreakGlassAccessDocs,
    EmergencyCase: buildEmergencyCaseDocs,
    EmergencyCaseEvent: buildEmergencyCaseEventDocs,
    EmergencyTriage: buildEmergencyTriageDocs,
    FacilityLocation: buildFacilityLocationDocs,
  };

  const docsByModel = new Map();
  const targetModels = Object.entries(models)
    .filter(([name, Model]) => Model?.schema && !SKIPPED_MODELS.has(name) && builders[name])
    .map(([name]) => name);

  for (const modelName of targetModels) {
    const builder = builders[modelName];
    docsByModel.set(modelName, builder());
  }

  return docsByModel;
}

async function validateDocs(docsByModel) {
  const errors = [];
  for (const [modelName, docs] of docsByModel.entries()) {
    const Model = models[modelName];
    for (const doc of docs) {
      try {
        await new Model(doc).validate();
      } catch (error) {
        errors.push(`${modelName}/${doc._id}: ${error.message}`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Seed data validation failed:\n- ${errors.join('\n- ')}`);
  }
}

async function upsertDocs(docsByModel) {
  const summary = [];
  for (const [modelName, docs] of docsByModel.entries()) {
    const Model = models[modelName];
    if (RESET_BEFORE_UPSERT_MODELS.has(modelName)) {
      await Model.deleteMany({ _id: { $in: docs.map((doc) => doc._id) } });
    }
    if (modelName === 'UserPreference') {
      await Model.deleteMany({
        $or: [
          { actor_type: 'staff', actor_id: { $in: staffProfiles.map((_, index) => userId(index)) } },
          { actor_type: 'patient', actor_id: { $in: patientProfiles.map((_, index) => patientAccountId(index)) } },
        ],
      });
    }
    if (modelName === 'DoctorSchedule' || modelName === 'ScheduleSlot') {
      await Model.deleteMany({ doctor_id: { $in: indexes(DOCTOR_COUNT).map((index) => doctorId(index)) } });
    }
    const operations = docs.map((doc) => {
      const { _id, created_at: createdAt, ...set } = doc;
      return {
        updateOne: {
          filter: { _id },
          update: {
            $set: set,
            $setOnInsert: { _id, created_at: createdAt || new Date() },
          },
          upsert: true,
        },
      };
    });

    const result = await Model.bulkWrite(operations, {
      ordered: modelName === 'Order',
      timestamps: false,
      ...(modelName === 'Order' ? { strict: false } : {}),
    });

    const seededCount = await Model.countDocuments({ _id: { $in: docs.map((doc) => doc._id) } });
    summary.push({
      model: modelName,
      collection: Model.collection.name,
      requested: docs.length,
      seeded: seededCount,
      upserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
    });
  }

  return summary;
}

function printSummary(summary) {
  const rows = summary.map((item) => ({
    model: item.model,
    collection: item.collection,
    seeded: item.seeded ?? item.requested,
    requested: item.requested,
    upserted: item.upserted ?? 0,
    modified: item.modified ?? 0,
  }));
  console.table(rows);

  const belowMinimum = rows.filter((item) => item.seeded <= 10);
  if (belowMinimum.length) {
    throw new Error(`Một số collection chưa đạt trên 10 bản ghi seed: ${belowMinimum.map((item) => item.collection).join(', ')}`);
  }
}

async function connectSeedDatabase() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;

  if (!uri) throw new Error('Missing MONGODB_URI in .env.');
  if (dbName !== 'healthcare_system') {
    throw new Error(`Refusing to seed database "${dbName || '(empty)'}"; expected "healthcare_system".`);
  }

  await mongoose.connect(uri, { dbName });
  if (mongoose.connection.name !== 'healthcare_system') {
    throw new Error(`Refusing to seed connected database "${mongoose.connection.name}"; expected "healthcare_system".`);
  }

  console.log(`Connected database: ${mongoose.connection.name}`);
}

async function ensureDemoCoreRoleAssignments() {
  const roleCodesByUserIndex = new Map();
  indexes(12).forEach((index) => roleCodesByUserIndex.set(index, 'doctor'));
  indexes(6).forEach((index) => roleCodesByUserIndex.set(12 + index, 'nurse'));
  indexes(3).forEach((index) => roleCodesByUserIndex.set(18 + index, 'lab_technician'));
  indexes(3).forEach((index) => roleCodesByUserIndex.set(21 + index, 'imaging_technician'));
  indexes(2).forEach((index) => roleCodesByUserIndex.set(24 + index, 'pharmacist'));
  indexes(2).forEach((index) => roleCodesByUserIndex.set(26 + index, 'cashier'));
  roleCodesByUserIndex.set(28, 'admin');
  roleCodesByUserIndex.set(29, 'receptionist');

  const roleCodes = [...new Set(roleCodesByUserIndex.values())];
  const roles = await models.Role.find({ role_code: { $in: roleCodes }, status: 'active', is_deleted: false }).lean();
  const roleByCode = new Map(roles.map((role) => [role.role_code, role]));
  const operations = [];

  for (const [userIndex, roleCode] of roleCodesByUserIndex.entries()) {
    const role = roleByCode.get(roleCode);
    if (!role) continue;
    operations.push({
      updateOne: {
        filter: { user_id: userId(userIndex), role_id: role._id },
        update: {
          $set: { is_active: true, updated_at: new Date() },
          $setOnInsert: { user_id: userId(userIndex), role_id: role._id, created_at: new Date() },
        },
        upsert: true,
      },
    });
  }

  if (!operations.length) return { requested: 0, seeded: 0, upserted: 0, modified: 0 };
  const result = await models.UserRole.bulkWrite(operations, { ordered: false, timestamps: false });
  const seeded = await models.UserRole.countDocuments({
    user_id: { $in: [...roleCodesByUserIndex.keys()].map((index) => userId(index)) },
    role_id: { $in: roles.map((role) => role._id) },
    is_active: true,
  });

  return {
    requested: operations.length,
    seeded,
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
  };
}

async function ensureInvoiceConsistency() {
  const invoices = await models.Invoice.find({ status: { $ne: 'voided' } });
  const validStatuses = new Set(['draft', 'issued', 'partially_paid', 'paid', 'voided', 'cancelled', 'refunded']);
  let modified = 0;
  for (const invoice of invoices) {
    const paidAmount = Number(invoice.paid_amount || 0);
    const balanceDue = Math.max(0, Number(invoice.total_amount || 0) - paidAmount);
    const currentStatus = validStatuses.has(invoice.status) ? invoice.status : 'issued';
    const nextStatus = currentStatus === 'draft'
      ? currentStatus
      : balanceDue === 0
        ? 'paid'
        : paidAmount > 0
          ? 'partially_paid'
          : currentStatus;
    if (Number(invoice.balance_due || 0) !== balanceDue || invoice.status !== nextStatus) {
      invoice.balance_due = balanceDue;
      invoice.status = nextStatus;
      await invoice.save();
      modified += 1;
    }
  }
  return { requested: invoices.length, seeded: invoices.length, upserted: 0, modified };
}

async function ensureCompletedAppointmentsHaveEncounters() {
  const completedAppointments = await models.Appointment.find({ status: 'completed', is_deleted: false }).lean();
  const operations = [];
  for (const appointment of completedAppointments) {
    const existing = await models.Encounter.findOne({
      appointment_id: appointment._id,
      status: { $ne: 'cancelled' },
    }).select('_id').lean();
    if (existing) continue;
    const appointmentIdText = String(appointment._id);
    const startTime = appointment.appointment_time || appointment.checked_in_at || appointment.created_at || new Date();
    const endTime = appointment.completed_at || addMinutes(new Date(startTime), 45);
    operations.push({
      updateOne: {
        filter: { appointment_id: appointment._id, status: { $ne: 'cancelled' } },
        update: {
          $setOnInsert: {
            _id: stableObjectId(`CompletedAppointmentEncounter:${appointmentIdText}`),
            patient_id: appointment.patient_id,
            appointment_id: appointment._id,
            department_id: appointment.department_id,
            attending_doctor_id: appointment.doctor_id,
            encounter_code: `LK-AUTO-${appointmentIdText.slice(-8).toUpperCase()}`,
            encounter_type: appointment.appointment_type === 'emergency' ? 'emergency' : 'outpatient',
            start_time: startTime,
            end_time: endTime,
            chief_reason: appointment.reason || 'Hoàn tất lịch hẹn khám',
            started_at: startTime,
            started_by: appointment.doctor_id,
            completed_by: appointment.doctor_id,
            nursing_status: 'completed',
            ready_for_doctor_at: appointment.checked_in_at || startTime,
            status: 'completed',
            created_at: new Date(),
            updated_at: new Date(),
            created_by: appointment.doctor_id,
            updated_by: appointment.doctor_id,
          },
        },
        upsert: true,
      },
    });
  }

  if (!operations.length) return { requested: completedAppointments.length, seeded: 0, upserted: 0, modified: 0 };
  const result = await models.Encounter.bulkWrite(operations, { ordered: false, timestamps: false });
  return {
    requested: completedAppointments.length,
    seeded: operations.length,
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
  };
}

async function bulkUpdateSeeded(modelName, count, buildUpdate, offset = 0) {
  const Model = models[modelName];
  const operations = indexes(count).map((index) => ({
    updateOne: {
      filter: { _id: idFor(modelName, index + offset) },
      update: buildUpdate(index, index + offset),
    },
  }));
  if (!operations.length) return { requested: 0, matched: 0, modified: 0 };
  const result = await Model.bulkWrite(operations, { ordered: false, timestamps: false });
  return {
    requested: operations.length,
    matched: result.matchedCount || 0,
    modified: result.modifiedCount || 0,
  };
}

async function ensureNurseWorkspaceApiCoverage() {
  const now = new Date();
  const todayStart = todayAt(0, 0);
  const morningStart = todayAt(7, 0);
  const maiHuong = await models.User.findOne({ username: 'dd.maihuong' }).select('_id department_id').lean();
  if (!maiHuong) throw new Error('Khong tim thay tai khoan dieu duong dd.maihuong de seed Nurse Workspace.');
  const nurseId = maiHuong._id;
  const departmentId = maiHuong.department_id || idFor('Department', 0);
  const nextNurseId = userId(13);
  const doctorId = userId(5);
  const otherDoctorId = userId(0);

  await bulkUpdateSeeded('Appointment', 48, (index) => ({
    $set: {
      department_id: departmentId,
      doctor_id: index % 2 === 0 ? doctorId : otherDoctorId,
      appointment_date: todayStart,
      appointment_time: addMinutes(morningStart, index * 8),
      checked_in_at: addMinutes(morningStart, index * 8 + 3),
      status: pick(['checked_in', 'waiting', 'in_progress', 'completed', 'no_show', 'cancelled'], index),
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('QueueTicket', 48, (index) => ({
    $set: {
      department_id: departmentId,
      doctor_id: index % 2 === 0 ? doctorId : otherDoctorId,
      assigned_nurse_id: index % 5 === 0 ? null : nurseId,
      queue_date: todayStart,
      checkin_time: addMinutes(morningStart, index * 5),
      status: pick(['waiting', 'called', 'recalled', 'in_service', 'skipped', 'completed', 'no_show', 'waiting'], index),
      priority: pick(['low', 'medium', 'high', 'urgent'], index),
      nursing_stage: pick([
        'waiting_nurse',
        'waiting_nurse',
        'triage_pending',
        'triage_in_progress',
        'vital_pending',
        'nurse_in_progress',
        'ready_for_doctor',
        'waiting_nurse',
      ], index),
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('Encounter', 72, (index) => ({
    $set: {
      department_id: departmentId,
      attending_doctor_id: index % 2 === 0 ? doctorId : otherDoctorId,
      assigned_nurse_id: nurseId,
      start_time: addMinutes(morningStart, index * 6),
      started_at: addMinutes(morningStart, index * 6),
      ready_for_doctor_at: addMinutes(morningStart, index * 6 + 20),
      status: pick(['arrived', 'in_progress', 'on_hold', 'completed', 'arrived', 'in_progress'], index),
      nursing_status: pick(['waiting_nurse', 'triage_pending', 'vital_pending', 'ready_for_doctor', 'completed'], index),
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('VitalSign', 36, (index) => {
    const vital = [
      { systolic: 188, diastolic: 112, heart: 104, temperature: 37.8, spo2: 96, rr: 22, flag: 'hypertension' },
      { systolic: 92, diastolic: 58, heart: 112, temperature: 37.1, spo2: 95, rr: 21, flag: 'hypotension' },
      { systolic: 128, diastolic: 78, heart: 118, temperature: 39.2, spo2: 94, rr: 24, flag: 'fever' },
      { systolic: 134, diastolic: 84, heart: 126, temperature: 37.5, spo2: 89, rr: 30, flag: 'low_spo2' },
      { systolic: 146, diastolic: 90, heart: 138, temperature: 38.4, spo2: 92, rr: 33, flag: 'tachycardia' },
      { systolic: 118, diastolic: 76, heart: 86, temperature: 36.8, spo2: 98, rr: 18, flag: 'normal' },
    ][index % 6];
    const isAbnormal = vital.flag !== 'normal';
    return {
      $set: {
        patient_id: idFor('Patient', index),
        encounter_id: idFor('Encounter', index),
        recorded_by: nurseId,
        recorded_at: addMinutes(morningStart, index * 7),
        temperature: vital.temperature,
        heart_rate: vital.heart,
        respiratory_rate: vital.rr,
        blood_pressure_systolic: vital.systolic,
        blood_pressure_diastolic: vital.diastolic,
        oxygen_saturation: vital.spo2,
        blood_glucose: index % 5 === 0 ? 14.2 : 6.4,
        pain_score: index % 5,
        abnormal_flags: isAbnormal ? [vital.flag] : [],
        overall_severity: isAbnormal ? pick(['high', 'critical', 'medium'], index) : 'normal',
        requires_recheck: isAbnormal,
        requires_doctor_notification: index % 3 === 0,
        status: 'recorded',
        notes: isAbnormal ? 'Can theo doi lai sinh hieu va bao bac si neu khong cai thien.' : 'Sinh hieu on dinh.',
        updated_at: now,
      },
    };
  });

  await bulkUpdateSeeded('VitalSignCorrectionRequest', 10, (index) => ({
    $set: {
      vital_sign_id: idFor('VitalSign', index),
      patient_id: idFor('Patient', index),
      encounter_id: idFor('Encounter', index),
      department_id: departmentId,
      requested_by: nurseId,
      requested_at: addMinutes(morningStart, index * 9),
      reason: pick([
        'Can xac nhan lai huyet ap do benh nhan vua van dong.',
        'May do SpO2 bao tin hieu yeu, can nhap lai gia tri sau khi do lai.',
        'Nham thoi diem ghi nhan ca truc, can dieu chinh gio do.',
        'Can sua mach do nhap thieu mot chu so.',
        'Kiem tra lai nhiet do do benh nhan moi uong nuoc am.',
      ], index),
      reason_category: pick(['wrong_value', 'wrong_time', 'device_error', 'other'], index),
      status: index < 8 ? 'pending' : 'approved',
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('ServicePreparation', 72, (index) => ({
    $set: {
      patient_id: idFor('Patient', index),
      encounter_id: idFor('Encounter', index),
      department_id: departmentId,
      destination_department_id: departmentId,
      assigned_nurse_id: index % 6 === 0 ? null : nurseId,
      requested_by_user_id: index % 2 === 0 ? doctorId : otherDoctorId,
      source_type: pick(['pre_exam', 'lab', 'imaging', 'procedure', 'pre_exam', 'lab'], index),
      status: pick(['pending', 'assigned', 'in_progress', 'ready', 'blocked', 'transferred'], index),
      priority: pick(['routine', 'high', 'urgent', 'stat'], index),
      created_at: addMinutes(morningStart, index * 4),
      updated_at: now,
      scheduled_at: addMinutes(morningStart, index * 6 + 20),
      sla_due_at: index % 4 === 0 ? addMinutes(now, -30) : addMinutes(now, 60 + index),
      checklist_total: 4,
      checklist_done: index % 4,
      checklist_required_total: 3,
      checklist_required_done: index % 3,
      notes: 'Chuan bi day du giay to, vong dinh danh va huong dan benh nhan truoc khi thuc hien dich vu.',
    },
  }));

  await bulkUpdateSeeded('NursingTask', 96, (index) => {
    const status = index < 24
      ? pick(['assigned', 'accepted', 'in_progress', 'waiting_doctor'], index)
      : index < 48
        ? pick(['assigned', 'accepted', 'in_progress'], index)
        : index < 72
          ? 'done'
          : pick(['todo', 'blocked', 'waiting_doctor', 'cancelled', 'skipped', 'no_show'], index);
    const completed = status === 'done';
    return {
      $set: {
        patient_id: idFor('Patient', index % NURSE_WORKSPACE_COUNT),
        encounter_id: idFor('Encounter', index % NURSE_WORKSPACE_COUNT),
        department_id: departmentId,
        assigned_to: index < 40 || completed ? nurseId : (index % 5 === 0 ? null : nextNurseId),
        assigned_by: doctorId,
        status,
        priority: pick(['critical', 'urgent', 'high', 'medium', 'low'], index),
        task_type: pick([
          'vital_sign',
          'triage',
          'pre_exam',
          'pre_lab',
          'pre_imaging',
          'pre_procedure',
          'post_procedure_monitor',
          'post_medication_monitor',
          'doctor_report',
          'handoff_followup',
        ], index),
        due_at: index >= 24 && index < 48 ? addMinutes(now, -120 - index) : addMinutes(morningStart, 40 + index * 5),
        started_at: ['in_progress', 'waiting_doctor', 'done'].includes(status) ? addMinutes(morningStart, index * 5 + 10) : undefined,
        completed_at: completed ? addMinutes(morningStart, index + 10) : undefined,
        completed_by: completed ? nurseId : undefined,
        title: pick([
          'Do lai sinh hieu truoc khi bac si kham',
          'Ho tro benh nhan chuan bi xet nghiem mau',
          'Theo doi sau dung thuoc ha ap',
          'Bao bac si ve ket qua SpO2 thap',
          'Chuan bi ho so truoc thu thuat',
        ], index),
        updated_at: now,
      },
    };
  });

  await bulkUpdateSeeded('NursingMonitoringSession', 36, (index) => ({
    $set: {
      patient_id: idFor('Patient', index),
      encounter_id: idFor('Encounter', index),
      admission_id: idFor('Admission', index),
      department_id: departmentId,
      assigned_nurse_id: nurseId,
      attending_doctor_id: index % 2 === 0 ? doctorId : otherDoctorId,
      source_type: pick(['manual', 'abnormal_vital', 'post_procedure', 'post_medication', 'doctor_request', 'lab_critical'], index),
      reason: pick([
        'Theo doi huyet ap sau khi dung thuoc.',
        'Theo doi sot va mach nhanh.',
        'Theo doi dau nguc nhe sau thu thuat.',
        'Theo doi phan ung sau truyen dich.',
        'Bac si yeu cau theo doi SpO2 lien tuc.',
      ], index),
      priority: pick(['critical', 'high', 'medium', 'low'], index),
      status: pick(['active', 'watching', 'doctor_notified', 'doctor_acknowledged', 'escalated', 'stable'], index),
      started_at: addMinutes(morningStart, index * 6),
      last_checked_at: addMinutes(morningStart, index * 6 + 20),
      next_check_at: addMinutes(now, 15 + index * 3),
      sla_due_at: index % 5 === 0 ? addMinutes(now, -20) : addMinutes(now, 45 + index),
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('ProcedureOrder', 24, (index) => ({
    $set: {
      patient_id: idFor('Patient', index),
      encounter_id: idFor('Encounter', index),
      department_id: departmentId,
      ordered_by: index % 2 === 0 ? doctorId : otherDoctorId,
      status: 'completed',
      priority: pick(['routine', 'urgent', 'stat'], index),
      scheduled_at: addMinutes(morningStart, index * 10),
      started_at: addMinutes(morningStart, index * 10 + 15),
      completed_at: addMinutes(morningStart, index * 10 + 40),
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('PostProcedureObservation', 24, (index) => ({
    $set: {
      patient_id: idFor('Patient', index),
      encounter_id: idFor('Encounter', index),
      procedure_order_id: idFor('ProcedureOrder', index),
      observed_by: nurseId,
      observed_at: addMinutes(morningStart, index * 10 + 50),
      status: pick(['watching', 'stable', 'needs_attention', 'reported'], index),
      severity: pick(['normal', 'medium', 'high', 'critical'], index),
      note: pick([
        'Vet thu thuat kho, khong chay mau.',
        'Benh nhan con dau nhe, tiep tuc theo doi moi 30 phut.',
        'Mach nhanh sau thu thuat, da bao bac si truc.',
        'Tinh trang on, huong dan nghi ngoi tai giuong.',
      ], index),
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('MedicationAdministration', 36, (index) => ({
    $set: {
      patient_id: idFor('Patient', index),
      encounter_id: idFor('Encounter', index),
      admission_id: idFor('Admission', index),
      administered_by: nurseId,
      status: pick(['given', 'held', 'refused', 'omitted', 'given', 'given'], index),
      scheduled_at: addMinutes(morningStart, index * 8),
      administered_at: index % 4 === 0 ? undefined : addMinutes(morningStart, index * 8 + 5),
      hold_reason: index % 6 === 1 ? 'Benh nhan dang cho danh gia lai huyet ap.' : undefined,
      refused_reason: index % 6 === 2 ? 'Benh nhan buon non, tam thoi tu choi uong thuoc.' : undefined,
      omission_reason: index % 6 === 3 ? 'Chua co thuoc tai tu truc, da bao duoc.' : undefined,
      notes: 'Ghi nhan dung thuoc theo y lenh, theo doi phan ung sau dung.',
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('MedicationReactionObservation', 24, (index) => ({
    $set: {
      patient_id: idFor('Patient', index),
      encounter_id: idFor('Encounter', index),
      medication_administration_id: idFor('MedicationAdministration', index),
      observed_by: nurseId,
      observed_at: addMinutes(morningStart, index * 8 + 25),
      reaction_type: pick(['nausea', 'rash', 'dizziness', 'hypotension'], index),
      severity: pick(['mild', 'moderate', 'severe'], index),
      status: pick(['watching', 'reported', 'resolved', 'needs_attention'], index),
      note: 'Benh nhan duoc theo doi phan ung sau dung thuoc, da ghi nhan va xu tri theo chi dinh.',
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('ClinicalAlert', 36, (index) => ({
    $set: {
      patient_id: idFor('Patient', index),
      encounter_id: idFor('Encounter', index),
      admission_id: idFor('Admission', index),
      department_id: departmentId,
      assigned_to_user_id: nurseId,
      source_type: pick(['vital_sign', 'procedure_observation', 'medication_reaction', 'manual'], index),
      source_id: idFor('VitalSign', index),
      title: pick([
        'Huyet ap tang cao can theo doi',
        'SpO2 thap sau van dong',
        'Sot va mach nhanh',
        'Dau nguc nhe sau thu thuat',
        'Nghi phan ung sau dung thuoc',
      ], index),
      message: 'Can dieu duong theo doi sat va bao bac si neu chi so khong cai thien.',
      severity: pick(['critical', 'high', 'warning', 'info'], index),
      status: pick(['open', 'acknowledged', 'doctor_notified', 'escalated', 'resolved', 'dismissed'], index),
      acknowledged_by: index % 6 >= 1 ? nurseId : undefined,
      acknowledged_at: index % 6 >= 1 ? addMinutes(morningStart, index * 5 + 10) : undefined,
      doctor_notified_at: index % 6 >= 2 ? addMinutes(morningStart, index * 5 + 15) : undefined,
      escalated_at: index % 6 === 3 ? addMinutes(morningStart, index * 5 + 20) : undefined,
      resolved_by: index % 6 === 4 ? nurseId : undefined,
      resolved_at: index % 6 === 4 ? addMinutes(morningStart, index * 5 + 35) : undefined,
      dismissed_by: index % 6 === 5 ? nurseId : undefined,
      dismissed_at: index % 6 === 5 ? addMinutes(morningStart, index * 5 + 35) : undefined,
      sla_due_at: index % 4 === 0 ? addMinutes(now, -15) : addMinutes(now, 30 + index),
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('DoctorNotificationRequest', 42, (index) => {
    const status = pick(['draft', 'sent', 'delivered', 'seen', 'responded', 'escalated', 'acknowledged'], index);
    return {
      $set: {
        patient_id: idFor('Patient', index),
        encounter_id: idFor('Encounter', index),
        admission_id: idFor('Admission', index),
        from_nurse_id: nurseId,
        to_doctor_id: index % 2 === 0 ? doctorId : otherDoctorId,
        department_id: departmentId,
        priority: pick(['routine', 'urgent', 'stat', 'critical'], index),
        category: pick(['abnormal_vital', 'post_procedure', 'post_medication', 'patient_complaint', 'manual'], index),
        status,
        sent_at: status !== 'draft' ? addMinutes(morningStart, index * 5) : undefined,
        delivered_at: ['delivered', 'seen', 'responded', 'escalated', 'acknowledged'].includes(status) ? addMinutes(morningStart, index * 5 + 5) : undefined,
        seen_at: ['seen', 'responded', 'escalated', 'acknowledged'].includes(status) ? addMinutes(morningStart, index * 5 + 10) : undefined,
        acknowledged_at: status === 'acknowledged' ? addMinutes(morningStart, index * 5 + 15) : undefined,
        responded_at: status === 'responded' ? addMinutes(morningStart, index * 5 + 20) : undefined,
        escalated_at: status === 'escalated' ? addMinutes(morningStart, index * 5 + 18) : undefined,
        doctor_response: status === 'responded' ? 'Da xem thong tin, tiep tuc theo doi va bao lai sau 30 phut.' : undefined,
        sla_due_at: index % 5 === 0 ? addMinutes(now, -10) : addMinutes(now, 40 + index),
        sbar: {
          situation: 'Benh nhan co dau hieu can bac si danh gia.',
          background: 'Dang duoc dieu duong theo doi trong ca truc.',
          assessment: 'Chi so sinh hieu thay doi so voi lan truoc.',
          recommendation: 'De nghi bac si phan hoi huong xu tri.',
        },
        updated_at: now,
      },
    };
  });

  await bulkUpdateSeeded('NursingHandoff', 30, (index) => ({
    $set: {
      department_id: departmentId,
      from_nurse_id: nurseId,
      to_nurse_id: nextNurseId,
      shift_date: todayStart,
      from_shift: pick(['morning', 'afternoon', 'night'], index),
      to_shift: pick(['afternoon', 'night', 'morning'], index),
      status: pick(['submitted', 'accepted', 'rejected', 'reopened', 'archived'], index),
      submitted_at: addMinutes(morningStart, index * 6),
      accepted_at: index % 5 === 1 ? addMinutes(morningStart, index * 6 + 20) : undefined,
      rejected_at: index % 5 === 2 ? addMinutes(morningStart, index * 6 + 20) : undefined,
      patient_count: 5 + (index % 4),
      task_count: 6 + (index % 5),
      critical_count: index % 3,
      summary: 'Ban giao benh nhan can theo doi sinh hieu, thuoc va cac viec con mo trong ca.',
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('Admission', 36, (index) => ({
    $set: {
      patient_id: idFor('Patient', index),
      encounter_id: idFor('Encounter', index),
      department_id: departmentId,
      attending_doctor_id: index % 2 === 0 ? doctorId : otherDoctorId,
      admitted_at: addMinutes(todayAt(8, 0, index % 5 === 0 ? -1 : 0), index * 3),
      admitted_by: nurseId,
      discharged_at: undefined,
      status: 'admitted',
      admission_type: pick(['emergency', 'elective', 'transfer'], index),
      priority: pick(['routine', 'high', 'urgent', 'critical'], index),
      fall_risk_level: pick(['low', 'medium', 'high'], index),
      infection_risk_level: pick(['low', 'medium', 'high'], index + 1),
      pressure_ulcer_risk_level: pick(['low', 'medium', 'high'], index + 2),
      nursing_acuity_score: 3 + (index % 8),
      nursing_note_summary: 'Dang nam dieu tri noi tru, can theo doi sinh hieu va thuc hien y lenh trong ca.',
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('BedAssignment', 36, (index) => ({
    $set: {
      patient_id: idFor('Patient', index),
      admission_id: idFor('Admission', index),
      department_id: departmentId,
      status: 'active',
      assigned_at: addMinutes(todayAt(8, 30, index % 5 === 0 ? -1 : 0), index * 4),
      assigned_by: nurseId,
      ended_at: undefined,
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('Bed', 36, (index) => ({
    $set: {
      department_id: departmentId,
      status: index % 3 === 0 ? 'reserved' : 'occupied',
      current_patient_id: idFor('Patient', index),
      updated_at: now,
    },
  }));

  await bulkUpdateSeeded('InpatientTask', 36, (index) => {
    const status = pick(['todo', 'in_progress', 'done', 'todo', 'in_progress', 'done'], index);
    return {
      $set: {
        admission_id: idFor('Admission', index),
        patient_id: idFor('Patient', index),
        assigned_to: nurseId,
        assigned_by: doctorId,
        status,
        priority: pick(['urgent', 'high', 'normal', 'low'], index),
        due_at: index % 4 === 0 ? addMinutes(now, -90 - index) : addMinutes(now, 40 + index * 4),
        completed_at: status === 'done' ? addMinutes(morningStart, index * 4 + 20) : undefined,
        completed_by: status === 'done' ? nurseId : undefined,
        source_module: 'vn_demo_nurse_workspace',
        title: pick([
          'Cham soc vet thuong va thay bang',
          'Theo doi duong huyet truoc an',
          'Ho tro benh nhan van dong tai giuong',
          'Kiem tra duong truyen tinh mach',
          'Ghi nhan luong nuoc vao ra',
        ], index),
        updated_at: now,
      },
    };
  });

  await bulkUpdateSeeded('InpatientHandover', 18, (index) => ({
    $set: {
      department_id: departmentId,
      shift_date: todayStart,
      from_shift: pick(['morning', 'afternoon', 'night'], index),
      to_shift: pick(['afternoon', 'night', 'morning'], index),
      outgoing_nurse_id: nurseId,
      incoming_nurse_id: nextNurseId,
      status: pick(['draft', 'prepared', 'signed', 'acknowledged', 'closed', 'reopened'], index),
      patient_count: 6 + (index % 5),
      high_risk_count: 2 + (index % 3),
      abnormal_vital_count: 1 + (index % 4),
      overdue_task_count: 1 + (index % 3),
      medication_due_count: 3 + (index % 5),
      signed_at: index % 6 >= 2 ? addMinutes(morningStart, index * 8) : undefined,
      signed_by: index % 6 >= 2 ? nurseId : undefined,
      acknowledged_at: index % 6 === 3 ? addMinutes(morningStart, index * 8 + 20) : undefined,
      acknowledged_by: index % 6 === 3 ? nextNurseId : undefined,
      summary: 'Ban giao noi tru gom benh nhan nguy co cao, thuoc den gio va viec cham soc can tiep tuc.',
      updated_at: now,
    },
  }));

  const collectionChecks = [
    ['QueueTicket', { department_id: departmentId, queue_date: { $gte: todayStart, $lt: addDays(todayStart, 1) } }],
    ['VitalSign', { recorded_by: nurseId, recorded_at: { $gte: todayStart, $lt: addDays(todayStart, 1) } }],
    ['VitalSignCorrectionRequest', { department_id: departmentId, status: 'pending' }],
    ['ServicePreparation', { department_id: departmentId, created_at: { $gte: todayStart, $lt: addDays(todayStart, 1) } }],
    ['NursingTask', { department_id: departmentId }],
    ['NursingMonitoringSession', { department_id: departmentId, started_at: { $gte: todayStart, $lt: addDays(todayStart, 1) } }],
    ['ProcedureOrder', { department_id: departmentId, status: 'completed', completed_at: { $gte: todayStart, $lt: addDays(todayStart, 1) } }],
    ['MedicationAdministration', { scheduled_at: { $gte: todayStart, $lt: addDays(todayStart, 1) } }],
    ['ClinicalAlert', { department_id: departmentId, created_at: { $gte: todayStart, $lt: addDays(todayStart, 1) } }],
    ['DoctorNotificationRequest', { department_id: departmentId, created_at: { $gte: todayStart, $lt: addDays(todayStart, 1) } }],
    ['NursingHandoff', { department_id: departmentId, shift_date: { $gte: todayStart, $lt: addDays(todayStart, 1) } }],
    ['Admission', { department_id: departmentId, status: 'admitted' }],
    ['InpatientTask', { assigned_to: nurseId }],
    ['InpatientHandover', { department_id: departmentId, shift_date: { $gte: todayStart, $lt: addDays(todayStart, 1) } }],
  ];

  const rows = [];
  for (const [modelName, filter] of collectionChecks) {
    rows.push({
      model: `${modelName}(nurse coverage)`,
      collection: models[modelName].collection.name,
      requested: 5,
      seeded: await models[modelName].countDocuments(filter),
      upserted: 0,
      modified: 0,
    });
  }
  return rows;
}

const DASHBOARD_DATES = [
  '2026-05-12',
  '2026-05-13',
  '2026-05-14',
  '2026-05-15',
  '2026-05-16',
  '2026-05-18',
  '2026-05-19',
  '2026-05-20',
  '2026-05-21',
  '2026-05-22',
  '2026-05-23',
  '2026-05-24',
  '2026-05-25',
  '2026-05-26',
  '2026-05-27',
  '2026-05-28',
  '2026-05-29',
];
const REQUIRED_DASHBOARD_DATES = ['2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22'];
const DASHBOARD_APPOINTMENTS_PER_DAY = 35;
const DASHBOARD_OPERATIONAL_RECORDS_PER_DAY = 30;
const DASHBOARD_STATUS_QUERY = 'draft,confirmed,in_progress,result_ready';

function dashId(modelName, key) {
  return stableObjectId(`doctor-dashboard:${modelName}:${key}`);
}

function dashDate(dateKey, hour = 0, minute = 0) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function dashDoctorId() {
  return dashId('User', 'bs.minhanh');
}

function dashDepartmentId() {
  return departmentId(2);
}

function dashNurseId() {
  return userId(12);
}

function dashPatientId(index) {
  return dashId('Patient', index);
}

function dashDoc(modelName, key, data, createdAt = new Date()) {
  const doc = {
    _id: dashId(modelName, key),
    ...data,
    created_at: data.created_at || createdAt,
    updated_at: data.updated_at || createdAt,
  };
  if (models[modelName]?.schema?.path('created_by') && !doc.created_by) doc.created_by = dashDoctorId();
  if (models[modelName]?.schema?.path('updated_by') && !doc.updated_by) doc.updated_by = dashDoctorId();
  if (models[modelName]?.schema?.path('is_deleted')) doc.is_deleted = false;
  return doc;
}

function buildDoctorDashboardCoverageDocs(passwordHash) {
  const doctorIdValue = dashDoctorId();
  const departmentIdValue = dashDepartmentId();
  const nurseId = dashNurseId();
  const names = [
    ['Trần Gia Bảo', 'male', '1981-02-14', '34 Hải Phòng, phường Thạch Thang, quận Hải Châu, Đà Nẵng'],
    ['Lê Thảo Nhi', 'female', '1994-09-03', '82 Nguyễn Văn Linh, phường Vĩnh Trung, quận Thanh Khê, Đà Nẵng'],
    ['Phạm Minh Khôi', 'male', '1972-11-18', '15 Kim Mã, phường Ngọc Khánh, quận Ba Đình, Hà Nội'],
    ['Hoàng Ngọc Diệp', 'female', '1988-06-25', '19 Trần Duy Hưng, phường Trung Hòa, quận Cầu Giấy, Hà Nội'],
    ['Võ Anh Tú', 'male', '1965-01-07', '47 Lê Duẩn, phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'],
    ['Đặng Khánh Linh', 'female', '2003-03-29', '106 Cách Mạng Tháng Tám, phường 13, Quận 10, TP. Hồ Chí Minh'],
    ['Bùi Nhật Minh', 'male', '2014-12-12', '28 Phan Chu Trinh, phường Tân Lợi, TP. Buôn Ma Thuột, Đắk Lắk'],
    ['Đỗ Mai Chi', 'female', '1959-08-21', '62 Lê Thánh Tông, phường Ia Kring, TP. Pleiku, Gia Lai'],
    ['Hồ Quang Vinh', 'male', '1977-04-10', '11 Nguyễn Huệ, phường Vĩnh Ninh, TP. Huế'],
    ['Cao Thanh Hằng', 'female', '1999-10-05', '77 Tây Sơn, phường Ghềnh Ráng, TP. Quy Nhơn, Bình Định'],
  ];
  const symptoms = [
    'Sốt nhẹ, đau họng và mệt mỏi.',
    'Ho kéo dài, khó thở nhẹ khi gắng sức.',
    'Theo dõi tăng huyết áp, chóng mặt thoáng qua.',
    'Đau bụng âm ỉ vùng thượng vị.',
    'Tái khám sau điều trị viêm họng.',
    'Đau đầu, mất ngủ.',
    'Theo dõi đường huyết sau ăn.',
    'Đau ngực nhẹ khi gắng sức.',
    'Rối loạn tiêu hóa, buồn nôn.',
    'Đau lưng vùng thắt lưng.',
  ];
  const docs = new Map([
    ['User', [dashDoc('User', 'bs.minhanh', {
      department_id: departmentIdValue,
      username: 'bs.minhanh',
      password_hash: passwordHash,
      full_name: 'Nguyễn Minh Anh',
      phone: '0905123786',
      employee_code: 'BS-DEMO-MINHANH',
      email: 'bs.minhanh@benhvienminhchau.vn',
      date_of_birth: dashDate('1984-04-12'),
      gender: 'female',
      address: '126 Nguyễn Văn Linh, phường Vĩnh Trung, quận Thanh Khê, Đà Nẵng',
      status: 'active',
      last_login_at: dashDate('2026-05-19', 7, 18),
      must_change_password: false,
      permission_version: 1,
      password_changed_at: dashDate('2026-05-01', 9, 0),
      failed_login_attempts: 0,
      auth_provider: 'local',
      avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=256&h=256&fit=crop&crop=faces',
      email_verified: true,
      email_verified_at: dashDate('2026-05-01', 9, 5),
      phone_verified_at: dashDate('2026-05-01', 9, 6),
    })]],
    ['DoctorProfile', [dashDoc('DoctorProfile', 'bs.minhanh', {
      user_id: doctorIdValue,
      department_id: departmentIdValue,
      license_number: 'CCHN-DN-2026-1582',
      specialty: 'Nội tổng quát',
      subspecialty: 'Theo dõi bệnh mạn tính và hô hấp',
      qualification: 'Bác sĩ Chuyên khoa I Nội tổng quát',
      academic_title: 'BS.CKI',
      years_of_experience: 12,
      consultation_duration_minutes: 20,
      consultation_fee: 220000,
      avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=256&h=256&fit=crop&crop=faces',
      biography: 'Phụ trách phòng khám nội tổng quát, theo dõi tăng huyết áp, đái tháo đường và bệnh hô hấp thường gặp.',
      languages: ['vi', 'en'],
      public_profile_enabled: true,
      status: 'active',
    })]],
    ['Patient', []],
    ['DoctorSchedule', []],
    ['Appointment', []],
    ['QueueTicket', []],
    ['Encounter', []],
    ['Order', []],
    ['Prescription', []],
    ['PrescriptionItem', []],
    ['VitalSign', []],
    ['ClinicalAlert', []],
    ['Notification', []],
  ]);

  indexes(DASHBOARD_DATES.length * DASHBOARD_APPOINTMENTS_PER_DAY).forEach((index) => {
    const [fullName, gender, dob, address] = names[index % names.length];
    docs.get('Patient').push(dashDoc('Patient', index, {
      patient_code: `BN-DASH-${String(index + 1).padStart(4, '0')}`,
      full_name: `${fullName} ${index >= names.length ? Math.floor(index / names.length) + 1 : ''}`.trim(),
      date_of_birth: dashDate(dob),
      gender,
      phone: `09${String(35000000 + index * 137).slice(-8)}`,
      email: `benhnhan.dashboard.${index + 1}@example.vn`,
      address,
      national_id: `079${String(198000000 + index * 17).padStart(9, '0')}`,
      insurance_number: `DN${String(1026000000 + index * 19)}`,
      emergency_contact_name: names[(index + 3) % names.length][0],
      emergency_contact_phone: `08${String(66000000 + index * 131).slice(-8)}`,
      status: 'active',
    }, dashDate('2026-05-01', 8, index % 60)));
  });

  DASHBOARD_DATES.forEach((dateKey, dateIndex) => {
    const scheduleWindows = [[7, 0, 10, 30], [10, 30, 12, 30], [13, 0, 15, 30], [15, 30, 18, 0], [18, 0, 21, 0]];
    scheduleWindows.forEach(([sh, sm, eh, em], slotIndex) => {
      docs.get('DoctorSchedule').push(dashDoc('DoctorSchedule', `${dateIndex}:${slotIndex}`, {
        doctor_id: doctorIdValue,
        department_id: departmentIdValue,
        work_date: dashDate(dateKey),
        shift_start: dashDate(dateKey, sh, sm),
        shift_end: dashDate(dateKey, eh, em),
        slot_duration_minutes: 20,
        max_patients: 12,
        schedule_type: slotIndex === 4 ? 'emergency_oncall' : 'outpatient_regular',
        patient_portal_enabled: true,
        staff_only: false,
        internal_note: `Ca ${slotIndex + 1} phòng Nội ${203 + (slotIndex % 2)}`,
        break_windows: [],
        status: dateKey === '2026-05-19' && slotIndex <= 3 ? 'active' : 'published',
      }, dashDate(dateKey, 6, 0)));
    });

    const appointmentStatuses = ['booked', 'confirmed', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show'];
    const queueStatuses = ['waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'called', 'called', 'called', 'called', 'called', 'in_service', 'in_service', 'in_service', 'in_service', 'in_service', 'completed', 'completed', 'completed', 'completed', 'completed', 'skipped', 'skipped', 'skipped', 'skipped', 'skipped', 'no_show', 'no_show', 'no_show', 'no_show', 'no_show'];
    const encounterToday = ['arrived', 'arrived', 'arrived', 'arrived', 'arrived', 'in_progress', 'in_progress', 'in_progress', 'in_progress', 'in_progress', 'on_hold', 'on_hold', 'on_hold', 'on_hold', 'on_hold', 'completed', 'completed', 'completed', 'completed', 'completed', 'planned', 'planned', 'planned', 'cancelled', 'completed'];
    const encounterOther = ['arrived', 'arrived', 'in_progress', 'on_hold', 'completed', 'completed', 'completed', 'planned', 'planned', 'cancelled'];
    const orderTypes = ['lab', 'imaging', 'procedure', 'service', 'medication'];
    const orderStatuses = ['draft', 'ordered', 'acknowledged', 'in_progress', 'completed', 'cancelled'];

    indexes(DASHBOARD_APPOINTMENTS_PER_DAY).forEach((index) => {
      const patientIndex = dateIndex * DASHBOARD_APPOINTMENTS_PER_DAY + index;
      const appointmentTime = dashDate(dateKey, 7 + Math.floor(index / 4), (index % 4) * 15);
      const appointmentStatus = appointmentStatuses[index % appointmentStatuses.length];
      docs.get('Appointment').push(dashDoc('Appointment', `${dateIndex}:${index}`, {
        patient_id: dashPatientId(patientIndex),
        doctor_id: doctorIdValue,
        department_id: departmentIdValue,
        doctor_schedule_id: dashId('DoctorSchedule', `${dateIndex}:${Math.min(4, Math.floor(index / 7))}`),
        appointment_time: appointmentTime,
        appointment_type: index % 9 === 0 ? 'emergency' : 'outpatient',
        reason: symptoms[index % symptoms.length],
        source: index % 3 === 0 ? 'front_desk' : 'doctor_dashboard_seed',
        status: appointmentStatus,
        notes: `Ghi chú bác sĩ: ${symptoms[(index + 2) % symptoms.length]}`,
        confirmed_at: ['confirmed', 'checked_in', 'in_consultation', 'completed'].includes(appointmentStatus) ? new Date(appointmentTime.getTime() - 45 * 60000) : undefined,
        checked_in_at: ['checked_in', 'in_consultation', 'completed'].includes(appointmentStatus) ? new Date(appointmentTime.getTime() - 20 * 60000) : undefined,
        completed_at: appointmentStatus === 'completed' ? new Date(appointmentTime.getTime() + 35 * 60000) : undefined,
        no_show_at: appointmentStatus === 'no_show' ? new Date(appointmentTime.getTime() + 25 * 60000) : undefined,
        cancelled_at: appointmentStatus === 'cancelled' ? new Date(appointmentTime.getTime() - 4 * 3600000) : undefined,
        cancel_reason: appointmentStatus === 'cancelled' ? 'Bệnh nhân báo bận đột xuất, hẹn lại sau.' : undefined,
      }, dashDate(dateKey, 6, index)));

      if (index >= DASHBOARD_OPERATIONAL_RECORDS_PER_DAY) return;

      const queueStatus = queueStatuses[index];
      const checkin = dashDate(dateKey, 7 + Math.floor(index / 5), (index % 5) * 10 + 3);
      docs.get('QueueTicket').push(dashDoc('QueueTicket', `${dateIndex}:${index}`, {
        patient_id: dashPatientId(patientIndex),
        appointment_id: dashId('Appointment', `${dateIndex}:${index}`),
        encounter_id: dashId('Encounter', `${dateIndex}:${index}`),
        doctor_id: doctorIdValue,
        department_id: departmentIdValue,
        queue_date: dashDate(dateKey),
        queue_number: `MA${dateKey.slice(-2)}${String(index + 1).padStart(3, '0')}`,
        display_number: `Nội-${String(index + 1).padStart(2, '0')}`,
        queue_type: index % 10 === 0 ? 'vip' : index % 4 === 0 ? 'priority' : 'normal',
        status: queueStatus,
        checkin_time: checkin,
        called_time: ['called', 'in_service', 'completed'].includes(queueStatus) ? new Date(checkin.getTime() + 12 * 60000) : undefined,
        service_start_time: ['in_service', 'completed'].includes(queueStatus) ? new Date(checkin.getTime() + 22 * 60000) : undefined,
        completed_time: queueStatus === 'completed' ? new Date(checkin.getTime() + 55 * 60000) : undefined,
        no_show_at: queueStatus === 'no_show' ? new Date(checkin.getTime() + 35 * 60000) : undefined,
        skipped_at: queueStatus === 'skipped' ? new Date(checkin.getTime() + 20 * 60000) : undefined,
        priority_reason: index % 4 === 0 ? pick(['Đau ngực', 'Khó thở nhẹ', 'Huyết áp cao', 'Người cao tuổi cần ưu tiên'], index) : undefined,
        nursing_stage: ['waiting', 'called'].includes(queueStatus) ? 'vital_done' : 'ready_for_doctor',
        assigned_nurse_id: nurseId,
        assigned_nurse_at: new Date(checkin.getTime() + 5 * 60000),
        vital_required: true,
        vital_recorded_at: new Date(checkin.getTime() + 9 * 60000),
        ready_for_doctor_at: new Date(checkin.getTime() + 11 * 60000),
        ready_for_doctor_by: nurseId,
        doctor_room_id: 'PK-NOI-203',
        intake_checklist_completed: true,
      }, dashDate(dateKey, 6, index)));
    });

    indexes(DASHBOARD_APPOINTMENTS_PER_DAY).forEach((index) => {
      const patientIndex = dateIndex * DASHBOARD_APPOINTMENTS_PER_DAY + index;
      const status = dateKey === '2026-05-19' ? encounterToday[index % encounterToday.length] : encounterOther[index % encounterOther.length];
      const start = dashDate(dateKey, 7 + Math.floor(index / 4), (index % 4) * 15 + 5);
      docs.get('Encounter').push(dashDoc('Encounter', `${dateIndex}:${index}`, {
        patient_id: dashPatientId(patientIndex),
        appointment_id: dashId('Appointment', `${dateIndex}:${index}`),
        department_id: departmentIdValue,
        attending_doctor_id: doctorIdValue,
        encounter_code: `LK-MA-${dateKey.replace(/-/g, '')}-${String(index + 1).padStart(3, '0')}`,
        encounter_type: index % 9 === 0 ? 'emergency' : 'outpatient',
        start_time: start,
        end_time: ['completed', 'cancelled'].includes(status) ? new Date(start.getTime() + 45 * 60000) : undefined,
        chief_reason: symptoms[index % symptoms.length],
        started_at: ['in_progress', 'on_hold', 'completed'].includes(status) ? start : undefined,
        started_by: ['in_progress', 'on_hold', 'completed'].includes(status) ? doctorIdValue : undefined,
        completed_by: status === 'completed' ? doctorIdValue : undefined,
        nursing_status: 'ready_for_doctor',
        assigned_nurse_id: nurseId,
        ready_for_doctor_at: new Date(start.getTime() - 8 * 60000),
        status,
      }, dashDate(dateKey, 7, index)));
    });

    indexes(DASHBOARD_OPERATIONAL_RECORDS_PER_DAY).forEach((index) => {
      const encounterIndex = index % DASHBOARD_OPERATIONAL_RECORDS_PER_DAY;
      const patientIndex = dateIndex * DASHBOARD_APPOINTMENTS_PER_DAY + encounterIndex;
      const orderType = orderTypes[index % orderTypes.length];
      const orderedAt = dashDate(dateKey, 8 + Math.floor(index / 5), (index % 5) * 10);
      docs.get('Order').push(dashDoc('Order', `${dateIndex}:${index}`, {
        patient_id: dashPatientId(patientIndex),
        encounter_id: dashId('Encounter', `${dateIndex}:${encounterIndex}`),
        department_id: orderType === 'lab' ? departmentId(7) : orderType === 'imaging' ? departmentId(6) : departmentIdValue,
        ordered_by: doctorIdValue,
        service_id: idFor('ServiceCatalog', (index + dateIndex) % serviceSeeds.length),
        order_no: `ORD-MA-${dateKey.replace(/-/g, '')}-${String(index + 1).padStart(3, '0')}`,
        order_code: `ORD-MA-${dateKey.replace(/-/g, '')}-${String(index + 1).padStart(3, '0')}`,
        title: pick(['Công thức máu và CRP', 'X-quang ngực thẳng', 'Siêu âm bụng tổng quát', 'Điện tim tại phòng khám', 'Đơn thuốc điều trị triệu chứng'], index),
        order_type: orderType,
        priority: index % 11 === 0 ? 'stat' : index % 4 === 0 ? 'urgent' : 'routine',
        is_billable: true,
        clinical_indication: symptoms[(index + 1) % symptoms.length],
        requested_at: new Date(orderedAt.getTime() - 10 * 60000),
        ordered_at: orderedAt,
        status: dateKey === '2026-05-19' && index < 24 ? DASHBOARD_STATUS_QUERY : orderStatuses[index % orderStatuses.length],
        items_count: 1 + (index % 4),
      }, dashDate(dateKey, 8, index)));
    });

    indexes(15).forEach((index) => {
      const prescribedAt = dashDate(dateKey, 9 + Math.floor(index / 4), (index % 4) * 12);
      docs.get('Prescription').push(dashDoc('Prescription', `${dateIndex}:${index}`, {
        order_id: dashId('Order', `${dateIndex}:${index * 2}`),
        patient_id: dashPatientId(dateIndex * DASHBOARD_APPOINTMENTS_PER_DAY + index),
        encounter_id: dashId('Encounter', `${dateIndex}:${index}`),
        prescribed_by: doctorIdValue,
        prescription_no: `DT-MA-${dateKey.replace(/-/g, '')}-${String(index + 1).padStart(3, '0')}`,
        prescribed_at: prescribedAt,
        version: 1,
        is_current: true,
        status: index % 5 === 0 ? 'verified' : index % 7 === 0 ? 'draft' : 'active',
        note: 'Dặn bệnh nhân uống thuốc đúng giờ, tái khám nếu triệu chứng tăng.',
      }, dashDate(dateKey, 9, index)));
      docs.get('PrescriptionItem').push(dashDoc('PrescriptionItem', `${dateIndex}:${index}:0`, {
        prescription_id: dashId('Prescription', `${dateIndex}:${index}`),
        medication_id: idFor('MedicationMaster', index % 24),
        dose: pick(['1 viên', '2 viên', '1 gói', '5 ml'], index),
        frequency: pick(['mỗi sáng', 'ngày 2 lần', 'mỗi 6 giờ khi sốt', 'sau ăn tối'], index),
        route: 'oral',
        duration_days: 5 + (index % 5),
        quantity: 10 + (index % 4) * 5,
        unit: index % 4 === 2 ? 'gói' : 'viên',
        dispensed_quantity: 0,
        instructions: pick(['uống sau ăn', 'theo dõi huyết áp tại nhà', 'tránh rượu bia', 'uống nhiều nước'], index),
        status: 'active',
      }, dashDate(dateKey, 9, index + 5)));
    });

    indexes(DASHBOARD_OPERATIONAL_RECORDS_PER_DAY).forEach((index) => {
      const abnormal = index < 10 || index % 7 === 0;
      const recordedAt = dashDate(dateKey, 7 + Math.floor(index / 5), (index % 5) * 10 + 8);
      docs.get('VitalSign').push(dashDoc('VitalSign', `${dateIndex}:${index}`, {
        patient_id: dashPatientId(dateIndex * DASHBOARD_APPOINTMENTS_PER_DAY + index),
        encounter_id: dashId('Encounter', `${dateIndex}:${index}`),
        queue_ticket_id: dashId('QueueTicket', `${dateIndex}:${index}`),
        appointment_id: dashId('Appointment', `${dateIndex}:${index}`),
        context: 'encounter',
        recorded_by: nurseId,
        temperature: abnormal && index % 3 === 0 ? 38.7 : 36.6 + (index % 5) * 0.1,
        heart_rate: abnormal && index % 4 === 0 ? 112 : 72 + (index % 18),
        respiratory_rate: abnormal && index % 5 === 0 ? 25 : 16 + (index % 4),
        systolic_bp: abnormal && index % 2 === 0 ? 158 : 112 + (index % 16),
        diastolic_bp: abnormal && index % 2 === 0 ? 96 : 70 + (index % 10),
        spo2: abnormal && index % 6 === 0 ? 92 : 97 + (index % 3),
        weight: 48 + (index % 35),
        height: 150 + (index % 28),
        pain_score: abnormal ? 5 + (index % 4) : index % 3,
        blood_glucose: abnormal && index % 4 === 1 ? 198 : 92 + (index % 30),
        measurement_position: 'sitting',
        temperature_site: 'axillary',
        bp_site: 'left_arm',
        source: 'manual',
        note: abnormal ? 'Có chỉ số bất thường, đã báo bác sĩ phụ trách.' : 'Sinh hiệu ổn định trước khi vào khám.',
        recorded_at: recordedAt,
        abnormal_flags: abnormal ? [{ field: index % 2 === 0 ? 'blood_pressure' : 'temperature', value: index % 2 === 0 ? '158/96' : 38.7, threshold: index % 2 === 0 ? '>140/90' : '>38.0', level: index % 3 === 0 ? 'high' : 'warning', severity: index % 3 === 0 ? 'high' : 'warning', message: index % 2 === 0 ? 'Huyết áp cao cần theo dõi sát.' : 'Sốt cần đánh giá nhiễm trùng.', recommendation: 'Đo lại sau 15 phút và thông báo bác sĩ.' }] : [],
        severity: abnormal ? (index % 3 === 0 ? 'high' : 'warning') : 'normal',
        overall_severity: abnormal ? (index % 3 === 0 ? 'high' : 'warning') : 'normal',
        requires_recheck: abnormal,
        suggested_recheck_minutes: abnormal ? 15 : undefined,
        doctor_notification_required: abnormal,
        requires_doctor_notification: abnormal,
        status: 'recorded',
      }, recordedAt));
    });

    indexes(10).forEach((index) => {
      const createdAt = dashDate(dateKey, 8 + Math.floor(index / 3), (index % 3) * 15);
      const title = pick(['Huyết áp cao', 'Sốt cần đánh giá', 'SpO2 thấp', 'Đau ngực khi gắng sức', 'Dị ứng thuốc cần lưu ý'], index);
      docs.get('ClinicalAlert').push(dashDoc('ClinicalAlert', `${dateIndex}:${index}`, {
        patient_id: dashPatientId(dateIndex * DASHBOARD_APPOINTMENTS_PER_DAY + index),
        encounter_id: dashId('Encounter', `${dateIndex}:${index}`),
        source_type: index % 5 === 0 ? 'manual' : 'vital_sign',
        source_id: dashId('VitalSign', `${dateIndex}:${index}`),
        rule_code: `DASH-${String(index + 1).padStart(2, '0')}`,
        title,
        message: `${title}: cần bác sĩ xem trong ca khám, bệnh nhân có triệu chứng ${symptoms[index % symptoms.length].toLowerCase()}`,
        severity: index % 4 === 0 ? 'critical' : index % 3 === 0 ? 'high' : 'warning',
        status: index % 5 === 0 ? 'doctor_notified' : 'open',
        assigned_to_user_id: doctorIdValue,
        department_id: departmentIdValue,
        doctor_notified_at: index % 5 === 0 ? new Date(createdAt.getTime() + 5 * 60000) : undefined,
        sla_due_at: new Date(createdAt.getTime() + 30 * 60000),
        metadata: { demoCode: 'doctor-dashboard-coverage', symptom: symptoms[index % symptoms.length] },
      }, createdAt));
    });
  });

  DASHBOARD_DATES.forEach((dateKey, dateIndex) => {
    indexes(10).forEach((index) => {
      const globalIndex = dateIndex * 10 + index;
      docs.get('Notification').push(dashDoc('Notification', `${dateIndex}:${index}`, {
        recipient_type: 'staff',
        recipient_id: doctorIdValue,
        recipient_actor_type: 'staff',
        recipient_actor_id: doctorIdValue,
        recipient_user_id: doctorIdValue,
        patient_id: dashPatientId(dateIndex * DASHBOARD_APPOINTMENTS_PER_DAY + index),
        channel: 'in_app',
        notification_type: pick(['appointment_created', 'queue_checked_in', 'lab_result_ready', 'vital_alert', 'order_pending'], globalIndex),
        event_type: pick(['appointment.new', 'queue.ready', 'lab.result_ready', 'clinical.alert', 'order.pending'], globalIndex),
        priority: index % 5 === 0 ? 'critical' : index % 3 === 0 ? 'high' : 'normal',
        dedupe_key: `doctor-dashboard-bs-minhanh-${dateKey}-${index}`,
        title: pick(['Lịch hẹn mới trong ca hôm nay', 'Bệnh nhân đã check-in và sẵn sàng khám', 'Kết quả xét nghiệm cần xem', 'Cảnh báo sinh hiệu bất thường', 'Order đang chờ xử lý'], globalIndex),
        message: pick(['Bệnh nhân vừa xác nhận lịch khám nội tổng quát.', 'Điều dưỡng đã hoàn tất sinh hiệu, bệnh nhân đang chờ gọi vào phòng.', 'Có kết quả xét nghiệm mới cần bác sĩ xem trước khi kết luận.', 'Sinh hiệu bất thường cần đánh giá lại trong ca khám.', 'Có chỉ định còn mở, cần theo dõi tiến độ xử lý.'], globalIndex),
        data: { appointment_id: String(dashId('Appointment', `${dateIndex}:${index % DASHBOARD_APPOINTMENTS_PER_DAY}`)), encounter_id: String(dashId('Encounter', `${dateIndex}:${index % 25}`)) },
        action_url: '/doctor/dashboard',
        created_by_module: 'doctor_dashboard_seed',
        sent_at: dashDate(dateKey, 8 + (index % 8), (index * 7) % 60),
        delivered_at: dashDate(dateKey, 8 + (index % 8), ((index * 7) % 60) + 1),
        status: index % 2 === 0 ? 'sent' : 'delivered',
      }, dashDate(dateKey, 8 + (index % 8), (index * 7) % 60)));
    });
  });

  return docs;
}

async function validateDoctorDashboardCoverageDocs(docsByModel) {
  const errors = [];
  for (const [modelName, docs] of docsByModel.entries()) {
    if (modelName === 'Order') continue;
    for (const doc of docs) {
      try {
        await new models[modelName](doc).validate();
      } catch (error) {
        errors.push(`${modelName}/${doc._id}: ${error.message}`);
      }
    }
  }
  if (errors.length) throw new Error(`Doctor dashboard coverage validation failed:\n- ${errors.join('\n- ')}`);
}

async function cleanupDoctorDashboardCoverageDocs() {
  const doctorIdValue = dashDoctorId();
  const nurseId = dashNurseId();
  const dateRanges = DASHBOARD_DATES.map((dateKey) => {
    const start = dashDate(dateKey);
    const end = dashDate(dateKey, 23, 59);
    end.setSeconds(59, 999);
    return { start, end };
  });
  const inSeedDay = (field) => ({ $or: dateRanges.map(({ start, end }) => ({ [field]: { $gte: start, $lte: end } })) });
  const workDates = DASHBOARD_DATES.map((dateKey) => dashDate(dateKey));
  const prescriptionIds = await models.Prescription
    .find({ prescribed_by: doctorIdValue, prescription_no: /^DT-MA-/, ...inSeedDay('prescribed_at') })
    .select('_id')
    .lean();

  await models.PrescriptionItem.deleteMany({ prescription_id: { $in: prescriptionIds.map((item) => item._id) } });
  await Promise.all([
    models.DoctorSchedule.deleteMany({ doctor_id: doctorIdValue, work_date: { $in: workDates }, internal_note: /^Ca / }),
    models.Appointment.deleteMany({ doctor_id: doctorIdValue, source: 'doctor_dashboard_seed', ...inSeedDay('appointment_time') }),
    models.QueueTicket.deleteMany({ doctor_id: doctorIdValue, queue_number: /^MA/, queue_date: { $in: workDates } }),
    models.Encounter.deleteMany({ attending_doctor_id: doctorIdValue, encounter_code: /^LK-MA-/, ...inSeedDay('start_time') }),
    models.Order.deleteMany({ ordered_by: doctorIdValue, order_no: /^ORD-MA-/, ...inSeedDay('ordered_at') }),
    models.Prescription.deleteMany({ prescribed_by: doctorIdValue, prescription_no: /^DT-MA-/, ...inSeedDay('prescribed_at') }),
    models.VitalSign.deleteMany({ recorded_by: nurseId, ...inSeedDay('recorded_at') }),
    models.ClinicalAlert.deleteMany({ assigned_to_user_id: doctorIdValue, 'metadata.demoCode': 'doctor-dashboard-coverage', ...inSeedDay('created_at') }),
    models.Notification.deleteMany({ recipient_user_id: doctorIdValue, created_by_module: 'doctor_dashboard_seed', ...inSeedDay('created_at') }),
  ]);
}

async function upsertDoctorDashboardCoverageDocs(docsByModel) {
  await cleanupDoctorDashboardCoverageDocs();
  const summary = [];
  for (const [modelName, docs] of docsByModel.entries()) {
    const Model = models[modelName];
    const operations = docs.map((doc) => {
      const { _id, created_at: createdAt, ...set } = doc;
      return { updateOne: { filter: { _id }, update: { $set: set, $setOnInsert: { _id, created_at: createdAt || new Date() } }, upsert: true } };
    });
    const result = await Model.bulkWrite(operations, { ordered: false, timestamps: false, ...(modelName === 'Order' ? { strict: false } : {}) });
    summary.push({
      model: `${modelName}(doctor dashboard)`,
      collection: Model.collection.name,
      requested: docs.length,
      seeded: await Model.countDocuments({ _id: { $in: docs.map((doc) => doc._id) } }),
      upserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
    });
  }
  return summary;
}

async function ensureDoctorDashboardRole() {
  const doctorRole = await models.Role.findOne({ role_code: 'doctor', status: 'active', is_deleted: false }).lean();
  if (!doctorRole) throw new Error('Role doctor chưa tồn tại sau bootstrapSystemAccess.');
  const result = await models.UserRole.updateOne(
    { user_id: dashDoctorId(), role_id: doctorRole._id },
    { $set: { is_active: true, updated_at: new Date(), updated_by: dashDoctorId() }, $setOnInsert: { user_id: dashDoctorId(), role_id: doctorRole._id, created_at: new Date(), created_by: dashDoctorId() } },
    { upsert: true },
  );
  return {
    model: 'UserRole(doctor dashboard)',
    collection: models.UserRole.collection.name,
    requested: 1,
    seeded: await models.UserRole.countDocuments({ user_id: dashDoctorId(), role_id: doctorRole._id, is_active: true }),
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
  };
}

async function ensureDoctorDashboardPermissions() {
  const [doctorRole, queueReportPermission] = await Promise.all([
    models.Role.findOne({ role_code: 'doctor', status: 'active', is_deleted: false }).lean(),
    models.Permission.findOne({ permission_code: 'reports.queue.read', is_deleted: false }).lean(),
  ]);
  if (!doctorRole) throw new Error('Role doctor chÆ°a tá»“n táº¡i sau bootstrapSystemAccess.');
  if (!queueReportPermission) throw new Error('Permission reports.queue.read chÆ°a tá»“n táº¡i sau bootstrapSystemAccess.');

  const result = await models.RolePermission.updateOne(
    { role_id: doctorRole._id, permission_id: queueReportPermission._id },
    {
      $set: { is_active: true, updated_at: new Date(), updated_by: dashDoctorId() },
      $setOnInsert: {
        role_id: doctorRole._id,
        permission_id: queueReportPermission._id,
        created_at: new Date(),
        created_by: dashDoctorId(),
      },
    },
    { upsert: true },
  );

  return {
    model: 'RolePermission(doctor dashboard)',
    collection: models.RolePermission.collection.name,
    requested: 1,
    seeded: await models.RolePermission.countDocuments({ role_id: doctorRole._id, permission_id: queueReportPermission._id, is_active: true }),
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
  };
}

async function verifyDoctorDashboardCoverage() {
  const doctorIdValue = dashDoctorId();
  const rows = [];
  for (const dateKey of DASHBOARD_DATES) {
    const start = dashDate(dateKey);
    const end = dashDate(dateKey, 23, 59);
    end.setSeconds(59, 999);
    rows.push({
      date: dateKey,
      appointments: await models.Appointment.countDocuments({ doctor_id: doctorIdValue, appointment_time: { $gte: start, $lte: end }, is_deleted: false }),
      queue_tickets: await models.QueueTicket.countDocuments({ doctor_id: doctorIdValue, queue_date: start }),
      encounters: await models.Encounter.countDocuments({ attending_doctor_id: doctorIdValue, start_time: { $gte: start, $lte: end } }),
      active_encounters: await models.Encounter.countDocuments({ attending_doctor_id: doctorIdValue, status: { $in: ['arrived', 'in_progress', 'on_hold'] }, start_time: { $gte: start, $lte: end } }),
      completed_encounters: await models.Encounter.countDocuments({ attending_doctor_id: doctorIdValue, status: 'completed', start_time: { $gte: start, $lte: end } }),
      orders: await models.Order.countDocuments({ ordered_by: doctorIdValue, ordered_at: { $gte: start, $lte: end } }),
      prescriptions: await models.Prescription.countDocuments({ prescribed_by: doctorIdValue, prescribed_at: { $gte: start, $lte: end } }),
      vital_signs: await models.VitalSign.countDocuments({ recorded_by: dashNurseId(), recorded_at: { $gte: start, $lte: end } }),
      clinical_alerts: await models.ClinicalAlert.countDocuments({ assigned_to_user_id: doctorIdValue, created_at: { $gte: start, $lte: end } }),
      schedules: await models.DoctorSchedule.countDocuments({ doctor_id: doctorIdValue, work_date: start, is_deleted: false }),
      notifications: await models.Notification.countDocuments({ $or: [{ recipient_id: doctorIdValue }, { recipient_user_id: doctorIdValue }], created_at: { $gte: start, $lte: end } }),
    });
  }
  const today = dashDate('2026-05-19');
  const dashboardChecks = [{
    doctor_id: String(doctorIdValue),
    today_waiting: await models.QueueTicket.countDocuments({ doctor_id: doctorIdValue, queue_date: today, status: 'waiting' }),
    today_called: await models.QueueTicket.countDocuments({ doctor_id: doctorIdValue, queue_date: today, status: 'called' }),
    today_in_service: await models.QueueTicket.countDocuments({ doctor_id: doctorIdValue, queue_date: today, status: 'in_service' }),
    dashboard_order_query_count: await models.Order.countDocuments({ ordered_by: doctorIdValue, status: DASHBOARD_STATUS_QUERY }),
    unread_notifications: await models.Notification.countDocuments({ $or: [{ recipient_id: doctorIdValue }, { recipient_user_id: doctorIdValue }], status: { $in: ['unread', 'queued', 'sent', 'delivered'] }, read_at: null }),
  }];
  console.table(rows);
  console.table(dashboardChecks);
  const missing = rows.flatMap((row) => Object.entries(row).filter(([key, value]) => key !== 'date' && Number(value) <= 0).map(([key]) => `${row.date}:${key}`));
  if (missing.length || dashboardChecks[0].dashboard_order_query_count < 5 || dashboardChecks[0].unread_notifications < 5) {
    throw new Error(`Doctor dashboard coverage chưa đủ dữ liệu: ${missing.join(', ') || 'daily ok'}`);
  }
  return rows;
}

async function main() {
  const passwordHash = await hashPassword('MatKhau@123');
  const docsByModel = buildAllDocs(passwordHash);
  const doctorDashboardCoverageDocs = buildDoctorDashboardCoverageDocs(passwordHash);
  const pharmacyOverviewCoverageDocs = pharmacyOverviewCoverage.build(passwordHash);
  await validateDocs(docsByModel);
  await validateDoctorDashboardCoverageDocs(doctorDashboardCoverageDocs);
  await pharmacyOverviewCoverage.validate(pharmacyOverviewCoverageDocs);

  if (DRY_RUN) {
    printSummary([...docsByModel.entries()].map(([modelName, docs]) => ({
      model: modelName,
      collection: models[modelName].collection.name,
      requested: docs.length,
      seeded: docs.length,
    })));
    console.table([...doctorDashboardCoverageDocs.entries()].map(([modelName, docs]) => ({
      model: `${modelName}(doctor dashboard)`,
      collection: models[modelName].collection.name,
      requested: docs.length,
      seeded: docs.length,
    })));
    console.table(pharmacyOverviewCoverage.summaryRows(pharmacyOverviewCoverageDocs));
    console.log('Dry-run thành công: dữ liệu mẫu hợp lệ theo Mongoose schema.');
    return;
  }

  await connectSeedDatabase();
  const { bootstrapSystemAccess } = require('../services/bootstrap.service');
  await bootstrapSystemAccess();
  const summary = await upsertDocs(docsByModel);
  const roleAssignmentSummary = await ensureDemoCoreRoleAssignments();
  const invoiceConsistencySummary = await ensureInvoiceConsistency();
  const completedAppointmentSummary = await ensureCompletedAppointmentsHaveEncounters();
  const nurseCoverageSummary = await ensureNurseWorkspaceApiCoverage();
  const doctorDashboardCoverageSummary = await upsertDoctorDashboardCoverageDocs(doctorDashboardCoverageDocs);
  const doctorDashboardRoleSummary = await ensureDoctorDashboardRole();
  const doctorDashboardPermissionSummary = await ensureDoctorDashboardPermissions();
  const pharmacyOverviewCoverageSummary = await pharmacyOverviewCoverage.upsert(pharmacyOverviewCoverageDocs);
  const pharmacyOverviewRoleSummary = await pharmacyOverviewCoverage.ensureRoles();
  printSummary(summary);
  console.table([{
    model: 'UserRole(core)',
    collection: models.UserRole.collection.name,
    seeded: roleAssignmentSummary.seeded,
    requested: roleAssignmentSummary.requested,
    upserted: roleAssignmentSummary.upserted,
    modified: roleAssignmentSummary.modified,
  }, {
    model: 'Invoice(consistency)',
    collection: models.Invoice.collection.name,
    seeded: invoiceConsistencySummary.seeded,
    requested: invoiceConsistencySummary.requested,
    upserted: invoiceConsistencySummary.upserted,
    modified: invoiceConsistencySummary.modified,
  }, {
    model: 'Encounter(completed appointments)',
    collection: models.Encounter.collection.name,
    seeded: completedAppointmentSummary.seeded,
    requested: completedAppointmentSummary.requested,
    upserted: completedAppointmentSummary.upserted,
    modified: completedAppointmentSummary.modified,
  }, doctorDashboardRoleSummary, doctorDashboardPermissionSummary, pharmacyOverviewRoleSummary, ...nurseCoverageSummary, ...doctorDashboardCoverageSummary, ...pharmacyOverviewCoverageSummary]);
  await verifyDoctorDashboardCoverage();
  await pharmacyOverviewCoverage.verify();
  console.log('Seed dữ liệu mẫu tiếng Việt hoàn tất.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
