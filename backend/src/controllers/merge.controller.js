/**
 * XAYTHEON — Merge Controller
 */

const mergeSvc = require('../services/merge-simulator.service');

class MergeController {
    /**
     * POST /api/merge/simulate
     */
    async simulate(req, res) {
        try {
            const { source, target, files } = req.body;
            if (!source || !target) return res.status(400).json({ success: false, message: 'Source and Target branches required' });

            const result = mergeSvc.simulateMerge(source, target, files || []);
            res.json({ success: true, simulation: result });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * GET /api/merge/history
     */
    async getHistory(req, res) {
        try {
            res.json({ success: true, history: mergeSvc.getSimulationHistory() });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new MergeController();
