const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { username, displayName, email, password, bio, avatar } = req.body;

    if (!username || !displayName || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide username, displayName, email, and password',
      });
    }

    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists (username or email)
    const existingUser = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }],
    });

    if (existingUser) {
      if (existingUser.username === cleanUsername) {
        return res.status(400).json({
          status: 'error',
          message: 'Username is already taken',
        });
      }
      if (existingUser.email === cleanEmail) {
        return res.status(400).json({
          status: 'error',
          message: 'An account with this email already exists',
        });
      }
    }

    // Create user
    const user = await User.create({
      username: cleanUsername,
      displayName: displayName.trim(),
      email: cleanEmail,
      password,
      bio: bio || '',
      avatar: avatar || '',
    });

    if (user) {
      const token = generateToken(user._id);
      const publicUser = user.toPublicJSON();
      return res.status(201).json({
        status: 'success',
        user: publicUser,
        token,
        data: {
          user: publicUser,
          token,
        },
      });
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user data provided',
      });
    }
  } catch (error) {
    console.error('[Register Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Server error during registration',
    });
  }
};

// @desc    Authenticate user & get token (Login via email or username)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { login, email, username, password } = req.body;

    const identifier = (login || email || username || '').toLowerCase().trim();

    if (!identifier || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email/username and password',
      });
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email/username or password',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email/username or password',
      });
    }

    const token = generateToken(user._id);
    const publicUser = user.toPublicJSON();

    return res.status(200).json({
      status: 'success',
      user: publicUser,
      token,
      data: {
        user: publicUser,
        token,
      },
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Server error during login',
    });
  }
};

// @desc    Get current authenticated user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }
    const publicUser = user.toPublicJSON();
    return res.status(200).json({
      status: 'success',
      user: publicUser,
      data: {
        user: publicUser,
      },
    });
  } catch (error) {
    console.error('[GetMe Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error retrieving user details',
    });
  }
};

// @desc    Logout user / clear token on client side
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
  return res.status(200).json({
    status: 'success',
    message: 'Successfully logged out',
  });
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
};
