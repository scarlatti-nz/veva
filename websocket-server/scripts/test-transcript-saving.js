#!/usr/bin/env node

import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from '../chatbots/db.js';

// Load environment variables
dotenv.config();

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extracted saveTranscript function from RealtimeRelay class
 */
async function saveTranscript(sessionId, transcript, userData) {
  try {
    // Import the SQL module
    
    console.log(`Saving transcript for session ${sessionId}`);
    
    // Insert the transcript into the database
    await sql`
      INSERT INTO transcript (
        session_id,
        user_id,
        student_name,
        transcript_data
      ) VALUES (
        ${sessionId},
        ${userData?.student_id ?? 'unknown'},
        ${userData?.student_name ?? 'unknown'},
        ${JSON.stringify(transcript)}
      )
    `;
    
    console.log(`Transcript saved successfully for session ${sessionId}`);
    return true;
  } catch (error) {
    console.error(`Error saving transcript: ${error.message}`);
    return false;
  }
}

/**
 * Test function to verify transcript saving functionality
 */
async function testTranscriptSaving() {
  // Generate a test session ID
  const sessionId = uuidv4();
  
  // Create sample user data
  const userData = {
    student_id: 'test-student-123',
    student_name: 'Test Student'
  };
  
  // Create sample transcript data
  const transcript = [
    {
      role: 'user',
      content: 'Hello, how are you?'
    },
    {
      role: 'assistant',
      content: 'I\'m doing well, thank you for asking! How can I help you today?'
    },
    {
      role: 'user',
      content: 'Can you explain how photosynthesis works?'
    },
    {
      role: 'assistant',
      content: 'Photosynthesis is the process by which plants, algae, and some bacteria convert light energy into chemical energy...'
    }
  ];
  
  console.log('=== Testing Transcript Saving ===');
  console.log(`Session ID: ${sessionId}`);
  console.log(`User Data: ${JSON.stringify(userData, null, 2)}`);
  console.log(`Transcript Length: ${transcript.length} messages`);
  
  // Test saving the transcript
  const success = await saveTranscript(sessionId, transcript, userData);
  
  if (success) {
    console.log('\n✅ Transcript saved successfully!');
    
    // Verify by querying the database
    try {
      const sql = (await import('../chatbots/db.js')).default;
      const result = await sql`
        SELECT * FROM transcript 
        WHERE session_id = ${sessionId}
      `;
      
      if (result.length > 0) {
        console.log('\n=== Retrieved Transcript ===');
        console.log(`ID: ${result[0].id}`);
        console.log(`Session ID: ${result[0].session_id}`);
        console.log(`User ID: ${result[0].user_id}`);
        console.log(`Student Name: ${result[0].student_name}`);
        console.log(`Created At: ${result[0].created_at}`);
        console.log(`Transcript Data: ${JSON.stringify(result[0].transcript_data, null, 2).substring(0, 100)}...`);
      } else {
        console.log('\n❌ Failed to retrieve the saved transcript');
      }
    } catch (error) {
      console.error(`\n❌ Error verifying saved transcript: ${error.message}`);
    }
  } else {
    console.log('\n❌ Failed to save transcript');
  }
  
  // Close the database connection
  try {
    const sql = (await import('../chatbots/db.js')).default;
    await sql.end();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error(`Error closing database connection: ${error.message}`);
  }
}

// Run the test
testTranscriptSaving().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
}); 