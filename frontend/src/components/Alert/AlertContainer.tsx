import React, { useState, useCallback } from "react";
import { Alert, AlertType } from "./Alert";
import "./AlertContainer.scss";

// Define the structure of an alert item
interface AlertItem {
  id: string;
  message: string;
  type: AlertType;
  duration?: number;
}

// Create a context to manage alerts globally
export const AlertContext = React.createContext<{
  showAlert: (message: string, type?: AlertType, duration?: number) => void;
  hideAlert: (id: string) => void;
  clearAlerts: () => void;
}>({
  showAlert: () => {},
  hideAlert: () => {},
  clearAlerts: () => {},
});

interface AlertProviderProps {
  children: React.ReactNode;
  maxAlerts?: number;
}

export function AlertProvider({ children, maxAlerts = 3 }: AlertProviderProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // Function to add a new alert
  const showAlert = useCallback(
    (message: string, type: AlertType = "info", duration: number = 5000) => {
      const id = Date.now().toString();
      setAlerts((prevAlerts) => {
        // If we're at or exceeding the max alerts limit, remove the oldest alert
        if (prevAlerts.length >= maxAlerts) {
          // Create a new array without the first (oldest) alert
          return [...prevAlerts.slice(1), { id, message, type, duration }];
        }
        // Otherwise, just add the new alert
        return [...prevAlerts, { id, message, type, duration }];
      });
      return id;
    },
    [maxAlerts]
  );

  // Function to remove an alert
  const hideAlert = useCallback((id: string) => {
    setAlerts((prevAlerts) => prevAlerts.filter((alert) => alert.id !== id));
  }, []);

  // Function to clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert, clearAlerts }}>
      {children}
      <AlertContainer alerts={alerts} onClose={hideAlert} />
    </AlertContext.Provider>
  );
}

// Custom hook to use the alert context
export function useAlert() {
  const context = React.useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}

// The container component that renders all active alerts
function AlertContainer({
  alerts,
  onClose,
}: {
  alerts: AlertItem[];
  onClose: (id: string) => void;
}) {
  if (alerts.length === 0) return null;

  return (
    <div data-component="AlertContainer" className="alert-container-wrapper">
      {alerts.map((alert) => (
        <Alert
          key={alert.id}
          message={alert.message}
          type={alert.type}
          duration={alert.duration}
          onClose={() => onClose(alert.id)}
          isVisible={true}
        />
      ))}
    </div>
  );
}
