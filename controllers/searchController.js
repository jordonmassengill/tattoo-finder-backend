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
    const { styles, location } = req.query;
    console.log('Searching posts with styles:', styles, 'location:', location);
    let searchCriteria = {};

    if (styles && styles.length > 0) {
      const styleArray = styles.split(',').map(style => style.trim());
      console.log('Searching for styles:', styleArray);
      searchCriteria.styles = { $in: styleArray };
    }

    if (location && location.length > 0) {
      const artists = await User.find({
        userType: 'artist',
        location: { $in: Array.isArray(location) ? location : [location] }
      }).select('_id');

      const artistIds = artists.map(artist => artist._id);

      if (artistIds.length > 0) {
        searchCriteria.user = { $in: artistIds };
      } else {
        return res.json([]);
      }
    }

    console.log('Post search criteria:', JSON.stringify(searchCriteria));

    const posts = await Post.find(searchCriteria)
      .sort({ 'createdAt': -1 })
      .limit(50)
      .populate('user', 'name userType profilePic username location');

    console.log(`Found ${posts.length} posts matching criteria`);
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
      .sort({ 'likes': -1 })
      .limit(20)
      .populate('user', 'name userType profilePic username location priceRange styles');

    res.json(posts);
  } catch (error) {
    console.error('Error fetching featured posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};