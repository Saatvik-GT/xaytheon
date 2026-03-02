const express = require('express');
const router = express.Router();
const perfController = require('../controllers/performance.controller');

router.post('/analyze', perfController.analyze);
router.get('/snapshots', perfController.getSnapshots);

module.exports = router;
