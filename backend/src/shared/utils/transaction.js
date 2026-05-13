const { mongoose } = require('../../config/database');

const DEFAULT_TRANSACTION_OPTIONS = {
  readPreference: 'primary',
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
};

function isTransactionUnsupported(error) {
  const message = error?.message || '';
  return (
    message.includes('Transaction numbers are only allowed') ||
    message.includes('replica set') ||
    message.includes('Standalone servers do not support transactions')
  );
}

async function withTransaction(work, options = {}) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    }, {
      ...DEFAULT_TRANSACTION_OPTIONS,
      ...(options.transactionOptions || {}),
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function runInTransaction(work, options = {}) {
  return withTransaction(work, options);
}

async function withOptionalTransaction(work, options = {}) {
  if (options.useTransaction === false) {
    return work(null);
  }

  try {
    return await withTransaction(work, options);
  } catch (error) {
    if (options.fallbackToNoTransaction && isTransactionUnsupported(error)) {
      return work(null);
    }
    throw error;
  }
}

function withSession(options = {}) {
  return (work) => runInTransaction(work, options);
}

module.exports = {
  withTransaction,
  withOptionalTransaction,
  runInTransaction,
  withSession,
  isTransactionUnsupported,
};
