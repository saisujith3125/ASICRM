export function hasPermission(user, moduleName, action) {
  if (String(user?.role || '').toUpperCase() === 'SUPER_ADMIN') return true;
  return Boolean(user?.permissions?.[moduleName]?.includes(action));
}

export function hasAnyPermission(user, checks = []) {
  return String(user?.role || '').toUpperCase() === 'SUPER_ADMIN'
    || checks.some(([moduleName, action]) => hasPermission(user, moduleName, action));
}
