// File: controllers/postController.js

const Post = require('../models/Post');
const { User } = require('../models/User');

// Create post
exports.createPost = async (req, res) => {
  try {
    const { caption, tags, styles } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }
    
    const processedTags = tags ? tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
    const processedStyles = styles ? styles.split(',').map(style => style.trim()) : [];
    
    const newPost = new Post({
      user: req.user.id,
      image: req.file.path,
      caption,
      tags: processedTags,
      styles: processedStyles
    });
    
    const post = await newPost.save();
    const populatedPost = await Post.findById(post._id).populate('user', 'name userType profilePic username');
    
    res.status(201).json(populatedPost);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all posts (feed)
exports.getPosts = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const usersForFeed = [...currentUser.following, req.user.id];

    const posts = await Post.find({ user: { $in: usersForFeed } })
      .sort({ createdAt: -1 })
      .populate('user', 'name userType profilePic username');
      
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get post by ID
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'name userType profilePic username')
      .populate('comments.user', 'username profilePic _id'); 
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Sort comments by the number of likes in descending order
    post.comments.sort((a, b) => b.likes.length - a.likes.length);
    
    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Like post
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    if (post.likes.includes(req.user.id)) {
      return res.status(400).json({ message: 'Post already liked' });
    }
    
    post.likes.push(req.user.id);
    await post.save();
    
    res.json(post.likes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Unlike post
exports.unlikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    if (!post.likes.includes(req.user.id)) {
      return res.status(400).json({ message: 'Post not yet liked' });
    }
    
    post.likes = post.likes.filter(like => like.toString() !== req.user.id);
    await post.save();
    
    res.json(post.likes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add comment
exports.addComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const newComment = {
      user: req.user.id,
      text: req.body.text
    };
    
    post.comments.unshift(newComment);
    await post.save();
    
    const populatedPost = await Post.findById(post._id).populate('comments.user', 'username profilePic _id');

    res.json(populatedPost.comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete post
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    if (post.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to delete this post' });
    }
    
    await Post.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a comment
exports.deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    const post = await Post.findOne({ _id: postId, 'comments._id': commentId });

    if (!post) {
      return res.status(404).json({ message: 'Comment or Post not found' });
    }

    const comment = post.comments.find(c => c._id.toString() === commentId);

    if (comment.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to delete this comment' });
    }

    const updatedPost = await Post.findByIdAndUpdate(postId, 
        { $pull: { comments: { _id: commentId } } },
        { new: true }
    ).populate('comments.user', 'username profilePic _id');

    res.json({ message: 'Comment deleted successfully', comments: updatedPost.comments });

  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Like a comment
exports.likeComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const post = await Post.findById(postId);
    const comment = post.comments.id(commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.likes.includes(req.user.id)) {
        return res.status(400).json({ message: 'Comment already liked' });
    }
    comment.likes.push(req.user.id);
    await post.save();

    res.json(comment.likes);
  } catch (error) {
    console.error('Error liking comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Unlike a comment
exports.unlikeComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const post = await Post.findById(postId);
    const comment = post.comments.id(commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    comment.likes = comment.likes.filter(like => like.toString() !== req.user.id);
    await post.save();
    
    res.json(comment.likes);
  } catch (error) {
    console.error('Error unliking comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};