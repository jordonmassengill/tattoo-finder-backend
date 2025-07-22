const { User, Artist, Shop } = require('../models/User');
const Post = require('../models/Post');
const mongoose = require('mongoose');

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // MODIFIED: Return a structured object consistent with the login response
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      userType: user.userType,
      profilePic: user.profilePic,
      followers: user.followers,
      following: user.following,
      bio: user.bio,
      location: user.location,
      styles: user.styles,
      priceRange: user.priceRange
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user by ID or username
exports.getUserById = async (req, res) => {
  try {
    console.log('getUserById called with parameter:', req.params.id);
    
    // Try to find by MongoDB ID first
    let user = null;
    
    // Check if the parameter is a valid MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
    
    if (isValidObjectId) {
      // Try to find by ID
      user = await User.findById(req.params.id).select('-password');
    }
    
    // If not found by ID, try to find by username (case-insensitive)
    if (!user) {
      user = await User.findOne({
        username: { $regex: new RegExp('^' + req.params.id + '$', 'i') }
      }).select('-password');
    }
    
    console.log('User search result:', user ? `User found: ${user.username}` : 'User not found');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error in getUserById:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user posts
exports.getUserPosts = async (req, res) => {
  try {
    console.log('getUserPosts called with parameter:', req.params.id);
    
    // First, find the user by ID or username
    let user;
    
    // Check if the parameter is a valid MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
    
    if (isValidObjectId) {
      // Try to find by ID
      user = await User.findById(req.params.id);
    }
    
    // If not found by ID, try to find by username (case-insensitive)
    if (!user) {
      user = await User.findOne({
        username: { $regex: new RegExp('^' + req.params.id + '$', 'i') }
      });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log(`Found user: ${user.username}, ID: ${user._id}`);
    
    // Then get posts for that user
    const posts = await Post.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate('user', 'name userType profilePic username');
    
    console.log(`Found ${posts.length} posts for user ${user.username}`);
      
    res.json(posts);
  } catch (error) {
    console.error('Error in getUserPosts:', error);
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

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { bio, location, styles, priceRange } = req.body;
    const userId = req.user.id;
    
    // Find the user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update only the fields that are provided
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    
    // Only update priceRange if user is an artist and priceRange is provided
    if (user.userType === 'artist' && priceRange !== undefined) {
      // Validate that priceRange is one of the allowed values
      if (priceRange === '' || ['$', '$$', '$$$', '$$$$'].includes(priceRange)) {
        user.priceRange = priceRange;
      }
    }
    
    // Only update styles if user is an artist and styles are provided
    if (user.userType === 'artist' && styles !== undefined) {
      user.styles = styles;
    }
    
    // Handle profile picture if uploaded
    if (req.file) {
      user.profilePic = req.file.path;
    }
    
    await user.save();
    
    // Return updated user without password
    const updatedUser = await User.findById(userId).select('-password');
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add a new route handler specifically for profile picture updates
exports.updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }
    
    // Find and update the user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.profilePic = req.file.path;
    await user.save();
    
    res.json({ 
      message: 'Profile picture updated successfully',
      profilePic: user.profilePic
    });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete user account
exports.deleteUser = async (req, res) => {
  try {
    // Make sure user can only delete their own account
    if (req.user.id !== req.params.id) {
      return res.status(401).json({ message: 'Not authorized to delete this account' });
    }

    // Find and remove the user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // If user is an artist and belongs to a shop, remove from shop's artists list
    if (user.userType === 'artist' && user.shop) {
      await User.findByIdAndUpdate(user.shop, {
        $pull: { artists: user._id }
      });
    }
    
    // If user is a shop, handle its artists (maybe set their shop field to null)
    if (user.userType === 'shop' && user.artists && user.artists.length > 0) {
      // Update all artists to remove shop association
      await User.updateMany(
        { _id: { $in: user.artists } },
        { $unset: { shop: "" } }
      );
    }
    
    // Delete all posts by this user
    await Post.deleteMany({ user: user._id });
    
    // Remove user's likes and comments from other posts
    await Post.updateMany(
      { likes: user._id },
      { $pull: { likes: user._id } }
    );
    
    await Post.updateMany(
      { 'comments.user': user._id },
      { $pull: { comments: { user: user._id } } }
    );
    
    // Remove user from followers and following lists
    await User.updateMany(
      { followers: user._id },
      { $pull: { followers: user._id } }
    );
    
    await User.updateMany(
      { following: user._id },
      { $pull: { following: user._id } }
    );
    
    // Finally delete the user
    await User.findByIdAndDelete(user._id);
    
    res.json({ message: 'Account successfully deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};