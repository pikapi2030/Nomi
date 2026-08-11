const Message = require('../models/Message');
const Chat = require('../models/Chat');

// Send message (text or image)
const sendMessage = async (req, res) => {
  try {
    const { chatId, text, messageType = 'text', imageUrl = '' } = req.body;

    if (!chatId) {
      return res.status(400).json({ status: 'error', message: 'Chat ID is required' });
    }

    if (messageType === 'text' && (!text || !text.trim())) {
      return res.status(400).json({ status: 'error', message: 'Message text cannot be empty' });
    }

    if (messageType === 'image' && !imageUrl) {
      return res.status(400).json({ status: 'error', message: 'Image URL is required' });
    }

    // Create message with initial readBy entry for sender
    const newMessage = await Message.create({
      chatId,
      sender: req.user._id,
      text: text ? text.trim() : '',
      messageType,
      imageUrl,
      readBy: [{ user: req.user._id, readAt: new Date() }],
    });

    // Update chat lastMessage and updatedAt timestamp for sorting
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: newMessage._id,
      updatedAt: new Date(),
    });

    const fullMessage = await Message.findById(newMessage._id).populate(
      'sender',
      'displayName username avatar'
    );

    return res.status(201).json({
      status: 'success',
      message: fullMessage,
      data: { message: fullMessage },
    });
  } catch (err) {
    console.error('[Send Message Error]:', err.message);
    return res.status(500).json({ status: 'error', message: 'Server error sending message' });
  }
};

// Get messages for a chat
const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!chatId) {
      return res.status(400).json({ status: 'error', message: 'Chat ID is required' });
    }

    const messages = await Message.find({ chatId })
      .populate('sender', 'displayName username avatar')
      .populate('reactions.user', 'displayName username')
      .sort({ createdAt: 1 });

    return res.status(200).json({
      status: 'success',
      messages,
      data: { messages },
    });
  } catch (err) {
    console.error('[Get Messages Error]:', err.message);
    return res.status(500).json({ status: 'error', message: 'Server error fetching messages' });
  }
};

// Add / Remove Reaction to Message
const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ status: 'error', message: 'Message not found' });
    }

    // Filter out existing reaction from user
    message.reactions = message.reactions.filter(
      (r) => r.user.toString() !== req.user._id.toString()
    );

    if (emoji) {
      message.reactions.push({ user: req.user._id, emoji });
    }

    await message.save();

    return res.status(200).json({
      status: 'success',
      reactions: message.reactions,
      data: { reactions: message.reactions },
    });
  } catch (err) {
    console.error('[React Message Error]:', err.message);
    return res.status(500).json({ status: 'error', message: 'Server error adding reaction' });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  reactToMessage,
};
