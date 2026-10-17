const fs = require('fs');
const p = 'backend/data/crm-data.json';
const txt = fs.readFileSync(p, 'utf8');
const count = (txt.match(/"status":\s*"AWAITING_CUSTOMER"/g) || []).length;
const updated = txt.replace(/"status":\s*"AWAITING_CUSTOMER"/g, '"status": "PENDING"');
fs.writeFileSync(p, updated, 'utf8');
console.log(`Successfully replaced ${count} occurrences of AWAITING_CUSTOMER with PENDING in crm-data.json`);
