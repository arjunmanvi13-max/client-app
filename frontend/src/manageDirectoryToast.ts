const STORAGE_KEY = "manage_directory_toast";

export function setManageDirectoryToast(message: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, message);
}

export function consumeManageDirectoryToast(): string | null {
  if (typeof window === "undefined") return null;
  const message = window.sessionStorage.getItem(STORAGE_KEY);
  if (message) window.sessionStorage.removeItem(STORAGE_KEY);
  return message;
}
