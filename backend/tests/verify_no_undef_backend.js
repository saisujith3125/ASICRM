const fs = require('fs');
const path = require('path');
const { ESLint } = require('../../frontend/node_modules/eslint');

async function checkNoUndefBackend() {
  const nodeGlobals = {
    console: 'readonly',
    process: 'readonly',
    require: 'readonly',
    module: 'readonly',
    exports: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    setImmediate: 'readonly',
    clearImmediate: 'readonly',
    Buffer: 'readonly',
    Promise: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly'
  };

  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.js'],
        languageOptions: {
          parserOptions: { ecmaVersion: 2022, sourceType: 'commonjs' },
          globals: nodeGlobals
        },
        rules: {
          'no-undef': 'error'
        }
      }
    ]
  });

  console.log('Running ESLint no-undef rule check across backend controllers, routes, models, services, utils...');
  const filesToLint = [
    'backend/controllers/**/*.js',
    'backend/routes/**/*.js',
    'backend/models/**/*.js',
    'backend/services/**/*.js',
    'backend/utils/**/*.js'
  ];

  const results = await eslint.lintFiles(filesToLint);

  let totalErrors = 0;
  const errorFiles = [];

  for (const res of results) {
    const undefMessages = res.messages.filter((m) => m.ruleId === 'no-undef');
    if (undefMessages.length > 0) {
      totalErrors += undefMessages.length;
      errorFiles.push({
        filePath: res.filePath,
        errors: undefMessages.map((m) => `Line ${m.line}:${m.column} - ${m.message}`)
      });
    }
  }

  if (totalErrors > 0) {
    console.error(`\nFAILED: Found ${totalErrors} no-undef errors in backend files:`);
    errorFiles.forEach((f) => {
      console.error(`\nFile: ${path.relative(process.cwd(), f.filePath)}`);
      f.errors.forEach((e) => console.error(`  ${e}`));
    });
    process.exit(1);
  } else {
    console.log(`\nSUCCESS: 0 no-undef errors found across backend! Everything is cleanly declared and defined!`);
  }
}

checkNoUndefBackend().catch((err) => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
