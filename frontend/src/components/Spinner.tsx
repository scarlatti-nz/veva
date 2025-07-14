import React from "react";
import "./Spinner.css";

interface SpinnerProps {
  size?: "small" | "medium" | "large";
  color?: string;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = "small",
  color = "#fff",
  className = "",
}) => {
  return (
    <div className={`spinner-container ${className}`}>
      <div
        className={`spinner spinner-${size}`}
        style={{ borderTopColor: color }}
      />
    </div>
  );
};

export default Spinner;
