/**
 * dcReturnCalculator.js
 * Unified calculation engine for Delivery Challan returns.
 * 
 * Ensures strict separation between:
 * 1. ORIGINAL PURPOSE: 'Normal Delivery' (DELIVERY CHALLAN) vs 'Returnable / Temporary' (RETURNABLE DC)
 * 2. RETURN STATE: 'NOT_RETURNED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'
 *
 * Formula:
 * remainingReturnableQty = originalDeliveredQty - cumulativeReturnedQty
 */

export function calculateItemReturnMetrics(item) {
  const originalDeliveredQty = Math.max(0, Number(item?.quantity || item?.deliveredQty || 1));
  const cumulativeReturnedQty = Math.max(0, Number(item?.returnedQty || 0));
  const remainingReturnableQty = Math.max(0, originalDeliveredQty - cumulativeReturnedQty);

  const returnedSerialsSet = new Set(
    (Array.isArray(item?.returnedSerials) ? item.returnedSerials : []).map((s) => String(s || '').trim().toLowerCase())
  );

  const allDispatchedSerials = (Array.isArray(item?.serialNumbers) ? item.serialNumbers : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  const eligibleSerials = allDispatchedSerials.filter((s) => !returnedSerialsSet.has(s.toLowerCase()));

  return {
    originalDeliveredQty,
    cumulativeReturnedQty,
    remainingReturnableQty,
    isFullyReturned: remainingReturnableQty === 0 && cumulativeReturnedQty > 0,
    isPartiallyReturned: cumulativeReturnedQty > 0 && remainingReturnableQty > 0,
    isNotReturned: cumulativeReturnedQty === 0,
    allDispatchedSerials,
    eligibleSerials
  };
}

export function calculateDcReturnMetrics(dc) {
  if (!dc) {
    return {
      originalDeliveredQty: 0,
      cumulativeReturnedQty: 0,
      remainingReturnableQty: 0,
      returnState: 'NOT_RETURNED',
      isEligibleForReturn: false,
      statusBadge: 'DISPATCHED',
      originalPurpose: 'Normal Delivery',
      originalDocumentTitle: 'DELIVERY CHALLAN',
      itemMetrics: []
    };
  }

  const items = Array.isArray(dc.items) && dc.items.length > 0 ? dc.items : [];
  
  let originalDeliveredQty = 0;
  let cumulativeReturnedQty = 0;
  const itemMetrics = items.map((it) => {
    const m = calculateItemReturnMetrics(it);
    originalDeliveredQty += m.originalDeliveredQty;
    cumulativeReturnedQty += m.cumulativeReturnedQty;
    return { ...it, metrics: m };
  });

  if (items.length === 0) {
    originalDeliveredQty = Number(dc.totalQty || 1);
    cumulativeReturnedQty = Number(dc.returnedUnits || 0);
  }

  const remainingReturnableQty = Math.max(0, originalDeliveredQty - cumulativeReturnedQty);

  // Determine return state
  let returnState = 'NOT_RETURNED';
  if (cumulativeReturnedQty >= originalDeliveredQty && originalDeliveredQty > 0) {
    returnState = 'FULLY_RETURNED';
  } else if (cumulativeReturnedQty > 0) {
    returnState = 'PARTIALLY_RETURNED';
  }

  // Original DC Purpose (MUST NEVER BE OVERWRITTEN BY RETURN STATE)
  const isReturnablePurpose = Boolean(
    dc.deliveryPurpose === 'RETURNABLE' ||
    dc.documentType === 'RETURNABLE_DC' ||
    dc.isReturnableDC === true
  );

  const originalPurpose = isReturnablePurpose ? 'Returnable / Temporary' : 'Normal Delivery';
  const originalDocumentTitle = isReturnablePurpose ? 'RETURNABLE DC' : 'DELIVERY CHALLAN';

  // Display Badge Priority (Requirement 6):
  // IF cumulativeReturnedQty = 0 -> use normal original delivery status
  // IF cumulativeReturnedQty > 0 AND cumulativeReturnedQty < originalDeliveredQty -> PARTIALLY RETURNED
  // IF cumulativeReturnedQty = originalDeliveredQty -> FULLY RETURNED
  let statusBadge = dc.status || 'DISPATCHED';
  if (returnState === 'FULLY_RETURNED') {
    statusBadge = 'FULLY RETURNED';
  } else if (returnState === 'PARTIALLY_RETURNED') {
    statusBadge = 'PARTIALLY RETURNED';
  } else {
    // Return to original delivery status if set, defaulting to DELIVERED or DISPATCHED
    if (statusBadge === 'RETURNED' || statusBadge === 'PARTIALLY RETURNED' || statusBadge === 'FULLY RETURNED') {
      statusBadge = 'DELIVERED';
    }
  }

  const isEligibleForReturn = remainingReturnableQty > 0 && dc.status !== 'DRAFT';

  return {
    originalDeliveredQty,
    cumulativeReturnedQty,
    remainingReturnableQty,
    returnState,
    isEligibleForReturn,
    statusBadge,
    originalPurpose,
    originalDocumentTitle,
    itemMetrics
  };
}
