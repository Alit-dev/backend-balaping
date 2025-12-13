const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const settingsController = require('../controllers/settingsController');

// All routes require authentication
router.use(protect);

// Profile
router.get('/profile', settingsController.getProfile);
router.put('/profile', settingsController.updateProfile);
router.post('/change-password', settingsController.changePassword);

// API Keys
router.get('/api-keys', settingsController.getApiKeys);
router.post('/api-keys', settingsController.createApiKey);
router.delete('/api-keys/:id', settingsController.revokeApiKey);

// Sessions
router.get('/sessions', settingsController.getSessions);
router.delete('/sessions/:id', settingsController.revokeSession);
router.post('/sessions/revoke-all', settingsController.revokeAllSessions);

// Security logs
router.get('/security-logs', settingsController.getSecurityLogs);

// 2FA
router.post('/2fa/generate', settingsController.generateTwoFactorSecret);
router.post('/2fa/verify', settingsController.verifyTwoFactor);
router.post('/2fa/disable', settingsController.disableTwoFactor);

// Delete account
router.delete('/account', settingsController.deleteAccount);

module.exports = router;
