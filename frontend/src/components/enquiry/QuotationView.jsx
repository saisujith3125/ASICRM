import React from 'react';
import QuotationEditor from './QuotationEditor';

/**
 * QuotationView
 * Thin wrapper delegating to the unified QuotationEditor in 'enquiry' or 'details' mode.
 */
export default function QuotationView(props) {
  const mode = props.mode || (props.enquiryId && !props.quotationId ? 'enquiry' : 'details');
  return <QuotationEditor {...props} mode={mode} />;
}