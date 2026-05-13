const { ApiError, scopeChecker } = require('../common');

async function loadResourceFromModel(Model, id, options = {}) {
  if (!Model || !id) return null;
  const query = Model.findById(id);
  if (options.select) query.select(options.select);
  if (options.populate) query.populate(options.populate);
  return query.lean();
}

function resolveActor(req) {
  return req.context?.actor || req.auth;
}

function authorizeScope(scopeKey, options = {}) {
  return async function authorizeScopeMiddleware(req, res, next) {
    try {
      if (!req.auth) {
        return next(ApiError.unauthorized('Bạn chưa được xác thực.'));
      }

      const actor = resolveActor(req);
      let resource = options.resource || null;

      if (typeof options.resourceLoader === 'function') {
        resource = await options.resourceLoader(req);
      } else if (options.model && options.param) {
        resource = await loadResourceFromModel(options.model, req.params[options.param], options);
      } else if (options.from === 'params') {
        resource = req.params;
      } else if (options.from === 'body') {
        resource = req.body;
      } else if (options.from === 'query') {
        resource = req.query;
      }

      if (options.model && options.param && !resource) {
        return next(ApiError.notFound(options.notFoundMessage || 'Không tìm thấy dữ liệu cần kiểm tra scope.'));
      }

      await scopeChecker.assertNamedScope(actor, resource || {}, scopeKey, options);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = authorizeScope;
