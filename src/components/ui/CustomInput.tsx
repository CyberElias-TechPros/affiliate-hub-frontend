import * as React from "react";
import { cn } from "@/lib/utils";

interface CustomInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  /** Required: a label that is not programmatically associated is an
   *  accessibility failure, and every form in this app now passes one. */
  id: string;
  label: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  /** Right-hand slot, e.g. a show/hide password button. */
  trailing?: React.ReactNode;
}

/**
 * Text input with an associated label, error and hint.
 *
 * Fixes over the original:
 *  - The `<label>` now has `htmlFor`, so clicking it focuses the field and
 *    screen readers announce the label. Previously it was an unassociated
 *    `<label>` wrapping nothing, which announced as empty.
 *  - The error is linked with `aria-describedby` and marked `aria-invalid`,
 *    so it is announced rather than only visible.
 *  - The password toggle moved out to the caller via `trailing`. Having it
 *    baked in meant the component owned visibility state its parent also
 *    owned, and the two could disagree.
 */
const CustomInput = React.forwardRef<HTMLInputElement, CustomInputProps>(
  ({ className, label, error, hint, icon, trailing, id, ...props }, ref) => {
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;
    const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

    return (
      <div className="w-full space-y-1.5">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>

        <div className="relative">
          {icon && (
            <div
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            >
              {icon}
            </div>
          )}

          <input
            id={id}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "flex h-12 w-full rounded-lg border border-input bg-card px-4 py-3 text-base text-foreground shadow-sm transition-all duration-200",
              "placeholder:text-muted-foreground/60",
              "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
              "disabled:cursor-not-allowed disabled:opacity-50",
              icon && "pl-10",
              trailing && "pr-12",
              error && "border-destructive focus:border-destructive focus:ring-destructive/20",
              className,
            )}
            {...props}
          />

          {trailing && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</div>
          )}
        </div>

        {hint && !error && (
          <p id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" className="animate-fade-in text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  },
);

CustomInput.displayName = "CustomInput";

export { CustomInput };
export type { CustomInputProps };
