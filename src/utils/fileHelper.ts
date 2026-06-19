import { db } from "../firebase";
import { collection, doc, setDoc, getDocs, deleteDoc } from "firebase/firestore";
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

  // 2. Fetch from Firestore chunks subcollection
  try {
    const chunksColl = collection(db, "documents", docId, "chunks");
    const querySnap = await getDocs(chunksColl);
    if (!querySnap.empty) {
      const docs = querySnap.docs;
      // Sort chunks numerically (id: "0", "1", "2" etc)
      docs.sort((a, b) => parseInt(a.id) - parseInt(b.id));
      const base64Parts = docs.map(d => d.data().data as string);
      const assembledBase64 = base64Parts.join("");

      if (assembledBase64.startsWith("data:application/pdf;base64,")) {
        // Cache locally for instant consecutive visits
        await saveFile(docId, assembledBase64);
        return assembledBase64;
      }
    }
  } catch (error) {
    console.error("Error loading PDF chunks from Firestore:", error);
  }

  // 3. Last resort fallback
  return firestoreFileUrl;
}

export async function saveFileToChunks(docId: string, base64: string): Promise<void> {
  const CHUNK_SIZE = 750000; // 750KB base64 chunk size (safely under 1MB document limit)
  const totalLength = base64.length;
  let index = 0;
  
  const promises = [];
  for (let offset = 0; offset < totalLength; offset += CHUNK_SIZE) {
    const chunkData = base64.substring(offset, offset + CHUNK_SIZE);
    const chunkDocRef = doc(db, "documents", docId, "chunks", index.toString());
    promises.push(setDoc(chunkDocRef, { data: chunkData }));
    index++;
  }
  
  await Promise.all(promises);
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

  // 3. Delete main document from Firestore
  try {
    const docRef = doc(db, "documents", docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting document from Firestore:", error);
  }

  // 3. Delete chunks subcollection from Firestore
  try {
    const chunksColl = collection(db, "documents", docId, "chunks");
    const querySnap = await getDocs(chunksColl);
    const deletePromises = querySnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error deleting document chunks from Firestore:", error);
  }
}
