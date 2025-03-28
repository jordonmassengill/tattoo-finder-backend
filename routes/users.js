const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

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

// Update user profile
router.put('/update', auth, userController.updateProfile);

// Delete user account
router.delete('/:id', auth, userController.deleteUser);

//Profile Pic
router.put('/profile-picture', auth, upload.single('profilePic'), userController.updateProfilePicture);

module.exports = router;