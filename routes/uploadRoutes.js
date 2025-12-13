const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

router.post('/avatar', protect, uploadController.uploadAvatar);

module.exports = router;
