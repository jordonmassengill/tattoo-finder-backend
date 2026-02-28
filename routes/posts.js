const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// Create a new post
router.post('/', auth, upload.single('image'), postController.createPost);

// Get posts for the logged-in user's feed
router.get('/', auth, postController.getPosts);

// Get a single post by its ID
router.get('/:id', postController.getPostById);

// Like a post
router.put('/like/:id', auth, postController.likePost);

// Unlike a post
router.put('/unlike/:id', auth, postController.unlikePost);

// Add a comment to a post
router.post('/comment/:id', auth, postController.addComment);

// Update a post
router.put('/:id', auth, postController.updatePost);

// Delete a post
router.delete('/:id', auth, postController.deletePost);

// Delete a comment from a post
router.delete('/comment/:postId/:commentId', auth, postController.deleteComment);

// Like a comment
router.put('/comment/like/:postId/:commentId', auth, postController.likeComment);

// Unlike a comment
router.put('/comment/unlike/:postId/:commentId', auth, postController.unlikeComment);

// Dislike a comment
router.put('/comment/dislike/:postId/:commentId', auth, postController.dislikeComment);

// Un-dislike a comment
router.put('/comment/undislike/:postId/:commentId', auth, postController.undislikeComment);

module.exports = router;