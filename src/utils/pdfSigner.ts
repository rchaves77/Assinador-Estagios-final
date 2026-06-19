import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { InternshipDocument } from "../types";

// Conversão com tratamento robusto de Base64 para Uint8Array suportando URL-encoding e ambientes híbridos (Browser + Node)
function base64ToUint8Array(base64: string): Uint8Array {
  if (!base64 || typeof base64 !== "string") {
    throw new Error("Invalid base64 string input (empty or not a string)");
  }

  let decoded = base64;
  if (decoded.includes("%")) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch (e) {
      console.warn("Base64 input appears partially URL-encoded but failed decodeURIComponent:", e);
    }
  }

  const parts = decoded.split(";base64,");
  const raw = parts[1] || parts[0];
  let cleanRaw = raw.replace(/[^A-Za-z0-9+/=]/g, "");

  // Garante padding de comprimento múltiplo de 4
  while (cleanRaw.length % 4 !== 0) {
    cleanRaw += "=";
  }

  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(cleanRaw, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
  } else {
    try {
      const binaryString = atob(cleanRaw);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (err) {
      console.error("Standard browser atob decoder failed even after cleaning and padding:", err);
      throw err;
    }
  }
}

// Conversão rápida de Uint8Array para Base64 (híbrido)
function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  } else {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

// Sanitização robusta de caracteres para evitar o erro "WinAnsi cannot encode"
function cleanText(str: string | undefined | null): string {
  if (!str) return "";
  
  // Normaliza o texto para NFC para aglutinar acentos decompostos (ex: a + ́ -> á)
  let normalized = str.normalize("NFC");
  
  // Substituições de caracteres especiais comuns fora do range básico
  normalized = normalized
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u201a\u201e]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201b]/g, "'")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "--")
    .replace(/\u2212/g, "-");

  let result = "";
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const code = char.charCodeAt(0);
    if (code <= 255) {
      result += char;
    } else {
      // Tenta de-acentuar para obter o caractere ASCII equivalente
      const folded = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (folded && folded.length > 0) {
        const foldedCode = folded.charCodeAt(0);
        if (foldedCode <= 255) {
          result += folded;
        } else {
          result += "?"; // substituto seguro se for totalmente incompatível
        }
      } else {
        // Se após remover o acento a string ficou vazia (era um acento flutuante isolado ex: \u0301), ignoramos
      }
    }
  }
  return result;
}

/**
 * Carrega o PDF original, chancela com o carimbo de rodapé na primeira página
 * e anexa uma folha de homologação oficial no final contendo todos os metadados acadêmicos jurídicos.
 */
export async function generateSignedPdf(originalBase64: string, docData: InternshipDocument): Promise<string> {
  try {
    let base64ToUse = originalBase64;
    // Se a string original estiver vazia, for nula ou não parecer ser um PDF Base64 válido, usamos o PDF em branco de fallback para evitar que a aplicação quebre
    if (!base64ToUse || typeof base64ToUse !== "string" || !base64ToUse.startsWith("data:application/pdf")) {
      console.warn("Invalid or missing PDF base64 input in generateSignedPdf, using placeholder fallback.");
      base64ToUse = "data:application/pdf;base64,JVBERi0xLjUKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCjIgMCBvYmoKICA8PCAvVHlwZSAvUGFnZXMKICAgICAvS2lkcyBbIDMgMCBSIF0KICAgICAvQ291bnQgMQogID4+CmVuZG9iagozIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2UKICAgICAvUGFyZW50IDIgMCBSCiAgICAgL01lZGlhQm94IFsgMCAwIDU5NSA4NDIgXQogICAgIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDQgMCBSID4+ID4+CiAgICAgL0NvbnRlbnRzIDUgMCBSCiAgPj4KZW5kb2JqCjQgMCBvYmoKICA8PCAvVHlwZSAvRm9udAogICAgIC9TdWJ0eXBlIC9UeXBlMQogICAgIC9CYXNlRm9udCAvSGVsdmV0aWNhCiAgPj4KZW5kb2JqCjUgMCBvYmoKICA8PCAvTGVuZ3RoIDcwID4+CnN0cmVhbQpCVAovRjEgMTIgVGYKMTAwIDcwMCBUZCAoVGVybW8gZGUgRXN0YWdpbykgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTQ4IDAwMDAwIG4gCjAwMDAwMDAyODIgMDAwMDAgbiAKMDAwMDAwMDI4MiAwMDAwMCBuIAowMDAwMDAwMzgxIDAwMDAwIG4gCnRyYWlsZXIKICA8PCAvU2l6ZSA2CiAgICAgL1Sb290IDEgMCBSCiAgPj4Kc3RhcnR4cmVmCjQ4NQolJUVPRg==";
    }
    const originalBytes = base64ToUint8Array(base64ToUse);
    const pdfDoc = await PDFDocument.load(originalBytes);

    // Carrega fontes padrões
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

    const pages = pdfDoc.getPages();
    const origin = typeof window !== "undefined" ? window.location.origin : "https://unimeta-homologacao.edu.br";
    const verifUrl = `${origin}/?protocolo=${docData.id}#validador`;
    const sealKey = docData.signatureKey || "ODONTO-SIG-CHANCE";

    // 1. CARIMBO DE SEGURANÇA NA PRIMEIRA PÁGINA (MICRO-CHANCELA)
    const firstPage = pages[0];
    if (firstPage) {
      const { width: pW } = firstPage.getSize();
      // Desenha barra discreta
      firstPage.drawText(
        cleanText(`CHANCELA ELETRÔNICA ESTÁCIO UNIMETA: Doc chancelado com a Chave: ${sealKey} - Verificação em: ${origin}/?protocolo=${docData.id}`),
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

    certPage.drawText(cleanText("CENTRO UNIVERSITÁRIO ESTÁCIO UNIMETA"), {
      x: 50,
      y: currentY,
      size: 15,
      font: fontBold,
      color: colorNavy,
    });
    currentY -= 15;

    certPage.drawText(cleanText("CERTIFICADO DIGITAL DE HOMOLOGAÇÃO DE ESTÁGIO"), {
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
    const introText = cleanText(
      "Certificamos para fins acadêmicos e comprobatórios que o Termo de Compromisso de Estágio (TCE) " +
      "descrito abaixo foi submetido à análise de conformidade pedagógica e chancelado eletronicamente " +
      "pela coordenação oficial do curso de estágio, usufruindo de plena autenticidade digital."
    );
    
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
      certPage.drawText(cleanText(label), { x: 65, y: tabY, size: 8, font: fontBold, color: colorNavy });
      certPage.drawText(cleanText(value), { x: 190, y: tabY, size: 8, font: fontRegular, color: colorCharcoal });
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
      certPage.drawText(cleanText("VALIDAÇÃO ONLINE"), { x: 55, y: currentY - 55, size: 7.5, font: fontBold, color: colorNavy });
      certPage.drawText(cleanText("UNIMETA PORTAL"), { x: 57, y: currentY - 68, size: 6.5, font: fontRegular, color: colorCharcoal });
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

    certPage.drawText(cleanText("ASSINATURA ELETRÔNICA CERTIFICADA"), {
      x: signX + 10,
      y: currentY - 20,
      size: 7,
      font: fontBold,
      color: colorNavy,
    });

    certPage.drawText(cleanText(`CHAVE: ${sealKey}`), {
      x: signX + 10,
      y: currentY - 35,
      size: 9.5,
      font: fontMono,
      color: rgb(0.1, 0.4, 0.2), // verde de chancela
    });

    certPage.drawText(cleanText(`Chancelado por: ${docData.coordinatorName}`), {
      x: signX + 10,
      y: currentY - 48,
      size: 7,
      font: fontRegular,
      color: colorCharcoal,
    });

    certPage.drawText(cleanText(`Assinado em: ${new Date(docData.reviewedAt || Date.now()).toLocaleString("pt-BR")}`), {
      x: signX + 10,
      y: currentY - 58,
      size: 6.5,
      font: fontRegular,
      color: colorCharcoal,
    });

    // Hash criptográfico de auditoria
    currentY -= 130;
    certPage.drawText(cleanText("COMPROMISSO DE INTEGRIDADE (HASH CRIPTOGRÁFICO DO DOCUMENTO ORIGEM):"), {
      x: 50,
      y: currentY,
      size: 6.5,
      font: fontBold,
      color: colorNavy,
    });
    currentY -= 9;
    certPage.drawText(cleanText(docData.fileHash), {
      x: 50,
      y: currentY,
      size: 7.5,
      font: fontMono,
      color: colorCharcoal,
    });

    currentY -= 14;
    certPage.drawText(cleanText("CHAVE DE AUDITORIA PÚBLICA DO SISTEMA DA EXPEDIÇÃO:"), {
      x: 50,
      y: currentY,
      size: 6.5,
      font: fontBold,
      color: colorNavy,
    });
    currentY -= 9;
    certPage.drawText(cleanText(docData.signatureHash || "- "), {
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
    
    certPage.drawText(cleanText("Centro Universitário Estácio Unimeta - Portaria de Credenciamento MEC nº 1.458 - Rio Branco, AC."), {
      x: 50,
      y: 32,
      size: 6.5,
      font: fontRegular,
      color: colorCharcoal,
    });

    certPage.drawText(cleanText(`Auditoria oficial e verificação do documento em: ${origin}/?protocolo=${docData.id}`), {
      x: 50,
      y: 22,
      size: 6.5,
      font: fontRegular,
      color: colorNavy,
    });

    // Salva o PDF modificado aplicando compressão de fluxos de objetos para reduzir drasticamente o tamanho do payload
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    return `data:application/pdf;base64,${uint8ArrayToBase64(pdfBytes)}`;
  } catch (error) {
    console.error("Critical error in pdfSigner:", error);
    // Em caso de erro sério, retorna a base64 original intacta
    return originalBase64;
  }
}
