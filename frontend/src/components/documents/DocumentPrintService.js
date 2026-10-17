/**
 * DocumentPrintService
 * Reliable document printing via an isolated sandbox iframe.
 * Guarantees 0% CRM shell, sidebar, header, buttons or modal backdrop leakage.
 */

export async function printDocumentElement(sourceElement, documentTitle = 'Document') {
  if (!sourceElement) {
    throw new Error('No printable document element provided.');
  }

  // 1. Create a hidden sandbox iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'doc-sandbox-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;

  // 2. Extract existing stylesheets and fonts
  const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n');

  const isPaged = Boolean(
    sourceElement.querySelector?.('.doc-quotation-root, .doc-paged-root, .doc-quotation-page, .doc-paged-page') ||
    sourceElement.classList?.contains('doc-quotation-root') ||
    sourceElement.classList?.contains('doc-paged-root') ||
    sourceElement.querySelector?.('.doc-quotation-page') ||
    sourceElement.classList?.contains('doc-quotation-page') ||
    sourceElement.querySelector?.('.doc-paged-page') ||
    sourceElement.classList?.contains('doc-paged-page') ||
    documentTitle?.toLowerCase().includes('quotation')
  );

  // 3. Write isolated document structure with A4 rules
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${documentTitle}</title>
        ${styleTags}
        <style>
          @page {
            size: A4 portrait;
            margin: ${isPaged ? '0mm !important' : '8mm 8mm 8mm 8mm'};
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            width: 100% !important;
          }
          #print-mount-point {
            width: 100% !important;
            max-width: ${isPaged ? '210mm !important' : '194mm'};
            margin: 0 auto !important;
            padding: 0 !important;
          }
        </style>
      </head>
      <body>
        <div id="print-mount-point"></div>
      </body>
    </html>
  `);
  doc.close();

  // 4. Clone and mount the document (target document root to avoid nested wrapper margins)
  const mount = doc.getElementById('print-mount-point');
  const targetElement = sourceElement.querySelector?.('.doc-sheet-root') || sourceElement;
  const clone = targetElement.cloneNode(true);
  // Strip any viewer UI elements or inter-page gaps from print clone
  clone.querySelectorAll('.quotation-viewer-page-gap, .doc-viewer-page-gap, .doc-preview-action-bar, .doc-preview-buttons, .quotation-page-badge').forEach((el) => el.remove());
  mount.appendChild(clone);

  // 4.1 Copy canvas bitmap data (critical for QR codes and charts in iframe print)
  try {
    const srcCanvases = sourceElement.querySelectorAll('canvas');
    const destCanvases = clone.querySelectorAll('canvas');
    srcCanvases.forEach((srcCanvas, i) => {
      const destCanvas = destCanvases[i];
      if (destCanvas && srcCanvas.width && srcCanvas.height) {
        destCanvas.width = srcCanvas.width;
        destCanvas.height = srcCanvas.height;
        const destCtx = destCanvas.getContext('2d');
        if (destCtx) {
          destCtx.drawImage(srcCanvas, 0, 0);
        }
      }
    });
  } catch (canvasErr) {
    console.warn('Could not copy canvas buffer to print iframe:', canvasErr);
  }

  // 5. Ensure fonts and images are ready
  await Promise.all([
    doc.fonts ? doc.fonts.ready : Promise.resolve(),
    new Promise((resolve) => {
      const images = Array.from(doc.images);
      if (images.length === 0) return resolve();
      let loaded = 0;
      images.forEach((img) => {
        if (img.complete) {
          loaded++;
          if (loaded >= images.length) resolve();
        } else {
          img.onload = img.onerror = () => {
            loaded++;
            if (loaded >= images.length) resolve();
          };
        }
      });
    }),
    new Promise((r) => setTimeout(r, 250))
  ]);

  // 6. Verify non-zero dimensions
  const rect = clone.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    try { document.body.removeChild(iframe); } catch (_) {}
    throw new Error('Printable document rendered with zero dimensions.');
  }

  // 7. Trigger browser print
  try {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } finally {
    setTimeout(() => {
      try {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      } catch (_) {}
    }, 1500);
  }
}

export default {
  printElement: (elementId, title) => {
    const el = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    return printDocumentElement(el, title);
  },
  printDocumentElement
};

