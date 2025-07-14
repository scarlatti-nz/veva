-- Add location column to transcript table
ALTER TABLE transcript
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add comment for documentation
COMMENT ON COLUMN transcript.location IS 'Location of the participant during the assessment session.'; 