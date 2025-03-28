// controllers/searchController.js
const { User, Artist } = require('../models/User');
const Post = require('../models/Post');

// Search for artists by criteria
exports.searchArtists = async (req, res) => {
  try {
    const { location, priceRange, styles, query } = req.query;
    
    // Build search criteria
    const searchCriteria = { userType: 'artist' };
    
    // Add text search if query is provided
    if (query) {
      searchCriteria.$or = [
        { name: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
        { bio: { $regex: query, $options: 'i' } }
      ];
    }
    
    // Add location filter
    if (location) {
      searchCriteria.location = { $regex: location, $options: 'i' };
    }
    
    // Add price range filter
    if (priceRange && priceRange.length > 0) {
      searchCriteria.priceRange = { $in: priceRange };
    }
    
    // Add styles filter
    if (styles && styles.length > 0) {
      searchCriteria.styles = { $in: styles.split(',') };
    }
    
    // Find artists matching criteria
    const artists = await User.find(searchCriteria)
      .select('_id name username profilePic location priceRange styles')
      .limit(30);
    
    // Enhance with post count and followers count
    const enhancedArtists = await Promise.all(artists.map(async (artist) => {
      const postCount = await Post.countDocuments({ user: artist._id });
      return {
        ...artist.toObject(),
        postCount,
        followersCount: artist.followers?.length || 0
      };
    }));
    
    res.json(enhancedArtists);
  } catch (error) {
    console.error('Error searching artists:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get featured posts for search page
exports.getFeaturedPosts = async (req, res) => {
  try {
    const { location, priceRange, styles } = req.query;
    
    // Build filter criteria
    let filterCriteria = {};
    let userCriteria = { userType: 'artist' };
    
    // Add location filter
    if (location) {
      userCriteria.location = { $regex: location, $options: 'i' };
    }
    
    // Add price range filter
    if (priceRange && priceRange.length > 0) {
      userCriteria.priceRange = { $in: priceRange };
    }
    
    // Add styles filter
    if (styles && styles.length > 0) {
      userCriteria.styles = { $in: styles.split(',') };
    }
    
    // Get artist IDs matching criteria
    const artists = await User.find(userCriteria).select('_id');
    const artistIds = artists.map(artist => artist._id);
    
    if (artistIds.length > 0) {
      filterCriteria.user = { $in: artistIds };
    }
    
    // Get posts with most likes
    const posts = await Post.find(filterCriteria)
      .sort({ 'likes.length': -1 })
      .limit(20)
      .populate('user', 'name userType profilePic username location priceRange styles');
    
    res.json(posts);
  } catch (error) {
    console.error('Error fetching featured posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};