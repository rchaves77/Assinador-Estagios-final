import { pgTable, text, integer, bigint } from "drizzle-orm/pg-core";

// Table to store the coordinator's profile and passcode config
export const coordinatorConfig = pgTable("coordinator_config", {
  id: text("id").primaryKey(), // Will always be 'coordinator'
  name: text("name").notNull(),
  title: text("title").notNull(),
  institution: text("institution").notNull(),
  savedSignature: text("saved_signature"), // Base64 signature
  accessCode: text("access_code").notNull(),
  signatureKey: text("signature_key")
});

// Table to store the documents and verification data
export const documents = pgTable("documents", {
  id: text("id").primaryKey(), // Protocol code (e.g., UNIMETA-DF72)
  studentName: text("student_name").notNull(),
  studentRegistration: text("student_registration").notNull(),
  studentEmail: text("student_email").notNull(),
  studentPeriod: text("student_period").notNull(),
  concedenteName: text("concedente_name").notNull(),
  internshipHours: integer("internship_hours").notNull(),
  internshipStartDate: text("internship_start_date").notNull(),
  internshipEndDate: text("internship_end_date").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileUrl: text("file_url").notNull(), // Base64 document content
  fileHash: text("file_hash").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(), // standard milliseconds epoch timestamp
  status: text("status").notNull(), // 'PENDENTE', 'APROVADO', 'REJEITADO'
  
  // Coordinator action fields (optional/nullable)
  reviewedAt: bigint("reviewed_at", { mode: "number" }),
  coordinatorFeedback: text("coordinator_feedback"),
  coordinatorName: text("coordinator_name"),
  coordinatorSignatureText: text("coordinator_signature_text"),
  signatureHash: text("signature_hash"),
  signaturePng: text("signature_png"),
  signatureKey: text("signature_key")
});
