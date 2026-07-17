// Preloaded before every test file (see bunfig.toml's [test] preload).
// Several test files run `db.delete(apiCache)` and `db.delete(replayPositions)`
// with no where clause in beforeEach to reset state between tests. Local .env
// points TURSO_DATABASE_URL at the same production Turso database Fly uses
// (no separate dev database exists), so running `bun test` locally has
// repeatedly wiped real production data — cache entries and, now, the
// permanent replay_positions rows too.
//
// This is a fail-closed allowlist rather than a production blocklist: a
// single hardcoded "production" marker silently stops protecting anything
// the moment the production database is ever renamed or recreated under a
// different name. Instead, tests only run when TURSO_DATABASE_URL matches a
// known-disposable naming pattern; anything else — including production,
// and including a URL this check doesn't recognize — is refused by default.
const DISPOSABLE_DB_PATTERNS = [/-dev-tmp-/, /-test-tmp-/, /^libsql:\/\/ci-/]

const databaseUrl = process.env.TURSO_DATABASE_URL ?? ''

if (!DISPOSABLE_DB_PATTERNS.some((pattern) => pattern.test(databaseUrl))) {
  throw new Error(
    `Refusing to run tests: TURSO_DATABASE_URL ("${databaseUrl}") does not look like a disposable database. ` +
      'Tests wipe apiCache and replay_positions wholesale and have taken down production data multiple times. ' +
      'Point TURSO_DATABASE_URL at a disposable Turso database (name it with a -dev-tmp/-test-tmp suffix, or ' +
      'ci-<run-id> for CI) before running bun test.',
  )
}
