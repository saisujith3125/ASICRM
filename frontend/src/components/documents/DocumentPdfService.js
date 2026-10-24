/**
 * DocumentPdfService
 * High-fidelity PDF generation using html2pdf.js with rigorous pre-render verification.
 * Prevents blank PDFs by checking fonts, images, and non-zero dimensions.
 */
import html2pdf from 'html2pdf.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import PrintableSalesInvoice from './PrintableSalesInvoice';
export { html2pdf, createRoot, React };

/**
 * Generate and download PDF from an existing mounted DOM element
 */
export async function downloadPdfFromElement(element, filename = 'Document.pdf') {
  if (!element) {
    throw new Error('No printable document element provided for PDF generation.');
  }

  // Ensure we target the printable document root to avoid nested wrapper padding
  const printableElement = element.querySelector?.('.doc-sheet-root') || element;

  // 1. Wait for fonts
  if (document.fonts) {
    await document.fonts.ready;
  }

  // 2. Wait for images inside the element
  const images = Array.from(printableElement.querySelectorAll('img, svg'));
  if (images.length > 0) {
    await Promise.all(
      images.map((img) => {
        if (img.tagName.toLowerCase() === 'svg') return Promise.resolve();
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = img.onerror = resolve;
        });
      })
    );
  }

  // Small frame yield to let browser finish sub-pixel layout
  await new Promise((resolve) => setTimeout(resolve, 200));

  // 3. Verify non-zero dimensions (Root-Cause Blank Prevention)
  const rect = printableElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error('Printable document rendered with zero dimensions.');
  }

  // 4. Configure html2pdf with A4 portrait settings
  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const isPaged = Boolean(
    printableElement.querySelector?.('.doc-quotation-root, .doc-paged-root, .doc-quotation-page, .doc-paged-page') ||
    printableElement.classList?.contains('doc-quotation-root') ||
    printableElement.classList?.contains('doc-paged-root') ||
    printableElement.classList?.contains('doc-quotation-page') ||
    printableElement.classList?.contains('doc-paged-page')
  );

  const opt = {
    // Paged documents manage their own padding inside 210mm A4 pages
    margin: isPaged ? [0, 0, 0, 0] : [8, 8, 8, 8],
    filename: safeFilename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2, // High-DPI crisp text rendering
      useCORS: true,
      logging: false,
      scrollY: 0,
      scrollX: 0,
      ignoreElements: (el) => {
        return (
          el.classList?.contains('quotation-viewer-page-gap') ||
          el.classList?.contains('doc-viewer-page-gap') ||
          el.classList?.contains('doc-preview-action-bar') ||
          el.classList?.contains('doc-preview-buttons') ||
          el.classList?.contains('doc-preview-page-nav-badge') ||
          el.classList?.contains('quotation-page-badge')
        );
      }
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    },
    pagebreak: {
      mode: isPaged ? ['css', 'legacy'] : ['avoid-all', 'css', 'legacy']
    }
  };

  printableElement.classList.add('is-exporting-pdf');
  try {
    // Universal Anti-Ghost-Page Detection across ALL documents
    // Finds all discrete page elements rendered in the DOM for Quotations, Invoices, DCs, Proformas, POs, etc.
    const pagedElements = Array.from(
      printableElement.querySelectorAll(
        '.doc-paged-page, .doc-quotation-page, .quotation-page, [data-page-num]'
      )
    );
    const expectedPages = pagedElements.length;

    const worker = html2pdf().set(opt).from(printableElement);

    if (expectedPages > 0) {
      const pdf = await worker.toPdf().get('pdf');
      let totalPages = pdf.internal.getNumberOfPages();
      // Anti-ghost-page rule: Never allow sub-pixel rounding or 1px canvas overflow
      // to create trailing blank pages beyond what is genuinely rendered in the DOM.
      while (totalPages > expectedPages) {
        pdf.deletePage(totalPages);
        totalPages = pdf.internal.getNumberOfPages();
      }
      await worker.save();
    } else {
      await worker.save();
    }

    return true;
  } catch (err) {
    console.error('PDF generation failed:', err);
    throw new Error(`PDF generation failed: ${err.message || 'Unknown error'}`);
  } finally {
    printableElement.classList.remove('is-exporting-pdf');
  }
}

/**
 * Programmatically mount and download PDF for any document component + data
 */
export async function generateDocumentPdf(Component, props, filename = 'document.pdf') {
  const isPaged = filename.toLowerCase().includes('qt') ||
                  filename.toLowerCase().includes('quotation') ||
                  filename.toLowerCase().includes('inv') ||
                  filename.toLowerCase().includes('dc') ||
                  filename.toLowerCase().includes('po') ||
                  filename.toLowerCase().includes('proforma');
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = isPaged ? '210mm' : '194mm';
  container.style.background = '#ffffff';
  container.style.zIndex = '-99999';
  container.style.boxSizing = 'border-box';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    root.render(React.createElement(Component, props));

    // Wait for initial React render commit
    await new Promise((resolve) => setTimeout(resolve, 350));

    await downloadPdfFromElement(container, filename);
    return true;
  } finally {
    try {
      root.unmount();
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    } catch (_) {}
  }
}

/**
 * Generate formatted file names
 */
export function getDcFilename(challan) {
  if (challan?.isReturnDocument || challan?.documentType === 'PARTIAL_RETURN_DC' || challan?.documentType === 'RETURN_DC') {
    const isPartial = challan?.returnStatus === 'PARTIALLY_RETURNED' || challan?.status === 'PARTIALLY RETURNED';
    const retId = challan?.returnId || challan?.lastReturnId || challan?.challanId || 'Return';
    const cleanId = String(retId).replace(/[^a-zA-Z0-9-_]/g, '_');
    return isPartial ? `Partial_Return_${cleanId}.pdf` : `Return_${cleanId}.pdf`;
  }
  const rawId = challan?.challanId || challan?.dcNumber || 'Consignment';
  const cleanId = String(rawId).replace(/[^a-zA-Z0-9-_]/g, '_');
  // Ensure DC- prefix
  const prefixed = cleanId.startsWith('DC-') || cleanId.startsWith('DC_') ? cleanId : `DC-${cleanId}`;
  return `${prefixed}.pdf`;
}

export function getInvoiceFilename(invoice, options = {}) {
  const showSignature = typeof options === 'boolean' ? options : (options?.showSignature !== false);
  const rawId = invoice?.invoiceId || invoice?.invoiceNumber || invoice?.invoiceNo || 'Tax_Invoice';
  const cleanId = String(rawId).replace(/[^a-zA-Z0-9-_]/g, '_');
  // Ensure INV- prefix
  const prefixed = cleanId.startsWith('INV-') || cleanId.startsWith('INV_') ? cleanId : `INV-${cleanId}`;
  const suffix = showSignature ? '-Signed' : '-Unsigned';
  return `${prefixed}${suffix}.pdf`;
}

/**
 * High-level Sales Invoice PDF generator
 * Generates signed or unsigned PDF from the single shared PrintableSalesInvoice template
 */
export async function generateInvoicePdf(invoice, options = {}) {
  const showSignature = typeof options === 'boolean' ? options : (options?.showSignature !== false);
  const companySettings = typeof options === 'object' && options !== null ? options.companySettings : null;
  const filename = getInvoiceFilename(invoice, { showSignature });
  return generateDocumentPdf(PrintableSalesInvoice, { data: invoice, companySettings, showSignature }, filename);
}

export function getProformaFilename(proforma) {
  const rawId = proforma?.proformaId || proforma?.id || 'Proforma_Invoice';
  const cleanId = String(rawId).replace(/[^a-zA-Z0-9-_]/g, '_');
  // Ensure PI- prefix
  const prefixed = cleanId.startsWith('PI-') || cleanId.startsWith('PI_') ? cleanId : `PI-${cleanId}`;
  return `${prefixed}.pdf`;
}

/**
 * Calculate Indian Financial Year (April - March) in short YY-YY format (e.g., "26-27")
 */
export function getIndianFinancialYearShort(dateInput) {
  let d = null;
  if (typeof dateInput === 'string') {
    const s = dateInput.trim();
    // Check DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (ddmmyyyy) {
      d = new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]));
    } else {
      d = new Date(s);
    }
  } else if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  }

  if (!d || isNaN(d.getTime())) {
    d = new Date();
  }

  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1 to 12
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  const startStr = String(startYear).slice(-2);
  const endStr = String(endYear).slice(-2);
  return `${startStr}-${endStr}`;
}

/**
 * Normalizes quotation number for filename by extracting the standard QT sequence code
 * e.g., "ASI/26-27/QT0007" -> "QT0007", "QT-000101" -> "QT000101", "QTN/001/2026" -> "QT0001"
 */
export function normalizeQuotationNumberForFilename(quotationNumber) {
  if (!quotationNumber) return 'QT000000';
  let s = String(quotationNumber).trim();
  const qtMatch = s.match(/QT\d+/i);
  if (qtMatch) {
    return qtMatch[0].toUpperCase();
  }
  const qtnMatch = s.match(/QTN\/0*(\d+)/i);
  if (qtnMatch) {
    return `QT${String(parseInt(qtnMatch[1], 10)).padStart(4, '0')}`;
  }
  // Strip leading ASI_ or ASI- or ASI/ if present
  s = s.replace(/^ASI[-_/]/i, '');
  // Remove internal hyphens, underscores, slashes, spaces
  s = s.replace(/[-_/\s]/g, '');
  if (/^\d+$/.test(s)) {
    s = `QT${s}`;
  }
  return s.toUpperCase();
}

/**
 * Normalizes customer/company name for safe, standard filename
 * e.g., "RK & Sons" -> "RK&SONS"
 */
export function normalizeCustomerNameForFilename(customerInput) {
  if (!customerInput) return 'CUSTOMER';
  let s = String(customerInput).trim();
  // Remove Windows-invalid filename characters (\ / : * ? " < > |)
  s = s.replace(/[\\/:*?"<>|]/g, '');
  // Remove whitespace while preserving & and alphanumeric
  s = s.replace(/\s+/g, '');
  s = s.toUpperCase();
  // Strip leading/trailing punctuation
  s = s.replace(/^[-_.]+|[-_.]+$/g, '');
  return s || 'CUSTOMER';
}

/**
 * Dynamic Quotation PDF Download Filename
 * Format: ASI_<FINANCIAL_YEAR>_<QUOTATION_NUMBER_WITHOUT_HYPHEN>-<CUSTOMER_NAME>.pdf
 * Example: ASI_26-27_QT000101-RK&SONS.pdf
 */
export function getQuotationFilename(quotation) {
  if (!quotation) return 'ASI_Quotation.pdf';
  const rawDate = quotation.quotationDate || quotation.date || quotation.createdAt || new Date();
  const fy = getIndianFinancialYearShort(rawDate);
  const rawId = quotation.quotationId || quotation.quotationNumber || quotation.quoteNumber || quotation.id || 'QT-000101';
  const normId = normalizeQuotationNumberForFilename(rawId);
  const rawCustomer = quotation.customerName || quotation.customer?.name || quotation.customerCompany || quotation.customer?.company || '';
  const normCustomer = normalizeCustomerNameForFilename(rawCustomer);

  return `ASI_${fy}_${normId}-${normCustomer}.pdf`;
}

export function getPurchaseOrderFilename(purchaseOrder) {
  const rawId = purchaseOrder?.id || purchaseOrder?.purchaseOrderId || purchaseOrder?.poNumber || 'PurchaseOrder';
  const cleanId = String(rawId).replace(/[^a-zA-Z0-9-_]/g, '_');
  const prefixed = cleanId.startsWith('PO-') || cleanId.startsWith('PO_') ? cleanId : `PO-${cleanId}`;
  return `${prefixed}.pdf`;
}

export default {
  generatePdf: (elementId, filename) => {
    const el = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    return downloadPdfFromElement(el, filename);
  },
  downloadPdfFromElement,
  generateDocumentPdf,
  generateInvoicePdf,
  getDcFilename,
  getInvoiceFilename,
  getProformaFilename,
  getQuotationFilename,
  getPurchaseOrderFilename
};


