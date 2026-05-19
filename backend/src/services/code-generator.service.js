const { randomInt } = require('crypto');
const Counter = require('../models/common/counter.model');
const ApiError = require('../common/errors/api-error');
const { formatYYYYMMDD } = require('../common/helpers/date-time.helper');

const DEFAULT_RANDOM_DIGITS = 3;

const CODE_TYPE = {
  PATIENT: 'PATIENT',
  APPOINTMENT: 'APPOINTMENT',
  ENCOUNTER: 'ENCOUNTER',
  CONSULTATION: 'CONSULTATION',
  ORDER: 'ORDER',
  LAB_ORDER: 'LAB_ORDER',
  SPECIMEN: 'SPECIMEN',
  LAB_RESULT: 'LAB_RESULT',
  IMAGING_ORDER: 'IMAGING_ORDER',
  IMAGING_REPORT: 'IMAGING_REPORT',
  PROCEDURE_ORDER: 'PROCEDURE_ORDER',
  PRESCRIPTION: 'PRESCRIPTION',
  DISPENSE: 'DISPENSE',
  INVENTORY_TRANSACTION: 'INVENTORY_TRANSACTION',
  INVENTORY_RECEIPT: 'INVENTORY_RECEIPT',
  INTERNAL_ISSUE: 'INTERNAL_ISSUE',
  INVENTORY_TRANSFER: 'INVENTORY_TRANSFER',
  INVENTORY_DISPOSAL: 'INVENTORY_DISPOSAL',
  INVENTORY_RETURN: 'INVENTORY_RETURN',
  ADMISSION: 'ADMISSION',
  CHARGE: 'CHARGE',
  INVOICE: 'INVOICE',
  PAYMENT: 'PAYMENT',
  INSURANCE_CLAIM: 'INSURANCE_CLAIM',
  MEDICAL_RECORD: 'MEDICAL_RECORD',
  CARE_PLAN: 'CARE_PLAN',
  QUEUE: 'QUEUE',
  SERVICE_PREPARATION: 'SERVICE_PREPARATION',
  NURSING_TASK: 'NURSING_TASK',
  NURSING_HANDOFF: 'NURSING_HANDOFF',
  NURSING_TASK_TEMPLATE: 'NURSING_TASK_TEMPLATE',
};

const CODE_PREFIX = {
  [CODE_TYPE.PATIENT]: 'PAT',
  [CODE_TYPE.APPOINTMENT]: 'APT',
  [CODE_TYPE.ENCOUNTER]: 'ENC',
  [CODE_TYPE.CONSULTATION]: 'CON',
  [CODE_TYPE.ORDER]: 'ORD',
  [CODE_TYPE.LAB_ORDER]: 'LAB',
  [CODE_TYPE.SPECIMEN]: 'SPC',
  [CODE_TYPE.LAB_RESULT]: 'LBR',
  [CODE_TYPE.IMAGING_ORDER]: 'IMG',
  [CODE_TYPE.IMAGING_REPORT]: 'IMR',
  [CODE_TYPE.PROCEDURE_ORDER]: 'PRO',
  [CODE_TYPE.PRESCRIPTION]: 'RX',
  [CODE_TYPE.DISPENSE]: 'DSP',
  [CODE_TYPE.INVENTORY_TRANSACTION]: 'ITX',
  [CODE_TYPE.INVENTORY_RECEIPT]: 'IRC',
  [CODE_TYPE.INTERNAL_ISSUE]: 'IIS',
  [CODE_TYPE.INVENTORY_TRANSFER]: 'ITF',
  [CODE_TYPE.INVENTORY_DISPOSAL]: 'IDS',
  [CODE_TYPE.INVENTORY_RETURN]: 'IRT',
  [CODE_TYPE.ADMISSION]: 'ADM',
  [CODE_TYPE.CHARGE]: 'CHG',
  [CODE_TYPE.INVOICE]: 'INV',
  [CODE_TYPE.PAYMENT]: 'PAY',
  [CODE_TYPE.INSURANCE_CLAIM]: 'CLM',
  [CODE_TYPE.MEDICAL_RECORD]: 'MR',
  [CODE_TYPE.CARE_PLAN]: 'CP',
  [CODE_TYPE.QUEUE]: 'Q',
  [CODE_TYPE.SERVICE_PREPARATION]: 'PREP',
  [CODE_TYPE.NURSING_TASK]: 'NT',
  [CODE_TYPE.NURSING_HANDOFF]: 'NH',
  [CODE_TYPE.NURSING_TASK_TEMPLATE]: 'NTPL',
};

function padNumber(value, width = DEFAULT_RANDOM_DIGITS) {
  return String(value).padStart(width, '0');
}

function padSequence(value, width = 4) {
  return padNumber(value, width);
}

function generateRandomDigits(width = DEFAULT_RANDOM_DIGITS) {
  const min = 10 ** (width - 1);
  const max = 10 ** width - 1;
  return String(randomInt(min, max + 1));
}

function formatDatePart(date = new Date()) {
  return formatYYYYMMDD(date);
}

function generateCode(prefix, options = {}) {
  const randomDigits = options.randomDigits || DEFAULT_RANDOM_DIGITS;
  const timestamp = options.timestamp || Date.now();
  return `${prefix}${timestamp}${generateRandomDigits(randomDigits)}`;
}

function generateDateCode(prefix, options = {}) {
  const date = options.date || new Date();
  const separator = options.separator || '';
  const randomDigits = options.randomDigits || DEFAULT_RANDOM_DIGITS;
  return [prefix, formatDatePart(date), generateRandomDigits(randomDigits)].filter(Boolean).join(separator);
}

function buildCounterKey(type, datePart, scope = null) {
  return [type, scope, datePart].filter(Boolean).join(':');
}

async function getNextSequence(counterKey, session = null) {
  const counter = await Counter.findOneAndUpdate(
    { key: counterKey },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      session,
    },
  );

  return counter.seq;
}

async function generateBusinessCode(type, options = {}) {
  const {
    date = new Date(),
    scope = null,
    sequenceLength = 4,
    session = null,
    separator = '',
    includeDate = true,
  } = options;

  const prefix = CODE_PREFIX[type];
  if (!prefix) {
    throw ApiError.internal(`Unknown code type: ${type}`);
  }

  const datePart = includeDate ? formatDatePart(date) : '';
  const counterKey = buildCounterKey(type, datePart, scope);
  const seq = await getNextSequence(counterKey, session);

  return [prefix, datePart, padSequence(seq, sequenceLength)]
    .filter(Boolean)
    .join(separator);
}

async function generateUniqueCode(Model, fieldName, prefix, options = {}) {
  const maxAttempts = options.maxAttempts || 10;
  const generator = options.generator || generateCode;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generator(prefix, options);
    const exists = await Model.exists({ [fieldName]: code });
    if (!exists) return code;
  }

  throw ApiError.conflict(`Không thể sinh mã duy nhất cho ${fieldName}.`);
}

async function generateSequenceCode(Model, fieldName, prefix, options = {}) {
  const date = options.date || new Date();
  const datePart = options.includeDate === false ? '' : formatDatePart(date);
  const separator = options.separator || '';
  const width = options.sequenceWidth || 4;
  const codePrefix = [prefix, datePart].filter(Boolean).join(separator);
  const pattern = `^${codePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${separator ? separator : ''}\\d{${width}}$`;
  let query = Model.findOne({ [fieldName]: { $regex: pattern } }).sort({ [fieldName]: -1 });

  if (options.session) query = query.session(options.session);

  const latest = await query.lean();
  const latestCode = latest?.[fieldName] || '';
  const latestNumber = Number(latestCode.slice(-width)) || 0;
  return `${codePrefix}${separator}${padNumber(latestNumber + 1, width)}`;
}

module.exports = {
  // CODE_TYPE: Định nghĩa hằng số/cấu hình code type dùng chung trong service.
  CODE_TYPE,
  // CODE_PREFIX: Định nghĩa hằng số/cấu hình code prefix dùng chung trong service.
  CODE_PREFIX,
  // DEFAULT_RANDOM_DIGITS: Định nghĩa hằng số/cấu hình default random digits dùng chung trong service.
  DEFAULT_RANDOM_DIGITS,
  // padNumber: Bổ sung ký tự cho mã số.
  padNumber,
  // padSequence: Bổ sung ký tự cho chuỗi số.
  padSequence,
  // generateRandomDigits: Sinh/tạo ngẫu nhiên chữ số.
  generateRandomDigits,
  // formatDatePart: Định dạng phần ngày trong mã.
  formatDatePart,
  // buildCounterKey: Xây dựng khóa bộ đếm.
  buildCounterKey,
  // getNextSequence: Lấy số thứ tự kế tiếp.
  getNextSequence,
  // generateCode: Sinh/tạo mã.
  generateCode,
  // generateDateCode: Sinh/tạo mã theo ngày.
  generateDateCode,
  // generateBusinessCode: Sinh/tạo mã nghiệp vụ.
  generateBusinessCode,
  // generateCounterCode: Sinh/tạo mã theo bộ đếm.
  generateCounterCode: generateBusinessCode,
  // generateUniqueCode: Sinh/tạo mã duy nhất.
  generateUniqueCode,
  // generateSequenceCode: Sinh/tạo mã theo chuỗi số.
  generateSequenceCode,
};
