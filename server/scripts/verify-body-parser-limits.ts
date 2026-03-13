/**
 * TASK-011: Body parser limit integration tests
 *
 * Tests that express.json() and express.urlencoded() enforce a 1MB size limit
 * to prevent memory-exhaustion DoS attacks (CWE-400).
 *
 * These tests create a minimal Express app that mirrors the body parser
 * configuration from server.ts, isolating the limit behavior from database
 * and other middleware dependencies.
 */

import express from 'express';
import http from 'http';

const TARGET_LIMIT = '1mb';
const ONE_MB = 1024 * 1024;

/** Create a minimal Express app with the CURRENT server.ts body parser config */
function createAppWithCurrentConfig(): express.Express {
  const app = express();

  // Mirror current server.ts config (lines 113-128) — 50mb limit
  app.use(express.json({
    limit: '50mb',
    verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
      (req as any).rawBody = buf;
    },
  }));

  app.use(express.urlencoded({
    limit: '50mb',
    extended: true,
    verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
      (req as any).rawBody = buf;
    },
  }));

  // Echo endpoint to confirm the body was parsed
  app.post('/echo', (req, res) => {
    res.status(200).json({ received: true, bodySize: JSON.stringify(req.body).length });
  });

  return app;
}

/** Create a minimal Express app with the FIXED body parser config (1mb limit) */
function createAppWithFixedConfig(): express.Express {
  const app = express();

  app.use(express.json({
    limit: TARGET_LIMIT,
    verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
      (req as any).rawBody = buf;
    },
  }));

  app.use(express.urlencoded({
    limit: TARGET_LIMIT,
    extended: true,
    verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
      (req as any).rawBody = buf;
    },
  }));

  app.post('/echo', (req, res) => {
    res.status(200).json({ received: true, bodySize: JSON.stringify(req.body).length });
  });

  return app;
}

/** Generate a JSON string of approximately the given size in bytes */
function generateLargeJsonPayload(sizeBytes: number): string {
  // Each character in this filler string is ~1 byte in UTF-8
  const overhead = '{"data":"}'.length;
  const fillerLength = sizeBytes - overhead;
  return JSON.stringify({ data: 'x'.repeat(fillerLength) });
}

/** Generate a URL-encoded string of approximately the given size in bytes */
function generateLargeUrlencodedPayload(sizeBytes: number): string {
  const prefix = 'data=';
  const fillerLength = sizeBytes - prefix.length;
  return prefix + 'x'.repeat(fillerLength);
}

/** Send a POST request to the given server and return the status code */
function postRequest(
  server: http.Server,
  path: string,
  body: string,
  contentType: string,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server not listening'));
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
      },
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Start an HTTP server on a random port and return it */
function listen(app: express.Express): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** Close an HTTP server */
function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

async function runTests(): Promise<void> {
  const results: TestResult[] = [];
  const TWO_MB = 2 * ONE_MB;

  // ---- Tests against CURRENT config (50mb limit) ---- //

  console.log('\n=== Testing CURRENT config (50mb limit) ===\n');

  const currentApp = createAppWithCurrentConfig();
  const currentServer = await listen(currentApp);

  // Scenario 1: Oversized JSON payload accepted with current 50mb limit
  {
    const name = 'Scenario 1: 2MB JSON accepted under 50mb limit (proves vulnerability)';
    const payload = generateLargeJsonPayload(TWO_MB);
    const res = await postRequest(currentServer, '/echo', payload, 'application/json');
    const passed = res.statusCode === 200;
    const detail = `Status: ${res.statusCode} (expected 200)`;
    results.push({ name, passed, detail });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${name} — ${detail}`);
  }

  // Scenario 2: Oversized URL-encoded payload accepted with current 50mb limit
  {
    const name = 'Scenario 2: 2MB URL-encoded accepted under 50mb limit (proves vulnerability)';
    const payload = generateLargeUrlencodedPayload(TWO_MB);
    const res = await postRequest(currentServer, '/echo', payload, 'application/x-www-form-urlencoded');
    const passed = res.statusCode === 200;
    const detail = `Status: ${res.statusCode} (expected 200)`;
    results.push({ name, passed, detail });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${name} — ${detail}`);
  }

  await close(currentServer);

  // ---- Tests against FIXED config (1mb limit) ---- //

  console.log('\n=== Testing FIXED config (1mb limit) ===\n');

  const fixedApp = createAppWithFixedConfig();
  const fixedServer = await listen(fixedApp);

  // Scenario 3: Oversized JSON rejected with 413 under 1mb limit
  {
    const name = 'Scenario 3: 2MB JSON rejected with 413 under 1mb limit';
    const payload = generateLargeJsonPayload(TWO_MB);
    const res = await postRequest(fixedServer, '/echo', payload, 'application/json');
    const passed = res.statusCode === 413;
    const detail = `Status: ${res.statusCode} (expected 413)`;
    results.push({ name, passed, detail });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${name} — ${detail}`);
  }

  // Scenario 4: Oversized URL-encoded rejected with 413 under 1mb limit
  {
    const name = 'Scenario 4: 2MB URL-encoded rejected with 413 under 1mb limit';
    const payload = generateLargeUrlencodedPayload(TWO_MB);
    const res = await postRequest(fixedServer, '/echo', payload, 'application/x-www-form-urlencoded');
    const passed = res.statusCode === 413;
    const detail = `Status: ${res.statusCode} (expected 413)`;
    results.push({ name, passed, detail });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${name} — ${detail}`);
  }

  // Scenario 5: Normal-sized JSON still accepted under 1mb limit
  {
    const name = 'Scenario 5: 10KB JSON accepted under 1mb limit (normal operation)';
    const payload = generateLargeJsonPayload(10 * 1024);
    const res = await postRequest(fixedServer, '/echo', payload, 'application/json');
    const passed = res.statusCode === 200;
    const detail = `Status: ${res.statusCode} (expected 200)`;
    results.push({ name, passed, detail });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${name} — ${detail}`);
  }

  // Scenario 6: Normal-sized URL-encoded still accepted under 1mb limit
  {
    const name = 'Scenario 6: 10KB URL-encoded accepted under 1mb limit (normal operation)';
    const payload = generateLargeUrlencodedPayload(10 * 1024);
    const res = await postRequest(fixedServer, '/echo', payload, 'application/x-www-form-urlencoded');
    const passed = res.statusCode === 200;
    const detail = `Status: ${res.statusCode} (expected 200)`;
    results.push({ name, passed, detail });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${name} — ${detail}`);
  }

  await close(fixedServer);

  // ---- Summary ---- //

  console.log('\n=== SUMMARY ===\n');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  for (const r of results) {
    console.log(`  ${r.passed ? 'PASS' : 'FAIL'}: ${r.name}`);
  }

  if (failed > 0) {
    console.log('\nSome tests failed.');
    process.exit(1);
  } else {
    console.log('\nAll tests passed.');
  }
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
