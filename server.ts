import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import { db } from "./src/db/index.ts";
import { coordinatorConfig, documents } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body limit to handle PDF base64 uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API router for coordinator configuration
  app.get("/api/config", async (req, res) => {
    try {
      const configRows = await db.select().from(coordinatorConfig).where(eq(coordinatorConfig.id, "coordinator"));
      if (configRows.length === 0) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(configRows[0]);
    } catch (error: any) {
      console.error("Failed to read coordinator config:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/config", async (req, res) => {
    const { name, title, institution, savedSignature, accessCode, signatureKey, email } = req.body;
    try {
      await db.insert(coordinatorConfig)
        .values({
          id: "coordinator",
          name,
          title,
          institution,
          savedSignature,
          accessCode,
          signatureKey,
          email
        })
        .onConflictDoUpdate({
          target: coordinatorConfig.id,
          set: {
            name,
            title,
            institution,
            savedSignature,
            accessCode,
            signatureKey,
            email
          }
        });
      res.json({ success: true, message: "Configuration saved successfully" });
    } catch (error: any) {
      console.error("Failed to save coordinator config:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // API router for internship documents
  app.get("/api/documents", async (req, res) => {
    try {
      const list = await db.select().from(documents);
      res.json(list);
    } catch (error: any) {
      console.error("Failed to list documents:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/documents/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const docRows = await db.select().from(documents).where(eq(documents.id, id.toUpperCase()));
      if (docRows.length === 0) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(docRows[0]);
    } catch (error: any) {
      console.error("Failed to get document:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/documents", async (req, res) => {
    const docData = req.body;
    try {
      await db.insert(documents)
        .values({
          id: docData.id,
          studentName: docData.studentName,
          studentRegistration: docData.studentRegistration,
          studentEmail: docData.studentEmail,
          studentPeriod: docData.studentPeriod,
          concedenteName: docData.concedenteName,
          internshipHours: Number(docData.internshipHours),
          internshipStartDate: docData.internshipStartDate,
          internshipEndDate: docData.internshipEndDate,
          fileName: docData.fileName,
          fileType: docData.fileType,
          fileUrl: docData.fileUrl,
          fileHash: docData.fileHash,
          createdAt: docData.createdAt,
          status: docData.status,
          reviewedAt: docData.reviewedAt,
          coordinatorFeedback: docData.coordinatorFeedback,
          coordinatorName: docData.coordinatorName,
          coordinatorSignatureText: docData.coordinatorSignatureText,
          signatureHash: docData.signatureHash,
          signaturePng: docData.signaturePng,
          signatureKey: docData.signatureKey
        })
        .onConflictDoUpdate({
          target: documents.id,
          set: {
            studentName: docData.studentName,
            studentRegistration: docData.studentRegistration,
            studentEmail: docData.studentEmail,
            studentPeriod: docData.studentPeriod,
            concedenteName: docData.concedenteName,
            internshipHours: Number(docData.internshipHours),
            internshipStartDate: docData.internshipStartDate,
            internshipEndDate: docData.internshipEndDate,
            fileName: docData.fileName,
            fileType: docData.fileType,
            fileUrl: docData.fileUrl,
            fileHash: docData.fileHash,
            status: docData.status,
            reviewedAt: docData.reviewedAt,
            coordinatorFeedback: docData.coordinatorFeedback,
            coordinatorName: docData.coordinatorName,
            coordinatorSignatureText: docData.coordinatorSignatureText,
            signatureHash: docData.signatureHash,
            signaturePng: docData.signaturePng,
            signatureKey: docData.signatureKey
          }
        });
      res.json({ success: true, message: "Document saved successfully" });
    } catch (error: any) {
      console.error("Failed to save document:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.put("/api/documents/:id", async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    try {
      await db.update(documents)
        .set({
          status: updateData.status,
          reviewedAt: updateData.reviewedAt,
          coordinatorFeedback: updateData.coordinatorFeedback,
          coordinatorName: updateData.coordinatorName,
          coordinatorSignatureText: updateData.coordinatorSignatureText,
          signatureHash: updateData.signatureHash,
          signaturePng: updateData.signaturePng,
          signatureKey: updateData.signatureKey
        })
        .where(eq(documents.id, id.toUpperCase()));
      res.json({ success: true, message: "Document updated successfully" });
    } catch (error: any) {
      console.error("Failed to update document:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await db.delete(documents).where(eq(documents.id, id.toUpperCase()));
      res.json({ success: true, message: "Document deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete document:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // API router for sending emails
  app.post("/api/send-email", async (req, res) => {
    const { to, studentName, docId, pdfBase64, verificationUrl } = req.body;

    if (!to) {
      return res.status(400).json({ error: "Destinatario 'to' e obrigatorio" });
    }

    // Check if SMTP is configured
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || `"Sistema de Homologacao" <no-reply@unimeta.edu.br>`;

    if (!host || !user || !pass) {
      console.warn("SMTP credentials not configured, skipping real email send.");
      return res.json({
        success: false,
        warning: "SMTP_NOT_CONFIGURED",
        message: "As credenciais de SMTP nao estao configuradas no servidor (.env). O email real nao pôde ser enviado, mas os dados foram chancelados no banco de dados com sucesso!"
      });
    }

    let coordinatorEmail = "";
    let logoInstitution = "Centro Universitário Estácio Unimeta";
    try {
      const configRows = await db.select().from(coordinatorConfig).where(eq(coordinatorConfig.id, "coordinator"));
      if (configRows.length > 0) {
        if (configRows[0].email) {
          coordinatorEmail = configRows[0].email;
        }
        if (configRows[0].institution) {
          logoInstitution = configRows[0].institution;
        }
      }
    } catch (e) {
      console.error("Failed to query coordinator email or institution for SMTP", e);
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(port || "587"),
        secure: port === "465", // true for 465, false for standard TLS/STARTTLS ports like 587
        auth: {
          user,
          pass,
        },
      });

      const mailOptions: any = {
        from,
        to,
        subject: `Termo de Estagio Chancelado - Protocolo ${docId}`,
        text: `Ola ${studentName},\n\nSeu Termo de Estagio foi assinado e chancelado eletronicamente pelo coordenador do curso!\n\nCódigo de Autenticidade (Protocolo): ${docId}\n\nSeu termo assinado e chancelado foi enviado em anexo.\n\nVocê pode consultar a validade juridica deste documento a qualquer momento acessando o link:\n${verificationUrl}\n\nAtenciosamente,\nCoordenacao de Estagio - ${logoInstitution}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-top: 0;">Termo de Estágio Chancelado</h2>
            <p>Olá <strong>${studentName}</strong>,</p>
            <p>Seu Termo de Estágio foi assinado e chancelado eletronicamente pela Coordenação do Curso.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #b45309; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Código de Autenticidade (Protocolo):</strong></p>
              <p style="margin: 5px 0 0 0; font-family: monospace; font-size: 16px; color: #b45309; font-weight: bold;">${docId}</p>
            </div>

            <p>O arquivo PDF contendo a certificação eletrônica, a assinatura eletrônica do coordenador e o QR Code de autenticidade está <strong>anexado a este e-mail</strong>.</p>
            
            <p>Você e a instituição concedente também podem verificar a validade jurídica deste documento a qualquer momento clicando no botão abaixo:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" target="_blank" style="background-color: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Verificar Validade do Termo</a>
            </div>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
            <p style="font-size: 11px; color: #64748b; text-align: center; margin-bottom: 0;">
              ${logoInstitution} • Sistema de Homologação de Estágios
            </p>
          </div>
        `,
      };

      if (coordinatorEmail) {
        mailOptions.replyTo = coordinatorEmail;
        mailOptions.cc = coordinatorEmail; // Send a carbon copy of the chancelled document to the professor/coordinator!
      }

      if (pdfBase64) {
        // base64 contains the data-URI prefix "data:application/pdf;base64,". Strip it for nodemailer attachment
        const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
        mailOptions.attachments = [
          {
            filename: `Termo_Estagio_Chancelado_${docId}.pdf`,
            content: cleanBase64,
            encoding: "base64"
          }
        ];
      }

      await transporter.sendMail(mailOptions);
      console.log(`Email successfully sent to ${to} for docId ${docId}`);
      return res.json({ success: true, message: "E-mail enviado com sucesso!" });

    } catch (error: any) {
      console.error("Failed to send email via nodemailer:", error);
      return res.status(500).json({ success: false, error: error.message || "Erro ao despachar e-mail via servidor" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
