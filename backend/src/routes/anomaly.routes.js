const express = require('express');
const router = express.Router();
const anomalyController = require('../controllers/anomaly.controller');

router.post('/analyze', anomalyController.simulatePayload);
router.get('/history', anomalyController.getHistory);

module.exports = router;
