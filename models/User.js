const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Base User Schema
const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  username: {
    type: String,
    required: true,
    unique: true,
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  profilePic: { 
    type: String, 
    default: '/default-profile.png' 
  },
  userType: { 
    type: String, 
    required: true,
    enum: ['enthusiast', 'artist', 'shop']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
});

// Create additional schemas for different user types
const enthusiastSchema = new mongoose.Schema({
  savedPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }]
});

const artistSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true 
  },
  bio: String,
  location: String,
  priceRange: {
    type: String,
    enum: ['$', '$$', '$$$', '$$$$'], // Restrict to these 4 values
    default: ''
  },
  styles: [String],
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const shopSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true 
  },
  bio: String,
  location: String,
  phone: String,
  website: String,
  hours: String,
  artists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Create the models
const User = mongoose.model('User', userSchema);
const Enthusiast = User.discriminator('Enthusiast', enthusiastSchema);
const Artist = User.discriminator('Artist', artistSchema);
const Shop = User.discriminator('Shop', shopSchema);

module.exports = { User, Enthusiast, Artist, Shop };