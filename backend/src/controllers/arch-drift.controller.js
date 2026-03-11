/**
 * XAYTHEON — Architecture Drift Controller
 */

const archSvc = require('../services/arch-drift.service');

class ArchDriftController {
  /**
   * POST /api/arch/audit
   */
  async audit(req, res) {
    try {
      const { file, content } = req.body;
      if (!file || !content) return res.status(400).json({ success: false, message: 'File and Content required' });

      const result = archSvc.auditArch(file, content);
      res.json({ success: true, audit: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/arch/history
   */
  async getHistory(req, res) {
    try {
      res.json({ success: true, history: archSvc.getAuditHistory() });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new ArchDriftController();
