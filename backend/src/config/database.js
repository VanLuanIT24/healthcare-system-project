const mongoose = require('mongoose');
const env = require('./env');

async function connectDatabase() {
  if (!env.mongodbUri) {
    throw new Error('Missing MONGODB_URI in environment configuration.');
  }

  await mongoose.connect(env.mongodbUri, {
    dbName: env.mongodbDbName || undefined,
  });
}

module.exports = {
  connectDatabase,
  mongoose,
};
