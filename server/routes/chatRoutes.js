const express = require('express');
const router = express.Router();
const { accessChat, getUserChats } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', accessChat);
router.get('/', getUserChats);

module.exports = router;
