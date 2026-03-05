import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function parseEnvLocal(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }

  return env;
}

async function run() {
  const root = process.cwd();
  const envPath = path.join(root, '.env.local');

  if (!fs.existsSync(envPath)) {
    console.error('FAIL: .env.local not found');
    process.exit(1);
  }

  const env = parseEnvLocal(envPath);
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((key) => !env[key] || env[key] === '');

  if (missing.length > 0) {
    console.error(`FAIL: Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startedAt = Date.now();
  const { data, error } = await admin.rpc('get_platform_schema_health');
  const durationMs = Date.now() - startedAt;

  if (error) {
    console.error(`FAIL: schema health rpc failed :: ${error.message}`);
    process.exit(1);
  }

  const result = data ?? null;
  if (!result || typeof result !== 'object' || !Array.isArray(result.checks)) {
    console.error('FAIL: invalid schema health response shape');
    process.exit(1);
  }

  const failedChecks = Array.isArray(result.failed_checks)
    ? result.failed_checks
    : result.checks.filter((check) => !check.ok);

  console.log(`Schema health completed in ${durationMs}ms`);
  console.log(`- healthy: ${result.healthy ? 'yes' : 'no'}`);
  console.log(`- checks: ${result.summary?.passed ?? 0}/${result.summary?.total ?? result.checks.length} passed`);

  for (const check of result.checks) {
    console.log(`- ${check.ok ? 'PASS' : 'FAIL'} ${check.key}`);
  }

  if (!result.healthy || failedChecks.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('FAIL: schema health smoke test crashed:', error?.message ?? error);
  process.exit(1);
});
