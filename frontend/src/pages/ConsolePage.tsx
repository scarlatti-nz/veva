/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const LOCAL_RELAY_SERVER_URL: string =
  import.meta.env.VITE_LOCAL_RELAY_SERVER_URL || "";

// Function to ensure proper WebSocket URL formation
const getWebSocketUrl = (path: string, assessment: string): string => {
  // If it's already a full URL, return it
  if (path.startsWith("ws://") || path.startsWith("wss://")) {
    return path;
  }

  // If it's a relative path like "/relay"
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;

  // Handle path with or without leading slash
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${protocol}//${host}${normalizedPath}/${assessment}`;
};

import { useCallback, useEffect, useRef, useState } from "react";

import { UAParser } from "ua-parser-js";
import { RealtimeClient } from "@openai/realtime-api-beta";
import { ItemType } from "@openai/realtime-api-beta/dist/lib/client.js";
import { WavRecorder, WavStreamPlayer } from "../lib/wavtools/index.js";
// import { instructions as defaultInstructions } from "../utils/conversation_config.js";
import { WavRenderer } from "../utils/wav_renderer";

import { Menu, Mic, StopCircle } from "react-feather";
import { useAlert } from "../components/Alert";
import { Button } from "../components/button/Button";
import {
  DTLAssessmentContent,
  CoverInfo as DTLCoverInfo,
} from "../components/DTLAssessmentContent";
import {
  FruitionAssessmentContent,
  FruitionCoverInfo,
} from "../components/FruitionAssessmentContent";
import { Spinner } from "../components/Spinner";

import "./ConsolePage.scss";
import {
  FruitionChecklistAssessmentContent,
  FruitionChecklistCoverInfo,
} from "../components/FruitionChecklistAssessmentContent.js";
/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: "client" | "server";
  count?: number;
  event: { [key: string]: any };
}

// Remove DTL specific constants
// const SURVEY_URL = "https://www.surveymonkey.com/r/C729WM5";
// const INFO_SHEET_URL =
//  "https://veva-scarlatti.syd1.digitaloceanspaces.com/public/DTL%20AI%20Agent_Information%20sheet%20for%20learners%20v1_1%20(PG).pdf";

// Remove INITIAL_TEXT
/*
const INITIAL_TEXT = (
  <>
    <p>
// ... (removed INITIAL_TEXT content) ...
    </div>
  </>
);
*/

// Utility function to preserve stack trace when wrapping errors
const createErrorWithOriginalStack = (
  message: string,
  originalError: Error
) => {
  // Create a new error with our custom message
  const newError = new Error(`${message} \n\n ${originalError.message}`);

  // Append the original error's message and stack to our stack
  if (originalError.stack) {
    newError.stack = `${newError.stack}\nCaused by: ${originalError.stack}`;
  }

  return newError;
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

// Define props interface
interface ConsolePageProps {
  assessment?: string; // Make assessment prop optional
}

export function ConsolePage({ assessment }: ConsolePageProps) {
  const { showAlert, clearAlerts } = useAlert();

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const [isAITalking, setIsAITalking] = useState(true);
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({
      sampleRate: 24000,
      onEnded: () => setIsAITalking(false),
    })
  );
  const clientRef = useRef<RealtimeClient | null>(null);

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
  // const [expandedEvents, setExpandedEvents] = useState<{
  //   [key: string]: boolean;
  // }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  // const [canPushToTalk, setCanPushToTalk] = useState(true);
  const canPushToTalk = true;
  const [isRecording, setIsRecording] = useState(false);

  const [responseState, setResponseState] = useState<
    | "idle"
    | "recording"
    | "userStoppedRecording"
    | "recordingStopped"
    | "audioCommited"
    | "commitConfirmed"
    | "receivingResponse"
  >("idle");
  // const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});

  // const [instructions, setInstructions] = useState<string>(defaultInstructions);
  const [error, setError] = useState<any>(null);

  const TOTAL_TIME = 1800;
  const [remainingTime, setRemainingTime] = useState<number>(TOTAL_TIME);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Add state for name and ID - Rename studentName
  const [participantName, setParticipantName] = useState("");
  const [location, setLocation] = useState(""); // Add location state
  const [menuOpen, setMenuOpen] = useState(false); // Add state for menu visibility
  const [consentGiven, setConsentGiven] = useState(true); // Add state for consent checkbox, pre-ticked
  const menuRef = useRef<HTMLDivElement>(null); // Add ref for the menu container

  // Add a new ref to track user-initiated disconnects
  const userInitiatedDisconnectRef = useRef(false);

  // Rename answersAssessed
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);
  const [userHasDisconnected, setUserHasDisconnected] = useState(false);

  // Add wakeLock ref
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Check for demo mode in URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const isDemoMode = urlParams.get("demo") === "true";

  // Add click outside handler for menu
  useEffect(() => {
    function handleClickOutside(event: Event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        menuOpen
      ) {
        setMenuOpen(false);
      }
    }

    // Add event listener when menu is open
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    // Clean up the event listener
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [menuOpen]);

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    // Check if participant name is provided (Adjust logic based on final requirements)
    if (
      (assessment === "dtl" || assessment === "fruition") &&
      !participantName.trim()
    ) {
      showAlert(
        "Please enter your full name before starting the assessment.",
        "error"
      );
      return;
    }

    // Check if location is provided for fruition assessment
    if (assessment === "fruition" && !location.trim()) {
      showAlert(
        "Please select your location before starting the assessment.",
        "error"
      );
      return;
    }

    if (!consentGiven) {
      showAlert("You must consent to participate in this pilot.", "error");
      return;
    }

    // Request wake lock if available
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request(
          "screen"
        );
      }
    } catch (err) {
      console.warn("Wake Lock API not supported or permission denied:", err);
    }

    // Get client instance from ref
    const client = clientRef.current;
    // Ensure client is initialized before connecting
    if (!client) {
      console.error(
        "RealtimeClient not initialized before connectConversation"
      );
      setError(new Error("Client initialization failed. Cannot connect."));
      setIsConnecting(false);
      return;
    }

    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    let cancel = false;
    setIsConnecting(true);
    setIsAITalking(true);
    setItems(client.conversation.getItems());
    setError(null);
    setResponseState("idle");
    setIsRecording(false);
    setUserHasDisconnected(false);
    // Connect to microphone
    await wavRecorder.begin().catch((error) => {
      cancel = true;
      const verboseError = createErrorWithOriginalStack(
        `Error connecting to microphone. Please ensure you have allowed access to the microphone.`,
        error
      );
      console.error(verboseError);
      setError(verboseError);
      setIsConnecting(false);
      showAlert(
        "Error connecting to microphone. Please ensure you have allowed access to the microphone.",
        "error"
      );
    });
    if (cancel) {
      return;
    }

    // Connect to audio output
    await wavStreamPlayer.connect().catch((error) => {
      cancel = true;
      const verboseError = createErrorWithOriginalStack(
        `Error connecting to audio output.`,
        error
      );
      console.error(verboseError);
      setError(verboseError);
      setIsConnecting(false);
      showAlert("Error connecting to audio output.", "error");
    });
    if (cancel) {
      return;
    }

    // Connect to realtime API
    await client.connect().catch((error) => {
      cancel = true;
      const verboseError = createErrorWithOriginalStack(
        `Error connecting to realtime API.`,
        error
      );
      console.error(verboseError);
      setError(verboseError);
      setIsConnecting(false);
      showAlert(
        "Error connecting to the assessment service. Please try again later.",
        "error"
      );
    });

    if (cancel) {
      return;
    }

    setIsConnected(true);
    setIsConnecting(false);
    clearAlerts(); // Clear any existing alerts on successful connection

    client.realtime.ws.send(
      JSON.stringify({
        event_id: "userdata.set",
        type: "custom",
        userdata: {
          student_name: participantName, // Use renamed state variable
          location: location, // Include location
          assessment_type: assessment, // Send assessment type
          is_demo_mode: isDemoMode, // Send demo mode flag
          device_info: {
            browser: getBrowserInfo(),
            language: navigator.language,
            screen_size: `${window.screen.width}x${window.screen.height}`,
            window_size: `${window.innerWidth}x${window.innerHeight}`,
            device_pixel_ratio: window.devicePixelRatio,
            is_touch_device: isTouchDevice,
            time: new Date().toISOString(),
          },
        },
      })
    );

    if (client.getTurnDetectionType() === "server_vad") {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }

    // Set assessmentCompleted generally, or add more specific checks if needed
    setAssessmentCompleted(false);
  }, [
    assessment,
    participantName,
    location,
    isTouchDevice,
    consentGiven,
    isDemoMode,
    showAlert,
    clearAlerts,
  ]);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    console.log("disconnectConversation");
    const client = clientRef.current;
    if (!client) return;
    userInitiatedDisconnectRef.current = true; // Set flag before disconnecting

    // Release wake lock if active
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.warn("Error releasing wake lock:", err);
      }
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsConnected(false);
    setUserHasDisconnected(true);
    setResponseState("idle");
    setIsAITalking(true);

    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();

    // Reset the flag after a short delay to ensure the close handler sees it
    setTimeout(() => {
      userInitiatedDisconnectRef.current = false;
    }, 100);
  }, []);

  const stopRecordingAndDisconnect = async () => {
    if (isRecording) {
      console.warn("Disconnecting while recording");
      await stopRecording();
    }
    await disconnectConversation();
  };

  // timer
  useEffect(() => {
    if (!isConnected) return;

    setRemainingTime(TOTAL_TIME);
    startTimeRef.current = Date.now();

    // Update every second instead of every 200ms since we only show minutes and seconds
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - startTimeRef.current;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const newRemainingTime = Math.max(0, TOTAL_TIME - elapsedSeconds);

      if (newRemainingTime <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        disconnectConversation();
      } else {
        setRemainingTime(newRemainingTime);
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isConnected, disconnectConversation]);

  // Add this useEffect to detect touch devices
  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window);
  }, []);

  /**
   * In push-to-talk mode, start recording
   * .appendInputAudio() for each sample
   */
  const startRecording = async () => {
    const client = clientRef.current;
    if (!client) return;
    if (!isConnected || !canPushToTalk || isAITalking || isRecording) {
      return;
    }
    setIsRecording(true);
    setResponseState("recording");
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  /**
   * In push-to-talk mode, stop recording
   */
  const stopRecording = async () => {
    const client = clientRef.current;
    if (!client) return;
    if (!isConnected || !canPushToTalk || !isRecording) {
      return;
    }
    setIsRecording(false);
    setResponseState("userStoppedRecording");
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    setResponseState("recordingStopped");
    client.createResponse();
  };

  /**
   * Switch between Manual <> VAD mode for communication
   */
  // const changeTurnEndType = async (value: string) => {
  //   const client = clientRef.current;
  //   const wavRecorder = wavRecorderRef.current;
  //   if (value === "none" && wavRecorder.getStatus() === "recording") {
  //     await wavRecorder.pause();
  //   }
  //   client.updateSession({
  //     turn_detection: value === "none" ? null : { type: "server_vad" },
  //   });
  //   if (value === "server_vad" && client.isConnected()) {
  //     await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  //   }
  //   setCanPushToTalk(value === "none");
  // };

  // const handleInstructionsChange = (newInstructions: string) => {
  //   setInstructions(newInstructions);
  // };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const client = clientRef.current;
      if (!client) return;
      if (
        client.isConnected() &&
        e.code === "Space" &&
        !e.repeat &&
        isConnected &&
        canPushToTalk &&
        !isAITalking
      ) {
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const client = clientRef.current;
      if (!client) return;
      if (
        client.isConnected() &&
        e.code === "Space" &&
        !e.repeat &&
        isConnected &&
        canPushToTalk &&
        !isAITalking
      ) {
        stopRecording();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [isConnected, canPushToTalk, isAITalking, startRecording, stopRecording]);

  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll("[data-conversation-content]")
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext("2d");
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies("voice")
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              "#0099ff",
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext("2d");
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies("voice")
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              "#009900",
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Initialize RealtimeClient here
    const client = new RealtimeClient({
      url: getWebSocketUrl(LOCAL_RELAY_SERVER_URL, assessment || "default"),
    });
    clientRef.current = client;

    // handle realtime events from client + server for event logging
    client.on("realtime.event", (realtimeEvent: RealtimeEvent) => {
      // Client events to track audio processing
      if (realtimeEvent.source === "client") {
        if (realtimeEvent.event.type === "input_audio_buffer.commit") {
          // Final audio chunk sent, now waiting for server
          setResponseState("audioCommited");
        }
      }

      // Server events
      if (realtimeEvent.source === "server") {
        if (realtimeEvent.event.type === "response.created") {
          setIsAITalking(true);
          setResponseState("receivingResponse");
        }
        if (realtimeEvent.event.type === "input_audio_buffer.commit") {
          setResponseState("commitConfirmed");
        }
        if (realtimeEvent.event.type === "response.done") {
          setResponseState("idle");
        }
        if (
          realtimeEvent.event.type === "response.done" &&
          realtimeEvent.event.response.output.length > 0 &&
          realtimeEvent.event.response.output.find(
            (item: any) =>
              item.type === "function_call" && item.name === "assess_answers"
          )
        ) {
          // Set assessmentCompleted generally, or add more specific checks if needed
          setAssessmentCompleted(true);
        }
      }
    });
    client.realtime.on("server.error", (event: any) => {
      console.error(event);
      // Make sure we preserve all error information
      if (event.error instanceof Error) {
        // If it's already an Error object, use it directly
        setError(event.error);
      } else if (typeof event.error === "object") {
        // If it's a plain object with error details, convert to Error with stack
        const serverError = new Error(event.error.message || "Server error");
        serverError.stack =
          event.error.stack || JSON.stringify(event.error, null, 2);
        // Add any other properties from the original error
        Object.assign(serverError, event.error);
        setError(serverError);
      } else {
        // Fallback for string or other primitive error types
        setError(new Error(String(event.error || "Unknown server error")));
      }
      // disconnectConversation();
    });
    // client.on("error", (event: any) => console.error(event));
    client.on("conversation.interrupted", async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on("conversation.updated", async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      // if (item.type === "function_call_output") {
      //   await disconnectConversation();
      // }
      if (item.status === "completed" && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });
    client.realtime.on("close", async ({ error }: { error: boolean }) => {
      console.log("close", "error", error);
      if (!userInitiatedDisconnectRef.current) {
        // Get the current client instance. It might have changed if the effect re-ran.
        const currentClient = clientRef.current;

        // Only show error if not user-initiated
        if (error) {
          const closeError = new Error(
            "Connection closed unexpectedly due to an error. We apologise and are working on it."
          );
          // Add additional debugging information to help diagnose mobile Safari issues
          closeError.stack = `${closeError.stack}\n\nBrowser Info: ${
            navigator.userAgent
          }\nTimestamp: ${new Date().toISOString()}`;
          setError(closeError);
        } else {
          setError(
            new Error(
              "Connection closed unexpectedly. We apologise and are working on it."
            )
          );
        }
        setItems([]);
        // Disconnect using the client instance available at the time of closure
        if (currentClient) {
          const wavRecorder = wavRecorderRef.current;
          await wavRecorder.end();
          const wavStreamPlayer = wavStreamPlayerRef.current;
          await wavStreamPlayer.interrupt();
          currentClient.disconnect();
          // Update state after disconnect logic
          setIsConnected(false);
          setUserHasDisconnected(true);
          setResponseState("idle");
          setIsAITalking(true);
        }
      }
    });

    setItems(client.conversation.getItems());

    // Return a cleanup function to remove listeners and reset
    return () => {
      // Use the client instance captured by this specific effect run for cleanup
      if (client && client.realtime) {
        // Remove specific listeners added in this effect
        client.off("realtime.event");
        client.off("conversation.interrupted");
        client.off("conversation.updated");
        client.realtime.off("server.error");
        client.realtime.off("close");
        // Consider disconnecting the client here if the component unmounts
        // or if the assessment type changes, forcing a full reconnect.
        // client.disconnect();
        // clientRef.current = null; // Maybe reset ref if disconnecting
      }
      // cleanup; resets to defaults
      // client.reset(); // Reset might be too broad here if component updates
    };
  }, [disconnectConversation, assessment]);

  /**
   * Handle changes to the instructions
   */
  // useEffect(() => {
  //   const client = clientRef.current;

  //   client.updateSession({ instructions: instructions });
  // }, [instructions]);

  /**
   * Render the application
   */
  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          {/* <img src="/openai-logomark.svg" /> */}
          <span>VEVA</span>
        </div>
        {isConnected && (
          <div className="remaining-time">
            Time Remaining: {formatTime(remainingTime)}
          </div>
        )}

        {isConnected && (
          <div
            className={`status-indicator ${
              responseState === "idle"
                ? "completed"
                : responseState === "recording"
                ? "recording"
                : "processing"
            }`}
          >
            <span className="indicator-dot"></span>{" "}
            {responseState === "idle" && !isAITalking && <span>Ready</span>}
            {responseState === "idle" && isAITalking && (
              <span>Agent speaking...</span>
            )}
            {responseState === "recording" && <span>Recording...</span>}
            {responseState === "userStoppedRecording" && (
              <span>User Stopped Recording...</span>
            )}
            {responseState === "recordingStopped" && (
              <span>Recording Stopped...</span>
            )}
            {responseState === "audioCommited" && (
              <span>Processing Audio...</span>
            )}
            {responseState === "commitConfirmed" && (
              <span>Agent loading...</span>
            )}
            {responseState === "receivingResponse" && (
              <span>Agent speaking...</span>
            )}
          </div>
        )}
        {!isConnected && items.length > 0 && (
          <div className="status-indicator completed">
            <span className="indicator-dot"></span> Assessment Complete
          </div>
        )}
        <div className="content-block logout"></div>
        <div className="menu-container" ref={menuRef}>
          <button
            className="menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <Menu size={24} />
          </button>
          {menuOpen && (
            <div className="menu-dropdown">
              {isConnected && (
                <button
                  className="menu-item"
                  onClick={async () => {
                    await stopRecordingAndDisconnect();
                    setMenuOpen(false);
                  }}
                >
                  Cancel Assessment
                </button>
              )}
              <button
                className="menu-item"
                onClick={() => {
                  window.location.reload();
                }}
              >
                Restart
              </button>
            </div>
          )}
        </div>
      </div>
      {isDemoMode && (
        <div className="demo-watermark">
          <div className="demo-banner">
            <span>DEMO MODE</span>
          </div>
          <div className="demo-notice">
            This is a demonstration. Results will not be saved.
          </div>
        </div>
      )}
      <div className="content-main">
        <div className="content-logs">
          <div className="content-block conversation">
            <div className="visualization">
              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server">
                <canvas ref={serverCanvasRef} />
              </div>
            </div>
            {/* <div className="content-block-title">conversation</div> */}
            <div className="content-block-body" data-conversation-content>
              {error && (
                <div className="error">
                  <p>
                    Oops! Something went wrong. Sorry about that. Please refresh
                    the page to try again. If you continute to experience
                    problems, please contact your tutor to arrange a manual
                    assessment.
                  </p>
                  <p>
                    <strong>Error:</strong> {error.message}
                  </p>
                  <details>
                    <summary>Error Details (Stack Trace)</summary>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        fontSize: "12px",
                        overflowX: "auto",
                      }}
                    >
                      {error.stack || "No stack trace available"}
                    </pre>
                  </details>
                </div>
              )}

              {/* Render InitialDisclaimer if no items and not connected */}
              {!items.length && !isConnected && assessment === "dtl" && (
                <DTLCoverInfo />
              )}
              {!items.length && !isConnected && assessment === "fruition" && (
                <FruitionCoverInfo />
              )}
              {!items.length &&
                !isConnected &&
                assessment === "fruition-checklist" && (
                  <FruitionChecklistCoverInfo />
                )}
              {/* Handle default/no assessment case or add more types */}
              {!items.length &&
                !isConnected &&
                assessment !== "dtl" &&
                assessment !== "fruition" &&
                assessment !== "fruition-checklist" && (
                  <div>Select an assessment type.</div> // Placeholder
                )}

              {items.map((conversationItem) => (
                <div className="conversation-item" key={conversationItem.id}>
                  <div className={`speaker ${conversationItem.role || ""}`}>
                    <div>
                      {conversationItem.role === "user" ? "You" : "VEVA"}
                    </div>
                  </div>
                  <div className={`speaker-content`}>
                    {/* tool response */}
                    {conversationItem.type === "function_call_output" && (
                      <div>{conversationItem.formatted.output}</div>
                    )}
                    {/* tool call */}
                    {!!conversationItem.formatted.tool && (
                      <div>
                        {conversationItem.formatted.tool.name}(
                        {conversationItem.formatted.tool.arguments})
                      </div>
                    )}
                    {!conversationItem.formatted.tool &&
                      conversationItem.role === "user" && (
                        <div>
                          {conversationItem.formatted.transcript ||
                            (conversationItem.formatted.audio?.length
                              ? "(awaiting transcript)"
                              : conversationItem.formatted.text ||
                                "(item sent)")}
                        </div>
                      )}
                    {!conversationItem.formatted.tool &&
                      conversationItem.role === "assistant" && (
                        <div>
                          {conversationItem.formatted.transcript ||
                            conversationItem.formatted.text ||
                            "(truncated)"}
                        </div>
                      )}
                    {/* {conversationItem.formatted.file && (
                      <audio
                        src={conversationItem.formatted.file.url}
                        controls
                      />
                    )} */}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="content-actions">
            {/* Conditionally render DTL Assessment Content */}
            {assessment === "dtl" && (
              <DTLAssessmentContent
                participantName={participantName}
                consentGiven={consentGiven}
                isConnected={isConnected}
                isConnecting={isConnecting}
                items={items}
                userHasDisconnected={userHasDisconnected}
                assessmentCompleted={assessmentCompleted}
                onParticipantNameChange={(e) =>
                  setParticipantName(e.target.value)
                }
                onConsentChange={(e) => setConsentGiven(e.target.checked)}
                onConnect={connectConversation}
                onDisconnect={stopRecordingAndDisconnect}
              />
            )}
            {/* Conditionally render Fruition Assessment Content */}
            {assessment === "fruition" && (
              <FruitionAssessmentContent
                participantName={participantName}
                location={location}
                isConnected={isConnected}
                isConnecting={isConnecting}
                items={items}
                userHasDisconnected={userHasDisconnected}
                assessmentCompleted={assessmentCompleted}
                onParticipantNameChange={(e) =>
                  setParticipantName(e.target.value)
                }
                onLocationChange={(e) => setLocation(e.target.value)}
                onConnect={connectConversation}
                onDisconnect={stopRecordingAndDisconnect}
              />
            )}
            {/* Conditionally render Fruition Checklist Assessment Content */}
            {assessment === "fruition-checklist" && (
              <FruitionChecklistAssessmentContent
                participantName={participantName}
                location={location}
                consentGiven={consentGiven}
                isConnected={isConnected}
                isConnecting={isConnecting}
                items={items}
                userHasDisconnected={userHasDisconnected}
                assessmentCompleted={assessmentCompleted}
                onParticipantNameChange={(e) =>
                  setParticipantName(e.target.value)
                }
                onLocationChange={(e) => setLocation(e.target.value)}
                onConsentChange={(e) => setConsentGiven(e.target.checked)}
                onConnect={connectConversation}
                onDisconnect={stopRecordingAndDisconnect}
              />
            )}
            {/* Keep generic action buttons (push-to-talk) here */}
            <div className="content-actions generic-actions">
              <div className="spacer" />
              <div className="action-buttons">
                {isConnected && canPushToTalk && (
                  <Button
                    label={
                      isAITalking
                        ? "Please wait..."
                        : isTouchDevice
                        ? isRecording
                          ? "Tap to send"
                          : "Tap to talk"
                        : isRecording
                        ? "Click to send"
                        : "Click to talk"
                    }
                    // buttonStyle={isRecording ? "alert" : "action"}
                    buttonStyle="action"
                    icon={
                      isAITalking ? Spinner : isRecording ? StopCircle : Mic
                    }
                    iconColor={isRecording ? "red" : "grey"}
                    disabled={!isConnected || !canPushToTalk || isAITalking}
                    onClick={isRecording ? stopRecording : startRecording}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Extract browser name and version from user agent string using ua-parser-js
 */
const getBrowserInfo = (): { name: string; version: string; os: string } => {
  const parser = new UAParser(navigator.userAgent);
  const result = parser.getResult();

  // ua-parser-js returns more detailed info, adapt it to the existing return type
  // It might return undefined for some fields, hence the 'Unknown' fallback
  const browserName = result.browser.name || "Unknown";
  const version = result.browser.version || "Unknown";
  const osName = result.os.name || "Unknown";
  const osVersion = result.os.version || ""; // os version might be separate

  // Combine OS name and version if needed, similar to original logic
  const os = osVersion ? `${osName} ${osVersion}` : osName;

  return { name: browserName, version, os };
};
