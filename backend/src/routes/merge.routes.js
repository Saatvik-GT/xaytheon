const express = require('express');
const router = express.Router();
const mergeController = require('../controllers/merge.controller');

router.post('/simulate', mergeController.simulate);
router.get('/history', mergeController.getHistory);

module.exports = router;
