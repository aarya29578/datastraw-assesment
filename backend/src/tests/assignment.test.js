import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

const createdEmployeeIds = [];
const createdBrandIds = [];
const createdProcessIds = [];
const createdAssignmentIds = [];

export async function runAssignmentTests() {
  console.log('====================================================');
  console.log('🧪 Starting Assignment API Test Suite (12 Scenarios)');
  console.log('====================================================\n');

  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/assignments`;
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
    const ts = Date.now().toString().slice(-5);

    // Setup active employee
    const { data: activeEmp } = await supabase
      .from('employees')
      .insert([{ employee_code: `ASGN-A-${ts}`, full_name: 'Assignment Test Agent', employment_status: 'ACTIVE' }])
      .select()
      .single();
    if (activeEmp) createdEmployeeIds.push(activeEmp.id);

    // Setup inactive employee
    const { data: inactEmp } = await supabase
      .from('employees')
      .insert([{ employee_code: `ASGN-I-${ts}`, full_name: 'Inactive Agent', employment_status: 'INACTIVE' }])
      .select()
      .single();
    if (inactEmp) createdEmployeeIds.push(inactEmp.id);

    // Setup brand
    const { data: testBrand } = await supabase
      .from('brands')
      .insert([{ name: `Assignment Brand ${ts}` }])
      .select()
      .single();
    if (testBrand) createdBrandIds.push(testBrand.id);

    // Setup 2 processes
    const { data: proc1 } = await supabase
      .from('processes')
      .insert([{ code: `AP1-${ts.slice(-3)}`, name: 'Voice Support' }])
      .select()
      .single();
    if (proc1) createdProcessIds.push(proc1.id);

    const { data: proc2 } = await supabase
      .from('processes')
      .insert([{ code: `AP2-${ts.slice(-3)}`, name: 'Chat Support' }])
      .select()
      .single();
    if (proc2) createdProcessIds.push(proc2.id);

    let primaryAsgnId = null;

    // 1. Create valid assignment
    const res1 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: activeEmp.id,
        brand_id: testBrand.id,
        process_id: proc1.id,
        is_primary: true,
      }),
    });
    const body1 = await res1.json();
    const passed1 = res1.status === 201 && body1.success === true && body1.data?.employee_id === activeEmp.id;
    if (body1.data?.id) {
      primaryAsgnId = body1.data.id;
      createdAssignmentIds.push(primaryAsgnId);
    }
    recordResult(1, 'Create valid single assignment', passed1, `Status: ${res1.status}, ID: ${primaryAsgnId}`);

    // 2. Reject duplicate assignment
    const res2 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: activeEmp.id,
        brand_id: testBrand.id,
        process_id: proc1.id,
      }),
    });
    const body2 = await res2.json();
    const passed2 = res2.status === 409 && body2.success === false;
    recordResult(2, 'Reject duplicate assignment', passed2, `Status: ${res2.status}, Message: "${body2.message}"`);

    // 3. Multi-process fan-out creation
    const res3 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: activeEmp.id,
        brand_id: testBrand.id,
        process_ids: [proc2.id],
      }),
    });
    const body3 = await res3.json();
    const passed3 = res3.status === 201 && body3.success === true;
    if (body3.data?.id) createdAssignmentIds.push(body3.data.id);
    recordResult(3, 'Multi-process assignment fan-out creation', passed3, `Status: ${res3.status}`);

    // 4. Reject assignment with nonexistent employee
    const res4 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: '00000000-0000-0000-0000-000000000000',
        brand_id: testBrand.id,
        process_id: proc1.id,
      }),
    });
    const passed4 = res4.status === 400;
    recordResult(4, 'Reject nonexistent employee reference', passed4, `Status: ${res4.status}`);

    // 5. Reject assignment with nonexistent brand
    const res5 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: activeEmp.id,
        brand_id: '00000000-0000-0000-0000-000000000000',
        process_id: proc1.id,
      }),
    });
    const passed5 = res5.status === 400;
    recordResult(5, 'Reject nonexistent brand reference', passed5, `Status: ${res5.status}`);

    // 6. Reject assignment with nonexistent process
    const res6 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: activeEmp.id,
        brand_id: testBrand.id,
        process_id: '00000000-0000-0000-0000-000000000000',
      }),
    });
    const passed6 = res6.status === 400;
    recordResult(6, 'Reject nonexistent process reference', passed6, `Status: ${res6.status}`);

    // 7. Reject assignment creation for inactive employee
    const res7 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: inactEmp.id,
        brand_id: testBrand.id,
        process_id: proc1.id,
      }),
    });
    const passed7 = res7.status === 400;
    recordResult(7, 'Reject assignment for inactive employee', passed7, `Status: ${res7.status}`);

    // 8. Fetch all assignments with employee filter
    const res8 = await fetch(`${baseUrl}?employee_id=${activeEmp.id}`);
    const body8 = await res8.json();
    const passed8 = res8.status === 200 && Array.isArray(body8.data) && body8.data.length >= 1;
    recordResult(8, 'Fetch assignments filtered by employee', passed8, `Status: ${res8.status}, Count: ${body8.data?.length}`);

    // 9. Fetch assignment by ID with joined relations
    const res9 = await fetch(`${baseUrl}/${primaryAsgnId}`);
    const body9 = await res9.json();
    const passed9 =
      res9.status === 200 &&
      body9.data?.employee?.full_name === 'Assignment Test Agent' &&
      body9.data?.brand?.name === `Assignment Brand ${ts}`;
    recordResult(9, 'Fetch assignment by ID with joined employee, brand, process', passed9, `Status: ${res9.status}, Verified joins`);

    // 10. Update assignment (toggle is_primary)
    const res10 = await fetch(`${baseUrl}/${primaryAsgnId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_primary: false }),
    });
    const body10 = await res10.json();
    const passed10 = res10.status === 200 && body10.data?.is_primary === false;
    recordResult(10, 'Update assignment details', passed10, `Status: ${res10.status}, New is_primary: false`);

    // 11. Delete assignment successfully
    const res11 = await fetch(`${baseUrl}/${primaryAsgnId}`, { method: 'DELETE' });
    const passed11 = res11.status === 200;
    recordResult(11, 'Delete unreferenced assignment', passed11, `Status: ${res11.status}`);

    const idx = createdAssignmentIds.indexOf(primaryAsgnId);
    if (idx !== -1) createdAssignmentIds.splice(idx, 1);

    // 12. Fetch deleted assignment returns 404
    const res12 = await fetch(`${baseUrl}/${primaryAsgnId}`);
    const passed12 = res12.status === 404;
    recordResult(12, 'Verify deleted assignment returns 404', passed12, `Status: ${res12.status}`);
  } catch (error) {
    console.error('Assignment test error:', error);
    testResults.push({ scenarioNum: 'CRASH', title: 'Unhandled exception', passed: false, details: error.message });
  } finally {
    await new Promise((resolve) => server.close(resolve));

    console.log('\n🧹 Cleaning up assignment test records from Supabase...');
    for (const aId of createdAssignmentIds) await supabase.from('employee_assignments').delete().eq('id', aId);
    for (const pId of createdProcessIds) await supabase.from('processes').delete().eq('id', pId);
    for (const bId of createdBrandIds) await supabase.from('brands').delete().eq('id', bId);
    for (const eId of createdEmployeeIds) await supabase.from('employees').delete().eq('id', eId);
    console.log('✨ Assignment cleanup complete.\n');
  }

  const allPassed = testResults.length === 12 && testResults.every((r) => r.passed);
  console.log(`Assignment Test Summary: ${testResults.filter((r) => r.passed).length}/${testResults.length} Passed`);
  return { allPassed, results: testResults };
}

if (process.argv[1]?.endsWith('assignment.test.js')) {
  runAssignmentTests().then(({ allPassed }) => process.exit(allPassed ? 0 : 1));
}
