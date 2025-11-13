-- Non-destructive schema cache reload for PostgREST
-- This notifies PostgREST to reload function/table metadata so new/updated SQL functions are exposed via /rpc
SELECT pg_notify('pgrst', 'reload schema');
