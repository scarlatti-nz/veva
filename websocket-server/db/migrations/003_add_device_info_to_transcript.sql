-- Add device_info column to transcript table
ALTER TABLE transcript
ADD COLUMN device_info JSONB NULL;

-- Add comment for the new column
COMMENT ON COLUMN transcript.device_info IS 'JSONB data containing information about the device used during the session.'; 