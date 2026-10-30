const fs = require('fs');
const path = require('path');
const { ESLint } = require('../../frontend/node_modules/eslint');

async function checkNoUndef() {
  const browserGlobals = {
    window: 'readonly',
    document: 'readonly',
    console: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    fetch: 'readonly',
    localStorage: 'readonly',
    sessionStorage: 'readonly',
    navigator: 'readonly',
    location: 'readonly',
    history: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    Blob: 'readonly',
    FileReader: 'readonly',
    FormData: 'readonly',
    Headers: 'readonly',
    HTMLElement: 'readonly',
    CustomEvent: 'readonly',
    Event: 'readonly',
    ResizeObserver: 'readonly',
    requestAnimationFrame: 'readonly',
    cancelAnimationFrame: 'readonly',
    alert: 'readonly',
    confirm: 'readonly',
    prompt: 'readonly',
    screen: 'readonly',
    process: 'readonly'
  };

  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
          parserOptions: { ecmaFeatures: { jsx: true } },
          globals: browserGlobals
        },
        rules: {
          'no-undef': 'error'
        }
      }
    ]
  });

  console.log('Running ESLint no-undef rule check across frontend/src...');
  const results = await eslint.lintFiles(['frontend/src/**/*.{js,jsx}']);
  
  let totalErrors = 0;
  const errorFiles = [];

  for (const r of results) {
    const undefMessages = r.messages.filter(m => m.ruleId === 'no-undef');
    if (undefMessages.length > 0) {
      totalErrors += undefMessages.length;
      errorFiles.push({
        filePath: path.relative(path.resolve(__dirname, '../../'), r.filePath),
        errors: undefMessages.map(m => `Line ${m.line}:${m.column} - ${m.message}`)
      });
    }
  }

  if (totalErrors > 0) {
    console.error(`FAILED: Found ${totalErrors} no-undef errors in ${errorFiles.length} files:`);
    console.error(JSON.stringify(errorFiles, null, 2));
    process.exit(1);
  } else {
    console.log(`SUCCESS: 0 no-undef errors found across ${results.length} frontend files! Everything is cleanly declared and defined!`);
  }
}

checkNoUndef().catch(err => {
  console.error('Error running check:', err);
  process.exit(1);
});
