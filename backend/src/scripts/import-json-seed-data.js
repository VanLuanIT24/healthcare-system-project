const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const models = require('../models');

const DEFAULT_JSON_FILE = 'C:\\Users\\phain\\Downloads\\healthcare_full_seed_vi.json';
const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_MODE = process.argv.includes('--delete');
const JSON_FILE = process.env.JSON_SEED_FILE || process.argv.slice(2).find((arg) => !arg.startsWith('--')) || DEFAULT_JSON_FILE;
const BATCH_SIZE = Number(process.env.JSON_IMPORT_BATCH_SIZE || 200);

function convertObjectId(value) {
  if (!value) return undefined;
  if (value instanceof mongoose.Types.ObjectId) return value;
  const text = String(value).trim();
  return mongoose.Types.ObjectId.isValid(text) ? new mongoose.Types.ObjectId(text) : value;
}

function convertBySchema(value, schemaType) {
  if (value === '' || value === null || value === undefined) return value;
  const instance = schemaType && schemaType.instance;
  if (instance === 'ObjectId') return convertObjectId(value);
  if (instance === 'Date') return value instanceof Date ? value : new Date(value);
  if (instance === 'Number') return Number(value);
  if (instance === 'Boolean') return typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true';
  return value;
}

function convertNestedIds(value) {
  if (Array.isArray(value)) return value.map(convertNestedIds);
  if (!value || typeof value !== 'object' || value instanceof Date || value instanceof mongoose.Types.ObjectId) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => {
      if (key === '_id' || key.endsWith('_id') || key.endsWith('_by')) {
        if (Array.isArray(nestedValue)) return [key, nestedValue.map(convertObjectId)];
        return [key, convertObjectId(nestedValue)];
      }
      return [key, convertNestedIds(nestedValue)];
    }),
  );
}

function setIfMissing(doc, target, source) {
  if ((doc[target] === undefined || doc[target] === null || doc[target] === '') && doc[source] !== undefined) {
    doc[target] = doc[source];
  }
}

function stableKeyPart(value) {
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function fallbackUniqueValue(doc, fieldName, Model) {
  const schemaType = Model.schema.path(fieldName);
  const id = doc._id ? stableKeyPart(doc._id) : `${Date.now()}${Math.random()}`;
  if (schemaType && schemaType.instance === 'ObjectId') {
    return convertObjectId(id.replace(/[^a-fA-F0-9]/g, '').slice(0, 24).padEnd(24, '0'));
  }
  if (schemaType && schemaType.instance === 'Number') {
    return Number.parseInt(id.replace(/[^a-fA-F0-9]/g, '').slice(-8) || '0', 16);
  }
  return `${Model.collection.name}_${fieldName}_${id}`.toUpperCase();
}

function chooseUniqueFieldToAdjust(fields, Model) {
  return [...fields].reverse().find((field) => {
    const schemaType = Model.schema.path(field);
    return !(schemaType && schemaType.enumValues && schemaType.enumValues.length);
  }) || fields[fields.length - 1];
}

function applyActualUniqueIndexes(docs, Model, actualUniqueIndexes) {
  for (const index of actualUniqueIndexes) {
    const fields = Object.keys(index.key || {});
    if (!fields.length || fields.includes('_id')) continue;

    if (!index.sparse && !index.partialFilterExpression) {
      for (const doc of docs) {
        for (const field of fields) {
          if (doc[field] === undefined || doc[field] === null || doc[field] === '') {
            doc[field] = doc.order_no || doc.code || doc[`${Model.collection.name.slice(0, -1)}_code`] || fallbackUniqueValue(doc, field, Model);
          }
        }
      }
    }

    const seen = new Set();
    for (const doc of docs) {
      if (fields.some((field) => doc[field] === undefined || doc[field] === null || doc[field] === '')) continue;
      const key = fields.map((field) => stableKeyPart(doc[field])).join('\u001f');
      if (!seen.has(key)) {
        seen.add(key);
        continue;
      }
      const fieldToAdjust = chooseUniqueFieldToAdjust(fields, Model);
      for (const field of fields) {
        if (field !== fieldToAdjust) continue;
        doc[field] = fallbackUniqueValue(doc, field, Model);
      }
    }
  }
}

async function avoidExistingUniqueConflicts(docs, Model, actualUniqueIndexes) {
  for (const index of actualUniqueIndexes) {
    const fields = Object.keys(index.key || {});
    if (!fields.length || fields.includes('_id')) continue;

    for (const doc of docs) {
      if (fields.some((field) => doc[field] === undefined || doc[field] === null || doc[field] === '')) continue;

      const filter = Object.fromEntries(fields.map((field) => [field, doc[field]]));
      const existing = await Model.collection.findOne(filter, { projection: { _id: 1 } });
      if (existing && stableKeyPart(existing._id) !== stableKeyPart(doc._id)) {
        const fieldToAdjust = chooseUniqueFieldToAdjust(fields, Model);
        doc[fieldToAdjust] = fallbackUniqueValue(doc, fieldToAdjust, Model);
      }
    }
  }
}

function normalizeSeedDocument(modelName, rawDoc) {
  const doc = { ...rawDoc };

  switch (modelName) {
    case 'SpecimenCustodyEvent':
      if (doc.event_type === 'transferred') doc.event_type = 'transported';
      break;
    case 'ImagingReportCorrectionRequest':
      if (['measurement', 'recommendation'].includes(doc.correction_type)) doc.correction_type = 'text';
      break;
    case 'ProcedureResult':
      if (['signed', 'released'].includes(doc.status)) doc.status = 'final';
      break;
    case 'ResultReportTemplate':
      setIfMissing(doc, 'template_code', 'code');
      setIfMissing(doc, 'domain', 'result_type');
      if (doc.status === 'published') doc.status = 'active';
      doc.sections = (doc.sections || []).map((section, index) => ({
        ...section,
        code: section.code || `section_${index + 1}`,
        type: section.type || 'rich_text',
        default_content: section.default_content || section.content,
      }));
      doc.structured_fields = (doc.structured_fields || []).map((field, index) => ({
        ...field,
        code: field.code || field.key || `field_${index + 1}`,
        value_type: field.value_type || field.type || 'text',
      }));
      break;
    case 'ResultSignature':
      if (doc.entity_type === 'procedure_result') doc.entity_type = 'imaging_report';
      if (doc.signature_method === 'digital_certificate') doc.signature_method = 'certificate';
      break;
    case 'ResultDelivery':
      if (doc.recipient_type === 'department') doc.recipient_type = 'staff';
      break;
    case 'Order':
      setIfMissing(doc, 'order_code', 'order_no');
      break;
    case 'DosageForm':
      if (doc.form_group === 'solid') doc.form_group = 'oral';
      break;
    case 'Warehouse':
      setIfMissing(doc, 'warehouse_code', 'code');
      doc.type = doc.type || 'central';
      if (doc.status === 'maintenance') doc.status = 'inactive';
      break;
    case 'StorageLocation':
      setIfMissing(doc, 'location_code', 'code');
      if (doc.location_type === 'refrigerator') doc.location_type = 'fridge';
      break;
    case 'Supplier':
      setIfMissing(doc, 'code', 'supplier_code');
      doc.supplier_type = doc.supplier_type || 'distributor';
      doc.risk_level = doc.risk_level || 'low';
      break;
    case 'InventoryReceipt':
      if (doc.status === 'confirmed') doc.status = 'posted';
      break;
    case 'InventoryReceiptItem':
      setIfMissing(doc, 'receipt_id', 'inventory_receipt_id');
      setIfMissing(doc, 'batch_no', 'lot_no');
      break;
    case 'InternalIssue':
      if (doc.status === 'requested') doc.status = 'pending_approval';
      if (doc.status === 'completed') doc.status = 'received';
      break;
    case 'InternalIssueItem':
      setIfMissing(doc, 'issue_id', 'internal_issue_id');
      setIfMissing(doc, 'quantity_requested', 'requested_quantity');
      break;
    case 'InventoryTransfer':
      if (doc.status === 'requested') doc.status = 'pending_approval';
      if (doc.status === 'completed') doc.status = 'closed';
      break;
    case 'InventoryTransferItem':
      setIfMissing(doc, 'transfer_id', 'inventory_transfer_id');
      setIfMissing(doc, 'quantity_requested', 'requested_quantity');
      break;
    case 'InventoryDisposal':
      doc.disposal_type = doc.disposal_type || 'other';
      if (doc.status === 'requested') doc.status = 'pending_approval';
      if (doc.status === 'completed') doc.status = 'posted';
      break;
    case 'InventoryDisposalItem':
      setIfMissing(doc, 'disposal_id', 'inventory_disposal_id');
      break;
    case 'InventoryReturn':
      doc.return_source = doc.return_source || 'supplier';
      if (doc.status === 'requested') doc.status = 'pending_inspection';
      if (doc.status === 'approved') doc.status = 'accepted';
      if (doc.status === 'completed') doc.status = 'posted';
      break;
    case 'InventoryReturnItem':
      setIfMissing(doc, 'return_id', 'inventory_return_id');
      setIfMissing(doc, 'quantity_returned', 'quantity');
      doc.condition_status = doc.condition_status || 'unknown_origin';
      doc.decision = doc.decision || 'supplier_return';
      break;
    case 'StocktakeSession':
      setIfMissing(doc, 'stocktake_no', 'session_no');
      doc.scope_type = doc.scope_type || 'full';
      if (doc.status === 'completed') doc.status = 'posted';
      break;
    case 'StocktakeItem':
      setIfMissing(doc, 'stocktake_id', 'stocktake_session_id');
      setIfMissing(doc, 'system_quantity', 'expected_quantity');
      doc.status = doc.status || (doc.counted_quantity === null || doc.counted_quantity === undefined ? 'pending' : 'counted');
      break;
    case 'DispenseHold':
      if (doc.hold_type === 'interaction') doc.hold_type = 'interaction_risk';
      if (doc.hold_type === 'allergy') doc.hold_type = 'allergy_risk';
      break;
    case 'DispenseReturnItem':
      if (doc.return_condition === 'good') doc.return_condition = 'sealed';
      if (doc.disposition === 'dispose') doc.disposition = 'waste';
      break;
    case 'DispensePrintJob':
      if (doc.print_type === 'receipt') doc.print_type = 'handover';
      break;
    case 'MedicationAdministrationEvent':
      if (doc.event_type === 'scheduled') doc.event_type = 'scheduled_created';
      if (doc.event_type === 'skipped') doc.event_type = 'omitted';
      break;
    case 'MedicationIntervention':
      if (doc.intervention_type === 'interaction_check') doc.intervention_type = 'drug_interaction';
      if (doc.intervention_type === 'substitution') doc.intervention_type = 'stock_substitution';
      break;
    case 'PharmacyAlert':
      setIfMissing(doc, 'alert_code', 'alert_no');
      break;
    case 'PharmacyWorkItem':
      if (doc.type === 'review_prescription') doc.type = 'prescription_verification';
      if (doc.type === 'prepare_dispense') doc.type = 'dispense_preparing';
      if (doc.type === 'resolve_alert') doc.type = 'clinical_review';
      if (doc.priority === 'urgent') doc.priority = 'critical';
      if (doc.status === 'done') doc.status = 'resolved';
      break;
    case 'ControlledDrugPolicy':
      if (doc.controlled_type === 'restricted') doc.controlled_type = 'other';
      break;
    case 'ControlledDrugLedger':
      if (doc.action_type === 'adjust') doc.action_type = 'adjustment';
      break;
    case 'RequiredDocumentRule':
      if (doc.entity_type === 'procedure_result') doc.entity_type = 'procedure_order';
      break;
    default:
      break;
  }

  return doc;
}

function convertDocument(rawDoc, Model) {
  const doc = {};

  for (const [key, rawValue] of Object.entries(rawDoc)) {
    if (key === '_id') {
      doc._id = convertObjectId(rawValue);
      continue;
    }
    doc[key] = convertNestedIds(convertBySchema(rawValue, Model.schema.path(key)));
  }

  return doc;
}

async function prepareDocuments(modelName, rawDocs) {
  const Model = models[modelName];
  if (!Model || !Model.collection) {
    throw new Error(`Model not exported: ${modelName}`);
  }
  const docs = rawDocs.map((doc) => convertDocument(normalizeSeedDocument(modelName, doc), Model));
  const actualUniqueIndexes = DRY_RUN
    ? []
    : (await Model.collection.indexes()).filter((index) => index.unique && index.name !== '_id_');
  applyActualUniqueIndexes(docs, Model, actualUniqueIndexes);
  if (!DRY_RUN && !DELETE_MODE) {
    await avoidExistingUniqueConflicts(docs, Model, actualUniqueIndexes);
  }
  return { Model, docs };
}

function validateDocuments(docs, Model, modelName) {
  const errors = [];
  for (const doc of docs) {
    const instance = new Model(doc);
    const error = instance.validateSync();
    if (error) {
      errors.push(`${modelName}:${doc._id}: ${error.message}`);
    }
  }
  return errors;
}

async function importModel(modelName, rawDocs) {
  const { Model, docs } = await prepareDocuments(modelName, rawDocs);

  if (DELETE_MODE) {
    const ids = docs.map((doc) => doc._id).filter(Boolean);
    if (DRY_RUN) {
      return { model: modelName, collection: Model.collection.name, rows: ids.length, upserted: 0, modified: 0, deleted: 0 };
    }
    let deleted = 0;
    for (let index = 0; index < ids.length; index += BATCH_SIZE) {
      const result = await Model.collection.deleteMany({ _id: { $in: ids.slice(index, index + BATCH_SIZE) } });
      deleted += result.deletedCount || 0;
    }
    return { model: modelName, collection: Model.collection.name, rows: ids.length, upserted: 0, modified: 0, deleted };
  }

  const validationErrors = validateDocuments(docs, Model, modelName);
  if (validationErrors.length) {
    if (DRY_RUN) {
      return {
        model: modelName,
        collection: Model.collection.name,
        rows: docs.length,
        upserted: 0,
        modified: 0,
        deleted: 0,
        validationErrors,
      };
    }
    throw new Error(`Validation failed:\n${validationErrors.slice(0, 20).join('\n')}`);
  }

  if (DRY_RUN) {
    return { model: modelName, collection: Model.collection.name, rows: docs.length, upserted: 0, modified: 0, deleted: 0, validationErrors: [] };
  }

  let upserted = 0;
  let modified = 0;
  for (let index = 0; index < docs.length; index += BATCH_SIZE) {
    const batch = docs.slice(index, index + BATCH_SIZE);
    const result = await Model.collection.bulkWrite(
      batch.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      })),
      { ordered: false },
    );
    upserted += result.upsertedCount || 0;
    modified += result.modifiedCount || 0;
  }

  return { model: modelName, collection: Model.collection.name, rows: docs.length, upserted, modified, deleted: 0, validationErrors: [] };
}

async function main() {
  if (!fs.existsSync(JSON_FILE)) {
    throw new Error(`JSON seed file not found: ${JSON_FILE}`);
  }
  if (!DRY_RUN && !process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI.');
  }

  const seedData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  const entries = Object.entries(seedData);

  if (!DRY_RUN) {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || undefined,
    });
  }

  const dbName = DRY_RUN ? (process.env.MONGODB_DB_NAME || '(default from URI)') : mongoose.connection.db.databaseName;
  const action = DELETE_MODE ? 'Delete' : 'Import';
  console.log(`${DRY_RUN ? 'Dry run' : action} JSON seed data ${DELETE_MODE ? 'from' : 'into'} database: ${dbName}`);
  console.log(`JSON file: ${JSON_FILE}`);

  const totals = { models: 0, rows: 0, upserted: 0, modified: 0, deleted: 0 };
  const allValidationErrors = [];
  for (const [modelName, docs] of entries) {
    if (!Array.isArray(docs)) {
      throw new Error(`Expected array for ${modelName}.`);
    }
    const result = await importModel(modelName, docs);
    totals.models += 1;
    totals.rows += result.rows;
    totals.upserted += result.upserted;
    totals.modified += result.modified;
    totals.deleted += result.deleted;
    if (result.validationErrors && result.validationErrors.length) {
      allValidationErrors.push(...result.validationErrors);
    }
    console.log(
      `${result.model} (${result.collection}): rows=${result.rows}, upserted=${result.upserted}, modified=${result.modified}, deleted=${result.deleted}`,
    );
  }

  console.log(
    `Done. models=${totals.models}, rows=${totals.rows}, upserted=${totals.upserted}, modified=${totals.modified}, deleted=${totals.deleted}`,
  );
  if (allValidationErrors.length) {
    throw new Error(`Validation failed (${allValidationErrors.length} errors):\n${allValidationErrors.slice(0, 100).join('\n')}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
