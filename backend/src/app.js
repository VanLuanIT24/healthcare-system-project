const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const {
  errorMiddleware,
  notFoundMiddleware,
  requestContextMiddleware,
  validators,
} = require('./common');

const app = express();

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
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads/public')));
app.use(validators.validateRequestShape());
if (env.nodeEnv !== 'production') {
  app.use(morgan('dev'));
}
app.use(requestContextMiddleware);

app.use('/api', routes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
