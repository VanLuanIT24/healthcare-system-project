process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const http = require('http');
const app = require('../app');

const REQUIRED_ROUTES = [
  '/api/pharmacy/prescription-workbench?status_group=pending_verification&page=1&limit=10',
  '/api/pharmacy/prescription-risk-queue?page=1&limit=10',
  '/api/pharmacy/overview/dashboard?range=today',
  '/api/pharmacy/overview/work-queue?page=1&limit=30',
  '/api/pharmacy/overview/dispensing-today?range=today',
  '/api/pharmacy/overview/alerts?page=1&limit=30',
  '/api/pharmacy/overview/performance?range=today',
];

function requestStatus(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: '127.0.0.1',
      port,
      path,
      timeout: 5000,
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Timed out while checking ${path}`));
    });
    req.on('error', reject);
  });
}

async function main() {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const originalConsoleError = console.error;

  try {
    const port = server.address().port;
    const results = [];

    console.error = () => {};
    for (const path of REQUIRED_ROUTES) {
      const status = await requestStatus(port, path);
      results.push({ path, status });
    }
    console.error = originalConsoleError;

    const failures = results.filter((item) => item.status !== 401);
    console.log(JSON.stringify({ checked: results.length, results }, null, 2));

    if (failures.length > 0) {
      throw new Error(`Pharmacy overview routes must be mounted and guarded. Unexpected statuses: ${failures.map((item) => `${item.path} -> ${item.status}`).join(', ')}`);
    }
  } finally {
    console.error = originalConsoleError;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
