#!/bin/bash

# Bulk update super admin role checks to use centralized role utility

files=(
  "app/screens/super-admin-moderation.tsx"
  "app/screens/super-admin-announcements.tsx"
  "app/screens/super-admin-ai-quotas.tsx"
  "app/screens/super-admin-feature-flags.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Updating $file..."
    
    # Add import for isSuperAdmin if not already present
    if ! grep -q "import { isSuperAdmin }" "$file"; then
      # Find the line with useAuth import and add our import after it
      sed -i '/import { useAuth } from.*AuthContext/a import { isSuperAdmin } from '"'"'@/lib/roleUtils'"'"';' "$file"
    fi
    
    # Replace role checks
    sed -i "s/profile?.role !== 'superadmin' && profile?.role !== 'super_admin'/!isSuperAdmin(profile?.role)/g" "$file"
    sed -i "s/profile.role !== 'superadmin' && profile.role !== 'super_admin'/!isSuperAdmin(profile.role)/g" "$file"
    
    echo "Updated $file"
  else
    echo "File $file not found"
  fi
done

echo "Bulk update complete!"