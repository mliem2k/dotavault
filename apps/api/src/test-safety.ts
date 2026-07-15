// Preloaded before every test file (see bunfig.toml's [test] preload).
// Several test files run `db.delete(apiCache)` with no where clause in
// beforeEach to reset state between tests. Local .env points DATABASE_URL
// at the same production Neon branch Fly uses (no separate dev database
// exists), so running `bun test` locally has repeatedly wiped real
// production cache data. This aborts the whole run before any test (or
// its beforeEach) executes if DATABASE_URL still points at production.
const PRODUCTION_HOST_MARKER = 'ep-gentle-boat-aofutc5e'

if (process.env.DATABASE_URL?.includes(PRODUCTION_HOST_MARKER)) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL points at the production Neon branch (${PRODUCTION_HOST_MARKER}). ` +
      'Tests wipe apiCache wholesale and have taken down production data multiple times. ' +
      'Point DATABASE_URL at a disposable Neon branch before running bun test.',
  )
}
