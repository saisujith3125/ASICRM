// Currency, date, and numbers formatting helpers for printable documents
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatDocumentDate,
  formatCustomDate,
  formatProposalDate as utilsFormatProposalDate,
  formatDocDate as utilsFormatDocDate
} from '../../utils/dateUtils.js';
export { formatDate, formatDateTime, formatTime, formatDocumentDate, formatCustomDate };

export function formatINR(amount) {
  const val = Number(amount || 0);
  return '₹' + val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatPlainNumber(amount) {
  const val = Number(amount || 0);
  return val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Standard DD/MM/YYYY format matching physical ASI documents (e.g. 29/08/2026)
 * Configurable via Master Settings > Date Format Setup
 */
export function formatDocDate(d, moduleKey = 'invoices') {
  if (!d || d === '—' || d === '-') return '';
  return formatDocumentDate(d, moduleKey, '');
}

/**
 * Format proposal date to YYYY/MM/DD (e.g. 2026/10/24) matching official proposal reference
 * Configurable via Master Settings > Date Format Setup
 */
export function formatProposalDate(d) {
  if (!d || d === '—' || d === '-') return '';
  return utilsFormatProposalDate(d, '');
}

export const formatQuotationDate = formatProposalDate;

/**
 * Format Indian financial year tokens (April 1 to March 31)
 */
export function getIndianFinancialYearTokens(rawDate = new Date()) {
  try {
    let year = null;
    let month = null;

    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      year = rawDate.getFullYear();
      month = rawDate.getMonth() + 1;
    } else if (typeof rawDate === 'string') {
      const trimmed = rawDate.trim();
      const isoMatch = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (isoMatch) {
        year = parseInt(isoMatch[1], 10);
        month = parseInt(isoMatch[2], 10);
      } else {
        const ddmmyyyy = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (ddmmyyyy) {
          month = parseInt(ddmmyyyy[2], 10);
          year = parseInt(ddmmyyyy[3], 10);
        } else {
          const dt = new Date(trimmed);
          if (!isNaN(dt.getTime())) {
            year = dt.getFullYear();
            month = dt.getMonth() + 1;
          }
        }
      }
    }

    if (!year || !month) {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const startYear = month >= 4 ? year : year - 1;
    const endYear = startYear + 1;
    const shortFY = `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
    const longFY = `${startYear}-${endYear}`;
    const midFY = `${startYear}-${String(endYear).slice(-2)}`;
    return { shortFY, longFY, midFY, startYear, endYear };
  } catch (_) {
    return { shortFY: '26-27', longFY: '2026-2027', midFY: '2026-27', startYear: 2026, endYear: 2027 };
  }
}

/**
 * Format customer-facing proposal number: ASI/{FINANCIAL_YEAR}/QT{SEQUENCE}
 * Examples: ASI/26-27/QT0001, ASI/26-27/QT0002, ASI/26-27/QT0007
 */
export function formatProposalNumber(quote = {}) {
  if (typeof quote === 'string') {
    quote = { quotationId: quote };
  }
  if (quote.proposalNumber && String(quote.proposalNumber).trim()) {
    return String(quote.proposalNumber).trim();
  }
  if (quote.proposalNo && String(quote.proposalNo).trim()) {
    return String(quote.proposalNo).trim();
  }

  const raw = String(
    quote.quotationNumber ||
    quote.quotationId ||
    quote.quoteNumber ||
    quote.id ||
    ''
  ).trim();

  if (!raw) return 'ASI/26-27/QT0001';

  if (/^ASI\/\d{2}-\d{2}\/QT\d+/i.test(raw)) {
    return raw;
  }

  const rawDate = quote.createdAt || quote.quotationDate || quote.date || new Date();
  const fyTokens = getIndianFinancialYearTokens(rawDate);
  const fyCode = fyTokens.shortFY;

  let seqNumber = null;
  const matchSlash = raw.match(/QTN\/0*(\d+)/i);
  if (matchSlash) {
    seqNumber = parseInt(matchSlash[1], 10);
  } else {
    const matchDash = raw.match(/QT-?0*(\d+)/i);
    if (matchDash) {
      seqNumber = parseInt(matchDash[1], 10);
    } else {
      const matchAny = raw.match(/\d+/);
      if (matchAny) {
        seqNumber = parseInt(matchAny[0], 10);
      }
    }
  }

  if (seqNumber !== null && !isNaN(seqNumber)) {
    const padded = String(seqNumber).padStart(4, '0');
    return `ASI/${fyCode}/QT${padded}`;
  }

  return raw;
}

/**
 * Converts numbers into words following Indian numbering system (Lakh, Crore)
 * with accurate handling of Rupees and Paise.
 */
export function amountInWords(num, prefix = '') {
  if (num === undefined || num === null || isNaN(Number(num))) {
    return (prefix ? prefix + ' ' : '') + 'Zero Rupees Only';
  }

  const raw = Number(num);
  if (raw === 0) return (prefix ? prefix + ' ' : '') + 'Zero Rupees Only';

  const isNegative = raw < 0;
  const absVal = Math.abs(raw);
  const rupees = Math.floor(absVal);
  const paise = Math.round((absVal - rupees) * 100);

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n) {
    if (n < 20) return a[n];
    const tens = b[Math.floor(n / 10)];
    const ones = a[n % 10];
    return tens + (ones ? ' ' + ones : '');
  }

  function convertThreeDigits(n) {
    if (n === 0) return '';
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = '';
    if (hundred > 0) {
      res += a[hundred] + ' Hundred';
      if (rest > 0) res += ' and ';
    }
    if (rest > 0) {
      res += convertTwoDigits(rest);
    }
    return res;
  }

  function convertNumberToWords(val) {
    if (val === 0) return '';
    const crore = Math.floor(val / 10000000);
    let remainder = val % 10000000;
    const lakh = Math.floor(remainder / 100000);
    remainder = remainder % 100000;
    const thousand = Math.floor(remainder / 1000);
    remainder = remainder % 1000;
    const hundred = remainder;

    const words = [];
    if (crore > 0) words.push(convertThreeDigits(crore) + ' Crore');
    if (lakh > 0) words.push(convertTwoDigits(lakh) + ' Lakh');
    if (thousand > 0) words.push(convertTwoDigits(thousand) + ' Thousand');
    if (hundred > 0) words.push(convertThreeDigits(hundred));

    return words.join(' ').replace(/\s+/g, ' ').trim();
  }

  let rupeeWords = rupees > 0 ? convertNumberToWords(rupees) + ' Rupees' : '';
  let paiseWords = paise > 0 ? convertTwoDigits(paise) + ' Paise' : '';

  let finalWords = '';
  if (rupeeWords && paiseWords) {
    finalWords = `${rupeeWords} and ${paiseWords} Only`;
  } else if (rupeeWords) {
    finalWords = `${rupeeWords} Only`;
  } else if (paiseWords) {
    finalWords = `${paiseWords} Only`;
  } else {
    finalWords = 'Zero Rupees Only';
  }

  if (isNegative) {
    finalWords = 'Minus ' + finalWords;
  }

  return prefix ? `${prefix} ${finalWords}` : finalWords;
}

export function formatTaxRate(rate) {
  return Number(rate || 0).toFixed(2);
}

/**
 * Normalizes a party or contact string for semantic comparison:
 * - Trims whitespace
 * - Converts to lower-case
 * - Strips common punctuation/noise like separators, bullets, brackets
 */
export function cleanSemanticString(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[—\-_/\\|,;:()[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits a composite string into individual semantic parts/tokens,
 * preserving original trimmed strings for each part.
 * E.g. "RK & Sons — Gomathi" -> ["RK & Sons", "Gomathi"]
 * "RK & Sons (Gomathi)" -> ["RK & Sons", "Gomathi"]
 * "RK & Sons - Gomathi" -> ["RK & Sons", "Gomathi"]
 */
export function extractSemanticParts(str) {
  if (!str) return [];
  return String(str)
    .replace(/\(([^)]+)\)/g, (m, g1) => ` — ${g1} — `)
    .split(/[—–\-|/\\,;:]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Compares two semantic values to check if they represent the same entity or contact.
 */
export function isSemanticMatch(a, b) {
  const cleanA = cleanSemanticString(a);
  const cleanB = cleanSemanticString(b);
  if (!cleanA || !cleanB) return false;
  return cleanA === cleanB;
}

/**
 * Shared party display line normalizer.
 * Given a primary display string and a secondary display string,
 * prevents redundant repetition while preserving distinct information
 * and neatly separating composite strings (e.g. "Name — Company") into
 * structured Line 1 (Name) and Line 2 (Company).
 */
export function normalizePartyLines(primary, secondary) {
  const p = (primary || '').trim();
  const s = (secondary || '').trim();

  if (!p && !s) {
    return { primaryLine: '', secondaryLine: null, isDuplicate: false };
  }
  if (!p) {
    return { primaryLine: s, secondaryLine: null, isDuplicate: false };
  }
  if (!s) {
    const pParts = extractSemanticParts(p);
    if (pParts.length >= 2) {
      return {
        primaryLine: pParts[0],
        secondaryLine: pParts.slice(1).join(' — '),
        isDuplicate: false
      };
    }
    return { primaryLine: p, secondaryLine: null, isDuplicate: false };
  }

  const cleanP = cleanSemanticString(p);
  const cleanS = cleanSemanticString(s);

  // Exact semantic match -> single line, no duplicate
  if (cleanP === cleanS) {
    return { primaryLine: p, secondaryLine: null, isDuplicate: true };
  }

  const pParts = extractSemanticParts(p);
  const sParts = extractSemanticParts(s);

  // If primary is composite (e.g. "Mr. Narayanan — Next Tech company" and secondary is "Next Tech company")
  if (pParts.length >= 2) {
    const matchIdx = pParts.findIndex((part) => {
      const cleanPp = cleanSemanticString(part);
      return cleanPp === cleanS || cleanPp.includes(cleanS) || cleanS.includes(cleanPp);
    });
    if (matchIdx !== -1) {
      const otherParts = pParts.filter((_, idx) => idx !== matchIdx);
      return {
        primaryLine: otherParts.join(' — '),
        secondaryLine: s || pParts[matchIdx],
        isDuplicate: false
      };
    }
  }

  // If secondary is composite (e.g. p is "Narayanan" and s is "Narayanan — Next Tech company")
  if (sParts.length >= 2) {
    const matchIdx = sParts.findIndex((part) => {
      const cleanSp = cleanSemanticString(part);
      return cleanSp === cleanP || cleanSp.includes(cleanP) || cleanP.includes(cleanSp);
    });
    if (matchIdx !== -1) {
      const otherParts = sParts.filter((_, idx) => idx !== matchIdx);
      return {
        primaryLine: p || sParts[matchIdx],
        secondaryLine: otherParts.join(' — '),
        isDuplicate: false
      };
    }
  }

  // If primary contains secondary as substring
  if (cleanP.includes(cleanS) && p.length > s.length) {
    const stripped = p.replace(new RegExp(s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'gi'), '')
      .replace(/^[—–\-|/\\,;:\s]+|[—–\-|/\\,;:\s]+$/g, '')
      .trim();
    if (stripped) {
      return {
        primaryLine: stripped,
        secondaryLine: s,
        isDuplicate: false
      };
    }
  }

  // If secondary contains primary as substring
  if (cleanS.includes(cleanP) && s.length > p.length) {
    const stripped = s.replace(new RegExp(p.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'gi'), '')
      .replace(/^[—–\-|/\\,;:\s]+|[—–\-|/\\,;:\s]+$/g, '')
      .trim();
    if (stripped) {
      return {
        primaryLine: p,
        secondaryLine: stripped,
        isDuplicate: false
      };
    }
  }

  // Default: two distinct lines
  return {
    primaryLine: p,
    secondaryLine: s,
    isDuplicate: false
  };
}

/**
 * Normalizes full party view-model for document templates.
 */
export function normalizePartyViewModel({
  name,
  company,
  contactPerson,
  receiverName,
  address,
  city,
  state,
  pincode,
  gstin,
  phone,
  email
} = {}) {
  const rawPrimary = (name || company || receiverName || '').trim();
  const rawSecondary = (
    (company && company !== rawPrimary ? company : '') ||
    (contactPerson && contactPerson !== rawPrimary ? contactPerson : '') ||
    (receiverName && receiverName !== rawPrimary ? receiverName : '')
  ).trim();

  const { primaryLine, secondaryLine, isDuplicate } = normalizePartyLines(rawPrimary, rawSecondary);

  return {
    primaryLine,
    secondaryLine,
    displayName: primaryLine,
    company: secondaryLine || null,
    address: (address || '').trim(),
    city: (city || '').trim(),
    state: (state || '').trim(),
    pincode: (pincode || '').trim(),
    gstin: (gstin || '').trim(),
    phone: (phone || '').trim(),
    email: (email || '').trim(),
    isDuplicate
  };
}

/**
 * Normalizes party address lines for invoices, proformas, quotations, and DCs.
 * Ensures:
 * 1. Zero duplicate city lines (e.g. "Vanagaram, Chennai - 600095" followed by another "Chennai").
 * 2. "Vanagaram, Chennai - 600095" is preserved cleanly as one line both on screen and in print.
 * 3. Fallbacks to city/pincode/state only if not already present in the address text.
 */
export function formatPartyAddressLines({ address = '', city = '', state = '', pincode = '' } = {}) {
  let addr = String(address || '').trim();
  let c = String(city || '').trim();
  let st = String(state || '').trim();
  let pin = String(pincode || '').trim();

  // If city contains comma e.g. "Chennai, Tamil Nadu"
  if (c.includes(',')) {
    const parts = c.split(',').map((p) => p.trim());
    c = parts[0] || '';
    if (!st && parts[1]) st = parts[1];
  }

  let lines = [];
  if (addr.includes('\n')) {
    lines = addr.split(/[\r\n]+/).map((s) => s.trim().replace(/,+$/, ',')).filter(Boolean);
  } else if (addr) {
    if (/vanagaram/i.test(addr)) {
      const match = addr.match(/^(.*?(?:sivabootham|street|road|nagar|lane|[a-zA-Z0-9]),?\s*)(vanagaram.*)$/i);
      if (match) {
        const l1 = match[1].trim().replace(/,*$/, ',');
        let l2 = match[2].trim();
        if (!l2.toLowerCase().includes('chennai') && c) {
          l2 = l2.replace(/,*$/, ',') + ' ' + c + (pin ? ` - ${pin}` : '');
        }
        lines.push(l1);
        lines.push(l2);
      } else {
        lines.push(addr);
      }
    } else {
      lines.push(addr);
    }
  }

  // Check if any existing line already mentions the city or pincode
  const hasCityInLines = lines.some((l) => c && l.toLowerCase().includes(c.toLowerCase()));
  const hasPinInLines = lines.some((l) => pin && l.includes(pin));

  // If city is not already represented in the address lines, append city + pincode
  if (!hasCityInLines && c) {
    lines.push(c + (pin ? ` - ${pin}` : ''));
  } else if (!hasPinInLines && pin) {
    const lastIdx = lines.length - 1;
    if (lastIdx >= 0 && !lines[lastIdx].includes(pin)) {
      lines[lastIdx] = lines[lastIdx].replace(/,*$/, '') + ` - ${pin}`;
    }
  }

  // State line
  const hasStateInLines = lines.some((l) => st && l.toLowerCase().includes(st.toLowerCase()));
  if (st && !hasStateInLines) {
    lines.push(st);
  }

  return lines;
}

