const { AuthSession } = require('../models');

const REVOKED_RETENTION_DAYS = Number(process.env.SESSION_REVOKED_RETENTION_DAYS || 90);

async function cleanupOldSessions() {
  const now = new Date();
  const expired = await AuthSession.updateMany(
    {
      expires_at: { $lte: now },
      revoked_at: null,
    },
    {
      $set: {
        revoked_at: now,
        revoked_reason: 'expired_by_cleanup_job',
      },
    },
  );

  const cutoff = new Date(now.getTime() - REVOKED_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const removed = await AuthSession.deleteMany({
    revoked_at: { $lte: cutoff },
    expires_at: { $lte: cutoff },
  });

  return {
    expired_marked: expired.modifiedCount || 0,
    removed_old_revoked: removed.deletedCount || 0,
  };
}

module.exports = {
  cleanupOldSessions,
};
