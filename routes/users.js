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

// Change password
router.put('/change-password', auth, userController.changePassword);

// Delete user account
router.delete('/:id', auth, userController.deleteUser);

//Profile Pic
router.put('/profile-picture', auth, upload.single('profilePic'), userController.updateProfilePicture);

//Save posts
router.put('/save/:postId', auth, userController.savePost);
router.put('/unsave/:postId', auth, userController.unsavePost);
router.get('/me/saved', auth, userController.getSavedPosts);
router.get('/me/following', auth, userController.getFollowing);

module.exports = router;