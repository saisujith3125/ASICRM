/**
 * ASICRM Theme Configuration and Document Applicator
 * Provides unified theme mappings for the 5 official themes:
 * - ASI Blue (Default)
 * - Green
 * - Modern Slate
 * - Deep Navy
 * - Teal Pro
 */

export const THEMES = [
  'ASI Blue (Default)',
  'Green',
  'Modern Slate',
  'Deep Navy',
  'Teal Pro'
];

export const DEFAULT_THEME = 'ASI Blue (Default)';

export const THEME_ID_MAP = {
  'ASI Blue (Default)': 'asi-blue',
  'Green': 'green',
  'Modern Slate': 'modern-slate',
  'Deep Navy': 'deep-navy',
  'Teal Pro': 'teal-pro'
};

/**
 * Normalizes any theme string into a canonical CSS data-theme token:
 * 'asi-blue' | 'green' | 'modern-slate' | 'deep-navy' | 'teal-pro'
 */
export function normalizeThemeId(themeName) {
  if (!themeName || typeof themeName !== 'string') return 'asi-blue';
  if (THEME_ID_MAP[themeName]) return THEME_ID_MAP[themeName];

  const lower = themeName.toLowerCase().trim();
  if (lower.includes('green')) return 'green';
  if (lower.includes('slate')) return 'modern-slate';
  if (lower.includes('navy')) return 'deep-navy';
  if (lower.includes('teal')) return 'teal-pro';
  if (lower.includes('blue')) return 'asi-blue';
  return 'asi-blue';
}

/**
 * Applies the given theme to document.documentElement and document.body
 */
export function applyThemeToDocument(themeName) {
  if (typeof document === 'undefined') return;
  const themeId = normalizeThemeId(themeName);
  
  if (document.documentElement) {
    document.documentElement.setAttribute('data-theme', themeId);
  }
  if (document.body) {
    document.body.setAttribute('data-theme', themeId);
  }
}
