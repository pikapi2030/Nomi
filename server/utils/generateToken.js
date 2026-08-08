const jwt = require('jsonwebtoken');

/**
 * Generates a signed JWT for a given user ID
 * @param {string} id - User ObjectId string
 * @returns {string} Signed JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'chatloop_super_secret_jwt_key', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

module.exports = generateToken;
