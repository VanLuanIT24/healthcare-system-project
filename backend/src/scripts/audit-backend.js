const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const WORKSPACE_ROOT = path.resolve(BACKEND_ROOT, '..');
const SRC_DIR = path.join(BACKEND_ROOT, 'src');
const ROUTES_DIR = path.join(SRC_DIR, 'routes');
const CONTROLLERS_DIR = path.join(SRC_DIR, 'controllers');
const SERVICES_DIR = path.join(SRC_DIR, 'services');
const MODELS_DIR = path.join(SRC_DIR, 'models');
const REPOSITORIES_DIR = path.join(SRC_DIR, 'repositories');

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const PUBLIC_ROUTE_FILES = new Set(['index.js']);
const PUBLIC_ROUTE_HINTS = [
  'login',
  'register',
  'forgot',
  'reset-password',
  'verify-reset',
  'refresh-token',
  'password/validate',
  'logout',
  'health',
  'public',
  'active',
  'doctors',
  'available-slots',
];

const SELF_SERVICE_ROUTE_HINTS = [
  '/change-password',
  '/me',
  '/logout-all-devices',
  '/sessions/revoke',
];

const MODULE_PRIORITY = {
  auth: 1,
  iam: 1,
  admin: 1,
  staff: 1,
  department: 1,
  schedule: 1,
  appointment: 1,
  patient: 1,
  clinical: 1,
  encounter: 1,
  queue: 2,
  prescription: 2,
  laboratory: 2,
  imaging: 2,
  billing: 2,
  records: 2,
  inpatient: 2,
  order: 2,
  procedure: 2,
  reports: 3,
  audit: 3,
  notification: 3,
  dashboard: 3,
};

const REPOSITORY_ALIASES = {
  admin: ['admin.repository.js', 'iam.repository.js'],
  appointment: ['scheduling.repository.js'],
  auth: ['auth.repository.js'],
  audit: ['auth.repository.js'],
  billing: ['billing.repository.js'],
  clinical: ['clinical.repository.js'],
  dashboard: ['admin.repository.js', 'billing.repository.js', 'clinical.repository.js', 'scheduling.repository.js'],
  department: ['iam.repository.js', 'admin.repository.js'],
  encounter: ['clinical.repository.js'],
  iam: ['iam.repository.js'],
  imaging: ['imaging.repository.js'],
  inpatient: ['inpatient.repository.js'],
  laboratory: ['laboratory.repository.js'],
  notification: ['notification.repository.js'],
  order: ['order.repository.js'],
  patient: ['patient.repository.js'],
  prescription: ['pharmacy.repository.js'],
  procedure: ['procedure.repository.js'],
  queue: ['scheduling.repository.js'],
  records: ['records.repository.js'],
  reports: ['admin.repository.js', 'billing.repository.js', 'clinical.repository.js', 'scheduling.repository.js'],
  schedule: ['scheduling.repository.js'],
  staff: ['iam.repository.js', 'admin.repository.js'],
};

const MODEL_DIR_ALIASES = {
  admin: ['admin', 'iam'],
  appointment: ['scheduling'],
  auth: ['auth', 'patients', 'iam'],
  audit: ['auth'],
  billing: ['billing'],
  clinical: ['clinical'],
  dashboard: ['admin', 'auth', 'billing', 'clinical', 'scheduling'],
  department: ['iam'],
  encounter: ['clinical'],
  iam: ['iam'],
  imaging: ['imaging'],
  inpatient: ['inpatient'],
  laboratory: ['laboratory'],
  notification: ['notifications'],
  order: ['orders'],
  patient: ['patients'],
  prescription: ['pharmacy'],
  procedure: ['procedures'],
  queue: ['scheduling'],
  records: ['records'],
  reports: ['admin', 'auth', 'billing', 'clinical', 'scheduling'],
  schedule: ['scheduling'],
  staff: ['iam', 'admin'],
};

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function relativeFromBackend(filePath) {
  return toPosix(path.relative(BACKEND_ROOT, filePath));
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  }).sort();
}

function listDirectJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function countLineAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function findMatchingParen(content, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function findObjectBlock(content, startIndex) {
  const openIndex = content.indexOf('{', startIndex);
  if (openIndex === -1) return null;

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return {
          start: openIndex,
          end: i,
          body: content.slice(openIndex + 1, i),
        };
      }
    }
  }

  return null;
}

function splitTopLevelObjectEntries(body) {
  const entries = [];
  let entryStart = 0;
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    const next = body[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '(') depthParen += 1;
    else if (char === ')') depthParen -= 1;
    else if (char === '{') depthBrace += 1;
    else if (char === '}') depthBrace -= 1;
    else if (char === '[') depthBracket += 1;
    else if (char === ']') depthBracket -= 1;
    else if (char === ',' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
      entries.push(body.slice(entryStart, i));
      entryStart = i + 1;
    }
  }

  const last = body.slice(entryStart);
  if (last.trim()) entries.push(last);
  return entries;
}

function stripLeadingComments(entry) {
  return entry
    .replace(/^\s*\/\/.*(?:\r?\n|$)/gm, '')
    .replace(/^\s*\/\*[\s\S]*?\*\//, '')
    .trim();
}

function getExportName(entry) {
  const cleaned = stripLeadingComments(entry).replace(/,\s*$/, '').trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('...')) return cleaned;

  const propertyMatch = cleaned.match(/^(['"]?)([A-Za-z_$][\w$]*)\1\s*:/);
  if (propertyMatch) return propertyMatch[2];

  const shorthandMatch = cleaned.match(/^([A-Za-z_$][\w$]*)\b/);
  return shorthandMatch ? shorthandMatch[1] : null;
}

function parseModuleExports(content) {
  const start = content.indexOf('module.exports');
  if (start === -1) return [];

  const objectBlock = findObjectBlock(content, start);
  if (!objectBlock) {
    const directRequire = content.match(/module\.exports\s*=\s*require\(([^)]+)\)/);
    return directRequire ? ['__reexport__'] : [];
  }

  return splitTopLevelObjectEntries(objectBlock.body)
    .map(getExportName)
    .filter(Boolean);
}

function parseRequires(content, baseDir) {
  const requires = [];
  const pattern = /const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(['"]([^'"]+)['"]\)/g;
  let match;

  while ((match = pattern.exec(content))) {
    const [, variable, request] = match;
    let resolved = null;
    if (request.startsWith('.')) {
      resolved = path.resolve(baseDir, request);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() && fs.existsSync(path.join(resolved, 'index.js'))) {
        resolved = path.join(resolved, 'index.js');
      }
      if (!resolved.endsWith('.js') && fs.existsSync(`${resolved}.js`)) resolved += '.js';
    }
    requires.push({ variable, request, resolved });
  }

  return requires;
}

function parseRouterCalls(content) {
  const calls = [];
  const pattern = /router\.(get|post|put|patch|delete|use)\s*\(/g;
  let match;

  while ((match = pattern.exec(content))) {
    const method = match[1];
    const openIndex = content.indexOf('(', match.index);
    const closeIndex = findMatchingParen(content, openIndex);
    if (closeIndex === -1) continue;

    const source = content.slice(match.index, closeIndex + 1);
    const args = content.slice(openIndex + 1, closeIndex);
    const pathMatch = args.match(/^\s*(['"`])([^'"`]+)\1/);
    calls.push({
      method,
      source,
      args,
      start: match.index,
      end: closeIndex,
      line: countLineAt(content, match.index),
      path: pathMatch ? pathMatch[2] : null,
    });
    pattern.lastIndex = closeIndex + 1;
  }

  return calls;
}

function parseRouteMounts() {
  const indexPath = path.join(ROUTES_DIR, 'index.js');
  if (!fs.existsSync(indexPath)) return {};

  const content = readFile(indexPath);
  const imports = {};
  const requirePattern = /const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(['"]\.\/([^'"]+)['"]\)/g;
  let match;
  while ((match = requirePattern.exec(content))) {
    imports[match[1]] = match[2].endsWith('.js') ? match[2] : `${match[2]}.js`;
  }

  const mounts = {};
  const usePattern = /router\.use\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g;
  while ((match = usePattern.exec(content))) {
    const [, mountPath, variable] = match;
    if (imports[variable]) mounts[imports[variable]] = mountPath;
  }

  return mounts;
}

function parseControllerReferences(source) {
  return [...source.matchAll(/([A-Za-z_$][\w$]*Controller)\.([A-Za-z_$][\w$]*)/g)]
    .map((match) => ({ variable: match[1], method: match[2] }));
}

function parseServiceCalls(content) {
  return [...content.matchAll(/([A-Za-z_$][\w$]*Service)\.([A-Za-z_$][\w$]*)/g)]
    .map((match) => ({ variable: match[1], method: match[2] }));
}

function extractRouteParams(routePath) {
  if (!routePath) return [];
  return [...routePath.matchAll(/:([A-Za-z_$][\w$]*)/g)].map((match) => match[1]);
}

function extractRouterParams(content) {
  const params = new Set();
  const pattern = /router\.param\(\s*['"]([^'"]+)['"]\s*,\s*validateObjectIdParam\s*\)/g;
  let match;
  while ((match = pattern.exec(content))) params.add(match[1]);
  return params;
}

function findUseCallsBefore(calls, routeCall) {
  return calls.filter((call) => call.method === 'use' && call.start < routeCall.start);
}

function hasPermissionGuard(source) {
  return /authorize\s*\(\s*\{[\s\S]*(roles|permissions|allPermissions|anyPermissions)\s*:/.test(source);
}

function hasActorGuard(source) {
  return /authorize\s*\(\s*\{[\s\S]*actorTypes\s*:/.test(source);
}

function hasValidationMiddleware(call) {
  return /\b(validate|validator|validateBody|validateRequest)\b/.test(call.source);
}

function isPublicRoute(fileName, routePath, callSource) {
  if (PUBLIC_ROUTE_FILES.has(fileName)) return true;
  if (callSource.includes('authenticate') || callSource.includes('authorize(')) return false;
  if (!routePath) return false;
  return PUBLIC_ROUTE_HINTS.some((hint) => routePath.includes(hint));
}

function isSelfServiceRoute(fileName, routePath) {
  if (fileName !== 'auth.routes.js') return false;
  if (!routePath) return false;
  return SELF_SERVICE_ROUTE_HINTS.some((hint) => routePath === hint || routePath.startsWith(`${hint}/`));
}

function classifyControllerComplexity(content) {
  const directModelRequireCount = (content.match(/require\(['"]\.\.\/models/g) || []).length;
  const dbOperationCount = (content.match(/\.(find|findById|findOne|create|updateOne|updateMany|deleteOne|save)\s*\(/g) || []).length;
  const directResponseCount = (content.match(/\bres\.(json|status|send)\s*\(/g) || []).length;
  return {
    direct_model_requires: directModelRequireCount,
    direct_db_operations: dbOperationCount,
    direct_response_calls: directResponseCount,
    looks_thin: directModelRequireCount === 0 && dbOperationCount === 0 && directResponseCount === 0,
  };
}

function isMutatingName(name) {
  return /^(create|update|delete|remove|archive|merge|add|set|sync|assign|confirm|cancel|reschedule|complete|start|hold|resume|reopen|sign|amend|approve|reject|submit|settle|void|post|issue|refund|retire|recall|receive|adjust|activate|deactivate|unlock|lock|reset|request|verify|rotate|revoke|invalidate|cleanup|dispatch|retry|call|skip|reorder|transfer|acknowledge|schedule|upload|download|export|duplicate|renew|seed|bootstrap|select|store|dispose|collect|process|admit|discharge|force|mark|release|block|publish|finalize|seal|restore|stop)/.test(name);
}

function serviceHasAudit(content) {
  return /(recordAuditLog|logAuditAction|writeAuditLog|writeSuccessLog|writeFailureLog|record[A-Za-z]*Audit|auditService\.|recordIamAudit)/.test(content);
}

function serviceHasStatusTransition(content) {
  return /(StatusTransition|STATUS_TRANSITION|TRANSITION|assertValidStatusTransition|validate[A-Za-z]*Status)/.test(content);
}

function serviceHasSoftDelete(content) {
  return /(is_deleted|deleted_at|deleted_by|delete[A-Za-z]*Soft|archive[A-Za-z]*)/.test(content);
}

function buildStaticIndexes() {
  const controllerFiles = listDirectJsFiles(CONTROLLERS_DIR);
  const serviceFiles = listJsFiles(SERVICES_DIR);
  const routeFiles = listDirectJsFiles(ROUTES_DIR);
  const modelFiles = listJsFiles(MODELS_DIR);
  const repositoryFiles = listDirectJsFiles(REPOSITORIES_DIR);
  const exportCache = new Map();

  function parseExpandedExports(file, seen = new Set()) {
    if (!file || !fs.existsSync(file)) return [];
    if (exportCache.has(file)) return exportCache.get(file);
    if (seen.has(file)) return [];

    const content = readFile(file);
    const rawExports = parseModuleExports(content);
    const requires = parseRequires(content, path.dirname(file));
    const nextSeen = new Set(seen);
    nextSeen.add(file);
    const expanded = new Set();

    for (const exportName of rawExports) {
      if (exportName.startsWith('...')) {
        const variable = exportName.slice(3);
        const requiredFile = requires.find((item) => item.variable === variable)?.resolved;
        const childExports = parseExpandedExports(requiredFile, nextSeen);
        if (childExports.length === 0) expanded.add(exportName);
        for (const childExport of childExports) {
          if (childExport !== '__reexport__' && !childExport.startsWith('...')) expanded.add(childExport);
        }
      } else {
        expanded.add(exportName);
      }
    }

    const result = [...expanded];
    exportCache.set(file, result);
    return result;
  }

  const controllers = {};
  for (const file of controllerFiles) {
    const content = readFile(file);
    controllers[file] = {
      file,
      relative: relativeFromBackend(file),
      exports: parseModuleExports(content),
      requires: parseRequires(content, path.dirname(file)),
      serviceCalls: parseServiceCalls(content),
      complexity: classifyControllerComplexity(content),
      content,
    };
  }

  const services = {};
  for (const file of serviceFiles) {
    const content = readFile(file);
    services[file] = {
      file,
      relative: relativeFromBackend(file),
      exports: parseExpandedExports(file),
      has_audit: serviceHasAudit(content),
      has_status_transition: serviceHasStatusTransition(content),
      has_soft_delete: serviceHasSoftDelete(content),
      content,
    };
  }

  const serviceExportsByFile = new Map(Object.entries(services).map(([file, info]) => [file, new Set(info.exports)]));
  const controllerExportsByFile = new Map(Object.entries(controllers).map(([file, info]) => [file, new Set(info.exports)]));

  return {
    controllerFiles,
    serviceFiles,
    routeFiles,
    modelFiles,
    repositoryFiles,
    controllers,
    services,
    serviceExportsByFile,
    controllerExportsByFile,
  };
}

function analyzeRoutes(indexes) {
  const routeMounts = parseRouteMounts();
  const allRoutes = [];
  const routeFindings = {
    missing_controller_exports: [],
    missing_controller_imports: [],
    public_routes: [],
    routes_without_auth: [],
    routes_without_specific_permission: [],
    routes_self_service_auth_only: [],
    routes_actor_only: [],
    routes_missing_object_id_param_validation: [],
    mutating_routes_without_route_validation: [],
  };
  const controllerRouteUsage = new Map();

  for (const file of indexes.routeFiles) {
    const fileName = path.basename(file);
    if (fileName === 'index.js') continue;

    const content = readFile(file);
    const requires = parseRequires(content, path.dirname(file));
    const controllerImports = new Map(
      requires
        .filter((item) => item.resolved && item.resolved.includes(`${path.sep}controllers${path.sep}`))
        .map((item) => [item.variable, item.resolved]),
    );
    const routerParams = extractRouterParams(content);
    const calls = parseRouterCalls(content);
    const routeCalls = calls.filter((call) => HTTP_METHODS.has(call.method));

    for (const call of routeCalls) {
      const precedingUseCalls = findUseCallsBefore(calls, call);
      const precedingUseSource = precedingUseCalls.map((item) => item.source).join('\n');
      const controllerRefs = parseControllerReferences(call.source);
      const routePath = call.path || '(dynamic)';
      const mountedAt = routeMounts[fileName] || `/${fileName.replace(/\.routes\.js$/, '')}`;
      const fullPath = routePath === '/' ? mountedAt : `${mountedAt}${routePath}`;
      const hasAuth = call.source.includes('authenticate') || precedingUseSource.includes('authenticate');
      const hasAnyAuthorize = call.source.includes('authorize(') || precedingUseSource.includes('authorize(');
      const hasSpecificPermission = hasPermissionGuard(call.source) || hasPermissionGuard(precedingUseSource);
      const hasActorOnlyGuard = !hasSpecificPermission && (hasActorGuard(call.source) || hasActorGuard(precedingUseSource));
      const isPublic = !hasAuth && isPublicRoute(fileName, routePath, call.source);
      const isSelfService = hasAuth && !hasSpecificPermission && !hasActorOnlyGuard && isSelfServiceRoute(fileName, routePath);
      const params = extractRouteParams(routePath);
      const missingObjectIdParams = params.filter((param) => /Id$/.test(param) && !routerParams.has(param));
      const mutating = ['post', 'put', 'patch', 'delete'].includes(call.method);
      const hasRouteValidation = hasValidationMiddleware(call);

      const routeRecord = {
        file: relativeFromBackend(file),
        file_name: fileName,
        line: call.line,
        method: call.method.toUpperCase(),
        path: fullPath,
        local_path: routePath,
        controller_refs: controllerRefs,
        has_auth: hasAuth,
        has_authorize: hasAnyAuthorize,
        has_specific_permission: hasSpecificPermission,
        has_actor_only_guard: hasActorOnlyGuard,
        is_self_service: isSelfService,
        is_public: isPublic,
        has_route_validation: hasRouteValidation,
        object_id_params: params.filter((param) => /Id$/.test(param)),
        missing_object_id_params: missingObjectIdParams,
      };
      allRoutes.push(routeRecord);

      if (!hasAuth && !isPublic) {
        routeFindings.routes_without_auth.push(routeRecord);
      }

      if (isPublic) {
        routeFindings.public_routes.push(routeRecord);
      } else if (hasAuth && !hasSpecificPermission) {
        if (isSelfService) routeFindings.routes_self_service_auth_only.push(routeRecord);
        else if (hasActorOnlyGuard) routeFindings.routes_actor_only.push(routeRecord);
        else routeFindings.routes_without_specific_permission.push(routeRecord);
      }

      if (missingObjectIdParams.length > 0) {
        routeFindings.routes_missing_object_id_param_validation.push(routeRecord);
      }

      if (mutating && !hasRouteValidation) {
        routeFindings.mutating_routes_without_route_validation.push(routeRecord);
      }

      for (const ref of controllerRefs) {
        const controllerFile = controllerImports.get(ref.variable);
        if (!controllerFile) {
          routeFindings.missing_controller_imports.push({ ...routeRecord, ref });
          continue;
        }

        if (!controllerRouteUsage.has(controllerFile)) controllerRouteUsage.set(controllerFile, new Set());
        controllerRouteUsage.get(controllerFile).add(ref.method);

        const controllerExports = indexes.controllerExportsByFile.get(controllerFile);
        if (!controllerExports || !controllerExports.has(ref.method)) {
          routeFindings.missing_controller_exports.push({ ...routeRecord, ref, controller_file: relativeFromBackend(controllerFile) });
        }
      }
    }
  }

  return { routeMounts, allRoutes, routeFindings, controllerRouteUsage };
}

function analyzeControllers(indexes, controllerRouteUsage) {
  const findings = {
    controller_exports_without_route: [],
    controller_calls_missing_service_exports: [],
    controllers_with_business_logic: [],
    mutating_controller_exports_without_request_meta: [],
  };
  const serviceUsage = new Map();

  for (const controller of Object.values(indexes.controllers)) {
    const requiredServices = new Map(
      controller.requires
        .filter((item) => item.resolved && item.resolved.includes(`${path.sep}services${path.sep}`))
        .map((item) => [item.variable, item.resolved]),
    );

    const usedByRoutes = controllerRouteUsage.get(controller.file) || new Set();
    for (const exportName of controller.exports) {
      if (exportName === '__reexport__') continue;
      if (!usedByRoutes.has(exportName)) {
        findings.controller_exports_without_route.push({
          controller_file: controller.relative,
          export: exportName,
        });
      }

      const exportPattern = new RegExp(`${exportName}\\s*:\\s*[\\s\\S]{0,500}`);
      const exportSnippet = controller.content.match(exportPattern)?.[0] || '';
      if (isMutatingName(exportName) && !exportSnippet.includes('requestMeta(req)')) {
        findings.mutating_controller_exports_without_request_meta.push({
          controller_file: controller.relative,
          export: exportName,
        });
      }
    }

    if (!controller.complexity.looks_thin) {
      findings.controllers_with_business_logic.push({
        controller_file: controller.relative,
        ...controller.complexity,
      });
    }

    for (const call of controller.serviceCalls) {
      const serviceFile = requiredServices.get(call.variable);
      if (!serviceFile) continue;

      if (!serviceUsage.has(serviceFile)) serviceUsage.set(serviceFile, new Set());
      serviceUsage.get(serviceFile).add(call.method);

      const serviceExports = indexes.serviceExportsByFile.get(serviceFile);
      if (!serviceExports || !serviceExports.has(call.method)) {
        findings.controller_calls_missing_service_exports.push({
          controller_file: controller.relative,
          service_file: relativeFromBackend(serviceFile),
          service_variable: call.variable,
          method: call.method,
        });
      }
    }
  }

  return { controllerFindings: findings, serviceUsage };
}

function analyzeServices(indexes, serviceUsage) {
  const findings = {
    service_exports_not_called_by_controllers: [],
    mutating_service_exports_without_audit_in_file: [],
    workflow_service_files_without_status_transition_hint: [],
    service_files_without_soft_delete_hint: [],
  };

  const workflowHints = /(appointment|schedule|queue|encounter|clinical|order|procedure|prescription|laboratory|imaging|inpatient|billing|records)/;

  for (const service of Object.values(indexes.services)) {
    const usedByControllers = serviceUsage.get(service.file) || new Set();
    for (const exportName of service.exports) {
      if (exportName === '__reexport__' || exportName.startsWith('...')) continue;

      if (!usedByControllers.has(exportName)) {
        findings.service_exports_not_called_by_controllers.push({
          service_file: service.relative,
          export: exportName,
        });
      }

      if (isMutatingName(exportName) && !service.has_audit) {
        findings.mutating_service_exports_without_audit_in_file.push({
          service_file: service.relative,
          export: exportName,
        });
      }
    }

    if (workflowHints.test(service.relative) && !service.has_status_transition) {
      findings.workflow_service_files_without_status_transition_hint.push(service.relative);
    }

    if (!service.has_soft_delete && /(patient|staff|department|admin|iam|records|billing|prescription|inpatient)/.test(service.relative)) {
      findings.service_files_without_soft_delete_hint.push(service.relative);
    }
  }

  return findings;
}

function parsePermissionReferences() {
  const files = listJsFiles(SRC_DIR);
  const permissionRefs = [];
  const pattern = /PERMISSION(?:\.[A-Z0-9_]+){2,}/g;
  for (const file of files) {
    const content = readFile(file);
    const matches = content.match(pattern) || [];
    for (const expression of matches) {
      permissionRefs.push({ file: relativeFromBackend(file), expression });
    }
  }
  return permissionRefs;
}

function buildModuleMatrix(indexes, routeAnalysis, controllerAnalysis, serviceFindings) {
  const routeGroups = new Map();
  for (const route of routeAnalysis.allRoutes) {
    const key = route.file_name.replace(/\.routes\.js$/, '');
    if (!routeGroups.has(key)) routeGroups.set(key, []);
    routeGroups.get(key).push(route);
  }

  const modules = [];
  for (const [key, routes] of [...routeGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const routeFile = `${key}.routes.js`;
    const controllerFiles = new Set();
    const serviceFiles = new Set();

    const routePath = path.join(ROUTES_DIR, routeFile);
    const routeContent = readFile(routePath);
    for (const req of parseRequires(routeContent, ROUTES_DIR)) {
      if (req.resolved && req.resolved.includes(`${path.sep}controllers${path.sep}`)) controllerFiles.add(req.resolved);
    }

    for (const controllerFile of controllerFiles) {
      const controller = indexes.controllers[controllerFile];
      if (!controller) continue;
      for (const req of controller.requires) {
        if (req.resolved && req.resolved.includes(`${path.sep}services${path.sep}`)) serviceFiles.add(req.resolved);
      }
    }

    const repositoryCandidates = (REPOSITORY_ALIASES[key] || [`${key}.repository.js`])
      .map((name) => path.join(REPOSITORIES_DIR, name))
      .filter((file) => fs.existsSync(file))
      .map(relativeFromBackend);

    const modelDirs = MODEL_DIR_ALIASES[key] || [key];
    const modelFiles = indexes.modelFiles
      .filter((file) => modelDirs.some((dir) => relativeFromBackend(file).startsWith(`src/models/${dir}/`)))
      .map(relativeFromBackend);

    const moduleRouteFindings = {
      missing_controller_exports: routeAnalysis.routeFindings.missing_controller_exports.filter((item) => item.file_name === routeFile).length,
      routes_without_auth: routeAnalysis.routeFindings.routes_without_auth.filter((item) => item.file_name === routeFile).length,
      routes_without_specific_permission: routeAnalysis.routeFindings.routes_without_specific_permission.filter((item) => item.file_name === routeFile).length,
      routes_self_service_auth_only: routeAnalysis.routeFindings.routes_self_service_auth_only.filter((item) => item.file_name === routeFile).length,
      routes_actor_only: routeAnalysis.routeFindings.routes_actor_only.filter((item) => item.file_name === routeFile).length,
      missing_object_id_param_validation: routeAnalysis.routeFindings.routes_missing_object_id_param_validation.filter((item) => item.file_name === routeFile).length,
      mutating_without_route_validation: routeAnalysis.routeFindings.mutating_routes_without_route_validation.filter((item) => item.file_name === routeFile).length,
    };

    const controllerMissingServices = controllerAnalysis.controllerFindings.controller_calls_missing_service_exports
      .filter((item) => [...controllerFiles].some((file) => relativeFromBackend(file) === item.controller_file)).length;

    const serviceRelatives = [...serviceFiles].map(relativeFromBackend);
    const serviceExportsUnused = serviceFindings.service_exports_not_called_by_controllers
      .filter((item) => serviceRelatives.includes(item.service_file)).length;

    let status = 'Ổn kỹ thuật';
    if (moduleRouteFindings.missing_controller_exports > 0 || controllerMissingServices > 0 || moduleRouteFindings.routes_without_auth > 0) {
      status = 'Lỗi nối dây/bảo mật';
    } else if (
      moduleRouteFindings.routes_without_specific_permission > 0
      || moduleRouteFindings.routes_actor_only > 0
      || moduleRouteFindings.missing_object_id_param_validation > 0
      || moduleRouteFindings.mutating_without_route_validation > 0
    ) {
      status = 'Cần rà bảo mật/validation';
    }

    modules.push({
      module: key,
      priority: MODULE_PRIORITY[key] || 3,
      route_base: routeAnalysis.routeMounts[routeFile] || null,
      models: modelFiles,
      repositories: repositoryCandidates,
      controllers: [...controllerFiles].map(relativeFromBackend),
      services: serviceRelatives,
      route_count: routes.length,
      service_exports_unused: serviceExportsUnused,
      controller_missing_services: controllerMissingServices,
      findings: moduleRouteFindings,
      status,
    });
  }

  return modules;
}

function limitList(items, limit = 25) {
  if (items.length <= limit) return items;
  return [...items.slice(0, limit), `... và ${items.length - limit} mục khác`];
}

function formatFindingRoute(item) {
  return `${item.method} ${item.path} (${item.file}:${item.line})`;
}

function formatCheck(ok, label) {
  return `- [${ok ? 'x' : ' '}] ${label}`;
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push('# BACKEND AUDIT');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Tổng quan');
  lines.push('');
  lines.push(`- Route files scanned: ${report.summary.route_files}`);
  lines.push(`- Routes scanned: ${report.summary.routes}`);
  lines.push(`- Controller files scanned: ${report.summary.controller_files}`);
  lines.push(`- Service files scanned: ${report.summary.service_files}`);
  lines.push(`- Model files scanned: ${report.summary.model_files}`);
  lines.push(`- Repository files scanned: ${report.summary.repository_files}`);
  lines.push('');
  lines.push('## Ma Trận Module');
  lines.push('');
  lines.push('| Module | Priority | Models | Repository | Service | Controller | Routes | Permission/Auth Issues | Validation Issues | Trạng thái |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const moduleInfo of report.modules) {
    const permissionIssues = moduleInfo.findings.routes_without_auth
      + moduleInfo.findings.routes_without_specific_permission
      + moduleInfo.findings.routes_actor_only;
    const validationIssues = moduleInfo.findings.missing_object_id_param_validation
      + moduleInfo.findings.mutating_without_route_validation;
    lines.push([
      moduleInfo.module,
      moduleInfo.priority,
      moduleInfo.models.length,
      moduleInfo.repositories.length,
      moduleInfo.services.length,
      moduleInfo.controllers.length,
      moduleInfo.route_count,
      permissionIssues,
      validationIssues,
      moduleInfo.status,
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  lines.push('');

  lines.push('## Phát Hiện Quan Trọng');
  lines.push('');
  lines.push(`- Missing route -> controller exports: ${report.findings.route.missing_controller_exports.length}`);
  lines.push(`- Controller calls missing service exports: ${report.findings.controller.controller_calls_missing_service_exports.length}`);
  lines.push(`- Routes without auth: ${report.findings.route.routes_without_auth.length}`);
  lines.push(`- Protected routes without specific permission guard: ${report.findings.route.routes_without_specific_permission.length}`);
  lines.push(`- Self-service auth-only routes: ${report.findings.route.routes_self_service_auth_only.length}`);
  lines.push(`- Actor-only guarded routes: ${report.findings.route.routes_actor_only.length}`);
  lines.push(`- Routes missing ObjectId param validation: ${report.findings.route.routes_missing_object_id_param_validation.length}`);
  lines.push(`- Mutating routes without explicit route-level validation middleware: ${report.findings.route.mutating_routes_without_route_validation.length}`);
  lines.push(`- Controller exports not routed: ${report.findings.controller.controller_exports_without_route.length}`);
  lines.push(`- Service exports not called by controllers: ${report.findings.service.service_exports_not_called_by_controllers.length}`);
  lines.push('');

  lines.push('### Lỗi Nối Dây');
  lines.push('');
  if (report.findings.route.missing_controller_exports.length === 0 && report.findings.controller.controller_calls_missing_service_exports.length === 0) {
    lines.push('- [x] Không phát hiện route gọi controller không tồn tại hoặc controller gọi service export không tồn tại.');
  } else {
    for (const item of limitList(report.findings.route.missing_controller_exports, 50)) {
      if (typeof item === 'string') lines.push(`- ${item}`);
      else lines.push(`- [ ] ${formatFindingRoute(item)} -> ${item.ref.variable}.${item.ref.method} không có trong ${item.controller_file}`);
    }
    for (const item of limitList(report.findings.controller.controller_calls_missing_service_exports, 50)) {
      if (typeof item === 'string') lines.push(`- ${item}`);
      else lines.push(`- [ ] ${item.controller_file} gọi ${item.service_variable}.${item.method}, nhưng ${item.service_file} không export hàm này.`);
    }
  }
  lines.push('');

  lines.push('### Public / Auth / Permission');
  lines.push('');
  lines.push('Public routes detected:');
  for (const item of limitList(report.findings.route.public_routes.map(formatFindingRoute), 30)) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('Routes without auth:');
  if (report.findings.route.routes_without_auth.length === 0) lines.push('- [x] Không phát hiện route thiếu auth ngoài nhóm public.');
  for (const item of limitList(report.findings.route.routes_without_auth, 50)) {
    if (typeof item === 'string') lines.push(`- ${item}`);
    else lines.push(`- [ ] ${formatFindingRoute(item)}`);
  }
  lines.push('');
  lines.push('Actor-only routes cần rà owner/scope trong service:');
  for (const item of limitList(report.findings.route.routes_actor_only, 50)) {
    if (typeof item === 'string') lines.push(`- ${item}`);
    else lines.push(`- [ ] ${formatFindingRoute(item)}`);
  }
  lines.push('');

  lines.push('Self-service auth-only routes (thường hợp lý, cần bảo đảm chỉ thao tác trên chính tài khoản hiện tại):');
  for (const item of limitList(report.findings.route.routes_self_service_auth_only, 50)) {
    if (typeof item === 'string') lines.push(`- ${item}`);
    else lines.push(`- [ ] ${formatFindingRoute(item)}`);
  }
  lines.push('');

  lines.push('### Validation');
  lines.push('');
  lines.push('Routes missing ObjectId param validation:');
  if (report.findings.route.routes_missing_object_id_param_validation.length === 0) lines.push('- [x] Tất cả route params dạng *Id đều có router.param validateObjectIdParam.');
  for (const item of limitList(report.findings.route.routes_missing_object_id_param_validation, 50)) {
    if (typeof item === 'string') lines.push(`- ${item}`);
    else lines.push(`- [ ] ${formatFindingRoute(item)} thiếu validateObjectIdParam cho: ${item.missing_object_id_params.join(', ')}`);
  }
  lines.push('');
  lines.push('Mutating routes without explicit route-level validation middleware:');
  for (const item of limitList(report.findings.route.mutating_routes_without_route_validation, 60)) {
    if (typeof item === 'string') lines.push(`- ${item}`);
    else lines.push(`- [ ] ${formatFindingRoute(item)}`);
  }
  lines.push('');

  lines.push('## Nhận Định Nhanh');
  lines.push('');
  lines.push('- [x] Vòng 1 nối dây ổn: không phát hiện route gọi controller thiếu export, cũng không phát hiện controller gọi service method thiếu export.');
  lines.push('- [x] Route-level auth/permission tổng thể ổn: sau khi tách nhóm public và self-service, không còn route protected nào thiếu permission/role guard theo static scan.');
  lines.push('- [ ] Public surface cần xác nhận nghiệp vụ: `/admin/doctors`, `/departments/active`, `/schedules/:scheduleId/available-slots`, auth login/register/refresh/logout/reset-password.');
  lines.push('- [ ] Actor-only routes cần owner/scope check: static scan thấy nhóm `/appointments/my`, `/patients/me`, patient account self-update. Service hiện có dấu hiệu dùng `auth.patientId`, `assertAppointmentReadable`, `canReadPatient`, `getManagedPatientAccount`; vẫn nên test case bệnh nhân A truy cập dữ liệu bệnh nhân B.');
  lines.push('- [ ] IAM ObjectId validation cần quyết định: `roleId`/`permissionId` đang bị flag vì chưa có `router.param`. Nếu API cố ý cho nhập role code/permission code thì không thêm ObjectId validator; nếu chỉ nhận Mongo ObjectId thì nên bổ sung.');
  lines.push('- [ ] Body/query validation là khoảng trống lớn nhất: 355 mutating routes chưa có validator middleware ở route boundary. Service có nhiều validation nghiệp vụ, nhưng frontend/API sẽ ổn định hơn nếu thêm validator rõ ràng theo module ưu tiên.');
  lines.push('');

  lines.push('## Ưu Tiên Tiếp Theo');
  lines.push('');
  lines.push('1. Auth/IAM: xác nhận public endpoints, self-service owner check, và quyết định `roleId`/`permissionId` là ObjectId hay id/code.');
  lines.push('2. Schedule + Appointment: thêm validator middleware cho create/update/action payload và test workflow status transition.');
  lines.push('3. Patient + Clinical: test owner/scope bệnh nhân, bác sĩ chỉ xem dữ liệu được phân công, và validate payload lâm sàng.');
  lines.push('4. Billing/Lab/Imaging/Prescription/Records: bổ sung validators theo API mutating có rủi ro cao trước.');
  lines.push('');

  lines.push('## Checklist Theo Module');
  for (const moduleInfo of report.modules) {
    const permissionIssues = moduleInfo.findings.routes_without_auth
      + moduleInfo.findings.routes_without_specific_permission
      + moduleInfo.findings.routes_actor_only;
    const validationIssues = moduleInfo.findings.missing_object_id_param_validation
      + moduleInfo.findings.mutating_without_route_validation;
    lines.push('');
    lines.push(`### ${moduleInfo.module} Module`);
    lines.push('');
    lines.push(formatCheck(moduleInfo.models.length > 0, `Models (${moduleInfo.models.length}): ${moduleInfo.models.map((item) => `\`${item}\``).join(', ') || 'chưa phát hiện'}`));
    lines.push(formatCheck(moduleInfo.repositories.length > 0, `Repositories (${moduleInfo.repositories.length}): ${moduleInfo.repositories.map((item) => `\`${item}\``).join(', ') || 'chưa phát hiện'}`));
    lines.push(formatCheck(moduleInfo.services.length > 0, `Services (${moduleInfo.services.length}): ${moduleInfo.services.map((item) => `\`${item}\``).join(', ') || 'chưa phát hiện'}`));
    lines.push(formatCheck(moduleInfo.controllers.length > 0, `Controllers (${moduleInfo.controllers.length}): ${moduleInfo.controllers.map((item) => `\`${item}\``).join(', ') || 'chưa phát hiện'}`));
    lines.push(formatCheck(moduleInfo.route_count > 0, `Routes: ${moduleInfo.route_count}`));
    lines.push(formatCheck(moduleInfo.findings.missing_controller_exports === 0, `Route gọi controller tồn tại: ${moduleInfo.findings.missing_controller_exports} lỗi`));
    lines.push(formatCheck(moduleInfo.controller_missing_services === 0, `Controller gọi service export tồn tại: ${moduleInfo.controller_missing_services} lỗi`));
    lines.push(formatCheck(permissionIssues === 0, `Auth/permission cần rà: ${permissionIssues}`));
    lines.push(formatCheck(validationIssues === 0, `Validation cần rà: ${validationIssues}`));
    lines.push(formatCheck(moduleInfo.service_exports_unused === 0, `Service exports chưa được controller gọi trực tiếp: ${moduleInfo.service_exports_unused}`));
    lines.push(`- Trạng thái: ${moduleInfo.status}`);
  }
  lines.push('');

  lines.push('## Ghi Chú Diễn Giải');
  lines.push('');
  lines.push('- `Service exports chưa được controller gọi trực tiếp` không luôn là lỗi: nhiều hàm là helper nội bộ, hàm dùng bởi service khác, hoặc API chưa mở ra UI.');
  lines.push('- `Mutating routes without explicit route-level validation middleware` là cảnh báo route-level. Một số validation hiện đang nằm trong service, nhưng nếu muốn frontend/API ổn định hơn thì nên thêm validator ở route/controller boundary.');
  lines.push('- `Actor-only routes` thường đúng với API `/my`, patient portal hoặc public-staff scope, nhưng cần rà owner check trong service.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function buildReport() {
  const indexes = buildStaticIndexes();
  const routeAnalysis = analyzeRoutes(indexes);
  const controllerAnalysis = analyzeControllers(indexes, routeAnalysis.controllerRouteUsage);
  const serviceFindings = analyzeServices(indexes, controllerAnalysis.serviceUsage);
  const permissionReferences = parsePermissionReferences();
  const modules = buildModuleMatrix(indexes, routeAnalysis, controllerAnalysis, serviceFindings);

  return {
    summary: {
      route_files: indexes.routeFiles.length,
      routes: routeAnalysis.allRoutes.length,
      controller_files: indexes.controllerFiles.length,
      service_files: indexes.serviceFiles.length,
      model_files: indexes.modelFiles.length,
      repository_files: indexes.repositoryFiles.length,
      permission_references: permissionReferences.length,
    },
    modules,
    routes: routeAnalysis.allRoutes,
    findings: {
      route: routeAnalysis.routeFindings,
      controller: controllerAnalysis.controllerFindings,
      service: serviceFindings,
    },
  };
}

function parseArgs(argv) {
  const args = {
    json: false,
    markdown: false,
    output: path.join(WORKSPACE_ROOT, 'BACKEND_AUDIT.md'),
  };

  for (const arg of argv) {
    if (arg === '--json') args.json = true;
    else if (arg === '--markdown') args.markdown = true;
    else if (arg.startsWith('--output=')) args.output = path.resolve(arg.slice('--output='.length));
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildReport();

  if (args.markdown) {
    const markdown = buildMarkdownReport(report);
    fs.writeFileSync(args.output, markdown, 'utf8');
  }

  if (args.json || !args.markdown) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(JSON.stringify({
      output: args.output,
      summary: report.summary,
      critical: {
        missing_controller_exports: report.findings.route.missing_controller_exports.length,
        controller_calls_missing_service_exports: report.findings.controller.controller_calls_missing_service_exports.length,
        routes_without_auth: report.findings.route.routes_without_auth.length,
        routes_without_specific_permission: report.findings.route.routes_without_specific_permission.length,
        self_service_auth_only_routes: report.findings.route.routes_self_service_auth_only.length,
        actor_only_routes: report.findings.route.routes_actor_only.length,
        missing_object_id_param_validation: report.findings.route.routes_missing_object_id_param_validation.length,
        mutating_routes_without_route_validation: report.findings.route.mutating_routes_without_route_validation.length,
      },
    }, null, 2));
  }
}

main();
