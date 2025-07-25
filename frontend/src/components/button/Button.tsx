import React from "react";
import "./Button.scss";

import { Icon } from "react-feather";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  icon?: Icon | React.FC;
  iconPosition?: "start" | "end";
  iconColor?: "red" | "green" | "grey";
  iconFill?: boolean;
  buttonStyle?: "regular" | "action" | "alert" | "flush";
  visuallyDisabled?: boolean;
}

export function Button({
  label = "Okay",
  icon = void 0,
  iconPosition = "start",
  iconColor = void 0,
  iconFill = false,
  buttonStyle = "regular",
  visuallyDisabled = false,
  ...rest
}: ButtonProps) {
  const StartIcon = iconPosition === "start" ? icon : null;
  const EndIcon = iconPosition === "end" ? icon : null;
  const classList = [];
  if (iconColor) {
    classList.push(`icon-${iconColor}`);
  }
  if (iconFill) {
    classList.push(`icon-fill`);
  }
  classList.push(`button-style-${buttonStyle}`);
  if (visuallyDisabled) {
    classList.push("visually-disabled");
  }

  return (
    <button data-component="Button" className={classList.join(" ")} {...rest}>
      {StartIcon && (
        <span className="icon icon-start">
          <StartIcon />
        </span>
      )}
      <span className="label">{label}</span>
      {EndIcon && (
        <span className="icon icon-end">
          <EndIcon />
        </span>
      )}
    </button>
  );
}
