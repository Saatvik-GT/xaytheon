/**
 * XAYTHEON — Brain Controller
 */

const brainSvc = require('../services/brain-map.service');

class BrainController {
    /**
     * GET /api/brain/topology
     */
    async getTopology(req, res) {
        try {
            res.json({ success: true, brain: brainSvc.getBrainMap() });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/brain/relate
     */
    async simulateRelation(req, res) {
        try {
            const { nodeA, nodeB } = req.body;
            if (!nodeA || !nodeB) return res.status(400).json({ success: false, message: 'Two nodes required for relationship mapping' });

            const result = brainSvc.findRelationship(nodeA, nodeB);
            res.json({ success: true, relationship: result });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new BrainController();
