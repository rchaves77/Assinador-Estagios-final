import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body limit to handle PDF base64 uploads
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

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
    const from = process.env.SMTP_FROM || `"Sistema de Homologacao Odonto" <no-reply@unimeta.edu.br>`;

    if (!host || !user || !pass) {
      console.warn("SMTP credentials not configured, skipping real email send.");
      return res.json({
        success: false,
        warning: "SMTP_NOT_CONFIGURED",
        message: "As credenciais de SMTP nao estao configuradas no servidor (.env). O email real nao pôde ser enviado, mas os dados foram chancelados no banco de dados com sucesso!"
      });
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
        text: `Ola ${studentName},\n\nSeu Termo de Estagio de Odontologia foi assinado e chancelado eletronicamente pelo coordenador do curso!\n\nCódigo de Autenticidade (Protocolo): ${docId}\n\nSeu termo assinado e chancelado foi enviado em anexo.\n\nVocê pode consultar a validade juridica deste documento a qualquer momento acessando o link:\n${verificationUrl}\n\nAtenciosamente,\nCoordenacao de Odontologia Estacio Unimeta`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-top: 0;">Termo de Estagio Chancelado</h2>
            <p>Ola <strong>${studentName}</strong>,</p>
            <p>Seu Termo de Estagio de Odontologia foi assinado e chancelado eletronicamente pela Coordenacao do Curso.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #b45309; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Código de Autenticidade (Protocolo):</strong></p>
              <p style="margin: 5px 0 0 0; font-family: monospace; font-size: 16px; color: #b45309; font-weight: bold;">${docId}</p>
            </div>

            <p>O arquivo PDF contendo a certificacao eletronica, a assinatura eletronica do coordenador e o QR Code de autenticidade está <strong>anexado a este e-mail</strong>.</p>
            
            <p>Você e a instituicao concedente também podem verificar a validade juridica deste documento a qualquer momento clicando no botao abaixo:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" target="_blank" style="background-color: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Verificar Validade do Termo</a>
            </div>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
            <p style="font-size: 11px; color: #64748b; text-align: center; margin-bottom: 0;">
              Centro Universitario Estacio Unimeta • Sistema de Homologacao de Estágios de Odontologia
            </p>
          </div>
        `,
      };

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
