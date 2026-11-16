import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

const createdEmployeeIds = [];
const createdBrandIds = [];
const createdProcessIds = [];
const createdAssignmentIds = [];
const createdRosterIds = [];

export async function runConflictTests() {
  console.log('====================================================');
  console.log('🧪 Starting Conflict Engine & Dashboard Test Suite (12 Scenarios)');
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

    // Setup employee
    const { data: testEmp } = await supabase
      .from('employees')
      .insert([{ employee_code: `CONF-E-${ts}`, full_name: 'Conflict Test Agent', employment_status: 'ACTIVE' }])
      .select()
      .single();
    if (testEmp) createdEmployeeIds.push(testEmp.id);

    // Setup brand
    const { data: testBrand } = await supabase
      .from('brands')
      .insert([{ name: `Conflict Brand ${ts}` }])
      .select()
      .single();
    if (testBrand) createdBrandIds.push(testBrand.id);

    // Setup process
    const { data: testProc } = await supabase
      .from('processes')
      .insert([{ code: `CP${ts.slice(-3)}`, name: 'Conflict Process' }])
      .select()
      .single();
    if (testProc) createdProcessIds.push(testProc.id);

    // Setup assignment
    const { data: testAsgn } = await supabase
      .from('employee_assignments')
      .insert([{ employee_id: testEmp.id, brand_id: testBrand.id, process_id: testProc.id, is_primary: true }])
      .select()
      .single();
    if (testAsgn) createdAssignmentIds.push(testAsgn.id);

    // Setup working rule requiring 5 staff members (only 1 assigned, so it will be understaffed!)
    await supabase.from('working_rules').insert([{
      brand_id: testBrand.id,
      process_id: testProc.id,
      operating_days: [1, 2, 3, 4, 5],
      operates_on_public_holidays: false,
      required_staff_count: 5,
      effective_from: '2026-01-01',
    }]);

    // Setup weekly off on Sunday
    await supabase.from('weekly_offs').insert([{ employee_id: testEmp.id, weekday: 0, effective_from: '2026-01-01' }]);

    // Setup approved leave on 2026-11-04 (Wednesday)
    await supabase.from('leaves').insert([{
      employee_id: testEmp.id,
      leave_type: 'ANNUAL',
      start_date: '2026-11-04',
      end_date: '2026-11-04',
      status: 'APPROVED',
    }]);

    // Generate roster for 11/2026
    const resGen = await fetch(`${baseUrl}/rosters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 11, year: 2026 }),
    });
    const bodyGen = await resGen.json();
    const rosterId = bodyGen.data?.roster?.id;
    if (rosterId) createdRosterIds.push(rosterId);

    // Manually edit 2026-11-04 (which is on leave) to WORKING to create an ON_LEAVE_SCHEDULED conflict!
    const resEntries = await fetch(`${baseUrl}/rosters/${rosterId}/entries`);
    const bodyEntries = await resEntries.json();
    const leaveCell = bodyEntries.data?.grid?.[testEmp.id]?.['2026-11-04'];
    if (leaveCell?.entry_id) {
      await fetch(`${baseUrl}/rosters/${rosterId}/entries/${leaveCell.entry_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'WORKING', notes: 'Force overtime during leave' }),
      });
    }

    // Manually edit 2026-11-01 (Sunday) to WORKING to create a WORK_ON_OFF_DAY conflict!
    const sundayCell = bodyEntries.data?.grid?.[testEmp.id]?.['2026-11-01'];
    if (sundayCell?.entry_id) {
      await fetch(`${baseUrl}/rosters/${rosterId}/entries/${sundayCell.entry_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'WORKING', notes: 'Sunday work' }),
      });
    }

    let understaffConflictId = null;

    // ---------------------------------------------------------------
    // 1. Run conflict validation on roster
    // ---------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/conflicts/validate/${rosterId}`, { method: 'POST' });
    const body1 = await res1.json();
    const passed1 = res1.status === 200 && body1.data?.total_conflicts > 0;
    recordResult(1, 'Run conflict validation engine on roster', passed1, `Status: ${res1.status}, Conflicts found: ${body1.data?.total_conflicts}`);

    // ---------------------------------------------------------------
    // 2. Detect UNDERSTAFFED_PROCESS (CRITICAL)
    // ---------------------------------------------------------------
    const conflicts = body1.data?.conflicts || [];
    const understaffConflict = conflicts.find((c) => c.conflict_type === 'UNDERSTAFFED_PROCESS');
    const passed2 = Boolean(understaffConflict) && understaffConflict?.severity === 'CRITICAL';
    if (understaffConflict?.id) understaffConflictId = understaffConflict.id;
    recordResult(2, 'Detect UNDERSTAFFED_PROCESS critical conflict', passed2, `Severity: ${understaffConflict?.severity}, Note: "${understaffConflict?.description}"`);

    // ---------------------------------------------------------------
    // 3. Detect ON_LEAVE_SCHEDULED (CRITICAL)
    // ---------------------------------------------------------------
    const onLeaveConflict = conflicts.find((c) => c.conflict_type === 'ON_LEAVE_SCHEDULED');
    const passed3 = Boolean(onLeaveConflict) && onLeaveConflict?.severity === 'CRITICAL';
    recordResult(3, 'Detect ON_LEAVE_SCHEDULED critical conflict', passed3, `Date: ${onLeaveConflict?.conflict_date}, Description: "${onLeaveConflict?.description}"`);

    // ---------------------------------------------------------------
    // 4. Detect WORK_ON_OFF_DAY (WARNING)
    // ---------------------------------------------------------------
    const offDayConflict = conflicts.find((c) => c.conflict_type === 'WORK_ON_OFF_DAY');
    const passed4 = Boolean(offDayConflict) && offDayConflict?.severity === 'WARNING';
    recordResult(4, 'Detect WORK_ON_OFF_DAY warning conflict', passed4, `Date: ${offDayConflict?.conflict_date}, Description: "${offDayConflict?.description}"`);

    // ---------------------------------------------------------------
    // 5. Fetch conflicts filtered by CRITICAL severity
    // ---------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/conflicts?roster_id=${rosterId}&severity=CRITICAL`);
    const body5 = await res5.json();
    const passed5 = res5.status === 200 && body5.data?.length >= 1 && body5.data.every((c) => c.severity === 'CRITICAL');
    recordResult(5, 'Fetch conflicts filtered by CRITICAL severity', passed5, `Status: ${res5.status}, Critical count: ${body5.data?.length}`);

    // ---------------------------------------------------------------
    // 6. Fetch conflict by ID
    // ---------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/conflicts/${understaffConflictId}`);
    const body6 = await res6.json();
    const passed6 = res6.status === 200 && body6.data?.id === understaffConflictId;
    recordResult(6, 'Fetch conflict by ID', passed6, `Status: ${res6.status}, Type: ${body6.data?.conflict_type}`);

    // ---------------------------------------------------------------
    // 7. Resolve a conflict with resolution note
    // ---------------------------------------------------------------
    const res7 = await fetch(`${baseUrl}/conflicts/${understaffConflictId}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_note: 'Approved temporary reduced coverage by Director' }),
    });
    const body7 = await res7.json();
    const passed7 = res7.status === 200 && body7.data?.status === 'RESOLVED';
    recordResult(7, 'Mark conflict as RESOLVED with resolution note', passed7, `Status: ${res7.status}, Conflict status: ${body7.data?.status}`);

    // ---------------------------------------------------------------
    // 8. Ignore a conflict
    // ---------------------------------------------------------------
    if (offDayConflict?.id) {
      const res8 = await fetch(`${baseUrl}/conflicts/${offDayConflict.id}/ignore`, { method: 'PATCH' });
      const body8 = await res8.json();
      const passed8 = res8.status === 200 && body8.data?.status === 'IGNORED';
      recordResult(8, 'Mark conflict as IGNORED', passed8, `Status: ${res8.status}, Conflict status: ${body8.data?.status}`);
    } else {
      recordResult(8, 'Mark conflict as IGNORED', true, 'Skipped');
    }

    // ---------------------------------------------------------------
    // 9. Safe revalidation preserves RESOLVED and IGNORED conflicts
    // ---------------------------------------------------------------
    await fetch(`${baseUrl}/conflicts/validate/${rosterId}`, { method: 'POST' });
    const res9 = await fetch(`${baseUrl}/conflicts/${understaffConflictId}`);
    const body9 = await res9.json();
    const passed9 = res9.status === 200 && body9.data?.status === 'RESOLVED';
    recordResult(9, 'Safe revalidation preserves RESOLVED/IGNORED status', passed9, `Conflict ${understaffConflictId} status: ${body9.data?.status}`);

    // ---------------------------------------------------------------
    // 10. Dashboard metrics API returns dynamic database counts
    // ---------------------------------------------------------------
    const res10 = await fetch(`${baseUrl}/dashboard/metrics`);
    const body10 = await res10.json();
    const passed10 =
      res10.status === 200 &&
      body10.data?.employees?.total >= 1 &&
      body10.data?.organization?.brands_count >= 1 &&
      body10.data?.conflicts?.total_open >= 0;
    recordResult(10, 'Dashboard metrics returns live database calculations', passed10, `Status: ${res10.status}, Emps: ${body10.data?.employees?.total}, Conflicts: ${body10.data?.conflicts?.total_open}`);

    // ---------------------------------------------------------------
    // 11. Export monthly roster to CSV
    // ---------------------------------------------------------------
    const res11 = await fetch(`${baseUrl}/exports/roster/${rosterId}/csv`);
    const csv11 = await res11.text();
    const passed11 = res11.status === 200 && csv11.includes('Work Date') && csv11.includes('Shift Status');
    recordResult(11, 'Export monthly roster to CSV file stream', passed11, `Status: ${res11.status}, Content length: ${csv11.length} bytes`);

    // ---------------------------------------------------------------
    // 12. Export conflicts to CSV
    // ---------------------------------------------------------------
    const res12 = await fetch(`${baseUrl}/exports/conflicts/csv?roster_id=${rosterId}`);
    const csv12 = await res12.text();
    const passed12 = res12.status === 200 && csv12.includes('Conflict Date') && csv12.includes('Severity');
    recordResult(12, 'Export conflict report to CSV file stream', passed12, `Status: ${res12.status}, Content length: ${csv12.length} bytes`);
  } catch (error) {
    console.error('Conflict test error:', error);
    testResults.push({ scenarioNum: 'CRASH', title: 'Unhandled exception', passed: false, details: error.message });
  } finally {
    await new Promise((resolve) => server.close(resolve));

    console.log('\n🧹 Cleaning up conflict test records from Supabase...');
    for (const rId of createdRosterIds) {
      await supabase.from('roster_entries').delete().eq('roster_id', rId);
      await supabase.from('roster_conflicts').delete().eq('roster_id', rId);
      await supabase.from('rosters').delete().eq('id', rId);
    }
    for (const aId of createdAssignmentIds) await supabase.from('employee_assignments').delete().eq('id', aId);
    for (const bId of createdBrandIds) {
      await supabase.from('working_rules').delete().eq('brand_id', bId);
      await supabase.from('brands').delete().eq('id', bId);
    }
    for (const pId of createdProcessIds) await supabase.from('processes').delete().eq('id', pId);
    for (const eId of createdEmployeeIds) {
      await supabase.from('weekly_offs').delete().eq('employee_id', eId);
      await supabase.from('leaves').delete().eq('employee_id', eId);
      await supabase.from('employees').delete().eq('id', eId);
    }
    console.log('✨ Conflict cleanup complete.\n');
  }

  const allPassed = testResults.length === 12 && testResults.every((r) => r.passed);
  console.log(`Conflict Test Summary: ${testResults.filter((r) => r.passed).length}/${testResults.length} Passed`);
  return { allPassed, results: testResults };
}

if (process.argv[1]?.endsWith('conflict.test.js')) {
  runConflictTests().then(({ allPassed }) => process.exit(allPassed ? 0 : 1));
}
