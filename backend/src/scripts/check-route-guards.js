const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.resolve(__dirname, '..', 'routes');
const PUBLIC_ROUTE_FILES = new Set(['index.js', 'auth.routes.js']);

function listRouteFiles() {
  return fs.readdirSync(ROUTES_DIR)
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(ROUTES_DIR, name));
}

function checkRouteGuards() {
  const findings = [];

  for (const file of listRouteFiles()) {
    const name = path.basename(file);
    const content = fs.readFileSync(file, 'utf8');
    const routeCalls = content.match(/router\.(get|post|put|patch|delete)\(/g) || [];

    if (PUBLIC_ROUTE_FILES.has(name)) continue;
    if (routeCalls.length === 0) continue;

    const hasAuthenticate = content.includes('router.use(authenticate)') || content.includes('authenticate,');
    const hasAuthorize = content.includes('authorize(');

    if (!hasAuthenticate || !hasAuthorize) {
      findings.push({
        file: name,
        route_calls: routeCalls.length,
        has_authenticate: hasAuthenticate,
        has_authorize: hasAuthorize,
      });
    }
  }

  const result = {
    route_files_scanned: listRouteFiles().length,
    guard_findings: findings,
  };

  console.log(JSON.stringify(result, null, 2));
  if (findings.length > 0) process.exitCode = 1;
}

checkRouteGuards();
