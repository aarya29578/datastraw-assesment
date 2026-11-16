import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';
import { rosterService } from '../modules/roster/roster.service.js';

export async function runDeepVerification() {
  console.log('================================================================');
  console.log('🔬 DEEP VERIFICATION: ROSTER BUSINESS LOGIC & CONFLICT ENGINE');
  console.log('================================================================\n');

  const createdEmployeeIds = [];
  const createdPodIds = [];
  const createdBrandIds = [];
  const createdProcessIds = [];
  const createdAssignmentIds = [];
  const createdRosterIds = [];
  const createdHolidayIds = [];

  const results = [];
  const record = (num, title, passed, details = '') => {
    results.push({ num, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [Check ${num}] ${title}`);
    if (details) console.log(`   ↳ ${details}`);
  };

  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise((resolve) => {
    server.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });

  try {
    const ts = Date.now().toString().slice(-5);

    // -----------------------------------------------------------------
    // 1. Month Duration Tests (Leap-year Feb 2024, April 30d, Jan 31d)
    // -----------------------------------------------------------------
    const daysFebLeap = rosterService.getDaysInMonth(2024, 2);
    const daysFebNonLeap = rosterService.getDaysInMonth(2025, 2);
    const daysApril = rosterService.getDaysInMonth(2026, 4);
    const daysJan = rosterService.getDaysInMonth(2026, 1);

    const check1Passed =
      daysFebLeap === 29 &&
      daysFebNonLeap === 28 &&
      daysApril === 30 &&
      daysJan === 31;
    record(1, 'Month days calculation (Leap Feb: 29, Non-leap Feb: 28, Apr: 30, Jan: 31)', check1Passed,
      `Feb 2024: ${daysFebLeap}, Feb 2025: ${daysFebNonLeap}, Apr: ${daysApril}, Jan: ${daysJan}`);

    // -----------------------------------------------------------------
    // 2. Setup Pod, Brand, and 2 Distinct Processes (Proc A and Proc B)
    // -----------------------------------------------------------------
    const { data: pod } = await supabase.from('pods').insert([{ name: `DeepPod_${ts}` }]).select().single();
    if (pod) createdPodIds.push(pod.id);

    const { data: brand } = await supabase.from('brands').insert([{ name: `DeepBrand_${ts}` }]).select().single();
    if (brand) createdBrandIds.push(brand.id);

    const { data: procA } = await supabase.from('processes').insert([{ code: `DPA_${ts}`, name: `DeepProcA_${ts}` }]).select().single();
    if (procA) createdProcessIds.push(procA.id);

    const { data: procB } = await supabase.from('processes').insert([{ code: `DPB_${ts}`, name: `DeepProcB_${ts}` }]).select().single();
    if (procB) createdProcessIds.push(procB.id);

    // Working Rule for Proc A: requires 3 staff members, 7 days operating (0-6)
    await supabase.from('working_rules').insert([{
      brand_id: brand.id,
      process_id: procA.id,
      operating_days: [0, 1, 2, 3, 4, 5, 6],
      operates_on_public_holidays: false,
      required_staff_count: 3, // Requires 3, will have only 2 assigned -> UNDERSTAFFED
      effective_from: '2026-01-01',
      is_active: true,
    }]);

    // Working Rule for Proc B: requires 1 staff member, 7 days operating (0-6)
    await supabase.from('working_rules').insert([{
      brand_id: brand.id,
      process_id: procB.id,
      operating_days: [0, 1, 2, 3, 4, 5, 6],
      operates_on_public_holidays: false,
      required_staff_count: 1, // Requires 1, has 1 assigned -> FULLY STAFFED
      effective_from: '2026-01-01',
      is_active: true,
    }]);

    // -----------------------------------------------------------------
    // 3. Setup Employees:
    // Emp 1 -> Active, assigned to Proc A
    // Emp 2 -> Active, assigned to Proc B
    // Emp 3 -> Active, assigned to Proc A (secondary)
    // Emp 4 -> Inactive, assigned to Proc A
    // -----------------------------------------------------------------
    const { data: emp1 } = await supabase.from('employees').insert([{
      employee_code: `DE-1-${ts}`,
      full_name: 'Agent One ProcA',
      pod_id: pod.id,
      employment_status: 'ACTIVE',
    }]).select().single();
    createdEmployeeIds.push(emp1.id);

    const { data: emp2 } = await supabase.from('employees').insert([{
      employee_code: `DE-2-${ts}`,
      full_name: 'Agent Two ProcB',
      pod_id: pod.id,
      employment_status: 'ACTIVE',
    }]).select().single();
    createdEmployeeIds.push(emp2.id);

    const { data: emp3 } = await supabase.from('employees').insert([{
      employee_code: `DE-3-${ts}`,
      full_name: 'Agent Three MultiProc',
      pod_id: pod.id,
      employment_status: 'ACTIVE',
    }]).select().single();
    createdEmployeeIds.push(emp3.id);

    const { data: emp4 } = await supabase.from('employees').insert([{
      employee_code: `DE-4-${ts}`,
      full_name: 'Agent Four Inactive',
      pod_id: pod.id,
      employment_status: 'INACTIVE',
    }]).select().single();
    createdEmployeeIds.push(emp4.id);

    // Assignments
    const { data: asgn1 } = await supabase.from('employee_assignments').insert([{
      employee_id: emp1.id,
      brand_id: brand.id,
      process_id: procA.id,
      is_primary: true,
    }]).select().single();
    createdAssignmentIds.push(asgn1.id);

    const { data: asgn2 } = await supabase.from('employee_assignments').insert([{
      employee_id: emp2.id,
      brand_id: brand.id,
      process_id: procB.id,
      is_primary: true,
    }]).select().single();
    createdAssignmentIds.push(asgn2.id);

    const { data: asgn3A } = await supabase.from('employee_assignments').insert([{
      employee_id: emp3.id,
      brand_id: brand.id,
      process_id: procA.id,
      is_primary: true,
    }]).select().single();
    createdAssignmentIds.push(asgn3A.id);

    const { data: asgn4 } = await supabase.from('employee_assignments').insert([{
      employee_id: emp4.id,
      brand_id: brand.id,
      process_id: procA.id,
      is_primary: true,
    }]).select().single();
    createdAssignmentIds.push(asgn4.id);

    // -----------------------------------------------------------------
    // 4. Setup Availability for Target Month: November 2026
    // Weekly off: Emp 1 has Sunday (0) and Saturday (6) off
    // Approved leave: Emp 1 on 2026-11-04 (Wednesday)
    // Pending leave: Emp 1 on 2026-11-05 (Thursday) -> Should NOT mark LEAVE!
    // Approved comp-off: Emp 2 on 2026-11-06 (Friday)
    // Public holiday: 2026-11-12 -> Closed for Proc A and Proc B
    // -----------------------------------------------------------------
    await supabase.from('weekly_offs').insert([
      { employee_id: emp1.id, weekday: 0, effective_from: '2026-01-01', is_active: true },
      { employee_id: emp1.id, weekday: 6, effective_from: '2026-01-01', is_active: true },
      { employee_id: emp2.id, weekday: 0, effective_from: '2026-01-01', is_active: true },
    ]);

    await supabase.from('leaves').insert([
      {
        employee_id: emp1.id,
        leave_type: 'ANNUAL',
        start_date: '2026-11-04',
        end_date: '2026-11-04',
        status: 'APPROVED',
      },
      {
        employee_id: emp1.id,
        leave_type: 'ANNUAL',
        start_date: '2026-11-05',
        end_date: '2026-11-05',
        status: 'PENDING',
      },
    ]);

    await supabase.from('comp_offs').insert([
      {
        employee_id: emp2.id,
        earned_on: '2026-10-01',
        off_date: '2026-11-06',
        expires_on: '2026-12-31',
        status: 'APPROVED',
      },
    ]);

    const { data: hol } = await supabase.from('public_holidays').insert([{
      holiday_date: '2026-11-12',
      holiday_name: 'Deep Holiday Test',
      is_active: true,
    }]).select().single();
    if (hol) createdHolidayIds.push(hol.id);

    // -----------------------------------------------------------------
    // 5. Generate Roster for November 2026
    // -----------------------------------------------------------------
    const resGen = await fetch(`${baseUrl}/rosters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 11, year: 2026 }),
    });
    const bodyGen = await resGen.json();
    const rosterId = bodyGen.data?.roster?.id;
    if (rosterId) createdRosterIds.push(rosterId);

    const check2Passed = resGen.status === 200 || resGen.status === 201;
    record(2, 'Generate baseline monthly roster for 11/2026', check2Passed, `Roster ID: ${rosterId}`);

    // Retrieve full entries grid
    const resGrid = await fetch(`${baseUrl}/rosters/${rosterId}/entries`);
    const bodyGrid = await resGrid.json();
    const grid = bodyGrid.data?.grid || {};

    // -----------------------------------------------------------------
    // 6. Inactive employee exclusion verification
    // -----------------------------------------------------------------
    const emp4Entries = grid[emp4.id];
    const check3Passed = !emp4Entries || Object.keys(emp4Entries).length === 0;
    record(3, 'Exclude inactive employee from roster generation', check3Passed,
      emp4Entries ? `Entries found: ${Object.keys(emp4Entries).length}` : 'Correctly zero entries');

    // -----------------------------------------------------------------
    // 7. Approved vs Pending Leave verification
    // -----------------------------------------------------------------
    const emp1Nov4 = grid[emp1.id]?.['2026-11-04']; // Approved leave
    const emp1Nov5 = grid[emp1.id]?.['2026-11-05']; // Pending leave (should NOT be LEAVE)

    const check4Passed = emp1Nov4?.status === 'LEAVE' && emp1Nov5?.status === 'WORKING';
    record(4, 'Approved leave marks LEAVE, Pending leave remains WORKING', check4Passed,
      `Nov 4 (Approved): ${emp1Nov4?.status}, Nov 5 (Pending): ${emp1Nov5?.status}`);

    // -----------------------------------------------------------------
    // 8. Weekly Off verification
    // -----------------------------------------------------------------
    const emp1Nov1 = grid[emp1.id]?.['2026-11-01']; // Sunday
    const emp1Nov7 = grid[emp1.id]?.['2026-11-07']; // Saturday
    const check5Passed = emp1Nov1?.status === 'WEEKLY_OFF' && emp1Nov7?.status === 'WEEKLY_OFF';
    record(5, 'Recurring weekly offs applied (Sunday and Saturday)', check5Passed,
      `Sunday (Nov 1): ${emp1Nov1?.status}, Saturday (Nov 7): ${emp1Nov7?.status}`);

    // -----------------------------------------------------------------
    // 9. Approved Comp-Off verification
    // -----------------------------------------------------------------
    const emp2Nov6 = grid[emp2.id]?.['2026-11-06']; // Approved comp-off
    const check6Passed = emp2Nov6?.status === 'COMP_OFF';
    record(6, 'Valid comp-off grants COMP_OFF status', check6Passed,
      `Nov 6: ${emp2Nov6?.status}`);

    // -----------------------------------------------------------------
    // 10. Public Holiday verification
    // -----------------------------------------------------------------
    const emp1Nov12 = grid[emp1.id]?.['2026-11-12']; // Public holiday
    const check7Passed = emp1Nov12?.status === 'HOLIDAY';
    record(7, 'Public holiday applied on closed operating day', check7Passed,
      `Nov 12: ${emp1Nov12?.status}`);

    // -----------------------------------------------------------------
    // 11. Multi-process employee assignments verification
    // -----------------------------------------------------------------
    const emp3Entries = grid[emp3.id];
    const check8Passed = Boolean(emp3Entries) && Object.keys(emp3Entries).length === 30;
    record(8, 'Employee with process assignment correctly rostered', check8Passed,
      `Emp3 days rostered: ${Object.keys(emp3Entries || {}).length}`);

    // -----------------------------------------------------------------
    // 12. Manual Override Preservation during re-generation
    // Edit Emp 1 on Nov 1 (Sunday, currently WEEKLY_OFF) to WORKING with notes
    // -----------------------------------------------------------------
    const sundayCell = grid[emp1.id]?.['2026-11-01'];
    await fetch(`${baseUrl}/rosters/${rosterId}/entries/${sundayCell.entry_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'WORKING', notes: 'Emergency Sunday overtime' }),
    });

    // Re-generate the roster for 11/2026
    await fetch(`${baseUrl}/rosters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 11, year: 2026 }),
    });

    const resGridAfter = await fetch(`${baseUrl}/rosters/${rosterId}/entries`);
    const bodyGridAfter = await resGridAfter.json();
    const cellAfter = bodyGridAfter.data?.grid?.[emp1.id]?.['2026-11-01'];

    const check9Passed = cellAfter?.status === 'WORKING' && Boolean(cellAfter?.is_manually_edited);
    record(9, 'Manual override preserved across repeated roster generation', check9Passed,
      `Status after re-gen: ${cellAfter?.status}, is_manually_edited: ${cellAfter?.is_manually_edited}, notes: "${cellAfter?.notes}"`);

    // -----------------------------------------------------------------
    // 13. Conflict Detection Engine: Separate coverage per brand/process
    // Proc A requires 3 staff members. Emp 1 and Emp 3 are assigned (2 total) -> UNDERSTAFFED on Proc A!
    // Proc B requires 1 staff member. Emp 2 is assigned (1 total) -> FULLY STAFFED on Proc B!
    // Verify that Emp 2 on Proc B is NOT counted toward Proc A!
    // -----------------------------------------------------------------
    const resVal = await fetch(`${baseUrl}/conflicts/validate/${rosterId}`, { method: 'POST' });
    const bodyVal = await resVal.json();
    const allConflicts = bodyVal.data?.conflicts || [];

    const understaffProcA = allConflicts.find(
      (c) => c.conflict_type === 'UNDERSTAFFED_PROCESS' && c.process_id === procA.id && c.conflict_date === '2026-11-02'
    );
    const understaffProcB = allConflicts.find(
      (c) => c.conflict_type === 'UNDERSTAFFED_PROCESS' && c.process_id === procB.id && c.conflict_date === '2026-11-02'
    );

    const check10Passed = Boolean(understaffProcA) && !understaffProcB;
    record(10, 'Process coverage evaluated independently per process (Proc A understaffed, Proc B fully staffed)', check10Passed,
      `Proc A understaffed: ${Boolean(understaffProcA)}, Proc B understaffed: ${Boolean(understaffProcB)}`);

    // -----------------------------------------------------------------
    // 14. Detect WORK_ON_OFF_DAY Conflict from manual Sunday edit
    // -----------------------------------------------------------------
    const offDayConflict = allConflicts.find(
      (c) => c.conflict_type === 'WORK_ON_OFF_DAY' && c.conflict_date === '2026-11-01'
    );
    const check11Passed = Boolean(offDayConflict) && offDayConflict.severity === 'WARNING';
    record(11, 'Detect WORK_ON_OFF_DAY warning conflict for manual Sunday work', check11Passed,
      `Found: ${Boolean(offDayConflict)}, Severity: ${offDayConflict?.severity}`);

    // -----------------------------------------------------------------
    // 15. Duplicate conflict prevention on repeat validation
    // -----------------------------------------------------------------
    const initialConflictCount = allConflicts.length;
    const resVal2 = await fetch(`${baseUrl}/conflicts/validate/${rosterId}`, { method: 'POST' });
    const bodyVal2 = await resVal2.json();
    const secondConflictCount = bodyVal2.data?.total_conflicts;

    const check12Passed = initialConflictCount === secondConflictCount;
    record(12, 'Duplicate conflict prevention on revalidation', check12Passed,
      `Count run 1: ${initialConflictCount}, Count run 2: ${secondConflictCount}`);

    // -----------------------------------------------------------------
    // 16. Preservation of RESOLVED and IGNORED conflicts across revalidation
    // -----------------------------------------------------------------
    const freshConflicts = bodyVal2.data?.conflicts || [];
    const freshUnderstaff = freshConflicts.find((c) => c.conflict_type === 'UNDERSTAFFED_PROCESS' && c.process_id === procA.id);
    const freshOffDay = freshConflicts.find((c) => c.conflict_type === 'WORK_ON_OFF_DAY');

    let resolvedConflictId = freshUnderstaff?.id;
    let ignoredConflictId = freshOffDay?.id;

    if (resolvedConflictId) {
      await fetch(`${baseUrl}/conflicts/${resolvedConflictId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_note: 'Approved minimum coverage by Operations Lead' }),
      });
    }

    if (ignoredConflictId) {
      await fetch(`${baseUrl}/conflicts/${ignoredConflictId}/ignore`, { method: 'PATCH' });
    }

    // Re-validate roster conflicts
    await fetch(`${baseUrl}/conflicts/validate/${rosterId}`, { method: 'POST' });

    const resCheckResolved = await fetch(`${baseUrl}/conflicts/${resolvedConflictId}`);
    const bodyCheckResolved = await resCheckResolved.json();

    const resCheckIgnored = await fetch(`${baseUrl}/conflicts/${ignoredConflictId}`);
    const bodyCheckIgnored = await resCheckIgnored.json();

    const check13Passed =
      bodyCheckResolved.data?.status === 'RESOLVED' &&
      bodyCheckIgnored.data?.status === 'IGNORED';
    record(13, 'RESOLVED and IGNORED conflicts preserved across revalidation', check13Passed,
      `Resolved status: ${bodyCheckResolved.data?.status}, Ignored status: ${bodyCheckIgnored.data?.status}`);

    // -----------------------------------------------------------------
    // 17. Publishing workflow
    // -----------------------------------------------------------------
    const resPub = await fetch(`${baseUrl}/rosters/${rosterId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    const bodyPub = await resPub.json();
    const check14Passed = resPub.status === 200 && bodyPub.data?.status === 'PUBLISHED';
    record(14, 'Publish roster transitions status from DRAFT to PUBLISHED', check14Passed,
      `Status: ${bodyPub.data?.status}, Published at: ${bodyPub.data?.published_at}`);

  } catch (err) {
    console.error('Fatal deep verification error:', err);
    record('FATAL', 'Unhandled exception', false, err.message);
  } finally {
    await new Promise((resolve) => server.close(resolve));

    console.log('\n🧹 Cleaning up deep verification temporary records from Supabase...');
    for (const rId of createdRosterIds) {
      await supabase.from('roster_entries').delete().eq('roster_id', rId);
      await supabase.from('roster_conflicts').delete().eq('roster_id', rId);
      await supabase.from('rosters').delete().eq('id', rId);
    }
    for (const hId of createdHolidayIds) await supabase.from('public_holidays').delete().eq('id', hId);
    for (const aId of createdAssignmentIds) await supabase.from('employee_assignments').delete().eq('id', aId);
    for (const pId of createdProcessIds) {
      await supabase.from('working_rules').delete().eq('process_id', pId);
      await supabase.from('processes').delete().eq('id', pId);
    }
    for (const bId of createdBrandIds) {
      await supabase.from('working_rules').delete().eq('brand_id', bId);
      await supabase.from('brands').delete().eq('id', bId);
    }
    for (const eId of createdEmployeeIds) {
      await supabase.from('weekly_offs').delete().eq('employee_id', eId);
      await supabase.from('leaves').delete().eq('employee_id', eId);
      await supabase.from('comp_offs').delete().eq('employee_id', eId);
      await supabase.from('employees').delete().eq('id', eId);
    }
    for (const podId of createdPodIds) await supabase.from('pods').delete().eq('id', podId);

    console.log('✨ Deep verification cleanup complete.\n');
  }

  const allPassed = results.every((r) => r.passed);
  console.log(`Deep Verification Summary: ${results.filter((r) => r.passed).length}/${results.length} Passed`);
  return { allPassed, results };
}

if (process.argv[1]?.endsWith('roster_deep_verification.js')) {
  runDeepVerification().then(({ allPassed }) => process.exit(allPassed ? 0 : 1));
}
