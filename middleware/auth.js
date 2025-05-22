/**
 * Authentication Middleware
 */

// Simple authentication middleware
// DEBUG MODE: Bypass authentication for all requests
const ensureAuthenticated = (req, res, next) => {
  return next();
};

module.exports = { ensureAuthenticated };
