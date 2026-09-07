import { useState, type ReactNode } from "react";

interface ConfirmButtonProps {
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  confirmLabel?: string;
  className?: string;
  testid?: string;
}

/** Two-tap confirm — avoids a modal for destructive row actions. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Vahvista?",
  className = "btn-danger",
  testid,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);

  return (
    <button
      data-testid={testid}
      className={armed ? "btn-danger" : className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          void onConfirm();
        } else {
          setArmed(true);
          setTimeout(() => setArmed(false), 3000);
        }
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
