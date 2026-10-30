const fs = require('fs');
const path = require('path');

const hooks = ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useId', 'useReducer'];

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (f.endsWith('.jsx') || f.endsWith('.js')) {
      callback(fullPath);
    }
  }
}

const missingHookUsages = [];

walkDir(path.resolve(__dirname, '../../frontend/src'), (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const reactImportMatch = content.match(/import\s+([\s\S]*?)\s+from\s+['"]react['"]/);
  const reactImports = reactImportMatch ? reactImportMatch[1] : '';

  hooks.forEach((hook) => {
    // Look for hook calls that are NOT prefixed with "React."
    const regex = new RegExp(`(?<!React\\.)\\b${hook}\\s*\\(`, 'g');
    if (regex.test(content)) {
      if (!reactImports.includes(hook)) {
        missingHookUsages.push({ file: path.relative(path.resolve(__dirname, '../../frontend'), filePath), hook });
      }
    }
  });
});

console.log('AUDIT RESULT - MISSING HOOK USAGES:');
console.log(JSON.stringify(missingHookUsages, null, 2));
