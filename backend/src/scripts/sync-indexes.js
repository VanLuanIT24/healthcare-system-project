const { connectDatabase, mongoose } = require('../config/database');
require('../models');

async function syncIndexes() {
  await connectDatabase();

  for (const model of Object.values(mongoose.models)) {
    const result = await model.syncIndexes();
    console.log(`${model.modelName}:`, result);
  }

  await mongoose.disconnect();
}

syncIndexes().catch(async (error) => {
  console.error('Failed to sync indexes:', error);
  await mongoose.disconnect();
  process.exit(1);
});
