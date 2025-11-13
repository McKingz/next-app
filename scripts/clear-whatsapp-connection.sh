#!/bin/bash

# Manual script to clear WhatsApp connection from database
# Use this when the disconnect button in UI doesn't work

echo "🔧 Clearing WhatsApp Connection..."
echo ""

# Get user ID (you'll need to replace this with actual user ID)
USER_ID="a1fd12d2-5f09-4a23-822d-f3071bfc544b"  # Your user ID from the logs
PRESCHOOL_ID="ba79097c-1b93-4b48-bcbe-df73878ab4d1"  # Your preschool ID from the logs

echo "👤 User ID: $USER_ID"
echo "🏫 Preschool ID: $PRESCHOOL_ID"
echo ""

read -p "❓ Do you want to completely DELETE the WhatsApp contact record? [y/N]: " DELETE_RECORD

if [[ $DELETE_RECORD =~ ^[Yy]$ ]]; then
    echo "🗑️  DELETING WhatsApp contact record..."
    
    # Create SQL to delete the record
    SQL_DELETE="DELETE FROM public.whatsapp_contacts WHERE user_id = '$USER_ID' AND preschool_id = '$PRESCHOOL_ID';"
    
    echo "SQL: $SQL_DELETE"
    echo ""
    echo "⚠️  Note: You'll need to run this SQL manually in Supabase Dashboard:"
    echo "   1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/editor"
    echo "   2. Click 'New Query'"
    echo "   3. Paste the SQL above"
    echo "   4. Click 'Run'"
    echo ""
else
    echo "📝 UPDATING WhatsApp contact to opted_out..."
    
    # Create SQL to opt out
    SQL_UPDATE="UPDATE public.whatsapp_contacts SET consent_status = 'opted_out', last_opt_in_at = NULL WHERE user_id = '$USER_ID' AND preschool_id = '$PRESCHOOL_ID';"
    
    echo "SQL: $SQL_UPDATE"
    echo ""
    echo "⚠️  Note: You'll need to run this SQL manually in Supabase Dashboard:"
    echo "   1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/editor"
    echo "   2. Click 'New Query'" 
    echo "   3. Paste the SQL above"
    echo "   4. Click 'Run'"
    echo ""
fi

echo "🔄 After running the SQL:"
echo "   1. Refresh your teacher dashboard"
echo "   2. WhatsApp should show as 'Disconnected'"
echo "   3. You can then set up with your new token"
echo ""

# Show current status query
echo "📊 To check current status, run this query:"
echo "SELECT * FROM public.whatsapp_contacts WHERE user_id = '$USER_ID' AND preschool_id = '$PRESCHOOL_ID';"
echo ""
