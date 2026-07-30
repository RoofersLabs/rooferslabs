#!/usr/bin/env node
/**
 * Local development preflight.
 *
 * Answers one question — "will `bun run dev` actually work right now?" — and
 * when the answer is no, says which thing is wrong and what to type. Every
 * failure here is a message a person can act on; none of them is a stack trace,
 * because a stack trace from a config problem tells you where the code noticed,
 * not what you did wrong.
 *
 *   node scripts/check-dev-env.mjs           # check, report, exit 1 on failure
 *   node scripts/check-dev-env.mjs --quiet   # only print problems
 *
 * Deliberately depends on nothing that is not already a dependency of the API:
 * ioredis and @prisma/client. Adding a package to validate the setup would be
 * one more thing that has to be installed before the setup can be validated.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUIET = process.argv.includes('--quiet');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const failures = [];
const warnings = [];

function ok(label, detail = '') {
  if (!QUIET)
    console.log(`  ${GREEN}✓${RESET} ${label}${detail ? ` ${DIM}${detail}${RESET}` : ''}`);
}
function fail(label, fix) {
  console.log(`  ${RED}✗${RESET} ${label}`);
  failures.push({ label, fix });
}
function warn(label, detail) {
  if (!QUIET) console.log(`  ${YELLOW}!${RESET} ${label} ${DIM}${detail}${RESET}`);
  warnings.push(label);
}

// ---- .env ---------------------------------------------------------------------
// Parsed here rather than with dotenv (not a dependency) — this is a flat
// KEY=value file we control the format of, so a 10-line parser beats a package.

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * The Clerk Frontend API host a publishable key points at.
 *
 * Clerk encodes the host in the key itself: `pk_test_<base64>` decodes to
 * something like `immortal-adder-67.clerk.accounts.dev$`, and `pk_live_<base64>`
 * to `clerk.rooferslabs.com$`. That is why a wrong key silently loads clerk-js
 * from the production domain with no proxyUrl or domain setting anywhere — and
 * why this check reports the decoded host rather than just the prefix.
 */
function clerkFrontendApi(key) {
  const body = key.split('_').slice(2).join('_');
  if (!body) return null;
  try {
    const decoded = Buffer.from(body + '='.repeat((4 - (body.length % 4)) % 4), 'base64').toString(
      'utf8',
    );
    return /^[a-z0-9.-]+$/i.test(decoded.replace(/\$$/, '')) ? decoded.replace(/\$$/, '') : null;
  } catch {
    return null;
  }
}

const envPath = join(ROOT, '.env');
if (!existsSync(envPath)) {
  console.log(`\n${RED}No .env file.${RESET}\n\n  cp .env.example .env\n`);
  process.exit(1);
}

// The file wins over the ambient shell: it is what `bun run dev` will load, so
// checking anything else would validate a configuration nobody runs.
const env = { ...process.env, ...parseEnvFile(envPath) };

// ---- Checks --------------------------------------------------------------------

if (!QUIET) console.log(`\n${DIM}Environment${RESET}`);

// Environment selection
{
  const appEnv = env.APP_ENV ?? '(unset)';
  if (env.APP_ENV === 'development') {
    ok('APP_ENV', '= development');
  } else if (!env.APP_ENV) {
    // Not fatal — the API defaults to development — but it means the guard is
    // relying on a default rather than on something written down.
    warn('APP_ENV is not set', 'defaults to development; add APP_ENV=development to .env');
  } else if (env.APP_ENV === 'production') {
    fail(
      'APP_ENV=production in a local .env',
      'Set APP_ENV=development. Production is a deployed tier, never a laptop.',
    );
  } else {
    warn('APP_ENV', `= ${appEnv} (anything but "production" behaves as development)`);
  }
}

// Launch mode: the private-beta gate must never apply locally.
{
  if (env.APP_ENV === 'production' && env.APP_LAUNCH_MODE !== 'public') {
    fail(
      'Launch gate would be ACTIVE locally',
      'APP_ENV must be development. The gate only applies to the production tier.',
    );
  } else {
    ok('Launch gate', 'disabled (development tier)');
  }
}

// Cross-environment credentials. The API warns about these at boot; failing
// here instead means you find out before the data moves, not after.
if (!QUIET) console.log(`\n${DIM}Credentials${RESET}`);

{
  const pk = env.CLERK_PUBLISHABLE_KEY ?? '';
  const sk = env.CLERK_SECRET_KEY ?? '';

  if (!pk || !sk) {
    fail(
      'Clerk keys are missing',
      'Clerk Dashboard → set the instance selector to DEVELOPMENT → API Keys.\n' +
        '       Put pk_test_… in CLERK_PUBLISHABLE_KEY and sk_test_… in CLERK_SECRET_KEY.',
    );
  } else if (pk.startsWith('pk_live_') || sk.startsWith('sk_live_')) {
    fail(
      'Clerk PRODUCTION keys in a local .env',
      'These point local development at the LIVE user directory — test sign-ups\n' +
        '       become real customer records. Switch the Clerk dashboard to its\n' +
        '       Development instance and copy pk_test_… / sk_test_… instead.',
    );
  } else if (!pk.startsWith('pk_test_') || !sk.startsWith('sk_test_')) {
    fail(
      'Clerk keys are malformed',
      'Expected pk_test_… and sk_test_… from the Development instance.',
    );
  } else {
    ok('Clerk (api)', clerkFrontendApi(pk) ?? 'development instance');
  }

  // The web app has its OWN key, in its own file. Checking only .env is what
  // let a stale pk_live_ sit in apps/web/.env.local while this reported a clean
  // development setup — the API was correct and the browser was loading
  // production Clerk.
  const webEnv = parseEnvFile(join(ROOT, 'apps/web/.env.local'));
  const webPk = (webEnv.VITE_CLERK_PUBLISHABLE_KEY ?? '').trim();

  if (!webPk) {
    fail(
      'apps/web/.env.local has no VITE_CLERK_PUBLISHABLE_KEY',
      'bun run setup   (regenerates it from .env)',
    );
  } else if (webPk.startsWith('pk_live_')) {
    fail(
      `Web Clerk key is PRODUCTION — the browser would load clerk-js from ${clerkFrontendApi(webPk) ?? 'the production domain'}`,
      'The key encodes the Clerk Frontend API host, so this signs users in\n' +
        '       against the LIVE user directory. Fix: bun run setup',
    );
  } else if (pk && webPk !== pk) {
    // Same instance on both sides, or the browser and the API disagree about
    // who is signed in — tokens minted by one are rejected by the other.
    fail(
      'Web and API Clerk keys are different instances',
      `api: ${clerkFrontendApi(pk) ?? '?'}\n       web: ${clerkFrontendApi(webPk) ?? '?'}\n` +
        '       Fix: bun run setup   (re-syncs the web key from .env)',
    );
  } else {
    ok('Clerk (web)', clerkFrontendApi(webPk) ?? 'development instance');
  }
}

{
  const paymentsOn = env.PAYMENTS_ENABLED === 'true';
  const key = env.PADDLE_API_KEY ?? '';

  if (key.startsWith('pdl_live_')) {
    fail(
      'Paddle LIVE key in a local .env',
      'Local testing could charge real payment methods. Use a sandbox key\n' +
        '       (pdl_sdbx_…) from Paddle → sandbox account → Developer tools.',
    );
  } else if (!paymentsOn) {
    ok('Paddle', 'billing disabled (PAYMENTS_ENABLED=false)');
  } else if (!key || !env.PADDLE_CLIENT_TOKEN) {
    fail(
      'PAYMENTS_ENABLED=true but Paddle sandbox credentials are missing',
      'Either set PAYMENTS_ENABLED=false to work without billing, or supply\n' +
        '       PADDLE_API_KEY and PADDLE_CLIENT_TOKEN from your Paddle SANDBOX account.',
    );
  } else if (env.PADDLE_ENVIRONMENT !== 'sandbox') {
    fail('PADDLE_ENVIRONMENT must be "sandbox" locally', 'Set PADDLE_ENVIRONMENT=sandbox in .env.');
  } else {
    ok('Paddle', 'sandbox');
  }
}

{
  const key = env.OPENAI_API_KEY ?? '';
  if (!key) {
    warn('OPENAI_API_KEY is not set', 'the AI receptionist and call analysis are disabled');
  } else if (!key.startsWith('sk-')) {
    fail('OPENAI_API_KEY does not look like an OpenAI key', 'Expected it to start with sk-.');
  } else {
    ok('OpenAI', 'key present');
  }
}

{
  const sid = env.TWILIO_ACCOUNT_SID ?? '';
  if (!sid) ok('Twilio', 'telephony disabled (no credentials — the safe default)');
  else if (!sid.startsWith('AC'))
    fail('TWILIO_ACCOUNT_SID is malformed', 'Expected it to start with AC.');
  else warn('Twilio credentials are set', 'confirm these belong to a DEVELOPMENT subaccount');
}

// ---- Services ------------------------------------------------------------------
if (!QUIET) console.log(`\n${DIM}Services${RESET}`);

const require = createRequire(join(ROOT, 'apps/api/package.json'));

// Prisma client — generated, not installed, so its absence is a missing step
// rather than a missing package.
let PrismaClient = null;
try {
  ({ PrismaClient } = require('@prisma/client'));
  // The generated client throws on construction when `prisma generate` has not
  // run since the schema changed, which is exactly what we want to detect.
  new PrismaClient();
  ok('Prisma client', 'generated');
} catch (error) {
  const message = String(error?.message ?? error);
  if (message.includes('did not initialize') || message.includes('generate')) {
    fail('Prisma client is not generated', 'bun run prisma:generate');
  } else {
    fail(
      'Prisma client could not be loaded',
      `bun run prisma:generate\n       (${message.split('\n')[0]})`,
    );
  }
  PrismaClient = null;
}

async function checkDatabase() {
  if (!PrismaClient) return;
  const url = env.DATABASE_URL ?? '';
  if (!url) {
    fail('DATABASE_URL is not set', 'Copy the value from .env.example.');
    return;
  }
  if (url.includes('rooferslabs-production')) {
    fail(
      'DATABASE_URL points at the PRODUCTION database',
      'Local work must never write to live customer data. Use the Docker\n' +
        '       Postgres URL from .env.example.',
    );
    return;
  }

  const prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
  try {
    await prisma.$queryRaw`SELECT 1`;
    // A reachable database with no tables means migrations have not been applied.
    const [{ count }] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'`;
    if (count === 0) {
      fail('Database is reachable but has no schema', 'bun run db:migrate');
    } else {
      ok('PostgreSQL', 'connected, migrations table present');
    }
  } catch (error) {
    const message = String(error?.message ?? error);
    if (message.includes('ECONNREFUSED') || message.includes("Can't reach database")) {
      fail('PostgreSQL is not reachable', 'bun run db:up   (starts Postgres and Redis in Docker)');
    } else if (message.includes('authentication') || message.includes('password')) {
      fail('PostgreSQL rejected the credentials', 'Check DATABASE_URL against .env.example.');
    } else {
      fail('PostgreSQL check failed', `bun run db:up\n       (${message.split('\n')[0]})`);
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function checkRedis() {
  const url = env.REDIS_URL ?? '';
  if (!url) {
    fail('REDIS_URL is not set', 'Copy the value from .env.example.');
    return;
  }
  if (url.includes('rooferslabs-production')) {
    fail('REDIS_URL points at the PRODUCTION cache', 'Use redis://localhost:6379.');
    return;
  }

  let Redis;
  try {
    Redis = require('ioredis').default ?? require('ioredis');
  } catch {
    fail('ioredis is not installed', 'bun install');
    return;
  }

  // No retries: this is a preflight, and "is it up right now" is the whole
  // question. The default reconnect policy would hang for a minute instead.
  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  try {
    await client.connect();
    await client.ping();
    ok('Redis', 'connected');
  } catch {
    fail('Redis is not reachable', 'bun run db:up   (starts Postgres and Redis in Docker)');
  } finally {
    client.disconnect();
  }
}

await checkDatabase();
await checkRedis();

// ---- Summary ---------------------------------------------------------------------

if (failures.length === 0) {
  if (!QUIET) {
    console.log(`\n${GREEN}Ready.${RESET} ${DIM}bun run dev${RESET}`);
    if (warnings.length > 0) {
      console.log(`${DIM}${warnings.length} warning(s) above — not blocking.${RESET}`);
    }
    console.log();
  }
  process.exit(0);
}

console.log(`\n${RED}${failures.length} problem(s) to fix:${RESET}\n`);
for (const { label, fix } of failures) {
  console.log(`  ${RED}•${RESET} ${label}`);
  console.log(`       ${fix}\n`);
}
process.exit(1);
