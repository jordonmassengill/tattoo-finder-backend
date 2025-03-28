const { User, Artist, Shop } = require('../models/User');
const Post = require('../models/Post');

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user by ID or username
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findOne({
      $or: [
        { _id: req.params.id },
        { username: req.params.id }
      ]
    }).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user posts
exports.getUserPosts = async (req, res) => {
  try {
    const posts = await Post.find({ user: req.params.id })
      .sort({ createdAt: -1 })
      .populate('user', 'name userType profilePic username');
      
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
// Follow a user
exports.followUser = async (req, res) => {
  try {
    // Check if trying to follow self
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);
    
    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if already following
    if (currentUser.following.includes(req.params.id)) {
      return res.status(400).json({ message: 'Already following this user' });
    }
    
    // Add to following and followers lists
    await User.findByIdAndUpdate(req.user.id, {
      $push: { following: req.params.id }
    });
    
    await User.findByIdAndUpdate(req.params.id, {
      $push: { followers: req.user.id }
    });
    
    res.json({ message: 'Successfully followed user' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Unfollow a user
exports.unfollowUser = async (req, res) => {
  try {
    // Check if trying to unfollow self
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'You cannot unfollow yourself' });
    }
    
    const userToUnfollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);
    
    if (!userToUnfollow) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if not following
    if (!currentUser.following.includes(req.params.id)) {
      return res.status(400).json({ message: 'Not following this user' });
    }
    
    // Remove from following and followers lists
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { following: req.params.id }
    });
    
    await User.findByIdAndUpdate(req.params.id, {
      $pull: { followers: req.user.id }
    });
    
    res.json({ message: 'Successfully unfollowed user' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};