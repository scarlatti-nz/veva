import { WebSocketServer } from 'ws';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { mergeAndDownloadAudio } from './download-audio.js'
import { v4 as uuidv4 } from 'uuid';
import { getAssessTranscript } from '../chatbots/utils.js';
import sql from './db.js';
import fs from 'fs';

// Create a WebSocket traffic log file
const WS_TRAFFIC_LOG_ENABLED = false;
const WS_TRAFFIC_LOG_FILE = './ws_traffic.log';

function logWebSocketTraffic(direction, message, sessionId) {
  if (!WS_TRAFFIC_LOG_ENABLED) return;

  // Skip logging large audio delta messages
  if (message && message.type === "response.audio.delta") {
    return;
  }

  // Also skip logging input_audio_buffer.append messages which contain audio data
  if (message && message.type === "input_audio_buffer.append" && message.audio) {
    // Log the event but without the audio data
    const { audio, ...messageWithoutAudio } = message;
    messageWithoutAudio.audio_size = audio ? `[${audio.length} bytes]` : '[empty]';
    message = messageWithoutAudio;
  }

  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}][${sessionId}][${direction}] ${typeof message === 'object' ? JSON.stringify(message) : message}\n`;

  // Log to console and file
  console.log(logEntry);
  fs.appendFileSync(WS_TRAFFIC_LOG_FILE, logEntry);
}

// Log levels
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

export class RealtimeRelay {
  constructor(apiKey, agentConfigs, timeLimit = 300000, logLevel = LOG_LEVELS.INFO, saveAudio = false) {
    this.apiKey = apiKey;
    this.agentConfigs = agentConfigs;
    this.timeLimit = timeLimit;
    this.logLevel = logLevel;
    this.sockets = new WeakMap();
    this.wss = null;
    this.saveAudio = saveAudio;

    // Initialize the log file if enabled
    if (WS_TRAFFIC_LOG_ENABLED) {
      fs.writeFileSync(WS_TRAFFIC_LOG_FILE, `--- WebSocket Traffic Log Started ${new Date().toISOString()} ---\n`);
    }
  }

  listen(port) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws, req) => {
      try {
        if (!req.url) {
          this.log(LOG_LEVELS.WARN, '[Relay] No URL provided, closing connection.');
          ws.close(1008, 'URL Required');
          return;
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;
        const pathSegments = pathname.split('/').filter(segment => segment);
        const assessmentType = pathSegments.pop();

        if (!assessmentType || !this.agentConfigs[assessmentType]) {
          this.log(LOG_LEVELS.WARN, `[Relay] Invalid or missing assessment type in path: ${assessmentType}. Path: ${pathname}. Valid types: ${Object.keys(this.agentConfigs).join(', ')}`);
          ws.close(1008, 'Invalid assessment type path');
          return;
        }

        this.log(LOG_LEVELS.INFO, `[Relay] Connection request for assessment type: ${assessmentType}`);
        const agentConfig = this.agentConfigs[assessmentType];

        this._handleConnection(ws, req, agentConfig.getSession, agentConfig.getTools, agentConfig.getQuestions);

      } catch (error) {
        this.log(LOG_LEVELS.ERROR, '[Relay] Error handling initial connection:', error);
        if (ws.readyState === ws.OPEN) {
          ws.close(1011, 'Internal Server Error');
        }
      }
    });
    this.log(LOG_LEVELS.INFO, `Listening on ws://localhost:${port}`);
    return this.wss;
  }

  async _handleConnection(ws, req, getSessionFunc, getToolsFunc, getQuestionsFunc) {
    const sessionId = uuidv4();

    this.sockets.set(ws, {
      userData: null,
      client: null,
      initialMessageSent: false,
      transcript: [],
      sessionId: sessionId,
      currentUserAudioData: null,
      currentAssistantAudioData: "",
      audioData: [],
      audioChunksReceived: 0,
      sessionUpdated: false,
      userDataReceivedOrTimedOut: false,
      assessed: false,
      assessTranscript: null,
      isDemoMode: false,
    });

    if (!req.url) {
      this.log(LOG_LEVELS.WARN, 'No URL provided, closing connection.');
      ws.close();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // if (pathname !== '/') {
    //   this.log(LOG_LEVELS.WARN, `Invalid pathname: "${pathname}"`);
    //   ws.close();
    //   return;
    // }

    // if (!accessToken) {
    //   this.log('No access token provided, closing connection.');
    //   ws.close(1008, 'Unauthorized');
    //   return;
    // }


    // Instantiate new client
    this.log(LOG_LEVELS.INFO, `Connecting with key "${this.apiKey.slice(0, 3)}..."`);
    const client = new RealtimeClient({ apiKey: this.apiKey });

    // Add WebSocket monitoring
    if (WS_TRAFFIC_LOG_ENABLED) {
      // Monkey-patch the client's realtime.send method to log outgoing messages
      const originalSend = client.realtime.send.bind(client.realtime);
      client.realtime.send = (type, data) => {
        logWebSocketTraffic('OUT', { type, ...data }, sessionId);
        return originalSend(type, data);
      };

      // Add handler for incoming messages
      client.realtime.on('server.*', (event) => {
        logWebSocketTraffic('IN', event, sessionId);
      });
    }

    // Store client reference in connection data
    const connectionData = this.sockets.get(ws);
    connectionData.client = client;

    // let timeoutId;

    // const resetTimeout = () => {
    //   if (timeoutId) clearTimeout(timeoutId);
    //   timeoutId = setTimeout(() => {
    //     this.log('Connection time limit reached. Closing connection.');
    //     ws.send(JSON.stringify({ event_id: 'relay_error', type: 'error', error: { type: 'time_limit_reached', message: 'Connection time limit reached. Closing connection.' } }));
    //     ws.close();
    //     client.disconnect();
    //   }, this.timeLimit);
    // };

    // Relay: OpenAI Realtime API Event -> Browser Event
    client.realtime.on('server.*', (event) => {
      // Ensure connectionData still exists before processing
      const connectionData = this.sockets.get(ws);
      if (!connectionData) {
        this.log(LOG_LEVELS.WARN, `Received event ${event.type} after connection data was cleaned up for socket.`);
        return;
      }

      // Don't relay function call events
      if (event.type.startsWith("response.function_call_arguments")) {
        this.log(LOG_LEVELS.INFO, `Skipping function call event: "${event.type}"`);
        return;
      }
      if (event.type.startsWith("response.output_item") && event.item.type === "function_call") {
        this.log(LOG_LEVELS.INFO, `Skipping function call output event: "${event.type}"`);
        return;
      }

      // Capture assistant audio data if present
      if (event.type === "response.audio.delta") {
        if ('delta' in event) {
          try {
            // Decode the base64 data to get the raw audio
            const newChunk = Buffer.from(event.delta, 'base64');

            // Log the size of the decoded audio chunk
            this.log(LOG_LEVELS.DEBUG, `Decoded assistant audio chunk size: ${newChunk.length} bytes`);

            // If this is the first chunk, initialize the buffer
            if (!connectionData.currentAssistantAudioData) {
              connectionData.currentAssistantAudioData = newChunk;
            } else {
              // Otherwise, concatenate with existing data
              connectionData.currentAssistantAudioData = Buffer.concat([
                connectionData.currentAssistantAudioData,
                newChunk
              ]);
            }

            // Log the total size of accumulated audio data
            this.log(LOG_LEVELS.DEBUG, `Total accumulated assistant audio data: ${connectionData.currentAssistantAudioData.length} bytes`);
          } catch (error) {
            this.log(LOG_LEVELS.ERROR, "Error processing assistant audio chunk:", error);
          }
        }
      }

      // Store assistant audio when complete
      if (event.type === "response.audio.done") {
        if (connectionData.currentAssistantAudioData && connectionData.currentAssistantAudioData.length > 0) {
          try {
            // Log the commit event
            this.log(LOG_LEVELS.DEBUG, `Committing assistant audio: ${connectionData.currentAssistantAudioData.length} bytes`);

            // Store the raw buffer directly
            connectionData.audioData.push({
              role: "assistant",
              audioBuffer: connectionData.currentAssistantAudioData
            });

            this.log(LOG_LEVELS.DEBUG, `Committing assistant audio:
              Raw buffer size: ${connectionData.currentAssistantAudioData.length} bytes
              Total chunks: ${connectionData.audioData.length}`);
          } catch (error) {
            this.log(LOG_LEVELS.ERROR, "Error committing assistant audio:", error);
          }
        } else {
          this.log(LOG_LEVELS.WARN, "Warning: Empty assistant audio data detected in done event");
        }
        // Reset the buffer for the next chunk
        connectionData.currentAssistantAudioData = null;
      }

      if (event.type.startsWith("conversation.item") && event.item && event.item.type === "function_call") {
        this.log(LOG_LEVELS.DEBUG, `Skipping function call item event: "${event.type}"`);
        if (event.item.name === "assess_answers") {
          connectionData.assessed = true;
        }
        return;
      }
      if (event.type.startsWith("response.output_item") && event.item && event.item.type === "function_call_output") {
        this.log(LOG_LEVELS.DEBUG, `Skipping function call output item event: "${event.type}"`);
        return;
      }
      if (event.type.startsWith("conversation.item") && event.item && event.item.type === "function_call_output") {
        this.log(LOG_LEVELS.DEBUG, `Skipping function call conversation item event: "${event.type}"`);
        return;
      }
      // Do not relay session events
      if (event.type.startsWith("session")) {
        // Check specifically for session.updated
        if (event.type === 'session.updated') {
          this.log(LOG_LEVELS.INFO, `Session updated for session ID: ${connectionData.sessionId}`);
          connectionData.sessionUpdated = true;
          this.trySendInitialMessage(ws); // Attempt to send initial message
        }
        this.log(LOG_LEVELS.DEBUG, `Skipping session event: ${event.type}"`);
        return;
      }
      // Record transcript
      if (event.type === "conversation.item.input_audio_transcription.completed") {
        connectionData.transcript.push({
          role: "user",
          content: event.transcript,
        });
      }
      if (event.type === "response.audio_transcript.done") {
        connectionData.transcript.push({
          role: "assistant",
          content: event.transcript,
        });
      }

      this.log(LOG_LEVELS.DEBUG, `Relaying "${event.type}" to Client`);
      ws.send(JSON.stringify(event));
      logWebSocketTraffic('SERVER->BROWSER', event, sessionId);
    });
    client.realtime.on('close', () => {
      this.log(LOG_LEVELS.INFO, "Connection closed by OpenAI");
      ws.send(JSON.stringify({ event_id: 'relay_error', type: 'error', error: { type: 'connection_closed', message: 'Connection closed by OpenAI' } }));
      ws.close()
    });

    // Define initialMessageTimeoutId BEFORE messageHandler
    let initialMessageTimeoutId;

    // Helper function to send initial message if conditions met
    this.trySendInitialMessage = (ws) => {
      const connectionData = this.sockets.get(ws);
      if (connectionData && connectionData.sessionUpdated && connectionData.userDataReceivedOrTimedOut && !connectionData.initialMessageSent) {
        this.log(LOG_LEVELS.INFO, `Conditions met, sending initial message for session ID: ${connectionData.sessionId}`);
        client.sendUserMessageContent([
          {
            type: `input_text`,
            text: `Kia ora!`,
          },
        ]);
        connectionData.initialMessageSent = true;
        // Clear timeout if it was still pending (though unlikely here)
        if (initialMessageTimeoutId) {
          clearTimeout(initialMessageTimeoutId);
          initialMessageTimeoutId = null;
        }
      } else if (connectionData) {
        this.log(LOG_LEVELS.DEBUG, `Conditions not yet met for initial message: sessionUpdated=${connectionData.sessionUpdated}, userDataReceivedOrTimedOut=${connectionData.userDataReceivedOrTimedOut}, initialMessageSent=${connectionData.initialMessageSent}`);
      }
    };

    // Relay: Browser Event -> OpenAI Realtime API Event
    // We need to queue data waiting for the OpenAI connection
    const messageQueue = [];
    const messageHandler = (data) => {
      try {
        const event = JSON.parse(data);
        // Log browser message
        if (WS_TRAFFIC_LOG_ENABLED) {
          logWebSocketTraffic('BROWSER->SERVER', event, sessionId);
        }

        // Block session.update messages from the browser
        if (event.type === 'session.update') {
          this.log(LOG_LEVELS.INFO, `Blocked browser session.update message: ${JSON.stringify(event)}`);
          logWebSocketTraffic('BLOCKED', `Blocked browser session.update message`, sessionId);
          return; // Don't relay this event to OpenAI
        }

        // Ensure connectionData still exists before processing
        const connectionData = this.sockets.get(ws);
        if (!connectionData) {
          this.log(LOG_LEVELS.WARN, `Received message after connection data was cleaned up for socket.`);
          return;
        }

        // Intercept userdata.set event
        if (event.event_id === 'userdata.set') {
          this.log(LOG_LEVELS.DEBUG, `Received user data for connection: ${JSON.stringify(event.userdata)}`);
          // Add sessionId to userData
          connectionData.userData = {
            ...event.userdata,
            sessionId: connectionData.sessionId
          };

          // Log location if provided
          if (event.userdata.location) {
            this.log(LOG_LEVELS.INFO, `Location provided for session ${connectionData.sessionId}: ${event.userdata.location}`);
          }

          // Check for demo mode
          if (event.userdata.is_demo_mode === true) {
            connectionData.isDemoMode = true;
            this.log(LOG_LEVELS.INFO, `Demo mode enabled for session ${connectionData.sessionId}`);
          }

          // Add tools based on userData using the provided getToolsFunc
          const tools = getToolsFunc(connectionData.userData);
          if (tools && tools.length > 0) {
            tools.forEach(tool => {
              const toolName = tool.definition?.name || 'unnamed tool';
              this.log(LOG_LEVELS.INFO, `Adding tool for user: ${toolName}`);
              if (WS_TRAFFIC_LOG_ENABLED) {
                logWebSocketTraffic('TOOLS', `Adding tool: ${toolName}`, sessionId);
              }
              client.addTool(tool.definition, tool.callable);
            });
          } else {
            if (WS_TRAFFIC_LOG_ENABLED) {
              logWebSocketTraffic('TOOLS', `No tools added for session`, sessionId);
            }
          }

          const questions = getQuestionsFunc();
          if (questions && questions.length > 0) {
            connectionData.assessTranscript = getAssessTranscript(tools, questions);
          }


          // Clear the timeout if it's set
          if (initialMessageTimeoutId) {
            clearTimeout(initialMessageTimeoutId);
            initialMessageTimeoutId = null;
          }

          // Mark user data as received and attempt to send initial message
          connectionData.userDataReceivedOrTimedOut = true;
          this.trySendInitialMessage(ws);

          return; // Don't relay this event to OpenAI
        }

        this.log(LOG_LEVELS.DEBUG, `Relaying "${event.type}" to OpenAI`);
        client.realtime.send(event.type, event);
        if (event.type === "input_audio_buffer.append") {
          if ('audio' in event) {
            // Log the size of the audio chunk
            this.log(LOG_LEVELS.DEBUG, `Received audio chunk: ${event.audio.length} bytes`);

            try {
              const newChunk = Buffer.from(event.audio, 'base64');
              this.log(LOG_LEVELS.DEBUG, `Decoded audio chunk size: ${newChunk.length} bytes`);

              // If this is the first chunk, initialize the buffer
              if (!connectionData.currentUserAudioData) {
                connectionData.currentUserAudioData = newChunk;
              } else {
                // Otherwise, concatenate with existing data
                connectionData.currentUserAudioData = Buffer.concat([
                  connectionData.currentUserAudioData,
                  newChunk
                ]);
              }

              connectionData.audioChunksReceived++;
              this.log(LOG_LEVELS.DEBUG, `Total accumulated audio data: ${connectionData.currentUserAudioData.length} bytes`);
            } catch (error) {
              this.log(LOG_LEVELS.ERROR, "Error processing audio chunk:", error);
            }
          }
        }

        if (event.type === "input_audio_buffer.commit") {
          if (connectionData.currentUserAudioData && connectionData.currentUserAudioData.length > 0) {
            try {
              // Log the commit event
              this.log(LOG_LEVELS.DEBUG, `Committing audio chunk: ${connectionData.currentUserAudioData.length} bytes`);

              // Store the raw buffer directly
              connectionData.audioData.push({
                role: "user",
                audioBuffer: connectionData.currentUserAudioData
              });

              this.log(LOG_LEVELS.DEBUG, `Committing audio chunk:
                Raw buffer size: ${connectionData.currentUserAudioData.length} bytes
                Total chunks: ${connectionData.audioData.length}`);
            } catch (error) {
              this.log(LOG_LEVELS.ERROR, "Error committing audio chunk:", error);
            }
          } else {
            this.log(LOG_LEVELS.WARN, "Warning: Empty audio data detected in commit event");
          }
          // Reset the buffer for the next chunk
          connectionData.currentUserAudioData = null;
        }
      } catch (e) {
        this.log(LOG_LEVELS.ERROR, "Error parsing event from client:", e);
      }
    };
    ws.on('message', (data) => {
      // resetTimeout();
      if (!client.isConnected()) {
        messageQueue.push(data);
      } else {
        messageHandler(data);
      }
    });
    ws.on('close', () => {
      // if (timeoutId) clearTimeout(timeoutId);
      // Clean up connection data
      const connectionData = this.sockets.get(ws);
      if (connectionData) {
        this.log(LOG_LEVELS.INFO, `User disconnected. Session ID: ${connectionData.sessionId}, Total audio chunks: ${connectionData.audioData.length}, Demo mode: ${connectionData.isDemoMode}`);

        if (connectionData.isDemoMode) {
          this.log(LOG_LEVELS.INFO, `Demo mode active for session ${connectionData.sessionId} - skipping all data saving`);
        } else {
          this.log(LOG_LEVELS.INFO, `Saving data for session ${connectionData.sessionId}`);

          // Assessment saving
          if (!connectionData.assessed && connectionData.assessTranscript) {
            const assessment = connectionData.assessTranscript(JSON.stringify(connectionData.transcript));
            this.log(LOG_LEVELS.DEBUG, `Assessment: ${JSON.stringify(assessment)}`);
          }

          // Transcript saving
          if (connectionData.userData) {
            this.saveTranscript(connectionData.sessionId, connectionData.transcript, connectionData.userData);
          } else {
            this.log(LOG_LEVELS.WARN, `No user data available to save transcript for session ${connectionData.sessionId}`);
          }

          // Audio saving
          if (connectionData.audioData.length > 0) {
            if (this.saveAudio) {
              this.log(LOG_LEVELS.INFO, `Saving audio for session ${connectionData.sessionId}`);
              mergeAndDownloadAudio(connectionData.audioData, connectionData.sessionId);
            } else {
              this.log(LOG_LEVELS.INFO, "Audio saving disabled, skipping audio merge and download");
            }
          } else {
            this.log(LOG_LEVELS.WARN, "No audio data collected during session");
          }
        }

        this.sockets.delete(ws);
      }
      this.log(LOG_LEVELS.INFO, "Connection closed by client");
      client.disconnect();
    });


    // Connect to OpenAI Realtime API
    try {
      this.log(LOG_LEVELS.INFO, `Connecting to OpenAI...`);
      logWebSocketTraffic('CONNECTION', 'Attempting to connect to OpenAI Realtime API', sessionId);
      // await client.connect({ model: "gpt-4o-realtime-preview-2024-10-01" });
      // await client.connect({ model: "gpt-4o-realtime-preview-2024-12-17" });
      await client.connect({ model: "gpt-4o-realtime-preview-2025-06-03" });
    } catch (e) {
      this.log(LOG_LEVELS.ERROR, `Error connecting to OpenAI: ${e.message}`);
      logWebSocketTraffic('ERROR', `Connection error: ${e.message}`, sessionId);
      ws.close();
      return;
    }
    this.log(LOG_LEVELS.INFO, `Connected to OpenAI successfully!`);
    logWebSocketTraffic('CONNECTION', 'Successfully connected to OpenAI Realtime API', sessionId);

    this.log(LOG_LEVELS.INFO, `Updating session with chatbot data`);
    // Get session data using the provided getSessionFunc *after* successful connection
    const sessionData = getSessionFunc();
    this.log(LOG_LEVELS.DEBUG, `Got session data: ${JSON.stringify(sessionData)}`);
    logWebSocketTraffic('SESSION', `Updating session with data: ${JSON.stringify(sessionData)}`, sessionId);



    client.updateSession(sessionData);
    this.log(LOG_LEVELS.INFO, `Session update request sent, waiting for confirmation...`);

    // Process any queued messages
    while (messageQueue.length) {
      messageHandler(messageQueue.shift());
    }


    // Set timeout to send initial message if userData isn't received
    initialMessageTimeoutId = setTimeout(() => {
      const currentConnectionData = this.sockets.get(ws);
      if (currentConnectionData && !currentConnectionData.initialMessageSent) {
        this.log(LOG_LEVELS.INFO, `No userData received within timeout, marking as timed out for session ID: ${currentConnectionData.sessionId}`);
        // Mark as timed out and attempt to send initial message
        currentConnectionData.userDataReceivedOrTimedOut = true;
        this.trySendInitialMessage(ws);
      }
    }, 5000); // 5 second timeout for userData
  }

  async saveTranscript(sessionId, transcript, userData) {
    try {
      // Import the SQL module

      this.log(LOG_LEVELS.INFO, `Saving transcript for session ${sessionId}`);

      // Insert the transcript into the database
      await sql`
        INSERT INTO transcript (
          session_id,
          user_id,
          student_name,
          location,
          transcript_data,
          device_info
        ) VALUES (
          ${sessionId},
          ${userData?.student_id ?? 'none'},
          ${userData?.student_name ?? 'none'},
          ${userData?.location ?? 'not specified'},
          ${JSON.stringify(transcript)},
          ${JSON.stringify(userData?.device_info ?? null)}
        )
      `;

      this.log(LOG_LEVELS.INFO, `Transcript saved successfully for session ${sessionId}`);
    } catch (error) {
      this.log(LOG_LEVELS.ERROR, `Error saving transcript: ${error.message}`);
    }
  }

  log(level = LOG_LEVELS.INFO, ...args) {
    if (level <= this.logLevel) {
      const levelPrefix = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || 'INFO';
      console[level === LOG_LEVELS.ERROR ? 'error' : level === LOG_LEVELS.WARN ? 'warn' : 'log'](`[RealtimeRelay][${levelPrefix}]`, ...args);
    }
  }
}

function extractApiKey(input) {
  const match = input.match(/openai-insecure-api-key\.([^ ]+)/);
  return match ? match[1].replace(/,$/, '') : '';
}