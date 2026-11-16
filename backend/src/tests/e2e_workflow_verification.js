import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

export async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('🔄 STARTING COMPLETE 16-STEP END-TO-END WORKFLOW VERIFICATION');
  console.log('================================================================\n');

  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise((resolve) => {
    server.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });

  const steps = [];
  const logStep = (stepNum, title, passed, details = '') => {
    steps.push({ stepNum, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [Step ${stepNum}/16] ${title}`);
    if (details) console.log(`   ↳ ${details}`);
  };

  const createdIds = {
    employees: [],
    pods: [],
    brands: [],
    processes: [],
    assignments: [],
    workingRules: [],
    weeklyOffs: [],
    leaves: [],
    rosters: [],
  };

  try {
    const ts = Date.now().toString().slice(-5);

    // -------------------------------------------------------------
    // Step 1: Create a Pod
    // -------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/pods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `E2E Pod ${ts}`, description: 'End-to-End Test Pod' }),
    });
    const body1 = await res1.json();
    const podId = body1.data?.id;
    if (podId) createdIds.pods.push(podId);
    logStep(1, 'Create a Pod', res1.status === 201 && Boolean(podId), `Pod ID: ${podId}`);

    // -------------------------------------------------------------
    // Step 2: Create an Employee
    // -------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_code: `E2E-EMP-${ts}`,
        full_name: `E2E Agent ${ts}`,
        email: `e2e.${ts}@datastraw.local`,
        designation: 'Operations Specialist',
      }),
    });
    const body2 = await res2.json();
    const empId = body2.data?.id;
    if (empId) createdIds.employees.push(empId);
    logStep(2, 'Create an Employee', res2.status === 201 && Boolean(empId), `Employee ID: ${empId}`);

    // -------------------------------------------------------------
    // Step 3: Assign the Employee to the Pod
    // -------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/employees/${empId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pod_id: podId }),
    });
    const body3 = await res3.json();
    const passed3 = res3.status === 200 && body3.data?.pod_id === podId;
    logStep(3, 'Assign the Employee to the Pod', passed3, `Updated pod_id: ${body3.data?.pod_id}`);

    // -------------------------------------------------------------
    // Step 4: Create a Brand
    // -------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/brands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `E2E Brand ${ts}`, description: 'E2E Client Brand' }),
    });
    const body4 = await res4.json();
    const brandId = body4.data?.id;
    if (brandId) createdIds.brands.push(brandId);
    logStep(4, 'Create a Brand', res4.status === 201 && Boolean(brandId), `Brand ID: ${brandId}`);

    // -------------------------------------------------------------
    // Step 5: Create Processes
    // -------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/processes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: `E2E_${ts.slice(-3)}`, name: `E2E Process ${ts}` }),
    });
    const body5 = await res5.json();
    const processId = body5.data?.id;
    if (processId) createdIds.processes.push(processId);
    logStep(5, 'Create Processes', res5.status === 201 && Boolean(processId), `Process ID: ${processId}`);

    // -------------------------------------------------------------
    // Step 6: Create employee assignments
    // -------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: empId,
        brand_id: brandId,
        process_id: processId,
        is_primary: true,
      }),
    });
    const body6 = await res6.json();
    const assignmentId = body6.data?.id;
    if (assignmentId) createdIds.assignments.push(assignmentId);
    logStep(6, 'Create employee assignments', res6.status === 201 && Boolean(assignmentId), `Assignment ID: ${assignmentId}`);

    // -------------------------------------------------------------
    // Step 7: Configure working rules
    // -------------------------------------------------------------
    const res7 = await fetch(`${baseUrl}/working-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: brandId,
        process_id: processId,
        operating_days: [0, 1, 2, 3, 4, 5],
        operates_on_public_holidays: false,
        required_staff_count: 1,
        effective_from: '2026-01-01',
      }),
    });
    const body7 = await res7.json();
    const ruleId = body7.data?.id;
    if (ruleId) createdIds.workingRules.push(ruleId);
    logStep(7, 'Configure working rules', res7.status === 201 && Boolean(ruleId), `Rule ID: ${ruleId}`);

    // -------------------------------------------------------------
    // Step 8: Configure weekly offs
    // -------------------------------------------------------------
    const res8 = await fetch(`${baseUrl}/availability/weekly-offs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: empId,
        weekday: 0, // Sunday
      }),
    });
    const body8 = await res8.json();
    const woId = body8.data?.id;
    if (woId) createdIds.weeklyOffs.push(woId);
    logStep(8, 'Configure weekly offs', res8.status === 201 && Boolean(woId), `Weekly Off ID: ${woId}`);

    // -------------------------------------------------------------
    // Step 9: Create and approve a leave
    // -------------------------------------------------------------
    const res9a = await fetch(`${baseUrl}/availability/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: empId,
        leave_type: 'ANNUAL',
        start_date: '2026-11-18',
        end_date: '2026-11-18',
        reason: 'E2E Vacation',
      }),
    });
    const body9a = await res9a.json();
    const leaveId = body9a.data?.id;
    if (leaveId) createdIds.leaves.push(leaveId);

    const res9b = await fetch(`${baseUrl}/availability/leaves/${leaveId}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: empId }),
    });
    const body9b = await res9b.json();
    const passed9 = res9b.status === 200 && body9b.data?.status === 'APPROVED';
    logStep(9, 'Create and approve a leave', passed9, `Leave ID: ${leaveId}, Status: ${body9b.data?.status}`);

    // -------------------------------------------------------------
    // Step 10: Generate a monthly roster
    // -------------------------------------------------------------
    const res10 = await fetch(`${baseUrl}/rosters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 11, year: 2026 }),
    });
    const body10 = await res10.json();
    const rosterId = body10.data?.roster?.id;
    if (rosterId) createdIds.rosters.push(rosterId);
    logStep(10, 'Generate a monthly roster', (res10.status === 200 || res10.status === 201) && Boolean(rosterId), `Roster ID: ${rosterId}`);

    // -------------------------------------------------------------
    // Step 11: Inspect generated roster entries
    // -------------------------------------------------------------
    const res11 = await fetch(`${baseUrl}/rosters/${rosterId}/entries`);
    const body11 = await res11.json();
    const grid = body11.data?.grid || {};
    const empGrid = grid[empId] || {};
    const leaveCell = empGrid['2026-11-18'];
    const sundayCell = empGrid['2026-11-01'];
    const passed11 =
      leaveCell?.status === 'LEAVE' &&
      sundayCell?.status === 'WEEKLY_OFF' &&
      Object.keys(empGrid).length === 30;
    logStep(11, 'Inspect generated roster entries', passed11,
      `Total days: ${Object.keys(empGrid).length}, Leave cell (Nov 18): ${leaveCell?.status}, Sunday cell (Nov 1): ${sundayCell?.status}`);

    // -------------------------------------------------------------
    // Step 12: Validate conflicts
    // -------------------------------------------------------------
    const res12 = await fetch(`${baseUrl}/conflicts/validate/${rosterId}`, { method: 'POST' });
    const body12 = await res12.json();
    const passed12 = res12.status === 200 && Array.isArray(body12.data?.conflicts);
    logStep(12, 'Validate conflicts', passed12, `Detected conflicts: ${body12.data?.total_conflicts}`);

    // -------------------------------------------------------------
    // Step 13: Manually edit a roster entry
    // -------------------------------------------------------------
    const targetEntryId = sundayCell?.entry_id;
    const res13 = await fetch(`${baseUrl}/rosters/${rosterId}/entries/${targetEntryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'WORKING', notes: 'Scheduled on off-day override' }),
    });
    const body13 = await res13.json();
    const passed13 = res13.status === 200 && body13.data?.status === 'WORKING' && body13.data?.is_manually_edited === true;
    logStep(13, 'Manually edit a roster entry', passed13, `New status: ${body13.data?.status}, is_manually_edited: ${body13.data?.is_manually_edited}`);

    // -------------------------------------------------------------
    // Step 14: Revalidate conflicts
    // -------------------------------------------------------------
    const res14 = await fetch(`${baseUrl}/conflicts/validate/${rosterId}`, { method: 'POST' });
    const body14 = await res14.json();
    const offDayConflict = (body14.data?.conflicts || []).find(
      (c) => c.conflict_type === 'WORK_ON_OFF_DAY' && c.conflict_date === '2026-11-01'
    );
    const passed14 = res14.status === 200 && Boolean(offDayConflict);
    logStep(14, 'Revalidate conflicts (detected WORK_ON_OFF_DAY from manual edit)', passed14,
      `Conflict found: ${Boolean(offDayConflict)}, Severity: ${offDayConflict?.severity}`);

    // -------------------------------------------------------------
    // Step 15: Publish the roster
    // -------------------------------------------------------------
    const res15 = await fetch(`${baseUrl}/rosters/${rosterId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    const body15 = await res15.json();
    const passed15 = res15.status === 200 && body15.data?.status === 'PUBLISHED';
    logStep(15, 'Publish the roster if there are no blocking issues', passed15, `Roster Status: ${body15.data?.status}`);

    // -------------------------------------------------------------
    // Step 16: Reload and verify persisted data across all entities
    // -------------------------------------------------------------
    const [resEmp, resPod, resRoster, resDash] = await Promise.all([
      fetch(`${baseUrl}/employees/${empId}`),
      fetch(`${baseUrl}/pods/${podId}`),
      fetch(`${baseUrl}/rosters/${rosterId}`),
      fetch(`${baseUrl}/dashboard/metrics`),
    ]);

    const bodyEmp = await resEmp.json();
    const bodyPod = await resPod.json();
    const bodyRoster = await resRoster.json();
    const bodyDash = await resDash.json();

    const passed16 =
      bodyEmp.data?.id === empId &&
      bodyEmp.data?.pod_id === podId &&
      bodyPod.data?.id === podId &&
      bodyRoster.data?.status === 'PUBLISHED' &&
      bodyDash.data?.employees?.total >= 1;

    logStep(16, 'Reload and verify persisted data across all entities', passed16,
      `Emp found: ${bodyEmp.data?.full_name}, Pod found: ${bodyPod.data?.name}, Roster Status: ${bodyRoster.data?.status}, Live Total Emps: ${bodyDash.data?.employees?.total}`);

  } catch (err) {
    console.error('Fatal E2E error:', err);
    logStep('FATAL', 'Unhandled exception during E2E flow', false, err.message);
  } finally {
    await new Promise((resolve) => server.close(resolve));

    console.log('\n🧹 Cleaning up isolated E2E temporary records from Supabase...');
    for (const rId of createdIds.rosters) {
      await supabase.from('roster_entries').delete().eq('roster_id', rId);
      await supabase.from('roster_conflicts').delete().eq('roster_id', rId);
      await supabase.from('rosters').delete().eq('id', rId);
    }
    for (const aId of createdIds.assignments) await supabase.from('employee_assignments').delete().eq('id', aId);
    for (const ruleId of createdIds.workingRules) await supabase.from('working_rules').delete().eq('id', ruleId);
    for (const pId of createdIds.processes) await supabase.from('processes').delete().eq('id', pId);
    for (const bId of createdIds.brands) await supabase.from('brands').delete().eq('id', bId);
    for (const lId of createdIds.leaves) await supabase.from('leaves').delete().eq('id', lId);
    for (const woId of createdIds.weeklyOffs) await supabase.from('weekly_offs').delete().eq('id', woId);
    for (const eId of createdIds.employees) await supabase.from('employees').delete().eq('id', eId);
    for (const podId of createdIds.pods) await supabase.from('pods').delete().eq('id', podId);

    console.log('✨ E2E cleanup complete.\n');
  }

  const allPassed = steps.length === 16 && steps.every((s) => s.passed);
  console.log(`E2E Verification Summary: ${steps.filter((s) => s.passed).length}/${steps.length} Steps Passed`);
  return { allPassed, steps };
}

if (process.argv[1]?.endsWith('e2e_workflow_verification.js')) {
  runEndToEndVerification().then(({ allPassed }) => process.exit(allPassed ? 0 : 1));
}
