```markdown
# dedupe-contracts.js

This repository script helps automatically fix common problems in generated TypeScript files
like duplicate imports and duplicated `api` endpoint declarations that cause errors such as:

- `api already imported`
- `api endpoints with conflicting names defined within the same service`
- Duplicate import specifiers (`APIError already imported` etc.)

It is meant as a pragmatic rescue tool for files that were accidentally concatenated twice
or produced by buggy code generation. It makes a backup of the original file and writes
a cleaned file in place.

Usage:
1. From the repository root, run:
   node scripts/dedupe-contracts.js packages/backend/blockchain/contracts.ts

2. Run your type-check/build (e.g. `bun build`, `tsc`, or project-specific command)
   to confirm the code compiles.

Notes and caveats:
- This script uses regex + parentheses balancing heuristics. It works for many generated
  files but is not a full TypeScript AST-aware refactor tool.
- For complex situations or if you keep getting duplicates across builds, you should:
  - Fix the code generation step so it doesn't emit duplicates, or
  - Split endpoint definitions into separate files per-domain/module and import them
    in one place to avoid accidental duplication.
- Consider adding a build-time lint step that fails when duplicate exported `api` names
  or duplicate endpoint paths are detected.
```