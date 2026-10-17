/**
 * Canonical Quotation Calculation Engine
 * 
 * Single authoritative source of truth for:
 * - Quotation Screen & reactive line-item editing (QuotationEditor)
 * - Quotation persistence (save payload & backend sync)
 * - Quotation edit / reload
 * - PDF, Print & DocumentPreviewModal (PrintableQuotation)
 */

/**
 * Calculates a single quotation line item
 * 
 * Formula:
 * Gross = Quantity × Quotation Price
 * Discount Amount = Gross × (Discount % / 100)  [if showDiscount enabled]
 * Taxable = Gross - Discount Amount
 * GST Amount = Taxable × (GST % / 100)
 * Line Total = Taxable + GST Amount
 */
export function calculateLineItem(item, { showDiscount = false } = {}) {
  const quantity = Math.max(0, parseInt(item?.quantity, 10) || 0);
  const unitPrice = Math.max(0, parseFloat(item?.unitPrice) || 0);
  const gst = Math.max(0, Math.min(100, parseFloat(item?.gst !== undefined ? item.gst : 18) || 0));
  const rawDiscount = item?.discount !== undefined ? item.discount : (item?.discountPercent || 0);
  const discountPct = Math.max(0, Math.min(100, parseFloat(rawDiscount) || 0));

  const lineSubtotal = Math.round(quantity * unitPrice * 100) / 100;
  const discountAmount = Math.round((lineSubtotal * (discountPct / 100)) * 100) / 100;
  const taxableAmount = Math.max(0, Math.round((lineSubtotal - discountAmount) * 100) / 100);
  const lineTax = Math.round(((taxableAmount * gst) / 100) * 100) / 100;
  const lineTotal = Math.round((taxableAmount + lineTax) * 100) / 100;

  return {
    ...item,
    quantity,
    unitPrice,
    gst,
    discount: discountPct,
    discountPercent: discountPct,
    lineSubtotal,
    discountAmount,
    taxableAmount,
    lineTax,
    lineTotal
  };
}

/**
 * Calculates total quotation amounts
 * 
 * Returns:
 * {
 *   subtotal,        // gross subtotal (sum of lineSubtotal)
 *   discountTotal,   // sum of discountAmount
 *   taxableTotal,    // sum of taxableAmount
 *   gstTotal,        // sum of lineTax
 *   calculatedTotal, // taxableTotal + gstTotal
 *   roundOff,        // round off adjustment if roundOffTotal is enabled
 *   grandTotal       // final payable total
 * }
 */
export function calculateQuotationTotals(items = [], { showDiscount = false, roundOffTotal = false } = {}) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let gstTotal = 0;

  (items || []).forEach((rawItem) => {
    if (rawItem && (rawItem.productId || rawItem.productName || rawItem.name || rawItem.item || rawItem.unitPrice)) {
      const calc = calculateLineItem(rawItem, { showDiscount });
      subtotal += calc.lineSubtotal;
      discountTotal += calc.discountAmount;
      taxableTotal += calc.taxableAmount;
      gstTotal += calc.lineTax;
    }
  });

  subtotal = Math.round(subtotal * 100) / 100;
  discountTotal = Math.round(discountTotal * 100) / 100;
  taxableTotal = Math.round(taxableTotal * 100) / 100;
  gstTotal = Math.round(gstTotal * 100) / 100;

  const calculatedTotal = Math.round((taxableTotal + gstTotal) * 100) / 100;

  let roundOff = 0;
  let grandTotal = calculatedTotal;

  // Business Rule: When Round Off Total is enabled, always move positive calculated total
  // to the NEXT whole number: Math.floor(calculatedTotal) + 1. (Never Math.round or Math.ceil alone).
  if (roundOffTotal && calculatedTotal > 0) {
    grandTotal = Math.floor(calculatedTotal + 1e-9) + 1;
    roundOff = Math.round((grandTotal - calculatedTotal) * 100) / 100;
  } else {
    grandTotal = calculatedTotal;
    roundOff = 0;
  }

  return {
    subtotal,
    discountTotal,
    taxableTotal,
    gstTotal,
    calculatedTotal,
    roundOff,
    grandTotal
  };
}
