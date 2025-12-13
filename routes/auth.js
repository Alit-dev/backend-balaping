const express = require('express');
const router = express.Router();
const {
    register,
    login,
    verifyEmail,
    getMe,
    forgotPassword,
    resetPassword,
    resendVerification,
    getSessions,
    revokeSession,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/verify/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/resend-verification', resendVerification);

// Protected routes
router.get('/me', protect, getMe);
router.get('/sessions', protect, getSessions);
router.delete('/sessions/:id', protect, revokeSession);

module.exports = router;
