const { hasProAccess } = require('../utils/proAccess');

module.exports = (req, res, next) => {
  if (hasProAccess(req.user)) return next();
  return res.status(403).json({ error: 'This feature requires a Pro plan. Upgrade to continue.' });
};
