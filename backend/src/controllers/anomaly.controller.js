/**
 * XAYTHEON — Anomaly Controller
 */

const anomalySvc = require('../services/quantum-anomaly.service');

class AnomalyController {
    /**
     * POST /api/anomaly/analyze
     */
    async simulatePayload(req, res) {
        try {
            const { endpoint, headers = {}, payloadString = "" } = req.body;
            if (!endpoint) return res.status(400).json({ success: false, message: 'Endpoint is required' });

            const payloadSize = Buffer.byteLength(payloadString, 'utf8');
            const result = anomalySvc.analyzePayload(endpoint, headers, payloadSize, payloadString);

            res.json({ success: true, analysis: result });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * GET /api/anomaly/history
     */
    async getHistory(req, res) {
        try {
            res.json({ success: true, anomalies: anomalySvc.getHistory() });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new AnomalyController();
