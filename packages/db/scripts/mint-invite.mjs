/**
 * Emergency invite minting, from the command line.
 *
 * The escape hatch for the bootstrap deadlock: signup needs an invite, invites
 * need a signed-in admin, and if you are locked out there is no way back in
 * through the browser.
 *
 * This is deliberately *not* an HTTP route. A route is reachable by anyone who
 * can guess a URL and would need its own authentication, one more secret to
 * leak. Running this requires the database connection string, which means shell
 * access to a machine that already has it. That is a much smaller attack
 * surface than an endpoint on the public internet.
 *
 *   set -a; . .env.local; set +a
 *   node packages/db/scripts/mint-invite.mjs --label "for Jatin" --uses 1 --days 14
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { encodeBase32, formatInviteCode, canonicalInviteCode } from '../../core/src/invite-code.ts';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const label = arg('label', 'created from CLI');
const uses = Number(arg('uses', '1'));
const days = Number(arg('days', '14'));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run: set -a; . .env.local; set +a');
  process.exit(1);
}

const code = formatInviteCode(encodeBase32(randomBytes(16)));
const codeHash = createHash('sha256').update(canonicalInviteCode(code)).digest('hex');
const expiresAt = new Date(Date.now() + days * 86_400_000);

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

// `created_by` needs a user. Prefer a real one so the code shows up in that
// admin's list; fall back to a nil uuid when the database has no users at all,
// which is exactly the bootstrap case this script exists for.
const [owner] = await sql`select id from users order by created_at limit 1`;
const createdBy = owner?.id ?? '00000000-0000-0000-0000-000000000000';

await sql`
  insert into invites (id, code_hash, created_by, label, max_uses, used_count, expires_at)
  values (${randomUUID()}, ${codeHash}, ${createdBy}, ${label}, ${uses}, 0, ${expiresAt})`;

console.log('\n  Invite code (shown once, only the hash is stored):\n');
console.log(`    ${code}\n`);
console.log(`  uses: ${uses}   expires: ${expiresAt.toISOString().slice(0, 10)}   label: ${label}\n`);

await sql.end();
