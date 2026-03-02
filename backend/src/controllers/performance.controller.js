/**
 * XAYTHEON — Performance Controller
 */

const perfSvc = require('../services/performance-guard.service');

class PerformanceController {
    /**
     * POST /api/performance/analyze
     */
    async analyze(req, res) {
        try {
            const { file, content } = req.body;
            if (!file || !content) return res.status(400).json({ success: false, message: 'File and Content required for profiling' });

            const result = perfSvc.analyzePerformance(file, content);
            res.json({ success: true, report: result });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * GET /api/performance/snapshots
     */
    async getSnapshots(req, res) {
        try {
            res.json({ success: true, history: perfSvc.getHistory() });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new PerformanceController();
