const Post = require('../models/Post');
const { User } = require('../models/User');

// Create post
exports.createPost = async (req, res) => {
  try {
    console.log('Create post request body:', req.body);
    console.log('Create post request file:', req.file ? req.file.path : 'No file');
    
    const { caption, tags, styles } = req.body;
    
    // Check if image file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }
    
    // Process and normalize the input data
    const processedTags = tags ? tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
    const processedStyles = styles ? styles.split(',').map(style => style.trim()) : [];
    
    console.log('Processing post with:', {
      userId: req.user.id,
      caption,
      processedTags,
      processedStyles
    });
    
    // Create new post
    const newPost = new Post({
      user: req.user.id,
      image: req.file.path,
      caption,
      tags: processedTags,
      styles: processedStyles
    });
    
    console.log('New post object:', {
      user: newPost.user,
      image: newPost.image,
      caption: newPost.caption,
      tags: newPost.tags,
      styles: newPost.styles
    });
    
    const post = await newPost.save();
    console.log('Post saved with ID:', post._id);
    
    // Verify the saved post has styles
    const savedPost = await Post.findById(post._id);
    console.log('Saved post styles:', savedPost.styles);
    
    // Populate user info before returning
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
    // Find the current user to get their 'following' list
    const currentUser = await User.findById(req.user.id);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create a list of users whose posts should be in the feed
    // This includes the people the user is following, plus the user themselves
    const usersForFeed = [...currentUser.following, req.user.id];

    // Find all posts where the 'user' field is in our list of users
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
      .populate('comments.user', 'name profilePic');
      
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
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
    
    // Check if already liked
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
    
    // Check if not liked
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
    
    res.json(post.comments);
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
    
    // Check if user owns the post
    if (post.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to delete this post' });
    }
    
    // Delete the post
    await Post.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Server error' });
  }
};