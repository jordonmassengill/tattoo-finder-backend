const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const affiliationController = require('../controllers/affiliationController');

// Send a request
router.post('/request/:targetId', auth, affiliationController.sendRequest);

// Accept a pending request
router.put('/accept/:requestId', auth, affiliationController.acceptRequest);

// Decline or cancel a pending request
router.delete('/request/:requestId', auth, affiliationController.declineRequest);

// Remove an existing affiliation
router.delete('/remove/:targetId', auth, affiliationController.removeAffiliation);

// Get all pending requests for the current user
router.get('/pending', auth, affiliationController.getPendingRequests);

// Get affiliation status with a specific user
router.get('/status/:targetId', auth, affiliationController.getAffiliationStatus);

module.exports = router;
