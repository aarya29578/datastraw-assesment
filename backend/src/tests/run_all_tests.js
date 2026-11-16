import { runEmployeeTests } from './employee.test.js';
import { runPodTests } from './pod.test.js';
import { runBrandTests } from './brand.test.js';
import { runProcessTests } from './process.test.js';
import { runAssignmentTests } from './assignment.test.js';
import { runWorkingRuleTests } from './workingRule.test.js';
import { runAvailabilityTests } from './availability.test.js';
import { runRosterTests } from './roster.test.js';
import { runConflictTests } from './conflict.test.js';
import { runConflictResolutionWorkflowTests } from './conflict_resolution_workflow.test.js';
import { runAuthTests } from './auth.test.js';

const testSuites = [
  { name: 'Employees API', fn: runEmployeeTests, expected: 12 },
  { name: 'Pods API', fn: runPodTests, expected: 12 },
  { name: 'Brands API', fn: runBrandTests, expected: 12 },
  { name: 'Processes API', fn: runProcessTests, expected: 12 },
  { name: 'Assignments API', fn: runAssignmentTests, expected: 12 },
  { name: 'Working Rules API', fn: runWorkingRuleTests, expected: 12 },
  { name: 'Availability API', fn: runAvailabilityTests, expected: 12 },
  { name: 'Roster Engine API', fn: runRosterTests, expected: 12 },
  { name: 'Conflict Engine API', fn: runConflictTests, expected: 12 },
  { name: 'Conflict Workflow API', fn: runConflictResolutionWorkflowTests, expected: 9 },
  { name: 'Auth & Security API', fn: runAuthTests, expected: 8 },
];

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   DATASTRAW FULL TEST SUITE RUNNER (ALL 10 MODULES)      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const suiteResults = [];

  for (const suite of testSuites) {
    try {
      console.log(`\n============================================================`);
      console.log(`🚀 RUNNING SUITE: ${suite.name}`);
      console.log(`============================================================`);
      const { allPassed, results } = await suite.fn();
      const passedCount = (results || []).filter((r) => r.passed).length;
      suiteResults.push({
        name: suite.name,
        passed: allPassed,
        passedCount,
        totalCount: results?.length || suite.expected,
      });
    } catch (err) {
      console.error(`💥 Suite ${suite.name} encountered an unhandled error:`, err);
      suiteResults.push({
        name: suite.name,
        passed: false,
        passedCount: 0,
        totalCount: suite.expected,
      });
    }
  }

  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('🏁 FINAL TEST EXECUTION SUMMARY ACROSS ALL 10 MODULES');
  console.log('════════════════════════════════════════════════════════════');

  let allPassed = true;
  let totalTests = 0;
  let passedTests = 0;

  for (const r of suiteResults) {
    const status = r.passed ? '✅ PASSED' : '❌ FAILED';
    totalTests += r.totalCount;
    passedTests += r.passedCount;
    if (!r.passed) allPassed = false;
    console.log(`  • ${r.name.padEnd(24)}: ${status} (${r.passedCount}/${r.totalCount} Scenarios)`);
  }

  console.log('════════════════════════════════════════════════════════════');
  console.log(`TOTAL SCENARIOS VERIFIED: ${passedTests}/${totalTests} (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('════════════════════════════════════════════════════════════');

  if (allPassed) {
    console.log(`🎉 ALL 10 TEST SUITES PASSED CLEANLY (${passedTests}/${totalTests} Scenarios Verified Against Supabase)!`);
    process.exit(0);
  } else {
    console.error('💥 ONE OR MORE TEST SUITES FAILED.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Master test runner fatal error:', err);
  process.exit(1);
});
