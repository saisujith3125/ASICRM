const fs = require('fs');
const path = require('path');

const ACCESS_FILE = path.join(__dirname, '..', 'data', 'access-control.json');

function readAccessControl() {
  try {
    const data = JSON.parse(fs.readFileSync(ACCESS_FILE, 'utf8'));
    return {
      users: Array.isArray(data.users) ? data.users : [],
      roles: Array.isArray(data.roles) ? data.roles : [],
      permissions: data.permissions && typeof data.permissions === 'object' ? data.permissions : {}
    };
  } catch {
    return { users: [], roles: [], permissions: {} };
  }
}

function getCurrentUser(req) {
  const data = readAccessControl();
  const userId = String(req.headers['x-user-id'] || '');
  const user = data.users.find((item) => item.id === userId && item.status === 'Active');
  if (!user) return null;

  const role = String(user.role || '').toUpperCase();
  return {
    ...user,
    role,
    roleDetails: data.roles.find((item) => String(item.key || '').toUpperCase() === role) || null,
    permissions: data.permissions[role] || {}
  };
}

function hasPermission(req, moduleName, action) {
  const user = getCurrentUser(req);
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return Array.isArray(user.permissions[moduleName]) && user.permissions[moduleName].includes(action);
}

function requirePermission(req, res, moduleName, action, message) {
  if (hasPermission(req, moduleName, action)) return true;
  res.status(403).json({
    success: false,
    message: message || `You do not have permission to ${action.toLowerCase()} ${moduleName.toLowerCase()}.`
  });
  return false;
}

module.exports = { readAccessControl, getCurrentUser, hasPermission, requirePermission };
