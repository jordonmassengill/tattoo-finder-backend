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
  // New structured categorization fields
  colorType: { type: String, enum: ['Black/Grey', 'Color', ''], default: '' },
  flashOrCustom: { type: String, enum: ['Flash', 'Custom', ''], default: '' },
  size: { type: String, enum: ['Small', 'Medium', 'Large', ''], default: '' },
  foundationalStyles: [String], // up to 2: Traditional, Neo-Traditional, Japanese/Irezumi, Realism, Tribal, Blackwork, New School, Chicano, Trash Polka
  techniques: [String],         // up to 2: Dotwork, Linework, Watercolor, Geometric, Minimalist, Fine Line, Free Hand, Illustrative, Sketch
  subjects: [String],           // up to 2: Animal, Floral/Nature, Portrait, Pop Culture, Dark, Spiritual, Decorative, Lettering, Abstract, Sci-Fi, Psychedelic
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