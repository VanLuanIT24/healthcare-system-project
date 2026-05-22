const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  AdminToolApproval,
  AdminToolFinding,
  AdminToolRun,
  Appointment,
  Bed,
  BedAssignment,
  BroadcastCampaign,
  Department,
  DocumentExportRequest,
  EventOutbox,
  IdempotencyRecord,
  Invoice,
  JobRunLog,
  LabOrder,
  LabResult,
  Notification,
  NotificationDelivery,
  PasswordResetToken,
  Payment,
  Permission,
  QrToken,
  Role,
  RolePermission,
  ScheduleSlot,
  StockBatch,
  SupportReplyTemplate,
  SupportTicket,
  User,
} = require('../models');
const { mongoose } = require('../config/database');
const env = require('../config/env');
const accessControlService = require('./access-control.service');
const workerHealthService = require('./worker-health.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  recordAuditLog,
} = require('./core.service');
const {
  CORE_ROLES,
  PERMISSION_CODES,
  ROLE_CODES,
  ROLE_PERMISSION_MAP,
} = require('../constants/permissions');
const {
  ACTIVE_APPOINTMENT_STATUSES,
  BED_ASSIGNMENT_STATUS,
  BED_STATUS,
  DOCUMENT_EXPORT_STATUS,
  INVOICE_STATUS,
  LAB_ORDER_STATUS,
  LAB_RESULT_STATUS,
  PAYMENT_STATUS,
} = require('../constants/statuses');
const { normalizeScheduleType } = require('../constants/catalogs/schedule-types');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(BACKEND_ROOT, 'src');
const ROUTES_DIR = path.join(SRC_DIR, 'routes');
const PUBLIC_ROUTE_FILES = new Set(['index.js', 'auth.routes.js']);
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

const TOOL_REGISTRY = [
  {
    tool_code: 'route-guards',
    tool_name: 'Kiểm tra route guards',
    category: 'security',
    risk_level: 'high',
    tool_type: 'read_only_scanner',
    modes: ['scan', 'export'],
    description: 'Phân tích Express routes để phát hiện thiếu authenticate, authorize, permission guard và validation.',
    primary_action: 'Run scan',
  },
  {
    tool_code: 'rbac-integrity',
    tool_name: 'Kiểm tra RBAC integrity',
    category: 'iam',
    risk_level: 'high',
    tool_type: 'scanner_with_repair',
    modes: ['scan', 'dry_run', 'apply'],
    description: 'So khớp constants, DB roles, permissions và role-permission links.',
    primary_action: 'Run integrity check',
  },
  {
    tool_code: 'permission-map',
    tool_name: 'Kiểm tra permission map',
    category: 'iam',
    risk_level: 'medium',
    tool_type: 'read_only_scanner',
    modes: ['scan', 'export'],
    description: 'Quét PERMISSION.* trong source, phát hiện missing reference và quyền dùng trong code nhưng chưa gán role.',
    primary_action: 'Run permission scan',
  },
  {
    tool_code: 'data-consistency',
    tool_name: 'Kiểm tra data consistency',
    category: 'data_quality',
    risk_level: 'critical',
    tool_type: 'dry_run_fixer',
    modes: ['scan', 'dry_run', 'apply'],
    description: 'Kiểm tra lệch invoice balance, slot booked count, bed occupancy, stock, lab/order và document export.',
    primary_action: 'Run consistency scan',
  },
  {
    tool_code: 'indexes',
    tool_name: 'Đồng bộ indexes',
    category: 'database',
    risk_level: 'danger',
    tool_type: 'dangerous_apply_tool',
    modes: ['scan', 'dry_run', 'apply'],
    description: 'Diff schema indexes với MongoDB indexes, sync safe-only hoặc all.',
    primary_action: 'Run index diff',
  },
  {
    tool_code: 'system-access-sync',
    tool_name: 'Đồng bộ quyền hệ thống',
    category: 'iam',
    risk_level: 'high',
    tool_type: 'dry_run_fixer',
    modes: ['scan', 'dry_run', 'apply'],
    description: 'Preview và apply sync core roles, permissions, role-permission links.',
    primary_action: 'Run access diff',
  },
  {
    tool_code: 'migrations',
    tool_name: 'Migration tools',
    category: 'migration',
    risk_level: 'danger',
    tool_type: 'dangerous_apply_tool',
    modes: ['scan', 'dry_run', 'apply'],
    description: 'Catalog migration nội bộ, dry-run/apply migration có audit và approval.',
    primary_action: 'Open migration catalog',
  },
  {
    tool_code: 'demo-data',
    tool_name: 'Demo data tools',
    category: 'demo',
    risk_level: 'danger',
    tool_type: 'dangerous_apply_tool',
    modes: ['scan', 'dry_run', 'apply'],
    description: 'Preview seed packs, namespace demo data và cleanup demo data.',
    primary_action: 'Preview demo packs',
  },
  {
    tool_code: 'cleanup',
    tool_name: 'Cleanup tools',
    category: 'retention',
    risk_level: 'high',
    tool_type: 'dry_run_fixer',
    modes: ['scan', 'dry_run', 'apply'],
    description: 'Dry-run cleanup expired sessions, QR tokens, idempotency records, job logs, notifications và outbox.',
    primary_action: 'Run cleanup dry-run',
  },
  {
    tool_code: 'cache',
    tool_name: 'Rebuild cache',
    category: 'cache',
    risk_level: 'medium',
    tool_type: 'operational_action',
    modes: ['scan', 'dry_run', 'apply'],
    description: 'Xem trạng thái cache phân quyền và clear/rebuild selected hoặc toàn bộ.',
    primary_action: 'Check cache',
  },
  {
    tool_code: 'exports',
    tool_name: 'Export hệ thống',
    category: 'export',
    risk_level: 'high',
    tool_type: 'export_tool',
    modes: ['export'],
    description: 'Tạo manifest export cấu hình/IAM/audit/diagnostics với mask secret.',
    primary_action: 'Create export',
  },
  {
    tool_code: 'developer-diagnostics',
    tool_name: 'Developer diagnostics',
    category: 'diagnostics',
    risk_level: 'medium',
    tool_type: 'diagnostic',
    modes: ['diagnostic', 'export'],
    description: 'Runtime, database, realtime, worker, integrations và backend audit summary.',
    primary_action: 'Run diagnostics',
  },
];

function nowIso() {
  return new Date().toISOString();
}

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function actorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || null;
}

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function getTool(toolCode) {
  const tool = TOOL_REGISTRY.find((item) => item.tool_code === toolCode);
  if (!tool) throw createError('Không tìm thấy admin tool.', 404);
  return tool;
}

function listJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  }).sort();
}

function relativeFromSrc(filePath) {
  return path.relative(SRC_DIR, filePath).split(path.sep).join('/');
}

function stripLineComments(content) {
  return content
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

function severityRank(severity) {
  return {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  }[severity] || 1;
}

function summarizeFindings(findings = []) {
  const summary = {
    total_findings: findings.length,
    critical_count: 0,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    info_count: 0,
    auto_fixable_count: findings.filter((item) => item.auto_fixable).length,
    manual_review_count: findings.filter((item) => !item.auto_fixable).length,
  };
  findings.forEach((finding) => {
    const key = `${finding.severity || 'info'}_count`;
    if (summary[key] !== undefined) summary[key] += 1;
  });
  return summary;
}

function runStatusFromFindings(findings = []) {
  if (findings.some((item) => item.severity === 'critical')) return 'success_with_warnings';
  if (findings.some((item) => ['high', 'medium', 'low'].includes(item.severity))) return 'success_with_warnings';
  return 'success';
}

function buildFinding(data = {}) {
  return {
    severity: data.severity || 'info',
    type: data.type || 'finding',
    domain: data.domain,
    module: data.module,
    file: data.file,
    line: data.line,
    method: data.method,
    route: data.route,
    object_type: data.object_type,
    object_id: data.object_id,
    message: data.message || data.type || 'Finding',
    evidence: data.evidence || {},
    suggested_fix: data.suggested_fix || {},
    auto_fixable: Boolean(data.auto_fixable),
    status: 'open',
  };
}

function flattenPermissions(source = {}, prefix = []) {
  return Object.entries(source).flatMap(([key, value]) => {
    if (typeof value === 'string') return [{ expression: [...prefix, key].join('.'), permission_code: value }];
    if (value && typeof value === 'object') return flattenPermissions(value, [...prefix, key]);
    return [];
  });
}

async function listTools() {
  const latestRuns = await AdminToolRun.aggregate([
    { $sort: { created_at: -1 } },
    { $group: { _id: '$tool_code', latest: { $first: '$$ROOT' } } },
  ]);
  const latestByTool = new Map(latestRuns.map((item) => [item._id, item.latest]));
  return TOOL_REGISTRY.map((tool) => ({
    ...tool,
    latest_run: latestByTool.get(tool.tool_code) || null,
  }));
}

async function getToolDetail(toolCode) {
  const tool = getTool(toolCode);
  const [latestRun, openFindings, runCount] = await Promise.all([
    AdminToolRun.findOne({ tool_code: toolCode }).sort({ created_at: -1 }).lean(),
    AdminToolFinding.countDocuments({ tool_code: toolCode, status: { $in: ['open', 'regressed'] } }),
    AdminToolRun.countDocuments({ tool_code: toolCode }),
  ]);
  return {
    ...tool,
    latest_run: latestRun,
    open_findings: openFindings,
    run_count: runCount,
  };
}

async function getOverview() {
  const [tools, openFindings, latestRuns, requiresApproval, workerHealth] = await Promise.all([
    listTools(),
    AdminToolFinding.find({ status: { $in: ['open', 'regressed'] } }).sort({ severity: -1, created_at: -1 }).limit(20).lean(),
    AdminToolRun.find({}).sort({ created_at: -1 }).limit(10).lean(),
    AdminToolRun.countDocuments({ status: 'requires_approval' }),
    workerHealthService.getWorkerHealth().catch(() => null),
  ]);
  const critical = openFindings.filter((item) => item.severity === 'critical').length;
  const high = openFindings.filter((item) => item.severity === 'high').length;
  return {
    kpis: {
      tools: tools.length,
      critical_findings: critical,
      high_findings: high,
      open_findings: openFindings.length,
      requires_approval: requiresApproval,
      outbox_failed: workerHealth?.outbox?.failed || 0,
      notification_failed: workerHealth?.notification_delivery?.failed || 0,
    },
    tools,
    work_queue: openFindings,
    recent_runs: latestRuns,
    worker_health: workerHealth,
    checked_at: nowIso(),
  };
}

async function createRunRecord(tool, payload = {}, actor = {}, requestMeta = {}) {
  const mode = payload.mode || tool.modes?.[0] || 'scan';
  return AdminToolRun.create({
    tool_code: tool.tool_code,
    tool_name: tool.tool_name,
    category: tool.category,
    mode,
    status: 'running',
    risk_level: tool.risk_level || 'info',
    requested_by: actorUserId(actor),
    input: payload,
    environment: env.nodeEnv || process.env.NODE_ENV || 'development',
    app_version: process.env.APP_VERSION || undefined,
    git_commit: process.env.GIT_COMMIT || undefined,
    started_at: new Date(),
    request_id: requestMeta.requestId || requestMeta.request_id,
    correlation_id: payload.correlation_id,
  });
}

async function persistRunResult(run, output = {}) {
  const findings = (output.findings || []).map((finding) => ({
    ...finding,
    run_id: run._id,
    tool_code: run.tool_code,
  }));
  if (findings.length > 0) await AdminToolFinding.insertMany(findings);
  const finishedAt = new Date();
  run.summary = {
    ...(output.summary || {}),
    ...summarizeFindings(findings),
  };
  run.result = output.result || {};
  run.status = output.status || runStatusFromFindings(findings);
  run.finished_at = finishedAt;
  run.duration_ms = finishedAt.getTime() - new Date(run.started_at).getTime();
  await run.save();
  return getRun(run._id);
}

async function failRun(run, error) {
  const finishedAt = new Date();
  run.status = 'failed';
  run.error_message = error.message;
  run.error_stack = error.stack;
  run.finished_at = finishedAt;
  run.duration_ms = finishedAt.getTime() - new Date(run.started_at).getTime();
  await run.save();
  return getRun(run._id);
}

async function runTool(toolCode, payload = {}, actor = {}, requestMeta = {}) {
  const tool = getTool(toolCode);
  const run = await createRunRecord(tool, payload, actor, requestMeta);
  await recordAuditLog({
    actor,
    action: `admin_tools.${toolCode}.run`,
    targetType: 'admin_tool_run',
    targetId: run._id,
    status: 'success',
    message: `Run admin tool ${toolCode}.`,
    requestMeta,
    metadata: { mode: run.mode, risk_level: tool.risk_level },
  });
  try {
    const output = await executeTool(toolCode, payload, actor, requestMeta);
    return persistRunResult(run, output);
  } catch (error) {
    return failRun(run, error);
  }
}

async function executeTool(toolCode, payload = {}, actor = {}, requestMeta = {}) {
  const runners = {
    'route-guards': scanRouteGuards,
    'rbac-integrity': scanRbacIntegrity,
    'permission-map': scanPermissionMap,
    'data-consistency': scanDataConsistency,
    indexes: scanIndexes,
    'system-access-sync': scanSystemAccessSync,
    migrations: scanMigrations,
    'demo-data': scanDemoData,
    cleanup: scanCleanup,
    cache: scanCache,
    exports: scanExports,
    'developer-diagnostics': scanDeveloperDiagnostics,
  };
  const runner = runners[toolCode];
  if (!runner) throw createError('Tool chưa có runner.', 501);
  return runner(payload, actor, requestMeta);
}

function parseRouteCalls(content) {
  const routeRegex = /router\.(get|post|put|patch|delete)\s*\(([\s\S]*?)\)\s*;/g;
  const routes = [];
  let match;
  while ((match = routeRegex.exec(content))) {
    const call = match[0];
    const method = match[1];
    const pathMatch = call.match(/router\.(?:get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/);
    routes.push({
      method,
      path: pathMatch?.[1] || '(dynamic)',
      has_authorize: /\bauthorize\s*\(/.test(call),
      has_authenticate: /\bauthenticate\b/.test(call),
      has_specific_permission: /PERMISSION\.[A-Z0-9_]+\.[A-Z0-9_]+/.test(call),
      has_actor_guard: /actorTypes\s*:/.test(call),
      has_body_validation: /validate|validator|idempotencyRequired|createActionRateLimit/.test(call),
      line: content.slice(0, match.index).split(/\r?\n/).length,
    });
  }
  return routes;
}

async function scanRouteGuards() {
  const files = fs.readdirSync(ROUTES_DIR)
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(ROUTES_DIR, name));
  const findings = [];
  const moduleRows = [];
  let routesDetected = 0;
  let actorOnlyRoutes = 0;
  let missingSpecificPermission = 0;
  let missingObjectIdValidation = 0;
  let mutatingMissingValidation = 0;

  files.forEach((filePath) => {
    const name = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const source = stripLineComments(content);
    const routes = parseRouteCalls(source);
    routesDetected += routes.length;
    if (routes.length === 0 || PUBLIC_ROUTE_FILES.has(name)) return;

    const hasAuthenticate = /router\.use\s*\(\s*authenticate\s*\)/.test(source) || routes.some((route) => route.has_authenticate);
    const hasAuthorize = /router\.use\s*\(\s*authorize\s*\(/.test(source) || routes.some((route) => route.has_authorize);
    const hasObjectIdParam = /validateObjectIdParam|validateObjectIdParams|router\.param/.test(source);
    const missingValidationRoutes = routes.filter((route) => MUTATING_METHODS.has(route.method) && !route.has_body_validation);
    const actorOnly = routes.filter((route) => route.has_authorize && route.has_actor_guard && !route.has_specific_permission);
    const noPermission = routes.filter((route) => route.has_authorize && !route.has_specific_permission);

    actorOnlyRoutes += actorOnly.length;
    missingSpecificPermission += noPermission.length;
    if (!hasObjectIdParam && /:\w+Id\b/.test(source)) missingObjectIdValidation += 1;
    mutatingMissingValidation += missingValidationRoutes.length;

    const fileRisk = !hasAuthenticate && !hasAuthorize ? 'critical' : !hasAuthenticate ? 'high' : !hasAuthorize ? 'high' : actorOnly.length ? 'medium' : 'low';
    moduleRows.push({
      file: name,
      risk: fileRisk,
      route_count: routes.length,
      has_authenticate: hasAuthenticate,
      has_authorize: hasAuthorize,
      actor_only_routes: actorOnly.length,
      missing_specific_permission: noPermission.length,
      missing_object_id_validation: !hasObjectIdParam && /:\w+Id\b/.test(source),
      mutating_routes_missing_validation: missingValidationRoutes.length,
    });

    if (!hasAuthenticate || !hasAuthorize) {
      findings.push(buildFinding({
        severity: fileRisk,
        type: 'route_file_missing_guard',
        domain: 'security',
        module: name.replace('.routes.js', ''),
        file: `src/routes/${name}`,
        message: `${name} thiếu ${!hasAuthenticate ? 'authenticate' : ''}${!hasAuthenticate && !hasAuthorize ? ' và ' : ''}${!hasAuthorize ? 'authorize' : ''}.`,
        evidence: { route_calls: routes.length, has_authenticate: hasAuthenticate, has_authorize: hasAuthorize },
        suggested_fix: {
          type: name.startsWith('dev-') ? 'gate_dev_route' : 'add_auth_guard',
          description: name.startsWith('dev-')
            ? 'Chỉ mount dev route ngoài production hoặc thêm authenticate + authorize super_admin.'
            : 'Thêm router.use(authenticate) và authorize permission cụ thể.',
        },
      }));
    }

    actorOnly.forEach((route) => findings.push(buildFinding({
      severity: 'medium',
      type: 'route_actor_only_authorize',
      domain: 'security',
      module: name.replace('.routes.js', ''),
      file: `src/routes/${name}`,
      line: route.line,
      method: route.method.toUpperCase(),
      route: route.path,
      message: `${route.method.toUpperCase()} ${route.path} chỉ có actor guard, chưa thấy permission cụ thể.`,
      evidence: route,
      suggested_fix: { type: 'add_specific_permission', description: 'Thêm anyPermissions/permissions cụ thể theo nghiệp vụ.' },
    })));

    if (!hasObjectIdParam && /:\w+Id\b/.test(source)) {
      findings.push(buildFinding({
        severity: 'medium',
        type: 'missing_object_id_param_validation',
        domain: 'validation',
        module: name.replace('.routes.js', ''),
        file: `src/routes/${name}`,
        message: `${name} có route param id nhưng chưa thấy validateObjectIdParam/router.param.`,
        evidence: { pattern: ':*Id', has_object_id_param_validator: false },
        suggested_fix: { type: 'add_param_validator', description: 'Thêm router.param(..., validateObjectIdParam) cho các ObjectId route params.' },
        auto_fixable: false,
      }));
    }
  });

  return {
    summary: {
      route_files_scanned: files.length,
      routes_detected: routesDetected,
      files_missing_authenticate: moduleRows.filter((item) => !item.has_authenticate).length,
      files_missing_authorize: moduleRows.filter((item) => !item.has_authorize).length,
      actor_only_routes: actorOnlyRoutes,
      routes_without_specific_permission: missingSpecificPermission,
      missing_object_id_validation: missingObjectIdValidation,
      mutating_routes_missing_validation: mutatingMissingValidation,
    },
    result: { module_matrix: moduleRows.sort((a, b) => severityRank(b.risk) - severityRank(a.risk)) },
    findings,
  };
}

async function scanRbacIntegrity(payload = {}) {
  const coreRoleCodes = CORE_ROLES.map((role) => role.role_code);
  const duplicateCoreRoles = coreRoleCodes.filter((roleCode, index) => coreRoleCodes.indexOf(roleCode) !== index);
  const roleMapUnknownRoles = Object.keys(ROLE_PERMISSION_MAP).filter((roleCode) => !ROLE_CODES.includes(roleCode));
  const roleMapMissingCoreRoles = Object.keys(ROLE_PERMISSION_MAP).filter((roleCode) => !coreRoleCodes.includes(roleCode));
  const roleMapUnknownPermissions = Object.entries(ROLE_PERMISSION_MAP).flatMap(([roleCode, permissionCodes]) => (
    permissionCodes
      .filter((permissionCode) => !PERMISSION_CODES.includes(permissionCode))
      .map((permissionCode) => ({ role_code: roleCode, permission_code: permissionCode }))
  ));

  const [permissions, roles, rolePermissions] = await Promise.all([
    Permission.find({ is_deleted: false }).lean(),
    Role.find({ is_deleted: false }).lean(),
    RolePermission.find({ is_active: true }).lean(),
  ]);
  const permissionCodesInDb = new Set(permissions.map((permission) => permission.permission_code));
  const roleCodesInDb = new Set(roles.map((role) => role.role_code));
  const permissionIdsInDb = new Set(permissions.map((permission) => toId(permission._id)));
  const roleIdsInDb = new Set(roles.map((role) => toId(role._id)));
  const missingPermissions = PERMISSION_CODES.filter((code) => !permissionCodesInDb.has(code));
  const missingRoles = coreRoleCodes.filter((roleCode) => !roleCodesInDb.has(roleCode));
  const extraPermissionsInDb = permissions.map((permission) => permission.permission_code).filter((code) => !PERMISSION_CODES.includes(code));
  const danglingRolePermissions = rolePermissions.filter((item) => !roleIdsInDb.has(toId(item.role_id)) || !permissionIdsInDb.has(toId(item.permission_id)));

  const findings = [
    ...duplicateCoreRoles.map((roleCode) => buildFinding({ severity: 'critical', type: 'duplicate_core_role', domain: 'iam', object_type: 'role', object_id: roleCode, message: `Duplicate core role ${roleCode}.`, evidence: { role_code: roleCode } })),
    ...roleMapUnknownRoles.map((roleCode) => buildFinding({ severity: 'critical', type: 'role_map_unknown_role', domain: 'iam', object_type: 'role', object_id: roleCode, message: `ROLE_PERMISSION_MAP tham chiếu role không có trong ROLE_CODES: ${roleCode}.`, evidence: { role_code: roleCode } })),
    ...roleMapMissingCoreRoles.map((roleCode) => buildFinding({ severity: 'medium', type: 'role_map_missing_core_role', domain: 'iam', object_type: 'role', object_id: roleCode, message: `ROLE_PERMISSION_MAP có role chưa nằm trong CORE_ROLES: ${roleCode}.`, evidence: { role_code: roleCode } })),
    ...roleMapUnknownPermissions.map((item) => buildFinding({ severity: 'critical', type: 'role_map_unknown_permission', domain: 'iam', object_type: 'permission', object_id: item.permission_code, message: `${item.permission_code} không có trong PERMISSION_CODES.`, evidence: item })),
    ...missingPermissions.map((code) => buildFinding({ severity: 'high', type: 'permission_missing_in_db', domain: 'iam', object_type: 'permission', object_id: code, message: `Permission ${code} có trong constants nhưng thiếu DB.`, evidence: { permission_code: code }, auto_fixable: true, suggested_fix: { action: 'seed_permission' } })),
    ...missingRoles.map((roleCode) => buildFinding({ severity: 'high', type: 'role_missing_in_db', domain: 'iam', object_type: 'role', object_id: roleCode, message: `Role ${roleCode} có trong CORE_ROLES nhưng thiếu DB.`, evidence: { role_code: roleCode }, auto_fixable: true, suggested_fix: { action: 'seed_role' } })),
    ...extraPermissionsInDb.map((code) => buildFinding({ severity: 'medium', type: 'permission_extra_in_db', domain: 'iam', object_type: 'permission', object_id: code, message: `Permission ${code} có trong DB nhưng không còn trong constants.`, evidence: { permission_code: code } })),
    ...danglingRolePermissions.map((item) => buildFinding({ severity: 'critical', type: 'dangling_role_permission', domain: 'iam', object_type: 'role_permission', object_id: toId(item._id), message: 'RolePermission trỏ tới role hoặc permission không tồn tại.', evidence: { role_id: toId(item.role_id), permission_id: toId(item.permission_id) }, auto_fixable: true, suggested_fix: { action: 'deactivate_role_permission' } })),
  ];

  return {
    summary: {
      roles_in_constants: ROLE_CODES.length,
      core_roles: coreRoleCodes.length,
      role_permission_roles: Object.keys(ROLE_PERMISSION_MAP).length,
      permissions_in_constants: PERMISSION_CODES.length,
      permissions_in_db: permissions.length,
      roles_in_db: roles.length,
      active_role_permissions: rolePermissions.length,
      missing_permissions: missingPermissions.length,
      missing_roles: missingRoles.length,
    },
    result: {
      constants: {
        duplicate_core_roles: [...new Set(duplicateCoreRoles)],
        role_map_unknown_roles: roleMapUnknownRoles,
        role_map_missing_core_roles: roleMapMissingCoreRoles,
        role_map_unknown_permissions: roleMapUnknownPermissions,
      },
      database: {
        missing_permissions: missingPermissions,
        missing_roles: missingRoles,
        extra_permissions_in_db: extraPermissionsInDb,
        dangling_role_permissions: danglingRolePermissions.map((item) => ({ id: toId(item._id), role_id: toId(item.role_id), permission_id: toId(item.permission_id) })),
      },
      role_matrix: buildRoleMatrix(),
      dry_run_repair: payload.mode === 'dry_run' ? { would_seed_roles: missingRoles, would_seed_permissions: missingPermissions, would_deactivate_role_permissions: danglingRolePermissions.length } : undefined,
    },
    findings,
  };
}

function buildRoleMatrix() {
  const modules = ['users', 'iam', 'billing', 'clinical', 'pharmacy', 'admin', 'notifications', 'support'];
  return Object.entries(ROLE_PERMISSION_MAP).map(([roleCode, permissions]) => {
    const row = { role_code: roleCode };
    modules.forEach((module) => {
      const count = permissions.filter((permission) => permission.startsWith(module) || permission.includes(`.${module}`) || permission.includes(`${module}_`)).length;
      row[module] = count;
    });
    row.total_permissions = permissions.length;
    return row;
  });
}

async function scanPermissionMap() {
  const files = listJsFiles(SRC_DIR);
  const permissionExpressions = flattenPermissions({ PERMISSION: require('../constants/permissions').PERMISSION });
  const byExpression = new Map(permissionExpressions.map((item) => [item.expression, item.permission_code]));
  const used = new Map();
  const missing = [];
  const pattern = /PERMISSION(?:\.[A-Z0-9_]+){2,}/g;

  files.forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.match(pattern) || [];
    matches.forEach((expression) => {
      const code = byExpression.get(expression);
      if (!code) {
        missing.push({ file: relativeFromSrc(filePath), expression });
        return;
      }
      const current = used.get(code) || { permission_code: code, files: new Set(), routes: [] };
      current.files.add(relativeFromSrc(filePath));
      if (relativeFromSrc(filePath).startsWith('routes/')) current.routes.push(relativeFromSrc(filePath));
      used.set(code, current);
    });
  });

  const roleAssignments = Object.values(ROLE_PERMISSION_MAP);
  const usedWithoutRole = [...used.keys()].filter((permissionCode) => !roleAssignments.some((codes) => codes.includes(permissionCode))).sort();
  const definedUnused = PERMISSION_CODES.filter((permissionCode) => !used.has(permissionCode)).sort();
  const findings = [
    ...missing.map((item) => buildFinding({ severity: 'critical', type: 'permission_missing_reference', domain: 'iam', file: item.file, message: `${item.expression} không resolve được trong PERMISSION constants.`, evidence: item })),
    ...usedWithoutRole.map((code) => buildFinding({ severity: isDangerousPermission(code) ? 'high' : 'medium', type: 'permission_used_but_not_assigned', domain: 'iam', object_type: 'permission', object_id: code, message: `${code} được dùng trong code nhưng chưa nằm trong default role map.`, evidence: { files: [...used.get(code).files], routes: used.get(code).routes }, suggested_fix: { action: 'propose_role_update', suggested_roles: suggestRolesForPermission(code) } })),
    ...definedUnused.slice(0, 80).map((code) => buildFinding({ severity: 'low', type: 'permission_defined_but_unused', domain: 'iam', object_type: 'permission', object_id: code, message: `${code} có trong constants nhưng chưa thấy dùng trong source.`, evidence: { permission_code: code } })),
  ];

  return {
    summary: {
      files_scanned: files.length,
      permissions_declared: PERMISSION_CODES.length,
      permission_codes_used: used.size,
      missing_references: missing.length,
      used_but_not_assigned: usedWithoutRole.length,
      defined_but_unused: definedUnused.length,
      high_risk_permissions: usedWithoutRole.filter(isDangerousPermission).length,
    },
    result: {
      coverage: [...used.values()].map((item) => ({
        permission_code: item.permission_code,
        files: [...item.files],
        route_files: item.routes,
        assigned_roles: Object.entries(ROLE_PERMISSION_MAP).filter(([, codes]) => codes.includes(item.permission_code)).map(([role]) => role),
        risk_level: isDangerousPermission(item.permission_code) ? 'high' : 'medium',
      })),
      used_permissions_without_default_role: usedWithoutRole,
      defined_but_unused: definedUnused,
      missing_references: missing,
    },
    findings,
  };
}

function isDangerousPermission(permissionCode) {
  return /refund|reverse|void|delete|archive|merge|broadcast|full_access|maintenance|production|secret|export|revoke|force_logout/i.test(permissionCode);
}

function suggestRolesForPermission(permissionCode) {
  if (/payment|invoice|billing|receipt|reconciliation/.test(permissionCode)) return ['super_admin', 'billing_manager', 'cashier_supervisor'];
  if (/clinical|encounter|lab|imaging|prescription/.test(permissionCode)) return ['super_admin', 'doctor', 'clinical_admin'];
  if (/notification|broadcast/.test(permissionCode)) return ['super_admin', 'admin', 'operations_manager'];
  if (/patient|relative|authorization/.test(permissionCode)) return ['super_admin', 'portal_admin', 'patient_support_staff'];
  return ['super_admin', 'admin'];
}

async function scanDataConsistency(payload = {}) {
  const mode = payload.mode || 'scan';
  const apply = mode === 'apply';
  const [
    invoiceIssues,
    slotIssues,
    bedIssues,
    stockIssues,
    paymentInvoiceIssues,
    labIssues,
    appointmentIssues,
    exportIssues,
  ] = await Promise.all([
    checkInvoiceBalances(apply),
    checkSlotBookedCounts(apply),
    checkBedOccupancy(apply),
    checkNegativeStock(),
    checkPaymentInvoiceSync(),
    checkLabOrderSync(),
    checkCompletedAppointmentsHaveEncounter(),
    checkReadyExportsHaveFile(),
  ]);
  const issues = [
    ...invoiceIssues,
    ...slotIssues,
    ...bedIssues,
    ...stockIssues,
    ...paymentInvoiceIssues,
    ...labIssues,
    ...appointmentIssues,
    ...exportIssues,
  ];
  const findings = issues.map(issueToFinding);
  return {
    status: apply && findings.some((item) => !item.auto_fixable) ? 'partially_applied' : undefined,
    summary: {
      success: issues.length === 0,
      issue_count: issues.length,
      billing_issues: issues.filter((item) => item.domain === 'billing').length,
      clinical_issues: issues.filter((item) => ['clinical', 'lab'].includes(item.domain)).length,
      inventory_issues: issues.filter((item) => item.domain === 'pharmacy').length,
      auto_fixable_issues: findings.filter((item) => item.auto_fixable).length,
      manual_review_issues: findings.filter((item) => !item.auto_fixable).length,
      mode,
    },
    result: {
      mode,
      issues,
      fix_plan: issues.filter((item) => item.auto_fixable).map((item) => item.suggested_update || item),
    },
    findings,
  };
}

async function checkInvoiceBalances(apply = false) {
  const invoices = await Invoice.find({ status: { $ne: INVOICE_STATUS.VOIDED } }).limit(2000);
  const issues = [];
  for (const invoice of invoices) {
    const expectedBalance = Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0);
    if (Number(invoice.balance_due || 0) !== expectedBalance) {
      const issue = {
        type: 'invoice_balance_mismatch',
        domain: 'billing',
        object_type: 'invoice',
        object_id: toId(invoice._id),
        expected_balance_due: expectedBalance,
        actual_balance_due: invoice.balance_due,
        auto_fixable: true,
        suggested_update: { balance_due: expectedBalance },
      };
      issues.push(issue);
      if (apply) {
        invoice.balance_due = Math.max(0, expectedBalance);
        await invoice.save();
      }
    }
  }
  return issues;
}

async function checkSlotBookedCounts(apply = false) {
  const slots = await ScheduleSlot.find({ is_deleted: false }).select('_id booked_count').limit(2000);
  const issues = [];
  for (const slot of slots) {
    const activeCount = await Appointment.countDocuments({ schedule_slot_id: slot._id, is_deleted: false, status: { $in: ACTIVE_APPOINTMENT_STATUSES } });
    if (Number(slot.booked_count || 0) !== activeCount) {
      issues.push({ type: 'slot_booked_count_mismatch', domain: 'scheduling', object_type: 'schedule_slot', object_id: toId(slot._id), expected_booked_count: activeCount, actual_booked_count: slot.booked_count || 0, auto_fixable: true, suggested_update: { booked_count: activeCount } });
      if (apply) {
        slot.booked_count = activeCount;
        await slot.save();
      }
    }
  }
  return issues;
}

async function checkBedOccupancy(apply = false) {
  const beds = await Bed.find({ status: BED_STATUS.OCCUPIED }).select('_id bed_code status').limit(1000);
  const issues = [];
  for (const bed of beds) {
    const assignment = await BedAssignment.findOne({ bed_id: bed._id, status: BED_ASSIGNMENT_STATUS.ACTIVE }).lean();
    if (!assignment) {
      issues.push({ type: 'bed_occupied_without_active_assignment', domain: 'inpatient', object_type: 'bed', object_id: toId(bed._id), bed_code: bed.bed_code, auto_fixable: true, suggested_update: { status: BED_STATUS.AVAILABLE } });
      if (apply) {
        bed.status = BED_STATUS.AVAILABLE;
        await bed.save();
      }
    }
  }
  return issues;
}

async function checkNegativeStock() {
  const batches = await StockBatch.find({ quantity_on_hand: { $lt: 0 } }).limit(500).lean();
  return batches.map((batch) => ({ type: 'stock_quantity_negative', domain: 'pharmacy', object_type: 'stock_batch', object_id: toId(batch._id), medication_id: toId(batch.medication_id), quantity_on_hand: batch.quantity_on_hand, auto_fixable: false }));
}

async function checkPaymentInvoiceSync() {
  const payments = await Payment.find({ status: PAYMENT_STATUS.COMPLETED }).limit(2000).lean();
  const issues = [];
  for (const payment of payments) {
    const invoice = await Invoice.findById(payment.invoice_id).lean();
    if (invoice && ![INVOICE_STATUS.PAID, INVOICE_STATUS.PARTIALLY_PAID].includes(invoice.status)) {
      issues.push({ type: 'payment_completed_invoice_not_paid_status', domain: 'billing', object_type: 'payment', object_id: toId(payment._id), payment_id: toId(payment._id), invoice_id: toId(invoice._id), invoice_status: invoice.status, auto_fixable: false });
    }
  }
  return issues;
}

async function checkLabOrderSync() {
  const results = await LabResult.find({ status: { $in: [LAB_RESULT_STATUS.FINAL, LAB_RESULT_STATUS.AMENDED] } }).limit(2000).lean();
  const issues = [];
  for (const result of results) {
    const order = await LabOrder.findById(result.lab_order_id).lean();
    if (order && order.status !== LAB_ORDER_STATUS.COMPLETED) {
      issues.push({ type: 'lab_finalized_order_not_completed', domain: 'lab', object_type: 'lab_result', object_id: toId(result._id), lab_result_id: toId(result._id), lab_order_id: toId(order._id), lab_order_status: order.status, auto_fixable: false });
    }
  }
  return issues;
}

async function checkCompletedAppointmentsHaveEncounter() {
  const appointments = await Appointment.find({ status: 'completed', is_deleted: false }).select('_id').limit(2000).lean();
  const issues = [];
  const Encounter = require('../models').Encounter;
  for (const appointment of appointments) {
    const encounter = await Encounter.findOne({ appointment_id: appointment._id, status: { $ne: 'cancelled' } }).lean();
    if (!encounter) issues.push({ type: 'appointment_completed_without_encounter', domain: 'scheduling', object_type: 'appointment', object_id: toId(appointment._id), appointment_id: toId(appointment._id), auto_fixable: false });
  }
  return issues;
}

async function checkReadyExportsHaveFile() {
  const exports = await DocumentExportRequest.find({ status: DOCUMENT_EXPORT_STATUS.READY }).limit(1000).lean();
  return exports
    .filter((item) => !item.file_url || (path.isAbsolute(String(item.file_url)) && !fs.existsSync(item.file_url)))
    .map((item) => ({ type: 'document_export_ready_file_missing', domain: 'records', object_type: 'document_export_request', object_id: toId(item._id), export_id: toId(item._id), file_url: item.file_url || null, auto_fixable: false }));
}

function issueToFinding(issue = {}) {
  const severityByType = {
    invoice_balance_mismatch: 'high',
    payment_completed_invoice_not_paid_status: 'high',
    stock_quantity_negative: 'critical',
    lab_finalized_order_not_completed: 'high',
    bed_occupied_without_active_assignment: 'medium',
    slot_booked_count_mismatch: 'medium',
    appointment_completed_without_encounter: 'medium',
    document_export_ready_file_missing: 'medium',
  };
  return buildFinding({
    severity: severityByType[issue.type] || 'medium',
    type: issue.type,
    domain: issue.domain,
    object_type: issue.object_type,
    object_id: issue.object_id,
    message: `${issue.type} trên ${issue.object_type || 'object'} ${issue.object_id || ''}`.trim(),
    evidence: issue,
    suggested_fix: issue.suggested_update || {},
    auto_fixable: Boolean(issue.auto_fixable),
  });
}

async function scanIndexes(payload = {}) {
  const mode = payload.mode || 'scan';
  const modelNames = Object.keys(mongoose.models).sort();
  const diffs = [];
  const findings = [];
  for (const modelName of modelNames) {
    const model = mongoose.models[modelName];
    const declared = model.schema.indexes().map(([keys, options]) => ({ keys, options: options || {} }));
    let existing = [];
    try {
      existing = await model.collection.listIndexes().toArray();
    } catch (error) {
      findings.push(buildFinding({ severity: 'medium', type: 'index_list_failed', domain: 'database', module: modelName, object_type: 'collection', object_id: model.collection.name, message: `Không đọc được indexes collection ${model.collection.name}: ${error.message}`, evidence: { error: error.message } }));
      continue;
    }
    const existingNames = new Set(existing.map((item) => JSON.stringify(item.key)));
    const declaredNames = new Set(declared.map((item) => JSON.stringify(item.keys)));
    const missing = declared.filter((item) => !existingNames.has(JSON.stringify(item.keys)));
    const extra = existing.filter((item) => item.name !== '_id_' && !declaredNames.has(JSON.stringify(item.key)));
    if (missing.length || extra.length) {
      diffs.push({ model: modelName, collection: model.collection.name, declared_count: declared.length, existing_count: existing.length, missing_indexes: missing, extra_indexes: extra });
      missing.forEach((index) => findings.push(buildFinding({ severity: index.options?.unique ? 'high' : 'medium', type: 'missing_index', domain: 'database', module: modelName, object_type: 'collection', object_id: model.collection.name, message: `${modelName} thiếu index ${JSON.stringify(index.keys)}.`, evidence: index, auto_fixable: true, suggested_fix: { action: 'create_index', safe: !index.options?.unique } })));
      extra.forEach((index) => findings.push(buildFinding({ severity: 'high', type: 'extra_index', domain: 'database', module: modelName, object_type: 'collection', object_id: model.collection.name, message: `${modelName} có extra index ${index.name}.`, evidence: index, auto_fixable: false, suggested_fix: { action: 'review_before_drop' } })));
    }
    if (mode === 'apply' && missing.length && normalizeBoolean(payload.apply_safe_only)) {
      await model.syncIndexes({ background: true }).catch(() => null);
    }
  }
  return {
    summary: {
      models_loaded: modelNames.length,
      collections_checked: modelNames.length,
      models_with_diff: diffs.length,
      missing_indexes: diffs.reduce((sum, item) => sum + item.missing_indexes.length, 0),
      extra_indexes: diffs.reduce((sum, item) => sum + item.extra_indexes.length, 0),
      mode,
    },
    result: { diffs },
    findings,
  };
}

async function scanSystemAccessSync(payload = {}) {
  const [roles, permissions, rolePermissions] = await Promise.all([
    Role.find({ is_deleted: false }).lean(),
    Permission.find({ is_deleted: false }).lean(),
    RolePermission.find({ is_active: true }).lean(),
  ]);
  const dbRoleCodes = new Set(roles.map((role) => role.role_code));
  const dbPermissionCodes = new Set(permissions.map((permission) => permission.permission_code));
  const missingRoles = CORE_ROLES.map((role) => role.role_code).filter((roleCode) => !dbRoleCodes.has(roleCode));
  const missingPermissions = PERMISSION_CODES.filter((permissionCode) => !dbPermissionCodes.has(permissionCode));
  const expectedLinks = Object.values(ROLE_PERMISSION_MAP).reduce((sum, permissionsForRole) => sum + permissionsForRole.length, 0);
  const findings = [
    ...missingRoles.map((roleCode) => buildFinding({ severity: 'high', type: 'system_role_missing', domain: 'iam', object_type: 'role', object_id: roleCode, message: `System role ${roleCode} thiếu trong DB.`, auto_fixable: true })),
    ...missingPermissions.map((permissionCode) => buildFinding({ severity: 'high', type: 'system_permission_missing', domain: 'iam', object_type: 'permission', object_id: permissionCode, message: `System permission ${permissionCode} thiếu trong DB.`, auto_fixable: true })),
  ];
  return {
    summary: {
      core_roles: CORE_ROLES.length,
      core_permissions: PERMISSION_CODES.length,
      expected_role_permission_links: expectedLinks,
      db_roles: roles.length,
      db_permissions: permissions.length,
      db_role_permission_links: rolePermissions.length,
      missing_roles: missingRoles.length,
      missing_permissions: missingPermissions.length,
    },
    result: {
      mode: payload.mode || 'scan',
      diff: { missing_roles: missingRoles, missing_permissions: missingPermissions },
      note: 'Apply sync nên gọi iam seed service trong triển khai production; API này lưu dry-run evidence và approval.',
    },
    findings,
  };
}

async function scanMigrations(payload = {}) {
  const schedules = await require('../models').DoctorSchedule.find({ is_deleted: false }).select('schedule_type').lean();
  const candidates = schedules
    .map((schedule) => ({ schedule_id: toId(schedule._id), from: schedule.schedule_type, to: normalizeScheduleType(schedule.schedule_type) }))
    .filter((item) => item.from !== item.to);
  const findings = candidates.map((item) => buildFinding({ severity: 'medium', type: 'migration_candidate', domain: 'scheduling', object_type: 'doctor_schedule', object_id: item.schedule_id, message: `DoctorSchedule schedule_type cần normalize: ${item.from} -> ${item.to}.`, evidence: item, auto_fixable: true }));
  return {
    summary: {
      available_migrations: 1,
      pending_migrations: candidates.length ? 1 : 0,
      checked_records: schedules.length,
      records_candidate: candidates.length,
      rollback_available: false,
    },
    result: {
      catalog: [{
        migration_code: 'migrate_schedule_types',
        name: 'Normalize doctor schedule types',
        domain: 'scheduling',
        risk: 'medium',
        dry_run_supported: true,
        rollback_supported: false,
      }],
      candidates,
    },
    findings,
  };
}

async function scanDemoData() {
  const collections = Object.values(mongoose.models).map((model) => model.collection.name);
  const packs = [
    { pack: 'vietnamese_full_demo', script: 'seed-vietnamese-demo-data.js', namespace: 'healthcare-vietnamese-demo-2026-05', idempotent: true, risk: 'danger' },
    { pack: 'pharmacy_overview_demo', script: 'seed-pharmacy-overview-demo-data.js', namespace: 'pharmacy-overview-demo', idempotent: true, risk: 'high' },
  ];
  const existingDemoCounts = [];
  for (const model of Object.values(mongoose.models)) {
    const schemaPaths = model.schema?.paths || {};
    if (schemaPaths.is_demo_data || schemaPaths.demo_namespace || schemaPaths.metadata) {
      const count = await model.countDocuments({
        $or: [
          { is_demo_data: true },
          { demo_namespace: { $exists: true } },
          { 'metadata.demo_namespace': { $exists: true } },
        ],
      }).catch(() => 0);
      if (count) existingDemoCounts.push({ collection: model.collection.name, count });
    }
  }
  return {
    summary: {
      available_seed_packs: packs.length,
      existing_demo_records: existingDemoCounts.reduce((sum, item) => sum + item.count, 0),
      collections_checked: collections.length,
      production_locked: (env.nodeEnv || process.env.NODE_ENV) === 'production',
    },
    result: { packs, namespaces: existingDemoCounts },
    findings: (env.nodeEnv || process.env.NODE_ENV) === 'production'
      ? [buildFinding({ severity: 'critical', type: 'demo_tools_disabled_in_production', domain: 'demo', message: 'Demo data tools phải bị khóa ở production trừ khi có production_write approval.', evidence: { node_env: env.nodeEnv || process.env.NODE_ENV } })]
      : [],
  };
}

async function scanCleanup(payload = {}) {
  const now = new Date();
  const retentionDays = Number(payload.retention_days || 90);
  const oldDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const categories = await Promise.all([
    countCleanupCategory('expired_auth_sessions', AuthSessionModel(), { expires_at: { $lt: now } }),
    countCleanupCategory('expired_password_reset_tokens', PasswordResetToken, { expires_at: { $lt: now } }),
    countCleanupCategory('expired_qr_tokens', QrToken, { expires_at: { $lt: now }, used_at: { $ne: null } }),
    countCleanupCategory('expired_idempotency_records', IdempotencyRecord, { expires_at: { $lt: now } }),
    countCleanupCategory('old_job_run_logs', JobRunLog, { started_at: { $lt: oldDate }, status: { $ne: 'running' } }),
    countCleanupCategory('old_notification_deliveries', NotificationDelivery, { created_at: { $lt: oldDate }, status: { $in: ['delivered', 'skipped', 'failed'] } }),
    countCleanupCategory('old_notifications', Notification, { created_at: { $lt: oldDate }, status: { $in: ['read', 'archived', 'cancelled'] } }),
    countCleanupCategory('old_success_outbox_events', EventOutbox, { created_at: { $lt: oldDate }, status: 'published' }),
  ]);
  const findings = categories
    .filter((item) => item.matching_records > 0)
    .map((item) => buildFinding({ severity: item.safe_to_delete ? 'low' : 'medium', type: 'cleanup_candidate', domain: 'retention', object_type: item.category, message: `${item.category} có ${item.matching_records} record cleanup candidate.`, evidence: item, auto_fixable: item.safe_to_delete }));
  return {
    summary: {
      cleanup_categories: categories.length,
      matching_records: categories.reduce((sum, item) => sum + item.matching_records, 0),
      safe_records: categories.filter((item) => item.safe_to_delete).reduce((sum, item) => sum + item.matching_records, 0),
      retention_days: retentionDays,
    },
    result: { categories },
    findings,
  };
}

function AuthSessionModel() {
  return require('../models').AuthSession;
}

async function countCleanupCategory(category, Model, filter) {
  const [count, oldest, newest] = await Promise.all([
    Model.countDocuments(filter).catch(() => 0),
    Model.findOne(filter).sort({ created_at: 1 }).select('created_at').lean().catch(() => null),
    Model.findOne(filter).sort({ created_at: -1 }).select('created_at').lean().catch(() => null),
  ]);
  return {
    category,
    matching_records: count,
    oldest: oldest?.created_at || null,
    newest: newest?.created_at || null,
    safe_to_delete: !['old_success_outbox_events'].includes(category),
  };
}

async function scanCache(payload = {}) {
  if (payload.mode === 'apply' && normalizeBoolean(payload.clear_all)) {
    const cleared = accessControlService.clearAllAuthorizationCache();
    return {
      summary: { cleared_entries: cleared },
      result: { cache_status: accessControlService.getAuthorizationCacheStatus() },
      findings: [],
    };
  }
  const activeUsers = await User.countDocuments({ is_deleted: false, status: 'active' });
  return {
    summary: {
      authorization_cache_entries: accessControlService.getAuthorizationCacheStatus().entries,
      active_users: activeUsers,
      strategy: accessControlService.getAuthorizationCacheStatus().strategy,
    },
    result: {
      cache_status: accessControlService.getAuthorizationCacheStatus(),
      cache_types: [
        'user_permission_cache',
        'authorization_decision_cache',
        'access_context_cache',
        'workspace_availability_cache',
        'system_settings_cache',
        'feature_flag_cache',
        'notification_template_cache',
      ],
    },
    findings: [],
  };
}

async function scanExports(payload = {}) {
  const template = payload.export_type || 'full_admin_bundle';
  const include = payload.include || ['iam', 'system_settings', 'diagnostics', 'audit_summary'];
  return {
    status: 'success',
    summary: {
      export_templates: 9,
      requested_template: template,
      sensitive_fields_masked: true,
      format: payload.format || 'json',
    },
    result: {
      export_manifest: {
        export_type: template,
        include,
        mask_sensitive_values: payload.mask_sensitive_values !== false,
        expires_after_hours: Number(payload.expires_after_hours || 24),
        created_at: nowIso(),
        sensitive_fields_masked: [
          'JWT_SECRET',
          'SMTP_PASS',
          'GOOGLE_CLIENT_SECRET',
          'PUSH_PROVIDER_TOKEN',
          'BANK_QR_PROVIDER_TOKEN',
          'REFRESH_TOKEN_HASH',
          'PASSWORD_HASH',
          'WEBHOOK_SECRET',
        ],
      },
      note: 'File generation/storage can be attached in a follow-up worker. Current run stores export manifest and evidence.',
    },
    findings: [],
  };
}

async function scanDeveloperDiagnostics() {
  const workerHealth = await workerHealthService.getWorkerHealth().catch((error) => ({ error: error.message }));
  const dbState = mongoose.connection.readyState;
  const memory = process.memoryUsage();
  const findings = [];
  if (workerHealth?.outbox?.dead_letter > 0) findings.push(buildFinding({ severity: 'critical', type: 'outbox_dead_letter_detected', domain: 'operations', message: `${workerHealth.outbox.dead_letter} dead-letter events.`, evidence: workerHealth.outbox }));
  if (workerHealth?.notification_delivery?.failed > 0) findings.push(buildFinding({ severity: 'high', type: 'notification_delivery_failed', domain: 'notifications', message: `${workerHealth.notification_delivery.failed} failed notification deliveries.`, evidence: workerHealth.notification_delivery }));
  if (dbState !== 1) findings.push(buildFinding({ severity: 'critical', type: 'database_not_connected', domain: 'database', message: `Mongo connection readyState=${dbState}.`, evidence: { ready_state: dbState } }));
  return {
    summary: {
      api_status: 'ok',
      mongodb_ready_state: dbState,
      models_loaded: Object.keys(mongoose.models).length,
      uptime_seconds: Math.round(process.uptime()),
      memory_rss_mb: Math.round(memory.rss / 1024 / 1024),
      outbox_failed: workerHealth?.outbox?.failed || 0,
      outbox_dead_letter: workerHealth?.outbox?.dead_letter || 0,
      notification_failed: workerHealth?.notification_delivery?.failed || 0,
    },
    result: {
      runtime: {
        node_version: process.version,
        pid: process.pid,
        hostname: os.hostname(),
        environment: env.nodeEnv || process.env.NODE_ENV,
        uptime_seconds: Math.round(process.uptime()),
        memory,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      database: {
        ready_state: dbState,
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        models: Object.keys(mongoose.models).sort(),
      },
      workers: workerHealth,
      integrations: {
        smtp_configured: Boolean(env.smtpHost || process.env.SMTP_HOST),
        push_configured: Boolean(env.pushProviderUrl || process.env.PUSH_PROVIDER_URL),
        google_oauth_configured: Boolean(env.googleClientId || process.env.GOOGLE_CLIENT_ID),
        bank_qr_configured: Boolean(process.env.BANK_QR_BANK_BIN && process.env.BANK_QR_ACCOUNT_NO),
        momo_qr_configured: Boolean(process.env.MOMO_PERSONAL_PHONE || process.env.MOMO_PERSONAL_QR_IMAGE_URL),
      },
    },
    findings,
  };
}

async function listRuns(query = {}) {
  const { page, limit, skip } = getPagination(query, 25, 100);
  const filter = {};
  if (query.tool_code) filter.tool_code = query.tool_code;
  if (query.status) filter.status = query.status;
  if (query.mode) filter.mode = query.mode;
  if (query.search) filter.$or = [{ tool_code: { $regex: escapeRegex(query.search), $options: 'i' } }, { tool_name: { $regex: escapeRegex(query.search), $options: 'i' } }];
  const [items, total] = await Promise.all([
    AdminToolRun.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).populate('requested_by', 'full_name username employee_code').populate('approved_by', 'full_name username employee_code').lean(),
    AdminToolRun.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getRun(runId) {
  const [run, findings, approval] = await Promise.all([
    AdminToolRun.findById(runId).populate('requested_by', 'full_name username employee_code').populate('approved_by', 'full_name username employee_code').lean(),
    AdminToolFinding.find({ run_id: runId }).sort({ severity: -1, created_at: -1 }).limit(500).lean(),
    AdminToolApproval.findOne({ run_id: runId }).sort({ created_at: -1 }).lean(),
  ]);
  if (!run) throw createError('Không tìm thấy admin tool run.', 404);
  return { run, findings, approval };
}

async function listRunFindings(runId, query = {}) {
  return listFindings({ ...query, run_id: runId });
}

async function listFindings(query = {}) {
  const { page, limit, skip } = getPagination(query, 25, 200);
  const filter = {};
  if (query.run_id) filter.run_id = query.run_id;
  if (query.tool_code) filter.tool_code = query.tool_code;
  if (query.severity) filter.severity = query.severity;
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.search) filter.$or = [{ message: { $regex: escapeRegex(query.search), $options: 'i' } }, { file: { $regex: escapeRegex(query.search), $options: 'i' } }, { object_id: { $regex: escapeRegex(query.search), $options: 'i' } }];
  const [items, total] = await Promise.all([
    AdminToolFinding.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    AdminToolFinding.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function updateFindingStatus(findingId, status, payload = {}, actor = {}, requestMeta = {}) {
  const finding = await AdminToolFinding.findById(findingId);
  if (!finding) throw createError('Không tìm thấy finding.', 404);
  finding.status = status;
  if (status === 'resolved') {
    finding.resolved_by = actorUserId(actor);
    finding.resolved_at = new Date();
  }
  if (status === 'accepted_risk') {
    finding.accepted_risk_by = actorUserId(actor);
    finding.accepted_risk_reason = payload.reason;
  }
  await finding.save();
  await recordAuditLog({
    actor,
    action: `admin_tools.finding.${status}`,
    targetType: 'admin_tool_finding',
    targetId: finding._id,
    status: 'success',
    message: `Update finding status: ${status}.`,
    requestMeta,
    metadata: { reason: payload.reason },
  });
  return finding.toObject();
}

async function cancelRun(runId, payload = {}, actor = {}, requestMeta = {}) {
  const run = await AdminToolRun.findById(runId);
  if (!run) throw createError('Không tìm thấy run.', 404);
  if (!['queued', 'running', 'requires_approval'].includes(run.status)) throw createError('Run không còn trạng thái có thể cancel.', 409);
  run.status = 'cancelled';
  run.finished_at = new Date();
  run.duration_ms = run.started_at ? run.finished_at.getTime() - new Date(run.started_at).getTime() : 0;
  run.result = { ...(run.result || {}), cancel_reason: payload.reason };
  await run.save();
  await recordAuditLog({ actor, action: 'admin_tools.run.cancel', targetType: 'admin_tool_run', targetId: run._id, status: 'success', message: 'Cancel admin tool run.', requestMeta, metadata: { reason: payload.reason } });
  return getRun(run._id);
}

async function approveRun(runId, payload = {}, actor = {}, requestMeta = {}) {
  const run = await AdminToolRun.findById(runId);
  if (!run) throw createError('Không tìm thấy run.', 404);
  run.status = run.status === 'requires_approval' ? 'success_with_warnings' : run.status;
  run.approved_by = actorUserId(actor);
  await run.save();
  const approval = await AdminToolApproval.create({
    run_id: run._id,
    tool_code: run.tool_code,
    requested_by: run.requested_by,
    approved_by: actorUserId(actor),
    status: 'approved',
    approval_note: payload.note,
    confirmation_text: payload.confirmation_text,
    decided_at: new Date(),
  });
  await recordAuditLog({ actor, action: 'admin_tools.run.approve', targetType: 'admin_tool_run', targetId: run._id, status: 'success', message: 'Approve admin tool run.', requestMeta, metadata: { approval_id: toId(approval._id), note: payload.note } });
  return getRun(run._id);
}

async function applyRun(runId, payload = {}, actor = {}, requestMeta = {}) {
  const run = await AdminToolRun.findById(runId);
  if (!run) throw createError('Không tìm thấy run.', 404);
  const tool = getTool(run.tool_code);
  if (!tool.modes.includes('apply')) throw createError('Tool này không hỗ trợ apply.', 409);
  const applyPayload = { ...(run.input || {}), ...payload, mode: 'apply' };
  return runTool(run.tool_code, applyPayload, actor, requestMeta);
}

async function exportRun(runId) {
  const detail = await getRun(runId);
  return {
    exported_at: nowIso(),
    mask_sensitive_values: true,
    ...detail,
  };
}

function AuthSessionModel() {
  return require('../models').AuthSession;
}

module.exports = {
  listTools,
  getToolDetail,
  getOverview,
  runTool,
  listRuns,
  getRun,
  listRunFindings,
  listFindings,
  updateFindingStatus,
  cancelRun,
  approveRun,
  applyRun,
  exportRun,
};
