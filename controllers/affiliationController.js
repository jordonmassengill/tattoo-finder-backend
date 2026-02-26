const { User } = require('../models/User');
const AffiliationRequest = require('../models/AffiliationRequest');

// POST /api/affiliations/request/:targetId
// Send an affiliation request (artist→shop or shop→artist)
exports.sendRequest = async (req, res) => {
  try {
    const fromUser = await User.findById(req.user.id);
    const toUser = await User.findById(req.params.targetId);

    if (!toUser) return res.status(404).json({ message: 'User not found' });

    if (fromUser._id.toString() === toUser._id.toString()) {
      return res.status(400).json({ message: 'Cannot send a request to yourself' });
    }

    // Must be an artist-shop pair
    const validPair =
      (fromUser.userType === 'artist' && toUser.userType === 'shop') ||
      (fromUser.userType === 'shop'   && toUser.userType === 'artist');

    if (!validPair) {
      return res.status(400).json({ message: 'Affiliation must be between an artist and a shop' });
    }

    // Determine which is which
    const artist = fromUser.userType === 'artist' ? fromUser : toUser;
    const shop   = fromUser.userType === 'shop'   ? fromUser : toUser;

    // Artist can only belong to one shop at a time
    if (artist.shop) {
      return res.status(400).json({ message: 'Artist is already affiliated with a shop' });
    }

    // Check if already affiliated (shouldn't happen if artist.shop is unset, but be safe)
    const alreadyInShop = shop.artists && shop.artists.some(id => id.toString() === artist._id.toString());
    if (alreadyInShop) {
      return res.status(400).json({ message: 'Already affiliated' });
    }

    // Check for an existing pending request in either direction
    const existing = await AffiliationRequest.findOne({
      $or: [
        { from: fromUser._id, to: toUser._id },
        { from: toUser._id, to: fromUser._id }
      ]
    });
    if (existing) return res.status(400).json({ message: 'A pending request already exists' });

    const request = await AffiliationRequest.create({ from: fromUser._id, to: toUser._id });
    await request.populate('from', 'username profilePic userType');
    await request.populate('to',   'username profilePic userType');

    res.json(request);
  } catch (error) {
    console.error('Error sending affiliation request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/affiliations/accept/:requestId
// Accept a pending request — only the recipient (to) may accept
exports.acceptRequest = async (req, res) => {
  try {
    const request = await AffiliationRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.to.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to accept this request' });
    }

    const fromUser = await User.findById(request.from);
    const toUser   = await User.findById(request.to);

    if (!fromUser || !toUser) {
      await AffiliationRequest.findByIdAndDelete(request._id);
      return res.status(404).json({ message: 'One or both users no longer exist' });
    }

    const artist = fromUser.userType === 'artist' ? fromUser : toUser;
    const shop   = fromUser.userType === 'shop'   ? fromUser : toUser;

    // Re-validate: artist must not already have a shop
    if (artist.shop) {
      await AffiliationRequest.findByIdAndDelete(request._id);
      return res.status(400).json({ message: 'Artist is already affiliated with a shop' });
    }

    // Create the affiliation on both sides atomically
    await User.findByIdAndUpdate(artist._id, { shop: shop._id });
    await User.findByIdAndUpdate(shop._id,   { $addToSet: { artists: artist._id } });

    // Remove the pending request
    await AffiliationRequest.findByIdAndDelete(request._id);

    res.json({ message: 'Affiliation accepted', artistId: artist._id, shopId: shop._id });
  } catch (error) {
    console.error('Error accepting affiliation request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/affiliations/request/:requestId
// Decline or cancel a pending request — either party may do this
exports.declineRequest = async (req, res) => {
  try {
    const request = await AffiliationRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.from.toString() !== req.user.id && request.to.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await AffiliationRequest.findByIdAndDelete(request._id);
    res.json({ message: 'Request declined/cancelled' });
  } catch (error) {
    console.error('Error declining affiliation request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/affiliations/remove/:targetId
// Remove an existing affiliation — either the artist or the shop may do this
exports.removeAffiliation = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const targetUser  = await User.findById(req.params.targetId);

    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    const validPair =
      (currentUser.userType === 'artist' && targetUser.userType === 'shop') ||
      (currentUser.userType === 'shop'   && targetUser.userType === 'artist');

    if (!validPair) {
      return res.status(400).json({ message: 'Not a valid artist-shop pair' });
    }

    const artist = currentUser.userType === 'artist' ? currentUser : targetUser;
    const shop   = currentUser.userType === 'shop'   ? currentUser : targetUser;

    const isAffiliated =
      artist.shop && artist.shop.toString() === shop._id.toString();

    if (!isAffiliated) {
      return res.status(400).json({ message: 'Not currently affiliated' });
    }

    await User.findByIdAndUpdate(artist._id, { $unset: { shop: '' } });
    await User.findByIdAndUpdate(shop._id,   { $pull: { artists: artist._id } });

    res.json({ message: 'Affiliation removed' });
  } catch (error) {
    console.error('Error removing affiliation:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/affiliations/pending
// All pending requests that involve the current user (as sender or recipient)
exports.getPendingRequests = async (req, res) => {
  try {
    const requests = await AffiliationRequest.find({
      $or: [{ from: req.user.id }, { to: req.user.id }]
    })
      .populate('from', 'username profilePic userType')
      .populate('to',   'username profilePic userType')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error getting pending requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/affiliations/status/:targetId
// Return the current affiliation relationship between the logged-in user and targetId
exports.getAffiliationStatus = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const targetId = req.params.targetId;

    // Check if already affiliated
    let isAffiliated = false;
    if (currentUser.userType === 'artist') {
      isAffiliated = !!(currentUser.shop && currentUser.shop.toString() === targetId);
    } else if (currentUser.userType === 'shop') {
      isAffiliated = !!(currentUser.artists && currentUser.artists.some(id => id.toString() === targetId));
    }

    if (isAffiliated) return res.json({ status: 'affiliated' });

    // Check for a pending request in either direction
    const request = await AffiliationRequest.findOne({
      $or: [
        { from: req.user.id, to: targetId },
        { from: targetId, to: req.user.id }
      ]
    });

    if (!request) return res.json({ status: 'none' });

    if (request.from.toString() === req.user.id) {
      return res.json({ status: 'pending_sent', requestId: request._id });
    } else {
      return res.json({ status: 'pending_received', requestId: request._id });
    }
  } catch (error) {
    console.error('Error getting affiliation status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
