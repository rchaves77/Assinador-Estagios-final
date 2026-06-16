/**
 * Generates a SHA-256 hash for an ArrayBuffer (e.g. file contents)
 */
export async function calculateSHA256(arrayBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compresses an image file (PNG/JPEG/etc) to a maximum size/quality JPEG string
 */
export function compressImage(file: File, maxWidth = 1200, maxDraftSize = 800000): Promise<{ base64: string, size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to create canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with 0.65 quality. That handles text beautifully and keeps size small!
        let quality = 0.65;
        let base64 = canvas.toDataURL("image/jpeg", quality);

        // Est. size in bytes
        let size = Math.round((base64.length - 814) * 0.75);

        // If still somehow over limit, try compressing further
        if (size > maxDraftSize) {
          quality = 0.4;
          base64 = canvas.toDataURL("image/jpeg", quality);
          size = Math.round((base64.length - 814) * 0.75);
        }

        resolve({ base64, size });
      };
      img.onerror = () => reject(new Error("Error loading image"));
    };
    reader.onerror = () => reject(new Error("Error reading file"));
  });
}

/**
 * Format a base64 string directly from any file (including small PDFs)
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

/**
 * Generates an audit signature hash by combining coordinator info and document hash
 */
export async function generateSignatureHash(
  documentHash: string,
  coordinatorName: string,
  timestamp: number
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${documentHash}:${coordinatorName}:${timestamp}:UNIMETA-ODONTO-SECURE`);
  return calculateSHA256(data.buffer);
}

/**
 * Quick short code generator (e.g. UNIMETA-E4D2)
 */
export function generateProtocolCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No confusing O/0, I/1
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `UNIMETA-${code}`;
}
