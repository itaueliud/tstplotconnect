"use client";

import { useId, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 3l18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.6 6.3A11.2 11.2 0 0 1 12 6c6.2 0 10 6 10 6a17.5 17.5 0 0 1-4 4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.7 6.8A17.7 17.7 0 0 0 2 12s3.8 6 10 6a10.8 10.8 0 0 0 5.2-1.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 9.9A3 3 0 0 0 14.1 14.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PasswordField({ value, onChange, placeholder }: Props) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  const toggleLabel = visible ? "Hide password" : "Show password";

  return (
    <div className="portal-password-field">
      <input
        id={inputId}
        className="portal-input portal-password-input"
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="portal-password-toggle"
        onClick={() => setVisible((open) => !open)}
        aria-label={toggleLabel}
        aria-controls={inputId}
        aria-pressed={visible}
        title={toggleLabel}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}
