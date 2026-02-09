import { useCallback, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "~/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  onComplete?: (value: string) => void;
}

/**
 * OTP input component with individual digit boxes.
 * Supports auto-focus to next box, backspace navigation, paste, and password manager autofill.
 */
export function OtpInput({ value, onChange, length = 6, disabled = false, autoFocus = false, onComplete }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Create array of digits, filling empty slots with empty string
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focusInput = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, length - 1));
    inputRefs.current[clampedIndex]?.focus();
  }, [length]);

  const handleChange = useCallback((index: number, newDigit: string) => {
    // Extract only digits from input (handles password manager autofill with multiple chars)
    const cleanedInput = newDigit.replace(/\D/g, "");
    if (!cleanedInput) return;

    // If multiple digits entered (e.g., password manager autofill), distribute to all boxes
    if (cleanedInput.length > 1) {
      const filledValue = cleanedInput.slice(0, length);
      onChange(filledValue);

      const focusIndex = Math.min(filledValue.length, length) - 1;
      focusInput(focusIndex);

      if (filledValue.length >= length && onComplete) {
        setTimeout(() => onComplete(filledValue.slice(0, length)), 50);
      }
      return;
    }

    // Single digit input
    const digit = cleanedInput;
    const newValue = digits.map((d, i) => (i === index ? digit : d)).join("");
    onChange(newValue);

    // Move to next input if not at the end
    if (index < length - 1) {
      focusInput(index + 1);
    }

    // Trigger onComplete if all digits filled
    const trimmedNewValue = newValue.trim();
    if (trimmedNewValue.length === length && onComplete) {
      setTimeout(() => onComplete(trimmedNewValue), 0);
    }
  }, [digits, length, onChange, focusInput, onComplete]);

  const handleKeyDown = useCallback((index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        // Clear current digit
        const newValue = digits.map((d, i) => (i === index ? "" : d)).join("");
        onChange(newValue);
      } else if (index > 0) {
        // Move to previous and clear it
        focusInput(index - 1);
        const newValue = digits.map((d, i) => (i === index - 1 ? "" : d)).join("");
        onChange(newValue);
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
    } else if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      focusInput(index + 1);
    }
  }, [digits, length, onChange, focusInput]);

  const handlePaste = useCallback((event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    // Extract digits from pasted text (supports "123456", "123 456", "123-456", etc.)
    const pastedData = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pastedData) return;

    onChange(pastedData);

    // Focus last filled input or last input
    const focusIndex = Math.min(pastedData.length, length) - 1;
    focusInput(focusIndex);

    // Trigger onComplete if all digits filled (use longer delay to ensure state update)
    if (pastedData.length >= length && onComplete) {
      setTimeout(() => onComplete(pastedData.slice(0, length)), 50);
    }
  }, [length, onChange, focusInput, onComplete]);

  const handleFocus = useCallback((index: number) => {
    // Select the input content on focus
    inputRefs.current[index]?.select();
  }, []);

  return (
    <div className="flex items-center justify-center gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={index === 0 ? length : 1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => handleFocus(index)}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          name={index === 0 ? "otp" : undefined}
          className={cn(
            "h-12 w-10 rounded-md border border-input bg-background text-center text-lg font-semibold text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all"
          )}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
