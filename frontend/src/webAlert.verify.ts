import assert from "node:assert/strict";

type AlertButton = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: (value?: string) => void;
};

/**
 * Mirrors installWebAlert's present(). Kept in step with src/webAlert.ts —
 * the shim is the app's only feedback channel on web, so a silent-wrong-action
 * regression there is invisible until a user hits it.
 */
function present(
  toasts: string[],
  confirmAnswer: boolean,
  title?: string,
  message?: string,
  buttons?: AlertButton[],
) {
  const body = [title, message].filter(Boolean).join("\n\n");
  const list = buttons && buttons.length ? buttons : undefined;

  if (!list) {
    toasts.push(body);
    return;
  }

  if (list.length > 1) {
    const cancel = list.find((b) => b.style === "cancel") || list[0];
    const action = list.find((b) => b !== cancel) || list[list.length - 1];
    if (confirmAnswer) action.onPress?.();
    else cancel.onPress?.();
    return;
  }
  const action = list[0];

  toasts.push(body);
  action?.onPress?.();
}

{
  const toasts: string[] = [];
  present(toasts, true, "Saved", "Attendance saved for 2 people.");
  assert.deepEqual(toasts, ["Saved\n\nAttendance saved for 2 people."]);
}

{
  const toasts: string[] = [];
  let fired = 0;
  present(toasts, true, "Done", "Report ready", [{ text: "OK", onPress: () => { fired += 1; } }]);
  assert.equal(toasts.length, 1);
  assert.equal(fired, 1);
}

{
  const toasts: string[] = [];
  let cancelled = 0;
  let acted = 0;
  present(toasts, true, "Delete?", "This cannot be undone", [
    { text: "Cancel", style: "cancel", onPress: () => { cancelled += 1; } },
    { text: "Delete", style: "destructive", onPress: () => { acted += 1; } },
  ]);
  assert.equal(acted, 1);
  assert.equal(cancelled, 0);
  assert.equal(toasts.length, 0);
}

{
  const toasts: string[] = [];
  let cancelled = 0;
  let acted = 0;
  present(toasts, false, "Delete?", "This cannot be undone", [
    { text: "Cancel", style: "cancel", onPress: () => { cancelled += 1; } },
    { text: "Delete", style: "destructive", onPress: () => { acted += 1; } },
  ]);
  assert.equal(acted, 0);
  assert.equal(cancelled, 1);
}

{
  const toasts: string[] = [];
  let no = 0;
  let yes = 0;
  present(toasts, false, "Overwrite?", undefined, [
    { text: "No", onPress: () => { no += 1; } },
    { text: "Yes", onPress: () => { yes += 1; } },
  ]);
  assert.equal(yes, 0, "declining must not fire the action");
  assert.equal(no, 1);
  assert.equal(toasts.length, 0, "a two-button alert must prompt, not toast");
}

console.log("webAlert.verify.ts OK");
