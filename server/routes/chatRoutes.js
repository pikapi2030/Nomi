const express = require('express');
const router = express.Router();
const { accessChat, createGroupChat, getUserChats } = require('../controllers/chatController');
const protect = require('../middleware/authMiddleware');

router.post('/', protect, accessChat);
router.post('/group', protect, createGroupChat);
router.get('/', protect, getUserChats);

module.exports = router;
