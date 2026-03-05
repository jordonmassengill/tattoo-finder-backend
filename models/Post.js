const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  image: {
    type: String,
    required: true
  },
  caption: {
    type: String,
    default: ''
  },
  tags: [String],
  // Structured categorization fields
  colorType: { type: String, enum: ['Black/Grey', 'Color', ''], default: '' },
  flashOrCustom: { type: String, enum: ['Flash Sheet', 'Tattoo Work', ''], default: '' },
  size: { type: String, enum: ['Small', 'Medium', 'Large', ''], default: '' },
  styles: [String],    // up to 2: Traditional, New School, Lettering, Realism, Illustrative, Tribal, Geometric, Neo-Traditional, Japanese, Blackwork, Minimalist, Fine Line, Micro-Realism, Watercolor, Chicano, Sketch, Trash Polka
  subjects: [String],  // up to 2: Animal, Floral, Traditional Imagery, Portrait, Lettering, Pop Culture, Anime, Nature, Dark, Fantasy, Spiritual, Decorative, Sci-fi, Abstract, Psychedelic, Nautical
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: String,
    date: {
      type: Date,
      default: Date.now
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    dislikes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Post', postSchema);