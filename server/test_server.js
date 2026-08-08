const connectDB = require('./config/db');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');

async function testBackend() {
  console.log('Testing ChatLoop Backend Components...');

  // Verify models load properly
  console.log('User model:', User.modelName);
  console.log('Chat model:', Chat.modelName);
  console.log('Message model:', Message.modelName);

  console.log('Backend verification completed successfully.');
}

testBackend().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
