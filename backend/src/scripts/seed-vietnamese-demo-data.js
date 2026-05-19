const crypto = require('crypto');
const mongoose = require('mongoose');
const models = require('../models');
const { hashPassword } = require('../common/auth/password-hash');

const BASE_COUNT = 12;
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
]);

const DAY_OFFSETS = [-24, -18, -12, -7, -3, -1, 0, 1, 3, 7, 14, 24];

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
  ['Nguyễn Văn An', 'male', '1984-03-12', '12 Nguyễn Trãi, phường Bến Thành, Quận 1, TP. Hồ Chí Minh'],
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

function temporalBucket(index) {
  const offset = DAY_OFFSETS[index % DAY_OFFSETS.length];
  if (offset < -2) return 'past';
  if (offset <= 1) return 'present';
  return 'future';
}

function pick(list, index) {
  return list[index % list.length];
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
  return indexes(BASE_COUNT * 2).map((index) => {
    const type = index < BASE_COUNT ? 'staff' : 'patient';
    return make('UserPreference', index, {
      actor_type: type,
      actor_id: actorIdFor(type, index),
      default_patient_profile_id: type === 'patient' ? patientId(index) : undefined,
      locale: 'vi-VN',
      timezone: 'Asia/Ho_Chi_Minh',
      theme: index % 2 === 0 ? 'light' : 'system',
      notification_channels: ['in_app', 'email'],
      critical_notifications_enabled: true,
    });
  });
}

function buildDoctorProfileDocs() {
  return indexes(BASE_COUNT).map((index) => make('DoctorProfile', index, {
    user_id: doctorId(index),
    department_id: doctorDepartmentId(index),
    license_number: `CCHN-${2026}${pad(index)}`,
    specialty: doctorSpecialties[index],
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
  return indexes(BASE_COUNT).map((index) => {
    const start = dateAt(index, 7 + (index % 2) * 6, 30);
    const end = addMinutes(start, 240);
    return make('DoctorSchedule', index, {
      doctor_id: doctorId(index),
      department_id: doctorDepartmentId(index),
      work_date: dateAt(index, 0, 0),
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
  return indexes(BASE_COUNT).map((index) => {
    const start = dateAt(index, 8 + (index % 4), (index % 3) * 15);
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
  return indexes(BASE_COUNT).map((index) => {
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
  return indexes(BASE_COUNT).map((index) => {
    const status = temporalBucket(index) === 'past'
      ? pick(['completed', 'completed', 'no_show', 'cancelled'], index)
      : temporalBucket(index) === 'present'
        ? pick(['waiting', 'called', 'in_service'], index)
        : 'waiting';
    const queueDate = dateAt(index, 0, 0);
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
      checkin_time: addMinutes(queueDate, 7 * 60 + 20 + index * 3),
      called_time: ['called', 'in_service', 'completed'].includes(status) ? addMinutes(queueDate, 8 * 60 + index * 4) : undefined,
      estimated_called_at: addMinutes(queueDate, 8 * 60 + 15 + index * 4),
      service_start_time: ['in_service', 'completed'].includes(status) ? addMinutes(queueDate, 8 * 60 + 10 + index * 4) : undefined,
      completed_time: status === 'completed' ? addMinutes(queueDate, 9 * 60 + index * 4) : undefined,
      display_number: `PK${100 + index}`,
      nursing_stage: temporalBucket(index) === 'future' ? 'waiting_nurse' : pick(['triage_done', 'vital_done', 'ready_for_doctor', 'completed'], index),
      assigned_nurse_id: nurseId(index),
      triage_required: index % 2 === 0,
      vital_required: true,
      doctor_room_id: `P${100 + index}`,
      sla_due_at: addMinutes(queueDate, 10 * 60 + index * 5),
      latest_vital_sign_id: idFor('VitalSign', index),
    });
  });
}

function buildEncounterDocs() {
  return indexes(BASE_COUNT).map((index) => {
    const start = dateAt(index, 8 + (index % 4), 30);
    const status = statusForEncounter(index);
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
      nursing_status: temporalBucket(index) === 'future' ? 'not_started' : pick(['triage_done', 'vital_done', 'ready_for_doctor', 'completed'], index),
      assigned_nurse_id: nurseId(index),
      assigned_nurse_at: addMinutes(start, -25),
      ready_for_doctor_at: temporalBucket(index) !== 'future' ? addMinutes(start, -5) : undefined,
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
    assessment: diagnosisSeeds[index][1],
    plan: 'Tư vấn điều trị, theo dõi triệu chứng và hẹn tái khám khi cần.',
    status: temporalBucket(index) === 'future' ? 'draft' : pick(['signed', 'in_progress', 'signed', 'amended'], index),
  }));
}

function buildClinicalNoteDocs() {
  return indexes(BASE_COUNT).map((index) => make('ClinicalNote', index, {
    encounter_id: idFor('Encounter', index),
    consultation_id: idFor('Consultation', index),
    author_id: doctorId(index),
    note_type: pick(['progress', 'assessment', 'instruction', 'follow_up'], index),
    content: `Ghi chú lâm sàng: ${diagnosisSeeds[index][1]}. Bệnh nhân được giải thích kế hoạch điều trị và đồng ý theo dõi.`,
    status: temporalBucket(index) === 'future' ? 'draft' : pick(['signed', 'in_progress', 'amended'], index),
  }));
}

function buildDiagnosisDocs() {
  return indexes(BASE_COUNT).map((index) => make('Diagnosis', index, {
    encounter_id: idFor('Encounter', index),
    consultation_id: idFor('Consultation', index),
    recorded_by: doctorId(index),
    icd10_code: diagnosisSeeds[index][0],
    diagnosis_name: diagnosisSeeds[index][1],
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
    icd10_code: diagnosisSeeds[index][0],
    problem_name: diagnosisSeeds[index][1],
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
    allergy_type: allergySeeds[index][0],
    allergen: allergySeeds[index][1],
    reaction: allergySeeds[index][2],
    severity: pick(['mild', 'moderate', 'severe', 'unknown'], index),
    recorded_at: dateAt(index, 11, 0),
    note: 'Đã nhắc bệnh nhân thông báo dị ứng khi nhận thuốc hoặc làm thủ thuật.',
    status: pick(['active', 'active', 'resolved'], index),
  }));
}

function buildVitalSignDocs() {
  return indexes(BASE_COUNT).map((index) => make('VitalSign', index, {
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index),
    queue_ticket_id: idFor('QueueTicket', index),
    appointment_id: idFor('Appointment', index),
    context: pick(['encounter', 'pre_triage', 'inpatient', 'emergency'], index),
    recorded_by: nurseId(index),
    recorded_at: dateAt(index, 8, 10),
    temperature_c: 36.4 + (index % 5) * 0.2,
    heart_rate: 72 + index,
    respiratory_rate: 18 + (index % 4),
    systolic_bp: 112 + index,
    diastolic_bp: 70 + (index % 8),
    spo2: 96 + (index % 4),
    weight_kg: 48 + index * 2,
    height_cm: 150 + index,
    bmi: 21 + (index % 5),
    pain_score: index % 6,
    alerts: index % 5 === 0 ? [{ code: 'BP_HIGH', message: 'Huyết áp cao hơn mức nền của bệnh nhân.', severity: 'warning' }] : [],
    overall_severity: index % 5 === 0 ? 'warning' : 'normal',
    requires_doctor_notification: index % 5 === 0,
    status: 'recorded',
  }));
}

function buildCarePlanDocs() {
  return indexes(BASE_COUNT).map((index) => make('CarePlan', index, {
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index),
    diagnosis_id: idFor('Diagnosis', index),
    plan_no: code('KHCS-2026', index),
    title: `Kế hoạch chăm sóc ${diagnosisSeeds[index][1].toLowerCase()}`,
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
      clinical_indication: `Chỉ định phục vụ đánh giá ${diagnosisSeeds[index][1].toLowerCase()}.`,
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
    test_code: labTests[index][0],
    test_name: labTests[index][1],
    specimen_type: labTests[index][3],
    priority: pick(['routine', 'urgent', 'stat'], index),
    ordered_at: dateAt(index, 9, 5),
    collected_at: temporalBucket(index) !== 'future' ? dateAt(index, 9, 20) : undefined,
    completed_at: temporalBucket(index) === 'past' ? dateAt(index, 11, 0) : undefined,
    clinical_note: `Xét nghiệm theo dõi ${diagnosisSeeds[index][1].toLowerCase()}.`,
    status: temporalBucket(index) === 'past' ? 'completed' : temporalBucket(index) === 'present' ? pick(['ordered', 'collected', 'in_progress'], index) : 'ordered',
  }));
}

function buildSpecimenDocs() {
  return indexes(BASE_COUNT).map((index) => make('Specimen', index, {
    lab_order_id: idFor('LabOrder', index),
    patient_id: patientId(index),
    specimen_no: code('SP-2026', index),
    specimen_type: labTests[index][3],
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
    item_code: labTests[index][0],
    item_name: labTests[index][1],
    result_value: String(4.5 + (index % 6) * 0.7),
    numeric_value: 4.5 + (index % 6) * 0.7,
    unit: labTests[index][4] || 'Âm tính',
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
    body_part: bodyParts[index],
    contrast_required: index % 4 === 0,
    priority: pick(['routine', 'urgent', 'stat'], index),
    clinical_indication: `Đánh giá hình ảnh liên quan ${diagnosisSeeds[index][1].toLowerCase()}.`,
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
    procedure_code: procedureSeeds[index][0],
    procedure_name: procedureSeeds[index][1],
    priority: pick(['routine', 'urgent', 'stat'], index),
    clinical_indication: `Thủ thuật phục vụ xử trí ${diagnosisSeeds[index][1].toLowerCase()}.`,
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
    route: medicationSeeds[index][5],
    quantity: 10 + index,
    unit: medicationSeeds[index][6],
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
    unit: medicationSeeds[index][6],
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
    route: medicationSeeds[index][5],
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
    unit_cost: medicationSeeds[index][7],
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
    unit_cost: medicationSeeds[index][7],
    occurred_at: dateAt(index, 15, 0),
    performed_by: pharmacistId(index),
    reason: 'Giao dịch kho thuốc mẫu phục vụ kiểm thử tồn kho.',
  }));
}

function buildRoomDocs() {
  return indexes(BASE_COUNT).map((index) => make('Room', index, {
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
  return indexes(BASE_COUNT).map((index) => make('Bed', index, {
    room_id: idFor('Room', index),
    bed_code: code('GIUONG', index),
    bed_name: `Giường ${index + 1}`,
    bed_type: pick(['standard', 'icu', 'pediatric', 'maternity', 'isolation', 'other'], index),
    status: temporalBucket(index) === 'present' ? pick(['available', 'occupied', 'reserved'], index) : pick(['available', 'maintenance', 'blocked'], index),
  }));
}

function buildAdmissionDocs() {
  return indexes(BASE_COUNT).map((index) => {
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
      reason: `Nhập viện theo dõi ${diagnosisSeeds[index][1].toLowerCase()}.`,
      discharge_disposition: status === 'discharged' ? 'Ổn định, về nhà dùng thuốc theo toa' : undefined,
      discharge_summary: status === 'discharged' ? 'Bệnh nhân ổn định, đã được hẹn tái khám.' : undefined,
      status,
    });
  });
}

function buildBedAssignmentDocs() {
  return indexes(BASE_COUNT).map((index) => make('BedAssignment', index, {
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
  return indexes(BASE_COUNT).map((index) => make('InpatientTask', index, {
    admission_id: idFor('Admission', index),
    patient_id: patientId(index),
    assigned_to: nurseId(index),
    type: pick(['round', 'nursing_care', 'diet', 'cleaning', 'discharge_checklist', 'other'], index),
    title: pick(['Đi buồng sáng', 'Theo dõi dấu hiệu sinh tồn', 'Nhắc chế độ ăn', 'Chuẩn bị ra viện', 'Chăm sóc vết thương'], index),
    description: 'Nhiệm vụ nội trú mẫu được ghi bằng tiếng Việt.',
    due_at: dateAt(index, 7, 30),
    completed_at: temporalBucket(index) === 'past' ? dateAt(index, 8, 10) : undefined,
    status: temporalBucket(index) === 'past' ? 'done' : temporalBucket(index) === 'present' ? 'in_progress' : 'todo',
  }));
}

function buildNursingIntakeDocs() {
  return indexes(BASE_COUNT).map((index) => make('NursingIntake', index, {
    queue_ticket_id: idFor('QueueTicket', index),
    patient_id: patientId(index),
    department_id: doctorDepartmentId(index),
    nurse_id: nurseId(index),
    started_at: temporalBucket(index) !== 'future' ? dateAt(index, 7, 45) : undefined,
    completed_at: temporalBucket(index) === 'past' ? dateAt(index, 8, 5) : undefined,
    reason: 'Tiếp nhận điều dưỡng trước khi vào khám bác sĩ.',
    note: 'Đã kiểm tra thông tin hành chính và triệu chứng ban đầu.',
    status: temporalBucket(index) === 'past' ? 'completed' : temporalBucket(index) === 'present' ? 'in_progress' : 'waiting',
  }));
}

function buildNursingTaskDocs() {
  return indexes(BASE_COUNT).map((index) => make('NursingTask', index, {
    patient_id: patientId(index),
    encounter_id: idFor('Encounter', index),
    queue_ticket_id: idFor('QueueTicket', index),
    department_id: doctorDepartmentId(index),
    assigned_to: nurseId(index),
    title: pick(['Đo sinh hiệu', 'Hướng dẫn lấy mẫu', 'Chuẩn bị thủ thuật', 'Theo dõi sau tiêm', 'Bàn giao ca trực'], index),
    description: 'Nhiệm vụ điều dưỡng mẫu trong quy trình khám bệnh.',
    task_type: pick(['triage', 'vital', 'preparation', 'medication_monitoring', 'post_procedure_monitoring', 'inpatient_care', 'emergency_response', 'handover', 'other'], index),
    priority: pick(['low', 'medium', 'high', 'critical'], index),
    due_at: dateAt(index, 8, 0),
    completed_at: temporalBucket(index) === 'past' ? dateAt(index, 8, 25) : undefined,
    status: temporalBucket(index) === 'past' ? 'done' : temporalBucket(index) === 'present' ? 'in_progress' : 'todo',
  }));
}

function buildTriageAssessmentDocs() {
  return indexes(BASE_COUNT).map((index) => make('TriageAssessment', index, {
    patient_id: patientId(index),
    appointment_id: idFor('Appointment', index),
    encounter_id: idFor('Encounter', index),
    queue_ticket_id: idFor('QueueTicket', index),
    department_id: doctorDepartmentId(index),
    doctor_id: doctorId(index),
    nurse_id: nurseId(index),
    triage_by: nurseId(index),
    triage_at: temporalBucket(index) !== 'future' ? dateAt(index, 7, 55) : undefined,
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
    pregnancy_status: patientProfiles[index][1] === 'female' ? pick(['unknown', 'not_pregnant', 'pregnant'], index) : 'not_pregnant',
    allergy_reviewed: true,
    medication_reviewed: true,
    problem_reviewed: true,
    vital_sign_id: idFor('VitalSign', index),
    vital_snapshot: { mach: 72 + index, nhiet_do: 36.6, huyet_ap: `${112 + index}/75` },
    status: temporalBucket(index) === 'future' ? 'draft' : pick(['completed', 'in_progress', 'completed'], index),
    note: 'Phân loại ban đầu theo thông tin bệnh nhân cung cấp.',
    started_at: dateAt(index, 7, 50),
    completed_at: temporalBucket(index) !== 'future' ? dateAt(index, 8, 5) : undefined,
    completed_by: temporalBucket(index) !== 'future' ? nurseId(index) : undefined,
  }));
}

function buildServicePreparationChecklistDocs() {
  return indexes(BASE_COUNT).map((index) => make('ServicePreparationChecklist', index, {
    patient_id: patientId(index),
    order_id: orderId('service', index),
    order_type: pick(['lab', 'imaging', 'procedure', 'service'], index),
    department_id: doctorDepartmentId(index),
    assigned_to: nurseId(index),
    checklist_items: [
      { key: 'xac_nhan_dinh_danh', label: 'Xác nhận đúng người bệnh', checked: true, checked_at: dateAt(index, 8, 0), checked_by: nurseId(index) },
      { key: 'giai_thich_quy_trinh', label: 'Giải thích quy trình cho bệnh nhân', checked: index % 3 !== 0, checked_at: dateAt(index, 8, 5), checked_by: nurseId(index) },
    ],
    note: 'Checklist chuẩn bị dịch vụ mẫu.',
    status: temporalBucket(index) === 'past' ? 'completed' : temporalBucket(index) === 'present' ? 'in_progress' : 'pending',
  }));
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
    const unitPrice = serviceSeeds[index][3];
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
      description: serviceSeeds[index][1],
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
    const service = serviceSeeds[index];
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
    title: `Bệnh án ${diagnosisSeeds[index][1].toLowerCase()}`,
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
    subject: supportSubjects[index],
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
    subject: supportSubjects[index],
    description: `${supportSubjects[index]}. Nội dung này được tạo để kiểm thử quy trình chăm sóc khách hàng.`,
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
    NursingIntake: buildNursingIntakeDocs,
    NursingTask: buildNursingTaskDocs,
    TriageAssessment: buildTriageAssessmentDocs,
    ServicePreparationChecklist: buildServicePreparationChecklistDocs,
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
    FacilityLocation: buildFacilityLocationDocs,
  };

  const docsByModel = new Map();
  const targetModels = Object.entries(models)
    .filter(([name, Model]) => Model?.schema && !SKIPPED_MODELS.has(name))
    .map(([name]) => name);

  for (const modelName of targetModels) {
    const builder = builders[modelName];
    if (!builder) {
      throw new Error(`Thiếu builder seed cho model ${modelName}.`);
    }
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

async function main() {
  const passwordHash = await hashPassword('MatKhau@123');
  const docsByModel = buildAllDocs(passwordHash);
  await validateDocs(docsByModel);

  if (DRY_RUN) {
    printSummary([...docsByModel.entries()].map(([modelName, docs]) => ({
      model: modelName,
      collection: models[modelName].collection.name,
      requested: docs.length,
      seeded: docs.length,
    })));
    console.log('Dry-run thành công: dữ liệu mẫu hợp lệ theo Mongoose schema.');
    return;
  }

  const { connectDatabase } = require('../config/database');
  await connectDatabase();
  const summary = await upsertDocs(docsByModel);
  printSummary(summary);
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
