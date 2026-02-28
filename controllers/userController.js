const { User, Artist, Shop } = require('../models/User');
const Post = require('../models/Post');
const AffiliationRequest = require('../models/AffiliationRequest');
const mongoose = require('mongoose');

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      userType: user.userType,
      profilePic: user.profilePic,
      followers: user.followers,
      following: user.following,
      savedPosts: user.savedPosts,
      bio: user.bio,
      location: user.location,
      priceRange: user.priceRange,
      inkSpecialty: user.inkSpecialty,
      designSpecialty: user.designSpecialty,
      foundationalStyles: user.foundationalStyles,
      foundationalStyleSpecialties: user.foundationalStyleSpecialties,
      techniques: user.techniques,
      techniqueSpecialties: user.techniqueSpecialties,
      subjects: user.subjects,
      subjectSpecialties: user.subjectSpecialties,
    });
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user by ID or username
exports.getUserById = async (req, res) => {
  try {
    console.log('getUserById called with parameter:', req.params.id);

    let user = null;

    const isValidObjectId = mongoose.Types.ObjectId.isValid(req.params.id);

    if (isValidObjectId) {
      user = await User.findById(req.params.id).select('-password');
    }

    if (!user) {
      user = await User.findOne({
        username: { $regex: new RegExp('^' + req.params.id + '$', 'i') }
      }).select('-password');
    }

    console.log('User search result:', user ? `User found: ${user.username}` : 'User not found');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.userType === 'shop') {
      await user.populate('artists', 'username profilePic userType');
    } else if (user.userType === 'artist' && user.shop) {
      await user.populate('shop', '_id username profilePic');
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

    let user;

    const isValidObjectId = mongoose.Types.ObjectId.isValid(req.params.id);

    if (isValidObjectId) {
      user = await User.findById(req.params.id);
    }

    if (!user) {
      user = await User.findOne({
        username: { $regex: new RegExp('^' + req.params.id + '$', 'i') }
      });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log(`Found user: ${user.username}, ID: ${user._id}`);

    let userIds = [user._id];

    if (req.query.includeArtists === 'true' && user.userType === 'shop' && user.artists && user.artists.length > 0) {
      userIds = [user._id, ...user.artists];
    }

    const posts = await Post.find({ user: { $in: userIds } })
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
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);

    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (currentUser.following.includes(req.params.id)) {
      return res.status(400).json({ message: 'Already following this user' });
    }

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
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'You cannot unfollow yourself' });
    }

    const userToUnfollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);

    if (!userToUnfollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!currentUser.following.includes(req.params.id)) {
      return res.status(400).json({ message: 'Not following this user' });
    }

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
    const {
      bio, location, priceRange,
      inkSpecialty, designSpecialty,
      foundationalStyles, foundationalStyleSpecialties,
      techniques, techniqueSpecialties,
      subjects, subjectSpecialties,
    } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;

    if (user.userType === 'artist') {
      if (priceRange !== undefined && (priceRange === '' || ['$', '$$', '$$$', '$$$$'].includes(priceRange))) {
        user.priceRange = priceRange;
      }
      if (inkSpecialty !== undefined) user.inkSpecialty = inkSpecialty;
      if (designSpecialty !== undefined) user.designSpecialty = designSpecialty;
      if (foundationalStyles !== undefined) user.foundationalStyles = foundationalStyles;
      if (foundationalStyleSpecialties !== undefined) user.foundationalStyleSpecialties = foundationalStyleSpecialties;
      if (techniques !== undefined) user.techniques = techniques;
      if (techniqueSpecialties !== undefined) user.techniqueSpecialties = techniqueSpecialties;
      if (subjects !== undefined) user.subjects = subjects;
      if (subjectSpecialties !== undefined) user.subjectSpecialties = subjectSpecialties;
    }

    if (req.file) {
      user.profilePic = req.file.path;
    }

    await user.save();

    const updatedUser = await User.findById(userId).select('-password');

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update profile picture
exports.updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

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
    if (req.user.id !== req.params.id) {
      return res.status(401).json({ message: 'Not authorized to delete this account' });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.userType === 'artist' && user.shop) {
      await Shop.findByIdAndUpdate(user.shop, {
        $pull: { artists: user._id }
      });
    }

    if (user.userType === 'shop' && user.artists && user.artists.length > 0) {
      await Artist.updateMany(
        { _id: { $in: user.artists } },
        { $unset: { shop: "" } }
      );
    }

    await Post.deleteMany({ user: user._id });

    await Post.updateMany(
      { likes: user._id },
      { $pull: { likes: user._id } }
    );

    await Post.updateMany(
      { 'comments.user': user._id },
      { $pull: { comments: { user: user._id } } }
    );

    await User.updateMany(
      { followers: user._id },
      { $pull: { followers: user._id } }
    );

    await User.updateMany(
      { following: user._id },
      { $pull: { following: user._id } }
    );

    await AffiliationRequest.deleteMany({
      $or: [{ from: user._id }, { to: user._id }]
    });

    await User.findByIdAndDelete(user._id);

    res.json({ message: 'Account successfully deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Save a post
exports.savePost = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { savedPosts: req.params.postId }
    });

    const updatedUser = await User.findById(req.user.id).select('savedPosts');
    res.json(updatedUser);
  } catch (error) {
    console.error('Error saving post:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Unsave a post
exports.unsavePost = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndUpdate(req.user.id, {
      $pull: { savedPosts: req.params.postId }
    });

    const updatedUser = await User.findById(req.user.id).select('savedPosts');
    res.json(updatedUser);
  } catch (error) {
    console.error('Error unsaving post:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all saved posts
exports.getSavedPosts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'savedPosts',
        populate: {
          path: 'user',
          select: 'username profilePic location priceRange'
        }
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.savedPosts.reverse());
  } catch (error) {
    console.error('Error getting saved posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide current and new password' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get users that the current user follows
exports.getFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('following', 'username profilePic userType location priceRange bio inkSpecialty designSpecialty foundationalStyleSpecialties techniqueSpecialties subjectSpecialties followers');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.following);
  } catch (error) {
    console.error('Error getting following:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
