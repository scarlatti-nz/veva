import React, { useState } from "react";
import { Button } from "./button/Button";
import { Spinner } from "./Spinner";
import { CheckCircle, Zap } from "react-feather";
import { ItemType } from "@openai/realtime-api-beta/dist/lib/client.js";
import { useAlert } from "./Alert";

// Fruition Specific constants (if any, add here)
// const SURVEY_URL = "URL_FOR_FRUITION_SURVEY"; // Example
const INFO_SHEET_URL =
  "https://veva-scarlatti.syd1.digitaloceanspaces.com/public/AI%20agent%20for%20assessment_Information%20Sheet%20for%20Fruition%20v1_0%20(SS).pdf";
// Placeholder text for Fruition assessment
const INITIAL_TEXT_FRUITION = (
  <>
    <p>
      Welcome to the Fruition assessment. This tool requires a reliable internet
      connection. Please ensure your microphone is enabled.
    </p>
    <p>
      <b>
        To start the assessment, please enter your details below and click
        "Start Assessment".
      </b>{" "}
      The assessment will consist of two parts: a series of questions, then a
      checklist. You will have 30 minutes to complete each part. Use the
      click/tap to talk button to record your answers. After the assessment, you
      will be asked to complete a feedback survey.
    </p>
    <p>Please watch the following video before starting the assessment:</p>
    <div style={{ maxWidth: "800px" }}>
      <div
        style={{
          padding: "56.25% 0 0 0",
          position: "relative",
        }}
      >
        <iframe
          src="https://player.vimeo.com/video/1080689741?h=b038866d22&amp;title=0&amp;byline=0&amp;portrait=0&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
          frameBorder={0}
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
          title="Pre Assessment Video 2"
        ></iframe>
      </div>
    </div>
    <div>
      For more information about this tool, please see the{" "}
      <a href={INFO_SHEET_URL} target="_blank" rel="noopener noreferrer">
        information sheet
      </a>
    </div>
    <script src="https://player.vimeo.com/api/player.js"></script>
  </>
);

export const FruitionCoverInfo: React.FC = () => {
  return <div className="disclaimer">{INITIAL_TEXT_FRUITION}</div>;
};

interface FruitionAssessmentContentProps {
  // Keep props similar for now, adjust as needed for Fruition
  participantName: string; // Renamed for generality, or remove if not needed
  location: string; // Add location prop
  isConnected: boolean;
  isConnecting: boolean;
  items: ItemType[];
  userHasDisconnected: boolean;
  assessmentCompleted: boolean; // Renamed for generality
  onParticipantNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void; // Renamed
  onLocationChange: (event: React.ChangeEvent<HTMLSelectElement>) => void; // Add location change handler
  onConnect: () => void;
  onDisconnect: () => void; // For the "Complete Assessment" button
}

export const FruitionAssessmentContent: React.FC<
  FruitionAssessmentContentProps
> = ({
  participantName,
  location,
  isConnected,
  isConnecting,
  userHasDisconnected,
  assessmentCompleted,
  onParticipantNameChange,
  onLocationChange,
  onConnect,
  onDisconnect,
}) => {
  const { showAlert } = useAlert();
  const [integrityGiven, setIntegrityGiven] = useState(false);

  const handleConnect = () => {
    if (!integrityGiven) {
      showAlert(
        "Please agree to the assessment statement before starting.",
        "error"
      );
      return;
    }
    if (!location.trim()) {
      showAlert("Please select your location before starting.", "error");
      return;
    }
    onConnect();
  };

  return (
    <>
      {!isConnected && !userHasDisconnected && (
        <div className="student-info-form">
          <div className="input-group">
            <label htmlFor="participantName">Full Name:</label>
            <input
              id="participantName"
              type="text"
              placeholder="Enter your full name"
              value={participantName}
              onChange={onParticipantNameChange}
              disabled={isConnecting || isConnected}
            />
          </div>
          <div className="input-group">
            <label htmlFor="location">Location:</label>
            <select
              id="location"
              value={location}
              onChange={onLocationChange}
              disabled={isConnecting || isConnected}
            >
              <option value="">Select your location</option>
              <option value="Te Puke">Te Puke</option>
              <option value="Napier">Napier</option>
              <option value="Hastings">Hastings</option>
              <option value="Nelson">Nelson</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="input-group checkbox-group">
            <input
              id="integrityCheckboxFruition"
              type="checkbox"
              checked={integrityGiven}
              onChange={() => setIntegrityGiven(!integrityGiven)}
              disabled={isConnecting || isConnected}
            />
            <label htmlFor="integrityCheckboxFruition">
              This assessment is entirely my own work, and I understand all
              answers must be in my own words.
            </label>
          </div>
        </div>
      )}
      {!isConnected && userHasDisconnected && (
        <div className="assessment-completed-message">
          <p>
            Assessment session has ended. To start a new assessment, please use
            the <strong>Restart</strong> option in the menu.
          </p>
          <div className="thank-you-message">
            <p>
              <b>Next, you'll complete a checklist.</b>
            </p>
            <Button
              label="Go to checklist" // Example
              buttonStyle="action"
              onClick={() =>
                (window.location.href = `/fruition-checklist?name=${participantName}&location=${encodeURIComponent(
                  location
                )}`)
              } // Example
              icon={CheckCircle}
              iconPosition="start"
            />
          </div>
        </div>
      )}
      <div className="spacer" />
      <div className="action-buttons">
        {!isConnected && !userHasDisconnected && (
          <Button
            label={isConnecting ? "connecting..." : "Start Assessment"}
            iconPosition="start"
            icon={isConnecting ? Spinner : Zap}
            buttonStyle={"action"}
            visuallyDisabled={
              isConnecting ||
              !participantName.trim() ||
              !location.trim() ||
              !integrityGiven
            }
            onClick={isConnecting ? undefined : handleConnect}
          />
        )}
        {isConnected && assessmentCompleted && (
          <Button
            label="Complete Assessment"
            buttonStyle="action"
            onClick={onDisconnect}
            icon={CheckCircle}
            iconPosition="start"
          />
        )}
      </div>
    </>
  );
};
