// routes/search.js
const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// Search artists by criteria
router.get('/artists', searchController.searchArtists);

// Get featured posts
router.get('/featured', searchController.getFeaturedPosts);

module.exports = router;