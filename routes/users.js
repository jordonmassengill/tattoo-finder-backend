const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// Get current user
router.get('/me', auth, userController.getCurrentUser);

// Get user by ID or username
router.get('/:id', userController.getUserById);

// Get user posts
router.get('/:id/posts', userController.getUserPosts);

// Follow user
router.put('/follow/:id', auth, userController.followUser);

// Unfollow user
router.put('/unfollow/:id', auth, userController.unfollowUser);

module.exports = router;