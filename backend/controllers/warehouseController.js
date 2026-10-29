const fs = require('fs');
const path = require('path');
const {
  normalizeWarehouseLayout,
  countWarehouseBins,
  formatLocationString,
  formatLocationCode
} = require('../utils/warehouseLayoutHelper');

const ACCESS_CONTROL_PATH = path.join(__dirname, '../data/access-control.json');
const STOCKS_DATA_PATH = path.join(__dirname, '../data/stocks-data.json');

function readJsonFile(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

/**
 * Helper to match products to default boxes based on categories and SKUs
 */
function getDefaultBoxForProduct(product) {
  const code = String(product.code || '').toUpperCase();
  const cat = String(product.categoryId || '').toUpperCase();
  const name = String(product.name || '').toLowerCase();

  // Bullet cameras
  if (name.includes('bullet') || code.includes('CAM-IPC-001') || code.includes('ASI01') || code.includes('ASI-14')) {
    return {
      floorId: 'FL-01',
      floorName: 'Floor 1 (Ground Floor)',
      rackId: 'RK-A',
      rackName: 'Rack A (CCTV & Surveillance)',
      shelfId: 'SH-01',
      shelfName: 'Shelf 1 (Bottom Tier)',
      boxId: 'BX-A1-01',
      boxName: 'Box A1-01 (Bullet Cameras)',
      boxCode: 'BX-01',
      locationCode: 'WH-CHN-01-FL-01-RK-A-SH-01-BX-01'
    };
  }

  // Dome cameras
  if (name.includes('dome') || code.includes('CAM-IPC-002') || code.includes('DOME')) {
    return {
      floorId: 'FL-01',
      floorName: 'Floor 1 (Ground Floor)',
      rackId: 'RK-A',
      rackName: 'Rack A (CCTV & Surveillance)',
      shelfId: 'SH-01',
      shelfName: 'Shelf 1 (Bottom Tier)',
      boxId: 'BX-A1-02',
      boxName: 'Box A1-02 (Dome Cameras)',
      boxCode: 'BX-02',
      locationCode: 'WH-CHN-01-FL-01-RK-A-SH-01-BX-02'
    };
  }

  // PTZ cameras
  if (name.includes('ptz') || code.includes('ASI-04') || code.includes('ASI-05') || code.includes('ASI-06') || code.includes('ASI-07') || code.includes('ASI-08') || code.includes('ASI-PRO-9901')) {
    return {
      floorId: 'FL-01',
      floorName: 'Floor 1 (Ground Floor)',
      rackId: 'RK-A',
      rackName: 'Rack A (CCTV & Surveillance)',
      shelfId: 'SH-01',
      shelfName: 'Shelf 1 (Bottom Tier)',
      boxId: 'BX-A1-03',
      boxName: 'Box A1-03 (PTZ Accessories)',
      boxCode: 'BX-03',
      locationCode: 'WH-CHN-01-FL-01-RK-A-SH-01-BX-03'
    };
  }

  // Optical Vision IP cameras
  if (code.includes('ASI-CAM') || name.includes('optical vision') || (name.includes('camera') && !name.includes('box'))) {
    return {
      floorId: 'FL-01',
      floorName: 'Floor 1 (Ground Floor)',
      rackId: 'RK-A',
      rackName: 'Rack A (CCTV & Surveillance)',
      shelfId: 'SH-02',
      shelfName: 'Shelf 2 (Mid Level Tier)',
      boxId: 'BX-A2-01',
      boxName: 'Box A2-01 (IP Network Cameras)',
      boxCode: 'BX-04',
      locationCode: 'WH-CHN-01-FL-01-RK-A-SH-02-BX-04'
    };
  }

  // Junction Boxes & Connectors
  if (name.includes('outdoor box') || name.includes('rj45') || code.includes('ASI02') || code.includes('ACC-RJ45')) {
    return {
      floorId: 'FL-01',
      floorName: 'Floor 1 (Ground Floor)',
      rackId: 'RK-A',
      rackName: 'Rack A (CCTV & Surveillance)',
      shelfId: 'SH-02',
      shelfName: 'Shelf 2 (Mid Level Tier)',
      boxId: 'BX-A2-02',
      boxName: 'Box A2-02 (Junction Boxes & Connectors)',
      boxCode: 'BX-05',
      locationCode: 'WH-CHN-01-FL-01-RK-A-SH-02-BX-05'
    };
  }

  // Sensors & Controllers
  if (name.includes('sensor') || code.includes('ASI-09') || code.includes('ASI-10') || code.includes('ASI-11') || code.includes('ASI-12') || code.includes('ASI-DC-NEW')) {
    return {
      floorId: 'FL-01',
      floorName: 'Floor 1 (Ground Floor)',
      rackId: 'RK-A',
      rackName: 'Rack A (CCTV & Surveillance)',
      shelfId: 'SH-03',
      shelfName: 'Shelf 3 (Upper Tier)',
      boxId: 'BX-A3-01',
      boxName: 'Box A3-01 (Sensors & Specialized Lenses)',
      boxCode: 'BX-06',
      locationCode: 'WH-CHN-01-FL-01-RK-A-SH-03-BX-06'
    };
  }

  // NVRs & DVRs
  if (name.includes('nvr') || name.includes('dvr') || code.includes('NVR') || code.includes('ASI-13')) {
    return {
      floorId: 'FL-01',
      floorName: 'Floor 1 (Ground Floor)',
      rackId: 'RK-B',
      rackName: 'Rack B (Storage & Recorders)',
      shelfId: 'SH-01',
      shelfName: 'Shelf 1',
      boxId: 'BX-B1-01',
      boxName: 'Box B1-01 (4CH / 8CH DVRs)',
      boxCode: 'BX-07',
      locationCode: 'WH-CHN-01-FL-01-RK-B-SH-01-BX-07'
    };
  }

  // Surveillance Hard Drives
  if (name.includes('hdd') || name.includes('hard disk') || code.includes('HDD') || code.includes('ASI-15')) {
    return {
      floorId: 'FL-01',
      floorName: 'Floor 1 (Ground Floor)',
      rackId: 'RK-B',
      rackName: 'Rack B (Storage & Recorders)',
      shelfId: 'SH-02',
      shelfName: 'Shelf 2',
      boxId: 'BX-B2-01',
      boxName: 'Box B2-01 (Surveillance HDDs 1TB-4TB)',
      boxCode: 'BX-09',
      locationCode: 'WH-CHN-01-FL-01-RK-B-SH-02-BX-09'
    };
  }

  // Switches, Power Supply, EM locks
  if (name.includes('exit switch') || name.includes('power supply') || code.includes('ASI03') || code.includes('PWR-SMPS')) {
    return {
      floorId: 'FL-02',
      floorName: 'Floor 2 (High-Value Storage)',
      rackId: 'RK-C',
      rackName: 'Rack C (Biometrics & Access Control)',
      shelfId: 'SH-01',
      shelfName: 'Shelf 1',
      boxId: 'BX-C1-02',
      boxName: 'Box C1-02 (EM Locks & Exit Switches)',
      boxCode: 'BX-12',
      locationCode: 'WH-CHN-01-FL-02-RK-C-SH-01-BX-12'
    };
  }

  // PoE Switches
  if (name.includes('switch') || name.includes('poe') || code.includes('NET-SW') || code.includes('ASI-16') || code.includes('ASI-17')) {
    return {
      floorId: 'FL-02',
      floorName: 'Floor 2 (High-Value Storage)',
      rackId: 'RK-D',
      rackName: 'Rack D (Networking & Switches)',
      shelfId: 'SH-01',
      shelfName: 'Shelf 1',
      boxId: 'BX-D1-01',
      boxName: 'Box D1-01 (4-Port / 8-Port POE Switches)',
      boxCode: 'BX-14',
      locationCode: 'WH-CHN-01-FL-02-RK-D-SH-01-BX-14'
    };
  }

  // Server Racks, HDMI, Installation
  if (name.includes('server rack') || name.includes('hdmi') || name.includes('installation') || code.includes('RCK-WALL') || code.includes('CBL-HDMI') || code.includes('ASI-19')) {
    return {
      floorId: 'FL-02',
      floorName: 'Floor 2 (High-Value Storage)',
      rackId: 'RK-D',
      rackName: 'Rack D (Networking & Switches)',
      shelfId: 'SH-01',
      shelfName: 'Shelf 1',
      boxId: 'BX-D1-02',
      boxName: 'Box D1-02 (16-Port / 24-Port Managed Switches)',
      boxCode: 'BX-15',
      locationCode: 'WH-CHN-01-FL-02-RK-D-SH-01-BX-15'
    };
  }

  // Cables
  if (name.includes('cable') || name.includes('utp') || code.includes('CAB-UTP') || code.includes('ASI-18')) {
    return {
      floorId: 'FL-02',
      floorName: 'Floor 2 (High-Value Storage)',
      rackId: 'RK-D',
      rackName: 'Rack D (Networking & Switches)',
      shelfId: 'SH-02',
      shelfName: 'Shelf 2',
      boxId: 'BX-D2-01',
      boxName: 'Box D2-01 (Cat6 Cable Reels 305M)',
      boxCode: 'BX-16',
      locationCode: 'WH-CHN-01-FL-02-RK-D-SH-02-BX-16'
    };
  }

  // Fallback
  return {
    floorId: 'FL-01',
    floorName: 'Floor 1 (Ground Floor)',
    rackId: 'RK-A',
    rackName: 'Rack A (CCTV & Surveillance)',
    shelfId: 'SH-01',
    shelfName: 'Shelf 1 (Bottom Tier)',
    boxId: 'BX-A1-01',
    boxName: 'Box A1-01 (Bullet Cameras)',
    boxCode: 'BX-01',
    locationCode: 'WH-CHN-01-FL-01-RK-A-SH-01-BX-01'
  };
}

/**
 * GET /api/warehouses
 * Returns all warehouses enriched with computed occupancy, floor/rack/shelf/box trees, and assigned products
 */
function getAllWarehouses(req, res) {
  try {
    const accessData = readJsonFile(ACCESS_CONTROL_PATH);
    const stocksData = readJsonFile(STOCKS_DATA_PATH);

    const rawWhs = accessData.companySettings?.warehouses || [];
    const products = Array.isArray(stocksData.products) ? stocksData.products : [];

    const enrichedWarehouses = rawWhs.map((rawWh) => {
      const wh = normalizeWarehouseLayout(rawWh);
      const binsCount = countWarehouseBins(wh);

      let whTotalStock = 0;
      let whTotalValuation = 0;
      let occupiedBoxes = 0;
      let totalBoxesCount = 0;

      // Populate layout floors with products
      const floors = (wh.layout?.floors || []).map((fl) => {
        const racks = (fl.racks || []).map((rk) => {
          let rackStock = 0;
          let rackValuation = 0;
          let rackOccupiedBoxes = 0;
          let rackTotalBoxes = 0;

          const shelves = (rk.shelves || []).map((sh) => {
            const boxes = (sh.boxes || []).map((bx) => {
              totalBoxesCount++;
              rackTotalBoxes++;

              // Match products that reside in this box
              const assigned = products.filter((p) => {
                const loc = p.warehouseLocation;
                if (loc && loc.warehouseId === wh.id) {
                  return loc.box === bx.name || loc.boxId === bx.id || (loc.locationCode && loc.locationCode.endsWith(bx.code));
                }
                // If warehouse is default WH-001 and product has no location, use default mapping
                if (wh.isDefault && (!loc || !loc.warehouseId)) {
                  const def = getDefaultBoxForProduct(p);
                  return def.rackId === rk.id && def.boxId === bx.id;
                }
                return false;
              });

              const boxStock = assigned.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
              const boxVal = assigned.reduce((sum, p) => sum + ((Number(p.stock) || 0) * (Number(p.cost) || 0)), 0);
              const boxSerials = assigned.reduce((sum, p) => sum + (Array.isArray(p.serialNumbers) ? p.serialNumbers.length : 0), 0);

              const isOccupied = assigned.length > 0;
              if (isOccupied) {
                occupiedBoxes++;
                rackOccupiedBoxes++;
              }

              rackStock += boxStock;
              rackValuation += boxVal;
              whTotalStock += boxStock;
              whTotalValuation += boxVal;

              return {
                ...bx,
                isOccupied,
                stockQuantity: boxStock,
                valuation: boxVal,
                serialsCount: boxSerials,
                assignedProductsCount: assigned.length,
                assignedProducts: assigned.map((p) => ({
                  id: p.id,
                  code: p.code,
                  name: p.name,
                  stock: p.stock || 0,
                  cost: p.cost || 0,
                  serialized: Boolean(p.serialized),
                  serialNumbers: Array.isArray(p.serialNumbers) ? p.serialNumbers : [],
                  alertQuantity: p.alertQuantity || 10,
                  isLowStock: (p.stock || 0) <= (p.alertQuantity || 10)
                }))
              };
            });

            return {
              ...sh,
              boxes
            };
          });

          return {
            ...rk,
            totalBoxes: rackTotalBoxes,
            occupiedBoxes: rackOccupiedBoxes,
            occupancyRate: rackTotalBoxes > 0 ? Math.round((rackOccupiedBoxes / rackTotalBoxes) * 100) : 0,
            stockQuantity: rackStock,
            valuation: rackValuation,
            shelves
          };
        });

        return {
          ...fl,
          racks
        };
      });

      return {
        ...wh,
        floorsCount: binsCount.floors,
        racksCount: binsCount.racks,
        shelvesCount: binsCount.shelves,
        totalBoxesCount,
        occupiedBoxesCount: occupiedBoxes,
        emptyBoxesCount: Math.max(0, totalBoxesCount - occupiedBoxes),
        occupancyRate: totalBoxesCount > 0 ? Math.round((occupiedBoxes / totalBoxesCount) * 100) : 0,
        totalStockUnits: whTotalStock,
        totalValuation: whTotalValuation,
        layout: {
          ...wh.layout,
          floors
        }
      };
    });

    const summaryKpis = {
      totalWarehouses: enrichedWarehouses.length,
      totalBins: enrichedWarehouses.reduce((sum, w) => sum + w.totalBoxesCount, 0),
      occupiedBins: enrichedWarehouses.reduce((sum, w) => sum + w.occupiedBoxesCount, 0),
      emptyBins: enrichedWarehouses.reduce((sum, w) => sum + w.emptyBoxesCount, 0),
      totalStockUnits: enrichedWarehouses.reduce((sum, w) => sum + w.totalStockUnits, 0),
      totalValuation: enrichedWarehouses.reduce((sum, w) => sum + w.totalValuation, 0),
      overallOccupancyRate: 0
    };

    if (summaryKpis.totalBins > 0) {
      summaryKpis.overallOccupancyRate = Math.round((summaryKpis.occupiedBins / summaryKpis.totalBins) * 100);
    }

    return res.status(200).json({
      success: true,
      data: enrichedWarehouses,
      kpis: summaryKpis,
      totalProductsCount: products.length
    });
  } catch (error) {
    console.error('Error in getAllWarehouses:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve warehouses.' });
  }
}

/**
 * GET /api/warehouses/search?q=...
 * Finds product coordinate in the warehouse hierarchy
 */
function searchWarehouseLocation(req, res) {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query is required.' });
    }

    const stocksData = readJsonFile(STOCKS_DATA_PATH);
    const products = Array.isArray(stocksData.products) ? stocksData.products : [];

    const matched = products.find((p) => {
      const codeMatch = String(p.code || '').toLowerCase().includes(q);
      const nameMatch = String(p.name || '').toLowerCase().includes(q);
      const serialMatch = Array.isArray(p.serialNumbers) && p.serialNumbers.some((sn) => String(sn).toLowerCase().includes(q));
      return codeMatch || nameMatch || serialMatch;
    });

    if (!matched) {
      return res.status(404).json({ success: false, message: `No hardware item found matching "${q}".` });
    }

    const loc = matched.warehouseLocation || getDefaultBoxForProduct(matched);

    return res.status(200).json({
      success: true,
      product: {
        id: matched.id,
        code: matched.code,
        name: matched.name,
        stock: matched.stock,
        serialized: Boolean(matched.serialized),
        serialNumbers: matched.serialNumbers || []
      },
      location: loc,
      fullCoordinateString: loc.binLocation || `${loc.warehouseName || 'Main Central Hub'} › ${loc.floor || loc.floorName} › ${loc.rack || loc.rackName} › ${loc.shelf || loc.shelfName} › ${loc.box || loc.boxName}`
    });
  } catch (error) {
    console.error('Error in searchWarehouseLocation:', error);
    return res.status(500).json({ success: false, message: 'Search failed.' });
  }
}

/**
 * POST /api/warehouses/assign-bin
 * Assigns a product to a specific Box/Bin coordinate
 */
function assignProductToBin(req, res) {
  try {
    const { productId, warehouseId, warehouseName, floor, rack, shelf, box, locationCode } = req.body;
    if (!productId || !box) {
      return res.status(400).json({ success: false, message: 'Product ID and Box coordinate are required.' });
    }

    const stocksData = readJsonFile(STOCKS_DATA_PATH);
    const products = Array.isArray(stocksData.products) ? stocksData.products : [];
    const product = products.find((p) => p.id === productId || p.code === productId);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const binLocation = `${warehouseName || 'Main Central Hub'} › ${floor || 'Floor 1'} › ${rack || 'Rack A'} › ${shelf || 'Shelf 1'} › ${box}`;

    product.warehouseLocation = {
      warehouseId: warehouseId || 'WH-001',
      warehouseName: warehouseName || 'Main Central Hub',
      floor: floor || 'Floor 1',
      rack: rack || 'Rack A',
      shelf: shelf || 'Shelf 1',
      box,
      binLocation,
      locationCode: locationCode || `WH-001-${box}`,
      updatedAt: new Date().toISOString()
    };

    writeJsonFile(STOCKS_DATA_PATH, stocksData);

    return res.status(200).json({
      success: true,
      message: `Product ${product.name} successfully assigned to ${box}.`,
      product
    });
  } catch (error) {
    console.error('Error in assignProductToBin:', error);
    return res.status(500).json({ success: false, message: 'Failed to assign product to bin.' });
  }
}

/**
 * POST /api/warehouses/transfer-bin
 * Internal relocation from one bin to another
 */
function transferStockBetweenBins(req, res) {
  try {
    const { productId, quantity, sourceLocation, destLocation, reason, notes, serialNumbers } = req.body;
    const qtyNum = Number(quantity || 0);

    if (!productId || qtyNum <= 0) {
      return res.status(400).json({ success: false, message: 'Valid Product and Quantity are required for transfer.' });
    }

    const stocksData = readJsonFile(STOCKS_DATA_PATH);
    const products = Array.isArray(stocksData.products) ? stocksData.products : [];
    const product = products.find((p) => p.id === productId || p.code === productId);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const now = new Date().toISOString();
    const movementId = `MV-${Date.now().toString().slice(-6)}`;

    // Create Transfer Audit Transaction
    const txn = {
      id: movementId,
      movementId,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      type: 'TRANSFER',
      event: 'Internal Bin Relocation',
      quantity: qtyNum,
      unit: product.unit || 'Nos',
      reference: movementId,
      source: sourceLocation?.binLocation || 'Source Bin',
      destination: destLocation?.binLocation || 'Destination Bin',
      reason: reason || 'Warehouse Bay Optimization',
      notes: notes || `Relocated ${qtyNum} units from ${sourceLocation?.box || 'Source'} to ${destLocation?.box || 'Destination'}`,
      date: now,
      createdAt: now,
      user: req.headers['x-user-id'] || 'Store Officer',
      createdBy: req.headers['x-user-id'] || 'Store Officer',
      stockBefore: product.stock,
      stockAfter: product.stock,
      currentStock: product.stock,
      serialNumbers: Array.isArray(serialNumbers) ? serialNumbers : [],
      warehouseId: destLocation?.warehouseId || 'WH-001',
      warehouseName: destLocation?.warehouseName || 'Main Central Hub',
      floor: destLocation?.floor,
      rack: destLocation?.rack,
      shelf: destLocation?.shelf,
      box: destLocation?.box,
      binLocation: destLocation?.binLocation,
      locationCode: destLocation?.locationCode
    };

    if (!Array.isArray(stocksData.inventoryTransactions)) {
      stocksData.inventoryTransactions = [];
    }
    stocksData.inventoryTransactions.unshift(txn);

    // Update product's active warehouse location to destination
    if (destLocation) {
      product.warehouseLocation = {
        warehouseId: destLocation.warehouseId || 'WH-001',
        warehouseName: destLocation.warehouseName || 'Main Central Hub',
        floor: destLocation.floor,
        rack: destLocation.rack,
        shelf: destLocation.shelf,
        box: destLocation.box,
        binLocation: destLocation.binLocation,
        locationCode: destLocation.locationCode,
        updatedAt: now
      };
    }

    writeJsonFile(STOCKS_DATA_PATH, stocksData);

    return res.status(200).json({
      success: true,
      message: `Successfully transferred ${qtyNum} units to ${destLocation?.box || 'destination'}.`,
      transaction: txn
    });
  } catch (error) {
    console.error('Error in transferStockBetweenBins:', error);
    return res.status(500).json({ success: false, message: 'Failed to record bin transfer.' });
  }
}

module.exports = {
  getAllWarehouses,
  searchWarehouseLocation,
  assignProductToBin,
  transferStockBetweenBins
};
