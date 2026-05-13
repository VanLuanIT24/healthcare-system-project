const { buildPaginationMeta } = require('../common/helpers/pagination.helper');
const { buildRegexSearch } = require('../common/helpers/query.helper');
const ApiError = require('../common/errors/api-error');
const { normalizeUpdatePayload } = require('./repository.helpers');

class BaseRepository {
  constructor(Model, options = {}) {
    if (!Model) {
      throw new Error('BaseRepository cần một Mongoose model.');
    }

    this.Model = Model;
    this.model = Model;
    this.softDeleteField = options.softDeleteField || 'is_deleted';
    this.defaultSort = options.defaultSort || { created_at: -1 };
    this.defaultNotFoundMessage = options.defaultNotFoundMessage || 'Không tìm thấy dữ liệu.';
  }

  applyNotDeleted(filter = {}, includeDeleted = false) {
    if (includeDeleted) return filter;
    return {
      ...filter,
      [this.softDeleteField]: { $ne: true },
    };
  }

  notDeletedFilter(filter = {}) {
    return this.applyNotDeleted(filter);
  }

  applyQueryOptions(query, options = {}) {
    const {
      session = null,
      lean = true,
      populate = null,
      select = null,
      sort = null,
      skip = null,
      limit = null,
    } = options;

    if (sort) query.sort(sort);
    if (skip !== null && skip !== undefined) query.skip(skip);
    if (limit !== null && limit !== undefined) query.limit(limit);
    if (select) query.select(select);
    if (populate) query.populate(populate);
    if (session) query.session(session);
    if (lean) query.lean();

    return query;
  }

  findById(id, options = {}) {
    const filter = this.applyNotDeleted({ _id: id }, options.includeDeleted);
    const query = this.Model.findOne(filter);
    return this.applyQueryOptions(query, options);
  }

  findOne(filter = {}, options = {}) {
    const finalFilter = this.applyNotDeleted(filter, options.includeDeleted);
    const query = this.Model.findOne(finalFilter);
    return this.applyQueryOptions(query, options);
  }

  findMany(filter = {}, options = {}) {
    const finalFilter = this.applyNotDeleted(filter, options.includeDeleted);
    const query = this.Model.find(finalFilter);
    return this.applyQueryOptions(query, {
      sort: this.defaultSort,
      limit: 50,
      skip: 0,
      ...options,
    });
  }

  find(filter = {}, options = {}) {
    return this.findMany(filter, options);
  }

  async findByIdOrThrow(id, options = {}) {
    const item = await this.findById(id, options);
    if (!item) {
      throw ApiError.notFound(options.message || this.defaultNotFoundMessage, { id });
    }
    return item;
  }

  async findOneOrThrow(filter = {}, options = {}) {
    const item = await this.findOne(filter, options);
    if (!item) {
      throw ApiError.notFound(options.message || this.defaultNotFoundMessage, { filter });
    }
    return item;
  }

  async paginate(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = this.defaultSort,
      session = null,
      includeDeleted = false,
      populate = null,
      select = null,
      lean = true,
    } = options;
    const skip = (page - 1) * limit;
    const finalFilter = this.applyNotDeleted(filter, includeDeleted);

    const countQuery = this.Model.countDocuments(finalFilter);
    if (session) countQuery.session(session);

    const [items, total] = await Promise.all([
      this.findMany(finalFilter, {
        session,
        includeDeleted: true,
        populate,
        select,
        sort,
        limit,
        skip,
        lean,
      }),
      countQuery,
    ]);

    return {
      items,
      pagination: buildPaginationMeta({ page, limit, total }),
    };
  }

  async create(payload, options = {}) {
    const { session = null } = options;
    if (session) {
      const docs = await this.Model.create([payload], { session });
      return docs[0];
    }
    return this.Model.create(payload);
  }

  createMany(items = [], options = {}) {
    const { session = null, ordered = true } = options;
    return this.Model.insertMany(items, { session, ordered });
  }

  updateById(id, payload, options = {}) {
    const {
      session = null,
      lean = true,
      includeDeleted = false,
      runValidators = true,
      queryOptions = {},
    } = options;

    const filter = this.applyNotDeleted({ _id: id }, includeDeleted);
    let query = this.Model.findOneAndUpdate(
      filter,
      normalizeUpdatePayload(payload),
      {
        new: true,
        runValidators,
        ...queryOptions,
      },
    );

    if (session) query.session(session);
    if (lean) query.lean();
    return query;
  }

  updateOne(filter = {}, payload = {}, options = {}) {
    const {
      session = null,
      lean = true,
      includeDeleted = false,
      runValidators = true,
      queryOptions = {},
    } = options;

    const finalFilter = this.applyNotDeleted(filter, includeDeleted);
    let query = this.Model.findOneAndUpdate(
      finalFilter,
      normalizeUpdatePayload(payload),
      {
        new: true,
        runValidators,
        ...queryOptions,
      },
    );

    if (session) query.session(session);
    if (lean) query.lean();
    return query;
  }

  softDeleteById(id, actorId, options = {}) {
    return this.updateById(
      id,
      {
        [this.softDeleteField]: true,
        deleted_at: new Date(),
        deleted_by: actorId,
      },
      options,
    );
  }

  async assertExists(id, options = {}) {
    const exists = await this.exists({ _id: id }, options);
    if (!exists) {
      throw ApiError.notFound(options.message || this.defaultNotFoundMessage, { id });
    }
    return true;
  }

  existsActive(filter = {}, options = {}) {
    return this.exists(
      {
        ...filter,
        [options.statusField || 'status']: { $in: options.activeStatuses || ['active'] },
      },
      options,
    );
  }

  async paginateWithSearch(filter = {}, search = {}, options = {}) {
    const {
      keyword = '',
      fields = [],
      mode = 'or',
    } = search;
    const keywordRegex = buildRegexSearch(keyword);
    const searchFilter = { ...filter };

    if (keywordRegex && fields.length > 0) {
      const conditions = fields.map((field) => ({ [field]: keywordRegex }));
      if (mode === 'and') searchFilter.$and = [...(searchFilter.$and || []), ...conditions];
      else searchFilter.$or = [...(searchFilter.$or || []), ...conditions];
    }

    return this.paginate(searchFilter, options);
  }

  withDepartmentScope(filter = {}, departmentId, field = 'department_id') {
    if (!departmentId) return { ...filter, _id: null };
    if (filter[field] && String(filter[field]) !== String(departmentId)) {
      return { ...filter, _id: null };
    }
    return { ...filter, [field]: departmentId };
  }

  withTenantScope(filter = {}, tenantId, field = 'tenant_id') {
    if (!tenantId) return { ...filter };
    return { ...filter, [field]: tenantId };
  }

  restoreById(id, actorId = null, options = {}) {
    return this.updateById(
      id,
      {
        $set: {
          [this.softDeleteField]: false,
          ...(actorId ? { updated_by: actorId } : {}),
        },
        $unset: {
          deleted_at: '',
          deleted_by: '',
        },
      },
      {
        ...options,
        includeDeleted: true,
      },
    );
  }

  async exists(filter = {}, options = {}) {
    const finalFilter = this.applyNotDeleted(filter, options.includeDeleted);
    const query = this.Model.exists(finalFilter);
    if (options.session) query.session(options.session);
    const result = await query;
    return Boolean(result);
  }

  count(filter = {}, options = {}) {
    const finalFilter = this.applyNotDeleted(filter, options.includeDeleted);
    const query = this.Model.countDocuments(finalFilter);
    if (options.session) query.session(options.session);
    return query;
  }
}

module.exports = BaseRepository;
