// Use after protect: lets only admin accounts through
module.exports = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  next();
};
