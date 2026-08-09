const express = require('express');
const router = express.Router();
const { sendMessage, getMessages, reactToMessage } = require('../controllers/messageController');
const protect = require('../middleware/authMiddleware');

router.post('/', protect, sendMessage);
router.get('/:chatId', protect, getMessages);
router.post('/:messageId/react', protect, reactToMessage);

module.exports = router;
