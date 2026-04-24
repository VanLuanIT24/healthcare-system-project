const mongoose = require('mongoose');
const env = require('./src/config/env');
const { bootstrapSystemAccess } = require('./src/services/bootstrap.service');
const { hashPassword } = require('./src/utils/password');
const { User, Role, UserRole } = require('./src/models');

async function createDoctorAccount() {
  try {
    // Connect to database
    await mongoose.connect(env.mongodbUri, {
      dbName: env.mongodbDbName || undefined,
    });
    console.log('✓ Kết nối cơ sở dữ liệu thành công');

    // Bootstrap system
    await bootstrapSystemAccess();
    console.log('✓ Khởi tạo hệ thống thành công');

    // Get doctor role
    const doctorRole = await Role.findOne({ role_code: 'doctor' });
    if (!doctorRole) {
      throw new Error('Vai trò "doctor" không tồn tại');
    }
    console.log('✓ Tìm thấy vai trò Doctor');

    // Doctor credentials
    const doctorUsername = 'doctor_01';
    const doctorPassword = 'Doctor@123456!';
    const doctorFullName = 'Dr. Nguyen Van A';
    const doctorEmail = 'doctor01@healthcare.local';
    const doctorPhone = '+84912345678';
    const doctorEmployeeCode = 'EMP001';

    // Check if doctor already exists
    const existingDoctor = await User.findOne({
      $or: [
        { username: doctorUsername },
        { email: doctorEmail },
        { employee_code: doctorEmployeeCode },
      ],
    });

    if (existingDoctor) {
      console.log('⚠ Tài khoản bác sĩ đã tồn tại');
      console.log(`Username: ${existingDoctor.username}`);
      console.log(`Email: ${existingDoctor.email}`);
      console.log(`Employee Code: ${existingDoctor.employee_code}`);
      return;
    }

    // Create doctor user
    const doctor = await User.create({
      username: doctorUsername,
      password_hash: await hashPassword(doctorPassword),
      full_name: doctorFullName,
      email: doctorEmail,
      phone: doctorPhone,
      employee_code: doctorEmployeeCode,
      status: 'active',
      must_change_password: false,
      password_changed_at: new Date(),
    });

    console.log('✓ Tạo người dùng thành công');

    // Assign doctor role
    await UserRole.create({
      user_id: doctor._id,
      role_id: doctorRole._id,
      is_active: true,
    });

    console.log('✓ Gán vai trò Doctor thành công');
    console.log('\n===== THÔNG TIN TÀI KHOẢN BÁC SĨ =====');
    console.log(`Username: ${doctorUsername}`);
    console.log(`Password: ${doctorPassword}`);
    console.log(`Họ và tên: ${doctorFullName}`);
    console.log(`Email: ${doctorEmail}`);
    console.log(`Số điện thoại: ${doctorPhone}`);
    console.log(`Mã nhân viên: ${doctorEmployeeCode}`);
    console.log(`Vai trò: Doctor`);
    console.log('=====================================\n');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

createDoctorAccount();
