const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// Create post
router.post('/', auth, upload.single('image'), postController.createPost);

// Get all posts for the user's feed
router.get('/', auth, postController.getPosts); // MODIFIED: Added auth middleware

// Get post by ID
router.get('/:id', postController.getPostById);

// Like post
router.put('/like/:id', auth, postController.likePost);

// Unlike post
router.put('/unlike/:id', auth, postController.unlikePost);

// Add comment
router.post('/comment/:id', auth, postController.addComment);

// Delete post
router.delete('/:id', auth, postController.deletePost);

module.exports = router;