const jwt = require('jsonwebtoken');
const { User, Student, Parent } = require('../models');

/** Verify JWT and attach req.user */
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user || !user.active) return res.status(401).json({ message: 'Account disabled or not found' });
    req.user = user;
    // A temporary password only allows changing it
    if (user.mustChangePassword) {
      const url = req.originalUrl.split('?')[0];
      if (url !== '/api/auth/me' && url !== '/api/auth/change-password') {
        return res.status(403).json({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'You must change your temporary password first' });
      }
    }
    next();
  } catch (e) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/** Role-based access control: authorize('admin','dos') */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
  res.status(403).json({ message: 'You do not have permission to do this' });
};

/**
 * Data privacy scope.
 * Returns the list of student ObjectIds the current user may see,
 * or null when the user may see all students.
 */
async function visibleStudentIds(user) {
  if (user.role === 'student') {
    const s = await Student.findOne({ user: user._id }).select('_id');
    return s ? [s._id] : [];
  }
  if (user.role === 'parent') {
    const p = await Parent.findOne({ user: user._id }).select('children');
    return p ? p.children : [];
  }
  return null;
}

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

module.exports = { protect, authorize, visibleStudentIds, signToken };
