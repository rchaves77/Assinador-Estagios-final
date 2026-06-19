import { getFile, saveFile, deleteFile } from "./indexedDB";
import { InternshipDocument } from "../types";

export function getOfflineDocuments(): InternshipDocument[] {
  try {
    const raw = localStorage.getItem("offline_documents");
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Error reading offline documents:", error);
    return [];
  }
}

export function saveOfflineDocument(docItem: InternshipDocument): void {
  try {
    const docs = getOfflineDocuments();
    const existingIndex = docs.findIndex(d => d.id === docItem.id);
    if (existingIndex > -1) {
      docs[existingIndex] = docItem;
    } else {
      docs.push(docItem);
    }
    localStorage.setItem("offline_documents", JSON.stringify(docs));
  } catch (error) {
    console.error("Error saving offline document:", error);
  }
}

export function deleteOfflineDocument(docId: string): void {
  try {
    const docs = getOfflineDocuments();
    const updated = docs.filter(d => d.id !== docId);
    localStorage.setItem("offline_documents", JSON.stringify(updated));
  } catch (error) {
    console.error("Error deleting offline document:", error);
  }
}

export async function resolveFileUrl(docId: string, firestoreFileUrl: string): Promise<string> {
  // 1. Try local IndexedDB cache first
  const localFile = await getFile(docId);
  if (localFile && localFile.startsWith("data:application/pdf;base64,")) {
    // Make sure it's original content (placeholder PDF is 912 chars)
    if (localFile.length > 1000) {
      return localFile;
    }
  }

  // 2. Fetch from PostgreSQL database via our Express API
  try {
    const res = await fetch(`/api/documents/${docId}`);
    if (res.ok) {
      const docItem = await res.json();
      if (docItem && docItem.fileUrl && docItem.fileUrl.startsWith("data:application/pdf;base64,")) {
        // Cache locally for instant consecutive visits
        await saveFile(docId, docItem.fileUrl);
        return docItem.fileUrl;
      }
    }
  } catch (error) {
    console.error("Error loading PDF from PostgreSQL API:", error);
  }

  // 3. Last resort fallback
  return firestoreFileUrl;
}

export async function saveFileToChunks(docId: string, base64: string): Promise<void> {
  // PostgreSQL handles arbitrarily large text fields (up to 1GB), so we don't need chunking.
  // The backend API handles the full save and storage at once!
  return Promise.resolve();
}

export function getPlaceholderPdfBase64(): string {
  // Safe, valid minimal 1-page PDF base64 string
  return "data:application/pdf;base64,JVBERi0xLjUKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCjIgMCBvYmoKICA8PCAvVHlwZSAvUGFnZXMKICAgICAvS2lkcyBbIDMgMCBSIF0KICAgICAvQ291bnQgMQogID4+CmVuZG9iagozIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2UKICAgICAvUGFyZW50IDIgMCBSCiAgICAgL01lZGlhQm94IFsgMCAwIDU5NSA4NDIgXQogICAgIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDQgMCBSID4+ID4+CiAgICAgL0NvbnRlbnRzIDUgMCBSCiAgPj4KZW5kb2JqCjQgMCBvYmoKICA8PCAvVHlwZSAvRm9udAogICAgIC9TdWJ0eXBlIC9UeXBlMQogICAgIC9CYXNlRm9udCAvSGVsdmV0aWNhCiAgPj4KZW5kb2JqCjUgMCBvYmoKICA8PCAvTGVuZ3RoIDcwID4+CnN0cmVhbQpCVAovRjEgMTIgVGYKMTAwIDcwMCBUZCAoVGVybW8gZGUgRXN0YWdpbykgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTQ4IDAwMDAwIG4gCjAwMDAwMDAyODIgMDAwMDAgbiAKMDAwMDAwMDI4MiAwMDAwMCBuIAowMDAwMDAwMzgxIDAwMDAwIG4gCnRyYWlsZXIKICA8PCAvU2l6ZSA2CiAgICAgL1Sb290IDEgMCBSCiAgPj4Kc3RhcnR4cmVmCjQ4NQolJUVPRg==";
}

export async function deleteFileFromDbAndCache(docId: string): Promise<void> {
  // 1. Delete local file from IndexedDB cache
  try {
    await deleteFile(docId);
  } catch (error) {
    console.error("Error deleting file from IndexedDB cache:", error);
  }

  // 2. Clear from local offline document list
  try {
    deleteOfflineDocument(docId);
  } catch (error) {
    console.error("Error clearing offline document list:", error);
  }

  // 3. Delete document from backend database (which does SQL DELETE)
  try {
    const res = await fetch(`/api/documents/${docId}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      console.error("Failed to delete document via PostgreSQL API");
    }
  } catch (error) {
    console.error("Error deleting document from PostgreSQL database:", error);
  }
}
