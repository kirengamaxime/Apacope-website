const { AuditLog } = require('../models');

/** Write an audit entry. Never throws (auditing must not break the request). */
async function audit(req, action, entity, entityId, details) {
  try {
    await AuditLog.create({
      user: req.user?._id,
      userName: req.user?.name,
      role: req.user?.role,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      details,
      ip: req.ip,
    });
  } catch (e) {
    console.error('audit failed', e.message);
  }
}

module.exports = { audit };
