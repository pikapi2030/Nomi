const express = require('express');
const router = express.Router();
const { sendMessage, getChatMessages } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', sendMessage);
router.get('/:chatId', getChatMessages);

module.exports = router;
