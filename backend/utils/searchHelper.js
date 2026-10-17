/**
 * ASICRM Canonical Search & Filter Helper (CommonJS for Backend)
 */

function normalizeSearchText(text) {
  if (text === null || text === undefined) return '';
  return String(text).trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractSearchableStrings(record, extractors = []) {
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

function recordMatchesSearch(record, query, extractors = []) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  if (!record) return false;

  const searchableValues = extractSearchableStrings(record, extractors);
  if (searchableValues.length === 0) return false;

  const combinedText = searchableValues.join(' ');
  if (combinedText.includes(normalizedQuery)) {
    return true;
  }

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (tokens.length <= 1) return false;

  return tokens.every((token) => combinedText.includes(token));
}

function filterRecordsBySearch(records, query, extractors = []) {
  if (!Array.isArray(records)) return [];
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return records;

  return records.filter((r) => recordMatchesSearch(r, normalizedQuery, extractors));
}

module.exports = {
  normalizeSearchText,
  extractSearchableStrings,
  recordMatchesSearch,
  filterRecordsBySearch
};
