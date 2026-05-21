const crypto = require('crypto');
const mongoose = require('mongoose');
const models = require('../models');

const SEED_NAMESPACE = 'healthcare-vietnamese-demo-2026-05';
const DATES = ['2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22'];
const PATIENTS_PER_DAY = 50;
const PRESCRIPTIONS_PER_DAY = 40;
const DISPENSES_PER_DAY = 30;
const TX_PER_DAY = 50;
const MEDICATION_COUNT = 120;
const BATCH_COUNT = 140;

function stableObjectId(label) {
  return new mongoose.Types.ObjectId(
    crypto.createHash('sha1').update(`${SEED_NAMESPACE}:${label}`).digest('hex').slice(0, 24),
  );
}

function id(modelName, key) {
  return stableObjectId(`pharmacy-overview:${modelName}:${key}`);
}

function indexes(count) {
  return Array.from({ length: count }, (_, index) => index);
}

function pick(list, index) {
  return list[index % list.length];
}

function dt(dateKey, hour = 8, minute = 0) {
  return new Date(`${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000+07:00`);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function doc(modelName, key, data, createdAt) {
  const row = {
    _id: id(modelName, key),
    ...data,
    created_at: createdAt,
    updated_at: data.updated_at || createdAt,
  };
  const Model = models[modelName];
  if (Model?.schema?.path('created_by') && !row.created_by) row.created_by = id('User', 'ds.minhchau');
  if (Model?.schema?.path('updated_by') && !row.updated_by) row.updated_by = id('User', 'ds.minhchau');
  if (Model?.schema?.path('is_deleted')) row.is_deleted = false;
  return row;
}

const meds = [
  ['PARA500', 'Paracetamol', 'Hapacol 500', 'tablet', '500 mg', 'oral', 'viên', 1200, 120],
  ['PARA250', 'Paracetamol', 'Efferalgan 250', 'sachet', '250 mg', 'oral', 'gói', 1800, 90],
  ['AMOX500', 'Amoxicillin', 'Amoxcare 500', 'capsule', '500 mg', 'oral', 'viên', 2600, 80],
  ['CEFU250', 'Cefuroxime', 'Zinnat 250', 'tablet', '250 mg', 'oral', 'viên', 9500, 60],
  ['AZITH250', 'Azithromycin', 'Azicine 250', 'tablet', '250 mg', 'oral', 'viên', 7800, 50],
  ['OMEP20', 'Omeprazole', 'Omez 20', 'capsule', '20 mg', 'oral', 'viên', 3200, 80],
  ['ESOM40', 'Esomeprazole', 'Nexium 40', 'tablet', '40 mg', 'oral', 'viên', 12500, 50],
  ['MET500', 'Metformin', 'Glucophage 500', 'tablet', '500 mg', 'oral', 'viên', 3400, 100],
  ['AMLO5', 'Amlodipine', 'Amlor 5', 'tablet', '5 mg', 'oral', 'viên', 2800, 100],
  ['LOS50', 'Losartan', 'Cozaar 50', 'tablet', '50 mg', 'oral', 'viên', 6400, 80],
  ['ATOR20', 'Atorvastatin', 'Lipitor 20', 'tablet', '20 mg', 'oral', 'viên', 8600, 70],
  ['CET10', 'Cetirizine', 'Cetirizin 10', 'tablet', '10 mg', 'oral', 'viên', 1800, 70],
  ['LORA10', 'Loratadine', 'Clarityne 10', 'tablet', '10 mg', 'oral', 'viên', 3600, 60],
  ['IBU400', 'Ibuprofen', 'Brufen 400', 'tablet', '400 mg', 'oral', 'viên', 2500, 70],
  ['DIC50', 'Diclofenac', 'Voltaren 50', 'tablet', '50 mg', 'oral', 'viên', 2300, 60],
  ['SALB100', 'Salbutamol', 'Ventolin', 'inhaler', '100 mcg/liều', 'inhalation', 'bình', 78000, 20],
  ['BUD200', 'Budesonide', 'Pulmicort', 'nebulizer', '0.5 mg/2 ml', 'inhalation', 'ống', 18500, 30],
  ['ORS279', 'Oresol', 'Oresol 245', 'sachet', '27.9 g', 'oral', 'gói', 1600, 80],
  ['NACL09', 'Natri clorid', 'NaCl 0.9%', 'infusion', '500 ml', 'intravenous', 'chai', 12000, 70],
  ['RL500', 'Ringer lactate', 'Ringer lactate', 'infusion', '500 ml', 'intravenous', 'chai', 15000, 60],
  ['CEF1G', 'Ceftriaxone', 'Rocephin 1g', 'injection', '1 g', 'intravenous', 'lọ', 56000, 35],
  ['INSGLA', 'Insulin glargine', 'Lantus', 'pen', '100 IU/ml', 'subcutaneous', 'bút', 310000, 20],
  ['TOBRA', 'Tobramycin', 'Tobrex', 'eye_drop', '0.3%', 'ophthalmic', 'lọ', 42000, 25],
  ['DEXCREAM', 'Dexamethasone', 'Dexa cream', 'cream', '15 g', 'topical', 'tuýp', 22000, 30],
];

function med(index) {
  const base = meds[index % meds.length];
  const cycle = Math.floor(index / meds.length);
  if (!cycle) return base;
  return [`${base[0]}-${cycle + 1}`, base[1], `${base[2]} BV ${cycle + 1}`, base[3], base[4], base[5], base[6], base[7] + cycle * 350, base[8]];
}

function build(passwordHash) {
  const docs = new Map([
    ['Department', []],
    ['User', []],
    ['Patient', []],
    ['Encounter', []],
    ['MedicationMaster', []],
    ['StockBatch', []],
    ['Prescription', []],
    ['PrescriptionItem', []],
    ['Dispense', []],
    ['DispenseItem', []],
    ['InventoryTransaction', []],
    ['PharmacyAlert', []],
    ['PharmacyWorkItem', []],
    ['Notification', []],
    ['Charge', []],
    ['Invoice', []],
    ['Payment', []],
  ]);

  const pharmacyDepartmentId = id('Department', 'duoc');
  const clinicalDepartments = ['noi', 'nhi', 'tim-mach', 'cap-cuu'].map((key) => id('Department', key));
  const pharmacists = ['ds.minhchau', 'ds.hoanganh', 'ds.thanhtruc', 'ds.quangvinh', 'ds.linhdan'].map((key) => id('User', key));
  const doctors = ['bs.kimngan', 'bs.minhnhat', 'bs.thanhson', 'bs.haianh', 'bs.baotran', 'bs.quocdat'].map((key) => id('User', key));
  const cashier = id('User', 'tn.phuongmai');

  [
    ['duoc', 'DUOC-OVERVIEW', 'Khoa Dược - Nhà thuốc bệnh viện', 'pharmacy', 'Tầng 1, khu nhà thuốc ngoại trú'],
    ['noi', 'NOI-OVERVIEW', 'Khoa Nội tổng quát', 'clinical', 'Tầng 2, khu khám nội'],
    ['nhi', 'NHI-OVERVIEW', 'Khoa Nhi', 'clinical', 'Tầng 3, khu khám nhi'],
    ['tim-mach', 'TM-OVERVIEW', 'Khoa Tim mạch', 'clinical', 'Tầng 4, khu tim mạch'],
    ['cap-cuu', 'CC-OVERVIEW', 'Khoa Cấp cứu', 'clinical', 'Tầng trệt, khu cấp cứu'],
  ].forEach(([key, department_code, department_name, department_type, location_note], index) => {
    docs.get('Department').push(doc('Department', key, { department_code, department_name, department_type, location_note, status: 'active' }, dt('2026-05-19', 6, index)));
  });

  [
    ['ds.minhchau', 'Dược sĩ Lê Minh Châu', 'DS-OV-001', 'minhchau.duoc@example.local', pharmacyDepartmentId],
    ['ds.hoanganh', 'Dược sĩ Trần Hoàng Anh', 'DS-OV-002', 'hoanganh.duoc@example.local', pharmacyDepartmentId],
    ['ds.thanhtruc', 'Dược sĩ Phạm Thanh Trúc', 'DS-OV-003', 'thanhtruc.duoc@example.local', pharmacyDepartmentId],
    ['ds.quangvinh', 'Dược sĩ Võ Quang Vinh', 'DS-OV-004', 'quangvinh.duoc@example.local', pharmacyDepartmentId],
    ['ds.linhdan', 'Dược sĩ Nguyễn Linh Đan', 'DS-OV-005', 'linhdan.duoc@example.local', pharmacyDepartmentId],
    ['bs.kimngan', 'Bác sĩ Đỗ Kim Ngân', 'BS-OV-001', 'kimngan.noi@example.local', clinicalDepartments[0]],
    ['bs.minhnhat', 'Bác sĩ Lê Minh Nhật', 'BS-OV-002', 'minhnhat.nhi@example.local', clinicalDepartments[1]],
    ['bs.thanhson', 'Bác sĩ Trương Thanh Sơn', 'BS-OV-003', 'thanhson.tm@example.local', clinicalDepartments[2]],
    ['bs.haianh', 'Bác sĩ Vũ Hải Anh', 'BS-OV-004', 'haianh.cc@example.local', clinicalDepartments[3]],
    ['bs.baotran', 'Bác sĩ Nguyễn Bảo Trân', 'BS-OV-005', 'baotran.noi@example.local', clinicalDepartments[0]],
    ['bs.quocdat', 'Bác sĩ Huỳnh Quốc Đạt', 'BS-OV-006', 'quocdat.nhi@example.local', clinicalDepartments[1]],
    ['tn.phuongmai', 'Thu ngân Cao Phương Mai', 'TN-OV-001', 'phuongmai.thungan@example.local', pharmacyDepartmentId],
  ].forEach(([username, full_name, employee_code, email, department_id], index) => {
    docs.get('User').push(doc('User', username, {
      username,
      password_hash: passwordHash,
      full_name,
      employee_code,
      email,
      phone: `09${String(32000000 + index * 137).slice(-8)}`,
      department_id,
      status: 'active',
      must_change_password: false,
      auth_provider: 'local',
      email_verified: true,
    }, dt('2026-05-19', 6, 20 + index)));
  });

  const family = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Cao', 'Dương'];
  const middle = ['Minh', 'Thanh', 'Bảo', 'Khánh', 'Hoài', 'Ngọc', 'Gia', 'Thuỳ', 'Đức', 'Phương'];
  const given = [['An', 'female'], ['Bình', 'male'], ['Chi', 'female'], ['Duy', 'male'], ['Hạnh', 'female'], ['Khoa', 'male'], ['Lâm', 'male'], ['My', 'female'], ['Nhi', 'female'], ['Phúc', 'male'], ['Quân', 'male'], ['Trang', 'female'], ['Uyên', 'female'], ['Việt', 'male'], ['Yến', 'female'], ['Sơn', 'male']];
  const places = ['Hải Châu, Đà Nẵng', 'Thanh Khê, Đà Nẵng', 'Quận 10, TP. Hồ Chí Minh', 'Bình Thạnh, TP. Hồ Chí Minh', 'Ba Đình, Hà Nội', 'Cầu Giấy, Hà Nội', 'Buôn Ma Thuột, Đắk Lắk', 'Pleiku, Gia Lai', 'TP. Huế', 'Quy Nhơn, Bình Định'];
  indexes(DATES.length * PATIENTS_PER_DAY).forEach((index) => {
    const [givenName, gender] = given[index % given.length];
    const dateKey = DATES[Math.floor(index / PATIENTS_PER_DAY)];
    docs.get('Patient').push(doc('Patient', index, {
      patient_code: `BN-DUOC-${String(index + 1).padStart(4, '0')}`,
      full_name: `${family[index % family.length]} ${middle[(index + 4) % middle.length]} ${givenName}`,
      date_of_birth: new Date(`${1947 + ((index * 11) % 66)}-${String((index % 12) + 1).padStart(2, '0')}-${String((index * 3 % 27) + 1).padStart(2, '0')}T00:00:00.000+07:00`),
      gender,
      phone: `09${String(56000000 + index * 41).slice(-8)}`,
      address: `${18 + index} đường ${pick(['Nguyễn Văn Linh', 'Lê Duẩn', 'Kim Mã', 'Phan Chu Trinh', 'Tây Sơn'], index)}, ${places[index % places.length]}`,
      status: 'active',
    }, dt(dateKey, 7, index % 55)));
  });

  indexes(DATES.length * PATIENTS_PER_DAY).forEach((index) => {
    const dateKey = DATES[Math.floor(index / PATIENTS_PER_DAY)];
    docs.get('Encounter').push(doc('Encounter', index, {
      patient_id: id('Patient', index),
      department_id: clinicalDepartments[index % clinicalDepartments.length],
      attending_doctor_id: doctors[index % doctors.length],
      encounter_code: `LK-DUOC-${dateKey.replaceAll('-', '')}-${String((index % PATIENTS_PER_DAY) + 1).padStart(3, '0')}`,
      encounter_type: 'outpatient',
      start_time: dt(dateKey, 7 + (index % 9), (index * 7) % 60),
      chief_reason: pick(['Sốt và đau họng', 'Tái khám tăng huyết áp', 'Ho khan kéo dài', 'Đau dạ dày', 'Kiểm tra đường huyết', 'Dị ứng da'], index),
      status: index % 7 === 0 ? 'completed' : 'in_progress',
    }, dt(dateKey, 7 + (index % 9), (index * 7) % 60)));
  });

  indexes(MEDICATION_COUNT).forEach((index) => {
    const row = med(index);
    docs.get('MedicationMaster').push(doc('MedicationMaster', index, {
      medication_code: `DUOC-${row[0]}`,
      generic_name: row[1],
      brand_name: row[2],
      dosage_form: row[3],
      strength: row[4],
      route_default: row[5],
      unit: row[6],
      sale_price: row[7],
      min_stock_level: row[8],
      high_alert_medication: index % 17 === 0,
      status: index % 29 === 0 ? 'inactive' : 'active',
    }, dt('2026-05-19', 6, index % 60)));
  });

  indexes(BATCH_COUNT).forEach((index) => {
    let quantity = 220 + (index % 8) * 35;
    let status = 'available';
    let expiry = dt('2027-03-10', 0, 0);
    if (index < 18) quantity = 12 + (index % 4) * 5;
    if (index >= 18 && index < 28) {
      quantity = 0;
      status = 'depleted';
    }
    if (index >= 28 && index < 45) expiry = dt('2026-06-05', 0, index % 50);
    if (index >= 45 && index < 52) {
      expiry = dt('2026-05-10', 0, index % 50);
      status = 'expired';
      quantity = 20 + index;
    }
    if (index >= 52 && index < 59) {
      status = 'recalled';
      quantity = 18 + index;
    }
    docs.get('StockBatch').push(doc('StockBatch', index, {
      medication_id: id('MedicationMaster', index % MEDICATION_COUNT),
      batch_no: `LOT-DUOC-${String(index + 1).padStart(4, '0')}`,
      lot_no: `VN26-${String(9000 + index)}`,
      supplier_name: pick(['Công ty Dược Hậu Giang', 'Traphaco', 'Imexpharm', 'Pymepharco', 'Bidiphar', 'Sanofi Việt Nam'], index),
      manufacture_date: dt('2025-09-01'),
      expiry_date: expiry,
      received_date: dt('2026-05-19', 7, index % 55),
      quantity_received: Math.max(quantity, 120),
      quantity_on_hand: quantity,
      unit_cost: 800 + (index % 18) * 950,
      min_stock_level: index < 18 ? 80 : 30 + (index % 6) * 10,
      storage_location: pick(['Kho chính A1', 'Kho chính A2', 'Tủ cấp phát B1', 'Khu lạnh C1', 'Khu cách ly Q1'], index),
      status,
      recalled_by: status === 'recalled' ? pharmacists[index % pharmacists.length] : undefined,
      recalled_at: status === 'recalled' ? dt('2026-05-20', 9, index) : undefined,
      recall_reason: status === 'recalled' ? 'Thông báo thu hồi nội bộ do nghi ngờ sai nhãn lô.' : undefined,
    }, dt('2026-05-19', 7, index % 55)));
  });

  const prescriptionStatuses = ['draft', 'active', 'verified', 'partially_dispensed', 'fully_dispensed', 'completed', 'cancelled', 'draft'];
  DATES.forEach((dateKey, dateIndex) => {
    indexes(PRESCRIPTIONS_PER_DAY).forEach((index) => {
      const global = dateIndex * PRESCRIPTIONS_PER_DAY + index;
      const patientIndex = dateIndex * PATIENTS_PER_DAY + index;
      const status = prescriptionStatuses[index % prescriptionStatuses.length];
      const at = dt(dateKey, 8 + Math.floor(index / 6), (index * 9) % 60);
      docs.get('Prescription').push(doc('Prescription', global, {
        patient_id: id('Patient', patientIndex),
        encounter_id: id('Encounter', patientIndex),
        prescribed_by: doctors[index % doctors.length],
        prescription_no: `RX-DUOC-${dateKey.replaceAll('-', '')}-${String(index + 1).padStart(3, '0')}`,
        prescribed_at: at,
        verified_by: ['verified', 'partially_dispensed', 'fully_dispensed', 'completed'].includes(status) ? pharmacists[index % pharmacists.length] : undefined,
        verified_at: ['verified', 'partially_dispensed', 'fully_dispensed', 'completed'].includes(status) ? addMinutes(at, 18) : undefined,
        completed_by: ['fully_dispensed', 'completed'].includes(status) ? pharmacists[index % pharmacists.length] : undefined,
        completed_at: ['fully_dispensed', 'completed'].includes(status) ? addMinutes(at, 95) : undefined,
        cancelled_by: status === 'cancelled' ? pharmacists[index % pharmacists.length] : undefined,
        cancelled_at: status === 'cancelled' ? addMinutes(at, 40) : undefined,
        cancel_reason: status === 'cancelled' ? 'Bác sĩ đổi phác đồ sau khi dược sĩ xác minh liều dùng.' : undefined,
        status,
        note: pick(['Kiểm tra dị ứng thuốc trước khi cấp.', 'Hướng dẫn bệnh nhân uống sau ăn.', 'Xác nhận tồn kho trước khi cấp phát.', 'Cần bác sĩ xác minh liều dùng nếu bệnh nhân chóng mặt.'], index),
      }, at));
      indexes(3).forEach((offset) => {
        const medIndex = (global * 3 + offset) % MEDICATION_COUNT;
        const qty = 8 + ((index + offset) % 5) * 4;
        docs.get('PrescriptionItem').push(doc('PrescriptionItem', `${global}:${offset}`, {
          prescription_id: id('Prescription', global),
          medication_id: id('MedicationMaster', medIndex),
          dose: pick(['1 viên', '2 viên', '1 gói', '5 ml', '1 nhát xịt'], medIndex),
          frequency: pick(['ngày 2 lần', 'ngày 3 lần sau ăn', 'mỗi 6 giờ khi sốt', 'mỗi sáng', 'trước ăn tối'], medIndex),
          route: med(medIndex)[5],
          duration_days: 3 + ((index + offset) % 7),
          quantity: qty,
          unit: med(medIndex)[6],
          dispensed_quantity: ['fully_dispensed', 'completed'].includes(status) ? qty : status === 'partially_dispensed' ? Math.floor(qty / 2) : 0,
          instructions: pick(['Uống sau ăn, không tự ý tăng liều.', 'Uống đủ liệu trình theo đơn.', 'Dùng khi sốt trên 38.5 độ C.', 'Theo dõi dấu hiệu dị ứng trong 24 giờ đầu.', 'Bảo quản nơi khô mát.'], medIndex),
          status: ['fully_dispensed', 'completed'].includes(status) ? 'completed' : status === 'cancelled' ? 'cancelled' : 'active',
        }, at));
      });
    });

    indexes(DISPENSES_PER_DAY).forEach((index) => {
      const global = dateIndex * DISPENSES_PER_DAY + index;
      const prescriptionIndex = dateIndex * PRESCRIPTIONS_PER_DAY + index;
      const patientIndex = dateIndex * PATIENTS_PER_DAY + index;
      const at = dt(dateKey, 9 + Math.floor(index / 5), (index * 11) % 60);
      const status = pick(['draft', 'partially_dispensed', 'dispensed', 'cancelled', 'draft', 'dispensed'], index);
      docs.get('Dispense').push(doc('Dispense', global, {
        prescription_id: id('Prescription', prescriptionIndex),
        patient_id: id('Patient', patientIndex),
        encounter_id: id('Encounter', patientIndex),
        dispense_no: `DSP-DUOC-${dateKey.replaceAll('-', '')}-${String(index + 1).padStart(3, '0')}`,
        dispensed_by: ['dispensed', 'partially_dispensed'].includes(status) ? pharmacists[index % pharmacists.length] : undefined,
        dispensed_at: status === 'dispensed' ? addMinutes(at, 55) : undefined,
        completed_by: status === 'dispensed' ? pharmacists[index % pharmacists.length] : undefined,
        completed_at: status === 'dispensed' ? addMinutes(at, 60) : undefined,
        cancelled_by: status === 'cancelled' ? pharmacists[index % pharmacists.length] : undefined,
        cancelled_at: status === 'cancelled' ? addMinutes(at, 30) : undefined,
        cancel_reason: status === 'cancelled' ? 'Tạm hủy do thiếu lô phù hợp, chờ bác sĩ đổi thuốc.' : undefined,
        assigned_to: pharmacists[index % pharmacists.length],
        assigned_at: addMinutes(at, 5),
        preparation_started_at: ['draft', 'partially_dispensed', 'dispensed'].includes(status) ? addMinutes(at, 12) : undefined,
        preparation_completed_at: ['partially_dispensed', 'dispensed'].includes(status) ? addMinutes(at, 38) : undefined,
        workflow_stage: status === 'dispensed' ? 'ready_to_handover' : status === 'cancelled' ? 'blocked' : pick(['assigned', 'picking', 'checking'], index),
        priority: pick(['critical', 'high', 'medium', 'low'], index),
        sla_due_at: addMinutes(at, 45),
        checklist_status: status === 'dispensed' ? 'completed' : 'pending',
        status,
        note: pick(['Đang soạn thuốc theo đơn.', 'Đã dặn bệnh nhân kiểm tra nhãn thuốc.', 'Cần xác nhận tương tác trước khi giao.', 'Bệnh nhân chờ nhận tại quầy số 2.'], index),
      }, at));
      indexes(2).forEach((offset) => {
        const medIndex = (prescriptionIndex * 3 + offset) % MEDICATION_COUNT;
        docs.get('DispenseItem').push(doc('DispenseItem', `${global}:${offset}`, {
          dispense_id: id('Dispense', global),
          prescription_item_id: id('PrescriptionItem', `${prescriptionIndex}:${offset}`),
          medication_id: id('MedicationMaster', medIndex),
          stock_batch_id: id('StockBatch', medIndex % BATCH_COUNT),
          quantity: 6 + ((index + offset) % 4) * 3,
          unit: med(medIndex)[6],
          instructions: 'Cấp phát theo đơn, hướng dẫn dùng thuốc trực tiếp tại quầy.',
          status: status === 'dispensed' ? 'dispensed' : status === 'cancelled' ? 'cancelled' : 'planned',
        }, at));
      });
    });

    indexes(TX_PER_DAY).forEach((index) => {
      const global = dateIndex * TX_PER_DAY + index;
      const type = pick(['receipt', 'dispense', 'adjustment', 'return', 'transfer', 'waste', 'expire', 'recall'], index);
      const direction = ['receipt', 'return'].includes(type) || (type === 'adjustment' && index % 2 === 0) ? 'in' : 'out';
      const at = dt(dateKey, 7 + Math.floor(index / 5), (index * 7) % 60);
      docs.get('InventoryTransaction').push(doc('InventoryTransaction', global, {
        medication_id: id('MedicationMaster', global % MEDICATION_COUNT),
        stock_batch_id: id('StockBatch', global % BATCH_COUNT),
        transaction_no: `KHO-DUOC-${dateKey.replaceAll('-', '')}-${String(index + 1).padStart(3, '0')}`,
        transaction_type: type,
        direction,
        quantity: 5 + (index % 9) * 3,
        balance_before: 100 + index,
        balance_after: direction === 'in' ? 105 + index : Math.max(0, 95 + index),
        unit_cost: 900 + (index % 12) * 1200,
        reference_type: type === 'dispense' ? 'dispense' : `demo_${type}`,
        reference_id: type === 'dispense' ? id('Dispense', dateIndex * DISPENSES_PER_DAY + (index % DISPENSES_PER_DAY)) : id('StockBatch', global % BATCH_COUNT),
        performed_by: pharmacists[index % pharmacists.length],
        occurred_at: at,
        note: pick(['Nhập kho theo hóa đơn nhà cung cấp.', 'Xuất cấp phát cho bệnh nhân ngoại trú.', 'Điều chỉnh sau kiểm đếm cuối ca.', 'Hoàn trả thuốc còn nguyên vỉ.', 'Hủy lô gần hết hạn theo quy trình.'], index),
      }, at));
    });

    indexes(12).forEach((index) => {
      const global = dateIndex * 12 + index;
      const alertType = pick(['low_stock', 'out_of_stock', 'near_expiry', 'expired', 'recalled', 'interaction', 'allergy', 'verification_sla_breached'], index);
      const at = dt(dateKey, 8 + (index % 9), (index * 13) % 60);
      docs.get('PharmacyAlert').push(doc('PharmacyAlert', global, {
        alert_code: `PAL-DUOC-${dateKey.replaceAll('-', '')}-${String(index + 1).padStart(3, '0')}`,
        alert_type: alertType,
        severity: pick(['critical', 'high', 'medium', 'low'], index),
        status: pick(['open', 'acknowledged', 'assigned', 'in_progress', 'new'], index),
        source_type: ['low_stock', 'out_of_stock', 'near_expiry', 'expired', 'recalled'].includes(alertType) ? 'stock_batch' : 'prescription',
        source_module: 'pharmacy_overview_seed',
        source_id: ['low_stock', 'out_of_stock', 'near_expiry', 'expired', 'recalled'].includes(alertType) ? id('StockBatch', global % BATCH_COUNT) : id('Prescription', dateIndex * PRESCRIPTIONS_PER_DAY + (index % PRESCRIPTIONS_PER_DAY)),
        medication_id: id('MedicationMaster', global % MEDICATION_COUNT),
        stock_batch_id: id('StockBatch', global % BATCH_COUNT),
        prescription_id: id('Prescription', dateIndex * PRESCRIPTIONS_PER_DAY + (index % PRESCRIPTIONS_PER_DAY)),
        patient_id: id('Patient', dateIndex * PATIENTS_PER_DAY + index),
        title: pick(['Thuốc dưới ngưỡng tồn tối thiểu', 'Lô thuốc sắp hết hạn', 'Đơn thuốc cần xác minh tương tác', 'Bệnh nhân có tiền sử dị ứng thuốc', 'Lô thuốc đã hết hàng', 'Cần ưu tiên soạn thuốc gấp'], index),
        message: pick(['Cần kiểm tra và tạo đề nghị nhập bổ sung trong ca hôm nay.', 'Ưu tiên xuất trước theo FEFO và thông báo điều dưỡng.', 'Dược sĩ cần rà soát trước khi xác minh đơn.', 'Trao đổi lại với bác sĩ nếu bệnh nhân có phản ứng bất lợi.', 'Không còn lô khả dụng để cấp phát.', 'Đơn ưu tiên cao đang chờ tại quầy.'], index),
        detected_at: at,
        due_at: addMinutes(at, 45),
        dedupe_key: `pharmacy-overview:${dateKey}:${index}`,
        assigned_to: pharmacists[index % pharmacists.length],
        metrics: { quantity_on_hand: 12 + index, min_stock_level: 80, days_to_expiry: 5 + index },
        metadata: { demoCode: 'pharmacy-overview-coverage', dateKey },
      }, at));
    });

    indexes(20).forEach((index) => {
      const global = dateIndex * 20 + index;
      const at = dt(dateKey, 8 + (index % 9), (index * 5) % 60);
      docs.get('PharmacyWorkItem').push(doc('PharmacyWorkItem', global, {
        work_item_code: `PWI-DUOC-${dateKey.replaceAll('-', '')}-${String(index + 1).padStart(3, '0')}`,
        type: pick(['prescription_verification', 'clinical_review', 'dispense_waiting', 'dispense_preparing', 'stock_shortage', 'near_expiry_batch', 'expired_batch'], index),
        priority: pick(['critical', 'high', 'medium', 'low'], index),
        status: pick(['open', 'assigned', 'in_progress', 'on_hold', 'resolved'], index),
        source_type: index % 3 === 0 ? 'prescription' : 'stock_batch',
        source_id: index % 3 === 0 ? id('Prescription', dateIndex * PRESCRIPTIONS_PER_DAY + (index % PRESCRIPTIONS_PER_DAY)) : id('StockBatch', global % BATCH_COUNT),
        patient_id: id('Patient', dateIndex * PATIENTS_PER_DAY + (index % PATIENTS_PER_DAY)),
        prescription_id: id('Prescription', dateIndex * PRESCRIPTIONS_PER_DAY + (index % PRESCRIPTIONS_PER_DAY)),
        dispense_id: id('Dispense', dateIndex * DISPENSES_PER_DAY + (index % DISPENSES_PER_DAY)),
        medication_id: id('MedicationMaster', global % MEDICATION_COUNT),
        stock_batch_id: id('StockBatch', global % BATCH_COUNT),
        assigned_to: pharmacists[index % pharmacists.length],
        assigned_at: addMinutes(at, 5),
        due_at: addMinutes(at, 60),
        sla_minutes: 60,
        title: pick(['Kiểm tra đơn thuốc mới', 'Soạn thuốc cho bệnh nhân chờ nhận', 'Xác nhận tương tác thuốc', 'Gọi bệnh nhân nhận thuốc', 'Cập nhật tồn kho sau cấp phát', 'Kiểm tra lô sắp hết hạn'], index),
        description: 'Tác vụ vận hành nhà thuốc được seed để Pharmacy Overview hiển thị worklist đầy đủ.',
        risk_flags: { allergy: index % 7 === 0, interaction: index % 5 === 0, insufficient_stock: index % 6 === 0, near_expiry: index % 4 === 0 },
        metadata: { demoCode: 'pharmacy-overview-coverage', dateKey },
      }, at));
    });

    indexes(12).forEach((index) => {
      const global = dateIndex * 12 + index;
      const at = dt(dateKey, 8 + (index % 9), (index * 4) % 60);
      docs.get('Notification').push(doc('Notification', global, {
        recipient_type: 'staff',
        recipient_id: pharmacists[index % pharmacists.length],
        recipient_actor_type: 'staff',
        recipient_actor_id: pharmacists[index % pharmacists.length],
        recipient_user_id: pharmacists[index % pharmacists.length],
        channel: 'in_app',
        notification_type: pick(['prescription_new', 'stock_low', 'near_expiry', 'dispense_ready', 'purchase_request_approved'], index),
        event_type: pick(['pharmacy.prescription.new', 'pharmacy.stock.low', 'pharmacy.batch.near_expiry', 'pharmacy.dispense.ready'], index),
        priority: pick(['normal', 'high', 'critical', 'low'], index),
        dedupe_key: `notification:pharmacy-overview:${dateKey}:${index}`,
        title: pick(['Đơn thuốc mới cần xác minh', 'Thuốc sắp hết tại kho chính', 'Lô thuốc sắp hết hạn', 'Phiếu cấp phát đã sẵn sàng', 'Yêu cầu nhập kho được duyệt'], index),
        message: pick(['Có đơn thuốc mới từ bác sĩ cần dược sĩ kiểm tra.', 'Một số thuốc đã dưới ngưỡng tồn tối thiểu.', 'Lô thuốc cần ưu tiên xuất trước trong 30 ngày tới.', 'Bệnh nhân có thể nhận thuốc tại quầy.', 'Vui lòng kiểm tra kế hoạch nhập bổ sung.'], index),
        data: { demoCode: 'pharmacy-overview-coverage', dateKey },
        action_url: '/pharmacy/overview',
        created_by_module: 'pharmacy_overview_seed',
        sent_at: at,
        delivered_at: addMinutes(at, 1),
        status: pick(['sent', 'delivered', 'queued'], index),
      }, at));
    });

    indexes(8).forEach((index) => {
      const global = dateIndex * 8 + index;
      const patientIndex = dateIndex * PATIENTS_PER_DAY + index;
      const amount = 85000 + (index % 6) * 22000;
      const at = dt(dateKey, 10 + (index % 6), (index * 6) % 60);
      docs.get('Invoice').push(doc('Invoice', global, {
        patient_id: id('Patient', patientIndex),
        encounter_id: id('Encounter', patientIndex),
        invoice_no: `INV-DUOC-${dateKey.replaceAll('-', '')}-${String(index + 1).padStart(3, '0')}`,
        subtotal_amount: amount,
        discount_amount: 0,
        tax_amount: 0,
        insurance_amount: index % 3 === 0 ? 20000 : 0,
        total_amount: amount,
        paid_amount: index % 2 === 0 ? amount : Math.floor(amount / 2),
        balance_due: index % 2 === 0 ? 0 : amount - Math.floor(amount / 2),
        currency: 'VND',
        issued_at: at,
        issued_by: cashier,
        due_at: addDays(at, 7),
        status: index % 2 === 0 ? 'paid' : 'partially_paid',
      }, at));
      docs.get('Payment').push(doc('Payment', global, {
        invoice_id: id('Invoice', global),
        patient_id: id('Patient', patientIndex),
        payment_no: `PAY-DUOC-${dateKey.replaceAll('-', '')}-${String(index + 1).padStart(3, '0')}`,
        amount: index % 2 === 0 ? amount : Math.floor(amount / 2),
        currency: 'VND',
        payment_method: pick(['cash', 'qr', 'card', 'bank_transfer'], index),
        transaction_reference: `DUOC${dateKey.replaceAll('-', '')}${String(index + 1).padStart(3, '0')}`,
        paid_at: addMinutes(at, 8),
        received_by: cashier,
        confirmed_by: cashier,
        confirmed_at: addMinutes(at, 9),
        status: 'completed',
        note: 'Thanh toán thuốc ngoại trú tại quầy nhà thuốc.',
      }, addMinutes(at, 8)));
      docs.get('Charge').push(doc('Charge', global, {
        patient_id: id('Patient', patientIndex),
        encounter_id: id('Encounter', patientIndex),
        source_module: 'pharmacy',
        source_id: id('Dispense', dateIndex * DISPENSES_PER_DAY + (index % DISPENSES_PER_DAY)),
        dispense_id: id('Dispense', dateIndex * DISPENSES_PER_DAY + (index % DISPENSES_PER_DAY)),
        medication_id: id('MedicationMaster', global % MEDICATION_COUNT),
        invoice_id: id('Invoice', global),
        charge_no: `CHG-DUOC-${dateKey.replaceAll('-', '')}-${String(index + 1).padStart(3, '0')}`,
        description: 'Chi phí thuốc ngoại trú theo đơn',
        quantity: 1,
        unit_price: amount,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: amount,
        charged_at: at,
        posted_by: cashier,
        posted_at: at,
        status: 'billed',
      }, at));
    });
  });

  return docs;
}

async function validate(docsByModel) {
  const errors = [];
  for (const [modelName, rows] of docsByModel.entries()) {
    for (const row of rows) {
      try {
        await new models[modelName](row).validate();
      } catch (error) {
        errors.push(`${modelName}/${row._id}: ${error.message}`);
      }
    }
  }
  if (errors.length) throw new Error(`Pharmacy Overview coverage validation failed:\n- ${errors.join('\n- ')}`);
}

async function cleanup() {
  const userNames = ['ds.minhchau', 'ds.hoanganh', 'ds.thanhtruc', 'ds.quangvinh', 'ds.linhdan', 'bs.kimngan', 'bs.minhnhat', 'bs.thanhson', 'bs.haianh', 'bs.baotran', 'bs.quocdat', 'tn.phuongmai'];
  await Promise.all([
    models.PrescriptionItem.deleteMany({ prescription_id: { $in: indexes(DATES.length * PRESCRIPTIONS_PER_DAY).map((index) => id('Prescription', index)) } }),
    models.DispenseItem.deleteMany({ dispense_id: { $in: indexes(DATES.length * DISPENSES_PER_DAY).map((index) => id('Dispense', index)) } }),
    models.Charge.deleteMany({ charge_no: /^CHG-DUOC-/ }),
    models.Payment.deleteMany({ payment_no: /^PAY-DUOC-/ }),
    models.Invoice.deleteMany({ invoice_no: /^INV-DUOC-/ }),
    models.Notification.deleteMany({ created_by_module: 'pharmacy_overview_seed' }),
    models.PharmacyWorkItem.deleteMany({ 'metadata.demoCode': 'pharmacy-overview-coverage' }),
    models.PharmacyAlert.deleteMany({ 'metadata.demoCode': 'pharmacy-overview-coverage' }),
    models.InventoryTransaction.deleteMany({ transaction_no: /^KHO-DUOC-/ }),
    models.Dispense.deleteMany({ dispense_no: /^DSP-DUOC-/ }),
    models.Prescription.deleteMany({ prescription_no: /^RX-DUOC-/ }),
    models.StockBatch.deleteMany({ batch_no: /^LOT-DUOC-/ }),
    models.MedicationMaster.deleteMany({ medication_code: /^DUOC-/ }),
    models.Encounter.deleteMany({ encounter_code: /^LK-DUOC-/ }),
    models.Patient.deleteMany({ patient_code: /^BN-DUOC-/ }),
    models.UserRole.deleteMany({ user_id: { $in: userNames.map((name) => id('User', name)) } }),
    models.User.deleteMany({ username: { $in: userNames } }),
    models.Department.deleteMany({ department_code: { $in: ['DUOC-OVERVIEW', 'NOI-OVERVIEW', 'NHI-OVERVIEW', 'TM-OVERVIEW', 'CC-OVERVIEW'] } }),
  ]);
}

async function upsert(docsByModel) {
  await cleanup();
  const summary = [];
  for (const [modelName, rows] of docsByModel.entries()) {
    if (!rows.length) continue;
    const Model = models[modelName];
    const result = await Model.bulkWrite(rows.map((row) => {
      const { _id, created_at: createdAt, ...set } = row;
      return {
        updateOne: {
          filter: { _id },
          update: { $set: set, $setOnInsert: { _id, created_at: createdAt || new Date() } },
          upsert: true,
        },
      };
    }), { ordered: false, timestamps: false });
    summary.push({
      model: `${modelName}(pharmacy overview)`,
      collection: Model.collection.name,
      requested: rows.length,
      seeded: await Model.countDocuments({ _id: { $in: rows.map((row) => row._id) } }),
      upserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
    });
  }
  return summary;
}

async function ensureRoles() {
  const [pharmacistRole, cashierRole] = await Promise.all([
    models.Role.findOne({ role_code: 'pharmacist', status: 'active', is_deleted: false }).lean(),
    models.Role.findOne({ role_code: 'cashier', status: 'active', is_deleted: false }).lean(),
  ]);
  if (!pharmacistRole) throw new Error('Role pharmacist chưa tồn tại sau bootstrapSystemAccess.');
  const pairs = [
    ...['ds.minhchau', 'ds.hoanganh', 'ds.thanhtruc', 'ds.quangvinh', 'ds.linhdan'].map((key) => [id('User', key), pharmacistRole._id]),
    ...(cashierRole ? [[id('User', 'tn.phuongmai'), cashierRole._id]] : []),
  ];
  const result = await models.UserRole.bulkWrite(pairs.map(([userId, roleId]) => ({
    updateOne: {
      filter: { user_id: userId, role_id: roleId },
      update: {
        $set: { is_active: true, updated_at: new Date(), updated_by: id('User', 'ds.minhchau') },
        $setOnInsert: { user_id: userId, role_id: roleId, created_at: new Date(), created_by: id('User', 'ds.minhchau') },
      },
      upsert: true,
    },
  })), { ordered: false });
  return {
    model: 'UserRole(pharmacy overview)',
    collection: models.UserRole.collection.name,
    requested: pairs.length,
    seeded: await models.UserRole.countDocuments({ user_id: { $in: pairs.map(([userId]) => userId) }, is_active: true }),
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
  };
}

async function verify() {
  const rows = [];
  for (const dateKey of DATES) {
    const start = dt(dateKey, 0, 0);
    const end = dt(dateKey, 23, 59);
    end.setSeconds(59, 999);
    rows.push({
      date: dateKey,
      prescriptions: await models.Prescription.countDocuments({ prescription_no: /^RX-DUOC-/, prescribed_at: { $gte: start, $lte: end } }),
      pending: await models.Prescription.countDocuments({ prescription_no: /^RX-DUOC-/, status: { $in: ['draft', 'active'] }, prescribed_at: { $gte: start, $lte: end } }),
      ready: await models.Prescription.countDocuments({ prescription_no: /^RX-DUOC-/, status: 'verified', prescribed_at: { $gte: start, $lte: end } }),
      preparing: await models.Prescription.countDocuments({ prescription_no: /^RX-DUOC-/, status: 'partially_dispensed', prescribed_at: { $gte: start, $lte: end } }),
      dispensed: await models.Prescription.countDocuments({ prescription_no: /^RX-DUOC-/, status: { $in: ['fully_dispensed', 'completed'] }, prescribed_at: { $gte: start, $lte: end } }),
      cancelled: await models.Prescription.countDocuments({ prescription_no: /^RX-DUOC-/, status: 'cancelled', prescribed_at: { $gte: start, $lte: end } }),
      dispenses: await models.Dispense.countDocuments({ dispense_no: /^DSP-DUOC-/, created_at: { $gte: start, $lte: end } }),
      stock_movements: await models.InventoryTransaction.countDocuments({ transaction_no: /^KHO-DUOC-/, occurred_at: { $gte: start, $lte: end } }),
      alerts: await models.PharmacyAlert.countDocuments({ 'metadata.demoCode': 'pharmacy-overview-coverage', created_at: { $gte: start, $lte: end } }),
      notifications: await models.Notification.countDocuments({ created_by_module: 'pharmacy_overview_seed', created_at: { $gte: start, $lte: end } }),
    });
  }
  const summary = {
    medications: await models.MedicationMaster.countDocuments({ medication_code: /^DUOC-/ }),
    stock_batches: await models.StockBatch.countDocuments({ batch_no: /^LOT-DUOC-/ }),
    low_stock_batches: await models.StockBatch.countDocuments({ batch_no: /^LOT-DUOC-/, quantity_on_hand: { $gt: 0 }, $expr: { $lte: ['$quantity_on_hand', '$min_stock_level'] } }),
    depleted_batches: await models.StockBatch.countDocuments({ batch_no: /^LOT-DUOC-/, $or: [{ status: 'depleted' }, { quantity_on_hand: 0 }] }),
    near_expiry_batches: await models.StockBatch.countDocuments({ batch_no: /^LOT-DUOC-/, quantity_on_hand: { $gt: 0 }, expiry_date: { $gte: new Date(), $lte: new Date(Date.now() + 30 * 86400000) } }),
    expired_batches: await models.StockBatch.countDocuments({ batch_no: /^LOT-DUOC-/, $or: [{ status: 'expired' }, { expiry_date: { $lt: new Date() } }] }),
    recalled_batches: await models.StockBatch.countDocuments({ batch_no: /^LOT-DUOC-/, status: 'recalled' }),
    unread_notifications: await models.Notification.countDocuments({ recipient_user_id: id('User', 'ds.minhchau'), status: { $in: ['queued', 'sent', 'delivered'] }, read_at: null }),
  };
  console.table(rows);
  console.table([summary]);
  const missing = rows.flatMap((row) => Object.entries(row).filter(([key, value]) => key !== 'date' && Number(value) < 5).map(([key, value]) => `${row.date}:${key}=${value}`));
  const missingSummary = Object.entries(summary).filter(([, value]) => Number(value) < 5).map(([key, value]) => `${key}=${value}`);
  if (missing.length || missingSummary.length) {
    throw new Error(`Pharmacy Overview coverage chưa đủ dữ liệu: ${[...missing, ...missingSummary].join(', ')}`);
  }
  return { rows, summary };
}

function summaryRows(docsByModel) {
  return [...docsByModel.entries()].map(([modelName, rows]) => ({
    model: `${modelName}(pharmacy overview)`,
    collection: models[modelName].collection.name,
    requested: rows.length,
    seeded: rows.length,
  }));
}

module.exports = {
  build,
  validate,
  upsert,
  ensureRoles,
  verify,
  summaryRows,
  id,
};
