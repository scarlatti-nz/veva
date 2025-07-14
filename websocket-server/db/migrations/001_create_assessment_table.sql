-- Create assessment table
CREATE TABLE IF NOT EXISTS assessment (
    id SERIAL PRIMARY KEY,
    course_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    question_id VARCHAR(10) NOT NULL,
    answer TEXT NOT NULL,
    grade VARCHAR(10) NOT NULL,
    feedback TEXT NOT NULL,
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    session_id VARCHAR(100),
    user_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_assessment_user_id ON assessment(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_course_id ON assessment(course_id);
CREATE INDEX IF NOT EXISTS idx_assessment_session_id ON assessment(session_id);

-- Add comments for documentation
COMMENT ON TABLE assessment IS 'Stores assessment results for the Fruition horticulture course';
COMMENT ON COLUMN assessment.course_id IS 'Identifier for the course (e.g., fruition101)';
COMMENT ON COLUMN assessment.user_id IS 'Identifier for the student being assessed';
COMMENT ON COLUMN assessment.question_id IS 'Identifier for the specific question (e.g., h1a, cl1)';
COMMENT ON COLUMN assessment.grade IS 'Assessment grade (NYC, C, or N/A)';
COMMENT ON COLUMN assessment.confidence IS 'Confidence score of the assessment (0-100)'; 