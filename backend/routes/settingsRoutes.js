const express = require('express');
const router = express.Router();

const {
  getSettings,
  getActiveEmployees,
  createUser,
  updateUser,
  transferSuperAdmin,
  deleteUser,
  createRole,
  updateRole,
  deleteRole,
  updatePermissions,
  resolveUser,
  getCompanySettings,
  updateCompanySettings,
  updateSectionSettings,
  getDatabaseStatsEndpoint,
  getBackupsListEndpoint,
  getBackupDetailsEndpoint,
  createBackupEndpoint,
  clearDatabaseEndpoint,
  restoreBackupEndpoint,
  deleteBackupEndpoint,
  importBackupEndpoint
} = require('../controllers/settingsController');

router.get('/', getSettings);
router.get('/employees', getActiveEmployees);
router.get('/resolve-user', resolveUser);

router.get('/company', getCompanySettings);
router.put('/company', updateCompanySettings);
router.put('/section/:sectionKey', updateSectionSettings);

router.post('/users/transfer-super-admin', transferSuperAdmin);
router.post('/users', createUser);
router.put('/users/:userId', updateUser);
router.post('/users/:userId', updateUser); // Dual-verb support for proxies / environments blocking PUT
router.delete('/users/:userId', deleteUser);
router.post('/users/:userId/delete', deleteUser); // Dual-verb support for proxies / environments blocking DELETE

router.post('/roles', createRole);
router.put('/roles/:roleKey', updateRole);
router.delete('/roles/:roleKey', deleteRole);

router.put('/permissions/:roleKey', updatePermissions);

// Database Backup, Clear, Restore, and Management endpoints
router.get('/database/stats', getDatabaseStatsEndpoint);
router.get('/database/backups', getBackupsListEndpoint);
router.get('/database/backups/:id', getBackupDetailsEndpoint);
router.post('/database/backup', createBackupEndpoint);
router.post('/database/clear', clearDatabaseEndpoint);
router.post('/database/restore/:id', restoreBackupEndpoint);
router.delete('/database/backups/:id', deleteBackupEndpoint);
router.post('/database/import', importBackupEndpoint);

module.exports = router;
