# Pre-Push Build Verification Rule

**Rule**: Always run `npm run pre-push` before pushing code to remote.

## Why?

- Catches TypeScript errors before deployment
- Ensures code passes linting standards
- Verifies production build succeeds
- Prevents broken builds from reaching Vercel
- Saves time by catching issues locally

## How to Use

### Option 1: Run Pre-Push Script (Recommended)
```bash
cd /home/king/Desktop/edudashpro/web
npm run pre-push
```

This runs:
1. TypeScript type check (`npm run typecheck`)
2. ESLint linting (`npm run lint`)
3. Production build (`npm run build`)

### Option 2: Manual Checks
```bash
npm run typecheck  # Check TypeScript types
npm run lint        # Check code style
npm run build       # Test production build
```

## When to Run

- ✅ **BEFORE** every `git push origin web`
- ✅ **AFTER** making TypeScript changes
- ✅ **AFTER** adding new dependencies
- ✅ **AFTER** modifying build configuration

## What to Do If Checks Fail

### TypeScript Errors
- Fix type errors in reported files
- Add missing type annotations
- Check for deprecated API usage

### Lint Errors
- Run `npm run lint` to see specific issues
- Fix code style violations
- Some issues auto-fixable with `eslint --fix`

### Build Errors
- Check console output for specific error
- Common issues:
  - Missing dependencies → `npm install`
  - Type errors → fix TypeScript issues
  - Import errors → check file paths

## Git Workflow Example

```bash
# 1. Make changes
git add -A

# 2. Commit changes
git commit -m "feat: add new feature"

# 3. Run pre-push checks (REQUIRED!)
npm run pre-push

# 4. Only push if all checks pass ✅
git push origin web
```

## Automation (Future)

Consider adding as Git pre-push hook:
```bash
# .git/hooks/pre-push
#!/bin/bash
cd web && npm run pre-push
```

## CI/CD Integration

Vercel automatically runs:
- `npm ci` (clean install)
- `npm run build`

Running `npm run pre-push` locally ensures you catch issues BEFORE Vercel deployment fails.

---

**Remember**: A failed build in Vercel means downtime for users. Always verify locally first! 🚀
