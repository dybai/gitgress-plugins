# Final review fix report

## Changes

### `matchFileIconTheme.ts`

1. **Default file icon (light):** Uses `light ? (theme.light?.file ?? theme.file) : theme.file`, matching folder fallback behavior when `light.file` is omitted.

2. **Light fileNames / fileExtensions:** In light mode, basename and extension lookups prefer `theme.light` maps, then fall back per entry to top-level `fileNames` / `fileExtensions`. Extension matching unions keys from both maps and prefers light definition ids when both define the same key.

### `matchFileIconTheme.test.ts`

- Light default file falls back to top-level `file` when `light.file` is missing.
- Light mode prefers light `fileNames` / `fileExtensions` while still resolving names and extensions only present on the top-level maps.

## Verification

```text
npx vitest run tests/views/files/matchFileIconTheme.test.ts  → 7 passed
npm test                                                      → 348 passed
npm run compile                                               → OK
```

## Version

No `package.json` bump (per task instructions).
