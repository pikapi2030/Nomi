const Chat = require('../models/Chat');
const User = require('../models/User');

/**
 * Format user privacy settings inside populated chat participants
 */
const formatChatParticipants = (chatDoc, currentUserId) => {
  const chat = chatDoc.toObject ? chatDoc.toObject() : chatDoc;

  if (chat.participants && Array.isArray(chat.participants)) {
    chat.participants = chat.participants.map((participant) => {
      if (typeof participant === 'object' && participant._id) {
        delete participant.password;
        const isSelf = participant._id.toString() === currentUserId.toString();
        if (!isSelf && (!participant.privacy || participant.privacy.showUsername === false)) {
          participant.username = undefined;
        }
      }
      return participant;
    });
  }

  return chat;
};

// @desc    Create or get existing 1-on-1 chat
// @route   POST /api/chats
// @access  Private
const accessChat = async (req, res) => {
  try {
    const { recipientId, userId } = req.body;
    const targetUserId = recipientId || userId;

    if (!targetUserId) {
      return res.status(400).json({
        status: 'error',
        message: 'Recipient userId is required',
      });
    }

    if (targetUserId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot create a chat with yourself',
      });
    }

    // Verify recipient user exists
    const recipient = await User.findById(targetUserId);
    if (!recipient) {
      return res.status(404).json({
        status: 'error',
        message: 'Recipient user not found',
      });
    }

    // Check if a chat already exists between these two users
    let existingChat = await Chat.findOne({
      participants: { $all: [req.user._id, targetUserId] },
    })
      .populate('participants', '-password')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'displayName avatar' },
      });

    if (existingChat) {
      const formatted = formatChatParticipants(existingChat, req.user._id);
      return res.status(200).json({
        status: 'success',
        data: { chat: formatted },
      });
    }

    // If no chat exists, create a new 1-on-1 chat
    const newChat = await Chat.create({
      participants: [req.user._id, targetUserId],
    });

    const fullChat = await Chat.findById(newChat._id).populate('participants', '-password');
    const formatted = formatChatParticipants(fullChat, req.user._id);

    return res.status(201).json({
      status: 'success',
      data: { chat: formatted },
    });
  } catch (error) {
    console.error('[Access Chat Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to access or create chat',
    });
  }
};

// @desc    Get all active chats for logged-in user sorted by recent activity
// @route   GET /api/chats
// @access  Private
const getUserChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id,
    })
      .populate('participants', '-password')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'displayName avatar' },
      })
      .sort({ updatedAt: -1 });

    const formattedChats = chats.map((chat) => formatChatParticipants(chat, req.user._id));

    return res.status(200).json({
      status: 'success',
      data: { chats: formattedChats },
    });
  } catch (error) {
    console.error('[Get User Chats Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve user chats',
    });
  }
};

module.exports = {
  accessChat,
  getUserChats,
};
