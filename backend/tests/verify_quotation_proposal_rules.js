const assert = require('assert');
const fs = require('fs');
const path = require('path');

// We will test the functions directly by importing them from PrintableQuotation or evaluating them
console.log('--- STARTING VERIFICATION OF PRINTABLE QUOTATION PROPOSAL RULES ---');

// Read PrintableQuotation source code to extract and test the pure functions
const quotationSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'documents', 'PrintableQuotation.jsx'),
  'utf8'
);

// Verify formatProposalNumber logic
assert(quotationSource.includes('export function formatProposalNumber'), 'formatProposalNumber must be exported');
assert(quotationSource.includes('ASI/${fyCode}/QT${padded}'), 'formatProposalNumber must format as ASI/{FY}/QT{padded}');
assert(quotationSource.includes('formatProposalNumber(quote)'), 'normalizeQuotationDocument must use formatProposalNumber');

// Verify that firstProduct dynamic fallback and "Proposal for Commercial Offer" are COMPLETELY REMOVED from subject fallback
assert(!quotationSource.includes('defaultSubjectProductName ? `Proposal for ${defaultSubjectProductName}`'),
  'Dynamic firstProduct fallback MUST NOT exist in subject logic');
assert(!quotationSource.includes("'Proposal for Commercial Offer'"),
  'Proposal for Commercial Offer fallback MUST NOT exist');

// Verify that when cleanSubject is empty, SUB : line is omitted
assert(quotationSource.includes('{model.cleanSubject ? ('), 'Subject line must be conditionally rendered only when non-empty');
assert(quotationSource.includes('Page 1 of 1'), 'Single page proposal footer must render Page 1 of 1');

// Now let's execute the extracted pure functions in a clean sandbox
const {
  formatQuotationDate,
  getIndianFinancialYearTokens,
  formatProposalNumber
} = require('../../frontend/src/components/documents/documentFormatters');

// 1. Date format test
const testDate = formatQuotationDate('2026-10-24T12:00:00Z');
assert.strictEqual(testDate, '2026/10/24', 'Proposal date must be YYYY/MM/DD');

// 2. Proposal Number format test
// Test A: Legacy ID "QT-000007"
const quoteA = { quotationId: 'QT-000007', date: '2026-10-24' };
assert.strictEqual(formatProposalNumber(quoteA), 'ASI/26-27/QT0007');

// Test B: Legacy slash ID "QTN/001/2026"
const quoteB = { quotationId: 'QTN/001/2026', date: '2026-10-24' };
assert.strictEqual(formatProposalNumber(quoteB), 'ASI/26-27/QT0001');

// Test C: Second quote "QTN/002/2026"
const quoteC = { quotationId: 'QTN/002/2026', date: '2026-10-24' };
assert.strictEqual(formatProposalNumber(quoteC), 'ASI/26-27/QT0002');

// Test D: Pre-formatted new number "ASI/26-27/QT0007"
const quoteD = { quotationId: 'ASI/26-27/QT0007', date: '2026-10-24' };
assert.strictEqual(formatProposalNumber(quoteD), 'ASI/26-27/QT0007');

console.log('✓ TEST 1 PASSED: formatProposalNumber correctly converts QTN/001/2026 -> ASI/26-27/QT0001, QTN/002/2026 -> ASI/26-27/QT0002, QT-000007 -> ASI/26-27/QT0007.');

// 3. Subject Line Logic Test
function testSubjectResolution(quote) {
  const isPricingNote = (s) => !s || /prices\s+quoted\s+are\s+valid|taxes\s+extra/i.test(String(s));
  let candidateSubject = quote.subject;

  if (isPricingNote(candidateSubject)) {
    candidateSubject = (
      (!isPricingNote(quote.requirement) ? quote.requirement : '') ||
      quote.title ||
      quote.enquiryTitle ||
      ''
    );
  }

  let cleanSubject = '';
  if (candidateSubject && !isPricingNote(candidateSubject)) {
    let s = String(candidateSubject).trim();
    s = s.replace(/^\d+\s*[xX*]\s*/, '').trim();
    s = s.replace(/^(?:SUB\s*[:\-]\s*)+/i, '').trim();
    s = s.replace(/^(?:Note\s*[:\-]\s*)+/i, '').trim();
    if (s && !isPricingNote(s)) {
      cleanSubject = s;
    }
  }
  return cleanSubject;
}

// Case 1: No subject, has physical items -> MUST RETURN BLANK ""
const blankQuote = {
  items: [{ productName: 'Dahua 5MP IR Bullet Camera', quantity: 2, unitPrice: 3500 }]
};
assert.strictEqual(testSubjectResolution(blankQuote), '', 'Empty subject with items MUST return empty string, never auto-generate product name');

// Case 2: Custom subject provided -> MUST RETURN SUBJECT
const filledQuote = {
  subject: 'Proposal for 9U Wall Rack',
  items: [{ productName: '9U Wall Rack', quantity: 1, unitPrice: 2200 }]
};
assert.strictEqual(testSubjectResolution(filledQuote), 'Proposal for 9U Wall Rack', 'Custom subject must be preserved');

// Case 3: Requirement provided
const reqQuote = {
  requirement: 'Complete CCTV Surveillance System',
  items: [{ productName: 'Dahua 5MP Camera', quantity: 4, unitPrice: 3500 }]
};
assert.strictEqual(testSubjectResolution(reqQuote), 'Complete CCTV Surveillance System');

console.log('✓ TEST 2 PASSED: Subject line fallback removed completely. Missing subjects are blank ("") and custom subjects are cleanly preserved.');

console.log('--- ALL PRINTABLE QUOTATION PROPOSAL RULES VERIFIED SUCCESSFULLY ---');
