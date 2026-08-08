const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Initializes Socket.io server and registers real-time event handlers
 * @param {Object} httpServer - HTTP Server instance
 * @returns {Object} Socket.io server instance
 */
const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
  });

  // Socket.io Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1] ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chatloop_super_secret_jwt_key');
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('[Socket Auth Error]:', err.message);
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket Connected] User ${socket.user.displayName} (${socket.user._id}) connected via socket ${socket.id}`);

    // Join a specific 1-on-1 chat room
    socket.on('join_chat', (chatId) => {
      if (!chatId) return;
      socket.join(chatId);
      console.log(`[Socket Room] User ${socket.user.displayName} joined chat room: ${chatId}`);
    });

    // Leave a specific chat room
    socket.on('leave_chat', (chatId) => {
      if (!chatId) return;
      socket.leave(chatId);
      console.log(`[Socket Room] User ${socket.user.displayName} left chat room: ${chatId}`);
    });

    // Handle incoming message event from a client and broadcast instantly to room participants
    socket.on('send_message', (messageData) => {
      if (!messageData || !messageData.chatId) {
        console.warn('[Socket Warning] send_message received without valid chatId');
        return;
      }

      const chatId = messageData.chatId;

      // Broadcast message to all users in the chat room (including sender or target recipient)
      io.in(chatId).emit('receive_message', messageData);
      console.log(`[Socket Broadcast] Message sent in room ${chatId} by ${socket.user.displayName}`);
    });

    // Handle user disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[Socket Disconnected] User ${socket.user?.displayName || socket.id} disconnected (${reason})`);
    });
  });

  return io;
};

module.exports = initSocket;
