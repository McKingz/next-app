-- =====================================================
-- Dash Autonomous Storage Table
-- =====================================================
-- Purpose: Provide persistent storage for Dash AI Assistant
-- that users can access across devices. Enables Dash to
-- remember user preferences, notes, and custom data.
-- =====================================================

-- Create dash_storage table
CREATE TABLE IF NOT EXISTS public.dash_storage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Multi-tenant isolation
    preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Storage key-value system
    storage_key TEXT NOT NULL,
    storage_value JSONB NOT NULL,
    
    -- Metadata
    data_type TEXT NOT NULL DEFAULT 'general', -- 'general', 'preference', 'note', 'reminder', 'context'
    category TEXT, -- Optional categorization for organization
    tags TEXT[], -- Optional tags for search/filtering
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Optional expiration
    
    -- Uniqueness constraint: one key per user per preschool
    UNIQUE(preschool_id, user_id, storage_key)
);

-- Add indexes for performance
CREATE INDEX idx_dash_storage_user_id ON public.dash_storage(user_id);
CREATE INDEX idx_dash_storage_preschool_user ON public.dash_storage(preschool_id, user_id);
CREATE INDEX idx_dash_storage_key ON public.dash_storage(storage_key);
CREATE INDEX idx_dash_storage_data_type ON public.dash_storage(data_type);
CREATE INDEX idx_dash_storage_expires_at ON public.dash_storage(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_dash_storage_tags ON public.dash_storage USING GIN(tags);

-- Enable RLS
ALTER TABLE public.dash_storage ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own storage within their preschool
CREATE POLICY "Users can read own dash storage"
    ON public.dash_storage
    FOR SELECT
    USING (
        auth.uid() = user_id
        AND preschool_id IN (
            SELECT preschool_id FROM public.profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own dash storage"
    ON public.dash_storage
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND preschool_id IN (
            SELECT preschool_id FROM public.profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own dash storage"
    ON public.dash_storage
    FOR UPDATE
    USING (
        auth.uid() = user_id
        AND preschool_id IN (
            SELECT preschool_id FROM public.profiles WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND preschool_id IN (
            SELECT preschool_id FROM public.profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own dash storage"
    ON public.dash_storage
    FOR DELETE
    USING (
        auth.uid() = user_id
        AND preschool_id IN (
            SELECT preschool_id FROM public.profiles WHERE user_id = auth.uid()
        )
    );

-- Superadmin policy: Full access to all dash storage (for diagnostics)
CREATE POLICY "Superadmin can access all dash storage"
    ON public.dash_storage
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = auth.uid() 
            AND role = 'superadmin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = auth.uid() 
            AND role = 'superadmin'
        )
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_dash_storage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dash_storage_updated_at
    BEFORE UPDATE ON public.dash_storage
    FOR EACH ROW
    EXECUTE FUNCTION public.update_dash_storage_updated_at();

-- Create function to clean up expired storage
CREATE OR REPLACE FUNCTION public.cleanup_expired_dash_storage()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.dash_storage
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on cleanup function
GRANT EXECUTE ON FUNCTION public.cleanup_expired_dash_storage() TO authenticated;

-- Helper RPC function: Store data in Dash storage
CREATE OR REPLACE FUNCTION public.dash_store(
    p_storage_key TEXT,
    p_storage_value JSONB,
    p_data_type TEXT DEFAULT 'general',
    p_category TEXT DEFAULT NULL,
    p_tags TEXT[] DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_preschool_id UUID;
    v_storage_id UUID;
BEGIN
    -- Get user's preschool_id
    SELECT preschool_id INTO v_preschool_id
    FROM public.profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
    
    IF v_preschool_id IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;
    
    -- Upsert storage entry
    INSERT INTO public.dash_storage (
        preschool_id,
        user_id,
        storage_key,
        storage_value,
        data_type,
        category,
        tags,
        expires_at
    ) VALUES (
        v_preschool_id,
        auth.uid(),
        p_storage_key,
        p_storage_value,
        p_data_type,
        p_category,
        p_tags,
        p_expires_at
    )
    ON CONFLICT (preschool_id, user_id, storage_key)
    DO UPDATE SET
        storage_value = EXCLUDED.storage_value,
        data_type = EXCLUDED.data_type,
        category = EXCLUDED.category,
        tags = EXCLUDED.tags,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    RETURNING id INTO v_storage_id;
    
    RETURN v_storage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper RPC function: Retrieve data from Dash storage
CREATE OR REPLACE FUNCTION public.dash_retrieve(
    p_storage_key TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_storage_value JSONB;
BEGIN
    SELECT storage_value INTO v_storage_value
    FROM public.dash_storage
    WHERE user_id = auth.uid()
    AND storage_key = p_storage_key
    AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1;
    
    RETURN v_storage_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper RPC function: Delete from Dash storage
CREATE OR REPLACE FUNCTION public.dash_delete(
    p_storage_key TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM public.dash_storage
    WHERE user_id = auth.uid()
    AND storage_key = p_storage_key;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper RPC function: List all storage keys for user
CREATE OR REPLACE FUNCTION public.dash_list_keys(
    p_data_type TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL
)
RETURNS TABLE(
    storage_key TEXT,
    data_type TEXT,
    category TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ds.storage_key,
        ds.data_type,
        ds.category,
        ds.tags,
        ds.created_at,
        ds.updated_at
    FROM public.dash_storage ds
    WHERE ds.user_id = auth.uid()
    AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
    AND (p_data_type IS NULL OR ds.data_type = p_data_type)
    AND (p_category IS NULL OR ds.category = p_category)
    ORDER BY ds.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.dash_store TO authenticated;
GRANT EXECUTE ON FUNCTION public.dash_retrieve TO authenticated;
GRANT EXECUTE ON FUNCTION public.dash_delete TO authenticated;
GRANT EXECUTE ON FUNCTION public.dash_list_keys TO authenticated;

-- Add helpful comment
COMMENT ON TABLE public.dash_storage IS 'Autonomous storage for Dash AI Assistant - enables cross-device data persistence and user-specific context storage';
COMMENT ON FUNCTION public.dash_store IS 'Store data in Dash storage with automatic upsert';
COMMENT ON FUNCTION public.dash_retrieve IS 'Retrieve data from Dash storage by key';
COMMENT ON FUNCTION public.dash_delete IS 'Delete data from Dash storage by key';
COMMENT ON FUNCTION public.dash_list_keys IS 'List all storage keys for current user';