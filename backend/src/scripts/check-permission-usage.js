const fs = require('fs');
const path = require('path');
const { PERMISSION } = require('../constants/permissions');

const SRC_DIR = path.resolve(__dirname, '..');

function listJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

function resolvePermissionPath(pathExpression) {
  return pathExpression.split('.').reduce((value, key) => value?.[key], { PERMISSION });
}

function checkPermissionUsage() {
  const files = listJsFiles(SRC_DIR);
  const missing = [];
  const used = new Set();
  const pattern = /PERMISSION(?:\.[A-Z0-9_]+){2,}/g;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(pattern) || [];
    for (const expression of matches) {
      const value = resolvePermissionPath(expression);
      if (!value) {
        missing.push({ file: path.relative(SRC_DIR, file), expression });
      } else {
        used.add(value);
      }
    }
  }

  const result = {
    files_scanned: files.length,
    permission_codes_used: used.size,
    missing_references: missing,
  };

  console.log(JSON.stringify(result, null, 2));
  if (missing.length > 0) process.exitCode = 1;
}

checkPermissionUsage();
