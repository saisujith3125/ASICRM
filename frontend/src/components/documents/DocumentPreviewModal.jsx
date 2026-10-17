import React, { useRef, useState, useEffect } from 'react';
import { printDocumentElement } from './DocumentPrintService';
import { downloadPdfFromElement, generateInvoicePdf } from './DocumentPdfService';
import './documentStyles.css';

export default function DocumentPreviewModal({
  title = 'Document',
  docId = '',
  docType = 'dc', // 'dc' | 'inv' | 'pi' | 'quotation'
  status = '',
  filename = 'Document.pdf',
  data = null,
  onDownloadPdfOption = null,
  onClose,
  children
}) {
  const paperRef = useRef(null);
  const dropdownRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingSigned, setDownloadingSigned] = useState(false);
  const [downloadingUnsigned, setDownloadingUnsigned] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 1 });

  const isInvoice = docType === 'inv' || docType === 'invoice';

  // Dynamic In-App Viewer Page Count & Scroll Tracking (Viewer UI Only)
  useEffect(() => {
    const paperEl = paperRef.current;
    if (!paperEl) return;

    const updatePages = () => {
      const quotationPages = paperEl.querySelectorAll('.doc-quotation-page');
      let total = quotationPages.length;
      if (!total) {
        const sheetPages = paperEl.querySelectorAll('.doc-sheet-page');
        total = sheetPages.length;
      }
      if (!total) {
        const legacyPages = paperEl.querySelectorAll('.doc-page-break');
        total = legacyPages.length ? legacyPages.length + 1 : 1;
      }
      if (!total) total = 1;

      let current = 1;
      const scrollY = paperEl.scrollTop;
      const pagesToTrack = quotationPages.length > 0 ? quotationPages : paperEl.querySelectorAll('.doc-sheet-page');
      if (pagesToTrack.length > 0) {
        pagesToTrack.forEach((p, idx) => {
          if (p.offsetTop - paperEl.offsetTop <= scrollY + 180) {
            current = idx + 1;
          }
        });
      }
      setPageInfo({ current, total });
    };

    updatePages();
    paperEl.addEventListener('scroll', updatePages, { passive: true });
    const timer = setTimeout(updatePages, 300);

    return () => {
      paperEl.removeEventListener('scroll', updatePages);
      clearTimeout(timer);
    };
  }, [children]);

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDownloadMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDownloadMenuOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [downloadMenuOpen]);

  const handlePrint = async () => {
    if (!paperRef.current || printing) return;
    setPrinting(true);
    setError('');
    try {
      // Wait a short moment for React to finish rendering
      await new Promise(r => setTimeout(r, 300));
      const rect = paperRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        throw new Error('Printable content has zero size.');
      }
      const docElement = paperRef.current.querySelector('.doc-sheet-root') || paperRef.current;
      await printDocumentElement(docElement, `${title} - ${docId}`);
    } catch (err) {
      console.error('Print failed:', err);
      setError('Unable to prepare the document for printing. Please try again.');
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!paperRef.current || downloading) return;
    setDownloading(true);
    setError('');
    try {
      await new Promise(r => setTimeout(r, 300));
      const rect = paperRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        throw new Error('Printable content has zero size.');
      }
      const docElement = paperRef.current.querySelector('.doc-sheet-root') || paperRef.current;
      await downloadPdfFromElement(docElement, filename);
    } catch (err) {
      console.error('PDF download failed:', err);
      setError('Unable to generate the document PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadInvoiceOption = async (showSignature) => {
    if (downloading || printing) return;
    setDownloadMenuOpen(false);
    setDownloading(true);
    if (showSignature) {
      setDownloadingSigned(true);
    } else {
      setDownloadingUnsigned(true);
    }
    setError('');

    try {
      if (onDownloadPdfOption) {
        await onDownloadPdfOption(showSignature);
      } else if (data) {
        await generateInvoicePdf(data, { showSignature });
      } else {
        // Fallback to element
        await new Promise(r => setTimeout(r, 200));
        const docElement = paperRef.current?.querySelector('.doc-sheet-root') || paperRef.current;
        const targetFilename = filename.replace(/(-Signed|-Unsigned)?\.pdf$/i, showSignature ? '-Signed.pdf' : '-Unsigned.pdf');
        await downloadPdfFromElement(docElement, targetFilename);
      }
    } catch (err) {
      console.error(`${showSignature ? 'Signed' : 'Unsigned'} PDF download failed:`, err);
      setError(`Unable to generate the ${showSignature ? 'signed' : 'unsigned'} PDF. Please try again.`);
    } finally {
      setDownloading(false);
      setDownloadingSigned(false);
      setDownloadingUnsigned(false);
    }
  };

  return (
    <div className="doc-preview-modal-backdrop" onClick={onClose}>
      <div className="doc-preview-modal-shell" onClick={(e) => e.stopPropagation()}>
        {/* Top Action Bar */}
        <div className="doc-preview-action-bar">
          <div className="doc-preview-title-group">
            <span className={`doc-preview-badge ${docType}`}>
              {docType === 'dc'
                ? (title && title !== 'Document' ? title : 'DELIVERY CHALLAN')
                : (docType === 'pi' || docType === 'proforma'
                    ? 'PROFORMA INVOICE'
                    : (docType === 'quotation' || docType === 'qt'
                        ? 'OFFICIAL QUOTATION'
                        : (docType === 'po' || docType === 'purchase-order'
                            ? 'PURCHASE ORDER'
                            : 'TAX INVOICE')))}
            </span>
            <span className="doc-preview-id">{docId}</span>
            {status && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
                [{status}]
              </span>
            )}
          </div>

          {/* In-App Viewer Page Indicator (Viewer UI only — isolated from print & PDF) */}
          <div className="doc-preview-page-nav-badge" title="Viewer Page Indicator">
            <span className="doc-preview-page-pill">
              Page {pageInfo.current} of {pageInfo.total}
            </span>
          </div>

          <div className="doc-preview-buttons">
            <button
              type="button"
              className="doc-preview-btn secondary"
              onClick={handlePrint}
              disabled={printing || downloading}
              title="Print A4 Document"
            >
              {printing ? (
                <>
                  <span className="crm-loading-spinner inline-spinner" />
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  <span>Print</span>
                </>
              )}
            </button>

            {isInvoice ? (
              <div className="doc-preview-dropdown-wrap" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  type="button"
                  className="doc-preview-btn primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDownloadMenuOpen((prev) => !prev);
                  }}
                  disabled={downloading || printing}
                  title="Download Official A4 PDF Options"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {downloading ? (
                    <>
                      <span className="crm-loading-spinner inline-spinner" />
                      <span>{downloadingSigned ? 'Generating Signed PDF...' : downloadingUnsigned ? 'Generating Unsigned PDF...' : 'Generating PDF...'}</span>
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>Download PDF</span>
                      <span style={{ fontSize: '9px', marginLeft: '2px' }}>▼</span>
                    </>
                  )}
                </button>

                {downloadMenuOpen && (
                  <div
                    className="doc-preview-dropdown-menu"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      zIndex: 2000,
                      minWidth: '240px',
                      padding: '6px 0',
                      textAlign: 'left'
                    }}
                  >
                    <button
                      type="button"
                      className="doc-preview-menu-item"
                      onClick={() => handleDownloadInvoiceOption(false)}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        fontSize: '12.5px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#334155'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: '15px' }}>📄</span>
                      <span style={{ fontWeight: 500 }}>Download as PDF (Unsigned)</span>
                    </button>
                    <button
                      type="button"
                      className="doc-preview-menu-item"
                      onClick={() => handleDownloadInvoiceOption(true)}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        fontSize: '12.5px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#1e3a8a',
                        fontWeight: 600
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: '15px' }}>✍️</span>
                      <span>Download as PDF (Signed)</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="doc-preview-btn primary"
                onClick={handleDownloadPdf}
                disabled={downloading || printing}
                title="Download Official A4 PDF"
              >
                {downloading ? (
                  <>
                    <span className="crm-loading-spinner inline-spinner" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              className="doc-preview-btn close"
              onClick={onClose}
              title="Close Preview"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            style={{
              width: '100%',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              boxSizing: 'border-box'
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Physical Paper Sheet Container */}
        <div className={`doc-preview-paper ${docType === 'quotation' || docType === 'qt' ? 'quotation-paper' : ''}`} ref={paperRef}>
          {children}
        </div>
      </div>
    </div>
  );
}
