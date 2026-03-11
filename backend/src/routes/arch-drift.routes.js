const express = require('express');
const router = express.Router();
const archController = require('../controllers/arch-drift.controller');

router.post('/audit', archController.audit);
router.get('/history', archController.getHistory);

module.exports = router;
