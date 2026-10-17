const fs = require('fs');
const path = require('path');

const logoJs = fs.readFileSync(path.join(__dirname, '../../frontend/src/assets/asi_logo_default.js'), 'utf8');
const b64 = logoJs.split('base64,')[1].split('"')[0].trim();
const buf = Buffer.from(b64, 'base64');

const w = buf.readUInt32BE(16);
const h = buf.readUInt32BE(20);
console.log('asi_logo_default.js PNG Dimensions:');
console.log('Width:', w, 'Height:', h, 'Aspect Ratio (w/h):', (w / h).toFixed(3));

// Also check dist/assets/asi_official_logo if exists
const assetFiles = fs.readdirSync(path.join(__dirname, '../../frontend/src/assets'));
console.log('Asset files in frontend/src/assets:', assetFiles);

// Write the image out to inspect
fs.writeFileSync(path.join(__dirname, '../../test_logo_extracted.png'), buf);
console.log('Extracted logo written to test_logo_extracted.png');
