import { useEffect, useRef, type MutableRefObject } from "react";

type NavigationLike = {
  addListener?: (event: string, callback: (e: { preventDefault: () => void; data: { action: unknown } }) => void) => () => void;
  dispatch?: (action: unknown) => void;
};

/**
 * Blocks stack back/navigation when a form is dirty.
 * Uses `beforeRemove` instead of `usePreventRemove`, which requires PreventRemoveContext
 * that is not always available in Expo Router web/static layouts.
 */
export function useDirtyLeaveGuard(
  enabled: boolean,
  isDirty: boolean,
  skipRef: MutableRefObject<boolean>,
  navigation: NavigationLike,
  onBlocked: (continueLeave: () => void) => void,
) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigation?.addListener !== "function") return;

    return navigation.addListener("beforeRemove", (e) => {
      if (skipRef.current || !isDirtyRef.current) return;
      e.preventDefault();
      onBlocked(() => {
        skipRef.current = true;
        navigation.dispatch?.(e.data.action);
      });
    });
  }, [enabled, navigation, onBlocked, skipRef]);
}
