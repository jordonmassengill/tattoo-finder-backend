const { User, Enthusiast, Artist, Shop } = require('../models/User');
const jwt = require('jsonwebtoken');

// Register user
exports.register = async (req, res) => {
  try {
    const { email, username, password, userType, ...extraFields } = req.body;
    
    // Check if email or username already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    
    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ message: 'Username can only contain letters, numbers, and underscores' });
    }
    
    // Create appropriate user type with username for all types
    let user;
    
    if (userType === 'enthusiast') {
      user = new Enthusiast({ 
        email, password, userType, username 
      });
    } else if (userType === 'artist') {
      // Validate priceRange if provided
      const priceRange = extraFields.priceRange;
      if (priceRange && !['$', '$$', '$$$', '$$$$'].includes(priceRange)) {
        return res.status(400).json({ message: 'Invalid price range' });
      }
      
      user = new Artist({
        email, password, userType, username,
        bio: extraFields.bio,
        location: extraFields.location,
        priceRange: extraFields.priceRange || '',
        inkSpecialty: extraFields.inkSpecialty || '',
        designSpecialty: extraFields.designSpecialty || '',
        foundationalStyles: extraFields.foundationalStyles || [],
        foundationalStyleSpecialties: extraFields.foundationalStyleSpecialties || [],
        techniques: extraFields.techniques || [],
        techniqueSpecialties: extraFields.techniqueSpecialties || [],
        subjects: extraFields.subjects || [],
        subjectSpecialties: extraFields.subjectSpecialties || [],
      });
    } else if (userType === 'shop') {
      user = new Shop({
        email, password, userType, username,
        bio: extraFields.bio,
        location: extraFields.location
      });
    } else {
      return res.status(400).json({ message: 'Invalid user type' });
    }
    
    await user.save();
    
    // Create and return token
    const token = jwt.sign(
      { id: user._id, userType: user.userType }, 
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        profilePic: user.profilePic,
        // Include type-specific fields based on userType
        ...(userType !== 'enthusiast' && { 
          bio: user.bio,
          location: user.location
        }),
        ...(userType === 'artist' && {
          priceRange: user.priceRange,
          inkSpecialty: user.inkSpecialty,
          designSpecialty: user.designSpecialty,
          foundationalStyles: user.foundationalStyles,
          foundationalStyleSpecialties: user.foundationalStyleSpecialties,
          techniques: user.techniques,
          techniqueSpecialties: user.techniqueSpecialties,
          subjects: user.subjects,
          subjectSpecialties: user.subjectSpecialties,
        })
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password' });
    }
    
    // Find user by username
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Create and return JWT token
    const token = jwt.sign(
      { id: user._id, userType: user.userType }, 
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // Return user data and token
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        profilePic: user.profilePic,
        // Include type-specific fields based on userType
        ...(user.userType !== 'enthusiast' && { 
          bio: user.bio,
          location: user.location
        }),
        ...(user.userType === 'artist' && {
          priceRange: user.priceRange,
          inkSpecialty: user.inkSpecialty,
          designSpecialty: user.designSpecialty,
          foundationalStyles: user.foundationalStyles,
          foundationalStyleSpecialties: user.foundationalStyleSpecialties,
          techniques: user.techniques,
          techniqueSpecialties: user.techniqueSpecialties,
          subjects: user.subjects,
          subjectSpecialties: user.subjectSpecialties,
        })
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};