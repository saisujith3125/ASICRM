import React from 'react';

/**
 * Enterprise Status Badge for Delivery Challans
 * Supports: CREATED, DISPATCHED, IN_TRANSIT, DELIVERED, RETURNED
 */
export function DCStatusBadge({ status }) {
  const norm = String(status || 'DISPATCHED').toUpperCase();
  let badgeClass = 'badge-blue';
  let label = norm;

  if (norm === 'DELIVERED') {
    badgeClass = 'badge-green';
    label = 'DELIVERED';
  } else if (norm === 'PARTIAL' || norm === 'PARTIAL DISPATCH' || norm === 'PARTIALLY_DELIVERED') {
    badgeClass = 'badge-amber';
    label = 'PARTIAL';
  } else if (norm === 'FULLY RETURNED' || norm === 'FULLY_RETURNED') {
    badgeClass = 'badge-rose';
    label = 'FULLY RETURNED';
  } else if (norm === 'RETURNED') {
    badgeClass = 'badge-rose';
    label = 'RETURNED';
  } else if (norm === 'PARTIALLY RETURNED' || norm === 'PARTIAL RETURN' || norm === 'PARTIALLY_RETURNED') {
    badgeClass = 'badge-amber';
    label = 'PARTIALLY RETURNED';
  } else if (norm === 'IN_TRANSIT') {
    badgeClass = 'badge-amber';
    label = 'IN TRANSIT';
  } else if (norm === 'CREATED') {
    badgeClass = 'badge-gray';
    label = 'CREATED';
  } else {
    badgeClass = 'badge-blue';
    label = 'DISPATCHED';
  }

  return (
    <span className={`status-badge ${badgeClass} dc-status-pill`}>
      {label}
    </span>
  );
}

/**
 * Enterprise Page Header for DC subviews
 */
export function DCPageHeader({ title, children }) {
  return (
    <div className="dc-page-header compact-header">
      <div className="dc-header-left">
        <h2 className="dc-page-title">{title}</h2>
      </div>
      {children && <div className="dc-header-actions">{children}</div>}
    </div>
  );
}

/**
 * Empty State for DC Tables
 */
export function DCEmptyState({ message = 'No delivery challan records found.', colSpan = 8, action }) {
  return (
    <tr className="empty-row">
      <td colSpan={colSpan} style={{ textAlign: 'center', padding: '36px 16px' }}>
        <div className="dc-table-empty-msg">
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
            {message}
          </p>
          {action && <div style={{ marginTop: '12px' }}>{action}</div>}
        </div>
      </td>
    </tr>
  );
}
