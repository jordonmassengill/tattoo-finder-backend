const { User } = require('../models/User');
const Post = require('../models/Post');
const mongoose = require('mongoose');

// Search for artists by criteria
exports.searchArtists = async (req, res) => {
  try {
    // The 'sort' parameter is now read from the query
    const { location, priceRange, styles, query, sort } = req.query;
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

    // --- NEW SORTING LOGIC ---
    // Refactored to use an aggregation pipeline for powerful sorting.
    const aggregation = [
      { $match: searchCriteria },
      // Create a temporary field 'followersCount' to sort by.
      { $addFields: { followersCount: { $size: "$followers" } } },
    ];

    // Apply the correct sort stage based on the query parameter.
    if (sort === 'newest') {
      aggregation.push({ $sort: { createdAt: -1 } });
    } else { 
      // Default sort for artists is by most followers.
      aggregation.push({ $sort: { followersCount: -1, createdAt: -1 } });
    }

    // Add final stages for limiting and cleaning up the output.
    aggregation.push(
      { $limit: 30 },
      { $project: { password: 0, __v: 0 } } // Exclude sensitive data
    );

    const artists = await User.aggregate(aggregation);
    res.json(artists);

  } catch (error) {
    console.error('Error searching artists:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// This function is now the primary search endpoint for posts.
exports.searchPosts = async (req, res) => {
  try {
    const { styles, location, priceRange, sort } = req.query;
    let artistFilter = { userType: 'artist' };
    let postFilter = {};

    // If location or price filters exist, find the artists who match first.
    const hasArtistFilters = (location && location.length > 0) || (priceRange && priceRange.length > 0);
    if (hasArtistFilters) {
      if (location && location.length > 0) {
        artistFilter.location = { $in: Array.isArray(location) ? location : [location] };
      }
      if (priceRange && priceRange.length > 0) {
        artistFilter.priceRange = { $in: Array.isArray(priceRange) ? priceRange : [priceRange] };
      }
      const artists = await User.find(artistFilter).select('_id');
      const artistIds = artists.map(artist => artist._id);

      if (artistIds.length === 0) {
        return res.json([]); // No artists match, so no posts will match.
      }
      postFilter.user = { $in: artistIds };
    }

    // Add style filter for posts.
    if (styles && styles.length > 0) {
      const styleArray = styles.split(',').map(style => style.trim());
      postFilter.styles = { $in: styleArray };
    }

    // --- NEW SORTING LOGIC ---
    // Using an aggregation pipeline to sort posts by likes.
    const aggregation = [
      { $match: postFilter },
      // Create a temporary field 'likeCount' to sort by.
      { $addFields: { likeCount: { $size: "$likes" } } }
    ];
    
    if (sort === 'likes') {
      // Sort by likes, with newest as a tie-breaker.
      aggregation.push({ $sort: { likeCount: -1, createdAt: -1 } });
    } else {
      // Default sort for posts is newest.
      aggregation.push({ $sort: { createdAt: -1 } });
    }

    // Add final stages for limiting and populating user data.
    aggregation.push(
      { $limit: 50 },
      {
        $lookup: { // This replaces .populate() in an aggregation.
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" } // Converts the 'user' array into an object.
    );

    const posts = await Post.aggregate(aggregation);
    res.json(posts);

  } catch (error) {
    console.error('Error searching posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Keep the old function names but point them to the new, unified search function
// This ensures the frontend doesn't break if it's still calling the old endpoints.
exports.getFeaturedPosts = exports.searchPosts;
exports.searchPostsByStyle = exports.searchPosts;