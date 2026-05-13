function notDeletedFilter(filter = {}) {
  return {
    ...filter,
    is_deleted: { $ne: true },
  };
}

function deletedFilter(filter = {}) {
  return {
    ...filter,
    is_deleted: true,
  };
}

function buildSoftDeleteData(actorId) {
  return {
    is_deleted: true,
    deleted_at: new Date(),
    deleted_by: actorId,
  };
}

function buildRestoreData() {
  return {
    $set: {
      is_deleted: false,
    },
    $unset: {
      deleted_at: '',
      deleted_by: '',
    },
  };
}

module.exports = {
  notDeletedFilter,
  deletedFilter,
  buildSoftDeleteData,
  buildRestoreData,
};
