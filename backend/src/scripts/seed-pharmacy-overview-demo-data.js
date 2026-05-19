const { connectDatabase, mongoose } = require('../config/database');
require('../models');

const {
  Department,
  Dispense,
  DispenseItem,
  Encounter,
  InventoryTransaction,
  MedicationMaster,
  Patient,
  PharmacyAlert,
  PharmacyWorkItem,
  Prescription,
  PrescriptionItem,
  StockBatch,
  User,
} = require('../models');
const {
  DEPARTMENT_STATUS,
  DISPENSE_ITEM_STATUS,
  DISPENSE_STATUS,
  ENCOUNTER_STATUS,
  ENCOUNTER_TYPE,
  INVENTORY_TRANSACTION_DIRECTION,
  INVENTORY_TRANSACTION_TYPE,
  MEDICATION_STATUS,
  PATIENT_STATUS,
  PRESCRIPTION_ITEM_STATUS,
  PRESCRIPTION_STATUS,
  STOCK_BATCH_STATUS,
  USER_STATUS,
} = require('../constants/statuses');

function daysFromNow(days) {
  return new Date(Date.now() + days * 86400000);
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60000);
}

async function upsertBy(Model, filter, insert, update = {}) {
  const insertOnly = { ...insert };
  for (const field of Object.keys(update)) {
    delete insertOnly[field];
  }

  return Model.findOneAndUpdate(
    filter,
    {
      $setOnInsert: insertOnly,
      ...(Object.keys(update).length ? { $set: update } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function seedReferenceData() {
  const department = await upsertBy(Department, { department_code: 'PHARM-DEMO' }, {
    department_code: 'PHARM-DEMO',
    department_name: 'Khoa Dược Demo',
    department_type: 'pharmacy',
    status: DEPARTMENT_STATUS.ACTIVE,
  });

  const pharmacist = await upsertBy(User, { username: 'pharmacy.overview.demo' }, {
    username: 'pharmacy.overview.demo',
    password_hash: '$2a$10$CwTycUXWue0Thq9StjUM0uJ8/H8VxSlyYNI5UBKtfUTbFDltbIvy',
    full_name: 'Dược sĩ Demo',
    employee_code: 'PHARM-DEMO-01',
    email: 'pharmacy.demo@example.local',
    department_id: department._id,
    status: USER_STATUS.ACTIVE,
  }, {
    department_id: department._id,
    status: USER_STATUS.ACTIVE,
  });

  const doctor = await upsertBy(User, { username: 'doctor.pharmacy.demo' }, {
    username: 'doctor.pharmacy.demo',
    password_hash: '$2a$10$CwTycUXWue0Thq9StjUM0uJ8/H8VxSlyYNI5UBKtfUTbFDltbIvy',
    full_name: 'Bác sĩ Demo',
    employee_code: 'DOC-PHARM-DEMO-01',
    email: 'doctor.pharmacy.demo@example.local',
    department_id: department._id,
    status: USER_STATUS.ACTIVE,
  }, {
    department_id: department._id,
    status: USER_STATUS.ACTIVE,
  });

  const patients = await Promise.all([
    upsertBy(Patient, { patient_code: 'PHARM-PAT-001' }, {
      patient_code: 'PHARM-PAT-001',
      full_name: 'Nguyễn Minh An',
      date_of_birth: new Date('1988-04-12T00:00:00.000Z'),
      gender: 'male',
      phone: '0901000001',
      status: PATIENT_STATUS.ACTIVE,
    }),
    upsertBy(Patient, { patient_code: 'PHARM-PAT-002' }, {
      patient_code: 'PHARM-PAT-002',
      full_name: 'Trần Thảo Vy',
      date_of_birth: new Date('1995-09-20T00:00:00.000Z'),
      gender: 'female',
      phone: '0901000002',
      status: PATIENT_STATUS.ACTIVE,
    }),
    upsertBy(Patient, { patient_code: 'PHARM-PAT-003' }, {
      patient_code: 'PHARM-PAT-003',
      full_name: 'Lê Hoàng Nam',
      date_of_birth: new Date('1979-01-05T00:00:00.000Z'),
      gender: 'male',
      phone: '0901000003',
      status: PATIENT_STATUS.ACTIVE,
    }),
  ]);

  const encounters = await Promise.all(patients.map((patient, index) => upsertBy(Encounter, {
    encounter_code: `PHARM-ENC-${String(index + 1).padStart(3, '0')}`,
  }, {
    patient_id: patient._id,
    department_id: department._id,
    attending_doctor_id: doctor._id,
    encounter_code: `PHARM-ENC-${String(index + 1).padStart(3, '0')}`,
    encounter_type: ENCOUNTER_TYPE.OUTPATIENT,
    start_time: minutesAgo(180 - index * 35),
    status: ENCOUNTER_STATUS.IN_PROGRESS,
  }, {
    patient_id: patient._id,
    department_id: department._id,
    attending_doctor_id: doctor._id,
  })));

  return { department, pharmacist, doctor, patients, encounters };
}

async function seedInventory(pharmacist) {
  const medications = await Promise.all([
    upsertBy(MedicationMaster, { medication_code: 'MED-DEMO-PARA500' }, {
      medication_code: 'MED-DEMO-PARA500',
      generic_name: 'Paracetamol',
      brand_name: 'ParaCare 500',
      dosage_form: 'tablet',
      strength: '500mg',
      route_default: 'oral',
      unit: 'viên',
      sale_price: 1200,
      min_stock_level: 100,
      status: MEDICATION_STATUS.ACTIVE,
    }, { status: MEDICATION_STATUS.ACTIVE }),
    upsertBy(MedicationMaster, { medication_code: 'MED-DEMO-AMOX500' }, {
      medication_code: 'MED-DEMO-AMOX500',
      generic_name: 'Amoxicillin',
      brand_name: 'AmoxiCare',
      dosage_form: 'capsule',
      strength: '500mg',
      route_default: 'oral',
      unit: 'viên',
      sale_price: 2500,
      min_stock_level: 80,
      status: MEDICATION_STATUS.ACTIVE,
    }, { status: MEDICATION_STATUS.ACTIVE }),
    upsertBy(MedicationMaster, { medication_code: 'MED-DEMO-ORS' }, {
      medication_code: 'MED-DEMO-ORS',
      generic_name: 'Oral rehydration salts',
      brand_name: 'Oresol Demo',
      dosage_form: 'sachet',
      strength: '27.9g',
      route_default: 'oral',
      unit: 'gói',
      sale_price: 1800,
      min_stock_level: 50,
      status: MEDICATION_STATUS.ACTIVE,
    }, { status: MEDICATION_STATUS.ACTIVE }),
  ]);

  const [paracetamol, amoxicillin, oresol] = medications;
  const batches = await Promise.all([
    upsertBy(StockBatch, { medication_id: paracetamol._id, batch_no: 'LOT-PARA-LOW-001' }, {
      medication_id: paracetamol._id,
      batch_no: 'LOT-PARA-LOW-001',
      supplier_name: 'Demo Pharma Supplier',
      manufacture_date: daysFromNow(-120),
      expiry_date: daysFromNow(240),
      received_date: daysFromNow(-90),
      quantity_received: 120,
      quantity_on_hand: 35,
      unit_cost: 800,
      min_stock_level: 100,
      storage_location: 'Kho chính A1',
      status: STOCK_BATCH_STATUS.AVAILABLE,
      created_by: pharmacist._id,
      updated_by: pharmacist._id,
    }, {
      quantity_on_hand: 35,
      min_stock_level: 100,
      status: STOCK_BATCH_STATUS.AVAILABLE,
      updated_by: pharmacist._id,
    }),
    upsertBy(StockBatch, { medication_id: amoxicillin._id, batch_no: 'LOT-AMOX-EXP-001' }, {
      medication_id: amoxicillin._id,
      batch_no: 'LOT-AMOX-EXP-001',
      supplier_name: 'Demo Pharma Supplier',
      manufacture_date: daysFromNow(-300),
      expiry_date: daysFromNow(12),
      received_date: daysFromNow(-180),
      quantity_received: 200,
      quantity_on_hand: 92,
      unit_cost: 1500,
      min_stock_level: 80,
      storage_location: 'Kho chính A2',
      status: STOCK_BATCH_STATUS.AVAILABLE,
      created_by: pharmacist._id,
      updated_by: pharmacist._id,
    }, {
      expiry_date: daysFromNow(12),
      quantity_on_hand: 92,
      status: STOCK_BATCH_STATUS.AVAILABLE,
      updated_by: pharmacist._id,
    }),
    upsertBy(StockBatch, { medication_id: oresol._id, batch_no: 'LOT-ORS-OLD-001' }, {
      medication_id: oresol._id,
      batch_no: 'LOT-ORS-OLD-001',
      supplier_name: 'Demo Pharma Supplier',
      manufacture_date: daysFromNow(-450),
      expiry_date: daysFromNow(-3),
      received_date: daysFromNow(-260),
      quantity_received: 80,
      quantity_on_hand: 18,
      unit_cost: 900,
      min_stock_level: 50,
      storage_location: 'Khu cách ly B1',
      status: STOCK_BATCH_STATUS.EXPIRED,
      created_by: pharmacist._id,
      updated_by: pharmacist._id,
    }, {
      expiry_date: daysFromNow(-3),
      quantity_on_hand: 18,
      status: STOCK_BATCH_STATUS.EXPIRED,
      updated_by: pharmacist._id,
    }),
  ]);

  await Promise.all(batches.map((batch, index) => upsertBy(InventoryTransaction, {
    transaction_no: `PHARM-DEMO-RCPT-${String(index + 1).padStart(3, '0')}`,
  }, {
    medication_id: batch.medication_id,
    stock_batch_id: batch._id,
    transaction_no: `PHARM-DEMO-RCPT-${String(index + 1).padStart(3, '0')}`,
    transaction_type: INVENTORY_TRANSACTION_TYPE.RECEIPT,
    direction: INVENTORY_TRANSACTION_DIRECTION.IN,
    quantity: batch.quantity_received,
    balance_after: batch.quantity_on_hand,
    unit_cost: batch.unit_cost,
    reference_type: 'demo_seed',
    reference_id: batch._id,
    performed_by: pharmacist._id,
    occurred_at: minutesAgo(240 - index * 20),
    note: 'Seed dữ liệu demo Pharmacy Overview',
    created_by: pharmacist._id,
    updated_by: pharmacist._id,
  })));

  return { medications, batches };
}

async function seedPrescriptions({ patients, encounters, doctor, pharmacist }, medications, batches) {
  const prescriptions = await Promise.all([
    upsertBy(Prescription, { prescription_no: 'RX-PHARM-DEMO-001' }, {
      patient_id: patients[0]._id,
      encounter_id: encounters[0]._id,
      prescribed_by: doctor._id,
      prescription_no: 'RX-PHARM-DEMO-001',
      prescribed_at: minutesAgo(95),
      status: PRESCRIPTION_STATUS.ACTIVE,
      note: 'Đơn demo chờ duyệt dược',
      created_by: doctor._id,
      updated_by: doctor._id,
    }, { status: PRESCRIPTION_STATUS.ACTIVE, updated_by: doctor._id }),
    upsertBy(Prescription, { prescription_no: 'RX-PHARM-DEMO-002' }, {
      patient_id: patients[1]._id,
      encounter_id: encounters[1]._id,
      prescribed_by: doctor._id,
      verified_by: pharmacist._id,
      prescription_no: 'RX-PHARM-DEMO-002',
      prescribed_at: minutesAgo(75),
      verified_at: minutesAgo(45),
      status: PRESCRIPTION_STATUS.VERIFIED,
      note: 'Đơn demo chờ cấp phát',
      created_by: doctor._id,
      updated_by: pharmacist._id,
    }, {
      verified_by: pharmacist._id,
      verified_at: minutesAgo(45),
      status: PRESCRIPTION_STATUS.VERIFIED,
      updated_by: pharmacist._id,
    }),
    upsertBy(Prescription, { prescription_no: 'RX-PHARM-DEMO-003' }, {
      patient_id: patients[2]._id,
      encounter_id: encounters[2]._id,
      prescribed_by: doctor._id,
      verified_by: pharmacist._id,
      completed_by: pharmacist._id,
      completed_at: minutesAgo(15),
      prescription_no: 'RX-PHARM-DEMO-003',
      prescribed_at: minutesAgo(120),
      verified_at: minutesAgo(70),
      status: PRESCRIPTION_STATUS.COMPLETED,
      note: 'Đơn demo đã cấp phát',
      created_by: doctor._id,
      updated_by: pharmacist._id,
    }, {
      completed_by: pharmacist._id,
      completed_at: minutesAgo(15),
      status: PRESCRIPTION_STATUS.COMPLETED,
      updated_by: pharmacist._id,
    }),
  ]);

  await Promise.all([
    upsertBy(PrescriptionItem, { prescription_id: prescriptions[0]._id, medication_id: medications[0]._id }, {
      prescription_id: prescriptions[0]._id,
      medication_id: medications[0]._id,
      dose: '1 viên',
      frequency: '3 lần/ngày',
      route: 'oral',
      duration_days: 3,
      quantity: 9,
      unit: 'viên',
      instructions: 'Uống sau ăn',
      status: PRESCRIPTION_ITEM_STATUS.ACTIVE,
      created_by: doctor._id,
      updated_by: doctor._id,
    }),
    upsertBy(PrescriptionItem, { prescription_id: prescriptions[0]._id, medication_id: medications[1]._id }, {
      prescription_id: prescriptions[0]._id,
      medication_id: medications[1]._id,
      dose: '1 viên',
      frequency: '2 lần/ngày',
      route: 'oral',
      duration_days: 5,
      quantity: 10,
      unit: 'viên',
      instructions: 'Rà soát tương tác trước cấp phát',
      status: PRESCRIPTION_ITEM_STATUS.ACTIVE,
      created_by: doctor._id,
      updated_by: doctor._id,
    }),
    upsertBy(PrescriptionItem, { prescription_id: prescriptions[1]._id, medication_id: medications[1]._id }, {
      prescription_id: prescriptions[1]._id,
      medication_id: medications[1]._id,
      dose: '1 viên',
      frequency: '2 lần/ngày',
      route: 'oral',
      duration_days: 5,
      quantity: 10,
      unit: 'viên',
      instructions: 'Uống đủ liều',
      status: PRESCRIPTION_ITEM_STATUS.ACTIVE,
      created_by: doctor._id,
      updated_by: pharmacist._id,
    }),
    upsertBy(PrescriptionItem, { prescription_id: prescriptions[2]._id, medication_id: medications[0]._id }, {
      prescription_id: prescriptions[2]._id,
      medication_id: medications[0]._id,
      dose: '1 viên',
      frequency: '3 lần/ngày',
      route: 'oral',
      duration_days: 2,
      quantity: 6,
      unit: 'viên',
      dispensed_quantity: 6,
      instructions: 'Đã cấp phát',
      status: PRESCRIPTION_ITEM_STATUS.COMPLETED,
      created_by: doctor._id,
      updated_by: pharmacist._id,
    }),
  ]);

  const dispenses = await Promise.all([
    upsertBy(Dispense, { dispense_no: 'DSP-PHARM-DEMO-001' }, {
      prescription_id: prescriptions[1]._id,
      patient_id: patients[1]._id,
      encounter_id: encounters[1]._id,
      dispense_no: 'DSP-PHARM-DEMO-001',
      dispensed_by: pharmacist._id,
      status: DISPENSE_STATUS.DRAFT,
      note: 'Phiếu demo đang chuẩn bị',
      created_by: pharmacist._id,
      updated_by: pharmacist._id,
    }, {
      status: DISPENSE_STATUS.DRAFT,
      updated_by: pharmacist._id,
    }),
    upsertBy(Dispense, { dispense_no: 'DSP-PHARM-DEMO-002' }, {
      prescription_id: prescriptions[2]._id,
      patient_id: patients[2]._id,
      encounter_id: encounters[2]._id,
      dispense_no: 'DSP-PHARM-DEMO-002',
      dispensed_by: pharmacist._id,
      dispensed_at: minutesAgo(20),
      completed_by: pharmacist._id,
      completed_at: minutesAgo(15),
      status: DISPENSE_STATUS.DISPENSED,
      note: 'Phiếu demo đã cấp phát',
      created_by: pharmacist._id,
      updated_by: pharmacist._id,
    }, {
      dispensed_by: pharmacist._id,
      dispensed_at: minutesAgo(20),
      completed_by: pharmacist._id,
      completed_at: minutesAgo(15),
      status: DISPENSE_STATUS.DISPENSED,
      updated_by: pharmacist._id,
    }),
  ]);

  const completedItem = await PrescriptionItem.findOne({
    prescription_id: prescriptions[2]._id,
    medication_id: medications[0]._id,
  });
  if (completedItem) {
    await upsertBy(DispenseItem, {
      dispense_id: dispenses[1]._id,
      prescription_item_id: completedItem._id,
      stock_batch_id: batches[0]._id,
    }, {
      dispense_id: dispenses[1]._id,
      prescription_item_id: completedItem._id,
      medication_id: medications[0]._id,
      stock_batch_id: batches[0]._id,
      quantity: 6,
      unit: 'viên',
      instructions: 'Cấp phát đủ',
      status: DISPENSE_ITEM_STATUS.DISPENSED,
      created_by: pharmacist._id,
      updated_by: pharmacist._id,
    });
  }

  return { prescriptions, dispenses };
}

async function seedOperations(pharmacist, prescriptions, dispenses, medications, batches) {
  await Promise.all([
    upsertBy(PharmacyAlert, { alert_code: 'PAL-DEMO-001' }, {
      alert_code: 'PAL-DEMO-001',
      alert_type: 'low_stock',
      severity: 'high',
      status: 'open',
      source_type: 'stock_batch',
      source_id: batches[0]._id,
      medication_id: medications[0]._id,
      stock_batch_id: batches[0]._id,
      title: 'Paracetamol dưới tồn tối thiểu',
      message: 'Lô ParaCare 500 còn 35 viên, thấp hơn ngưỡng 100 viên.',
      dedupe_key: 'demo:low_stock:LOT-PARA-LOW-001',
      metadata: { storage_location: 'Kho chính A1', quantity_on_hand: 35, min_stock_level: 100 },
      created_by: pharmacist._id,
      updated_by: pharmacist._id,
    }),
    upsertBy(PharmacyAlert, { alert_code: 'PAL-DEMO-002' }, {
      alert_code: 'PAL-DEMO-002',
      alert_type: 'near_expiry',
      severity: 'high',
      status: 'acknowledged',
      source_type: 'stock_batch',
      source_id: batches[1]._id,
      medication_id: medications[1]._id,
      stock_batch_id: batches[1]._id,
      title: 'Amoxicillin sắp hết hạn',
      message: 'Lô AmoxiCare còn dưới 14 ngày hạn dùng, cần ưu tiên xuất kho.',
      dedupe_key: 'demo:near_expiry:LOT-AMOX-EXP-001',
      acknowledged_by: pharmacist._id,
      acknowledged_at: minutesAgo(20),
      metadata: { storage_location: 'Kho chính A2' },
      created_by: pharmacist._id,
      updated_by: pharmacist._id,
    }),
  ]);

  await Promise.all([
    upsertBy(PharmacyWorkItem, { work_item_code: 'PWI-DEMO-001' }, {
      work_item_code: 'PWI-DEMO-001',
      type: 'prescription_verification',
      priority: 'high',
      status: 'open',
      source_type: 'prescription',
      source_id: prescriptions[0]._id,
      prescription_id: prescriptions[0]._id,
      due_at: minutesAgo(15),
      sla_minutes: 30,
      title: 'Duyệt đơn RX-PHARM-DEMO-001',
      description: 'Đơn có nhiều thuốc, cần dược sĩ kiểm tra trước cấp phát.',
      risk_flags: { interaction: true },
      created_by: pharmacist._id,
      updated_by: pharmacist._id,
    }),
    upsertBy(PharmacyWorkItem, { work_item_code: 'PWI-DEMO-002' }, {
      work_item_code: 'PWI-DEMO-002',
      type: 'dispense_preparing',
      priority: 'medium',
      status: 'assigned',
      source_type: 'dispense',
      source_id: dispenses[0]._id,
      prescription_id: prescriptions[1]._id,
      dispense_id: dispenses[0]._id,
      assigned_to: pharmacist._id,
      assigned_at: minutesAgo(25),
      due_at: minutesAgo(5),
      sla_minutes: 30,
      title: 'Chuẩn bị phiếu DSP-PHARM-DEMO-001',
      description: 'Phiếu cấp phát demo đang chờ hoàn tất.',
      risk_flags: {},
      created_by: pharmacist._id,
      updated_by: pharmacist._id,
    }),
  ]);
}

async function main() {
  await connectDatabase();

  const references = await seedReferenceData();
  const { medications, batches } = await seedInventory(references.pharmacist);
  const { prescriptions, dispenses } = await seedPrescriptions(references, medications, batches);
  await seedOperations(references.pharmacist, prescriptions, dispenses, medications, batches);

  console.log(JSON.stringify({
    ok: true,
    seeded: {
      medications: medications.length,
      batches: batches.length,
      prescriptions: prescriptions.length,
      dispenses: dispenses.length,
      alerts: 2,
      work_items: 2,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
