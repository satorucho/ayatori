# AGENTS.md

## Cursor Cloud specific instructions

This is **Ayatori** — a client-side-only React SPA (no backend/database). All development commands are in `package.json` scripts; see `README.md` for the full list.

### Quick reference

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (port 5173) |
| Tests | `npm test` (Vitest, 26 tests across 4 files) |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Build | `npm run build` |

### Notes

- `npm run lint` reports pre-existing errors in `useFlowState.ts` and `useUndoRedo.ts` (React Compiler memoization / ref-during-render warnings). These are known and part of the existing codebase.
- The dev server (`npm run dev`) serves the app at `http://localhost:5173` with HMR. No additional services or environment variables are needed.
- The test suite uses `jsdom` environment; no browser or network access is required for automated tests.
