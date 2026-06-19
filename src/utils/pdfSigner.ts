import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { InternshipDocument } from "../types";

// Conversão rápida de Base64 para Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const parts = base64.split(";base64,");
  const raw = parts[1] || parts[0];
  const cleanRaw = raw.replace(/[^A-Za-z0-9+/=]/g, "");
  const binaryString = atob(cleanRaw);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Conversão de Uint8Array para Base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Carrega o PDF original, chancela com o carimbo de rodapé na primeira página
 * e anexa uma folha de homologação oficial no final contendo todos os metadados acadêmicos jurídicos.
 */
export async function generateSignedPdf(originalBase64: string, docData: InternshipDocument): Promise<string> {
  try {
    const originalBytes = base64ToUint8Array(originalBase64);
    const pdfDoc = await PDFDocument.load(originalBytes);

    // Carrega fontes padrões
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

    const pages = pdfDoc.getPages();
    const verifUrl = `${window.location.origin}/?protocolo=${docData.id}#validador`;
    const sealKey = docData.signatureKey || "ODONTO-SIG-CHANCE";

    // 1. CARIMBO DE SEGURANÇA NA PRIMEIRA PÁGINA (MICRO-CHANCELA)
    const firstPage = pages[0];
    if (firstPage) {
      const { width: pW } = firstPage.getSize();
      // Desenha barra discreta
      firstPage.drawText(
        `CHANCELA ELETRÔNICA ESTÁCIO UNIMETA: Doc chancelado com a Chave: ${sealKey} - Verificação em: ${window.location.origin}/?protocolo=${docData.id}`,
        {
          x: 25,
          y: 12,
          size: 6.5,
          font: fontBold,
          color: rgb(0.04, 0.18, 0.42), // azul escuro
        }
      );
    }

    // 2. ADICIONA NOVA PÁGINA DE CERTIFICAÇÃO (TERMO DE EXPEDIÇÃO DIGITAL)
    const lastPageSize = pages[pages.length - 1]?.getSize() || { width: 595, height: 842 };
    const width = lastPageSize.width;
    const height = lastPageSize.height;

    const certPage = pdfDoc.addPage([width, height]);

    // Paleta de CORES
    const colorNavy = rgb(0.0, 0.18, 0.42); // Estácio Navy (#002F6C)
    const colorGold = rgb(0.77, 0.66, 0.50); // Odonto Gold (#C5A880)
    const colorCharcoal = rgb(0.18, 0.24, 0.35); // Cinza texto
    const colorBgBox = rgb(0.96, 0.97, 0.99); // Fundo sutil

    // Desenha borda elegante da página (Moldura dupla)
    certPage.drawRectangle({
      x: 18,
      y: 18,
      width: width - 36,
      height: height - 36,
      borderColor: colorNavy,
      borderWidth: 1.5,
    });
    certPage.drawRectangle({
      x: 22,
      y: 22,
      width: width - 44,
      height: height - 44,
      borderColor: colorGold,
      borderWidth: 0.75,
    });

    // CABEÇALHO DO CERTIFICADO
    let currentY = height - 60;

    certPage.drawText("CENTRO UNIVERSITÁRIO ESTÁCIO UNIMETA", {
      x: 50,
      y: currentY,
      size: 15,
      font: fontBold,
      color: colorNavy,
    });
    currentY -= 15;

    certPage.drawText("CERTIFICADO DIGITAL DE HOMOLOGAÇÃO DE ESTÁGIO DE ODONTOLOGIA", {
      x: 50,
      y: currentY,
      size: 8.5,
      font: fontBold,
      color: colorGold,
    });
    currentY -= 20;

    // Linha divisória
    certPage.drawLine({
      start: { x: 50, y: currentY },
      end: { x: width - 50, y: currentY },
      color: colorNavy,
      thickness: 1,
    });
    currentY -= 25;

    // TEXTO EXPLICATIVO
    const introText =
      "Certificamos para fins acadêmicos e comprobatórios que o Termo de Compromisso de Estágio (TCE) " +
      "descrito abaixo foi submetido à análise de conformidade pedagógica e chancelado eletronicamente " +
      "pela coordenação oficial do curso de Odontologia, usufruindo de plena autenticidade digital.";
    
    // Simplificado wrapping de texto básico
    certPage.drawText(introText.substring(0, 84), { x: 50, y: currentY, size: 9, font: fontRegular, color: colorCharcoal });
    currentY -= 12;
    certPage.drawText(introText.substring(84, 185), { x: 50, y: currentY, size: 9, font: fontRegular, color: colorCharcoal });
    currentY -= 12;
    certPage.drawText(introText.substring(185), { x: 50, y: currentY, size: 9, font: fontRegular, color: colorCharcoal });
    currentY -= 25;

    // TABELA DE METADADOS (REQUADRO CINZA)
    certPage.drawRectangle({
      x: 50,
      y: currentY - 145,
      width: width - 100,
      height: 155,
      color: colorBgBox,
      borderColor: colorNavy,
      borderWidth: 0.5,
    });

    let tabY = currentY - 18;
    const drawRow = (label: string, value: string) => {
      certPage.drawText(label, { x: 65, y: tabY, size: 8, font: fontBold, color: colorNavy });
      certPage.drawText(value, { x: 190, y: tabY, size: 8, font: fontRegular, color: colorCharcoal });
      tabY -= 15;
    };

    drawRow("PROTOCOLO DE EXPEDIÇÃO:", docData.id);
    drawRow("NOME DO ACADÊMICO:", docData.studentName.toUpperCase());
    drawRow("Nº DE MATRÍCULA:", docData.studentRegistration);
    drawRow("PERÍODO DO ALUNO:", docData.studentPeriod);
    drawRow("CONCEDENTE (ESTÁGIO):", docData.concedenteName.toUpperCase());
    drawRow("CARGA HORÁRIA TOTAL:", `${docData.internshipHours} HORAS`);
    drawRow("VIGÊNCIA ACADÊMICA:", `${docData.internshipStartDate} a ${docData.internshipEndDate}`);
    drawRow("STATUS DA EXPEDIÇÃO:", "CHANCELADO E HOMOLOGADO");
    drawRow("REGISTRO DE ARQUIVO:", docData.fileName);

    currentY -= 160;

    // BLOCO DE ASSINATURA ELETRÔNICA (DIREITA) E QR CODE (ESQUERDA)
    // Tenta embutir o QR Code do validador dinamicamente de forma assíncrona
    let qrImageEmbedded = false;
    try {
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifUrl)}`;
      const response = await fetch(qrImageUrl);
      if (response.ok) {
        const qrBytes = await response.arrayBuffer();
        const embeddedImage = await pdfDoc.embedPng(qrBytes);
        
        certPage.drawImage(embeddedImage, {
          x: 50,
          y: currentY - 110,
          width: 100,
          height: 100,
        });
        qrImageEmbedded = true;
      }
    } catch (e) {
      console.warn("Could not download visual QR code, fallback to border container", e);
    }

    if (!qrImageEmbedded) {
      // Desenha caixa substituta de QR code elegante
      certPage.drawRectangle({
        x: 50,
        y: currentY - 110,
        width: 100,
        height: 100,
        color: rgb(0.95, 0.95, 0.95),
        borderColor: colorGold,
        borderWidth: 1.5,
      });
      certPage.drawText("VALIDAÇÃO ONLINE", { x: 55, y: currentY - 55, size: 7.5, font: fontBold, color: colorNavy });
      certPage.drawText("UNIMETA PORTAL", { x: 57, y: currentY - 68, size: 6.5, font: fontRegular, color: colorCharcoal });
    }

    // Selo Eletrônico de Chancelamento (Lado Direito)
    const signX = 200;
    certPage.drawRectangle({
      x: signX,
      y: currentY - 65,
      width: width - signX - 50,
      height: 55,
      borderColor: colorNavy,
      borderWidth: 1,
      color: rgb(0.98, 0.98, 1.0),
    });

    certPage.drawText("ASSINATURA ELETRÔNICA CERTIFICADA", {
      x: signX + 10,
      y: currentY - 20,
      size: 7,
      font: fontBold,
      color: colorNavy,
    });

    certPage.drawText(`CHAVE: ${sealKey}`, {
      x: signX + 10,
      y: currentY - 35,
      size: 9.5,
      font: fontMono,
      color: rgb(0.1, 0.4, 0.2), // verde de chancela
    });

    certPage.drawText(`Chancelado por: ${docData.coordinatorName}`, {
      x: signX + 10,
      y: currentY - 48,
      size: 7,
      font: fontRegular,
      color: colorCharcoal,
    });

    certPage.drawText(`Assinado em: ${new Date(docData.reviewedAt || Date.now()).toLocaleString("pt-BR")}`, {
      x: signX + 10,
      y: currentY - 58,
      size: 6.5,
      font: fontRegular,
      color: colorCharcoal,
    });

    // Hash criptográfico de auditoria
    currentY -= 130;
    certPage.drawText("COMPROMISSO DE INTEGRIDADE (HASH CRIPTOGRÁFICO DO DOCUMENTO ORIGEM):", {
      x: 50,
      y: currentY,
      size: 6.5,
      font: fontBold,
      color: colorNavy,
    });
    currentY -= 9;
    certPage.drawText(docData.fileHash, {
      x: 50,
      y: currentY,
      size: 7.5,
      font: fontMono,
      color: colorCharcoal,
    });

    currentY -= 14;
    certPage.drawText("CHAVE DE AUDITORIA PÚBLICA DO SISTEMA DA EXPEDIÇÃO:", {
      x: 50,
      y: currentY,
      size: 6.5,
      font: fontBold,
      color: colorNavy,
    });
    currentY -= 9;
    certPage.drawText(docData.signatureHash || "- ", {
      x: 50,
      y: currentY,
      size: 7.5,
      font: fontMono,
      color: colorCharcoal,
    });

    // Rodapé de segurança
    certPage.drawLine({
      start: { x: 50, y: 45 },
      end: { x: width - 50, y: 45 },
      color: colorGold,
      thickness: 0.75,
    });
    
    certPage.drawText("Centro Universitário Estácio Unimeta - Portaria de Credenciamento MEC nº 1.458 - Rio Branco, AC.", {
      x: 50,
      y: 32,
      size: 6.5,
      font: fontRegular,
      color: colorCharcoal,
    });

    certPage.drawText(`Auditoria oficial e verificação do documento em: ${window.location.origin}/?protocolo=${docData.id}`, {
      x: 50,
      y: 22,
      size: 6.5,
      font: fontRegular,
      color: colorNavy,
    });

    // Salva o PDF modificado
    const pdfBytes = await pdfDoc.save();
    return `data:application/pdf;base64,${uint8ArrayToBase64(pdfBytes)}`;
  } catch (error) {
    console.error("Critical error in pdfSigner:", error);
    // Em caso de erro sério, retorna a base64 original intacta
    return originalBase64;
  }
}
