import React from 'react';
import QuotationEditor from './QuotationEditor';

/**
 * NewQuotationPage
 * Thin wrapper delegating to the unified QuotationEditor in 'direct' mode.
 */
export default function NewQuotationPage(props) {
  return <QuotationEditor {...props} mode="direct" />;
}
