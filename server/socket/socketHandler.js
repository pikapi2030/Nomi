const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Map of online users: userId -> set of socketIds
  const onlineUsers = new Map();

  // Socket.io JWT authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('[Socket Auth Error]:', err.message);
      next(new Error('Unauthorized socket connection'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`[Socket Connected]: ${socket.user.displayName} (${userId})`);

    // Track online user sockets
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Update online status in database & broadcast to all connected clients
    await User.findByIdAndUpdate(userId, { isOnline: true });
    io.emit('user_status', { userId, isOnline: true });

    // Join specific chat room
    socket.on('join_chat', (chatId) => {
      socket.join(chatId);
      console.log(`[Socket Room Joined]: User ${socket.user.displayName} joined chat ${chatId}`);
    });

    // Leave specific chat room
    socket.on('leave_chat', (chatId) => {
      socket.leave(chatId);
      console.log(`[Socket Room Left]: User ${socket.user.displayName} left chat ${chatId}`);
    });

    // Typing Indicators
    socket.on('typing', ({ chatId }) => {
      socket.to(chatId).emit('user_typing', {
        chatId,
        user: { _id: socket.user._id, displayName: socket.user.displayName },
      });
    });

    socket.on('stop_typing', ({ chatId }) => {
      socket.to(chatId).emit('user_stop_typing', {
        chatId,
        user: { _id: socket.user._id },
      });
    });

    // Real-Time Read Receipts
    socket.on('mark_read', async ({ chatId, messageIds }) => {
      try {
        if (Array.isArray(messageIds) && messageIds.length > 0) {
          await Message.updateMany(
            { _id: { $in: messageIds }, 'readBy.user': { $ne: socket.user._id } },
            { $push: { readBy: { user: socket.user._id, readAt: new Date() } } }
          );

          io.to(chatId).emit('messages_read', {
            chatId,
            userId: socket.user._id,
            messageIds,
          });
        }
      } catch (err) {
        console.error('[Socket Mark Read Error]:', err.message);
      }
    });

    // Real-Time Emoji Reactions
    socket.on('add_reaction', async ({ messageId, chatId, emoji }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        // Remove existing reaction by user if any
        message.reactions = message.reactions.filter(
          (r) => r.user.toString() !== socket.user._id.toString()
        );

        // Add new reaction if emoji provided
        if (emoji) {
          message.reactions.push({ user: socket.user._id, emoji });
        }

        await message.save();

        io.to(chatId).emit('reaction_updated', {
          messageId,
          chatId,
          reactions: message.reactions,
        });
      } catch (err) {
        console.error('[Socket Reaction Error]:', err.message);
      }
    });

    // Handle message broadcasting
    socket.on('send_message', (message) => {
      if (message.chatId) {
        io.to(message.chatId).emit('receive_message', message);
      }
    });

    // Disconnect event
    socket.on('disconnect', async () => {
      console.log(`[Socket Disconnected]: ${socket.user.displayName} (${userId})`);
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
          io.emit('user_status', { userId, isOnline: false, lastSeen });
        }
      }
    });
  });

  return io;
};

module.exports = setupSocket;
