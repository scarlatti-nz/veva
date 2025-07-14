import { useState, useEffect } from "react";
import "./Alert.scss";
import {
  AlertCircle,
  CheckCircle,
  Info,
  X,
  AlertTriangle,
} from "react-feather";

export type AlertType = "success" | "error" | "info" | "warning";

interface AlertProps {
  message: string;
  type?: AlertType;
  duration?: number; // Duration in milliseconds, default is 5000 (5 seconds)
  onClose?: () => void;
  isVisible?: boolean;
}

export function Alert({
  message,
  type = "info",
  duration = 5000,
  onClose,
  isVisible = true,
}: AlertProps) {
  const [visible, setVisible] = useState(isVisible);

  // Handle auto-dismiss
  useEffect(() => {
    setVisible(isVisible);

    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onClose) onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  // Handle manual close
  const handleClose = () => {
    setVisible(false);
    if (onClose) onClose();
  };

  if (!visible) return null;

  // Determine which icon to use based on alert type
  const IconComponent = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
  }[type];

  return (
    <div data-component="Alert" className={`alert-container alert-${type}`}>
      <div className="alert-icon">
        <IconComponent size={20} />
      </div>
      <div className="alert-message">{message}</div>
      <button className="alert-close" onClick={handleClose} aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
}
