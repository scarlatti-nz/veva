import React from "react";
import { Button } from "./button/Button";
import { Spinner } from "./Spinner";
import { CheckCircle, Zap } from "react-feather";
import { ItemType } from "@openai/realtime-api-beta/dist/lib/client.js";

// DTL Specific constants
const SURVEY_URL = "";

// Moved from DTLAssessmentContent
const INFO_SHEET_URL =
  "https://veva-scarlatti.syd1.digitaloceanspaces.com/public/DTL%20AI%20Agent_Information%20sheet%20for%20learners%20v1_1%20(PG).pdf";

// Moved from DTLAssessmentContent
const INITIAL_TEXT = (
  <>
    <p>
      This tool requires a reliable internet connection, ideally wi-fi. If you
      are on a mobile, please use Chrome or Safari browsers. If you experience
      issues on mobile, try on a computer instead. You will need to allow access
      to the microphone when you start the assessment. If you are having
      problems with microphone permissions, try these instructions for{" "}
      <a
        href="https://support.google.com/chrome/answer/2693767?hl=en&co=GENIE.Platform%3DAndroid&oco=0"
        target="_blank"
        rel="noopener noreferrer"
      >
        Chrome
      </a>{" "}
      and{" "}
      <a
        href="https://support.psychologytoday.com/allowing-access-to-your-camera-and-microphone-in-safari-mobile/tablet"
        target="_blank"
        rel="noopener noreferrer"
      >
        Safari
      </a>
      .
    </p>
    <p>
      <b>
        To start the assessment, please enter your name below and click "Start
        Assessment".
      </b>{" "}
      The assessment will take up to 10 minutes so only start when you are
      prepared and have time. Once the tool has asked you a question use the
      click/tap to talk button to start recording your answer. Tap it again to
      stop recording when you finish your answer.
    </p>
    <p>
      After the assessment, there will be a survey to complete. Please fill this
      out to help DTL improve the tool.
    </p>
    <p>
      <b>Important information:</b> For your privacy, we recommend not giving
      any personal information to the AI agent. We'll record the conversation to
      help with assessment purposes and to help with evaluating this tool. All
      assessments will be audio recorded and reviewed by a human tutor. All
      responses will be stored securely and encrypted. By continuing, you agree
      to the recording and storage of your responses.
    </p>
    <p>
      For more information about this tool, please see the{" "}
      <a href={INFO_SHEET_URL} target="_blank" rel="noopener noreferrer">
        information sheet
      </a>
      . If you do not want to participate in this pilot, please contact your
      tutor to arrange an alternative assessment.
    </p>
    <div
      className="logos-container"
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "30px",
        width: "100%",
        overflow: "hidden",
        gap: "20px",
      }}
    >
      <img
        src="/dtl-logo.svg"
        alt="DTL Logo"
        style={{
          maxHeight: "80px",
          objectFit: "contain",
        }}
      />

      <img
        src="/ffcove-logo.png"
        alt="FFCove Logo"
        style={{
          maxHeight: "130px",
          objectFit: "contain",
        }}
      />
      <img
        src="/scarlatti-logo.svg"
        alt="Scarlatti Logo"
        style={{
          maxHeight: "60px",
          objectFit: "contain",
        }}
      />
    </div>
  </>
);

export const CoverInfo: React.FC = () => {
  return <div className="disclaimer">{INITIAL_TEXT}</div>;
};

interface DTLAssessmentContentProps {
  participantName: string;
  consentGiven: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  items: ItemType[];
  userHasDisconnected: boolean;
  assessmentCompleted: boolean;
  onParticipantNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onConsentChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onConnect: () => void;
  onDisconnect: () => void; // For the "Complete Assessment" button
}

export const DTLAssessmentContent: React.FC<DTLAssessmentContentProps> = ({
  participantName,
  consentGiven,
  isConnected,
  isConnecting,
  userHasDisconnected,
  assessmentCompleted,
  onParticipantNameChange,
  onConsentChange,
  onConnect,
  onDisconnect,
}) => {
  return (
    <>
      {!isConnected && !userHasDisconnected && (
        <div className="student-info-form">
          <div className="input-group">
            <label htmlFor="studentName">Full Name:</label>
            <input
              id="studentName"
              type="text"
              placeholder="Enter your full name"
              value={participantName}
              onChange={onParticipantNameChange}
              disabled={isConnecting || isConnected}
            />
          </div>
          <div className="input-group checkbox-group">
            <input
              id="consentCheckbox"
              type="checkbox"
              checked={consentGiven}
              onChange={onConsentChange}
              disabled={isConnecting || isConnected}
            />
            <label htmlFor="consentCheckbox">
              I consent to participating in this pilot
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
              <b>Thank you for participating in this pilot.</b> Please complete
              this survey about your experience.
            </p>
            <Button
              label="Go to Survey"
              buttonStyle="action"
              onClick={() => window.open(SURVEY_URL, "_blank")}
              icon={CheckCircle}
              iconPosition="start"
            />
          </div>
        </div>
      )}
      <div className="spacer" />
      <div className="action-buttons">
        {/* Connect Button - only show if not connected and not disconnected */}
        {!isConnected && !userHasDisconnected && (
          <Button
            label={isConnecting ? "connecting..." : "Start Assessment"}
            iconPosition="start"
            icon={isConnecting ? Spinner : Zap}
            buttonStyle={"action"}
            visuallyDisabled={
              isConnecting || !participantName.trim() || !consentGiven
            }
            onClick={isConnecting ? undefined : onConnect}
          />
        )}
        {/* Complete Assessment Button - only show if connected and assessment completed */}
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
