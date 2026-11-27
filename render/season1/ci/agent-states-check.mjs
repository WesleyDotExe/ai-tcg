// The My agent states check (render session 88), now one tile of
// tile-states-check.mjs (render session 89). Kept so the old command runs.
//   node render/season1/ci/agent-states-check.mjs [outDir]
process.argv.splice(2, 0, 'agent');
await import('./tile-states-check.mjs');
