// controllers/searchController.js - Complete updated version

const { User, Artist } = require('../models/User');
const Post = require('../models/Post');

// Search for artists by criteria
exports.searchArtists = async (req, res) => {
  try {
    const { location, priceRange, styles, query } = req.query;
    
    console.log('Searching artists with criteria:', { location, priceRange, styles, query });
    
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
    
    // Add styles filter - ensure case insensitive matching
    if (styles && styles.length > 0) {
      const styleArray = styles.split(',').map(style => style.trim());
      const styleRegexes = styleArray.map(style => new RegExp(style, 'i'));
      searchCriteria.styles = { $in: styleRegexes };
    }
    
    console.log('Artist search criteria:', JSON.stringify(searchCriteria));
    
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
    
    console.log(`Found ${enhancedArtists.length} artists matching criteria`);
    res.json(enhancedArtists);
  } catch (error) {
    console.error('Error searching artists:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Search for posts by style
exports.searchPostsByStyle = async (req, res) => {
  try {
    const { styles, location } = req.query;
    
    console.log('Searching posts with styles:', styles, 'location:', location);
    
    // Build search criteria
    let searchCriteria = {};
    
    // Add styles filter if provided
    if (styles && styles.length > 0) {
      const styleArray = styles.split(',').map(style => style.trim());
      console.log('Searching for styles:', styleArray);
      
      // Try a different approach for matching styles (test if this works)
      // Instead of using regex, try direct array matching
      searchCriteria.styles = { $elemMatch: { $in: styleArray } };
    }
    
    // Filter by artist location if provided
    if (location) {
      // First find artists in that location
      const artists = await User.find({ 
        userType: 'artist',
        location: { $regex: location, $options: 'i' }
      }).select('_id');
      
      const artistIds = artists.map(artist => artist._id);
      
      if (artistIds.length > 0) {
        searchCriteria.user = { $in: artistIds };
      }
    }
    
    console.log('Post search criteria:', JSON.stringify(searchCriteria));
    
    // Get posts matching the criteria
    const posts = await Post.find(searchCriteria)
      .sort({ 'createdAt': -1 })
      .limit(50)
      .populate('user', 'name userType profilePic username location');
    
    console.log(`Found ${posts.length} posts matching criteria`);
    
    // Extra check to debug style matching issues
    if (styles && posts.length === 0) {
      // If no posts found with the given styles, let's check if any posts have styles at all
      const postsWithStyles = await Post.find({ styles: { $exists: true, $ne: [] } })
        .limit(5);
      
      console.log('Checking if any posts have styles field:', postsWithStyles.length);
      if (postsWithStyles.length > 0) {
        postsWithStyles.forEach(post => {
          console.log(`- Post ${post._id} has styles:`, post.styles);
        });
      } else {
        console.log('No posts found with any styles - check if styles are being saved');
      }
    }
    
    res.json(posts);
  } catch (error) {
    console.error('Error searching posts by style:', error);
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
      const styleArray = styles.split(',').map(style => style.trim());
      userCriteria.styles = { $in: styleArray };
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