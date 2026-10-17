const fs = require('fs');
const buf = fs.readFileSync('scratch/asi_watermark_transparent.png');
const b64 = buf.toString('base64');
const content = `export const ASI_WATERMARK_LOGO = "data:image/png;base64,${b64}";\n`;
fs.writeFileSync('frontend/src/assets/asi_watermark_default.js', content);
console.log('Successfully wrote frontend/src/assets/asi_watermark_default.js, length:', content.length);
