import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

// Initialize S3 client for Digital Ocean Spaces
const s3Client = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT || "https://nyc3.digitaloceanspaces.com",
  region: process.env.DO_SPACES_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.DO_SPACES_ACCESS_KEY || "",
    secretAccessKey: process.env.DO_SPACES_SECRET_KEY || ""
  }
});

const BUCKET_NAME = process.env.DO_SPACES_BUCKET || "voice-chat-recordings";

/**
 * Upload a buffer to S3-compatible storage
 * @param {Buffer} buffer - The buffer to upload
 * @param {string} key - The object key (path) in the bucket
 * @param {string} contentType - The content type of the file
 * @returns {Promise<boolean>} - Whether the upload was successful
 */
async function uploadToS3(buffer, key, contentType) {
  if (!process.env.DO_SPACES_ACCESS_KEY || !process.env.DO_SPACES_SECRET_KEY) {
    console.log("S3 credentials not configured, skipping upload");
    return false;
  }

  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "private" // Ensure files are not public
    };

    const command = new PutObjectCommand(params);
    const response = await s3Client.send(command);
    
    console.log(`Successfully uploaded to S3: ${key}`);
    return true;
  } catch (error) {
    console.error(`Error uploading to S3: ${error.message}`);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

/**
 * Simple function to save audio data as WAV file
 * @param {Array} audioData - Array of audio chunks
 * @param {string} sessionId - Session identifier
 */
export function saveAudioAsWav(audioData, sessionId) {
  console.log(`Saving audio for session ${sessionId}. Total chunks: ${audioData.length}`);
  
  if (!audioData || audioData.length === 0) {
    console.log("No audio data to save");
    return;
  }
  
  // Create output directory
  const outputDir = '/app/audio_recordings';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  //Process audio
  try {
    saveRoleAudio(audioData, sessionId, 'combined', outputDir);
  } catch (error) {
    console.error('Error processing audio:', error);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Save audio for a specific role (user or assistant)
 */
function saveRoleAudio(audioChunks, sessionId, role, outputDir) {
  console.log(`Processing ${audioChunks.length} audio chunks for role: ${role}`);
  
  try {
    // Concatenate all audio buffers
    let allAudioData;
    
    const buffers = audioChunks.map(chunk => {
      console.log(`chunk size: ${chunk.audioBuffer.length} bytes`);
      return chunk.audioBuffer;
    });
    
    allAudioData = Buffer.concat(buffers);
    
    
    console.log(`Combined audio data size: ${allAudioData.length} bytes`);
    
    // Skip if no audio data
    if (!allAudioData || allAudioData.length === 0) {
      console.log(`No valid audio data for ${role}`);
      return;
    }
    
    // Create an Int16Array from the buffer
    // PCM data is 16-bit little-endian
    const samplesCount = Math.floor(allAudioData.length / 2);
    const int16Samples = new Int16Array(samplesCount);
    
    // Copy data into Int16Array
    for (let i = 0; i < samplesCount; i++) {
      // Get 16-bit sample (little-endian)
      int16Samples[i] = allAudioData.readInt16LE(i * 2);
    }
    
    // Log some information about the audio
    console.log(`Audio statistics:
      Total samples: ${int16Samples.length}
      Duration: ${int16Samples.length / 24000} seconds at 24kHz
      First few samples: ${Array.from(int16Samples.slice(0, 5))}
      Last few samples: ${Array.from(int16Samples.slice(-5))}
      Has non-zero values: ${int16Samples.some(v => v !== 0) ? 'Yes' : 'No'}
    `);
    
    // Create WAV buffer
    const wavBuffer = createWavFile(int16Samples, 24000);
    
    // Generate file paths and names
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const wavFileName = `${sessionId}_${role}_${timestamp}.wav`;
    const wavFilePath = path.join(outputDir, wavFileName);
    
    // Save locally
    fs.writeFileSync(wavFilePath, wavBuffer);
    console.log(`WAV file saved locally: ${wavFilePath} (${wavBuffer.length} bytes)`);
    
    // Upload to S3
    const s3Key = `recordings/${wavFileName}`;
    uploadToS3(wavBuffer, s3Key, 'audio/wav')
      .then(success => {
        if (success) {
          console.log(`WAV file uploaded to S3: ${s3Key}`);
        } else {
          console.log(`Failed to upload WAV file to S3: ${s3Key}`);
        }
      })
      .catch(error => {
        console.error(`Error in S3 upload promise: ${error.message}`);
      });
    
    // Also save raw PCM data for debugging (locally only)
    const pcmFilePath = path.join(outputDir, `${sessionId}_${role}_${timestamp}.pcm`);
    fs.writeFileSync(pcmFilePath, allAudioData);
    console.log(`Raw PCM file saved locally: ${pcmFilePath} (${allAudioData.length} bytes)`);
    
    // Generate debug JSON
    const debugInfo = {
      sessionId,
      role,
      totalChunks: audioChunks.length,
      totalSamples: int16Samples.length,
      sampleRate: 24000,
      duration: int16Samples.length / 24000,
      fileSize: wavBuffer.length,
      hasNonZeroValues: int16Samples.some(v => v !== 0),
      s3Path: s3Key,
      timestamp: new Date().toISOString()
    };
    
    // Save debug JSON locally
    const debugFilePath = path.join(outputDir, `${sessionId}_${role}_${timestamp}_debug.json`);
    fs.writeFileSync(debugFilePath, JSON.stringify(debugInfo, null, 2));
    console.log(`Debug info saved locally: ${debugFilePath}`);
    
    // Upload debug JSON to S3
    const debugJsonKey = `recordings/${sessionId}_${role}_${timestamp}_debug.json`;
    uploadToS3(Buffer.from(JSON.stringify(debugInfo, null, 2)), debugJsonKey, 'application/json')
      .then(success => {
        if (success) {
          console.log(`Debug JSON uploaded to S3: ${debugJsonKey}`);
        } else {
          console.log(`Failed to upload debug JSON to S3: ${debugJsonKey}`);
        }
      })
      .catch(error => {
        console.error(`Error in S3 upload promise for debug JSON: ${error.message}`);
      });
    
  } catch (error) {
    console.error(`Error saving ${role} audio:`, error);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Create a WAV file buffer from PCM samples
 * @param {Int16Array} pcmData - PCM audio data
 * @param {number} sampleRate - Sample rate in Hz (default: 24000)
 * @returns {Buffer} - WAV file buffer
 */
function createWavFile(pcmData, sampleRate = 24000) {
  const numChannels = 1; // Mono
  const bitsPerSample = 16;
  const blockAlign = numChannels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * (bitsPerSample / 8);
  const bufferSize = 44 + dataSize;
  
  const buffer = Buffer.alloc(bufferSize);
  
  // RIFF chunk descriptor
  buffer.write('RIFF', 0);                                // ChunkID
  buffer.writeUInt32LE(36 + dataSize, 4);                 // ChunkSize
  buffer.write('WAVE', 8);                                // Format
  
  // "fmt " sub-chunk
  buffer.write('fmt ', 12);                               // Subchunk1ID
  buffer.writeUInt32LE(16, 16);                           // Subchunk1Size
  buffer.writeUInt16LE(1, 20);                            // AudioFormat (PCM)
  buffer.writeUInt16LE(numChannels, 22);                  // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);                   // SampleRate
  buffer.writeUInt32LE(byteRate, 28);                     // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);                   // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);                // BitsPerSample
  
  // "data" sub-chunk
  buffer.write('data', 36);                               // Subchunk2ID
  buffer.writeUInt32LE(dataSize, 40);                     // Subchunk2Size
  
  // Write audio data
  for (let i = 0; i < pcmData.length; i++) {
    buffer.writeInt16LE(pcmData[i], 44 + i * 2);
  }
  
  return buffer;
}

// Replace the existing mergeAndDownloadAudio function with a call to our new simpler function
export function mergeAndDownloadAudio(audioData, sessionId) {
  saveAudioAsWav(audioData, sessionId);
}

// Keep existing functions for backward compatibility
export function downloadAudio(audioData) {
  console.log("Legacy downloadAudio called - redirecting to new implementation");
  
  // Create a timestamp-based session ID for the legacy function
  const sessionId = `legacy_${Date.now()}`;
  
  // Convert legacy format to new format expected by saveAudioAsWav
  const formattedData = [{
    role: 'user',
    audioBuffer: Buffer.from(audioData, 'base64')
  }];
  
  saveAudioAsWav(formattedData, sessionId);
}

// Keep for backward compatibility but don't use directly
function processAudioChunks(audioChunks, sessionId, role) {
  console.log("Legacy processAudioChunks called - this function is deprecated");
  // This function is kept for backward compatibility but no longer used
}

// Keep for backward compatibility but don't use directly
function saveIndividualChunks(audioData, sessionId, role) {
  console.log("Legacy saveIndividualChunks called - this function is deprecated");
  // This function is kept for backward compatibility but no longer used
}

// Keep for backward compatibility but don't use directly
function int16ToMp3(int16Audio) {
  console.log("Legacy int16ToMp3 called - this function is deprecated");
  // This function is kept for backward compatibility but no longer used
  return Buffer.alloc(0);
}
