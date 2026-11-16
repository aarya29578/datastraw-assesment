import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

const createdEmployeeIds = [];
const createdBrandIds = [];
const createdProcessIds = [];
const createdAssignmentIds = [];
const createdWeeklyOffIds = [];
const createdLeaveIds = [];
const createdHolidayIds = [];
const createdRosterIds = [];

export async function runRosterTests() {
  console.log('====================================================');
  console.log('🧪 Starting Roster Management API Test Suite (12 Scenarios)');
  console.log('====================================================\n');

  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/rosters`;
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
      .insert([{ employee_code: `ROST-E-${ts}`, full_name: 'Roster Agent', employment_status: 'ACTIVE' }])
      .select()
      .single();
    if (testEmp) createdEmployeeIds.push(testEmp.id);

    // Setup brand
    const { data: testBrand } = await supabase
      .from('brands')
      .insert([{ name: `Roster Brand ${ts}` }])
      .select()
      .single();
    if (testBrand) createdBrandIds.push(testBrand.id);

    // Setup process
    const { data: testProc } = await supabase
      .from('processes')
      .insert([{ code: `ROST${ts.slice(-3)}`, name: 'Roster Process' }])
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

    // Setup working rule: Sun-Fri operating (0,1,2,3,4,5), closed on holidays
    await supabase.from('working_rules').insert([{
      brand_id: testBrand.id,
      process_id: testProc.id,
      operating_days: [0, 1, 2, 3, 4, 5],
      operates_on_public_holidays: false,
      required_staff_count: 1,
      effective_from: '2026-01-01',
    }]);

    // Setup weekly off: Sunday (0)
    const { data: wOff } = await supabase
      .from('weekly_offs')
      .insert([{ employee_id: testEmp.id, weekday: 0, effective_from: '2026-01-01' }])
      .select()
      .single();
    if (wOff) createdWeeklyOffIds.push(wOff.id);

    // Setup approved leave on 2026-11-10 (Tuesday)
    const { data: leave } = await supabase
      .from('leaves')
      .insert([{
        employee_id: testEmp.id,
        leave_type: 'ANNUAL',
        start_date: '2026-11-10',
        end_date: '2026-11-10',
        status: 'APPROVED',
      }])
      .select()
      .single();
    if (leave) createdLeaveIds.push(leave.id);

    // Setup public holiday on 2026-11-12 (Thursday)
    const { data: holiday } = await supabase
      .from('public_holidays')
      .insert([{ holiday_date: '2026-11-12', holiday_name: 'State Holiday' }])
      .select()
      .single();
    if (holiday) createdHolidayIds.push(holiday.id);

    let rosterId = null;

    // ---------------------------------------------------------------
    // 1. Generate monthly baseline roster
    // ---------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 11, year: 2026 }),
    });
    const body1 = await res1.json();
    const passed1 = res1.status === 201 && body1.success === true && body1.data?.days_in_month === 30;
    rosterId = body1.data?.roster?.id;
    if (rosterId) createdRosterIds.push(rosterId);
    recordResult(1, 'Generate monthly baseline roster for November (30 days)', passed1, `Status: ${res1.status}, ID: ${rosterId}, Days: ${body1.data?.days_in_month}`);

    // ---------------------------------------------------------------
    // 2. Fetch roster by ID
    // ---------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/${rosterId}`);
    const body2 = await res2.json();
    const passed2 = res2.status === 200 && body2.data?.id === rosterId && body2.data?.status === 'DRAFT';
    recordResult(2, 'Fetch roster by ID (status: DRAFT)', passed2, `Status: ${res2.status}, Month: ${body2.data?.month}/${body2.data?.year}`);

    // ---------------------------------------------------------------
    // 3. Fetch roster entries and verify 2D grid matrix structure
    // ---------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/${rosterId}/entries`);
    const body3 = await res3.json();
    const grid = body3.data?.grid || {};
    const empGrid = grid[testEmp.id] || {};
    const passed3 = res3.status === 200 && Object.keys(empGrid).length === 30;
    recordResult(3, 'Fetch roster entries with structured 2D grid matrix', passed3, `Status: ${res3.status}, Grid dates count: ${Object.keys(empGrid).length}`);

    // ---------------------------------------------------------------
    // 4. Verify leave exclusion: employee scheduled on approved leave is 'LEAVE'
    // ---------------------------------------------------------------
    const leaveCell = empGrid['2026-11-10'];
    const passed4 = leaveCell?.status === 'LEAVE';
    recordResult(4, 'Verify approved leave exclusion (status: LEAVE)', passed4, `Date 2026-11-10 -> Status: ${leaveCell?.status}, Note: "${leaveCell?.notes}"`);

    // ---------------------------------------------------------------
    // 5. Verify weekly off exclusion: Sunday is 'WEEKLY_OFF'
    // ---------------------------------------------------------------
    // 2026-11-01 was a Sunday
    const sundayCell = empGrid['2026-11-01'];
    const passed5 = sundayCell?.status === 'WEEKLY_OFF';
    recordResult(5, 'Verify scheduled weekly off exclusion (status: WEEKLY_OFF)', passed5, `Date 2026-11-01 (Sunday) -> Status: ${sundayCell?.status}`);

    // ---------------------------------------------------------------
    // 6. Verify public holiday exclusion: closed holiday is 'HOLIDAY'
    // ---------------------------------------------------------------
    const holidayCell = empGrid['2026-11-12'];
    const passed6 = holidayCell?.status === 'HOLIDAY';
    recordResult(6, 'Verify public holiday closure (status: HOLIDAY)', passed6, `Date 2026-11-12 -> Status: ${holidayCell?.status}, Note: "${holidayCell?.notes}"`);

    // ---------------------------------------------------------------
    // 7. Manual cell update: update entry status with custom note
    // ---------------------------------------------------------------
    // Update Sunday cell (2026-11-01) from OFF to WORKING
    const res7 = await fetch(`${baseUrl}/${rosterId}/entries/${sundayCell.entry_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'WORKING',
        notes: 'Supervisor manual overtime assignment',
      }),
    });
    const body7 = await res7.json();
    const passed7 = res7.status === 200 && body7.data?.status === 'WORKING' && body7.data?.is_manually_edited === true;
    recordResult(7, 'Manual cell update sets is_manually_edited = true', passed7, `Status: ${res7.status}, New status: WORKING, Manual: ${body7.data?.is_manually_edited}`);

    // ---------------------------------------------------------------
    // 8. Regenerate roster: verify manually edited cell is preserved
    // ---------------------------------------------------------------
    const res8 = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 11, year: 2026 }),
    });
    const body8 = await res8.json();
    const res8Grid = await fetch(`${baseUrl}/${rosterId}/entries`);
    const body8Grid = await res8Grid.json();
    const regeneratedSundayCell = body8Grid.data?.grid?.[testEmp.id]?.['2026-11-01'];
    const passed8 =
      res8.status === 201 &&
      body8.data?.total_manual_entries_preserved >= 1 &&
      regeneratedSundayCell?.status === 'WORKING' &&
      regeneratedSundayCell?.is_manually_edited === true;
    recordResult(8, 'Regeneration preserves manual cell overrides', passed8, `Preserved status: ${regeneratedSundayCell?.status}, Preserved note: "${regeneratedSundayCell?.notes}"`);

    // ---------------------------------------------------------------
    // 9. Bulk update entries
    // ---------------------------------------------------------------
    const currentEmpGrid = body8Grid.data?.grid?.[testEmp.id] || {};
    const cell2 = currentEmpGrid['2026-11-02'];
    const cell3 = currentEmpGrid['2026-11-03'];
    const res9 = await fetch(`${baseUrl}/${rosterId}/entries/bulk-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [
          { entry_id: cell2.entry_id, status: 'WEEKLY_OFF', notes: 'Bulk rest day 1' },
          { entry_id: cell3.entry_id, status: 'WEEKLY_OFF', notes: 'Bulk rest day 2' },
        ],
      }),
    });
    const body9 = await res9.json();
    const passed9 = res9.status === 200 && body9.data?.updated_count === 2;
    recordResult(9, 'Bulk update multiple entries simultaneously', passed9, `Status: ${res9.status}, Updated count: ${body9.data?.updated_count}`);

    // ---------------------------------------------------------------
    // 10. Update roster lifecycle status: DRAFT -> REVIEW
    // ---------------------------------------------------------------
    const res10 = await fetch(`${baseUrl}/${rosterId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REVIEW' }),
    });
    const body10 = await res10.json();
    const passed10 = res10.status === 200 && body10.data?.status === 'REVIEW';
    recordResult(10, 'Transition roster status from DRAFT to REVIEW', passed10, `Status: ${res10.status}, Status: ${body10.data?.status}`);

    // ---------------------------------------------------------------
    // 11. Update roster lifecycle status: REVIEW -> PUBLISHED
    // ---------------------------------------------------------------
    const res11 = await fetch(`${baseUrl}/${rosterId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    const body11 = await res11.json();
    const passed11 = res11.status === 200 && body11.data?.status === 'PUBLISHED' && Boolean(body11.data?.published_at);
    recordResult(11, 'Publish roster (status: PUBLISHED) with timestamp', passed11, `Status: ${res11.status}, Published at: ${body11.data?.published_at}`);

    // ---------------------------------------------------------------
    // 12. Reject invalid month or year
    // ---------------------------------------------------------------
    const res12 = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 13, year: 2026 }),
    });
    const passed12 = res12.status === 400;
    recordResult(12, 'Reject invalid month (13) during roster generation', passed12, `Status: ${res12.status}`);
  } catch (error) {
    console.error('Roster test error:', error);
    testResults.push({ scenarioNum: 'CRASH', title: 'Unhandled exception', passed: false, details: error.message });
  } finally {
    await new Promise((resolve) => server.close(resolve));

    console.log('\n🧹 Cleaning up roster test records from Supabase...');
    for (const rId of createdRosterIds) {
      await supabase.from('roster_entries').delete().eq('roster_id', rId);
      await supabase.from('roster_conflicts').delete().eq('roster_id', rId);
      await supabase.from('rosters').delete().eq('id', rId);
    }
    for (const hId of createdHolidayIds) await supabase.from('public_holidays').delete().eq('id', hId);
    for (const lId of createdLeaveIds) await supabase.from('leaves').delete().eq('id', lId);
    for (const wId of createdWeeklyOffIds) await supabase.from('weekly_offs').delete().eq('id', wId);
    for (const aId of createdAssignmentIds) await supabase.from('employee_assignments').delete().eq('id', aId);
    for (const bId of createdBrandIds) {
      await supabase.from('working_rules').delete().eq('brand_id', bId);
      await supabase.from('brands').delete().eq('id', bId);
    }
    for (const pId of createdProcessIds) await supabase.from('processes').delete().eq('id', pId);
    for (const eId of createdEmployeeIds) await supabase.from('employees').delete().eq('id', eId);
    console.log('✨ Roster cleanup complete.\n');
  }

  const allPassed = testResults.length === 12 && testResults.every((r) => r.passed);
  console.log(`Roster Test Summary: ${testResults.filter((r) => r.passed).length}/${testResults.length} Passed`);
  return { allPassed, results: testResults };
}

if (process.argv[1]?.endsWith('roster.test.js')) {
  runRosterTests().then(({ allPassed }) => process.exit(allPassed ? 0 : 1));
}
