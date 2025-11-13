# RBAC System - EduDash Pro

**Role-Based Access Control implementation for EduDash Pro Phase 1**

## 📁 **Files Overview**

| File | Purpose | Usage |
|------|---------|--------|
| `roles-permissions.json` | Machine-readable permissions matrix | Configuration data |
| `types.ts` | TypeScript interfaces and utilities | Import in code |
| `validate.ts` | Validation and testing script | Development/CI |
| `README.md` | This documentation | Reference |

## 🚀 **Quick Start**

### Import and Use in Code

```typescript
import { 
  roleHasPermission, 
  getRolePermissions,
  ROLES,
  PERMISSIONS 
} from './lib/rbac/types';

// Check if user can manage courses
const canManage = roleHasPermission('instructor', 'manage_courses'); // true

// Get all permissions for a role
const adminPerms = getRolePermissions('admin'); // 16 permissions

// Use constants for type safety
const isAdmin = userRole === ROLES.ADMIN;
const needsPermission = PERMISSIONS.MANAGE_USERS;
```

### Validate the System

```bash
# Run validation tests
npx tsx lib/rbac/validate.ts

# Should output: "🎉 All validations passed! RBAC system is ready."
```

## 👥 **Role Hierarchy**

```
Admin (Level 4)        16 permissions
  │
Instructor (Level 2)   13 permissions  
  │
Student (Level 1)       9 permissions
```

## 🔐 **Key Permissions**

### Admin Only
- `manage_users` - Create/delete user accounts
- `manage_organizations` - Multi-tenant management
- `manage_billing` - Subscription management
- `view_system_logs` - Security auditing

### Admin + Instructor
- `manage_courses` - Course CRUD operations
- `manage_assignments` - Assignment creation
- `grade_assignments` - Student grading
- `use_ai_lesson_tools` - AI teaching assistance

### Student Only  
- `submit_assignments` - Homework submission
- `use_ai_homework_helper` - AI homework help

### All Roles
- `view_courses` - Course access (scoped by role)
- Dashboard access (role-specific dashboards)

## 🛡️ **Security Model**

### Scope Enforcement
- **Admin**: Global access (all organizations)
- **Instructor**: Organization-scoped access
- **Student**: Self-scoped access

### Relationship Filtering
- **Instructors** see only their courses and enrolled students
- **Students** see only courses they're enrolled in
- **Admin** sees everything with proper organization context

## 🔧 **Integration Examples**

### API Route Protection
```typescript
// Middleware example
async function requirePermission(permission: PermissionId) {
  const userRole = await getUserRole(userId);
  
  if (!roleHasPermission(userRole, permission)) {
    return res.status(403).json({ 
      error: 'Insufficient permissions',
      required: permission,
      userRole 
    });
  }
}

// Usage
app.post('/courses', requirePermission('manage_courses'), createCourse);
```

### Database Query Scoping
```typescript
// Example: Get courses based on role
async function getCourses(userId: string, userRole: RoleId) {
  if (userRole === 'admin') {
    return db.courses.findMany(); // All courses
  } else if (userRole === 'instructor') {
    return db.courses.findMany({
      where: { 
        OR: [
          { instructorId: userId },
          { organizationId: userOrganization }
        ]
      }
    });
  } else {
    return db.courses.findMany({
      where: {
        enrollments: {
          some: { studentId: userId }
        }
      }
    });
  }
}
```

## 🧪 **Testing**

The `validate.ts` script runs 74 comprehensive tests:

- ✅ Metadata validation
- ✅ Role hierarchy validation  
- ✅ Permission distribution checks
- ✅ Access control validation
- ✅ Consistency checks
- ✅ No duplicate permissions

## 📚 **Documentation Links**

- **Full Documentation**: `/docs/rbac/roles-permissions-matrix.md`
- **Original Analysis**: `/docs/security/rbac_audit.md`
- **Phase 1 TODO**: Main project TODO list

## 🔄 **Compatibility**

This Phase 1 system maps to your existing 5-role system:

| Phase 1 Role | Existing Roles | Notes |
|-------------|---------------|-------|
| `admin` | `super_admin`, `principal_admin` | Full system access preserved |
| `instructor` | `teacher`, `principal` | Organization-scoped access |
| `student` | `student`, `parent` | Self-scoped access |

**Your SuperAdmin functionality remains completely unchanged!** 🛡️

## ⚡ **Next Steps**

1. ✅ Task 2 Complete - RBAC matrix defined
2. 🚧 Task 3 - Create database schema using these roles
3. 🚧 Task 4 - Seed initial roles and admin user
4. 🚧 Task 5 - Implement authentication with role assignment
5. 🚧 Task 6 - Build authorization middleware

---

**Status**: ✅ Complete  
**Version**: 1.0.0  
**Last Updated**: 2025-09-21