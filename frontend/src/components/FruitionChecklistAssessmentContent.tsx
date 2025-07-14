import { ItemType } from "@openai/realtime-api-beta/dist/lib/client.js";
import React, { useEffect } from "react";
import { CheckCircle, Zap } from "react-feather";
import { useSearchParams } from "react-router-dom";
import { Button } from "./button/Button";
import { Spinner } from "./Spinner";

// Fruition Specific constants (if any, add here)
// const SURVEY_URL = "URL_FOR_FRUITION_SURVEY"; // Example

// Placeholder text for Fruition assessment
const INITIAL_TEXT_FRUITION = (
  <>
    <p>
      Now you'll complete a checklist. This tool requires a reliable internet
      connection. Please ensure your microphone is enabled.
    </p>
    <p>
      <b>To start the assessment, click the button below.</b> You will have 30
      minutes to complete the checklist. Use the click/tap to talk button to
      record your answers. After the assessment, you will be asked to complete a
      feedback survey.
    </p>
  </>
);

export const FruitionChecklistCoverInfo: React.FC = () => {
  return <div className="disclaimer">{INITIAL_TEXT_FRUITION}</div>;
};

interface FruitionAssessmentContentProps {
  // Keep props similar for now, adjust as needed for Fruition
  participantName: string; // Renamed for generality, or remove if not needed
  location: string; // Add location prop
  consentGiven: boolean; // Keep or remove based on Fruition requirements
  isConnected: boolean;
  isConnecting: boolean;
  items: ItemType[];
  userHasDisconnected: boolean;
  assessmentCompleted: boolean; // Renamed for generality
  onParticipantNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void; // Renamed
  onLocationChange: (event: React.ChangeEvent<HTMLSelectElement>) => void; // Add location change handler
  onConsentChange: (event: React.ChangeEvent<HTMLInputElement>) => void; // Keep or remove
  onConnect: () => void;
  onDisconnect: () => void; // For the "Complete Assessment" button
}

export const FruitionChecklistAssessmentContent: React.FC<
  FruitionAssessmentContentProps
> = ({
  isConnected,
  isConnecting,
  userHasDisconnected,
  assessmentCompleted,
  onConnect,
  onDisconnect,
  onParticipantNameChange,
  onLocationChange,
  onConsentChange,
}) => {
  const [searchParams] = useSearchParams();
  const name = searchParams.get("name") ?? "unknown";
  const location = searchParams.get("location") ?? "";

  useEffect(() => {
    onParticipantNameChange({
      target: { value: name },
    } as React.ChangeEvent<HTMLInputElement>);

    onLocationChange({
      target: { value: location },
    } as React.ChangeEvent<HTMLSelectElement>);

    onConsentChange({
      target: { checked: true },
    } as React.ChangeEvent<HTMLInputElement>);
  }, [
    name,
    location,
    onParticipantNameChange,
    onLocationChange,
    onConsentChange,
  ]);

  return (
    <>
      {!isConnected && !userHasDisconnected && (
        <div className="student-info-form"></div>
      )}
      {!isConnected && userHasDisconnected && (
        <div className="assessment-completed-message">
          <p>
            Assessment session has ended. To start a new assessment, please use
            the <strong>Restart</strong> option in the menu.
          </p>
          <div className="thank-you-message">
            <p>
              <b>
                Thank you for participating. Please complete this survey about
                your experience.
              </b>
              {/* Add specific Fruition post-assessment message or survey link */}
              {/* Example: Please complete this survey about your experience. */}
            </p>
            <Button
              label="Go to survey" // Example
              buttonStyle="action"
              
              icon={CheckCircle}
              iconPosition="start"
            />
          </div>
        </div>
      )}
      <div className="spacer" />
      <div className="action-buttons">
        {/* Connect Button */}
        {!isConnected && !userHasDisconnected && (
          <Button
            label={isConnecting ? "connecting..." : "Start Assessment"}
            iconPosition="start"
            icon={isConnecting ? Spinner : Zap}
            buttonStyle={"action"}
            // Adjust disabled logic based on Fruition requirements (e.g., remove name/consent check if not needed)
            visuallyDisabled={isConnecting}
            onClick={isConnecting ? undefined : onConnect}
          />
        )}
        {/* Complete Assessment Button */}
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
