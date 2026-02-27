const { User } = require('../models/User');
const Post = require('../models/Post');
const mongoose = require('mongoose');

// Search for artists by criteria
exports.searchArtists = async (req, res) => {
  try {
    const { location, priceRange, query, sort, inkSpecialty, designSpecialty, foundationalStyleSpecialties, techniqueSpecialties, subjectSpecialties } = req.query;
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
    if (inkSpecialty) {
      searchCriteria.inkSpecialty = inkSpecialty;
    }
    if (designSpecialty) {
      searchCriteria.designSpecialty = designSpecialty;
    }
    if (foundationalStyleSpecialties) {
      const arr = foundationalStyleSpecialties.split(',').map(s => s.trim());
      searchCriteria.foundationalStyleSpecialties = { $in: arr };
    }
    if (techniqueSpecialties) {
      const arr = techniqueSpecialties.split(',').map(s => s.trim());
      searchCriteria.techniqueSpecialties = { $in: arr };
    }
    if (subjectSpecialties) {
      const arr = subjectSpecialties.split(',').map(s => s.trim());
      searchCriteria.subjectSpecialties = { $in: arr };
    }

    const aggregation = [
      { $match: searchCriteria },
      { $addFields: { followersCount: { $size: "$followers" } } },
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: 'user',
          as: '_posts',
        },
      },
      {
        $addFields: {
          totalLikes: {
            $reduce: {
              input: '$_posts',
              initialValue: 0,
              in: { $add: ['$$value', { $size: '$$this.likes' }] },
            },
          },
        },
      },
    ];

    if (sort === 'newest') {
      aggregation.push({ $sort: { createdAt: -1 } });
    } else {
      aggregation.push({ $sort: { followersCount: -1, createdAt: -1 } });
    }

    aggregation.push(
      { $limit: 30 },
      { $project: { password: 0, __v: 0, _posts: 0 } }
    );

    const artists = await User.aggregate(aggregation);
    res.json(artists);

  } catch (error) {
    console.error('Error searching artists:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Primary search endpoint for posts.
exports.searchPosts = async (req, res) => {
  try {
    const { location, priceRange, sort, query, colorType, flashOrCustom, size, foundationalStyles, techniques, subjects } = req.query;
    const finalFilter = {};
    const postConditions = [];

    // --- 1. Handle Artist-based Filters (Location, Price Range) ---
    const hasArtistFilters = (location && location.length > 0) || (priceRange && priceRange.length > 0);
    if (hasArtistFilters) {
      const artistFilter = { userType: 'artist' };
      if (location && location.length > 0) {
        artistFilter.location = { $in: Array.isArray(location) ? location : [location] };
      }
      if (priceRange && priceRange.length > 0) {
        artistFilter.priceRange = { $in: Array.isArray(priceRange) ? priceRange : [priceRange] };
      }
      const artists = await User.find(artistFilter).select('_id');
      const artistIdsFromFilters = artists.map(artist => artist._id);

      if (artistIdsFromFilters.length === 0) {
        return res.json([]); // No artists match these filters, so no posts will match.
      }
      postConditions.push({ user: { $in: artistIdsFromFilters } });
    }

    // --- 2. Handle Post-based Category Filters ---
    if (colorType) {
      postConditions.push({ colorType });
    }
    if (flashOrCustom) {
      postConditions.push({ flashOrCustom });
    }
    if (size) {
      postConditions.push({ size });
    }
    if (foundationalStyles && foundationalStyles.length > 0) {
      const arr = foundationalStyles.split(',').map(s => s.trim());
      postConditions.push({ foundationalStyles: { $in: arr } });
    }
    if (techniques && techniques.length > 0) {
      const arr = techniques.split(',').map(s => s.trim());
      postConditions.push({ techniques: { $in: arr } });
    }
    if (subjects && subjects.length > 0) {
      const arr = subjects.split(',').map(s => s.trim());
      postConditions.push({ subjects: { $in: arr } });
    }

    // --- 3. Handle Text Query (Caption, Tags, AND Username) ---
    if (query) {
      const searchRegex = new RegExp(query, 'i');
      const textQueryOrConditions = [
        { caption: { $regex: searchRegex } },
        { tags: { $regex: searchRegex } }
      ];

      const artistsFromUsername = await User.find({ username: searchRegex, userType: 'artist' }).select('_id');
      if (artistsFromUsername.length > 0) {
        const artistIdsFromUsername = artistsFromUsername.map(a => a._id);
        textQueryOrConditions.push({ user: { $in: artistIdsFromUsername } });
      }

      postConditions.push({ $or: textQueryOrConditions });
    }

    // --- 4. Combine all conditions ---
    if (postConditions.length > 0) {
      finalFilter.$and = postConditions;
    }

    // --- 5. Build and Execute Aggregation Pipeline ---
    const aggregation = [
      { $match: finalFilter },
      { $addFields: { likeCount: { $size: "$likes" } } }
    ];

    if (sort === 'likes') {
      aggregation.push({ $sort: { likeCount: -1, createdAt: -1 } });
    } else {
      aggregation.push({ $sort: { createdAt: -1 } });
    }

    aggregation.push(
      { $limit: 50 },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" }
    );

    const posts = await Post.aggregate(aggregation);
    res.json(posts);

  } catch (error) {
    console.error('Error searching posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
