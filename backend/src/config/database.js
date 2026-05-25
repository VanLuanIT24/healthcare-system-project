const mongoose = require('mongoose');
const env = require('./env');

async function connectDatabase() {
  if (!env.mongodbUri) {
    throw new Error('Missing MONGODB_URI in environment configuration.');
  }

  mongoose.set('autoIndex', env.mongooseAutoIndex);
  mongoose.set('autoCreate', env.mongooseAutoCreate);

  await mongoose.connect(env.mongodbUri, {
    dbName: env.mongodbDbName || undefined,
    autoIndex: env.mongooseAutoIndex,
    autoCreate: env.mongooseAutoCreate,
    maxPoolSize: env.mongodbMaxPoolSize,
    minPoolSize: env.mongodbMinPoolSize,
    serverSelectionTimeoutMS: env.mongodbServerSelectionTimeoutMs,
    connectTimeoutMS: env.mongodbConnectTimeoutMs,
    socketTimeoutMS: env.mongodbSocketTimeoutMs,
  });
}

module.exports = {
  connectDatabase,
  mongoose,
};
