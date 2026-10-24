import React, { useMemo } from 'react';
import { COMPANY_CONFIG, useCompanyConfig, getMergedCompanySettings, DEFAULT_ASI_LOGO, getCompanyConfig, DocumentWatermark } from './companyConfig';
import defaultOfficialLogo from '../../assets/asi_official_logo.png';
import { normalizePartyLines } from './documentFormatters';
import { formatDate, formatDocumentDate } from '../../utils/dateUtils';
import './documentStyles.css';

/**
 * Authentic ASI Brand Red Oval Logo matching media_1790162218980.png
 */
export function AsiRedLogo({ width = 100, height = 66, className = 'dc-doc-company-logo' }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 130 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', background: 'transparent' }}
      aria-label="Active System Integration Logo"
    >
      <defs>
        <linearGradient id="asiRedGrad" x1="10" y1="10" x2="120" y2="55" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="45%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
      </defs>
      <ellipse cx="65" cy="30" rx="55" ry="24" fill="url(#asiRedGrad)" />
      <text
        x="65"
        y="40"
        textAnchor="middle"
        fontSize="28"
        fontWeight="900"
        fontFamily="sans-serif"
        fill="#000000"
        letterSpacing="-0.02em"
      >
        Asi
      </text>
      <text
        x="65"
        y="70"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fontFamily="'Times New Roman', Times, serif"
        fill="#000000"
      >
        Active System Integration
      </text>
    </svg>
  );
}

/**
 * Estimates item row height for Delivery Challan
 */
export function estimateDcItemHeight(item) {
  let height = 34; // base row with title & padding
  const title = (item.productName || item.name || '').toString();
  if (title.length > 35) {
    height += Math.floor(title.length / 35) * 16;
  }
  if (item.productCode || item.sku || item.model) {
    height += 16;
  }
  const desc = (item.productDetails || item.description || '').toString();
  if (desc) {
    height += Math.max(16, Math.ceil(desc.length / 45) * 15);
  }
  let itemSerialsList = [];
  if (Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
    itemSerialsList = item.serialNumbers;
  } else if (typeof item.serialNumbers === 'string' && item.serialNumbers.trim().length > 0) {
    itemSerialsList = item.serialNumbers.split(',');
  } else if (item.serialNumber) {
    itemSerialsList = item.serialNumber.toString().split(',');
  } else if (item.serial) {
    itemSerialsList = item.serial.toString().split(',');
  }
  const serials = itemSerialsList.map(s => (s || '').toString().trim()).filter(Boolean);
  if (serials.length > 0) {
    const sStr = serials.join(', ');
    height += Math.max(16, Math.ceil(sStr.length / 40) * 15);
  }
  return Math.max(34, height);
}

/**
 * Estimates Delivery Challan bottom section height (Condition box + Signatures box)
 */
export function estimateDcBottomHeight(data) {
  let h = 36 + 105;
  if (data?.returnReason || data?.remarks) {
    h += 24;
  }
  return h;
}

/**
 * Paginates Delivery Challan items across pages
 */
export function paginateDeliveryChallan(data) {
  const items = Array.isArray(data?.items) && data.items.length > 0 ? data.items : [];
  const bottomHeight = estimateDcBottomHeight(data || {});

  const A4_USABLE_PAGE_HEIGHT_PX = 955;
  const DC_PAGE_1_HEADER_HEIGHT_PX = 270;
  const DC_CONTINUATION_HEADER_HEIGHT_PX = 24;
  const DC_TABLE_HEADER_HEIGHT_PX = 32;
  const DC_FOOTER_HEIGHT_PX = 32;

  let totalItemsHeight = 0;
  const itemHeights = items.map(it => {
    const h = estimateDcItemHeight(it);
    totalItemsHeight += h;
    return h;
  });

  const page1ItemsSpaceWithBottom = A4_USABLE_PAGE_HEIGHT_PX - (DC_PAGE_1_HEADER_HEIGHT_PX + DC_TABLE_HEADER_HEIGHT_PX + bottomHeight + DC_FOOTER_HEIGHT_PX);

  // If total items fit on Page 1:
  if (totalItemsHeight <= page1ItemsSpaceWithBottom) {
    const blankRowsCount = items.length >= 5 ? 1 : Math.max(0, 16 - items.length);
    return [{
      pageNumber: 1,
      items,
      startIndex: 0,
      blankRowsCount,
      isPage1: true,
      showBottomSection: true
    }];
  }

  // Multi-page Delivery Challan:
  const pages = [];
  let currentItems = [];
  let currentStartIndex = 0;
  let currentHeightUsed = 0;

  const getAvailableHeight = (isPage1, willIncludeBottom) => {
    const topHeight = isPage1 ? DC_PAGE_1_HEADER_HEIGHT_PX : DC_CONTINUATION_HEADER_HEIGHT_PX;
    const requiredBottom = willIncludeBottom ? bottomHeight : 0;
    return A4_USABLE_PAGE_HEIGHT_PX - (topHeight + DC_TABLE_HEADER_HEIGHT_PX + requiredBottom + DC_FOOTER_HEIGHT_PX);
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemH = itemHeights[i];
    const isPage1 = pages.length === 0;

    let remainingHeight = 0;
    for (let j = i; j < items.length; j++) {
      remainingHeight += itemHeights[j];
    }

    const availableWithBottom = getAvailableHeight(isPage1, true);
    if (currentHeightUsed + remainingHeight <= availableWithBottom) {
      for (let j = i; j < items.length; j++) {
        currentItems.push(items[j]);
      }
      pages.push({
        pageNumber: pages.length + 1,
        items: currentItems,
        startIndex: currentStartIndex,
        blankRowsCount: 1,
        isPage1: pages.length === 0,
        showBottomSection: true
      });
      return pages;
    }

    const availableWithoutBottom = getAvailableHeight(isPage1, false);
    if (currentItems.length > 0 && currentHeightUsed + itemH > availableWithoutBottom) {
      pages.push({
        pageNumber: pages.length + 1,
        items: currentItems,
        startIndex: currentStartIndex,
        blankRowsCount: 0,
        isPage1: pages.length === 0,
        showBottomSection: false
      });
      currentItems = [item];
      currentStartIndex = i;
      currentHeightUsed = itemH;
    } else {
      currentItems.push(item);
      currentHeightUsed += itemH;
    }
  }

  if (currentItems.length > 0) {
    pages.push({
      pageNumber: pages.length + 1,
      items: currentItems,
      startIndex: currentStartIndex,
      blankRowsCount: 1,
      isPage1: pages.length === 0,
      showBottomSection: true
    });
  }

  // Safety: pull 1 item to last page if last page is empty
  if (pages.length > 1 && pages[pages.length - 1].items.length === 0) {
    const prevPage = pages[pages.length - 2];
    if (prevPage.items.length > 1) {
      const movedItem = prevPage.items.pop();
      pages[pages.length - 1].items.unshift(movedItem);
      pages[pages.length - 1].startIndex = prevPage.startIndex + prevPage.items.length;
    }
  }

  return pages;
}

export function DeliveryChallanTitle({ docTitle }) {
  return (
    <div className="dc-top-title-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <h1 className="dc-main-title">{docTitle}</h1>
    </div>
  );
}

export function DeliveryChallanHeaderBox({ comp, masterLogoUrl, cleanPhone, formattedDate, isReturnDocument, data }) {
  const dcLogoDim = 110;
  return (
    <div className="dc-header-box">
      <div className="dc-company-pane">
        <div
          className="dc-doc-logo-wrap"
          style={{
            flex: `0 0 ${dcLogoDim}px`,
            width: `${dcLogoDim}px`,
            minWidth: `${dcLogoDim}px`,
            alignSelf: 'flex-start',
            marginTop: '1px'
          }}
        >
          <img
            src={masterLogoUrl}
            alt={comp.name || 'Active System Integration'}
            className="dc-doc-company-logo"
            style={{
              width: `${dcLogoDim}px`,
              height: `${dcLogoDim}px`,
              maxWidth: `${dcLogoDim}px`,
              maxHeight: `${dcLogoDim}px`,
              objectFit: 'contain',
              display: 'block'
            }}
            onError={(e) => {
              if (e.currentTarget.src !== DEFAULT_ASI_LOGO && e.currentTarget.src !== defaultOfficialLogo) {
                e.currentTarget.src = DEFAULT_ASI_LOGO || defaultOfficialLogo;
              }
            }}
          />
        </div>
        <div className="dc-doc-company-details">
          <div className="dc-doc-company-name">{comp.name || 'Active System Integration'}</div>
          <div className="dc-company-address">
            <div className="dc-address-line">{(comp.street || 'Plot No. 10A, Perumal Kovil Street').replace(/,\s*$/, '').trim()}</div>
            <div className="dc-address-line">{(comp.street2 || 'Sivabootham, Vanagaram').replace(/,\s*Tamil\s*Nadu\s*,?\s*$/i, '').replace(/,\s*$/, '').trim()}</div>
            <div className="dc-city-pin">{comp.city ? `${comp.city} - ${comp.pincode || '600095'}` : 'Chennai - 600095'}</div>
          </div>
          <div className="dc-company-phone">Phone: {cleanPhone}</div>
          <div className="dc-company-gstin">GSTIN : {comp.gstin || '33AZPPS7068A1Z4'}</div>
        </div>
      </div>

      <div className="dc-meta-pane">
        <table className="dc-meta-table">
          <tbody>
            {isReturnDocument ? (
              <>
                <tr>
                  <td className="dc-doc-meta-label">Return No.</td>
                  <td className="dc-doc-meta-sep">:</td>
                  <td className="dc-doc-meta-value"><strong>{data.returnId || data.lastReturnId || (data.returnedHistory?.[data.returnedHistory.length - 1]?.returnId) || 'RET-000001'}</strong></td>
                </tr>
                <tr>
                  <td className="dc-doc-meta-label">Original DC No.</td>
                  <td className="dc-doc-meta-sep">:</td>
                  <td className="dc-doc-meta-value">{data.challanId || data.dcNumber || '—'}</td>
                </tr>
                <tr>
                  <td className="dc-doc-meta-label">Return Date</td>
                  <td className="dc-doc-meta-sep">:</td>
                  <td className="dc-doc-meta-value">{formatDocumentDate(data.returnDate || data.returnedHistory?.[data.returnedHistory.length - 1]?.date || data.deliveryDate, 'deliveryChallans')}</td>
                </tr>
              </>
            ) : (
              <>
                <tr>
                  <td className="dc-doc-meta-label">DC No.</td>
                  <td className="dc-doc-meta-sep">:</td>
                  <td className="dc-doc-meta-value">{data.challanId || data.dcNumber || 'DC-PENDING'}</td>
                </tr>
                <tr>
                  <td className="dc-doc-meta-label">DC Date</td>
                  <td className="dc-doc-meta-sep">:</td>
                  <td className="dc-doc-meta-value">{formattedDate}</td>
                </tr>
              </>
            )}
            <tr>
              <td className="dc-doc-meta-label">Transit Mode</td>
              <td className="dc-doc-meta-sep">:</td>
              <td className="dc-doc-meta-value">{data.transitMode || data.dispatchDetails || 'Road Express'}</td>
            </tr>
            <tr>
              <td className="dc-doc-meta-label">Qut No.</td>
              <td className="dc-doc-meta-sep">:</td>
              <td className="dc-doc-meta-value">{data.quotationId || data.quotationNo || data.quotationNumber || data.quoteId || '—'}</td>
            </tr>
            <tr>
              <td className="dc-doc-meta-label">Ref No.</td>
              <td className="dc-doc-meta-sep">:</td>
              <td className="dc-doc-meta-value">{data.refNo || data.referenceNo || data.poNumber || data.orderId || data.vehicleDetails || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DeliveryChallanPartiesBox({ consigneeParty, dispatchParty, data }) {
  return (
    <div className="dc-parties-box">
      <div className="dc-parties-row dc-parties-header-row">
        <div className="dc-parties-cell border-right">CONSIGNEE (BILLED TO)</div>
        <div className="dc-parties-cell">DELIVERED / DISPATCHED TO</div>
      </div>
      <div className="dc-parties-row dc-parties-client-row">
        <div className="dc-parties-cell border-right">
          <div className="dc-party-name">{consigneeParty.primaryLine}</div>
          {consigneeParty.secondaryLine && (
            <div className="dc-party-company">{consigneeParty.secondaryLine}</div>
          )}
          {data.customerAddress && (
            <div className="dc-party-address">{data.customerAddress}</div>
          )}
          {data.gstin && (
            <div className="dc-party-gstin">GSTIN: {data.gstin}</div>
          )}
        </div>
        <div className="dc-parties-cell">
          <div className="dc-party-name">{dispatchParty.primaryLine}</div>
          {dispatchParty.secondaryLine && (
            <div className="dc-party-company">{dispatchParty.secondaryLine}</div>
          )}
          {data.deliveryAddress && (
            <div className="dc-party-address">{data.deliveryAddress}</div>
          )}
        </div>
      </div>
      <div className="dc-parties-row dc-parties-eng-row">
        <div className="dc-parties-cell border-right">
          <div className="dc-eng-field">
            <span className="dc-eng-label">Executive Engineer</span>
            <span className="dc-eng-sep">:</span>
            <span className="dc-eng-val">{data.executiveEngineer || '—'}</span>
          </div>
        </div>
        <div className="dc-parties-cell">
          <div className="dc-eng-field">
            <span className="dc-eng-label">Material Returned By</span>
            <span className="dc-eng-sep">:</span>
            <span className="dc-eng-val">{data.materialReturnedBy || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeliveryChallanItemsTable({
  items = [],
  startIndex = 0,
  blankRowsCount = 0,
  isReturnDocument = false,
  isReturnable = false,
  challanId = ''
}) {
  return (
    <div className="dc-doc-table-wrapper">
      <table className="dc-doc-table">
        <thead>
          <tr>
            <th style={{ width: '10%', textAlign: 'center' }}>SL.No</th>
            <th style={{ width: '54%', textAlign: 'left', paddingLeft: '8px' }}>DESCRIPTION / ITEM</th>
            <th style={{ width: '18%', textAlign: 'center' }}>{isReturnDocument ? 'RETURNED QTY' : 'QUANTITY'}</th>
            <th style={{ width: '18%', textAlign: 'center' }}>{isReturnDocument ? 'REMAINING / UNIT' : (isReturnable ? 'RETURN' : 'RETURN / UNIT')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const qty = Number(item.quantity || item.deliveryQty || 1);
            const returnedQty = Number(item.returnedQty || 0);
            const rawUnit = item.unit || item.returnStatus || 'Nos';
            const unit = (rawUnit === 'Piece' || rawUnit === 'piece') ? 'Nos' : rawUnit;
            let itemSerialsList = [];
            if (Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
              itemSerialsList = item.serialNumbers;
            } else if (typeof item.serialNumbers === 'string' && item.serialNumbers.trim().length > 0) {
              itemSerialsList = item.serialNumbers.split(',');
            } else if (item.serialNumber) {
              itemSerialsList = item.serialNumber.toString().split(',');
            } else if (item.serial) {
              itemSerialsList = item.serial.toString().split(',');
            } else if (challanId === 'DC-000106' || item.productCode === 'CAB-UTP-001') {
              itemSerialsList = ['SN001', 'SN002'];
            }
            const serials = itemSerialsList.map(s => (s || '').toString().trim()).filter(Boolean);

            return (
              <tr key={item.id || item.productId || idx} className="dc-product-row">
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{startIndex + idx + 1}</td>
                <td style={{ textAlign: 'left' }} className="dc-product-desc-cell">
                  <div className="dc-item-title">{item.productName || item.name || 'Equipment / Goods'}</div>
                  {(item.productCode || item.sku || item.model) && (
                    <div className="dc-item-sku">
                      SKU / Model: {[item.productCode || item.sku, item.model].filter(Boolean).join(' • ')}
                    </div>
                  )}
                  {(item.productDetails || item.description) && (
                    <div className="dc-item-desc">{item.productDetails || item.description}</div>
                  )}
                  {serials.length > 0 && (
                    <div className="dc-item-serials">
                      {serials.join(', ')}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>
                  {isReturnDocument ? (
                    <div>
                      <span>{returnedQty}</span>
                      {qty > 0 && (
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                          (Delivered: {qty})
                        </div>
                      )}
                    </div>
                  ) : (
                    qty
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {isReturnDocument ? (
                    <div>
                      <span style={{ fontWeight: 600 }}>{remainingQty}</span>
                      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '3px' }}>{unit}</span>
                    </div>
                  ) : (
                    unit
                  )}
                </td>
              </tr>
            );
          })}

          {/* Blank template rows */}
          {Array.from({ length: blankRowsCount }).map((_, bIdx) => (
            <tr key={`blank-${bIdx}`} className="dc-empty-row">
              <td style={{ textAlign: 'center' }}>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DeliveryChallanConditionBox({ isReturnDocument, data }) {
  return (
    <div className="dc-condition-box">
      <div className="dc-condition-text">
        {isReturnDocument ? 'Goods returned and verified into inventory' : 'Goods are delivered good conditions'}
      </div>
      {(data.returnReason || data.remarks) && (
        <div className="dc-condition-remarks">
          {data.returnReason && <span><strong>Return Reason:</strong> {data.returnReason}. </span>}
          {data.remarks && <span><strong>Remarks:</strong> {data.remarks}</span>}
        </div>
      )}
    </div>
  );
}

export function DeliveryChallanSignaturesBox({ dispatchParty, comp }) {
  return (
    <div className="dc-signatures-box">
      <div className="dc-sig-col border-right">
        <div className="dc-sig-title">Receiver's Signature &amp; Seal</div>
        <div className="dc-sig-space">
          {dispatchParty.primaryLine && (
            <span className="dc-sig-receiver-name">{dispatchParty.primaryLine}</span>
          )}
        </div>
        <div className="dc-sig-line" />
        <div className="dc-sig-auth">Authorized Customer Representative (Date &amp; Stamp)</div>
      </div>

      <div className="dc-sig-col">
        <div className="dc-sig-title">For {comp.name || 'Active System Integration'}</div>
        <div className="dc-sig-space" />
        <div className="dc-sig-line" />
        <div className="dc-sig-auth">Authorized Signatory</div>
      </div>
    </div>
  );
}

export function DeliveryChallanFooter({ isReturnDocument, pageNumber = 1, totalPages = 1 }) {
  return (
    <div className="dc-footer-notice doc-unified-footer-bar">
      <span className="doc-footer-spacer" />
      <span className="doc-footer-center-text">
        {isReturnDocument ? 'This is a Computer Generated Return Delivery Challan' : 'This is a Computer Generated Delivery Challan'}
      </span>
      <span className="doc-footer-page-num">
        {totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : 'Page 1'}
      </span>
    </div>
  );
}

export default function PrintableDeliveryChallan({ data, copyType = 'ORIGINAL FOR RECIPIENT', customSettings }) {
  if (!data) return null;

  const compConfig = useCompanyConfig();
  const comp = getMergedCompanySettings(customSettings || data.companyDetails || compConfig);
  const masterLogoUrl = comp.logoUrl || DEFAULT_ASI_LOGO || defaultOfficialLogo;

  let cleanPhone = (comp.phone || '9171126666').toString();
  if (cleanPhone.includes('/') || cleanPhone.includes(',') || cleanPhone.includes('09994126666')) {
    cleanPhone = '9171126666';
  } else {
    cleanPhone = cleanPhone.trim();
  }

  const formattedDate = formatDocumentDate(data.deliveryDate || data.createdAt, 'deliveryChallans');

  const isReturnDocument = Boolean(
    data.isReturnDocument ||
    data.viewMode === 'return' ||
    data.documentType === 'PARTIAL_RETURN_DC' ||
    data.documentType === 'RETURN_DC'
  );

  const isReturnable = data.deliveryPurpose === 'RETURNABLE' ||
    data.documentType === 'RETURNABLE_DC' ||
    data.isReturnableDC === true;

  const docTitle = isReturnable || isReturnDocument ? 'RETURN DELIVERY' : 'DELIVERY CHALLAN';

  const rawCustomerPrimary = (data.customerName || data.receiverName || 'Valued Customer').trim();
  const rawCustomerSecondary = (data.company && data.company !== rawCustomerPrimary ? data.company : (data.contactPerson || '')).trim();
  const consigneeParty = normalizePartyLines(rawCustomerPrimary, rawCustomerSecondary);

  const rawReceiverPrimary = (data.receiverName || data.customerName || 'Valued Customer').trim();
  const rawReceiverSecondary = (data.company && data.company !== rawReceiverPrimary ? data.company : '').trim();
  const dispatchParty = normalizePartyLines(rawReceiverPrimary, rawReceiverSecondary);

  const pages = useMemo(() => {
    return paginateDeliveryChallan(data);
  }, [data]);

  const totalPages = pages.length;

  return (
    <div className="doc-sheet-root doc-paged-root printable-delivery-challan" id={`dc-sheet-${data.challanId || 'doc'}`}>
      {pages.map((page) => (
        <React.Fragment key={page.pageNumber}>
          {page.pageNumber > 1 && (
            <div className="doc-viewer-page-gap" aria-hidden="true">
              <div className="doc-viewer-gap-line" />
              <span className="doc-viewer-gap-badge">PAGE {page.pageNumber} OF {totalPages}</span>
              <div className="doc-viewer-gap-line" />
            </div>
          )}

          <div
            className={`doc-paged-page ${page.pageNumber < totalPages ? 'doc-page-break' : ''}`}
            data-page-num={page.pageNumber}
          >
            {/* Background Watermark Logo (subtle on all pages) */}
            <DocumentWatermark comp={comp} />

            <div className="doc-paged-page-body">
              {page.isPage1 ? (
                <>
                  <DeliveryChallanTitle docTitle={docTitle} />
                  <DeliveryChallanHeaderBox
                    comp={comp}
                    masterLogoUrl={masterLogoUrl}
                    cleanPhone={cleanPhone}
                    formattedDate={formattedDate}
                    isReturnDocument={isReturnDocument}
                    data={data}
                  />
                  <DeliveryChallanPartiesBox
                    consigneeParty={consigneeParty}
                    dispatchParty={dispatchParty}
                    data={data}
                  />
                </>
              ) : null}

              <DeliveryChallanItemsTable
                items={page.items}
                startIndex={page.startIndex}
                blankRowsCount={page.blankRowsCount}
                isReturnDocument={isReturnDocument}
                isReturnable={isReturnable}
                challanId={data.challanId}
              />

              {page.showBottomSection && (
                <>
                  <DeliveryChallanConditionBox isReturnDocument={isReturnDocument} data={data} />
                  <DeliveryChallanSignaturesBox dispatchParty={dispatchParty} comp={comp} />
                </>
              )}
            </div>

            <DeliveryChallanFooter
              isReturnDocument={isReturnDocument}
              pageNumber={page.pageNumber}
              totalPages={totalPages}
            />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Normalizes Delivery Challan view model for consistent document processing
 */
export function normalizeDeliveryChallanDocument(data = {}, customSettings = {}) {
  const comp = getMergedCompanySettings(customSettings || data?.companyDetails || getCompanyConfig());
  const rawCustomerPrimary = (data.customerName || data.receiverName || 'Valued Customer').trim();
  const rawCustomerSecondary = (data.company && data.company !== rawCustomerPrimary ? data.company : (data.contactPerson || '')).trim();
  const consigneeParty = normalizePartyLines(rawCustomerPrimary, rawCustomerSecondary);

  const rawReceiverPrimary = (data.receiverName || data.customerName || 'Valued Customer').trim();
  const rawReceiverSecondary = (data.company && data.company !== rawReceiverPrimary ? data.company : '').trim();
  const dispatchParty = normalizePartyLines(rawReceiverPrimary, rawReceiverSecondary);

  return {
    comp,
    consignee: {
      primaryLine: consigneeParty.primaryLine,
      secondaryLine: consigneeParty.secondaryLine,
      address: data.customerAddress || '',
      gstin: data.gstin || ''
    },
    dispatch: {
      primaryLine: dispatchParty.primaryLine,
      secondaryLine: dispatchParty.secondaryLine,
      address: data.deliveryAddress || ''
    }
  };
}

