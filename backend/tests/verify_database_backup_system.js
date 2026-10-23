const path = require('path');
const backupService = require('../services/backupService');
const crmStore = require('../data/crmStore');

async function testBackupCycle() {
  console.log('--- 1. Testing Database Stats ---');
  const initialStats = backupService.getDatabaseStats();
  console.log('Initial stats:', initialStats);

  console.log('--- 2. Creating Manual Backup ---');
  const user = { id: 'USR-001', name: 'Super Admin', role: 'SUPER_ADMIN', mobile: '9999999990' };
  const manualBackup = backupService.createBackup({
    title: 'Pre-Test Verification Backup',
    type: 'MANUAL_BACKUP',
    user,
    note: 'Automated test suite check'
  });
  console.log('Created manual backup:', manualBackup.id, manualBackup.sizeFormatted);

  console.log('--- 3. Listing Backups ---');
  const list1 = backupService.listBackups();
  console.log('Backups count:', list1.length, 'Top backup:', list1[0]?.id);

  console.log('--- 4. Testing Clear Database (Wipe with Auto-Backup) ---');
  const clearResult = backupService.clearActiveDatabase({
    user,
    options: {
      clearCustomers: true,
      clearEnquiries: true,
      clearQuotations: true,
      clearOrders: true,
      clearChallans: true,
      clearInvoices: true,
      clearProformas: true,
      resetStock: true
    }
  });
  console.log('Clear result message:', clearResult.message);
  console.log('Auto-backup generated:', clearResult.autoBackup.id);

  const statsAfterClear = backupService.getDatabaseStats();
  console.log('Stats after clear: Customers:', statsAfterClear.customers, 'Quotations:', statsAfterClear.quotations, 'Orders:', statsAfterClear.orders);
  if (statsAfterClear.customers !== 0 || statsAfterClear.quotations !== 0) {
    throw new Error('Database was not cleared properly!');
  }

  console.log('--- 5. Restoring Database from Auto-Backup ---');
  const restoreResult = backupService.restoreBackup(clearResult.autoBackup.id, { user });
  console.log('Restore result message:', restoreResult.message);

  const statsAfterRestore = backupService.getDatabaseStats();
  console.log('Stats after restore:', statsAfterRestore);
  if (statsAfterRestore.customers !== initialStats.customers || statsAfterRestore.quotations !== initialStats.quotations) {
    throw new Error('Restore did not restore original counts!');
  }
  console.log('✅ Counts matched original exactly!');

  console.log('--- 6. Cleaning Up Test Backups ---');
  backupService.deleteBackup(manualBackup.id);
  backupService.deleteBackup(clearResult.autoBackup.id);
  if (restoreResult.safetyBackup) {
    backupService.deleteBackup(restoreResult.safetyBackup.id);
  }
  console.log('Remaining backups after cleanup:', backupService.listBackups().length);
  console.log('🎉 ALL BACKUP & RESTORE ARCHITECTURE TESTS PASSED!');
}

testBackupCycle().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
