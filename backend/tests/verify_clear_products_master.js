const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  getDatabaseStats,
  createBackup,
  clearActiveDatabase,
  restoreBackup,
  getBackupById,
  deleteBackup
} = require('../services/backupService');
const { readStocks, writeStocks } = require('../services/inventoryService');
const { sequenceService } = require('../services/sequenceService');

async function testClearProductsAndRestore() {
  console.log('--- Testing Stocks & Products Master Database Clear & Restore ---');

  // If previous run halted midway, restore from BKP-20261027053309-A1G5
  const preCheck = readStocks();
  if (preCheck.products.length === 0 && fs.existsSync(path.join(__dirname, '..', 'data', 'backups', 'backup_BKP-20261027053309-A1G5.json'))) {
    console.log('Restoring from pre-test backup snapshot BKP-20261027053309-A1G5...');
    restoreBackup('BKP-20261027053309-A1G5');
  }

  // Step 1: Initial state check
  const initialStocks = readStocks();
  const initialStats = getDatabaseStats();
  console.log(`Initial Products: ${initialStats.products}, Transactions: ${initialStats.inventoryTransactions}`);
  assert(initialStats.products > 0, 'Initial products count should be > 0');

  // Step 2: Test Clear Active Database with clearProducts: true
  console.log('\n[1] Executing clearActiveDatabase with clearProducts: true...');
  const clearResult = clearActiveDatabase({
    user: { id: 'USR-TEST', name: 'Test Runner', mobile: '9994126686' },
    options: {
      clearCustomers: true,
      clearQuotations: true,
      clearOrders: true,
      clearProducts: true,
      resetStock: true
    }
  });

  assert(clearResult.success, 'clearActiveDatabase should succeed');
  assert(clearResult.autoBackup && clearResult.autoBackup.id, 'An automated pre-clear backup must be captured');
  console.log(`Auto-Backup created with ID: ${clearResult.autoBackup.id}`);

  // Verify memory & disk stocks data is cleared
  const clearedStocks = readStocks();
  assert.strictEqual(clearedStocks.products.length, 0, 'Stocks products must be 0 after clear');
  assert.strictEqual(clearedStocks.inventoryTransactions.length, 0, 'Inventory transactions must be 0 after clear');

  const postClearStats = getDatabaseStats();
  assert.strictEqual(postClearStats.products, 0, 'Database stats products must be 0 after clear');
  assert.strictEqual(postClearStats.inventoryTransactions, 0, 'Database stats transactions must be 0 after clear');
  console.log('✓ Products & inventory transactions successfully wiped to 0.');

  // Verify sequence reset
  const seqConfig = sequenceService.readConfig();
  assert.strictEqual(seqConfig.modules.stocks.nextNumber, seqConfig.modules.stocks.startingNumber || 1, 'Stocks sequence nextNumber should reset to startingNumber');
  console.log(`✓ Stocks sequence counter reset to ${seqConfig.modules.stocks.nextNumber}`);

  // Step 3: Test Restore from the Auto-Backup
  console.log('\n[2] Restoring database from Auto-Backup snapshot...');
  const restoreResult = restoreBackup(clearResult.autoBackup.id, {
    user: { id: 'USR-TEST', name: 'Test Runner' }
  });

  assert(restoreResult.success, 'restoreBackup should succeed');
  const restoredStocks = readStocks();
  assert.strictEqual(restoredStocks.products.length, initialStocks.products.length, 'Restored product count must match initial product count');
  assert.strictEqual(restoredStocks.inventoryTransactions.length, initialStocks.inventoryTransactions.length, 'Restored transactions count must match initial count');

  const postRestoreStats = getDatabaseStats();
  assert.strictEqual(postRestoreStats.products, initialStats.products, 'Stats products should match initial after restore');
  console.log(`✓ Restored ${postRestoreStats.products} products and ${postRestoreStats.inventoryTransactions} transactions successfully.`);

  // Verify sequence advanced past restored products
  const postRestoreSeq = sequenceService.readConfig();
  console.log(`✓ Stocks sequence counter after restore: ${postRestoreSeq.modules.stocks.nextNumber}`);
  assert(postRestoreSeq.modules.stocks.nextNumber >= 48, 'Stocks nextNumber should be at least 48 after restoring products');

  // Clean up autoBackup created during this test
  deleteBackup(clearResult.autoBackup.id);
  if (restoreResult.safetyBackup && restoreResult.safetyBackup.id) {
    deleteBackup(restoreResult.safetyBackup.id);
  }
  if (fs.existsSync(path.join(__dirname, '..', 'data', 'backups', 'backup_BKP-20261027053309-A1G5.json'))) {
    deleteBackup('BKP-20261027053309-A1G5');
  }
  console.log('✓ Cleaned up temporary test backup files.');

  console.log('\n✅ All tests passed for Stocks Master Clear & Restore!\n');
}

testClearProductsAndRestore().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
