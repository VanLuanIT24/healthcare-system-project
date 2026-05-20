const ORDER_TYPE = {
  LAB: 'lab',
  IMAGING: 'imaging',
  PROCEDURE: 'procedure',
  MEDICATION: 'medication',
  SERVICE: 'service',
  NURSING: 'nursing',
  OTHER: 'other',
};

const ORDER_TYPES = Object.values(ORDER_TYPE);

const ORDER_PRIORITY = {
  ROUTINE: 'routine',
  URGENT: 'urgent',
  STAT: 'stat',
};

const ORDER_PRIORITIES = Object.values(ORDER_PRIORITY);

const ORDER_STATUS = {
  DRAFT: 'draft',
  ORDERED: 'ordered',
  ACKNOWLEDGED: 'acknowledged',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ENTERED_IN_ERROR: 'entered_in_error',
};

const ORDER_STATUSES = Object.values(ORDER_STATUS);

const LAB_ORDER_STATUS = {
  ORDERED: 'ordered',
  COLLECTED: 'collected',
  RECEIVED: 'received',
  IN_PROGRESS: 'in_progress',
  RECOLLECTION_REQUIRED: 'recollection_required',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
};

const LAB_ORDER_STATUSES = Object.values(LAB_ORDER_STATUS);

const SPECIMEN_STATUS = {
  PLANNED: 'planned',
  COLLECTED: 'collected',
  RECEIVED: 'received',
  REJECTED: 'rejected',
  IN_TESTING: 'in_testing',
  STORED: 'stored',
  DISPOSED: 'disposed',
};

const SPECIMEN_STATUSES = Object.values(SPECIMEN_STATUS);

const LAB_RESULT_STATUS = {
  PRELIMINARY: 'preliminary',
  FINAL: 'final',
  AMENDED: 'amended',
  CANCELLED: 'cancelled',
  ENTERED_IN_ERROR: 'entered_in_error',
};

const LAB_RESULT_STATUSES = Object.values(LAB_RESULT_STATUS);

const ABNORMAL_FLAG = {
  LOW: 'low',
  HIGH: 'high',
  CRITICAL_LOW: 'critical_low',
  CRITICAL_HIGH: 'critical_high',
  NORMAL: 'normal',
  ABNORMAL: 'abnormal',
  UNKNOWN: 'unknown',
};

const ABNORMAL_FLAGS = Object.values(ABNORMAL_FLAG);

const RESULT_ITEM_STATUS = {
  PRELIMINARY: 'preliminary',
  FINAL: 'final',
  AMENDED: 'amended',
  CANCELLED: 'cancelled',
};

const RESULT_ITEM_STATUSES = Object.values(RESULT_ITEM_STATUS);

const IMAGING_MODALITY = {
  XRAY: 'xray',
  ULTRASOUND: 'ultrasound',
  CT: 'ct',
  MRI: 'mri',
  MAMMOGRAPHY: 'mammography',
  FLUOROSCOPY: 'fluoroscopy',
  OTHER: 'other',
};

const IMAGING_MODALITIES = Object.values(IMAGING_MODALITY);

const IMAGING_ORDER_STATUS = {
  ORDERED: 'ordered',
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
};

const IMAGING_ORDER_STATUSES = Object.values(IMAGING_ORDER_STATUS);

const IMAGING_REPORT_STATUS = {
  DRAFT: 'draft',
  PRELIMINARY: 'preliminary',
  FINAL: 'final',
  AMENDED: 'amended',
  CANCELLED: 'cancelled',
};

const IMAGING_REPORT_STATUSES = Object.values(IMAGING_REPORT_STATUS);

const PROCEDURE_STATUS = {
  ORDERED: 'ordered',
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
};

const PROCEDURE_STATUSES = Object.values(PROCEDURE_STATUS);

const PROCEDURE_RESULT_STATUS = {
  DRAFT: 'draft',
  PRELIMINARY: 'preliminary',
  FINAL: 'final',
  AMENDED: 'amended',
  CANCELLED: 'cancelled',
};

const PROCEDURE_RESULT_STATUSES = Object.values(PROCEDURE_RESULT_STATUS);

module.exports = {
  ORDER_TYPE,
  ORDER_TYPES,
  ORDER_PRIORITY,
  ORDER_PRIORITIES,
  ORDER_STATUS,
  ORDER_STATUSES,
  LAB_ORDER_STATUS,
  LAB_ORDER_STATUSES,
  SPECIMEN_STATUS,
  SPECIMEN_STATUSES,
  LAB_RESULT_STATUS,
  LAB_RESULT_STATUSES,
  ABNORMAL_FLAG,
  ABNORMAL_FLAGS,
  RESULT_ITEM_STATUS,
  RESULT_ITEM_STATUSES,
  IMAGING_MODALITY,
  IMAGING_MODALITIES,
  IMAGING_ORDER_STATUS,
  IMAGING_ORDER_STATUSES,
  IMAGING_REPORT_STATUS,
  IMAGING_REPORT_STATUSES,
  PROCEDURE_STATUS,
  PROCEDURE_STATUSES,
  PROCEDURE_RESULT_STATUS,
  PROCEDURE_RESULT_STATUSES,
};
