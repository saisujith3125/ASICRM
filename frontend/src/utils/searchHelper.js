/**
 * ASICRM Canonical Search & Filter Helper
 *
 * Provides standardized, high-performance, case-insensitive, token-aware
 * substring search across meaningful business fields.
 */

/**
 * Normalizes input search text:
 * - Trims leading and trailing whitespace
 * - Converts to lowercase
 * - Collapses multiple spaces into a single space
 *
 * @param {any} text
 * @returns {string}
 */
export function normalizeSearchText(text) {
  if (text === null || text === undefined) return '';
  return String(text).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Extracts all searchable values from a record given an array of field extractors.
 * Flatten arrays and safely stringify values.
 *
 * @param {Object} record
 * @param {Array<Function|string>} extractors
 * @returns {string[]}
 */
export function extractSearchableStrings(record, extractors = []) {
  if (!record || typeof record !== 'object') return [];

  const values = [];

  for (const extractor of extractors) {
    let val;
    if (typeof extractor === 'function') {
      try {
        val = extractor(record);
      } catch (_) {
        val = null;
      }
    } else if (typeof extractor === 'string') {
      val = record[extractor];
    }

    if (val === null || val === undefined) continue;

    if (Array.isArray(val)) {
      for (const item of val) {
        if (item === null || item === undefined) continue;
        if (typeof item === 'object') {
          // If item is object, extract standard label/name properties
          const inner = item.productName || item.name || item.code || item.productCode || item.sku || item.description || item.serialNumber || '';
          if (inner) values.push(normalizeSearchText(inner));
        } else {
          values.push(normalizeSearchText(item));
        }
      }
    } else {
      values.push(normalizeSearchText(val));
    }
  }

  return values;
}

/**
 * Checks if a record matches a search query across the given field extractors.
 *
 * Rules:
 * 1. Empty or whitespace-only query matches all records.
 * 2. Case-insensitive substring matching.
 * 3. Multi-word token support: each word in the query must match at least one extracted field
 *    (or the full untokenized phrase must appear in a field).
 *
 * @param {Object} record
 * @param {string} query
 * @param {Array<Function|string>} extractors
 * @returns {boolean}
 */
export function recordMatchesSearch(record, query, extractors = []) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  if (!record) return false;

  const searchableValues = extractSearchableStrings(record, extractors);
  if (searchableValues.length === 0) return false;

  // Single combined string for fast full-phrase matching
  const combinedText = searchableValues.join(' ');

  // Direct full-phrase substring match
  if (combinedText.includes(normalizedQuery)) {
    return true;
  }

  // Token-based match: all tokens must be present somewhere in searchable fields
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (tokens.length <= 1) {
    // Already checked single token above
    return false;
  }

  return tokens.every((token) => combinedText.includes(token));
}

/**
 * Filters an array of records by a search query using the provided field extractors.
 * Preserves original record ordering and returns a new filtered array.
 *
 * @param {Array} records
 * @param {string} query
 * @param {Array<Function|string>} extractors
 * @returns {Array}
 */
export function filterRecordsBySearch(records, query, extractors = []) {
  if (!Array.isArray(records)) return [];
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return records;

  return records.filter((r) => recordMatchesSearch(r, normalizedQuery, extractors));
}

export default {
  normalizeSearchText,
  extractSearchableStrings,
  recordMatchesSearch,
  filterRecordsBySearch
};
