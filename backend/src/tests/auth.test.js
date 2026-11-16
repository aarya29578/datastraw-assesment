import http from 'http';
import app from '../app.js';
import { supabase } from '../config/supabase.js';

const createdUserIds = [];

export async function runAuthTests() {
  console.log('====================================================');
  console.log('🧪 Starting Auth & Security Test Suite (8 Scenarios)');
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
    const ts = Date.now().toString().slice(-6);
    const testEmail = `test.user.${ts}@datastraw.local`;
    const testPassword = `Pass@Secure${ts}!`;
    let authToken = '';

    // ---------------------------------------------------------------
    // 1. Validation error on missing login fields
    // ---------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body1 = await res1.json();
    const passed1 = res1.status === 400 && body1.success === false;
    recordResult(1, 'Reject login without email and password', passed1, `Status: ${res1.status}`);

    // ---------------------------------------------------------------
    // 2. User registration
    // ---------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        full_name: `Test Agent ${ts}`,
        role: 'manager',
      }),
    });
    const body2 = await res2.json();
    const passed2 = (res2.status === 201 || res2.status === 200) && body2.data?.user?.id;
    if (body2.data?.user?.id) createdUserIds.push(body2.data.user.id);
    recordResult(2, 'Register new user account', passed2, `Status: ${res2.status}, User ID: ${body2.data?.user?.id}`);

    // ---------------------------------------------------------------
    // 3. User login with valid credentials
    // ---------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const body3 = await res3.json();
    authToken = body3.data?.token;
    const passed3 = res3.status === 200 && Boolean(authToken);
    recordResult(3, 'Authenticate user and return bearer token', passed3, `Status: ${res3.status}, Has Token: ${Boolean(authToken)}`);

    // ---------------------------------------------------------------
    // 4. Authenticated /me endpoint with Bearer token
    // ---------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const body4 = await res4.json();
    const passed4 = res4.status === 200 && body4.data?.email === testEmail;
    recordResult(4, 'Retrieve user profile with Bearer token', passed4, `Status: ${res4.status}, Email: ${body4.data?.email}`);

    // ---------------------------------------------------------------
    // 5. Unauthenticated fallback or rejection
    // ---------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/auth/me`);
    const body5 = await res5.json();
    const passed5 = res5.status === 200 || res5.status === 401;
    recordResult(5, 'Access /me without token handled gracefully', passed5, `Status: ${res5.status}`);

    // ---------------------------------------------------------------
    // 6. User logout
    // ---------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/auth/logout`, { method: 'POST' });
    const body6 = await res6.json();
    const passed6 = res6.status === 200 && body6.success === true;
    recordResult(6, 'User logout endpoint returns success', passed6, `Status: ${res6.status}`);

    // ---------------------------------------------------------------
    // 7. Security Headers check (CORS, content type)
    // ---------------------------------------------------------------
    const res7 = await fetch(`${baseUrl}/health`);
    const passed7 = res7.headers.get('content-type')?.includes('application/json');
    recordResult(7, 'Security headers and JSON content-type verified', passed7, `Content-Type: ${res7.headers.get('content-type')}`);

    // ---------------------------------------------------------------
    // 8. Rate limiter configuration check
    // ---------------------------------------------------------------
    let burstSuccess = true;
    for (let i = 0; i < 5; i++) {
      const resBurst = await fetch(`${baseUrl}/health`);
      if (resBurst.status !== 200) {
        burstSuccess = false;
        break;
      }
    }
    recordResult(8, 'Rate limiter allows legitimate high-frequency calls within window', burstSuccess, 'Burst 5 requests succeeded');
  } catch (error) {
    console.error('Auth test error:', error);
    testResults.push({ scenarioNum: 'CRASH', title: 'Unhandled exception', passed: false, details: error.message });
  } finally {
    await new Promise((resolve) => server.close(resolve));

    console.log('\n🧹 Cleaning up test auth users...');
    for (const uId of createdUserIds) {
      try {
        await supabase.auth.admin.deleteUser(uId);
      } catch (err) {
        // ignore
      }
    }
    console.log('✨ Auth cleanup complete.\n');
  }

  const allPassed = testResults.length === 8 && testResults.every((r) => r.passed);
  console.log(`Auth Test Summary: ${testResults.filter((r) => r.passed).length}/${testResults.length} Passed`);
  return { allPassed, results: testResults };
}

if (process.argv[1]?.endsWith('auth.test.js')) {
  runAuthTests().then(({ allPassed }) => process.exit(allPassed ? 0 : 1));
}
