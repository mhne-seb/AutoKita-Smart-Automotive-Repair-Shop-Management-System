-- ==============================================================================
-- Migration: Create obd2_codes table for deterministic chatbot lookups
-- Description: Stores OBD-II diagnostic trouble codes with comprehensive diagnostic data,
--              including symptoms, causes, severity, driving safety, diagnosis procedures,
--              inspection difficulty, and support for related sibling codes (e.g. P0001 covering P0002-P0004).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS obd2_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    meaning TEXT,
    symptoms TEXT,
    causes TEXT,
    seriousness TEXT,
    can_i_still_drive TEXT,
    how_to_diagnose TEXT,
    inspection_difficulty TEXT,
    more_about TEXT,
    related_codes TEXT[] DEFAULT '{}',
    is_primary BOOLEAN DEFAULT TRUE,
    parent_code VARCHAR(10) REFERENCES obd2_codes(code) ON DELETE SET NULL,
    raw_content TEXT,
    source_url TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Fast deterministic lookup indexes
CREATE INDEX IF NOT EXISTS idx_obd2_codes_code ON obd2_codes (code);
CREATE INDEX IF NOT EXISTS idx_obd2_codes_category ON obd2_codes (category);
CREATE INDEX IF NOT EXISTS idx_obd2_codes_parent_code ON obd2_codes (parent_code);
CREATE INDEX IF NOT EXISTS idx_obd2_codes_related ON obd2_codes USING GIN (related_codes);

-- Full-text search index for chatbot keyword matching
CREATE INDEX IF NOT EXISTS idx_obd2_codes_fts ON obd2_codes USING GIN (
    to_tsvector('english', 
        coalesce(code, '') || ' ' || 
        coalesce(description, '') || ' ' || 
        coalesce(symptoms, '') || ' ' || 
        coalesce(causes, '')
    )
);

-- Enable RLS and grant read-only access to all users
ALTER TABLE obd2_codes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'obd2_codes' AND policyname = 'Allow public read access on obd2_codes'
    ) THEN
        CREATE POLICY "Allow public read access on obd2_codes"
            ON obd2_codes
            FOR SELECT
            TO public
            USING (true);
    END IF;
END $$;
