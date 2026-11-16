import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

const createdProcessIds = [];
const createdBrandIds = [];
const createdEmployeeIds = [];
const createdAssignmentIds = [];

export async function runProcessTests() {
  console.log('====================================================');
  console.log('🧪 Starting Processes API Test Suite (12 Scenarios)');
  console.log('====================================================\n');

  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/processes`;
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

    // Setup a valid test brand for testing brand reference
    const { data: testBrand, error: brandErr } = await supabase
      .from('brands')
      .insert([{ name: `Process Test Brand ${timestamp}` }])
      .select()
      .single();

    if (brandErr) throw new Error('Test brand setup error: ' + brandErr.message);
    createdBrandIds.push(testBrand.id);

    let primaryProcId = null;
    let secondaryProcId = null;

    // ---------------------------------------------------------------
    // 1. Create a valid process with code and name
    // ---------------------------------------------------------------
    const validProcessPayload = {
      code: `CHAT${timestamp.slice(-4)}`,
      name: 'Tier 1 Live Chat Support',
      description: 'Handles incoming user chat queries in real-time',
      brand_id: testBrand.id,
      status: 'ACTIVE',
    };

    const res1 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validProcessPayload),
    });
    const body1 = await res1.json();
    const passed1 =
      res1.status === 201 &&
      body1.success === true &&
      body1.data?.code === validProcessPayload.code &&
      body1.data?.name === validProcessPayload.name &&
      body1.data?.status === 'ACTIVE';

    if (body1.data?.id) {
      primaryProcId = body1.data.id;
      createdProcessIds.push(primaryProcId);
    }
    recordResult(1, 'Create a valid process', passed1, `Status: ${res1.status}, ID: ${primaryProcId}, Code: ${body1.data?.code}`);

    // ---------------------------------------------------------------
    // 2. Reject process with missing required code or name
    // ---------------------------------------------------------------
    const res2a = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Process with no code' }),
    });
    const body2a = await res2a.json();

    const res2b = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: `NNAME${timestamp}` }),
    });
    const body2b = await res2b.json();

    const passed2 = res2a.status === 400 && res2b.status === 400;
    recordResult(2, 'Reject process with missing required code or name', passed2, `Missing code -> ${res2a.status}, Missing name -> ${res2b.status}`);

    // ---------------------------------------------------------------
    // 3. Reject duplicate process code
    // ---------------------------------------------------------------
    const res3 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: validProcessPayload.code,
        name: 'Another Process Same Code',
      }),
    });
    const body3 = await res3.json();
    const passed3 = res3.status === 409 && body3.success === false;
    recordResult(3, 'Create a process with duplicate code', passed3, `Status: ${res3.status}, Message: "${body3.message}"`);

    // ---------------------------------------------------------------
    // 4. Reject process with nonexistent or invalid brand reference
    // ---------------------------------------------------------------
    const res4a = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `NOBR${timestamp.slice(-4)}`,
        name: 'Nonexistent Brand Process',
        brand_id: '00000000-0000-0000-0000-000000000000',
      }),
    });
    const body4a = await res4a.json();

    const res4b = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `INVBR${timestamp.slice(-4)}`,
        name: 'Invalid Brand UUID Process',
        brand_id: 'invalid-brand-uuid',
      }),
    });
    const body4b = await res4b.json();

    const passed4 = res4a.status === 400 && res4b.status === 400;
    recordResult(4, 'Reject process with invalid or nonexistent brand reference', passed4, `Nonexistent -> ${res4a.status}, Malformed -> ${res4b.status}`);

    // Create a second process for search, update, and deactivation testing
    const res2ndProc = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `VOIC${timestamp.slice(-4)}`,
        name: 'Voice Inbound Inquiries',
        description: 'Telephony queue handling',
      }),
    });
    const body2ndProc = await res2ndProc.json();
    if (body2ndProc.data?.id) {
      secondaryProcId = body2ndProc.data.id;
      createdProcessIds.push(secondaryProcId);
    }

    // ---------------------------------------------------------------
    // 5. Fetch all processes with pagination, search, and status filter
    // ---------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}?search=CHAT&status=ACTIVE&page=1&limit=10`);
    const body5 = await res5.json();
    const passed5 =
      res5.status === 200 &&
      body5.success === true &&
      Array.isArray(body5.data) &&
      body5.data.some((p) => p.id === primaryProcId);
    recordResult(5, 'Fetch all processes with search, status, and pagination', passed5, `Status: ${res5.status}, Filtered count: ${body5.data?.length}, Total: ${body5.pagination?.total}`);

    // ---------------------------------------------------------------
    // 6. Fetch process by ID with joined working_rules
    // ---------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/${primaryProcId}`);
    const body6 = await res6.json();
    const passed6 =
      res6.status === 200 &&
      body6.success === true &&
      body6.data?.id === primaryProcId &&
      Array.isArray(body6.data?.working_rules);
    recordResult(6, 'Fetch process by ID with joined working rules', passed6, `Status: ${res6.status}, Process: "${body6.data?.name}", Working rules count: ${body6.data?.working_rules?.length}`);

    // ---------------------------------------------------------------
    // 7. Fetch process with invalid ID
    // ---------------------------------------------------------------
    const res7a = await fetch(`${baseUrl}/invalid-uuid-abc`);
    const res7b = await fetch(`${baseUrl}/00000000-0000-0000-0000-000000000000`);
    const passed7 = res7a.status === 400 && res7b.status === 404;
    recordResult(7, 'Fetch process with invalid ID format and nonexistent ID', passed7, `Malformed UUID -> ${res7a.status}, Nonexistent UUID -> ${res7b.status}`);

    // ---------------------------------------------------------------
    // 8. Update process details
    // ---------------------------------------------------------------
    const res8 = await fetch(`${baseUrl}/${primaryProcId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Updated real-time chat support queue',
      }),
    });
    const body8 = await res8.json();
    const passed8 =
      res8.status === 200 &&
      body8.success === true &&
      body8.data?.description === 'Updated real-time chat support queue';
    recordResult(8, 'Update process description', passed8, `Status: ${res8.status}, Confirmed description update`);

    // ---------------------------------------------------------------
    // 9. Reject updating process with duplicate code
    // ---------------------------------------------------------------
    const res9 = await fetch(`${baseUrl}/${secondaryProcId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: validProcessPayload.code,
      }),
    });
    const body9 = await res9.json();
    const passed9 = res9.status === 409 && body9.success === false;
    recordResult(9, 'Update process with duplicate code of another process', passed9, `Status: ${res9.status}, Message: "${body9.message}"`);

    // ---------------------------------------------------------------
    // 10. Soft-deactivate an active process
    // ---------------------------------------------------------------
    const res10 = await fetch(`${baseUrl}/${secondaryProcId}`, {
      method: 'DELETE',
    });
    const body10 = await res10.json();
    const passed10 =
      res10.status === 200 &&
      body10.success === true &&
      body10.data?.status === 'INACTIVE';
    recordResult(10, 'Soft-deactivate an active process', passed10, `Status: ${res10.status}, New status: ${body10.data?.status}`);

    // ---------------------------------------------------------------
    // 11. Attempt to deactivate an already inactive process
    // ---------------------------------------------------------------
    const res11 = await fetch(`${baseUrl}/${secondaryProcId}`, {
      method: 'DELETE',
    });
    const body11 = await res11.json();
    const passed11 = res11.status === 409 && body11.success === false;
    recordResult(11, 'Attempt to deactivate an already inactive process', passed11, `Status: ${res11.status}, Message: "${body11.message}"`);

    // ---------------------------------------------------------------
    // 12. Prevent deactivation if process has active employee assignments
    // ---------------------------------------------------------------
    // Setup a temporary employee and assignment linked to primaryProcId
    const { data: testEmp } = await supabase
      .from('employees')
      .insert([
        {
          employee_code: `PR-EMP-${timestamp}`,
          full_name: 'Process Agent',
          employment_status: 'ACTIVE',
        },
      ])
      .select()
      .single();
    if (testEmp) createdEmployeeIds.push(testEmp.id);

    const { data: testAsgn } = await supabase
      .from('employee_assignments')
      .insert([
        {
          employee_id: testEmp.id,
          brand_id: testBrand.id,
          process_id: primaryProcId,
          is_primary: true,
        },
      ])
      .select()
      .single();
    if (testAsgn) createdAssignmentIds.push(testAsgn.id);

    const res12 = await fetch(`${baseUrl}/${primaryProcId}`, {
      method: 'DELETE',
    });
    const body12 = await res12.json();
    const passed12 = res12.status === 409 && body12.success === false;
    recordResult(12, 'Prevent deactivation of process with active employee assignments', passed12, `Status: ${res12.status}, Message: "${body12.message}"`);
  } catch (error) {
    console.error('Unexpected error in Process test suite:', error);
    testResults.push({ scenarioNum: 'CRASH', title: 'Unhandled exception', passed: false, details: error.message });
  } finally {
    await new Promise((resolve) => server.close(resolve));

    // Cleanup in dependency-safe order
    console.log('\n🧹 Cleaning up process test records from Supabase...');
    for (const asgnId of createdAssignmentIds) {
      await supabase.from('employee_assignments').delete().eq('id', asgnId);
    }
    for (const empId of createdEmployeeIds) {
      await supabase.from('employees').delete().eq('id', empId);
    }
    for (const procId of createdProcessIds) {
      await supabase.from('processes').delete().eq('id', procId);
    }
    for (const brandId of createdBrandIds) {
      await supabase.from('brands').delete().eq('id', brandId);
    }
    console.log('✨ Process test cleanup complete.\n');
  }

  const allPassed = testResults.length === 12 && testResults.every((r) => r.passed);
  console.log(`Process Test Summary: ${testResults.filter((r) => r.passed).length}/${testResults.length} Passed`);
  return { allPassed, results: testResults };
}

// Allow direct execution
if (process.argv[1]?.endsWith('process.test.js')) {
  runProcessTests().then(({ allPassed }) => {
    process.exit(allPassed ? 0 : 1);
  });
}
