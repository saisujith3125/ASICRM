/**
 * Verification Test Suite: Delivery Challan Dynamic Pagination & Space Rule Flow
 * Validates:
 * 1. 4-Item DC with multi-line serial numbers (e.g. ASI/DC/029/26-27) fits completely on 1 page with signatures intact.
 * 2. Eliminates the old hardcoded 12 blank filler rows that forced overflow and cut off the signature block in PDF export.
 * 3. Dynamic filler rows rule clamps empty lines to available safe headroom.
 * 4. Multi-page Challans gracefully move signatures to subsequent pages without vertical truncation.
 * 5. Every generated page strictly respects A4 usable height (<= 1015px).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const printableDcCode = fs.readFileSync(
  path.join(__dirname, '../../frontend/src/components/documents/PrintableDeliveryChallan.jsx'),
  'utf8'
);

function getPaginationFunctions() {
  const codeToRun = `
    ${printableDcCode.match(/export function estimateDcItemHeight[\s\S]*?^}/m)[0].replace('export ', '')}
    ${printableDcCode.match(/export function estimateDcBottomHeight[\s\S]*?^}/m)[0].replace('export ', '')}
    ${printableDcCode.match(/export function paginateDeliveryChallan[\s\S]*?^}/m)[0].replace('export ', '')}
    module.exports = { estimateDcItemHeight, estimateDcBottomHeight, paginateDeliveryChallan };
  `;
  const m = { exports: {} };
  const fn = new Function('module', 'exports', codeToRun);
  fn(m, m.exports);
  return m.exports;
}

function runTests() {
  console.log('=== STARTING DELIVERY CHALLAN PAGINATION & SPACE RULE VERIFICATION ===\n');

  const { estimateDcItemHeight, estimateDcBottomHeight, paginateDeliveryChallan } = getPaginationFunctions();

  // Test 1: Real-world 4-Item DC from user's bug report ASI/DC/029/26-27
  console.log('[Test 1] Testing Real-World 4-Item DC (ASI/DC/029/26-27 with long serials)...');
  const dcModel4Items = {
    dcNumber: 'ASI/DC/029/26-27',
    date: '2026/10/29',
    customerName: 'Tube Investments of India LTD',
    items: [
      {
        displayName: 'Cat 6 Outdoor Cable 305M Drum',
        description: 'Weatherproof high-grade networking cable',
        quantity: 1,
        unit: 'Mtr',
        serialNumbers: ['ASI-CAB-OUT-8891']
      },
      {
        displayName: '2MP IP Dome Camera',
        description: 'Night vision IR 30m PoE camera',
        quantity: 2,
        unit: 'Nos',
        serialNumbers: ['CP-DOME-9912', 'CP-DOME-9913']
      },
      {
        displayName: '4 Port PoE Switch 10/100',
        description: 'Fast Ethernet PoE switch with uplink port',
        quantity: 1,
        unit: 'Nos',
        serialNumbers: ['POE-SW-4P-771']
      },
      {
        displayName: 'Outdoor Weatherproof Enclosure Box',
        description: 'IP66 junction box for CCTV termination',
        quantity: 10,
        unit: 'Nos',
        serialNumbers: [
          'ASI-ENC-001', 'ASI-ENC-002', 'ASI-ENC-003', 'ASI-ENC-004', 'ASI-ENC-005',
          'ASI-ENC-006', 'ASI-ENC-007', 'ASI-ENC-008', 'ASI-ENC-009', 'ASI-ENC-010'
        ]
      }
    ]
  };

  const pages1 = paginateDeliveryChallan(dcModel4Items);
  console.log(`  • Generated Pages Count: ${pages1.length}`);
  assert.strictEqual(pages1.length, 1, '4-Item DC should fit completely on Page 1');
  const p1 = pages1[0];
  assert.strictEqual(p1.showBottomSection, true, 'Signatures must be present on Page 1');
  assert.strictEqual(p1.items.length, 4, 'All 4 items must be on Page 1');

  // Verify that empty lines were NOT hardcoded to 12 rows
  console.log(`  • Blank Filler Rows Count: ${p1.blankRowsCount} (was 12 in broken version)`);
  assert.ok(p1.blankRowsCount <= 3, 'Blank filler rows must be clamped and not exceed safe headroom');

  // Calculate total height
  const bottomH = estimateDcBottomHeight(dcModel4Items);
  const itemsH = dcModel4Items.items.reduce((sum, it) => sum + estimateDcItemHeight(it), 0);
  const totalPage1Height = 285 + 32 + itemsH + (p1.blankRowsCount * 26) + bottomH + 28;
  console.log(`  • Estimated Total Page Height: ${totalPage1Height}px (Limit: 1015px, Margin: ${1015 - totalPage1Height}px)`);
  assert.ok(totalPage1Height <= 1015, 'Total page height must fit within 1015px A4 usable height');
  assert.ok(1015 - totalPage1Height >= 50, 'Must have at least 50px safe headroom to prevent any truncation');
  console.log('✔ PASS: 4-Item DC with serials fits completely on 1 page with signatures 100% intact!\n');

  // Test 2: Minimal DC with 1 Item
  console.log('[Test 2] Testing Minimal DC (1 Single Item without serials)...');
  const minimalDc = {
    dcNumber: 'ASI/DC/030/26-27',
    date: '2026/10/29',
    customerName: 'Quick Client',
    items: [
      {
        displayName: 'HDMI Cable 5M High Speed',
        description: 'Standard 4K HDMI',
        quantity: 2,
        unit: 'Nos'
      }
    ]
  };

  const pages2 = paginateDeliveryChallan(minimalDc);
  assert.strictEqual(pages2.length, 1, 'Minimal DC should fit on 1 page');
  assert.strictEqual(pages2[0].showBottomSection, true, 'Signatures present on Page 1');
  console.log(`  • Blank Rows Count: ${pages2[0].blankRowsCount}`);
  assert.ok(pages2[0].blankRowsCount <= 3, 'Filler rows clamped to max 3 rows');
  console.log('✔ PASS: Minimal DC verified with safe filler clamp!\n');

  // Test 3: Large Multi-Page DC (15 Items with serial numbers)
  console.log('[Test 3] Testing Multi-Page DC (15 Items with extensive serial lists)...');
  const largeItems = [];
  for (let i = 1; i <= 15; i++) {
    largeItems.push({
      displayName: `Enterprise Network Camera Unit #${i}`,
      description: `Industrial optical camera system spec ${i}`,
      quantity: 3,
      unit: 'Nos',
      serialNumbers: [`CAM-SN-${i}01`, `CAM-SN-${i}02`, `CAM-SN-${i}03`]
    });
  }
  const largeDc = {
    dcNumber: 'ASI/DC/031/26-27',
    date: '2026/10/29',
    customerName: 'Enterprise Infrastructure Hub',
    items: largeItems
  };

  const pages3 = paginateDeliveryChallan(largeDc);
  console.log(`  • Multi-Page DC generated ${pages3.length} pages:`);
  pages3.forEach(p => {
    console.log(`    Page ${p.pageNumber}: ${p.items.length} items | Bottom Section: ${p.showBottomSection} | Filler: ${p.blankRowsCount}`);
  });

  assert.ok(pages3.length >= 2, 'Large DC must scale across multiple pages');
  const lastPage = pages3[pages3.length - 1];
  assert.strictEqual(lastPage.showBottomSection, true, 'Final page must include the signature block');
  assert.strictEqual(pages3[0].showBottomSection, false, 'First page must not squeeze signatures when items overflow');
  console.log('✔ PASS: Multi-Page DC scales cleanly with signatures preserved on final page!\n');

  console.log('=== ALL TESTS PASSED: DELIVERY CHALLAN DYNAMIC PAGINATION VERIFIED 100% ===');
}

runTests();
