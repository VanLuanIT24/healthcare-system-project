const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const models = require('../models');

const DEFAULT_CSV_DIR = 'C:\\Users\\phain\\Downloads\\vietnamese_seed_csv';
const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_MODE = process.argv.includes('--delete');
const cliCsvDir = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const CSV_DIR = process.env.CSV_SEED_DIR || cliCsvDir || DEFAULT_CSV_DIR;
const MANIFEST_FILE = path.join(CSV_DIR, '_manifest.csv');
const BATCH_SIZE = Number(process.env.CSV_IMPORT_BATCH_SIZE || 500);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value.endsWith('\r') ? value.slice(0, -1) : value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value.endsWith('\r') ? value.slice(0, -1) : value);
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.replace(/^\ufeff/, ''));

  return rows
    .slice(1)
    .filter((cells) => cells.some((cell) => cell !== ''))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function readCsv(filePath) {
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

function parseJsonMaybe(value) {
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (!['[', '{'].includes(trimmed[0])) return value;
  return JSON.parse(trimmed);
}

function convertObjectId(value) {
  if (!value) return undefined;
  if (value instanceof mongoose.Types.ObjectId) return value;
  const text = String(value).trim();
  return mongoose.Types.ObjectId.isValid(text) ? new mongoose.Types.ObjectId(text) : text;
}

function convertScalar(value, schemaType) {
  if (value === '') return undefined;

  const instance = schemaType && schemaType.instance;
  if (instance === 'ObjectId') return convertObjectId(value);
  if (instance === 'Date') return new Date(value);
  if (instance === 'Number') return Number(value);
  if (instance === 'Boolean') return String(value).toLowerCase() === 'true';
  if (instance === 'Array' || instance === 'Embedded' || instance === 'Map' || instance === 'Mixed') {
    return parseJsonMaybe(value);
  }

  return parseJsonMaybe(value);
}

function convertNestedIds(value) {
  if (Array.isArray(value)) return value.map(convertNestedIds);
  if (!value || typeof value !== 'object') return value;

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

function convertDocument(row, Model) {
  const doc = {};

  for (const [key, rawValue] of Object.entries(row)) {
    if (rawValue === '') continue;

    if (key === '_id') {
      doc._id = convertObjectId(rawValue);
      continue;
    }

    const schemaType = Model.schema.path(key);
    doc[key] = convertNestedIds(convertScalar(rawValue, schemaType));
  }

  return doc;
}

function stableKeyPart(value) {
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function fallbackUniqueValue(doc, fieldName, Model) {
  const schemaType = Model.schema.path(fieldName);
  const id = doc._id ? stableKeyPart(doc._id) : crypto.randomUUID().replace(/-/g, '');

  if (schemaType && schemaType.instance === 'ObjectId') return convertObjectId(id.slice(0, 24).padEnd(24, '0'));
  if (schemaType && schemaType.instance === 'Number') return Number.parseInt(id.slice(-8), 16);
  return `${Model.collection.name}_${fieldName}_${id}`.toUpperCase();
}

function dropOptionalDuplicateUniqueFields(docs, Model, extraUniqueIndexes = []) {
  const schemaUniqueIndexes = Model.schema.indexes().filter(([, options]) => options && options.unique);
  const uniqueIndexes = [...schemaUniqueIndexes, ...extraUniqueIndexes];

  for (const [fields, options] of uniqueIndexes) {
    const fieldNames = Object.keys(fields);
    if (!fieldNames.length || fieldNames.includes('_id')) continue;

    if (!options.sparse && !options.partialFilterExpression) {
      for (const doc of docs) {
        for (const fieldName of fieldNames) {
          if (doc[fieldName] === undefined || doc[fieldName] === null || doc[fieldName] === '') {
            doc[fieldName] = fallbackUniqueValue(doc, fieldName, Model);
          }
        }
      }
    }

    const droppableFields = fieldNames.filter((fieldName) => {
      const schemaType = Model.schema.path(fieldName);
      return schemaType && !schemaType.isRequired;
    });

    const seen = new Set();
    for (const doc of docs) {
      if (fieldNames.some((fieldName) => doc[fieldName] === undefined || doc[fieldName] === null || doc[fieldName] === '')) {
        continue;
      }

      const key = fieldNames.map((fieldName) => stableKeyPart(doc[fieldName])).join('\u001f');
      if (!seen.has(key)) {
        seen.add(key);
        continue;
      }

      for (const fieldName of fieldNames) {
        if (droppableFields.includes(fieldName)) {
          delete doc[fieldName];
        } else {
          doc[fieldName] = fallbackUniqueValue(doc, fieldName, Model);
        }
      }
    }
  }

  return docs;
}

async function importCollection(entry) {
  const Model = models[entry.model];
  if (!Model) {
    throw new Error(`Model not exported: ${entry.model}`);
  }

  const filePath = path.join(CSV_DIR, entry.file);
  const rows = readCsv(filePath);

  if (DELETE_MODE) {
    const ids = rows.map((row) => convertObjectId(row._id)).filter(Boolean);
    if (DRY_RUN) {
      return { collection: entry.collection, model: entry.model, rows: ids.length, upserted: 0, modified: 0, deleted: 0 };
    }

    const result = await Model.collection.deleteMany({ _id: { $in: ids } });
    return {
      collection: entry.collection,
      model: entry.model,
      rows: ids.length,
      upserted: 0,
      modified: 0,
      deleted: result.deletedCount || 0,
    };
  }

  const actualUniqueIndexes = DRY_RUN
    ? []
    : (await Model.collection.indexes())
      .filter((index) => index.unique && index.name !== '_id_')
      .map((index) => [index.key, index]);
  const docs = dropOptionalDuplicateUniqueFields(
    rows.map((row) => convertDocument(row, Model)),
    Model,
    actualUniqueIndexes,
  );

  if (DRY_RUN) {
    return { collection: entry.collection, model: entry.model, rows: docs.length, upserted: 0, modified: 0, deleted: 0 };
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

  return { collection: entry.collection, model: entry.model, rows: docs.length, upserted, modified, deleted: 0 };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI.');
  }

  if (!fs.existsSync(MANIFEST_FILE)) {
    throw new Error(`Manifest not found: ${MANIFEST_FILE}`);
  }

  const manifest = readCsv(MANIFEST_FILE).map((row) => ({
    collection: row.collection,
    model: row.model,
    file: row.file,
  }));

  if (!DRY_RUN) {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || undefined,
    });
  }

  const dbName = DRY_RUN ? (process.env.MONGODB_DB_NAME || '(default from URI)') : mongoose.connection.db.databaseName;
  const action = DELETE_MODE ? 'Delete' : 'Import';
  console.log(`${DRY_RUN ? 'Dry run' : action} CSV seed data ${DELETE_MODE ? 'from' : 'into'} database: ${dbName}`);
  console.log(`CSV directory: ${CSV_DIR}`);

  const totals = { collections: 0, rows: 0, upserted: 0, modified: 0, deleted: 0 };
  for (const entry of manifest) {
    const result = await importCollection(entry);
    totals.collections += 1;
    totals.rows += result.rows;
    totals.upserted += result.upserted;
    totals.modified += result.modified;
    totals.deleted += result.deleted;
    console.log(
      `${result.collection}: rows=${result.rows}, upserted=${result.upserted}, modified=${result.modified}, deleted=${result.deleted}`,
    );
  }

  console.log(
    `Done. collections=${totals.collections}, rows=${totals.rows}, upserted=${totals.upserted}, modified=${totals.modified}, deleted=${totals.deleted}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
