const express = require('express');
const router = express.Router();
const {
    getStatusPage,
    getStatusPageHistory,
} = require('../controllers/statusController');

// Public routes - no authentication required
router.get('/:teamSlug', getStatusPage);
router.get('/:teamSlug/history', getStatusPageHistory);

module.exports = router;
