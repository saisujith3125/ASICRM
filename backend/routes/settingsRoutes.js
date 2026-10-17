const express = require('express');
const router = express.Router();

const {
  getSettings,
  getActiveEmployees,
  createUser,
  updateUser,
  createRole,
  updateRole,
  deleteRole,
  updatePermissions,
  resolveUser,
  getCompanySettings,
  updateCompanySettings,
  updateSectionSettings
} = require('../controllers/settingsController');

router.get('/', getSettings);
router.get('/employees', getActiveEmployees);
router.get('/resolve-user', resolveUser);

router.get('/company', getCompanySettings);
router.put('/company', updateCompanySettings);
router.put('/section/:sectionKey', updateSectionSettings);

router.post('/users', createUser);
router.put('/users/:userId', updateUser);

router.post('/roles', createRole);
router.put('/roles/:roleKey', updateRole);
router.delete('/roles/:roleKey', deleteRole);

router.put('/permissions/:roleKey', updatePermissions);

module.exports = router;
