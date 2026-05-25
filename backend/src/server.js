const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { connectDatabase } = require('./config/database');
require('./models');
const { bootstrapSystemAccess } = require('./services/bootstrap.service');
const { initializeSocketServer } = require('./realtime/socket.server');

async function bootstrap() {
  await connectDatabase();
  if (env.nodeEnv === 'production') {
    await bootstrapSystemAccess();
  }

  const server = http.createServer(app);
  initializeSocketServer(server);

  server.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });

  if (env.nodeEnv !== 'production') {
    bootstrapSystemAccess().catch((error) => {
      console.error('Failed to bootstrap system access', error);
    });
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
