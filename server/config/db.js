const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Modern mongoose options are enabled by default in v6+
    });
    console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`[MongoDB Error] Failed to connect: ${error.message}`);
    // If running in development without local mongo, log guidance
    console.error('[MongoDB Help] Ensure MongoDB is running locally or set a valid MONGODB_URI in server/.env');
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB Warning] Disconnected from database server');
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB Runtime Error]:', err);
});

module.exports = connectDB;
