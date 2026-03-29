const app = require('./app');
const env = require('./config/env');
const { connectDatabase } = require('./config/database');
require('./models');
const { bootstrapSystemAccess } = require('./services/bootstrap.service');

async function bootstrap() {
  await connectDatabase();
  await bootstrapSystemAccess();

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
