import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

const createdPodIds = [];
const createdEmployeeIds = [];

export async function runPodTests() {
  console.log('====================================================');
  console.log('🧪 Starting Pods API Test Suite (12 Scenarios)');
  console.log('====================================================\n');

  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/pods`;
      resolve();
    });
  });

  const testResults = [];
  const recordResult = (scenarioNum, title, passed, details = '') => {
    testResults.push({ scenarioNum, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [Scenario ${scenarioNum}] ${title}`);
    if (details) console.log(`   ↳ ${details}`);
  };

  try {
    const timestamp = Date.now().toString().slice(-5);

    // Create an active employee to serve as a test pod lead
    const { data: leadEmp, error: leadEmpErr } = await supabase
      .from('employees')
      .insert([
        {
          employee_code: `LEAD-EMP-${timestamp}`,
          full_name: 'Lead Test Engineer',
          email: `lead.test.${timestamp}@example.com`,
          employment_status: 'ACTIVE',
        },
      ])
      .select()
      .single();

    if (leadEmpErr) throw new Error('Lead employee setup error: ' + leadEmpErr.message);
    createdEmployeeIds.push(leadEmp.id);

    // Create an inactive employee to test inactive lead assignment validation
    const { data: inactiveEmp, error: inactEmpErr } = await supabase
      .from('employees')
      .insert([
        {
          employee_code: `INACT-EMP-${timestamp}`,
          full_name: 'Inactive Agent',
          email: `inact.test.${timestamp}@example.com`,
          employment_status: 'INACTIVE',
        },
      ])
      .select()
      .single();

    if (inactEmpErr) throw new Error('Inactive employee setup error: ' + inactEmpErr.message);
    createdEmployeeIds.push(inactiveEmp.id);

    let primaryPodId = null;
    let secondaryPodId = null;

    // ---------------------------------------------------------------
    // 1. Create a valid pod with lead employee
    // ---------------------------------------------------------------
    const validPodPayload = {
      name: `FinTech Pod ${timestamp}`,
      description: 'Handles banking and payment integrations',
      lead_employee_id: leadEmp.id,
    };

    const res1 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPodPayload),
    });
    const body1 = await res1.json();
    const passed1 =
      res1.status === 201 &&
      body1.success === true &&
      body1.data?.name === validPodPayload.name &&
      body1.data?.lead_employee?.id === leadEmp.id;

    if (body1.data?.id) {
      primaryPodId = body1.data.id;
      createdPodIds.push(primaryPodId);
    }
    recordResult(1, 'Create a valid pod with lead employee', passed1, `Status: ${res1.status}, ID: ${primaryPodId}`);

    // ---------------------------------------------------------------
    // 2. Reject pod with missing required name
    // ---------------------------------------------------------------
    const res2 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Pod with no name' }),
    });
    const body2 = await res2.json();
    const passed2 = res2.status === 400 && body2.success === false;
    recordResult(2, 'Create a pod with missing required name', passed2, `Status: ${res2.status}, Message: "${body2.message}"`);

    // ---------------------------------------------------------------
    // 3. Reject duplicate pod name
    // ---------------------------------------------------------------
    const res3 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: validPodPayload.name }),
    });
    const body3 = await res3.json();
    const passed3 = res3.status === 409 && body3.success === false;
    recordResult(3, 'Create a pod with duplicate name', passed3, `Status: ${res3.status}, Message: "${body3.message}"`);

    // ---------------------------------------------------------------
    // 4. Reject pod with nonexistent lead employee
    // ---------------------------------------------------------------
    const res4 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Nonexistent Lead Pod ${timestamp}`,
        lead_employee_id: '00000000-0000-0000-0000-000000000000',
      }),
    });
    const body4 = await res4.json();
    const passed4 = res4.status === 400 && body4.success === false;
    recordResult(4, 'Create a pod with nonexistent lead employee', passed4, `Status: ${res4.status}, Message: "${body4.message}"`);

    // ---------------------------------------------------------------
    // 5. Reject pod with invalid lead employee UUID format or inactive employee
    // ---------------------------------------------------------------
    const res5a = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Invalid UUID Pod ${timestamp}`,
        lead_employee_id: 'not-a-uuid',
      }),
    });
    const body5a = await res5a.json();

    const res5b = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Inactive Lead Pod ${timestamp}`,
        lead_employee_id: inactiveEmp.id,
      }),
    });
    const body5b = await res5b.json();

    const passed5 = res5a.status === 400 && res5b.status === 400;
    recordResult(5, 'Reject invalid lead employee UUID and inactive employee lead', passed5, `Malformed UUID -> ${res5a.status}, Inactive employee -> ${res5b.status}`);

    // Create a second pod for listing, searching, and deleting
    const res2ndPod = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `E-Commerce Pod ${timestamp}`,
        description: 'Customer service for retail shops',
      }),
    });
    const body2ndPod = await res2ndPod.json();
    if (body2ndPod.data?.id) {
      secondaryPodId = body2ndPod.data.id;
      createdPodIds.push(secondaryPodId);
    }

    // ---------------------------------------------------------------
    // 6. Fetch all pods with pagination and search
    // ---------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}?search=FinTech&page=1&limit=10`);
    const body6 = await res6.json();
    const passed6 =
      res6.status === 200 &&
      body6.success === true &&
      Array.isArray(body6.data) &&
      body6.data.some((p) => p.id === primaryPodId);
    recordResult(6, 'Fetch all pods with search and pagination', passed6, `Status: ${res6.status}, Search results: ${body6.data?.length}, Total: ${body6.pagination?.total}`);

    // ---------------------------------------------------------------
    // 7. Fetch pod by ID with joined lead_employee and members
    // ---------------------------------------------------------------
    const res7 = await fetch(`${baseUrl}/${primaryPodId}`);
    const body7 = await res7.json();
    const passed7 =
      res7.status === 200 &&
      body7.success === true &&
      body7.data?.id === primaryPodId &&
      body7.data?.lead_employee?.full_name === 'Lead Test Engineer' &&
      Array.isArray(body7.data?.employees);
    recordResult(7, 'Fetch pod by ID with joined lead employee', passed7, `Status: ${res7.status}, Pod: "${body7.data?.name}", Lead: "${body7.data?.lead_employee?.full_name}"`);

    // ---------------------------------------------------------------
    // 8. Fetch pod with invalid ID
    // ---------------------------------------------------------------
    const res8a = await fetch(`${baseUrl}/invalid-uuid-abc`);
    const res8b = await fetch(`${baseUrl}/00000000-0000-0000-0000-000000000000`);
    const passed8 = res8a.status === 400 && res8b.status === 404;
    recordResult(8, 'Fetch pod with invalid ID format and nonexistent ID', passed8, `Malformed UUID -> ${res8a.status}, Nonexistent UUID -> ${res8b.status}`);

    // ---------------------------------------------------------------
    // 9. Update pod details
    // ---------------------------------------------------------------
    const res9 = await fetch(`${baseUrl}/${primaryPodId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Updated description for FinTech Pod',
      }),
    });
    const body9 = await res9.json();
    const passed9 =
      res9.status === 200 &&
      body9.success === true &&
      body9.data?.description === 'Updated description for FinTech Pod';
    recordResult(9, 'Update pod description', passed9, `Status: ${res9.status}, Updated description confirmed`);

    // ---------------------------------------------------------------
    // 10. Reject updating pod with duplicate name
    // ---------------------------------------------------------------
    const res10 = await fetch(`${baseUrl}/${secondaryPodId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: validPodPayload.name,
      }),
    });
    const body10 = await res10.json();
    const passed10 = res10.status === 409 && body10.success === false;
    recordResult(10, 'Update pod with duplicate name of another pod', passed10, `Status: ${res10.status}, Message: "${body10.message}"`);

    // ---------------------------------------------------------------
    // 11. Prevent deletion of a pod that has assigned employees
    // ---------------------------------------------------------------
    // Temporarily assign an employee to primaryPodId
    await supabase.from('employees').update({ pod_id: primaryPodId }).eq('id', leadEmp.id);

    const res11 = await fetch(`${baseUrl}/${primaryPodId}`, {
      method: 'DELETE',
    });
    const body11 = await res11.json();
    const passed11 = res11.status === 409 && body11.success === false;
    recordResult(11, 'Prevent deletion of a pod with assigned employees', passed11, `Status: ${res11.status}, Message: "${body11.message}"`);

    // Unassign employee so we can clean up cleanly
    await supabase.from('employees').update({ pod_id: null }).eq('id', leadEmp.id);

    // ---------------------------------------------------------------
    // 12. Delete an unreferenced pod
    // ---------------------------------------------------------------
    const res12 = await fetch(`${baseUrl}/${secondaryPodId}`, {
      method: 'DELETE',
    });
    const body12 = await res12.json();
    const passed12 = res12.status === 200 && body12.success === true;
    recordResult(12, 'Delete an unreferenced pod successfully', passed12, `Status: ${res12.status}, Message: "${body12.message}"`);

    // Remove secondaryPodId from createdPodIds since it was deleted
    const delIdx = createdPodIds.indexOf(secondaryPodId);
    if (delIdx !== -1) createdPodIds.splice(delIdx, 1);
  } catch (error) {
    console.error('Unexpected test error in Pod test suite:', error);
    testResults.push({ scenarioNum: 'CRASH', title: 'Unhandled exception', passed: false, details: error.message });
  } finally {
    await new Promise((resolve) => server.close(resolve));

    // Cleanup in dependency-safe order
    console.log('\n🧹 Cleaning up pod test records from Supabase...');
    for (const podId of createdPodIds) {
      // Clear lead_employee_id before deleting employees
      await supabase.from('pods').update({ lead_employee_id: null }).eq('id', podId);
      await supabase.from('pods').delete().eq('id', podId);
    }
    for (const empId of createdEmployeeIds) {
      await supabase.from('employees').delete().eq('id', empId);
    }
    console.log('✨ Pod test cleanup complete.\n');
  }

  const allPassed = testResults.length === 12 && testResults.every((r) => r.passed);
  console.log(`Pod Test Summary: ${testResults.filter((r) => r.passed).length}/${testResults.length} Passed`);
  return { allPassed, results: testResults };
}

// Allow direct execution
if (process.argv[1]?.endsWith('pod.test.js')) {
  runPodTests().then(({ allPassed }) => {
    process.exit(allPassed ? 0 : 1);
  });
}
