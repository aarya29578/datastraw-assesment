import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

const createdEmployeeIds = [];
let testPodId = null;

export async function runEmployeeTests() {
  console.log('====================================================');
  console.log('🧪 Starting Employee Management API Test Suite (12 Scenarios)');
  console.log('====================================================\n');

  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/employees`;
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
    // Setup a temporary test pod for testing pod reference & filter
    const { data: podData, error: podErr } = await supabase
      .from('pods')
      .insert([{ name: 'Test Operations Pod', description: 'Temporary testing pod' }])
      .select()
      .single();

    if (podErr) throw new Error('Pod setup error: ' + podErr.message);
    testPodId = podData.id;

    let primaryEmpId = null;
    let secondaryEmpId = null;

    // ---------------------------------------------------------------
    // 1. Create a valid employee
    // ---------------------------------------------------------------
    const validEmpPayload = {
      employee_code: `TEST-EMP-001-${Date.now().toString().slice(-4)}`,
      full_name: 'Rahul Sharma',
      email: `rahul.test.${Date.now()}@example.com`,
      phone: '+91 9876543210',
      pod_id: testPodId,
      designation: 'Customer Support Executive',
      joining_date: '2026-01-15',
    };

    const res1 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validEmpPayload),
    });
    const body1 = await res1.json();
    const passed1 =
      res1.status === 201 &&
      body1.success === true &&
      body1.data?.employee_code === validEmpPayload.employee_code &&
      body1.data?.employment_status === 'ACTIVE';

    if (body1.data?.id) {
      primaryEmpId = body1.data.id;
      createdEmployeeIds.push(primaryEmpId);
    }
    recordResult(
      1,
      'Create a valid employee',
      passed1,
      `Status: ${res1.status}, ID: ${primaryEmpId}, Status: ${body1.data?.employment_status}`
    );

    // ---------------------------------------------------------------
    // 2. Create an employee with a duplicate employee code
    // ---------------------------------------------------------------
    const dupCodePayload = {
      employee_code: validEmpPayload.employee_code, // duplicate
      full_name: 'Rahul Duplicate',
      email: `rahul.dup.${Date.now()}@example.com`,
      phone: '9876543211',
    };

    const res2 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dupCodePayload),
    });
    const body2 = await res2.json();
    const passed2 = res2.status === 409 && body2.success === false;
    recordResult(
      2,
      'Create an employee with a duplicate employee code',
      passed2,
      `Status: ${res2.status}, Message: "${body2.message}"`
    );

    // ---------------------------------------------------------------
    // 3. Create an employee with an invalid email
    // ---------------------------------------------------------------
    const invalidEmailPayload = {
      employee_code: `TEST-INVALID-${Date.now().toString().slice(-4)}`,
      full_name: 'Bad Email User',
      email: 'not-an-email-address',
    };

    const res3 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidEmailPayload),
    });
    const body3 = await res3.json();
    const passed3 = res3.status === 400 && body3.success === false;
    recordResult(
      3,
      'Create an employee with an invalid email',
      passed3,
      `Status: ${res3.status}, Message: "${body3.message}"`
    );

    // ---------------------------------------------------------------
    // Create a second valid employee for search, filter & update tests
    // ---------------------------------------------------------------
    const secEmpPayload = {
      employee_code: `TEST-EMP-002-${Date.now().toString().slice(-4)}`,
      full_name: 'Priya Patel',
      email: `priya.test.${Date.now()}@example.com`,
      phone: '+91 9123456789',
      pod_id: null,
      designation: 'Retention Specialist',
      joining_date: '2026-02-01',
    };
    const secRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(secEmpPayload),
    });
    const secBody = await secRes.json();
    if (secBody.data?.id) {
      secondaryEmpId = secBody.data.id;
      createdEmployeeIds.push(secondaryEmpId);
    }

    // ---------------------------------------------------------------
    // 4. Fetch all employees
    // ---------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}?page=1&limit=10`);
    const body4 = await res4.json();
    const passed4 =
      res4.status === 200 &&
      body4.success === true &&
      Array.isArray(body4.data) &&
      body4.pagination &&
      body4.pagination.total >= 2;
    recordResult(
      4,
      'Fetch all employees',
      passed4,
      `Status: ${res4.status}, Count: ${body4.data?.length}, Total: ${body4.pagination?.total}`
    );

    // ---------------------------------------------------------------
    // 5. Search employees
    // ---------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}?search=Rahul`);
    const body5 = await res5.json();
    const foundRahul = body5.data?.some((e) => e.full_name.includes('Rahul'));
    const passed5 = res5.status === 200 && body5.success === true && foundRahul;
    recordResult(
      5,
      'Search employees',
      passed5,
      `Status: ${res5.status}, Search results: ${body5.data?.length}, Found matching: ${foundRahul}`
    );

    // ---------------------------------------------------------------
    // 6. Filter employees by pod
    // ---------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}?pod_id=${testPodId}`);
    const body6 = await res6.json();
    const allInPod = body6.data?.every((e) => e.pod_id === testPodId);
    const passed6 =
      res6.status === 200 &&
      body6.success === true &&
      body6.data?.length > 0 &&
      allInPod;
    recordResult(
      6,
      'Filter employees by pod',
      passed6,
      `Status: ${res6.status}, Filtered count: ${body6.data?.length}, Matches Pod: ${allInPod}`
    );

    // ---------------------------------------------------------------
    // 7. Fetch employee by ID
    // ---------------------------------------------------------------
    const res7 = await fetch(`${baseUrl}/${primaryEmpId}`);
    const body7 = await res7.json();
    const passed7 =
      res7.status === 200 &&
      body7.success === true &&
      body7.data?.id === primaryEmpId &&
      body7.data?.employee_code === validEmpPayload.employee_code;
    recordResult(
      7,
      'Fetch employee by ID',
      passed7,
      `Status: ${res7.status}, Name: ${body7.data?.full_name}, Pod info joined: ${Boolean(body7.data?.pod)}`
    );

    // ---------------------------------------------------------------
    // 8. Fetch employee with an invalid ID
    // ---------------------------------------------------------------
    // Test 8a: Malformed UUID
    const res8a = await fetch(`${baseUrl}/not-a-valid-uuid-12345`);
    const body8a = await res8a.json();
    // Test 8b: Valid UUID format but non-existent
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const res8b = await fetch(`${baseUrl}/${fakeUuid}`);
    const body8b = await res8b.json();

    const passed8 =
      res8a.status === 400 &&
      body8a.success === false &&
      res8b.status === 404 &&
      body8b.success === false;

    recordResult(
      8,
      'Fetch employee with an invalid ID',
      passed8,
      `Malformed UUID -> ${res8a.status} ("${body8a.message}"), Non-existent UUID -> ${res8b.status} ("${body8b.message}")`
    );

    // ---------------------------------------------------------------
    // 9. Update employee details
    // ---------------------------------------------------------------
    const updatePayload = {
      full_name: 'Rahul Sharma (Updated)',
      designation: 'Senior Lead Operations',
      phone: '+91 9999988888',
    };
    const res9 = await fetch(`${baseUrl}/${primaryEmpId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });
    const body9 = await res9.json();
    const passed9 =
      res9.status === 200 &&
      body9.success === true &&
      body9.data?.full_name === updatePayload.full_name &&
      body9.data?.designation === updatePayload.designation &&
      body9.data?.phone === updatePayload.phone;
    recordResult(
      9,
      'Update employee details',
      passed9,
      `Status: ${res9.status}, Updated Designation: "${body9.data?.designation}"`
    );

    // ---------------------------------------------------------------
    // 10. Update an employee with a duplicate email
    // ---------------------------------------------------------------
    // Attempt to set primaryEmpId's email to secondaryEmpId's email
    const dupEmailUpdatePayload = {
      email: secEmpPayload.email,
    };
    const res10 = await fetch(`${baseUrl}/${primaryEmpId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dupEmailUpdatePayload),
    });
    const body10 = await res10.json();
    const passed10 = res10.status === 409 && body10.success === false;
    recordResult(
      10,
      'Update an employee with a duplicate email',
      passed10,
      `Status: ${res10.status}, Message: "${body10.message}"`
    );

    // ---------------------------------------------------------------
    // 11. Deactivate an employee
    // ---------------------------------------------------------------
    const res11 = await fetch(`${baseUrl}/${primaryEmpId}`, {
      method: 'DELETE',
    });
    const body11 = await res11.json();
    const passed11 =
      res11.status === 200 &&
      body11.success === true &&
      body11.data?.employment_status === 'INACTIVE';
    recordResult(
      11,
      'Deactivate an employee (soft delete)',
      passed11,
      `Status: ${res11.status}, New status: ${body11.data?.employment_status}`
    );

    // ---------------------------------------------------------------
    // 12. Attempt to deactivate the same employee again
    // ---------------------------------------------------------------
    const res12 = await fetch(`${baseUrl}/${primaryEmpId}`, {
      method: 'DELETE',
    });
    const body12 = await res12.json();
    const passed12 = res12.status === 409 && body12.success === false;
    recordResult(
      12,
      'Attempt to deactivate the same employee again',
      passed12,
      `Status: ${res12.status}, Message: "${body12.message}"`
    );

    console.log('\n====================================================');
    const allPassed = testResults.every((t) => t.passed);
    console.log(`🏁 Test Summary: ${testResults.filter((t) => t.passed).length}/12 Passed`);
    console.log(`Overall Result: ${allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
    console.log('====================================================');
  } finally {
    // Clean up created test data safely
    console.log('\n🧹 Cleaning up test records from Supabase...');
    for (const empId of createdEmployeeIds) {
      await supabase.from('employees').delete().eq('id', empId);
    }
    if (testPodId) {
      await supabase.from('pods').delete().eq('id', testPodId);
    }
    console.log('✨ Cleanup complete.\n');
    await new Promise((resolve) => server.close(resolve));
  }

  const allPassed = testResults.length === 12 && testResults.every((r) => r.passed);
  console.log(`Employee Test Summary: ${testResults.filter((r) => r.passed).length}/${testResults.length} Passed`);
  return { allPassed, results: testResults };
}

if (process.argv[1]?.endsWith('employee.test.js')) {
  runEmployeeTests().then(({ allPassed }) => {
    process.exit(allPassed ? 0 : 1);
  });
}
