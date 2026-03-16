const express = require('express');
const router = express.Router();
const brainController = require('../controllers/brain.controller');

router.get('/topology', brainController.getTopology);
router.post('/relate', brainController.simulateRelation);

module.exports = router;
