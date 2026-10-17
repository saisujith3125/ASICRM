const fs = require('fs');
const path = require('path');

// 1. Process documentStyles.css
const cssPath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'documents', 'documentStyles.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');
const cssLines = cssContent.split('\n');

let inQuotation = false;
let cssChanges = 0;
let quotationSkipped = 0;

const newCssLines = cssLines.map((line, idx) => {
  if (line.includes('OFFICIAL ASI QUOTATION FORMAT STYLES')) inQuotation = true;
  if (line.includes('OFFICIAL PURCHASE ORDER DOCUMENT STYLES')) inQuotation = false;

  if (inQuotation) {
    if (/font-size:\s*[\d\.]+px/.test(line)) quotationSkipped++;
    return line;
  }

  if (/font-size:\s*[\d\.]+px/.test(line)) {
    const updated = line.replace(/font-size:\s*([\d\.]+)px/g, (match, p1) => {
      const newSize = parseFloat(p1) + 2;
      return `font-size: ${newSize}px`;
    });
    if (updated !== line) cssChanges++;
    return updated;
  }
  return line;
});

fs.writeFileSync(cssPath, newCssLines.join('\n'), 'utf8');
console.log(`documentStyles.css updated: ${cssChanges} rules bumped by +2px (Quotation skipped: ${quotationSkipped})`);

// 2. Process PrintableDeliveryChallan.jsx
const dcPath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'documents', 'PrintableDeliveryChallan.jsx');
let dcContent = fs.readFileSync(dcPath, 'utf8');
dcContent = dcContent.replace(/fontSize:\s*'11px'/g, "fontSize: '13px'");
dcContent = dcContent.replace(/fontSize:\s*'10px'/g, "fontSize: '12px'");
fs.writeFileSync(dcPath, dcContent, 'utf8');
console.log('PrintableDeliveryChallan.jsx updated.');

// 3. Process PrintableSalesInvoice.jsx
const invPath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'documents', 'PrintableSalesInvoice.jsx');
let invContent = fs.readFileSync(invPath, 'utf8');
invContent = invContent.replace(/fontSize:\s*'9\.5px'/g, "fontSize: '11.5px'");
invContent = invContent.replace(/fontSize:\s*'9px'/g, "fontSize: '11px'");
fs.writeFileSync(invPath, invContent, 'utf8');
console.log('PrintableSalesInvoice.jsx updated.');

// 4. Process PrintableProformaInvoice.jsx
const piPath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'documents', 'PrintableProformaInvoice.jsx');
let piContent = fs.readFileSync(piPath, 'utf8');
piContent = piContent.replace(/fontSize:\s*'10\.5px'/g, "fontSize: '12.5px'");
piContent = piContent.replace(/fontSize:\s*'9px'/g, "fontSize: '11px'");
piContent = piContent.replace(/fontSize:\s*'11\.5px'/g, "fontSize: '13.5px'");
piContent = piContent.replace(/fontSize:\s*'13\.5px'/g, "fontSize: '15.5px'");
piContent = piContent.replace(/fontSize:\s*'12px'/g, "fontSize: '14px'");
piContent = piContent.replace(/fontSize:\s*'10px'/g, "fontSize: '12px'");
piContent = piContent.replace(/fontSize:\s*'9\.5px'/g, "fontSize: '11.5px'");
fs.writeFileSync(piPath, piContent, 'utf8');
console.log('PrintableProformaInvoice.jsx updated.');

// 5. Process PrintablePurchaseOrder.jsx
const poPath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'documents', 'PrintablePurchaseOrder.jsx');
let poContent = fs.readFileSync(poPath, 'utf8');
poContent = poContent.replace(/fontSize:\s*'8\.5px'/g, "fontSize: '10.5px'");
fs.writeFileSync(poPath, poContent, 'utf8');
console.log('PrintablePurchaseOrder.jsx updated.');
