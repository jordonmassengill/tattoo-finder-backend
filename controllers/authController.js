const crypto = require('crypto');
const { User, Enthusiast, Artist, Shop } = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendVerificationEmail } = require('../services/emailService');

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

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create appropriate user type
    let user;

    if (userType === 'enthusiast') {
      user = new Enthusiast({
        email, password, userType, username,
        verificationToken, verificationTokenExpiry,
      });
    } else if (userType === 'artist') {
      const priceRange = extraFields.priceRange;
      if (priceRange && !['$', '$$', '$$$', '$$$$'].includes(priceRange)) {
        return res.status(400).json({ message: 'Invalid price range' });
      }

      user = new Artist({
        email, password, userType, username,
        verificationToken, verificationTokenExpiry,
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
        verificationToken, verificationTokenExpiry,
        bio: extraFields.bio,
        location: extraFields.location,
      });
    } else {
      return res.status(400).json({ message: 'Invalid user type' });
    }

    await user.save();

    // Send verification email (non-blocking — if it fails we still respond)
    try {
      await sendVerificationEmail(email, username, verificationToken);
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr.message);
      // Don't block registration, but inform the client
      return res.status(201).json({
        message: 'Account created but we could not send the verification email. Please use the resend option.',
        emailSent: false,
      });
    }

    res.status(201).json({
      message: 'Account created! Please check your email to verify your account.',
      emailSent: true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify email with token
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification link. Please request a new one.' });
    }

    user.emailVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiry = null;
    await user.save();

    // Issue JWT so user is logged in automatically after verification
    const jwtToken = jwt.sign(
      { id: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Email verified successfully!',
      token: jwtToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        profilePic: user.profilePic,
        ...(user.userType !== 'enthusiast' && {
          bio: user.bio,
          location: user.location,
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
        }),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Resend verification email
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Return success to avoid user enumeration
      return res.json({ message: 'If an account with that email exists, a new verification link has been sent.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'This email is already verified. Please log in.' });
    }

    // Generate a fresh token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(email, user.username, verificationToken);

    res.json({ message: 'Verification email resent. Please check your inbox.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password' });
    }

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in. Check your inbox or request a new link.',
        emailNotVerified: true,
        email: user.email,
      });
    }

    const token = jwt.sign(
      { id: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        profilePic: user.profilePic,
        ...(user.userType !== 'enthusiast' && {
          bio: user.bio,
          location: user.location,
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
        }),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
