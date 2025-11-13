# EduDash Pro Database Setup Scripts

This directory contains SQL scripts to set up the enhanced security system, AI tier management, and educational platform features for EduDash Pro.

## 📋 Script Overview

| Script | Purpose | Dependencies |
|--------|---------|--------------|
| `01_enhanced_security_system.sql` | Core security tables, 2FA, session management | Base Supabase schema |
| `02_educational_schema.sql` | Courses, enrollments, assignments, grades | Security system |
| `enhance-superadmin-security.sql` | SuperAdmin security enhancements | Both core scripts |
| `seed-test-data.sql` | Test data and feature flags | All previous scripts |

## 🚀 Quick Start

### Prerequisites

1. **Supabase Project**: Ensure your Supabase project is set up and accessible
2. **SuperAdmin Account**: Have `superadmin@edudashpro.org.za` created in Supabase Auth
3. **Database Access**: Admin access to run SQL scripts

### Execution Order

Run these scripts in the Supabase SQL editor in this exact order:

```sql
-- 1. Enhanced Security System (Required first)
\i 01_enhanced_security_system.sql

-- 2. Educational Schema (Requires security system)
\i 02_educational_schema.sql

-- 3. SuperAdmin Enhancement (Requires both previous)
\i enhance-superadmin-security.sql

-- 4. Test Data & Configuration (Optional, for development)
\i seed-test-data.sql
```

## 📊 What Each Script Does

### 1. Enhanced Security System (`01_enhanced_security_system.sql`)

**Creates:**
- `user_two_factor_auth` - 2FA management with TOTP/backup codes
- `user_sessions` - Secure session tracking
- `password_history` - Password reuse prevention
- `login_attempts` - Rate limiting and security monitoring
- `security_events` - Comprehensive audit logging
- `user_ai_tiers` - AI quota and feature management
- `feature_flags` - Dynamic feature control

**Security Features:**
- Row-Level Security (RLS) on all tables
- Automatic session cleanup
- Password strength validation
- 2FA enforcement by role
- Security event logging
- AI quota tracking

### 2. Educational Schema (`02_educational_schema.sql`)

**Creates:**
- `courses` - Course management with instructor assignment
- `enrollments` - Student-course relationships
- `assignments` - Assignment creation and management
- `submissions` - Student assignment submissions
- `grades` - Grade recording and analytics

**Educational Features:**
- Automatic enrollment validation
- Grade calculation utilities
- Assignment deadline tracking
- Student progress monitoring
- Course analytics support

### 3. SuperAdmin Enhancement (`enhance-superadmin-security.sql`)

**Enhances:**
- Configures mandatory 2FA for SuperAdmin
- Assigns enterprise AI tier (unlimited)
- Updates capabilities and permissions
- Creates security audit trail
- Assigns default AI tiers to existing users

### 4. Test Data & Configuration (`seed-test-data.sql`)

**Provides:**
- Feature flag configuration
- Test user accounts (Principal, Teacher, Student)
- Sample courses and assignments
- Development environment setup
- Basic organizational data

## 🔐 Security Considerations

### SuperAdmin Account Requirements

After running the scripts, the SuperAdmin must:

1. **Complete 2FA Setup**:
   ```sql
   -- Check 2FA status
   SELECT * FROM user_two_factor_auth 
   WHERE user_id = (SELECT id FROM profiles WHERE email = 'superadmin@edudashpro.org.za');
   ```

2. **Save Backup Codes**: Retrieve and securely store backup codes

3. **Test Login**: Verify 2FA authentication works correctly

4. **Verify AI Access**: Confirm enterprise tier features are available

### Password Policy

All users are subject to:
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- No reuse of last 5 passwords
- Password history tracking

### Session Management

- Automatic cleanup of expired sessions
- Device tracking and management
- Suspicious activity detection

## 🧪 Testing and Validation

### Test Accounts (Development Only)

The seed script creates test accounts with specific UUIDs:

```sql
-- Test accounts (must be created in Supabase Auth first)
INSERT INTO auth.users (id, email) VALUES 
('00000000-0000-0000-0000-000000000001', 'test.principal@testschool.edu'),
('00000000-0000-0000-0000-000000000002', 'test.teacher@testschool.edu'),
('00000000-0000-0000-0000-000000000003', 'test.student@testschool.edu');
```

### Validation Queries

```sql
-- Check security system setup
SELECT 
  'Security Tables' as component,
  COUNT(*) as tables_created
FROM information_schema.tables 
WHERE table_name IN (
  'user_two_factor_auth', 'user_sessions', 'password_history', 
  'login_attempts', 'security_events', 'user_ai_tiers', 'feature_flags'
);

-- Check educational system setup
SELECT 
  'Educational Tables' as component,
  COUNT(*) as tables_created
FROM information_schema.tables 
WHERE table_name IN ('courses', 'enrollments', 'assignments', 'submissions', 'grades');

-- Check SuperAdmin configuration
SELECT 
  p.email,
  p.role,
  uat.tier as ai_tier,
  CASE WHEN tfa.user_id IS NOT NULL THEN 'Configured' ELSE 'Missing' END as tfa_status
FROM profiles p
LEFT JOIN user_ai_tiers uat ON uat.user_id = p.id
LEFT JOIN user_two_factor_auth tfa ON tfa.user_id = p.id
WHERE p.email = 'superadmin@edudashpro.org.za';
```

## 🔧 Troubleshooting

### Common Issues

1. **"Table already exists" errors**: Scripts are idempotent; safe to re-run
2. **"User not found" errors**: Ensure users exist in Supabase Auth first
3. **Permission errors**: Run with database admin privileges
4. **Foreign key violations**: Follow execution order strictly

### Recovery Commands

```sql
-- Reset feature flags
DELETE FROM feature_flags WHERE metadata->>'category' = 'test';

-- Clear test data
DELETE FROM profiles WHERE metadata->>'test_account' = 'true';

-- Reset user AI tiers
DELETE FROM user_ai_tiers WHERE metadata->>'assigned_during' = 'seed_script';
```

## 📈 Performance Optimization

### Automatic Optimizations

- Indexes on frequently queried columns
- Automated table statistics updates
- Efficient RLS policies
- Session cleanup procedures

### Manual Optimizations

```sql
-- Update table statistics
ANALYZE user_sessions;
ANALYZE security_events;
ANALYZE courses;
ANALYZE enrollments;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats 
WHERE schemaname = 'public' 
AND tablename IN ('courses', 'enrollments', 'assignments');
```

## 🔄 Maintenance

### Regular Tasks

1. **Monitor security events**: Check for unusual patterns
2. **Clean expired sessions**: Automatic, but monitor storage
3. **Review AI usage**: Track quota consumption
4. **Update feature flags**: Adjust based on requirements

### Monitoring Queries

```sql
-- Security event summary (last 24 hours)
SELECT event_type, severity, COUNT(*) as occurrences
FROM security_events 
WHERE created_at > now() - interval '24 hours'
GROUP BY event_type, severity
ORDER BY occurrences DESC;

-- AI tier usage summary
SELECT tier, COUNT(*) as users, SUM(quota_used) as total_quota_used
FROM user_ai_tiers 
WHERE is_active = true
GROUP BY tier;

-- Active session count
SELECT COUNT(*) as active_sessions, COUNT(DISTINCT user_id) as unique_users
FROM user_sessions 
WHERE expires_at > now();
```

## 📞 Support

For issues with these scripts:
1. Check the execution order and dependencies
2. Verify Supabase Auth users exist first
3. Review error logs for specific constraint violations
4. Ensure database admin privileges are available

Remember: All scripts are designed to be idempotent and safe to re-run if needed.