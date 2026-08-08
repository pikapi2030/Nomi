const Message = require('../models/Message');
const Chat = require('../models/Chat');

/**
 * Format message sender user object respecting privacy settings
 */
const formatMessageSender = (messageDoc, currentUserId) => {
  const message = messageDoc.toObject ? messageDoc.toObject() : messageDoc;
  if (message.sender && typeof message.sender === 'object') {
    delete message.sender.password;
    const isSelf = message.sender._id.toString() === currentUserId.toString();
    if (!isSelf && (!message.sender.privacy || message.sender.privacy.showUsername === false)) {
      message.sender.username = undefined;
    }
  }
  return message;
};

// @desc    Send a new text message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { chatId, text } = req.body;

    if (!chatId || !text || !text.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'chatId and non-empty text message are required',
      });
    }

    // Verify chat exists and user is a participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        status: 'error',
        message: 'Chat conversation not found',
      });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to send message in this chat',
      });
    }

    // Create message
    let message = await Message.create({
      chatId,
      sender: req.user._id,
      text: text.trim(),
    });

    // Update chat's lastMessage reference and updatedAt timestamp
    chat.lastMessage = message._id;
    await chat.save();

    // Populate message sender info for UI payload
    message = await Message.findById(message._id).populate(
      'sender',
      'displayName username avatar privacy'
    );

    const formattedMessage = formatMessageSender(message, req.user._id);

    return res.status(201).json({
      status: 'success',
      data: { message: formattedMessage },
    });
  } catch (error) {
    console.error('[Send Message Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to send message',
    });
  }
};

// @desc    Get message history for a specific chat
// @route   GET /api/messages/:chatId
// @access  Private
const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    // Verify chat exists & user is participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        status: 'error',
        message: 'Chat conversation not found',
      });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to view messages for this chat',
      });
    }

    // Fetch messages in chronological order
    const messages = await Message.find({ chatId })
      .populate('sender', 'displayName username avatar privacy')
      .sort({ createdAt: 1 });

    const formattedMessages = messages.map((m) => formatMessageSender(m, req.user._id));

    return res.status(200).json({
      status: 'success',
      data: { messages: formattedMessages },
    });
  } catch (error) {
    console.error('[Get Messages Error]:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid chatId format',
      });
    }
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve message history',
    });
  }
};

module.exports = {
  sendMessage,
  getChatMessages,
};
