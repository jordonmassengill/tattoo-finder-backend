const mongoose = require('mongoose');

const affiliationRequestSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

// Prevent duplicate requests in either direction
affiliationRequestSchema.index({ from: 1, to: 1 }, { unique: true });

module.exports = mongoose.model('AffiliationRequest', affiliationRequestSchema);
