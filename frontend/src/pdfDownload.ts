import { Platform } from "react-native";
import { api } from "./auth";

/**
 * Fetch a PDF through the configured axios instance so the auth interceptor
 * supplies the token. Call sites previously read the token straight out of
 * localStorage, which duplicated the storage key and sent no header at all off
 * the web platform.
 */
export async function fetchPdfBlob(path: string): Promise<Blob> {
  const { data } = await api.get(path, { responseType: "blob" });
  return data as Blob;
}

/** Open a generated PDF in a new tab (web) and revoke the object URL after. */
export async function openPdf(path: string): Promise<void> {
  const blob = await fetchPdfBlob(path);
  if (Platform.OS !== "web" || typeof window === "undefined") {
    throw new Error("PDF preview is only available on the web app");
  }
  const url = window.URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    window.URL.revokeObjectURL(url);
    throw new Error("Pop-up blocked — allow pop-ups to view the PDF");
  }
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

/** Trigger a browser download for a generated PDF. */
export async function downloadPdf(path: string, filename: string): Promise<void> {
  const blob = await fetchPdfBlob(path);
  if (Platform.OS !== "web" || typeof window === "undefined") {
    throw new Error("PDF download is only available on the web app");
  }
  const url = window.URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
