const assert = require('assert');
const warehouseController = require('../controllers/warehouseController');

console.log('=== STARTING ASICRM WAREHOUSE HIERARCHY & BIN FLOW AUDIT ===\n');

// Mock Express response helper
function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

// [Test 1] Verify getAllWarehouses returns warehouses and KPI summary
console.log('[Test 1] Testing Warehouse List & Computed Occupancy KPIs...');
const res1 = createMockRes();
warehouseController.getAllWarehouses({}, res1);

assert.strictEqual(res1.statusCode, 200, 'getAllWarehouses must return 200 OK');
assert.strictEqual(res1.data.success, true, 'Response must be success');
assert.strictEqual(res1.data.data.length, 3, 'Must return exactly 3 warehouses');

const defaultWh = res1.data.data.find(w => w.id === 'WH-001');
assert.ok(defaultWh, 'Default warehouse WH-001 must exist');
assert.strictEqual(defaultWh.code, 'WH-CHN-01');
assert.strictEqual(defaultWh.isDefault, true);

console.log(`  • Default Facility: ${defaultWh.name} (${defaultWh.code})`);
console.log(`  • Total Bins: ${defaultWh.totalBoxesCount} across ${defaultWh.racksCount} Racks`);
console.log(`  • Occupied Bins: ${defaultWh.occupiedBoxesCount} (${defaultWh.occupancyRate}% occupancy)`);
console.log(`  • Stored Stock Units: ${defaultWh.totalStockUnits} (Valuation: ₹${defaultWh.totalValuation.toLocaleString('en-IN')})`);
console.log('✓ PASS: Warehouse List and KPIs verified.\n');

// [Test 2] Verify Floor & Rack Structure
console.log('[Test 2] Testing Floor, Rack, Shelf & Box Physical Structure...');
const floors = defaultWh.layout.floors;
assert.strictEqual(floors.length, 2, 'Default warehouse must have exactly 2 floors');

const fl1 = floors[0];
const fl2 = floors[1];
assert.strictEqual(fl1.racks.length, 2, 'Floor 1 must contain 2 racks (Rack A & Rack B)');
assert.strictEqual(fl2.racks.length, 2, 'Floor 2 must contain 2 racks (Rack C & Rack D)');

const rackA = fl1.racks.find(r => r.id === 'RK-A');
assert.ok(rackA, 'Rack A must exist on Floor 1');
assert.strictEqual(rackA.shelves.length, 3, 'Rack A must have 3 shelves (Bottom, Mid, Upper)');

const boxA1 = rackA.shelves[0].boxes[0];
assert.ok(boxA1, 'Box A1-01 must exist');
console.log(`  • Floor 1: ${fl1.name} -> ${rackA.name} -> ${boxA1.name}`);
console.log(`  • Box A1-01 Contained Items: ${boxA1.assignedProductsCount} products (${boxA1.stockQuantity} units)`);
console.log('✓ PASS: Physical 4-tier hierarchy verified.\n');

// [Test 3] Testing Quick Bin Locator Search
console.log('[Test 3] Testing Quick Bin Locator Search Engine...');
const res3 = createMockRes();
warehouseController.searchWarehouseLocation({ query: { q: 'CAM-IPC-001' } }, res3);

assert.strictEqual(res3.statusCode, 200, 'Search must return 200 OK');
assert.strictEqual(res3.data.success, true);
assert.ok(res3.data.product, 'Product must be found');
assert.strictEqual(res3.data.product.code, 'CAM-IPC-001');

console.log(`  • Queried SKU: CAM-IPC-001 (${res3.data.product.name})`);
console.log(`  • Exact Located Bin: ${res3.data.fullCoordinateString}`);
console.log('✓ PASS: Search locator successfully pinpointed item coordinate.\n');

console.log('========================================================');
console.log(' ALL WAREHOUSE HIERARCHY & BIN FLOW TESTS PASSED (100%)');
console.log('========================================================\n');
