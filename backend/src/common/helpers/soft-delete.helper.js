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

function buildArchiveData(actorId, reason = null) {
  return {
    archived_at: new Date(),
    archived_by: actorId,
    archive_reason: reason || undefined,
  };
}

function buildVoidData(actorId, reason = null) {
  return {
    voided_at: new Date(),
    voided_by: actorId,
    void_reason: reason || undefined,
  };
}

function buildCancelData(actorId, reason = null) {
  return {
    cancelled_at: new Date(),
    cancelled_by: actorId,
    cancel_reason: reason || undefined,
  };
}

function buildRevokeData(actorId, reason = null) {
  return {
    revoked_at: new Date(),
    revoked_by: actorId,
    revoke_reason: reason || undefined,
  };
}

const RESOURCE_LIFECYCLE_ACTION = {
  SOFT_DELETE: 'soft_delete',
  ARCHIVE: 'archive',
  VOID: 'void',
  CANCEL: 'cancel',
  REVOKE: 'revoke',
};

module.exports = {
  RESOURCE_LIFECYCLE_ACTION,
  notDeletedFilter,
  deletedFilter,
  buildSoftDeleteData,
  buildRestoreData,
  buildArchiveData,
  buildVoidData,
  buildCancelData,
  buildRevokeData,
};
