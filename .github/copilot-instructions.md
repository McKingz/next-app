# Copilot Instructions for EduDash Pro

## Project Overview
- **EduDash Pro** is a multi-tenant educational platform with advanced security, AI-powered features, and role-based access control (RBAC).
- The backend is built on **Supabase** (Postgres, Auth, Functions), with heavy use of Row-Level Security (RLS) and custom SQL migrations.
- The frontend is a React Native app (Expo), with custom scripts and integrations.

## Key Architectural Patterns
- **RBAC**: All permissions and roles are defined in `lib/rbac/roles-permissions.json` and TypeScript utilities in `lib/rbac/types.ts`. Use these helpers for all access checks.
- **Database Migrations**: SQL scripts in `scripts/` must be run in a strict order (see `scripts/README.md`). Security and educational schemas are separated for clarity and safety.
- **Supabase Integration**: Environment variables for Supabase URL and keys are required. RLS is enforced on all sensitive tables. See `supabase/README.md` for setup.
- **AI Features**: AI quota and feature flags are managed in the database (`user_ai_tiers`, `feature_flags`).

## Developer Workflows
- **RBAC Validation**: Run `npx tsx lib/rbac/validate.ts` to validate role/permission logic. Output should be: `🎉 All validations passed! RBAC system is ready.`
- **Database Setup**: Follow the order in `scripts/README.md` to initialize or reset the database. SuperAdmin account must exist before running enhancements.
- **Local Dev**: Use `npm install` and `npm start` for the React Native app. For file picker support, run `npm run prebuild` first.
- **Supabase Functions**: Use the Supabase CLI for local development and deployment. See `README.md` for CLI install and usage.

## Project-Specific Conventions
- **All access control** must use the RBAC helpers, not hardcoded role checks.
- **SQL scripts** are the source of truth for schema and security. Never edit the database manually.
- **Feature flags** and **AI quotas** are managed in the DB, not in code.
- **SuperAdmin** is always `superadmin@edudashpro.org.za` and must have 2FA enabled.

## Integration Points
- **Supabase**: All data, auth, and functions are managed via Supabase. RLS is always enabled.
- **AI Services**: AI features are quota-controlled and tied to user roles/tiers in the DB.

## References
- RBAC: `lib/rbac/README.md`, `lib/rbac/types.ts`, `lib/rbac/roles-permissions.json`
- Database: `scripts/README.md`, `scripts/*.sql`
- Supabase: `supabase/README.md`, `.env.example`

---

**Example: Checking permissions in code**
```typescript
import { roleHasPermission } from './lib/rbac/types';
if (roleHasPermission(user.role, 'manage_courses')) { /* ... */ }
```

**Example: Running RBAC validation**
```bash
npx tsx lib/rbac/validate.ts
```

**Example: Database migration order**
```sql
\i 01_enhanced_security_system.sql
\i 02_educational_schema.sql
\i enhance-superadmin-security.sql
\i seed-test-data.sql
```
