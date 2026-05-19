const VITAL_SEVERITY_RANK = {
  normal: 0,
  mild: 1,
  warning: 2,
  high: 3,
  critical: 4,
};

function numeric(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function calculateBMI({ weight, height } = {}) {
  const numericWeight = numeric(weight);
  const numericHeight = numeric(height);
  if (!numericWeight || !numericHeight || numericWeight <= 0 || numericHeight <= 0) return null;
  const meters = numericHeight > 10 ? numericHeight / 100 : numericHeight;
  if (!meters) return null;
  return Number((numericWeight / (meters * meters)).toFixed(2));
}

function calculateMap({ systolic_bp: systolicBp, diastolic_bp: diastolicBp } = {}) {
  const systolic = numeric(systolicBp);
  const diastolic = numeric(diastolicBp);
  if (systolic === null || diastolic === null || systolic <= diastolic) return null;
  return Number((((systolic + (2 * diastolic)) / 3)).toFixed(1));
}

function calculateGcs({ gcs_eye: eye, gcs_verbal: verbal, gcs_motor: motor } = {}) {
  const gcsEye = numeric(eye);
  const gcsVerbal = numeric(verbal);
  const gcsMotor = numeric(motor);
  if (gcsEye === null && gcsVerbal === null && gcsMotor === null) return null;
  if (gcsEye === null || gcsVerbal === null || gcsMotor === null) return null;
  return gcsEye + gcsVerbal + gcsMotor;
}

function flag(field, value, level, message, recommendation, threshold = null) {
  if (value === undefined || value === null || value === '') return null;
  return {
    field,
    value,
    threshold,
    level,
    severity: level,
    message,
    recommendation,
  };
}

function buildAbnormalFlags(vital = {}) {
  const flags = [];
  const spo2 = numeric(vital.spo2);
  const systolicBp = numeric(vital.systolic_bp);
  const diastolicBp = numeric(vital.diastolic_bp);
  const heartRate = numeric(vital.heart_rate);
  const respiratoryRate = numeric(vital.respiratory_rate);
  const temperature = numeric(vital.temperature);
  const painScore = numeric(vital.pain_score);
  const glucose = numeric(vital.blood_glucose);
  const gcsTotal = numeric(vital.gcs_total) || calculateGcs(vital);

  if (spo2 !== null && spo2 < 90) flags.push(flag('spo2', spo2, 'critical', 'SpO2 rất thấp', 'Đo lại ngay, kiểm tra đầu dò/oxy và báo bác sĩ.', { critical_below: 90 }));
  else if (spo2 !== null && spo2 < 94) flags.push(flag('spo2', spo2, 'warning', 'SpO2 thấp', 'Kiểm tra đầu dò, tư thế, oxygen device và đo lại trong 15 phút.', { warning_below: 94 }));

  if (systolicBp !== null && systolicBp >= 180) flags.push(flag('systolic_bp', systolicBp, 'critical', 'Huyết áp tâm thu rất cao', 'Báo bác sĩ, đánh giá triệu chứng thần kinh/ngực và đo lại.', { critical_at_or_above: 180 }));
  else if (systolicBp !== null && systolicBp >= 160) flags.push(flag('systolic_bp', systolicBp, 'warning', 'Huyết áp tâm thu cao', 'Theo dõi sát và đo lại trong 15 phút.', { warning_at_or_above: 160 }));
  if (systolicBp !== null && systolicBp < 90) flags.push(flag('systolic_bp', systolicBp, 'critical', 'Huyết áp tâm thu thấp', 'Đánh giá tưới máu, chóng mặt/ngất và báo bác sĩ.', { critical_below: 90 }));

  if (diastolicBp !== null && diastolicBp >= 120) flags.push(flag('diastolic_bp', diastolicBp, 'critical', 'Huyết áp tâm trương rất cao', 'Báo bác sĩ và đo lại sau nghỉ.', { critical_at_or_above: 120 }));
  else if (diastolicBp !== null && diastolicBp >= 100) flags.push(flag('diastolic_bp', diastolicBp, 'warning', 'Huyết áp tâm trương cao', 'Theo dõi và đo lại trong 15 phút.', { warning_at_or_above: 100 }));

  if (heartRate !== null && heartRate >= 150) flags.push(flag('heart_rate', heartRate, 'critical', 'Mạch rất nhanh', 'Đánh giá đau ngực/khó thở, đo lại và báo bác sĩ.', { critical_at_or_above: 150 }));
  else if (heartRate !== null && heartRate >= 120) flags.push(flag('heart_rate', heartRate, 'warning', 'Mạch nhanh', 'Kiểm tra sốt, đau, mất nước và đo lại.', { warning_at_or_above: 120 }));
  if (heartRate !== null && heartRate < 40) flags.push(flag('heart_rate', heartRate, 'critical', 'Mạch rất chậm', 'Đánh giá tri giác/huyết áp và báo bác sĩ.', { critical_below: 40 }));
  else if (heartRate !== null && heartRate < 50) flags.push(flag('heart_rate', heartRate, 'warning', 'Mạch chậm', 'Theo dõi triệu chứng và đo lại.', { warning_below: 50 }));

  if (respiratoryRate !== null && respiratoryRate >= 40) flags.push(flag('respiratory_rate', respiratoryRate, 'critical', 'Nhịp thở rất nhanh', 'Đánh giá suy hô hấp, SpO2 và báo bác sĩ.', { critical_at_or_above: 40 }));
  else if (respiratoryRate !== null && respiratoryRate >= 30) flags.push(flag('respiratory_rate', respiratoryRate, 'warning', 'Nhịp thở nhanh', 'Theo dõi hô hấp và đo lại trong 15 phút.', { warning_at_or_above: 30 }));
  if (respiratoryRate !== null && respiratoryRate < 8) flags.push(flag('respiratory_rate', respiratoryRate, 'critical', 'Nhịp thở rất chậm', 'Báo bác sĩ ngay và đánh giá tri giác.', { critical_below: 8 }));

  if (temperature !== null && temperature >= 40) flags.push(flag('temperature', temperature, 'critical', 'Sốt rất cao', 'Báo bác sĩ, theo dõi dấu hiệu nhiễm trùng và đo lại.', { critical_at_or_above: 40 }));
  else if (temperature !== null && temperature >= 39) flags.push(flag('temperature', temperature, 'warning', 'Sốt cao', 'Theo dõi, ghi chú triệu chứng kèm theo và đo lại.', { warning_at_or_above: 39 }));
  if (temperature !== null && temperature < 34) flags.push(flag('temperature', temperature, 'critical', 'Hạ thân nhiệt nặng', 'Ủ ấm, đo lại và báo bác sĩ.', { critical_below: 34 }));
  else if (temperature !== null && temperature < 35) flags.push(flag('temperature', temperature, 'warning', 'Hạ thân nhiệt', 'Kiểm tra vị trí đo và đo lại.', { warning_below: 35 }));

  if (painScore !== null && painScore >= 8) flags.push(flag('pain_score', painScore, 'warning', 'Đau nhiều', 'Đánh giá vị trí đau, ghi chú và báo bác sĩ nếu cần.', { warning_at_or_above: 8 }));
  if (glucose !== null && glucose < 54) flags.push(flag('blood_glucose', glucose, 'critical', 'Đường huyết rất thấp', 'Xử trí hạ đường huyết theo quy trình và báo bác sĩ.', { critical_below: 54 }));
  else if (glucose !== null && glucose < 70) flags.push(flag('blood_glucose', glucose, 'warning', 'Đường huyết thấp', 'Theo dõi triệu chứng và đo lại.', { warning_below: 70 }));
  if (glucose !== null && glucose >= 400) flags.push(flag('blood_glucose', glucose, 'critical', 'Đường huyết rất cao', 'Báo bác sĩ và kiểm tra dấu hiệu mất nước/nhiễm toan.', { critical_at_or_above: 400 }));
  else if (glucose !== null && glucose >= 250) flags.push(flag('blood_glucose', glucose, 'warning', 'Đường huyết cao', 'Theo dõi và báo bác sĩ theo y lệnh.', { warning_at_or_above: 250 }));

  if (gcsTotal !== null && gcsTotal < 9) flags.push(flag('gcs_total', gcsTotal, 'critical', 'GCS thấp', 'Báo bác sĩ ngay, đánh giá đường thở và an toàn người bệnh.', { critical_below: 9 }));
  else if (gcsTotal !== null && gcsTotal < 15) flags.push(flag('gcs_total', gcsTotal, 'warning', 'GCS giảm', 'Theo dõi tri giác và đo lại.', { warning_below: 15 }));

  if (vital.consciousness_level === 'pain' || vital.consciousness_level === 'unresponsive') {
    flags.push(flag('consciousness_level', vital.consciousness_level, 'critical', 'Tri giác giảm', 'Báo bác sĩ ngay và theo dõi đường thở.', { critical_values: ['pain', 'unresponsive'] }));
  } else if (vital.consciousness_level === 'voice') {
    flags.push(flag('consciousness_level', vital.consciousness_level, 'warning', 'Đáp ứng với gọi', 'Theo dõi tri giác và ghi chú diễn biến.', { warning_values: ['voice'] }));
  }

  return flags;
}

function calculateHighestSeverity(flags = []) {
  return flags.reduce((highest, item) => (
    VITAL_SEVERITY_RANK[item.level || item.severity] > VITAL_SEVERITY_RANK[highest] ? (item.level || item.severity) : highest
  ), 'normal');
}

function suggestRecheckMinutes(flags = []) {
  const severity = calculateHighestSeverity(flags);
  if (severity === 'critical') return 5;
  if (severity === 'high') return 10;
  if (severity === 'warning') return 15;
  if (severity === 'mild') return 30;
  return null;
}

function calculateDeltas(current = {}, previous = {}) {
  const fields = [
    'temperature',
    'heart_rate',
    'respiratory_rate',
    'systolic_bp',
    'diastolic_bp',
    'spo2',
    'weight',
    'height',
    'bmi',
    'pain_score',
    'blood_glucose',
  ];
  return fields.reduce((output, field) => {
    const now = numeric(current[field]);
    const before = numeric(previous?.[field]);
    if (now !== null && before !== null) output[field] = Number((now - before).toFixed(2));
    return output;
  }, {});
}

function assessVitalSign(vital = {}, context = {}) {
  const calculated = {
    bmi: calculateBMI(vital),
    map: calculateMap(vital),
    gcs_total: calculateGcs(vital),
  };
  const normalized = {
    ...vital,
    bmi: vital.bmi ?? calculated.bmi,
    map: vital.map ?? calculated.map,
    gcs_total: vital.gcs_total ?? calculated.gcs_total,
  };
  const flags = buildAbnormalFlags(normalized, context);
  const severity = calculateHighestSeverity(flags);
  const suggestedRecheck = suggestRecheckMinutes(flags);

  return {
    normalized,
    calculated,
    severity,
    overall_severity: severity,
    abnormal_flags: flags,
    flags,
    requires_recheck: Boolean(suggestedRecheck),
    suggested_recheck_minutes: suggestedRecheck,
    doctor_notification_required: ['high', 'critical'].includes(severity),
    requires_doctor_notification: ['high', 'critical'].includes(severity),
  };
}

module.exports = {
  VITAL_SEVERITY_RANK,
  assessVitalSign,
  buildAbnormalFlags,
  calculateBMI,
  calculateDeltas,
  calculateGcs,
  calculateHighestSeverity,
  calculateMap,
  numeric,
  suggestRecheckMinutes,
};
