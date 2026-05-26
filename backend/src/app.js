const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { maintenanceModeMiddleware } = require('./middleware/maintenance-mode');
const {
  errorMiddleware,
  notFoundMiddleware,
  requestContextMiddleware,
  validators,
} = require('./common');

const app = express();
const publicUploadsPath = path.resolve(__dirname, '../uploads/public');

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin is not allowed.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: env.requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.requestBodyLimit }));
app.use('/uploads', express.static(publicUploadsPath, {
  setHeaders(res) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', env.nodeEnv === 'production' ? 'public, max-age=86400' : 'no-cache');
  },
}));
app.use(validators.validateRequestShape());
if (env.nodeEnv !== 'production') {
  app.use(morgan('dev'));
}
app.use(requestContextMiddleware);
app.use(maintenanceModeMiddleware);

app.use('/api', routes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
