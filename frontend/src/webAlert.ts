import { Alert, Platform } from "react-native";

type AlertButton = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: (value?: string) => void;
};

let installed = false;

export function installWebAlert() {
  if (installed || Platform.OS !== "web" || typeof window === "undefined") return;
  installed = true;

  const isProblem = (text: string) => /error|fail|invalid|required|denied|not allowed|cannot|could not/i.test(text);

  const toast = (body: string) => {
    document.querySelectorAll('[data-testid="web-alert-toast"]').forEach((n) => n.remove());
    const el = document.createElement("div");
    el.textContent = body;
    el.setAttribute("data-testid", "web-alert-toast");
    el.setAttribute("role", "alert");
    el.setAttribute("aria-live", "assertive");
    el.style.cssText = [
      "position:fixed", "left:50%", "bottom:32px", "transform:translateX(-50%)",
      "max-width:min(520px,90vw)", "z-index:99999", "padding:12px 18px",
      "border-radius:10px", `background:${isProblem(body) ? "#B91C1C" : "#0F172A"}`, "color:#fff",
      "font:600 14px/1.4 system-ui,sans-serif", "box-shadow:0 8px 24px rgba(15,23,42,0.28)",
      "white-space:pre-wrap", "text-align:center",
    ].join(";");
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 4000);
  };

  const present = (title?: string, message?: string, buttons?: AlertButton[]) => {
    const body = [title, message].filter(Boolean).join("\n\n");
    const list = buttons && buttons.length ? buttons : undefined;

    if (!list) {
      toast(body);
      return;
    }

    if (list.length > 1) {
      const cancel = list.find((b) => b.style === "cancel") || list[0];
      const action = list.find((b) => b !== cancel) || list[list.length - 1];
      if (window.confirm(body)) action.onPress?.();
      else cancel.onPress?.();
      return;
    }
    const action = list[0];

    toast(body);
    action?.onPress?.();
  };

  (Alert as unknown as { alert: typeof present }).alert = present;
}
