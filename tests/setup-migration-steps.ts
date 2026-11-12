// The test suite validates every intermediate schema of a migrated save
// (src/sim/serialization.ts, setMigrationStepValidation): an error in one of
// our migrations fails at its step. The game validates the save's own schema
// and the final world only; tests/migration-final-validation.test.ts loads
// saves both ways and compares the worlds. A global, not an import: a module
// imported here would be loaded before, and escape, each test's vi.mock.
(globalThis as {__verifyMigrationSteps?:boolean}).__verifyMigrationSteps=true;
