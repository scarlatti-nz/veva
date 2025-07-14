import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from '../chatbots/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupTranscriptTable() {
  try {
    console.log('Setting up transcript table...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'create_transcript_table.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL script
    await sql.unsafe(sqlScript);
    
    console.log('Transcript table setup completed successfully.');
  } catch (error) {
    console.error('Error setting up transcript table:', error);
  } finally {
    // Close the database connection
    await sql.end();
  }
}

// Run the setup function
setupTranscriptTable(); 