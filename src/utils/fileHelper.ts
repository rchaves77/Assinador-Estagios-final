import { db } from "../firebase";
import { collection, doc, setDoc, getDocs } from "firebase/firestore";
import { getFile, saveFile } from "./indexedDB";

export async function resolveFileUrl(docId: string, firestoreFileUrl: string): Promise<string> {
  // 1. Try local IndexedDB cache first
  const localFile = await getFile(docId);
  if (localFile && localFile.startsWith("data:application/pdf;base64,")) {
    // Make sure it's original content (> 5000 chars)
    if (localFile.length > 5000) {
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
  return "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCjIgMCBvYmoKICA8PCAvVHlwZSAvPagesCiAgICAgL0tpZHMgWyAzIDAgUiBdCiAgICAgL0NvdW50IDEKICA+PgplbmRvYmoKMyAwIG9iagogIDw8IC9UeXBlIC9QYWdlCiAgICAgL1BhcmVudCAyIDAgUgogICAgIC9NZWRpYUJveCBbIDAgMCA1OTUgODQyIF0KICAgICAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PgogICAgIC9Db250ZW50cyA1IDAgUgogID4+CmVuZG9iago0IDAgb2JqCiAgPDwgL1R5cGUgL0ZvbnQKICAgICAvU3VidHlwZSAvVHlwZTEKICAgICAvQmFzZUZvbnQgL0hlbHZldGljYQogID4+CmVuZG9iago1IDAgb2JqCiAgPDwgL0xlbmd0aCA3MCA+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKERvY3VtZW50byBIb21vbG9nYWRvIC0gRXN0YWNpbyBVbmltZXRhKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDcwIDAwMDAwIG4gCjAwMDAwMDAxNDggMDAwMDAgbiAKMDAwMDAwMDI4MiAwMDAwMCBuIAowMDAwMDAwMzgxIDAwMDAwIG4gCnRyYWlsZXIKICA8PCAvU2l6ZSA2CiAgICAgL1Jvb3QgMSAwIFIKICA+PgpzdGFydHhyZWYKNTAxCiUlRU9G";
}
