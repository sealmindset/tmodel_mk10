let bypassWarningLogged = false;

const ensureAuthenticated = (req, res, next) => {
  if (!bypassWarningLogged) {
    console.log('AUTH BYPASS: Auto-logging in user for all requests');
    bypassWarningLogged = true;
  }
  req.user = {
    name: 'Temporary User',
    email: 'admin@example.com',
    registered: 'true',
    role: 'admin'
  };
  req.session.user = req.user;
  return next();
};

module.exports = ensureAuthenticated;
