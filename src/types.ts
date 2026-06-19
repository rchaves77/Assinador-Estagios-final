export enum DocumentStatus {
  PENDING = "PENDENTE",
  APPROVED = "APROVADO",
  REJECTED = "REJEITADO"
}

export interface InternshipDocument {
  id: string; // protocol code (e.g., UNIMETA-DF72)
  studentName: string;
  studentRegistration: string; // matrícula
  studentEmail: string;
  studentPeriod: string; // período (ex: 5º período)
  concedenteName: string; // empresa/clínica
  internshipHours: number; // carga horária do estágio
  internshipStartDate: string;
  internshipEndDate: string;
  fileName: string;
  fileType: string;
  fileUrl: string; // Base64 string of the PDF/image
  fileHash: string; // SHA-256 hash for digital integrity verification
  createdAt: number;
  status: DocumentStatus;
  
  // Coordinator action
  reviewedAt?: number;
  coordinatorFeedback?: string;
  coordinatorName?: string;
  coordinatorSignatureText?: string; // Electronic signature certificate text
  signatureHash?: string; // Digital seal hash linking coordinator + fileHash
  signaturePng?: string; // Base64 signature sketch drawn by coordinator (deprecated optional fallback)
  signatureKey?: string; // Electronic signature key (letters and numbers)
}

export interface CoordinatorConfig {
  name: string;
  title: string; // Ex: Coordenador de Odontologia
  institution: string; // Centro Universitário Estácio Unimeta
  savedSignature?: string; // Base64 drawing (deprecated optional fallback)
  accessCode: string; // Security code of coordinator
  signatureKey?: string; // Electronic signature key (letters and numbers)
  email?: string; // Coordinator's email address
}
