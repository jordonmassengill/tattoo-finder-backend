// controllers/searchController.js

const { User, Artist } = require('../models/User');
const Post = require('../models/Post');

// Search for artists by criteria
exports.searchArtists = async (req, res) => {
  try {
    const { location, priceRange, styles, query } = req.query;
    console.log('Searching artists with criteria:', { location, priceRange, styles, query });
    const searchCriteria = { userType: 'artist' };

    if (query) {
      searchCriteria.$or = [
        { name: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
        { bio: { $regex: query, $options: 'i' } }
      ];
    }

    if (location && location.length > 0) {
      searchCriteria.location = { $in: Array.isArray(location) ? location : [location] };
    }

    if (priceRange && priceRange.length > 0) {
      searchCriteria.priceRange = { $in: Array.isArray(priceRange) ? priceRange : [priceRange] };
    }

    if (styles && styles.length > 0) {
      const styleArray = styles.split(',').map(style => style.trim());
      const styleRegexes = styleArray.map(style => new RegExp(style, 'i'));
      searchCriteria.styles = { $in: styleRegexes };
    }

    console.log('Artist search criteria:', JSON.stringify(searchCriteria));

    const artists = await User.find(searchCriteria)
      .select('_id name username profilePic location priceRange styles followers')
      .limit(30);

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
    const { styles, location, priceRange } = req.query;
    let postSearchCriteria = {};

    // This flag tells us if we need to filter by artist attributes
    const hasArtistFilters = (location && location.length > 0) || (priceRange && priceRange.length > 0);

    if (hasArtistFilters) {
      const artistSearchCriteria = { userType: 'artist' };
      if (location && location.length > 0) {
        artistSearchCriteria.location = { $in: Array.isArray(location) ? location : [location] };
      }
      if (priceRange && priceRange.length > 0) {
        artistSearchCriteria.priceRange = { $in: Array.isArray(priceRange) ? priceRange : [priceRange] };
      }

      // Step 1: Find artists that match the location/price criteria
      const artists = await User.find(artistSearchCriteria).select('_id');
      const artistIds = artists.map(artist => artist._id);

      // CRITICAL FIX: If Step 1 found no artists, stop and return nothing.
      if (artistIds.length === 0) {
        return res.json([]);
      }

      // If artists were found, limit the post search to only their posts
      postSearchCriteria.user = { $in: artistIds };
    }

    // Now, apply the direct style filter, if it exists
    if (styles && styles.length > 0) {
      const styleArray = styles.split(',').map(style => style.trim());
      postSearchCriteria.styles = { $in: styleArray };
    }

    // If for some reason this endpoint was called with no filters, return empty
    if (Object.keys(postSearchCriteria).length === 0) {
        return res.json([]);
    }

    const posts = await Post.find(postSearchCriteria)
      .sort({ 'createdAt': -1 })
      .limit(50)
      .populate('user', 'name userType profilePic username location');

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
    let filterCriteria = {};
    let userCriteria = { userType: 'artist' };

    if (location && location.length > 0) {
      userCriteria.location = { $in: Array.isArray(location) ? location : [location] };
    }

    if (priceRange && priceRange.length > 0) {
      userCriteria.priceRange = { $in: Array.isArray(priceRange) ? priceRange : [priceRange] };
    }

    if (styles && styles.length > 0) {
      const styleArray = styles.split(',').map(style => style.trim());
      userCriteria.styles = { $in: styleArray };
    }

    const artists = await User.find(userCriteria).select('_id');
    const artistIds = artists.map(artist => artist._id);

    if (Object.keys(userCriteria).length > 1 && artistIds.length === 0) {
        return res.json([]);
    }

    if (artistIds.length > 0) {
        filterCriteria.user = { $in: artistIds };
    }
    
    const posts = await Post.find(filterCriteria)
      .sort({ 'createdAt': -1 }) // MODIFIED: Changed from 'likes' to 'createdAt'
      .limit(20)
      .populate('user', 'name userType profilePic username location priceRange styles');

    res.json(posts);
  } catch (error) {
    console.error('Error fetching featured posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};