import { forwardRef, useRef, type InputHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(({ className = "", onClick, onFocus, ...props }, forwardedRef) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  const openPicker = () => {
    const input = inputRef.current;
    if (!input || input.disabled || input.readOnly) return;
    input.focus();
    try {
      input.showPicker?.();
    } catch {
      // Some browsers only allow showPicker during a direct user gesture.
    }
  };

  return (
    <span className={`date-input ${className}`.trim()} onClick={openPicker}>
      <input
        {...props}
        ref={setRefs}
        type="date"
        onClick={(event) => {
          onClick?.(event);
          openPicker();
        }}
        onFocus={(event) => {
          onFocus?.(event);
        }}
      />
      <CalendarDays className="date-input__icon" size={18} aria-hidden="true" />
    </span>
  );
});

DateInput.displayName = "DateInput";
