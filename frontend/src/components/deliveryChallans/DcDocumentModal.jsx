import React from 'react';
import DocumentPreviewModal from '../documents/DocumentPreviewModal';
import PrintableDeliveryChallan from '../documents/PrintableDeliveryChallan';
import { getDcFilename } from '../documents/DocumentPdfService';

export default function DcDocumentModal({ challan, onClose }) {
  if (!challan) return null;

  const isReturn = Boolean(
    challan.isReturnDocument ||
    challan.viewMode === 'return' ||
    challan.documentType === 'PARTIAL_RETURN_DC' ||
    challan.documentType === 'RETURN_DC'
  );

  const isPartial = isReturn && (
    challan.returnStatus === 'PARTIALLY_RETURNED' ||
    challan.status === 'PARTIALLY RETURNED' ||
    (Number(challan.returnedUnits || 0) > 0 && Number(challan.remainingUnits || 0) > 0)
  );

  let docTitle = 'DELIVERY CHALLAN';
  let docId = challan.challanId || challan.dcNumber || 'DC';

  if (isReturn) {
    docTitle = challan.documentTitle || (isPartial ? 'PARTIAL RETURN DC' : 'RETURN DC');
    docId = challan.returnId || challan.lastReturnId || challan.challanId || 'RET';
  } else if (
    challan.deliveryPurpose === 'RETURNABLE' ||
    challan.documentType === 'RETURNABLE_DC' ||
    challan.isReturnableDC === true
  ) {
    docTitle = 'RETURNABLE DC';
  }

  let modalStatus = challan.status;
  if (isReturn) {
    modalStatus = isPartial ? 'PARTIALLY RETURNED' : 'FULLY RETURNED';
  } else if (challan.returnStatus === 'FULLY_RETURNED' || challan.status === 'FULLY RETURNED') {
    modalStatus = 'FULLY RETURNED';
  } else if (challan.returnStatus === 'PARTIALLY_RETURNED' || challan.status === 'PARTIALLY RETURNED') {
    modalStatus = 'PARTIALLY RETURNED';
  }

  const filename = getDcFilename(challan);

  return (
    <DocumentPreviewModal
      title={docTitle}
      docId={docId}
      docType="dc"
      status={modalStatus}
      filename={filename}
      onClose={onClose}
    >
      <PrintableDeliveryChallan data={challan} />
    </DocumentPreviewModal>
  );
}
