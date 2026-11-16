import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

const createdBrandIds = [];
const createdProcessIds = [];
const createdRuleIds = [];

export async function runWorkingRuleTests() {
  console.log('====================================================');
  console.log('🧪 Starting Working Rules API Test Suite (12 Scenarios)');
  console.log('====================================================\n');

  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/working-rules`;
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

    // Setup brand
    const { data: testBrand } = await supabase
      .from('brands')
      .insert([{ name: `Rule Brand ${ts}` }])
      .select()
      .single();
    if (testBrand) createdBrandIds.push(testBrand.id);

    // Setup process
    const { data: testProc } = await supabase
      .from('processes')
      .insert([{ code: `RP${ts.slice(-3)}`, name: 'Rule Process' }])
      .select()
      .single();
    if (testProc) createdProcessIds.push(testProc.id);

    let primaryRuleId = null;

    // 1. Create valid working rule with weekday names
    const res1 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: testBrand.id,
        process_id: testProc.id,
        operating_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        required_staff_count: 2,
        operates_on_public_holidays: false,
        effective_from: '2026-01-01',
      }),
    });
    const body1 = await res1.json();
    const passed1 =
      res1.status === 201 &&
      body1.success === true &&
      Array.isArray(body1.data?.operating_days) &&
      body1.data?.operating_days.includes(1) && // Monday is 1
      body1.data?.required_staff_count === 2;

    if (body1.data?.id) {
      primaryRuleId = body1.data.id;
      createdRuleIds.push(primaryRuleId);
    }
    recordResult(1, 'Create valid working rule with weekday names converted to smallint[]', passed1, `Status: ${res1.status}, ID: ${primaryRuleId}`);

    // 2. Reject working rule with empty operating days
    const res2 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: testBrand.id,
        process_id: testProc.id,
        operating_days: [],
        required_staff_count: 1,
      }),
    });
    const passed2 = res2.status === 400;
    recordResult(2, 'Reject rule with empty operating days', passed2, `Status: ${res2.status}`);

    // 3. Reject working rule with staff count <= 0
    const res3 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: testBrand.id,
        process_id: testProc.id,
        operating_days: ['Monday'],
        required_staff_count: 0,
      }),
    });
    const passed3 = res3.status === 400;
    recordResult(3, 'Reject rule with required staff count <= 0', passed3, `Status: ${res3.status}`);

    // 4. Reject working rule with effective_to < effective_from
    const res4 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: testBrand.id,
        process_id: testProc.id,
        operating_days: ['Monday'],
        required_staff_count: 1,
        effective_from: '2026-06-01',
        effective_to: '2026-05-01',
      }),
    });
    const passed4 = res4.status === 400;
    recordResult(4, 'Reject invalid date range (effective_to < effective_from)', passed4, `Status: ${res4.status}`);

    // 5. Reject working rule with nonexistent brand
    const res5 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: '00000000-0000-0000-0000-000000000000',
        process_id: testProc.id,
        operating_days: ['Monday'],
        required_staff_count: 1,
      }),
    });
    const passed5 = res5.status === 400;
    recordResult(5, 'Reject nonexistent brand reference', passed5, `Status: ${res5.status}`);

    // 6. Reject working rule with nonexistent process
    const res6 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: testBrand.id,
        process_id: '00000000-0000-0000-0000-000000000000',
        operating_days: ['Monday'],
        required_staff_count: 1,
      }),
    });
    const passed6 = res6.status === 400;
    recordResult(6, 'Reject nonexistent process reference', passed6, `Status: ${res6.status}`);

    // 7. Fetch all working rules filtered by brand
    const res7 = await fetch(`${baseUrl}?brand_id=${testBrand.id}`);
    const body7 = await res7.json();
    const passed7 = res7.status === 200 && Array.isArray(body7.data) && body7.data.length >= 1;
    recordResult(7, 'Fetch working rules filtered by brand', passed7, `Status: ${res7.status}, Count: ${body7.data?.length}`);

    // 8. Fetch working rule by ID with operating_day_names
    const res8 = await fetch(`${baseUrl}/${primaryRuleId}`);
    const body8 = await res8.json();
    const passed8 =
      res8.status === 200 &&
      Array.isArray(body8.data?.operating_day_names) &&
      body8.data?.operating_day_names.includes('Monday');
    recordResult(8, 'Fetch working rule by ID with operating day names', passed8, `Status: ${res8.status}, Operating names: ${body8.data?.operating_day_names?.join(', ')}`);

    // 9. Update working rule operating days and staff count
    const res9 = await fetch(`${baseUrl}/${primaryRuleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operating_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        required_staff_count: 3,
      }),
    });
    const body9 = await res9.json();
    const passed9 = res9.status === 200 && body9.data?.required_staff_count === 3 && body9.data?.operating_days?.length === 6;
    recordResult(9, 'Update rule operating days and required staff count', passed9, `Status: ${res9.status}, New staff count: 3`);

    // 10. Update working rule effective_to date
    const res10 = await fetch(`${baseUrl}/${primaryRuleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ effective_to: '2026-12-31' }),
    });
    const body10 = await res10.json();
    const passed10 = res10.status === 200 && body10.data?.effective_to === '2026-12-31';
    recordResult(10, 'Update rule effective_to date', passed10, `Status: ${res10.status}, effective_to: ${body10.data?.effective_to}`);

    // 11. Delete working rule
    const res11 = await fetch(`${baseUrl}/${primaryRuleId}`, { method: 'DELETE' });
    const passed11 = res11.status === 200;
    recordResult(11, 'Delete working rule', passed11, `Status: ${res11.status}`);

    const idx = createdRuleIds.indexOf(primaryRuleId);
    if (idx !== -1) createdRuleIds.splice(idx, 1);

    // 12. Verify deleted rule returns 404
    const res12 = await fetch(`${baseUrl}/${primaryRuleId}`);
    const passed12 = res12.status === 404;
    recordResult(12, 'Verify deleted working rule returns 404', passed12, `Status: ${res12.status}`);
  } catch (error) {
    console.error('Working rule test error:', error);
    testResults.push({ scenarioNum: 'CRASH', title: 'Unhandled exception', passed: false, details: error.message });
  } finally {
    await new Promise((resolve) => server.close(resolve));

    console.log('\n🧹 Cleaning up working rule test records from Supabase...');
    for (const rId of createdRuleIds) await supabase.from('working_rules').delete().eq('id', rId);
    for (const pId of createdProcessIds) await supabase.from('processes').delete().eq('id', pId);
    for (const bId of createdBrandIds) await supabase.from('brands').delete().eq('id', bId);
    console.log('✨ Working rule cleanup complete.\n');
  }

  const allPassed = testResults.length === 12 && testResults.every((r) => r.passed);
  console.log(`Working Rule Test Summary: ${testResults.filter((r) => r.passed).length}/${testResults.length} Passed`);
  return { allPassed, results: testResults };
}

if (process.argv[1]?.endsWith('workingRule.test.js')) {
  runWorkingRuleTests().then(({ allPassed }) => process.exit(allPassed ? 0 : 1));
}
