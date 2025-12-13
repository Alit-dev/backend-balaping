const express = require('express');
const router = express.Router();
const {
    createTeam,
    getTeams,
    getTeam,
    updateTeam,
    inviteMember,
    acceptInvite,
    updateMemberRole,
    removeMember,
    leaveTeam,
} = require('../controllers/teamController');
const { protect } = require('../middleware/auth');
const { teamAccess, requireAdmin, requireOwner } = require('../middleware/teamAccess');

// All routes require authentication
router.use(protect);

// Team CRUD
router.post('/', createTeam);
router.get('/', getTeams);
router.get('/:teamId', getTeam);
router.put('/:teamId', teamAccess, requireAdmin, updateTeam);

// Invitation routes
router.post('/:teamId/invite', teamAccess, requireAdmin, inviteMember);
router.post('/accept-invite/:token', acceptInvite);

// Member management
router.put('/:teamId/members/:userId', teamAccess, requireOwner, updateMemberRole);
router.delete('/:teamId/members/:userId', teamAccess, requireAdmin, removeMember);
router.post('/:teamId/leave', teamAccess, leaveTeam);

module.exports = router;
