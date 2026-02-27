const Post = require('../models/Post');
const { User } = require('../models/User');

// --- UNCHANGED FUNCTIONS ---
exports.createPost = async (req, res) => {
  try {
    const { caption, tags, colorType, flashOrCustom, size, foundationalStyles, techniques, subjects } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }
    const processedTags = tags ? tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
    const processedFoundationalStyles = foundationalStyles ? foundationalStyles.split(',').map(s => s.trim()).filter(Boolean) : [];
    const processedTechniques = techniques ? techniques.split(',').map(s => s.trim()).filter(Boolean) : [];
    const processedSubjects = subjects ? subjects.split(',').map(s => s.trim()).filter(Boolean) : [];

    const newPost = new Post({
      user: req.user.id,
      image: req.file.path,
      caption,
      tags: processedTags,
      colorType: colorType || '',
      flashOrCustom: flashOrCustom || '',
      size: size || '',
      foundationalStyles: processedFoundationalStyles,
      techniques: processedTechniques,
      subjects: processedSubjects,
    });
    const post = await newPost.save();
    const populatedPost = await Post.findById(post._id).populate('user', 'name userType profilePic username');
    res.status(201).json(populatedPost);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.getPosts = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    const usersForFeed = [...currentUser.following, req.user.id];
    const posts = await Post.find({ user: { $in: usersForFeed } })
      .sort({ createdAt: -1 })
      .populate('user', 'name userType profilePic username');
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'name userType profilePic username')
      .populate('comments.user', 'username profilePic _id');
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // THE FIX IS HERE: Sort by total score (likes - dislikes)
    post.comments.sort((a, b) => (b.likes.length - b.dislikes.length) - (a.likes.length - a.dislikes.length));
    
    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    if (!post.likes.includes(req.user.id)) {
      post.likes.push(req.user.id);
    }
    await post.save();
    res.json(post.likes);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
exports.unlikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    post.likes = post.likes.filter(like => like.toString() !== req.user.id);
    await post.save();
    res.json(post.likes);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
exports.addComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const newComment = { user: req.user.id, text: req.body.text };
    post.comments.unshift(newComment);
    await post.save();
    const populatedPost = await Post.findById(post._id).populate('comments.user', 'username profilePic _id');
    res.json(populatedPost.comments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    if (post.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to delete this post' });
    }
    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
exports.deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const post = await Post.findById(postId);
    if (!post) { return res.status(404).json({ message: 'Post not found' }); }

    const comment = post.comments.id(commentId);
    if (!comment) { return res.status(404).json({ message: 'Comment not found' }); }
    
    if (comment.user.toString() !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to delete comment' });
    }

    comment.deleteOne();
    await post.save();
    const populatedPost = await Post.findById(postId).populate('comments.user', 'username profilePic _id');
    res.json({ comments: populatedPost.comments });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- CORRECTED COMMENT INTERACTION FUNCTIONS ---

const findPostAndComment = async (postId, commentId) => {
    const post = await Post.findById(postId);
    if (!post) throw new Error('Post not found');
    const comment = post.comments.id(commentId);
    if (!comment) throw new Error('Comment not found');
    return { post, comment };
};

exports.likeComment = async (req, res) => {
  try {
    const { post, comment } = await findPostAndComment(req.params.postId, req.params.commentId);
    const userId = req.user.id;
    
    comment.dislikes = comment.dislikes.filter(id => id.toString() !== userId);
    comment.likes.addToSet(userId);

    await post.save();
    
    const updatedPost = await Post.findById(post._id).populate('comments.user', 'username profilePic _id');
    res.json(updatedPost.comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unlikeComment = async (req, res) => {
  try {
    const { post, comment } = await findPostAndComment(req.params.postId, req.params.commentId);
    
    comment.likes.pull(req.user.id);

    await post.save();

    const updatedPost = await Post.findById(post._id).populate('comments.user', 'username profilePic _id');
    res.json(updatedPost.comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.dislikeComment = async (req, res) => {
  try {
    const { post, comment } = await findPostAndComment(req.params.postId, req.params.commentId);
    const userId = req.user.id;

    comment.likes = comment.likes.filter(id => id.toString() !== userId);
    comment.dislikes.addToSet(userId);

    await post.save();

    const updatedPost = await Post.findById(post._id).populate('comments.user', 'username profilePic _id');
    res.json(updatedPost.comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.undislikeComment = async (req, res) => {
  try {
    const { post, comment } = await findPostAndComment(req.params.postId, req.params.commentId);
    
    comment.dislikes.pull(req.user.id);

    await post.save();
    
    const updatedPost = await Post.findById(post._id).populate('comments.user', 'username profilePic _id');
    res.json(updatedPost.comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};