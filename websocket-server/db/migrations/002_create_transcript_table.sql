-- Create transcript table if it doesn't exist
CREATE TABLE IF NOT EXISTS transcript (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL,
    user_id TEXT,
    student_name TEXT,
    transcript_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transcript_session_id ON transcript(session_id);
CREATE INDEX IF NOT EXISTS idx_transcript_user_id ON transcript(user_id);

-- Add comments for documentation
COMMENT ON TABLE transcript IS 'Stores session transcripts, including user utterances and system responses.';
COMMENT ON COLUMN transcript.session_id IS 'Unique identifier for the chat session.';
COMMENT ON COLUMN transcript.user_id IS 'Identifier for the user participating in the session.';
COMMENT ON COLUMN transcript.student_name IS 'Name of the student, if provided.';
COMMENT ON COLUMN transcript.transcript_data IS 'JSONB data containing the detailed transcript of the session.';
COMMENT ON COLUMN transcript.created_at IS 'Timestamp when the transcript record was created.'; 