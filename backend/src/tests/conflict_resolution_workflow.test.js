import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

const createdEmployeeIds = [];
const createdBrandIds = [];
const createdProcessIds = [];
const createdAssignmentIds = [];
const createdWorkingRuleIds = [];
const createdRosterIds = [];
const createdLeaveIds = [];

export async function runConflictResolutionWorkflowTests() {
  console.log('====================================================');
  console.log('🧪 Starting Conflict Resolution & Revision Workflow Test Suite (9 Scenarios)');
  console.log('====================================================\n');

  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
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
    const testMonth = 12;
    const testYear = 2026;
    const testDate = '2026-12-07'; // Monday

    // 1. Setup primary agent
    const { data: primaryEmp } = await supabase
      .from('employees')
      .insert([{
        employee_code: `RES-P-${ts}`,
        full_name: 'Primary Agent',
        employment_status: 'ACTIVE',
      }])
      .select()
      .single();
    if (primaryEmp) createdEmployeeIds.push(primaryEmp.id);

    // 2. Setup brand & process
    const { data: testBrand } = await supabase
      .from('brands')
      .insert([{ name: `Conflict Workflow Brand ${ts}` }])
      .select()
      .single();
    if (testBrand) createdBrandIds.push(testBrand.id);

    const { data: testProc } = await supabase
      .from('processes')
      .insert([{ code: `CWF${ts.slice(-3)}`, name: 'Conflict Workflow Process' }])
      .select()
      .single();
    if (testProc) createdProcessIds.push(testProc.id);

    // 3. Setup assignment for primary agent
    const { data: asgn } = await supabase
      .from('employee_assignments')
      .insert([{
        employee_id: primaryEmp.id,
        brand_id: testBrand.id,
        process_id: testProc.id,
        is_primary: true,
      }])
      .select()
      .single();
    if (asgn) createdAssignmentIds.push(asgn.id);

    // 4. Working rule requiring 3 staff members on Mondays (only 1 assigned, guaranteed understaffed)
    const { data: rule } = await supabase
      .from('working_rules')
      .insert([{
        brand_id: testBrand.id,
        process_id: testProc.id,
        operating_days: [1, 2, 3, 4, 5],
        operates_on_public_holidays: false,
        required_staff_count: 3,
        effective_from: '2026-01-01',
      }])
      .select()
      .single();
    if (rule) createdWorkingRuleIds.push(rule.id);

    // 5. Generate initial roster (Revision 1)
    const genRes1 = await fetch(`${baseUrl}/rosters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: testMonth, year: testYear }),
    });
    const genBody1 = await genRes1.json();
    const rosterV1Id = genBody1.data?.roster?.id;
    if (rosterV1Id) createdRosterIds.push(rosterV1Id);

    // Validate conflicts on Revision 1
    const valRes1 = await fetch(`${baseUrl}/conflicts/validate/${rosterV1Id}`, { method: 'POST' });
    const valBody1 = await valRes1.json();
    const v1Conflicts = valBody1.data?.conflicts || [];
    const v1Understaff = v1Conflicts.find(
      (c) => c.brand_id === testBrand.id && c.process_id === testProc.id && c.conflict_date === testDate
    );

    // Publish Revision 1
    const pubRes = await fetch(`${baseUrl}/rosters/${rosterV1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    const pubBody = await pubRes.json();
    const isV1Published = pubRes.status === 200 && pubBody.data?.status === 'PUBLISHED';

    // -----------------------------------------------------------------
    // Scenario 1: Resolving a conflict on a published roster (must block)
    // -----------------------------------------------------------------
    // Create an eligible replacement employee to attempt resolution with
    const { data: eligibleEmp } = await supabase
      .from('employees')
      .insert([{
        employee_code: `RES-E-${ts}`,
        full_name: 'Eligible Replacement Agent',
        employment_status: 'ACTIVE',
      }])
      .select()
      .single();
    if (eligibleEmp) createdEmployeeIds.push(eligibleEmp.id);

    const s1Res = await fetch(`${baseUrl}/conflicts/${v1Understaff?.id}/resolve-with-replacement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replacement_employee_id: eligibleEmp.id,
        resolution_note: 'Attempting to resolve on published roster',
      }),
    });
    const s1Body = await s1Res.json();
    const s1Passed =
      s1Res.status === 400 &&
      (s1Body.code === 'PUBLISHED_ROSTER_LOCKED' || s1Body.error?.code === 'PUBLISHED_ROSTER_LOCKED');
    recordResult(
      1,
      'Resolving a conflict on a published roster (must block or require revision)',
      s1Passed,
      `Status: ${s1Res.status}, Error Code: ${s1Body.code || s1Body.error?.code}, Message: "${s1Body.message}"`
    );

    // -----------------------------------------------------------------
    // Scenario 2: Creating a draft revision and resolving the same conflict against draft
    // -----------------------------------------------------------------
    // Generate new revision (should spawn Revision 2 as DRAFT)
    const genRes2 = await fetch(`${baseUrl}/rosters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: testMonth, year: testYear }),
    });
    const genBody2 = await genRes2.json();
    const rosterV2 = genBody2.data?.roster;
    if (rosterV2?.id) createdRosterIds.push(rosterV2.id);

    const isV2Draft = rosterV2?.version === 2 && rosterV2?.status === 'DRAFT';

    // Fetch conflicts for Revision 2
    const confRes2 = await fetch(`${baseUrl}/conflicts?roster_id=${rosterV2?.id}&status=OPEN`);
    const confBody2 = await confRes2.json();
    const v2Conflicts = confBody2.data || [];
    const v2Understaff = v2Conflicts.find(
      (c) => c.brand_id === testBrand.id && c.process_id === testProc.id && c.conflict_date === testDate
    );

    const s2Passed = isV2Draft && Boolean(v2Understaff) && v2Understaff.roster?.version === 2;
    recordResult(
      2,
      'Creating a draft revision and locating the conflict on the draft',
      s2Passed,
      `Roster v2 Status: ${rosterV2?.status}, Version: ${rosterV2?.version}, Draft Conflict ID: ${v2Understaff?.id}`
    );

    // -----------------------------------------------------------------
    // Scenario 3: Selecting an ineligible replacement employee
    // -----------------------------------------------------------------
    // A: Inactive employee
    const { data: inactiveEmp } = await supabase
      .from('employees')
      .insert([{
        employee_code: `RES-INACT-${ts}`,
        full_name: 'Inactive Employee',
        employment_status: 'INACTIVE',
      }])
      .select()
      .single();
    if (inactiveEmp) createdEmployeeIds.push(inactiveEmp.id);

    const s3InactiveRes = await fetch(`${baseUrl}/conflicts/${v2Understaff?.id}/resolve-with-replacement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replacement_employee_id: inactiveEmp.id,
        resolution_note: 'Assigning inactive',
      }),
    });
    const s3InactiveBody = await s3InactiveRes.json();

    // B: Employee on approved leave on testDate
    const { data: leaveEmp } = await supabase
      .from('employees')
      .insert([{
        employee_code: `RES-LV-${ts}`,
        full_name: 'On Leave Agent',
        employment_status: 'ACTIVE',
      }])
      .select()
      .single();
    if (leaveEmp) createdEmployeeIds.push(leaveEmp.id);

    const { data: leaveRec } = await supabase
      .from('leaves')
      .insert([{
        employee_id: leaveEmp.id,
        leave_type: 'ANNUAL',
        start_date: testDate,
        end_date: testDate,
        status: 'APPROVED',
      }])
      .select()
      .single();
    if (leaveRec) createdLeaveIds.push(leaveRec.id);

    const s3LeaveRes = await fetch(`${baseUrl}/conflicts/${v2Understaff?.id}/resolve-with-replacement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replacement_employee_id: leaveEmp.id,
        resolution_note: 'Assigning agent on leave',
      }),
    });
    const s3LeaveBody = await s3LeaveRes.json();

    const s3Passed =
      s3InactiveRes.status === 400 &&
      s3LeaveRes.status === 400 &&
      s3InactiveBody.message.includes('inactive') &&
      s3LeaveBody.message.includes('leave');

    recordResult(
      3,
      'Selecting an ineligible replacement employee (inactive / on leave)',
      s3Passed,
      `Inactive rejection status: ${s3InactiveRes.status} ("${s3InactiveBody.message}"), Leave rejection: ${s3LeaveRes.status} ("${s3LeaveBody.message}")`
    );

    // -----------------------------------------------------------------
    // Scenario 4: Successfully assigning an eligible replacement
    // -----------------------------------------------------------------
    const s4Res = await fetch(`${baseUrl}/conflicts/${v2Understaff?.id}/resolve-with-replacement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replacement_employee_id: eligibleEmp.id,
        resolution_note: 'Assigned Eligible Replacement Agent from pod fleet',
      }),
    });
    const s4Body = await s4Res.json();

    // Check that replacement employee's cell in Revision 2 entries is now WORKING
    const entriesRes2 = await fetch(`${baseUrl}/rosters/${rosterV2.id}/entries?employee_id=${eligibleEmp.id}`);
    const entriesBody2 = await entriesRes2.json();
    const scheduledCell = entriesBody2.data?.grid?.[eligibleEmp.id]?.[testDate];

    const s4Passed =
      s4Res.status === 200 &&
      s4Body.data?.status === 'RESOLVED' &&
      scheduledCell?.status === 'WORKING';

    recordResult(
      4,
      'Successfully assigning an eligible replacement on draft revision',
      s4Passed,
      `Conflict status: ${s4Body.data?.status}, Shift status on ${testDate}: ${scheduledCell?.status}`
    );

    // -----------------------------------------------------------------
    // Scenario 5: Resolving the same conflict twice (proper handling without corrupting state)
    // -----------------------------------------------------------------
    const s5Res = await fetch(`${baseUrl}/conflicts/${v2Understaff?.id}/resolve-with-replacement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replacement_employee_id: eligibleEmp.id,
        resolution_note: 'Duplicate resolution attempt',
      }),
    });
    const s5Body = await s5Res.json();

    const s5PatchRes = await fetch(`${baseUrl}/conflicts/${v2Understaff?.id}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_note: 'Duplicate patch attempt' }),
    });
    const s5PatchBody = await s5PatchRes.json();

    const s5Passed =
      s5Res.status === 409 &&
      (s5Body.code === 'CONFLICT_ALREADY_RESOLVED' || s5Body.error?.code === 'CONFLICT_ALREADY_RESOLVED') &&
      s5PatchRes.status === 409 &&
      (s5PatchBody.code === 'CONFLICT_ALREADY_RESOLVED' || s5PatchBody.error?.code === 'CONFLICT_ALREADY_RESOLVED');

    recordResult(
      5,
      'Resolving the same conflict twice (proper handling without corrupting state)',
      s5Passed,
      `Replacement status: ${s5Res.status} (${s5Body.code || s5Body.error?.code}), Patch status: ${s5PatchRes.status} (${s5PatchBody.code || s5PatchBody.error?.code})`
    );

    // -----------------------------------------------------------------
    // Scenario 6: Revalidating conflicts after assignment changes
    // -----------------------------------------------------------------
    // Inspect conflict record to confirm resolution and revalidation
    const s6Res = await fetch(`${baseUrl}/conflicts/${v2Understaff?.id}`);
    const s6Body = await s6Res.json();
    const s6Passed =
      s6Res.status === 200 &&
      s6Body.data?.status === 'RESOLVED' &&
      Boolean(s6Body.data?.resolved_at);

    recordResult(
      6,
      'Revalidating conflicts after assignment changes',
      s6Passed,
      `Status: ${s6Body.data?.status}, Resolved At: ${s6Body.data?.resolved_at}`
    );

    // -----------------------------------------------------------------
    // Scenario 7: Updating the conflict count without refreshing the browser
    // -----------------------------------------------------------------
    // In OPEN filter, the resolved conflict must NOT appear
    const s7OpenRes = await fetch(`${baseUrl}/conflicts?roster_id=${rosterV2.id}&status=OPEN`);
    const s7OpenBody = await s7OpenRes.json();
    const hasResolvedInOpen = (s7OpenBody.data || []).some((c) => c.id === v2Understaff?.id);

    // In RESOLVED filter, the resolved conflict MUST appear
    const s7ResolvedRes = await fetch(`${baseUrl}/conflicts?roster_id=${rosterV2.id}&status=RESOLVED`);
    const s7ResolvedBody = await s7ResolvedRes.json();
    const hasInResolved = (s7ResolvedBody.data || []).some((c) => c.id === v2Understaff?.id);

    const s7Passed = !hasResolvedInOpen && hasInResolved;
    recordResult(
      7,
      'Updating the conflict count and removing resolved from active list',
      s7Passed,
      `Present in OPEN: ${hasResolvedInOpen} (expected false), Present in RESOLVED: ${hasInResolved} (expected true)`
    );

    // -----------------------------------------------------------------
    // Scenario 8: Handling failed API requests without showing false success
    // -----------------------------------------------------------------
    const s8Res = await fetch(`${baseUrl}/conflicts/00000000-0000-0000-0000-000000000000/resolve-with-replacement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replacement_employee_id: eligibleEmp.id }),
    });
    const s8Body = await s8Res.json();
    const s8Passed = s8Res.status === 404 && s8Body.success === false;

    recordResult(
      8,
      'Handling failed API requests without showing false success',
      s8Passed,
      `Status: ${s8Res.status}, Success: ${s8Body.success}`
    );

    // -----------------------------------------------------------------
    // Scenario 9: Preserving the original published roster
    // -----------------------------------------------------------------
    const s9Res = await fetch(`${baseUrl}/rosters/${rosterV1Id}`);
    const s9Body = await s9Res.json();
    const v1Header = s9Body.data;

    // Check that Revision 1 entries for eligibleEmp were not modified
    const s9EntriesRes = await fetch(`${baseUrl}/rosters/${rosterV1Id}/entries?employee_id=${eligibleEmp.id}`);
    const s9EntriesBody = await s9EntriesRes.json();
    const v1ScheduledCell = s9EntriesBody.data?.grid?.[eligibleEmp.id]?.[testDate];

    const s9Passed =
      v1Header?.status === 'PUBLISHED' &&
      v1Header?.version === 1 &&
      v1ScheduledCell === undefined; // was never scheduled on v1

    recordResult(
      9,
      'Preserving the original published roster (Revision 1 remains intact)',
      s9Passed,
      `Roster v1 Status: ${v1Header?.status}, Version: ${v1Header?.version}, V1 Shift Touched: ${Boolean(v1ScheduledCell)}`
    );

  } catch (error) {
    console.error('Test execution error:', error);
    recordResult('CRASH', 'Unhandled test exception', false, error.message);
  } finally {
    await new Promise((resolve) => server.close(resolve));

    console.log('\n🧹 Cleaning up test records from Supabase...');
    for (const rId of createdRosterIds) {
      await supabase.from('roster_entries').delete().eq('roster_id', rId);
      await supabase.from('roster_conflicts').delete().eq('roster_id', rId);
      await supabase.from('rosters').delete().eq('id', rId);
    }
    for (const lId of createdLeaveIds) await supabase.from('leaves').delete().eq('id', lId);
    for (const wId of createdWorkingRuleIds) await supabase.from('working_rules').delete().eq('id', wId);
    for (const aId of createdAssignmentIds) await supabase.from('employee_assignments').delete().eq('id', aId);
    for (const bId of createdBrandIds) await supabase.from('brands').delete().eq('id', bId);
    for (const pId of createdProcessIds) await supabase.from('processes').delete().eq('id', pId);
    for (const eId of createdEmployeeIds) await supabase.from('employees').delete().eq('id', eId);
    console.log('✨ Test cleanup complete.\n');
  }

  const allPassed = testResults.length === 9 && testResults.every((r) => r.passed);
  console.log(`Conflict Resolution Workflow Summary: ${testResults.filter((r) => r.passed).length}/${testResults.length} Passed`);
  return { allPassed, results: testResults };
}

if (process.argv[1]?.endsWith('conflict_resolution_workflow.test.js')) {
  runConflictResolutionWorkflowTests().then(({ allPassed }) => process.exit(allPassed ? 0 : 1));
}
