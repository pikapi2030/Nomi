const Chat = require('../models/Chat');
const User = require('../models/User');

// Create or access 1-on-1 chat
const accessChat = async (req, res) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId) {
      return res.status(400).json({ status: 'error', message: 'Recipient ID is required' });
    }

    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ status: 'error', message: 'Cannot create chat with yourself' });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ status: 'error', message: 'Recipient user not found' });
    }

    // Check if 1-on-1 chat already exists
    let existingChat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, recipientId] },
    })
      .populate('participants', 'displayName username avatar bio privacy isOnline lastSeen')
      .populate('lastMessage');

    if (existingChat) {
      return res.status(200).json({
        status: 'success',
        chat: existingChat,
        data: { chat: existingChat },
      });
    }

    // Create new 1-on-1 chat
    const newChat = await Chat.create({
      participants: [req.user._id, recipientId],
      isGroup: false,
    });

    const fullChat = await Chat.findById(newChat._id).populate(
      'participants',
      'displayName username avatar bio privacy isOnline lastSeen'
    );

    return res.status(201).json({
      status: 'success',
      chat: fullChat,
      data: { chat: fullChat },
    });
  } catch (err) {
    console.error('[Access Chat Error]:', err.message);
    return res.status(500).json({ status: 'error', message: 'Server error creating chat' });
  }
};

// Create Group Chat
const createGroupChat = async (req, res) => {
  try {
    const { groupName, participantIds } = req.body;
    if (!groupName || !groupName.trim()) {
      return res.status(400).json({ status: 'error', message: 'Group name is required' });
    }

    if (!Array.isArray(participantIds) || participantIds.length < 1) {
      return res.status(400).json({ status: 'error', message: 'At least one participant required for group chat' });
    }

    const allParticipants = [...new Set([...participantIds, req.user._id.toString()])];

    const groupChat = await Chat.create({
      isGroup: true,
      groupName: groupName.trim(),
      groupAdmin: req.user._id,
      participants: allParticipants,
    });

    const fullGroupChat = await Chat.findById(groupChat._id).populate(
      'participants',
      'displayName username avatar bio privacy isOnline lastSeen'
    );

    return res.status(201).json({
      status: 'success',
      chat: fullGroupChat,
      data: { chat: fullGroupChat },
    });
  } catch (err) {
    console.error('[Create Group Chat Error]:', err.message);
    return res.status(500).json({ status: 'error', message: 'Server error creating group chat' });
  }
};

// Get all chats for logged in user
const getUserChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: { $in: [req.user._id] },
    })
      .populate('participants', 'displayName username avatar bio privacy isOnline lastSeen')
      .populate('lastMessage')
      .populate('groupAdmin', 'displayName username')
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      status: 'success',
      chats,
      data: { chats },
    });
  } catch (err) {
    console.error('[Get User Chats Error]:', err.message);
    return res.status(500).json({ status: 'error', message: 'Server error fetching chats' });
  }
};

module.exports = {
  accessChat,
  createGroupChat,
  getUserChats,
};
