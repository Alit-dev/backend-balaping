const express = require('express');
const router = express.Router();
const { recordHeartbeat } = require('../workers/checks/heartbeat');
const { recordCronRun } = require('../workers/checks/cronjob');

// @desc    Receive heartbeat ping
// @route   GET/POST /api/heartbeat/:token
// @access  Public (authenticated via token)
router.all('/:token', async (req, res) => {
    try {
        const result = await recordHeartbeat(req.params.token);

        if (!result.success) {
            return res.status(404).json(result);
        }

        res.status(200).json({
            success: true,
            message: 'Heartbeat recorded',
            monitor: result.monitorName,
        });
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
