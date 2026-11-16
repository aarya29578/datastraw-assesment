import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

const createdBrandIds = [];
const createdPodIds = [];
const createdEmployeeIds = [];
const createdProcessIds = [];
const createdAssignmentIds = [];

export async function runBrandTests() {
  console.log('====================================================');
  console.log('🧪 Starting Brands API Test Suite (12 Scenarios)');
  console.log('====================================================\n');

  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/brands`;
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

    // Setup a valid test pod for testing pod reference
    const { data: testPod, error: podErr } = await supabase
      .from('pods')
      .insert([{ name: `Brand Test Pod ${timestamp}` }])
      .select()
      .single();

    if (podErr) throw new Error('Test pod setup error: ' + podErr.message);
    createdPodIds.push(testPod.id);

    let primaryBrandId = null;
    let secondaryBrandId = null;

    // ---------------------------------------------------------------
    // 1. Create a valid brand
    // ---------------------------------------------------------------
    const validBrandPayload = {
      name: `Stripe Payments ${timestamp}`,
      description: 'Online payment infrastructure for the internet',
      pod_id: testPod.id,
      status: 'ACTIVE',
    };

    const res1 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBrandPayload),
    });
    const body1 = await res1.json();
    const passed1 =
      res1.status === 201 &&
      body1.success === true &&
      body1.data?.name === validBrandPayload.name &&
      body1.data?.status === 'ACTIVE' &&
      body1.data?.pod_id === testPod.id &&
      Array.isArray(body1.data?.pods) &&
      body1.data.pods.some((p) => p.id === testPod.id);

    if (body1.data?.id) {
      primaryBrandId = body1.data.id;
      createdBrandIds.push(primaryBrandId);
    }
    recordResult(1, 'Create a valid brand with operational pod', passed1, `Status: ${res1.status}, ID: ${primaryBrandId}, Pod: ${body1.data?.pod_id}`);

    // ---------------------------------------------------------------
    // 2. Reject brand with missing required name
    // ---------------------------------------------------------------
    const res2 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'No brand name' }),
    });
    const body2 = await res2.json();
    const passed2 = res2.status === 400 && body2.success === false;
    recordResult(2, 'Create a brand with missing required name', passed2, `Status: ${res2.status}, Message: "${body2.message}"`);

    // ---------------------------------------------------------------
    // 3. Reject duplicate brand name
    // ---------------------------------------------------------------
    const res3 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: validBrandPayload.name }),
    });
    const body3 = await res3.json();
    const passed3 = res3.status === 409 && body3.success === false;
    recordResult(3, 'Create a brand with duplicate name', passed3, `Status: ${res3.status}, Message: "${body3.message}"`);

    // ---------------------------------------------------------------
    // 4. Reject brand with nonexistent or invalid pod reference
    // ---------------------------------------------------------------
    const res4a = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Nonexistent Pod Brand ${timestamp}`,
        pod_id: '00000000-0000-0000-0000-000000000000',
      }),
    });
    const body4a = await res4a.json();

    const res4b = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Invalid Pod UUID Brand ${timestamp}`,
        pod_id: 'not-a-valid-uuid',
      }),
    });
    const body4b = await res4b.json();

    const passed4 = res4a.status === 400 && res4b.status === 400;
    recordResult(4, 'Reject brand with invalid or nonexistent pod reference', passed4, `Nonexistent -> ${res4a.status}, Malformed -> ${res4b.status}`);

    // Create a second brand for search, update and deactivation testing
    const res2ndBrand = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Shopify E-Commerce ${timestamp}`,
        description: 'Multi-channel commerce platform',
      }),
    });
    const body2ndBrand = await res2ndBrand.json();
    if (body2ndBrand.data?.id) {
      secondaryBrandId = body2ndBrand.data.id;
      createdBrandIds.push(secondaryBrandId);
    }

    // ---------------------------------------------------------------
    // 5. Fetch all brands with pagination, search, and status filter
    // ---------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}?search=Stripe&status=ACTIVE&page=1&limit=10`);
    const body5 = await res5.json();
    const passed5 =
      res5.status === 200 &&
      body5.success === true &&
      Array.isArray(body5.data) &&
      body5.data.some((b) => b.id === primaryBrandId);
    recordResult(5, 'Fetch all brands with search, status, and pagination', passed5, `Status: ${res5.status}, Filtered count: ${body5.data?.length}, Total: ${body5.pagination?.total}`);

    // ---------------------------------------------------------------
    // 6. Fetch brand by ID with joined working_rules
    // ---------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/${primaryBrandId}`);
    const body6 = await res6.json();
    const passed6 =
      res6.status === 200 &&
      body6.success === true &&
      body6.data?.id === primaryBrandId &&
      Array.isArray(body6.data?.working_rules);
    recordResult(6, 'Fetch brand by ID with joined working rules', passed6, `Status: ${res6.status}, Brand: "${body6.data?.name}", Working rules count: ${body6.data?.working_rules?.length}`);

    // ---------------------------------------------------------------
    // 7. Fetch brand with invalid ID
    // ---------------------------------------------------------------
    const res7a = await fetch(`${baseUrl}/invalid-uuid-abc`);
    const res7b = await fetch(`${baseUrl}/00000000-0000-0000-0000-000000000000`);
    const passed7 = res7a.status === 400 && res7b.status === 404;
    recordResult(7, 'Fetch brand with invalid ID format and nonexistent ID', passed7, `Malformed UUID -> ${res7a.status}, Nonexistent UUID -> ${res7b.status}`);

    // ---------------------------------------------------------------
    // 8. Update brand details & change operational pod
    // ---------------------------------------------------------------
    // Setup a second test pod to test pod reassignment
    const { data: secondPod } = await supabase
      .from('pods')
      .insert([{ name: `Secondary Brand Test Pod ${timestamp}` }])
      .select()
      .single();
    if (secondPod) createdPodIds.push(secondPod.id);

    const res8 = await fetch(`${baseUrl}/${primaryBrandId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Updated global payment infrastructure description',
        pod_id: secondPod?.id,
      }),
    });
    const body8 = await res8.json();

    // Verify persistence via separate GET call
    const res8Verify = await fetch(`${baseUrl}/${primaryBrandId}`);
    const body8Verify = await res8Verify.json();

    // Verify removing pod association
    const res8Remove = await fetch(`${baseUrl}/${primaryBrandId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pod_id: null }),
    });
    const body8Remove = await res8Remove.json();

    // Restore pod for downstream deactivation tests
    await fetch(`${baseUrl}/${primaryBrandId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pod_id: testPod.id }),
    });

    const passed8 =
      res8.status === 200 &&
      body8.success === true &&
      body8.data?.description === 'Updated global payment infrastructure description' &&
      body8.data?.pod_id === secondPod?.id &&
      res8Verify.status === 200 &&
      body8Verify.data?.pod_id === secondPod?.id &&
      res8Remove.status === 200 &&
      (body8Remove.data?.pod_id === null || body8Remove.data?.pod_id !== secondPod?.id);

    recordResult(8, 'Update brand description, change pod, persist and remove pod', passed8, `Updated Pod: ${body8.data?.pod_id}, Persisted: ${body8Verify.data?.pod_id}`);

    // ---------------------------------------------------------------
    // 9. Reject updating brand with duplicate name
    // ---------------------------------------------------------------
    const res9 = await fetch(`${baseUrl}/${secondaryBrandId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: validBrandPayload.name,
      }),
    });
    const body9 = await res9.json();
    const passed9 = res9.status === 409 && body9.success === false;
    recordResult(9, 'Update brand with duplicate name of another brand', passed9, `Status: ${res9.status}, Message: "${body9.message}"`);

    // ---------------------------------------------------------------
    // 10. Soft-deactivate an active brand
    // ---------------------------------------------------------------
    const res10 = await fetch(`${baseUrl}/${secondaryBrandId}`, {
      method: 'DELETE',
    });
    const body10 = await res10.json();
    const passed10 =
      res10.status === 200 &&
      body10.success === true &&
      body10.data?.status === 'INACTIVE';
    recordResult(10, 'Soft-deactivate an active brand', passed10, `Status: ${res10.status}, New status: ${body10.data?.status}`);

    // ---------------------------------------------------------------
    // 11. Attempt to deactivate an already inactive brand
    // ---------------------------------------------------------------
    const res11 = await fetch(`${baseUrl}/${secondaryBrandId}`, {
      method: 'DELETE',
    });
    const body11 = await res11.json();
    const passed11 = res11.status === 409 && body11.success === false;
    recordResult(11, 'Attempt to deactivate an already inactive brand', passed11, `Status: ${res11.status}, Message: "${body11.message}"`);

    // ---------------------------------------------------------------
    // 12. Prevent deactivation if brand has active employee assignments
    // ---------------------------------------------------------------
    // Setup a temporary employee, process, and assignment linked to primaryBrandId
    const { data: testEmp } = await supabase
      .from('employees')
      .insert([
        {
          employee_code: `BR-EMP-${timestamp}`,
          full_name: 'Brand Worker',
          employment_status: 'ACTIVE',
        },
      ])
      .select()
      .single();
    if (testEmp) createdEmployeeIds.push(testEmp.id);

    const { data: testProc } = await supabase
      .from('processes')
      .insert([
        {
          code: `BP${timestamp}`,
          name: `Brand Process ${timestamp}`,
          status: 'ACTIVE',
        },
      ])
      .select()
      .single();
    if (testProc) createdProcessIds.push(testProc.id);

    const { data: testAsgn } = await supabase
      .from('employee_assignments')
      .insert([
        {
          employee_id: testEmp.id,
          brand_id: primaryBrandId,
          process_id: testProc.id,
          is_primary: true,
        },
      ])
      .select()
      .single();
    if (testAsgn) createdAssignmentIds.push(testAsgn.id);

    const res12 = await fetch(`${baseUrl}/${primaryBrandId}`, {
      method: 'DELETE',
    });
    const body12 = await res12.json();
    const passed12 = res12.status === 409 && body12.success === false;
    recordResult(12, 'Prevent deactivation of brand with active employee assignments', passed12, `Status: ${res12.status}, Message: "${body12.message}"`);
  } catch (error) {
    console.error('Unexpected error in Brand test suite:', error);
    testResults.push({ scenarioNum: 'CRASH', title: 'Unhandled exception', passed: false, details: error.message });
  } finally {
    await new Promise((resolve) => server.close(resolve));

    // Cleanup in dependency-safe order
    console.log('\n🧹 Cleaning up brand test records from Supabase...');
    for (const asgnId of createdAssignmentIds) {
      await supabase.from('employee_assignments').delete().eq('id', asgnId);
    }
    for (const procId of createdProcessIds) {
      await supabase.from('processes').delete().eq('id', procId);
    }
    for (const empId of createdEmployeeIds) {
      await supabase.from('employees').delete().eq('id', empId);
    }
    for (const brandId of createdBrandIds) {
      await supabase.from('brands').delete().eq('id', brandId);
    }
    for (const podId of createdPodIds) {
      await supabase.from('pods').delete().eq('id', podId);
    }
    console.log('✨ Brand test cleanup complete.\n');
  }

  const allPassed = testResults.length === 12 && testResults.every((r) => r.passed);
  console.log(`Brand Test Summary: ${testResults.filter((r) => r.passed).length}/${testResults.length} Passed`);
  return { allPassed, results: testResults };
}

// Allow direct execution
if (process.argv[1]?.endsWith('brand.test.js')) {
  runBrandTests().then(({ allPassed }) => {
    process.exit(allPassed ? 0 : 1);
  });
}
