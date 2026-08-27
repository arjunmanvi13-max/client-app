import { useCallback, useRef, useState } from "react";

/**
 * Prevents a mutation handler from running concurrently with itself.
 *
 * A `disabled` prop driven by state is not enough: the second tap can land
 * before React re-renders, which on a payment or approval screen means the
 * action is submitted twice. The ref flips synchronously, so it holds.
 *
 * Returns `submitting` for the disabled prop and `run` to wrap the handler.
 */
export function useSubmitGuard() {
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setSubmitting(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, []);

  return { submitting, run };
}
