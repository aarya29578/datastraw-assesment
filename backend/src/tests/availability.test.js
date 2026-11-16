import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

const createdEmployeeIds = [];
const createdWeeklyOffIds = [];
const createdLeaveIds = [];
const createdCompOffIds = [];
const createdHolidayIds = [];

export async function runAvailabilityTests() {
  console.log('====================================================');
  console.log('🧪 Starting Availability API Test Suite (12 Scenarios)');
  console.log('====================================================\n');

  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/availability`;
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
      .insert([{ employee_code: `AV-EMP-${ts}`, full_name: 'Availability Agent', employment_status: 'ACTIVE' }])
      .select()
      .single();
    if (testEmp) createdEmployeeIds.push(testEmp.id);

    // ---------------------------------------------------------------
    // 1. Weekly Off: Create valid weekly off
    // ---------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/weekly-offs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: testEmp.id,
        weekday: 'Sunday',
        effective_from: '2026-01-01',
      }),
    });
    const body1 = await res1.json();
    const passed1 = res1.status === 201 && body1.success === true && body1.data?.weekday === 0;
    let weeklyOffId = body1.data?.id;
    if (weeklyOffId) createdWeeklyOffIds.push(weeklyOffId);
    recordResult(1, 'Create weekly off configuration', passed1, `Status: ${res1.status}, Day: ${body1.data?.weekday_name}`);

    // ---------------------------------------------------------------
    // 2. Weekly Off: Update weekly off
    // ---------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/weekly-offs/${weeklyOffId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekday: 'Saturday' }),
    });
    const body2 = await res2.json();
    const passed2 = res2.status === 200 && body2.data?.weekday === 6;
    recordResult(2, 'Update weekly off to Saturday (6)', passed2, `Status: ${res2.status}, Day: ${body2.data?.weekday_name}`);

    // ---------------------------------------------------------------
    // 3. Weekly Off: Delete weekly off
    // ---------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/weekly-offs/${weeklyOffId}`, { method: 'DELETE' });
    const passed3 = res3.status === 200;
    recordResult(3, 'Delete weekly off configuration', passed3, `Status: ${res3.status}`);
    const wIdx = createdWeeklyOffIds.indexOf(weeklyOffId);
    if (wIdx !== -1) createdWeeklyOffIds.splice(wIdx, 1);

    // ---------------------------------------------------------------
    // 4. Leaves: Submit leave request (PENDING)
    // ---------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: testEmp.id,
        leave_type: 'PL',
        start_date: '2026-11-10',
        end_date: '2026-11-12',
        reason: 'Family vacation',
      }),
    });
    const body4 = await res4.json();
    const passed4 = res4.status === 201 && body4.data?.status === 'PENDING';
    let leaveId = body4.data?.id;
    if (leaveId) createdLeaveIds.push(leaveId);
    recordResult(4, 'Submit employee leave request (status: PENDING)', passed4, `Status: ${res4.status}, ID: ${leaveId}`);

    // ---------------------------------------------------------------
    // 5. Leaves: Reject leave with invalid date range
    // ---------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: testEmp.id,
        leave_type: 'SL',
        start_date: '2026-11-20',
        end_date: '2026-11-15',
      }),
    });
    const passed5 = res5.status === 400;
    recordResult(5, 'Reject leave request with end_date < start_date', passed5, `Status: ${res5.status}`);

    // ---------------------------------------------------------------
    // 6. Leaves: Approve leave request
    // ---------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/leaves/${leaveId}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: testEmp.id }),
    });
    const body6 = await res6.json();
    const passed6 = res6.status === 200 && body6.data?.status === 'APPROVED';
    recordResult(6, 'Approve leave request (status: APPROVED)', passed6, `Status: ${res6.status}, Status: ${body6.data?.status}`);

    // Create a 2nd leave for reject/cancel
    const resLeave2 = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: testEmp.id,
        leave_type: 'CL',
        start_date: '2026-11-25',
        end_date: '2026-11-25',
      }),
    });
    const bodyLeave2 = await resLeave2.json();
    let leaveId2 = bodyLeave2.data?.id;
    if (leaveId2) createdLeaveIds.push(leaveId2);

    // ---------------------------------------------------------------
    // 7. Leaves: Reject leave request
    // ---------------------------------------------------------------
    const res7 = await fetch(`${baseUrl}/leaves/${leaveId2}/reject`, { method: 'PATCH' });
    const body7 = await res7.json();
    const passed7 = res7.status === 200 && body7.data?.status === 'REJECTED';
    recordResult(7, 'Reject leave request (status: REJECTED)', passed7, `Status: ${res7.status}, Status: ${body7.data?.status}`);

    // ---------------------------------------------------------------
    // 8. Leaves: Cancel leave request
    // ---------------------------------------------------------------
    const res8 = await fetch(`${baseUrl}/leaves/${leaveId2}/cancel`, { method: 'PATCH' });
    const body8 = await res8.json();
    const passed8 = res8.status === 200 && body8.data?.status === 'CANCELLED';
    recordResult(8, 'Cancel leave request (status: CANCELLED)', passed8, `Status: ${res8.status}, Status: ${body8.data?.status}`);

    // ---------------------------------------------------------------
    // 9. Comp-Offs: Record comp-off
    // ---------------------------------------------------------------
    const res9 = await fetch(`${baseUrl}/comp-offs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: testEmp.id,
        earned_on: '2026-11-01',
        off_date: '2026-11-18',
        reason: 'Worked on Diwali holiday',
      }),
    });
    const body9 = await res9.json();
    const passed9 = res9.status === 201 && body9.data?.status === 'PENDING';
    let compOffId = body9.data?.id;
    if (compOffId) createdCompOffIds.push(compOffId);
    recordResult(9, 'Record compensatory off request', passed9, `Status: ${res9.status}, Status: ${body9.data?.status}`);

    // ---------------------------------------------------------------
    // 10. Comp-Offs: Approve comp-off
    // ---------------------------------------------------------------
    const res10 = await fetch(`${baseUrl}/comp-offs/${compOffId}/approve`, { method: 'PATCH' });
    const body10 = await res10.json();
    const passed10 = res10.status === 200 && body10.data?.status === 'APPROVED';
    recordResult(10, 'Approve compensatory off request', passed10, `Status: ${res10.status}, Status: ${body10.data?.status}`);

    // ---------------------------------------------------------------
    // 11. Public Holidays: Create public holiday
    // ---------------------------------------------------------------
    const dayNum = String((parseInt(ts.slice(-2), 10) % 25) + 1).padStart(2, '0');
    const holidayDate = `2026-12-${dayNum}`;
    const res11 = await fetch(`${baseUrl}/holidays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        holiday_date: holidayDate,
        holiday_name: `Christmas Test Festival ${ts}`,
      }),
    });
    const body11 = await res11.json();
    const passed11 = res11.status === 201 && body11.data?.holiday_date === holidayDate;
    let holidayId = body11.data?.id;
    if (holidayId) createdHolidayIds.push(holidayId);
    recordResult(11, 'Create gazetted public holiday', passed11, `Status: ${res11.status}, Date: ${holidayDate}`);

    // ---------------------------------------------------------------
    // 12. Public Holidays: Reject duplicate holiday date
    // ---------------------------------------------------------------
    const res12 = await fetch(`${baseUrl}/holidays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        holiday_date: holidayDate,
        holiday_name: 'Duplicate Holiday Same Day',
      }),
    });
    const passed12 = res12.status === 409;
    recordResult(12, 'Reject duplicate public holiday on same date', passed12, `Status: ${res12.status}`);
  } catch (error) {
    console.error('Availability test error:', error);
    testResults.push({ scenarioNum: 'CRASH', title: 'Unhandled exception', passed: false, details: error.message });
  } finally {
    await new Promise((resolve) => server.close(resolve));

    console.log('\n🧹 Cleaning up availability test records from Supabase...');
    for (const hId of createdHolidayIds) await supabase.from('public_holidays').delete().eq('id', hId);
    for (const cId of createdCompOffIds) await supabase.from('comp_offs').delete().eq('id', cId);
    for (const lId of createdLeaveIds) await supabase.from('leaves').delete().eq('id', lId);
    for (const wId of createdWeeklyOffIds) await supabase.from('weekly_offs').delete().eq('id', wId);
    for (const eId of createdEmployeeIds) await supabase.from('employees').delete().eq('id', eId);
    console.log('✨ Availability cleanup complete.\n');
  }

  const allPassed = testResults.length === 12 && testResults.every((r) => r.passed);
  console.log(`Availability Test Summary: ${testResults.filter((r) => r.passed).length}/${testResults.length} Passed`);
  return { allPassed, results: testResults };
}

if (process.argv[1]?.endsWith('availability.test.js')) {
  runAvailabilityTests().then(({ allPassed }) => process.exit(allPassed ? 0 : 1));
}
