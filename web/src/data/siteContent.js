export const navigation = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Đăng nhập', to: '/dang-nhap-nhan-su' },
  { label: 'Giới thiệu', to: '/gioi-thieu' },
  { label: 'Chuyên khoa', to: '/chuyen-khoa' },
  { label: 'Bác sĩ', to: '/bac-si' },
  { label: 'Dịch vụ', to: '/dich-vu' },
  { label: 'Hướng dẫn đặt lịch', to: '/huong-dan-dat-lich' },
  { label: 'Tin tức', to: '/tin-tuc' },
  { label: 'Liên hệ', to: '/lien-he' },
];

export const roleOptions = [
  'super_admin',
  'admin',
  'doctor',
  'receptionist',
  'nurse',
  'pharmacist',
  'lab_technician',
];

export const specialties = [
  { slug: 'noi-tong-quat', name: 'Nội tổng quát', summary: 'Theo dõi sức khỏe tổng thể, bệnh mạn tính và khám định kỳ.', accent: 'Khám nền tảng cho mọi nhóm tuổi.' },
  { slug: 'tim-mach', name: 'Tim mạch', summary: 'Tầm soát nguy cơ tim mạch, theo dõi tăng huyết áp, rối loạn nhịp.', accent: 'Lịch khám ưu tiên cho nhóm nguy cơ cao.' },
  { slug: 'da-lieu', name: 'Da liễu', summary: 'Khám mụn, viêm da, nấm da, dị ứng, thẩm mỹ da cơ bản.', accent: 'Phòng tư vấn riêng tư và kín đáo.' },
  { slug: 'nhi-khoa', name: 'Nhi khoa', summary: 'Theo dõi phát triển, tiêm chủng, bệnh lý trẻ em thường gặp.', accent: 'Không gian thân thiện cho trẻ nhỏ.' },
  { slug: 'san-phu-khoa', name: 'Sản phụ khoa', summary: 'Khám thai, phụ khoa định kỳ, tư vấn tiền hôn nhân.', accent: 'Lộ trình chăm sóc nữ giới toàn diện.' },
  { slug: 'tai-mui-hong', name: 'Tai mũi họng', summary: 'Viêm xoang, viêm họng, nội soi tai mũi họng.', accent: 'Thiết bị nội soi hỗ trợ chẩn đoán nhanh.' },
  { slug: 'nha-khoa', name: 'Nha khoa', summary: 'Khám răng miệng, nha chu, nhổ răng, phục hình cơ bản.', accent: 'Ghế nha khoa vô trùng từng lượt khám.' },
  { slug: 'xet-nghiem', name: 'Xét nghiệm', summary: 'Tổng phân tích máu, nước tiểu, sinh hóa, nội tiết.', accent: 'Trả kết quả nhanh theo từng gói.' },
  { slug: 'chan-doan-hinh-anh', name: 'Chẩn đoán hình ảnh', summary: 'Siêu âm, X-quang, hỗ trợ chẩn đoán lâm sàng.', accent: 'Đồng bộ với bác sĩ điều trị trong cùng hệ thống.' },
];

export const doctors = [
  { slug: 'nguyen-minh-khoi', name: 'TS.BS Nguyễn Minh Khôi', specialty: 'Tim mạch', experience: '18 năm kinh nghiệm', gender: 'Nam', degree: 'Tiến sĩ', location: 'Cơ sở Quận 1', schedule: 'Thứ 2 - Thứ 6, 07:30 - 16:30', highlight: 'Chuyên sâu tăng huyết áp và suy tim.', slots: ['07:30', '08:00', '09:30', '14:00'] },
  { slug: 'tran-thu-ha', name: 'BSCKII Trần Thu Hà', specialty: 'Sản phụ khoa', experience: '15 năm kinh nghiệm', gender: 'Nữ', degree: 'Bác sĩ CKII', location: 'Cơ sở Quận 7', schedule: 'Thứ 2 - Thứ 7, 08:00 - 17:00', highlight: 'Theo dõi thai kỳ nguy cơ thấp và trung bình.', slots: ['08:00', '10:00', '13:30', '15:30'] },
  { slug: 'pham-gia-an', name: 'ThS.BS Phạm Gia An', specialty: 'Nhi khoa', experience: '12 năm kinh nghiệm', gender: 'Nam', degree: 'Thạc sĩ', location: 'Cơ sở Thủ Đức', schedule: 'Thứ 3 - Chủ nhật, 07:00 - 15:30', highlight: 'Chăm sóc trẻ sơ sinh và dinh dưỡng nhi.', slots: ['07:00', '08:30', '10:30', '14:30'] },
  { slug: 'le-ngoc-lan', name: 'BS Lê Ngọc Lan', specialty: 'Da liễu', experience: '10 năm kinh nghiệm', gender: 'Nữ', degree: 'Bác sĩ', location: 'Cơ sở Quận 3', schedule: 'Thứ 2 - Thứ 6, 09:00 - 18:00', highlight: 'Điều trị mụn, nám và bệnh da cơ địa.', slots: ['09:00', '11:00', '15:00', '17:00'] },
];

export const services = [
  { slug: 'kham-tong-quat', name: 'Khám tổng quát', price: 'Từ 750.000đ', duration: '60 - 90 phút', summary: 'Gói kiểm tra nền tảng với chỉ số sinh tồn, tư vấn bác sĩ và đề xuất xét nghiệm phù hợp.' },
  { slug: 'kham-chuyen-khoa', name: 'Khám chuyên khoa', price: 'Từ 350.000đ', duration: '30 - 45 phút', summary: 'Thăm khám theo từng chuyên khoa với bác sĩ có lịch trực rõ ràng.' },
  { slug: 'xet-nghiem', name: 'Xét nghiệm', price: 'Tùy danh mục', duration: '15 - 30 phút', summary: 'Lấy mẫu nhanh, trả kết quả điện tử, đồng bộ với hồ sơ khám.' },
  { slug: 'sieu-am-xquang', name: 'Siêu âm, X-quang', price: 'Từ 250.000đ', duration: '20 - 40 phút', summary: 'Hỗ trợ chẩn đoán hình ảnh theo chỉ định lâm sàng.' },
  { slug: 'tiem-chung', name: 'Tiêm chủng', price: 'Theo loại vaccine', duration: '20 phút', summary: 'Tư vấn trước tiêm, theo dõi sau tiêm và nhắc lịch mũi tiếp theo.' },
  { slug: 'thu-thuat', name: 'Thủ thuật', price: 'Theo danh mục', duration: '30 - 90 phút', summary: 'Thực hiện các thủ thuật ngoại trú với quy trình an toàn.' },
  { slug: 'kham-online', name: 'Khám online', price: 'Từ 300.000đ', duration: '20 - 30 phút', summary: 'Phù hợp tái khám, tư vấn ban đầu hoặc theo dõi kết quả điều trị.' },
];

export const articles = [
  { slug: '7-dau-hieu-can-kham-tim-mach', category: 'Sức khỏe tim mạch', title: '7 dấu hiệu bạn nên đi khám tim mạch sớm', excerpt: 'Đừng chờ tới khi khó thở hoặc đau ngực kéo dài mới kiểm tra sức khỏe tim mạch.', readTime: '6 phút đọc' },
  { slug: 'huong-dan-kham-tong-quat', category: 'Hướng dẫn khám', title: 'Khám tổng quát cần chuẩn bị gì để tiết kiệm thời gian?', excerpt: 'Một vài chuẩn bị nhỏ giúp buổi khám diễn ra nhanh, đủ thông tin và hiệu quả hơn.', readTime: '4 phút đọc' },
  { slug: 'cham-soc-da-mua-nang-nong', category: 'Da liễu', title: 'Cách chăm sóc da trong mùa nắng nóng', excerpt: 'Chế độ chống nắng, cấp ẩm và làm sạch phù hợp cho môi trường đô thị.', readTime: '5 phút đọc' },
];

export const faqs = [
  { question: 'Đặt lịch khám như thế nào?', answer: 'Bạn chọn chuyên khoa hoặc bác sĩ, xem khung giờ còn trống, nhập thông tin bệnh nhân và xác nhận lịch hẹn.' },
  { question: 'Tôi có thể hủy lịch ra sao?', answer: 'Bạn có thể hủy hoặc đổi lịch trong khu vực tài khoản cá nhân hoặc liên hệ hotline để được hỗ trợ.' },
  { question: 'Có cần mang BHYT không?', answer: 'Nếu bạn muốn sử dụng quyền lợi bảo hiểm, vui lòng mang thẻ BHYT hoặc giấy tờ liên quan khi đến khám.' },
  { question: 'Cần mang giấy tờ gì khi đi khám?', answer: 'Bạn nên mang CCCD, thẻ BHYT, toa thuốc cũ hoặc kết quả cận lâm sàng gần nhất nếu có.' },
  { question: 'Nên đến trước bao lâu?', answer: 'Khuyến nghị đến trước giờ hẹn từ 15 đến 20 phút để hoàn tất check-in và đo dấu hiệu sinh tồn.' },
];

export const paymentPolicies = [
  'Chấp nhận tiền mặt, thẻ nội địa, thẻ quốc tế và chuyển khoản.',
  'Xuất hóa đơn điện tử theo yêu cầu ngay trong ngày khám.',
  'Hỗ trợ BHYT và các chương trình bảo lãnh viện phí tùy đối tác.',
];
