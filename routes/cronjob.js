const express = require('express');
const router = express.Router();
const { recordCronRun } = require('../workers/checks/cronjob');

// @desc    Receive cronjob ping
// @route   GET/POST /api/cronjob/:token
// @access  Public (authenticated via token)
router.all('/:token', async (req, res) => {
    try {
        const { status = 'success', duration } = req.query;

        const result = await recordCronRun(
            req.params.token,
            status,
            duration ? parseInt(duration) : null
        );

        if (!result.success) {
            return res.status(404).json(result);
        }

        res.status(200).json({
            success: true,
            message: 'Cronjob run recorded',
            monitor: result.monitorName,
            nextExpectedRun: result.nextExpectedRun,
        });
    } catch (error) {
        console.error('Cronjob ping error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
