const express = require('express');
const authRoutes = require('./auth.routes');
const iamRoutes = require('./iam.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'healthcare-system-backend',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/iam', iamRoutes);

module.exports = router;
