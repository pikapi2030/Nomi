const User = require('../models/User');

/**
 * Format user output according to privacy settings
 * @param {Object} userDoc - Mongoose document or JS object
 * @param {string} currentUserId - ID of user making request
 * @returns {Object} Formatted user object
 */
const formatUserProfile = (userDoc, currentUserId) => {
  const user = userDoc.toObject ? userDoc.toObject() : userDoc;
  delete user.password;

  const isSelf = user._id.toString() === currentUserId.toString();

  // If showUsername is false and not viewing self, hide username from UI response
  if (!isSelf && (!user.privacy || user.privacy.showUsername === false)) {
    user.username = undefined;
  }

  return user;
};

// @desc    Search users by username or displayName
// @route   GET /api/users/search?q=query
// @access  Private
const searchUsers = async (req, res) => {
  try {
    const searchQuery = req.query.q ? req.query.q.trim() : '';

    if (!searchQuery) {
      return res.status(200).json({
        status: 'success',
        users: [],
        data: { users: [] },
      });
    }

    const regex = new RegExp(searchQuery, 'i');

    // Find users matching username or displayName, excluding current user
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ username: regex }, { displayName: regex }],
    }).select('-password');

    const formattedUsers = users.map((user) => formatUserProfile(user, req.user._id));

    return res.status(200).json({
      status: 'success',
      users: formattedUsers,
      data: { users: formattedUsers },
    });
  } catch (error) {
    console.error('[Search Users Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to search users',
    });
  }
};

// @desc    Get user profile by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id).select('-password');

    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    const formatted = formatUserProfile(targetUser, req.user._id);

    return res.status(200).json({
      status: 'success',
      user: formatted,
      data: { user: formatted },
    });
  } catch (error) {
    console.error('[GetUserById Error]:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format',
      });
    }
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve user profile',
    });
  }
};

// @desc    Update user profile & privacy settings
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { displayName, bio, avatar, privacy } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    if (displayName !== undefined) {
      if (!displayName.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Display name cannot be empty',
        });
      }
      user.displayName = displayName.trim();
    }

    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    if (avatar !== undefined) {
      user.avatar = avatar;
    }

    if (privacy && typeof privacy.showUsername === 'boolean') {
      user.privacy.showUsername = privacy.showUsername;
    }

    await user.save();

    const updatedUser = formatUserProfile(user, req.user._id);

    return res.status(200).json({
      status: 'success',
      user: updatedUser,
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error('[Update Profile Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update profile',
    });
  }
};

module.exports = {
  searchUsers,
  getUserById,
  updateProfile,
};
