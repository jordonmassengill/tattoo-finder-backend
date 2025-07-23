// routes/search.js
const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// Search artists by criteria
router.get('/artists', searchController.searchArtists);

// Search posts by various criteria
router.get('/posts', searchController.searchPosts);

module.exports = router;
