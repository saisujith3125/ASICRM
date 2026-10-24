const assert = require('assert');

const BASE_URL = 'https://crmapi.asiind.com/api/settings';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'USR-001',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

(async () => {
  console.log('🧪 Starting WhatsApp-Style Super Admin Governance Verification Suite...\n');

  // Test 1: Super Admin promotes USR-002 (Admin User) to SUPER_ADMIN
  console.log('--- Test 1: Promoting Admin User (USR-002) to Super Admin ---');
  const promoteRes = await request('/users/USR-002', {
    method: 'PUT',
    body: JSON.stringify({
      name: 'Admin User',
      email: 'admin@asicrm.local',
      mobile: '9999999991',
      role: 'SUPER_ADMIN',
      status: 'Active'
    })
  });
  console.log('Promote response:', promoteRes.status, promoteRes.data);
  assert.strictEqual(promoteRes.status, 200, 'Expected status 200 for promoting user to Super Admin');
  assert.strictEqual(promoteRes.data.success, true);
  assert.strictEqual(promoteRes.data.data.role, 'SUPER_ADMIN');
  console.log('✅ Successfully promoted USR-002 to SUPER_ADMIN!\n');

  // Test 2: Create a second Super Admin user
  console.log('--- Test 2: Creating a new user with SUPER_ADMIN role directly ---');
  const tempMobile = '9888877771';
  const createRes = await request('/users', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Secondary Super Admin',
      email: 'sec_admin@asicrm.local',
      mobile: tempMobile,
      employeeId: 'SA-002',
      role: 'SUPER_ADMIN',
      status: 'Active'
    })
  });
  console.log('Create response:', createRes.status, createRes.data?.message || createRes.data);
  assert.strictEqual(createRes.status, 201);
  assert.strictEqual(createRes.data.data.role, 'SUPER_ADMIN');
  const newUserId = createRes.data.data.id;
  console.log(`✅ Successfully created new Super Admin ${newUserId}!\n`);

  // Test 3: Delete the temporary Super Admin (since others exist)
  console.log(`--- Test 3: Deleting temporary Super Admin ${newUserId} ---`);
  const delRes = await request(`/users/${newUserId}`, { method: 'DELETE' });
  console.log('Delete response:', delRes.status, delRes.data);
  assert.strictEqual(delRes.status, 200);
  assert.strictEqual(delRes.data.success, true);
  console.log('✅ Temporary Super Admin deleted successfully because other Super Admins exist!\n');

  // Test 4: Transfer Super Admin privileges (WhatsApp-style)
  console.log('--- Test 4: Transfer Super Admin privileges to USR-002 and step down to Admin ---');
  const transferRes = await request('/users/transfer-super-admin', {
    method: 'POST',
    body: JSON.stringify({
      targetUserId: 'USR-002',
      selfAction: 'demote_admin'
    })
  });
  console.log('Transfer response:', transferRes.status, transferRes.data);
  assert.strictEqual(transferRes.status, 200);
  assert.strictEqual(transferRes.data.success, true);
  assert.strictEqual(transferRes.data.data.transferredTo.role, 'SUPER_ADMIN');
  assert.strictEqual(transferRes.data.data.self.role, 'ADMIN');
  console.log('✅ WhatsApp-style Transfer completed: USR-002 is Super Admin, USR-001 stepped down to Admin!\n');

  // Test 5: Verify USR-002 can now act as Super Admin and transfer back to USR-001
  console.log('--- Test 5: New Super Admin (USR-002) transfers privileges back to USR-001 ---');
  const transferBackRes = await request('/users/transfer-super-admin', {
    method: 'POST',
    headers: { 'x-user-id': 'USR-002' },
    body: JSON.stringify({
      targetUserId: 'USR-001',
      selfAction: 'demote_admin'
    })
  });
  console.log('Transfer back response:', transferBackRes.status, transferBackRes.data);
  assert.strictEqual(transferBackRes.status, 200);
  assert.strictEqual(transferBackRes.data.data.transferredTo.role, 'SUPER_ADMIN');
  console.log('✅ Successfully transferred Super Admin back to USR-001!\n');

  // Test 6: Verify protection when trying to demote the only remaining active Super Admin
  console.log('--- Test 6: Verify last active Super Admin cannot be demoted or deactivated ---');
  // First, demote USR-002 and USR-003 to ADMIN so USR-001 is the ONLY Super Admin
  await request('/users/USR-002', {
    method: 'PUT',
    body: JSON.stringify({ name: 'Admin User', email: 'admin@asicrm.local', mobile: '9999999991', role: 'ADMIN', status: 'Active' })
  });
  await request('/users/USR-003', {
    method: 'PUT',
    body: JSON.stringify({ name: 'John Doe', email: 'john@asicrm.local', mobile: '9344158558', role: 'ADMIN', status: 'Active' })
  });

  // Now USR-001 tries to demote themselves to EMPLOYEE
  const blockDemoteRes = await request('/users/USR-001', {
    method: 'PUT',
    body: JSON.stringify({ name: 'Super Admin', email: 'superadmin@asicrm.local', mobile: '9994126686', role: 'EMPLOYEE', status: 'Active' })
  });
  console.log('Block demote response:', blockDemoteRes.status, blockDemoteRes.data);
  assert.strictEqual(blockDemoteRes.status, 400);
  assert.match(blockDemoteRes.data.message, /Cannot demote or deactivate the only active Super Admin/i);
  console.log('✅ Safely blocked demoting the only active Super Admin!\n');

  // Now USR-001 tries to deactivate themselves
  const blockDeactivateRes = await request('/users/USR-001', {
    method: 'PUT',
    body: JSON.stringify({ name: 'Super Admin', email: 'superadmin@asicrm.local', mobile: '9994126686', role: 'SUPER_ADMIN', status: 'Inactive' })
  });
  console.log('Block deactivate response:', blockDeactivateRes.status, blockDeactivateRes.data);
  assert.strictEqual(blockDeactivateRes.status, 400);
  assert.match(blockDeactivateRes.data.message, /Cannot demote or deactivate the only active Super Admin/i);
  console.log('✅ Safely blocked deactivating the only active Super Admin!\n');

  console.log('🎉 ALL WHATSAPP-STYLE SUPER ADMIN GOVERNANCE TESTS PASSED 100%!');
})();
