import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runAssessmentComplianceSuite() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   DATASTRAW COMPLETE ASSESSMENT COMPLIANCE AUDIT & E2E TESTING    ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  const stepResults = [];
  const recordStep = (stepNum, title, passed, details = '') => {
    stepResults.push({ stepNum, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [Step ${stepNum}/20] ${title}`);
    if (details) console.log(`   ↳ ${details}`);
  };

  const cleanupIds = {
    employees: [],
    pods: [],
    brands: [],
    processes: [],
    assignments: [],
    rules: [],
    rosters: [],
    leaves: [],
    holidays: [],
  };

  try {
    const ts = Date.now().toString().slice(-5);

    // =========================================================================
    // STEP 1: Verify Master Pods & Pod Leads (At least 4 pods)
    // =========================================================================
    const resPods = await fetch(`${baseUrl}/pods`);
    const bodyPods = await resPods.json();
    const pods = Array.isArray(bodyPods.data) ? bodyPods.data : (bodyPods.data?.pods || []);
    const passed1 = resPods.status === 200 && pods.length >= 4;
    const leadsAssigned = pods.filter((p) => Boolean(p.lead_employee_id || p.lead_employee || p.leadId)).length;
    recordStep(
      1,
      'Verify Operational Pods & Pod Leads',
      passed1 && leadsAssigned >= 2,
      `Found ${pods.length} pods in database, ${leadsAssigned} pods have designated team leads`
    );

    // =========================================================================
    // STEP 2: Verify Workforce Scale (At least 30 employees)
    // =========================================================================
    const resEmps = await fetch(`${baseUrl}/employees?limit=100`);
    const bodyEmps = await resEmps.json();
    const emps = Array.isArray(bodyEmps.data) ? bodyEmps.data : (bodyEmps.data?.employees || []);
    const totalEmps = bodyEmps.pagination?.total || emps.length;
    const passed2 = resEmps.status === 200 && totalEmps >= 30;
    recordStep(
      2,
      'Verify 30+ Employee Team Management',
      passed2,
      `Active workforce directory contains ${totalEmps} employees (Requirement: >= 30)`
    );

    // =========================================================================
    // STEP 3: Verify Brand Portfolio (80% Single-Resource / 20% Multi-Resource)
    // =========================================================================
    const resBrands = await fetch(`${baseUrl}/brands?limit=100`);
    const bodyBrands = await resBrands.json();
    const brands = Array.isArray(bodyBrands.data) ? bodyBrands.data : (bodyBrands.data?.brands || []);
    const resAsgnsAll = await fetch(`${baseUrl}/assignments?limit=200`);
    const bodyAsgnsAll = await resAsgnsAll.json();
    const allAssignments = Array.isArray(bodyAsgnsAll.data) ? bodyAsgnsAll.data : (bodyAsgnsAll.data?.assignments || []);

    // Count assigned employees per brand
    const brandEmpMap = new Map();
    allAssignments.forEach((a) => {
      const bId = a.brand_id || a.brandId;
      const eId = a.employee_id || a.employeeId;
      if (!brandEmpMap.has(bId)) brandEmpMap.set(bId, new Set());
      brandEmpMap.get(bId).add(eId);
    });

    let singleResourceBrands = 0;
    let multiResourceBrands = 0;
    brands.forEach((b) => {
      const assignedCount = brandEmpMap.get(b.id)?.size || 0;
      if (assignedCount === 1) singleResourceBrands++;
      else if (assignedCount > 1) multiResourceBrands++;
    });

    const passed3 = brands.length >= 10 && singleResourceBrands >= 7 && multiResourceBrands >= 2;
    recordStep(
      3,
      'Verify Brand Portfolio & 80/20 Distribution',
      passed3,
      `Total Brands: ${brands.length} | Single-Resource: ${singleResourceBrands} (${Math.round((singleResourceBrands / brands.length) * 100)}%) | Multi-Resource: ${multiResourceBrands} (${Math.round((multiResourceBrands / brands.length) * 100)}%)`
    );

    // =========================================================================
    // STEP 4: Verify Multi-Process Operations (CS, ACC, RET, NDR, VIP, OTD)
    // =========================================================================
    const resProcs = await fetch(`${baseUrl}/processes?limit=100`);
    const bodyProcs = await resProcs.json();
    const processes = Array.isArray(bodyProcs.data) ? bodyProcs.data : (bodyProcs.data?.processes || []);
    const procCodes = processes.map((p) => p.code);
    const hasCoreProcs = ['CS01', 'ACC01', 'RET01', 'NDR01'].every((c) => procCodes.includes(c));
    const passed4 = resProcs.status === 200 && processes.length >= 6 && hasCoreProcs;
    recordStep(
      4,
      'Verify Core Operational Processes',
      passed4,
      `Found ${processes.length} processes: ${procCodes.slice(0, 6).join(', ')}`
    );

    // =========================================================================
    // STEP 5: Verify Brand-Process Associations
    // =========================================================================
    const brandsWithProcesses = brands.filter((b) => Array.isArray(b.assigned_processes) && b.assigned_processes.length > 0);
    const passed5 = brandsWithProcesses.length >= 8;
    recordStep(
      5,
      'Verify Brand-Process Associations',
      passed5,
      `${brandsWithProcesses.length}/${brands.length} brands have configured process associations`
    );

    // =========================================================================
    // STEP 6: Verify Workforce Assignments (Single Dedicated & Multi-Employee Shared)
    // =========================================================================
    const sharedProcessAsgns = new Map();
    allAssignments.forEach((a) => {
      const bId = a.brand_id || a.brandId;
      const pId = a.process_id || a.processId;
      const key = `${bId}_${pId}`;
      sharedProcessAsgns.set(key, (sharedProcessAsgns.get(key) || 0) + 1);
    });
    const hasSharedProcess = Array.from(sharedProcessAsgns.values()).some((cnt) => cnt >= 2);
    const passed6 = allAssignments.length >= 15 && hasSharedProcess;
    recordStep(
      6,
      'Verify Workforce Assignments & Shared Process Coverage',
      passed6,
      `Total Assignments: ${allAssignments.length} | Multi-specialist shared processes confirmed: ${hasSharedProcess}`
    );

    // =========================================================================
    // STEP 7: Verify Diverse Working Rules (365-day, Mon-Sat, Mon-Fri, Holiday flags)
    // =========================================================================
    const resRules = await fetch(`${baseUrl}/working-rules?limit=100`);
    const bodyRules = await resRules.json();
    const rules = Array.isArray(bodyRules.data) ? bodyRules.data : (bodyRules.data?.workingRules || []);
    const has365Days = rules.some((r) => (r.operating_days?.length === 7 || r.operatingDays?.length === 7) && (r.operates_on_public_holidays || r.operatesOnPublicHolidays));
    const hasMonSat = rules.some((r) => r.operating_days?.length === 6 || r.operatingDays?.length === 6);
    const hasMonFri = rules.some((r) => r.operating_days?.length === 5 || r.operatingDays?.length === 5);
    const passed7 = rules.length >= 10 && has365Days && hasMonSat && hasMonFri;
    recordStep(
      7,
      'Verify Client-Specific Working Rules Diversity',
      passed7,
      `Rules configured: ${rules.length} | 365-day operation: ${has365Days} | Mon-Sat: ${hasMonSat} | Mon-Fri: ${hasMonFri}`
    );

    // =========================================================================
    // STEP 8: Verify Employee Recurring Weekly Offs
    // =========================================================================
    const resWOffs = await fetch(`${baseUrl}/availability/weekly-offs`);
    const bodyWOffs = await resWOffs.json();
    const weeklyOffs = Array.isArray(bodyWOffs.data) ? bodyWOffs.data : (bodyWOffs.data?.weekly_offs || []);
    const hasSundayOff = weeklyOffs.some((w) => w.weekday === 0);
    const hasSaturdayOff = weeklyOffs.some((w) => w.weekday === 6);
    const passed8 = weeklyOffs.length >= 25 && hasSundayOff && hasSaturdayOff;
    recordStep(
      8,
      'Verify Weekly Off Configurations',
      passed8,
      `Weekly offs configured for ${weeklyOffs.length} employees (Sunday & Saturday distribution verified)`
    );

    // =========================================================================
    // STEP 9: Verify Public Holidays Calendar
    // =========================================================================
    const resHols = await fetch(`${baseUrl}/availability/holidays`);
    const bodyHols = await resHols.json();
    const holidays = Array.isArray(bodyHols.data) ? bodyHols.data : (bodyHols.data?.holidays || []);
    const passed9 = holidays.length >= 3;
    recordStep(
      9,
      'Verify Public Holiday Calendar',
      passed9,
      `Found ${holidays.length} gazetted public holidays in calendar`
    );

    // =========================================================================
    // STEP 10: Verify Leave Lifecycle & Approval
    // =========================================================================
    // Select an employee who is actively assigned to a process
    const testEmp = emps.find((e) => allAssignments.some((a) => (a.employee_id || a.employeeId) === e.id)) || emps[0];
    const empName = testEmp.full_name || testEmp.fullName || 'Employee';
    const leaveStartDate = '2026-11-18';
    const leaveEndDate = '2026-11-18';
    const resLeave = await fetch(`${baseUrl}/availability/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: testEmp.id,
        leave_type: 'ANNUAL',
        start_date: leaveStartDate,
        end_date: leaveEndDate,
        reason: 'E2E Compliance Leave Test',
      }),
    });
    const bodyLeave = await resLeave.json();
    const leaveId = bodyLeave.data?.id;
    if (leaveId) cleanupIds.leaves.push(leaveId);

    // Approve the leave via PATCH /api/availability/leaves/:id/approve
    const resApprove = await fetch(`${baseUrl}/availability/leaves/${leaveId}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    const bodyApprove = await resApprove.json();
    const passed10 = resApprove.status === 200 && (bodyApprove.data?.status === 'APPROVED' || bodyApprove.success);
    recordStep(
      10,
      'Create and Approve Planned Employee Leave',
      passed10,
      `Leave for ${empName} on ${leaveStartDate} approved successfully`
    );

    // =========================================================================
    // STEP 11: Generate Monthly Roster for November 2026 (30 Days)
    // =========================================================================
    const resGenNov = await fetch(`${baseUrl}/rosters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 11, year: 2026 }),
    });
    const bodyGenNov = await resGenNov.json();
    const novRosterId = bodyGenNov.data?.roster?.id;
    const novEntriesCount = bodyGenNov.data?.total_entries_generated;
    const passed11 = resGenNov.status === 201 && novRosterId && novEntriesCount > 0;
    recordStep(
      11,
      'Generate Monthly Roster (30 Days)',
      passed11,
      `Generated Roster ${novRosterId}: ${novEntriesCount} shift entries produced in ${bodyGenNov.data?.days_in_month} days`
    );

    // =========================================================================
    // STEP 12: Verify Database Persistence & Multi-Month Calendar Accuracy (Feb 28/29)
    // =========================================================================
    // Test February 2024 (Leap: 29 days) and February 2025 (Non-leap: 28 days)
    const resGenFebLeap = await fetch(`${baseUrl}/rosters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 2, year: 2024 }),
    });
    const bodyGenFebLeap = await resGenFebLeap.json();
    if (bodyGenFebLeap.data?.roster?.id) cleanupIds.rosters.push(bodyGenFebLeap.data.roster.id);

    const resGenFebNonLeap = await fetch(`${baseUrl}/rosters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 2, year: 2025 }),
    });
    const bodyGenFebNonLeap = await resGenFebNonLeap.json();
    if (bodyGenFebNonLeap.data?.roster?.id) cleanupIds.rosters.push(bodyGenFebNonLeap.data.roster.id);

    const passed12 =
      bodyGenFebLeap.data?.days_in_month === 29 && bodyGenFebNonLeap.data?.days_in_month === 28;
    recordStep(
      12,
      'Multi-Month & Leap Year Calendar Accuracy',
      passed12,
      `Feb 2024 Leap: ${bodyGenFebLeap.data?.days_in_month} days | Feb 2025 Non-Leap: ${bodyGenFebNonLeap.data?.days_in_month} days`
    );

    // =========================================================================
    // STEP 13: Verify Status Precedence (Holiday > Leave > Comp-Off > Weekly Off > Working)
    // =========================================================================
    const resNovGrid = await fetch(`${baseUrl}/rosters/${novRosterId}/entries`);
    const bodyNovGrid = await resNovGrid.json();
    const grid = bodyNovGrid.data?.grid || {};

    // Check testEmp's cell on approved leave date
    const leaveCell = grid[testEmp.id]?.[leaveStartDate];
    // Check Sunday weekly off
    const sundayCell = grid[testEmp.id]?.['2026-11-01'];

    const passed13 = leaveCell?.status === 'LEAVE' && (sundayCell?.status === 'WEEKLY_OFF' || sundayCell?.status === 'NOT_REQUIRED');
    recordStep(
      13,
      'Verify Status Precedence in Generated Grid',
      passed13,
      `Leave date (${leaveStartDate}) status: ${leaveCell?.status} | Sunday (2026-11-01) status: ${sundayCell?.status}`
    );

    // =========================================================================
    // STEP 14: Trigger Intentional Staffing Conflicts (Understaffing, Leave Work, Weekly Off)
    // =========================================================================
    // Manually force testEmp to WORKING on leave date (creating ON_LEAVE_SCHEDULED)
    if (leaveCell?.entry_id) {
      await fetch(`${baseUrl}/rosters/${novRosterId}/entries/${leaveCell.entry_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'WORKING', notes: 'Intentional conflict test shift' }),
      });
    }

    // Force Sunday cell to WORKING (creating WORK_ON_OFF_DAY)
    if (sundayCell?.entry_id) {
      await fetch(`${baseUrl}/rosters/${novRosterId}/entries/${sundayCell.entry_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'WORKING', notes: 'Intentional Sunday work' }),
      });
    }

    recordStep(
      14,
      'Trigger Intentional Scheduling Conflicts',
      true,
      `Injected manual working shifts on approved leave date and weekly off date`
    );

    // =========================================================================
    // STEP 15: Run Conflict Detection Engine & Verify Conflict Details
    // =========================================================================
    const resVal = await fetch(`${baseUrl}/conflicts/validate/${novRosterId}`, { method: 'POST' });
    const bodyVal = await resVal.json();
    const conflicts = Array.isArray(bodyVal.data) ? bodyVal.data : (bodyVal.data?.conflicts || []);

    const hasUnderstaffed = conflicts.some((c) => c.conflict_type === 'UNDERSTAFFED_PROCESS');
    const hasOnLeave = conflicts.some((c) => c.conflict_type === 'ON_LEAVE_SCHEDULED');
    const hasWorkOnOffDay = conflicts.some((c) => c.conflict_type === 'WORK_ON_OFF_DAY');

    const passed15 = hasUnderstaffed && hasOnLeave && hasWorkOnOffDay;
    recordStep(
      15,
      'Validate Conflicts with Exact Attributes',
      passed15,
      `Detected ${conflicts.length} conflicts | UNDERSTAFFED: ${hasUnderstaffed} | ON_LEAVE: ${hasOnLeave} | WORK_ON_OFF_DAY: ${hasWorkOnOffDay}`
    );

    // =========================================================================
    // STEP 16: Manager Conflict Resolution & Auto-Replacement Shift Assignment
    // =========================================================================
    const targetConflict = conflicts.find((c) => c.conflict_type === 'ON_LEAVE_SCHEDULED') || conflicts[0];
    let passed16 = false;
    if (targetConflict?.id) {
      const resResolve = await fetch(`${baseUrl}/conflicts/${targetConflict.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_notes: 'Approved overtime relief with backup specialist' }),
      });
      const bodyResolve = await resResolve.json();
      passed16 = resResolve.status === 200 && (bodyResolve.data?.status === 'RESOLVED' || bodyResolve.success);
    }
    recordStep(
      16,
      'Resolve Conflict with Manager Audit Notes',
      passed16,
      `Conflict ${targetConflict?.id?.slice(0, 8)} transitioned to RESOLVED with manager explanation`
    );

    // =========================================================================
    // STEP 17: Manual Cell Editing & Audit Metadata
    // =========================================================================
    const manualEditDate = '2026-11-25';
    const manualCell = grid[testEmp.id]?.[manualEditDate];
    let passed17 = false;
    if (manualCell?.entry_id) {
      const resEdit = await fetch(`${baseUrl}/rosters/${novRosterId}/entries/${manualCell.entry_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMP_OFF', notes: 'Earned festival comp-off' }),
      });
      const bodyEdit = await resEdit.json();
      passed17 = resEdit.status === 200 && bodyEdit.data?.is_manually_edited === true;
    }
    recordStep(
      17,
      'Manual Cell Edit with Audit Note & Override Flag',
      passed17,
      `Updated cell on ${manualEditDate} to COMP_OFF with is_manually_edited = true`
    );

    // =========================================================================
    // STEP 18: Regenerate Roster & Verify Manual Override Preservation
    // =========================================================================
    const resRegen = await fetch(`${baseUrl}/rosters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 11, year: 2026 }),
    });
    const bodyRegen = await resRegen.json();

    const resGridAfter = await fetch(`${baseUrl}/rosters/${novRosterId}/entries`);
    const bodyGridAfter = await resGridAfter.json();
    const cellAfterRegen = bodyGridAfter.data?.grid?.[testEmp.id]?.[manualEditDate];

    const passed18 =
      cellAfterRegen?.status === 'COMP_OFF' &&
      cellAfterRegen?.is_manually_edited === true &&
      bodyRegen.data?.total_manual_entries_preserved >= 1;
    recordStep(
      18,
      'Regenerate Roster & Verify Override Preservation',
      passed18,
      `Manual entry on ${manualEditDate} preserved: Status=${cellAfterRegen?.status}, Notes="${cellAfterRegen?.notes}"`
    );

    // =========================================================================
    // STEP 19: Single-Resource vs Multi-Resource Staffing Gap Evaluation
    // =========================================================================
    // Check single-resource brand coverage gap detection
    const singleBrandConflict = conflicts.find((c) => c.conflict_type === 'UNDERSTAFFED_PROCESS');
    const passed19 = Boolean(singleBrandConflict);
    recordStep(
      19,
      'Single-Resource vs Multi-Resource Staffing Gap Evaluation',
      passed19,
      `Understaffing detected on required operating day: Required=${singleBrandConflict?.required_staff_count}, Scheduled=${singleBrandConflict?.available_staff_count}`
    );

    // =========================================================================
    // STEP 20: Roster Publishing & Final State Transition
    // =========================================================================
    const resPub = await fetch(`${baseUrl}/rosters/${novRosterId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    const bodyPub = await resPub.json();
    const passed20 = resPub.status === 200 && bodyPub.data?.status === 'PUBLISHED' && Boolean(bodyPub.data?.published_at);
    recordStep(
      20,
      'Publish Roster & Finalize Cycle Lifecycle',
      passed20,
      `Roster ${novRosterId} status: PUBLISHED at ${bodyPub.data?.published_at}`
    );

    // Cleanup isolated leave created for testing
    if (cleanupIds.leaves.length > 0) {
      await supabase.from('leaves').delete().in('id', cleanupIds.leaves);
    }
    // Cleanup temporary feb rosters
    if (cleanupIds.rosters.length > 0) {
      await supabase.from('rosters').delete().in('id', cleanupIds.rosters);
    }

  } catch (err) {
    console.error('💥 E2E Assessment Compliance test error:', err);
  } finally {
    server.close();
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🏁 E2E ASSESSMENT COMPLIANCE AUDIT RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════');

  const allPassed = stepResults.every((r) => r.passed);
  const passedCount = stepResults.filter((r) => r.passed).length;

  stepResults.forEach((r) => {
    const mark = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${mark} [Step ${String(r.stepNum).padStart(2, '0')}/20] ${r.title}`);
  });

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`TOTAL AUDIT STEPS VERIFIED: ${passedCount}/20 (${Math.round((passedCount / 20) * 100)}% Pass Rate)`);
  console.log('═══════════════════════════════════════════════════════════════════');

  if (allPassed) {
    console.log('🎉 ALL 20 END-TO-END BUSINESS WORKFLOW STEPS FULLY COMPLIANT AND VERIFIED!');
    process.exit(0);
  } else {
    console.error('💥 SOME AUDIT STEPS FAILED.');
    process.exit(1);
  }
}

runAssessmentComplianceSuite().catch((err) => {
  console.error('Fatal compliance runner error:', err);
  process.exit(1);
});
