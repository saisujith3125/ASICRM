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
  sendDatabaseBackupOtpEndpoint,
  sendDatabaseClearOtpEndpoint,
  getDatabaseClearStatusEndpoint,
  createBackupEndpoint,
  clearDatabaseEndpoint,
  restoreBackupEndpoint,
  deleteBackupEndpoint,
  importBackupEndpoint,
  getSequencesEndpoint,
  updateSequenceEndpoint,
  rolloverSequencesEndpoint,
  getDateFormatEndpoint,
  updateDateFormatEndpoint,
  resetDateFormatEndpoint,
  getMongoStatusEndpoint,
  triggerMongoSyncEndpoint,
  sendTestEmailEndpoint,
  verifyEmailConnectionEndpoint
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
router.get('/database/mongo-status', getMongoStatusEndpoint);
router.post('/database/sync-mongo', triggerMongoSyncEndpoint);
router.get('/database/backups', getBackupsListEndpoint);
router.get('/database/backups/:id', getBackupDetailsEndpoint);
router.post('/database/send-backup-otp', sendDatabaseBackupOtpEndpoint);
router.post('/database/send-clear-otp', sendDatabaseClearOtpEndpoint);
router.get('/database/clear-status', getDatabaseClearStatusEndpoint);
router.post('/database/backup', createBackupEndpoint);
router.post('/database/clear', clearDatabaseEndpoint);
router.post('/database/restore/:id', restoreBackupEndpoint);
router.delete('/database/backups/:id', deleteBackupEndpoint);
router.post('/database/import', importBackupEndpoint);

// Central Serial Numbers & Document Sequences endpoints
router.get('/sequences', getSequencesEndpoint);
router.put('/sequences/:moduleKey', updateSequenceEndpoint);
router.post('/sequences/:moduleKey', updateSequenceEndpoint); // POST dual-verb
router.post('/sequences/rollover', rolloverSequencesEndpoint);

// Central Date Format & Presentation endpoints
router.get('/date-format', getDateFormatEndpoint);
router.put('/date-format', updateDateFormatEndpoint);
router.post('/date-format', updateDateFormatEndpoint); // POST dual-verb
router.post('/date-format/reset', resetDateFormatEndpoint);

// Outbound Email & SMTP Gateway endpoints
router.post('/email/send-test', sendTestEmailEndpoint);
router.post('/email/verify-connection', verifyEmailConnectionEndpoint);

module.exports = router;
