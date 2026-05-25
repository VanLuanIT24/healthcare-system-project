const { MaintenanceWindow } = require('../models');

const CACHE_TTL_MS = 10000;
const QUERY_TIMEOUT_MS = 1500;
let cache = {
  loaded_at: 0,
  windows: [],
};
let refreshPromise = null;

function now() {
  return new Date();
}

function pathOf(req = {}) {
  return String(req.originalUrl || req.url || '').split('?')[0].toLowerCase();
}

function routeStarts(path, prefixes = []) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(prefix));
}

function scopeMatchesPath(scope, path) {
  if (scope === 'global') return true;
  if (scope === 'patient_portal') return routeStarts(path, ['/api/portal', '/api/patients/me', '/api/records/me']);
  if (scope === 'billing') return routeStarts(path, ['/api/billing', '/api/billing-workspace', '/api/payments']);
  if (scope === 'clinical') return routeStarts(path, ['/api/clinical', '/api/lab', '/api/laboratory', '/api/imaging', '/api/procedures', '/api/orders', '/api/encounters']);
  if (scope === 'pharmacy') return routeStarts(path, ['/api/pharmacy', '/api/prescriptions']);
  if (scope === 'scheduling') return routeStarts(path, ['/api/appointments', '/api/schedules', '/api/queue']);
  if (scope === 'admin') return routeStarts(path, ['/api/admin', '/api/iam', '/api/audit-logs']);
  if (scope === 'realtime') return routeStarts(path, ['/socket.io']);
  if (scope === 'payment_provider') return routeStarts(path, ['/api/payments']);
  if (scope === 'file_upload') return routeStarts(path, ['/api/clinical-document-files', '/api/records']);
  return false;
}

function isBypassed(activeWindow, path) {
  if (path === '/api/health' && activeWindow.allow_health_check) return true;
  if (routeStarts(path, ['/api/ops/maintenance', '/api/auth'])) return true;
  if (activeWindow.allow_health_check && routeStarts(path, ['/api/admin/worker-health', '/api/ops/health'])) return true;
  if (activeWindow.allow_webhooks && path.includes('webhook')) return true;
  if (activeWindow.allow_emergency && routeStarts(path, ['/api/emergency'])) return true;
  if (activeWindow.allow_admin_bypass && routeStarts(path, ['/api/admin', '/api/iam', '/api/ops'])) return true;
  return false;
}

function refreshMaintenanceWindows() {
  if (refreshPromise) return refreshPromise;

  const query = MaintenanceWindow.find({
    status: 'active',
    starts_at: { $lte: now() },
    $or: [{ ends_at: null }, { ends_at: { $gt: now() } }],
  }).sort({ starts_at: -1 }).maxTimeMS(QUERY_TIMEOUT_MS).lean();

  refreshPromise = Promise.race([
    query,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Maintenance window lookup timed out.')), QUERY_TIMEOUT_MS);
    }),
  ])
    .then((windows) => {
      cache = { loaded_at: Date.now(), windows };
      return windows;
    })
    .catch(() => {
      cache.loaded_at = Date.now();
      return cache.windows;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function activeMaintenanceWindows() {
  if (Date.now() - cache.loaded_at >= CACHE_TTL_MS) {
    refreshMaintenanceWindows();
  }
  return cache.windows;
}

async function maintenanceModeMiddleware(req, res, next) {
  try {
    const path = pathOf(req);
    if (!path.startsWith('/api') && !path.startsWith('/socket.io')) return next();
    if (path === '/api/health') return next();

    const active = activeMaintenanceWindows();
    const matched = active.find((item) => scopeMatchesPath(item.scope, path) && !isBypassed(item, path));
    if (!matched) return next();

    return res.status(503).json({
      success: false,
      message: matched.message || 'Hệ thống đang bảo trì. Vui lòng quay lại sau.',
      code: 'MAINTENANCE_MODE',
      data: {
        maintenance: {
          scope: matched.scope,
          starts_at: matched.starts_at,
          ends_at: matched.ends_at,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  maintenanceModeMiddleware,
};
