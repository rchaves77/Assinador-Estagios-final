import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { InternshipDocument } from "../types";
import { 
  ShieldCheck, ArrowLeft, Search, QrCode, Printer, 
  Clock, CheckSquare, Award, AlertTriangle, FileText, CheckCircle
} from "lucide-react";
import DocumentViewer from "./DocumentViewer";
import { resolveFileUrl, getOfflineDocuments } from "../utils/fileHelper";

export default function SignatureValidator() {
  const [searchCode, setSearchCode] = useState("");
  const [checkedDoc, setCheckedDoc] = useState<InternshipDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verifiedVia, setVerifiedVia] = useState<"protocol" | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string>("");

  // Monitor hash parameters on load to support direct QR codes links
  useEffect(() => {
    const handleUrlCheck = async () => {
      // Get protocol from window location hash or search query
      const params = new URLSearchParams(window.location.search);
      let protocolFromUrl = params.get("protocolo") || params.get("id");

      if (!protocolFromUrl) {
        // Fallback checks from standard URL hash patterns (e.g. #validador?protocolo=...)
        const hashStr = window.location.hash;
        if (hashStr && hashStr.includes("?")) {
          const hashParams = new URLSearchParams(hashStr.split("?")[1]);
          protocolFromUrl = hashParams.get("protocolo") || hashParams.get("id");
        }
      }

      if (protocolFromUrl) {
        setSearchCode(protocolFromUrl);
        await performSearch(protocolFromUrl);
      }
    };

    handleUrlCheck();

    // Listen to custom route changes inside app
    const handleCustomRoute = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail === "validador") {
        handleUrlCheck();
      }
    };
    window.addEventListener("route-change", handleCustomRoute);
    return () => window.removeEventListener("route-change", handleCustomRoute);
  }, []);

  const performSearch = async (protocol: string) => {
    if (!protocol.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setCheckedDoc(null);
    setVerifiedVia(null);
    setResolvedUrl("");

    const termCode = protocol.trim().toUpperCase();
    let docData: InternshipDocument | null = null;

    try {
      const docRef = doc(db, "documents", termCode);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        docData = docSnap.data() as InternshipDocument;
      }
    } catch (firestoreErr) {
      console.warn("Firestore search failed, looking up locally offline instead", firestoreErr);
    }

    // Lookup local offline storage as fallback if firestore returned empty or failed due to quota
    if (!docData) {
      const localDocs = getOfflineDocuments();
      const localFound = localDocs.find(d => d.id === termCode);
      if (localFound) {
        docData = localFound;
      }
    }

    try {
      if (docData) {
        if (docData.status === "APROVADO") {
          setCheckedDoc(docData);
          setVerifiedVia("protocol");
          try {
            const url = await resolveFileUrl(docData.id, docData.fileUrl);
            setResolvedUrl(url || docData.fileUrl);
          } catch (e) {
            console.error("Error resolving file in validator:", e);
            setResolvedUrl(docData.fileUrl);
          }
        } else {
          setErrorMsg("Este protocolo existe, mas o documento ainda está pendente de análise ou foi recusado pela coordenação.");
        }
      } else {
        setErrorMsg("Protocolo de chancela digital não encontrado. Verifique se o código está digitado corretamente.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro de conexão ao buscar validação.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchCode);
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate public deep validation link for QR Code
  // Using path query for max stability across container restarts
  const verificationUrl = `${window.location.origin}/?protocolo=${checkedDoc?.id}`;
  const qrCodeUrl = checkedDoc 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160 text-slate-800&data=${encodeURIComponent(verificationUrl)}`
    : "";

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8" id="signature-validator">
      
      {/* Search and upload triggers panel (Hidden on Print) */}
      <div className="print:hidden space-y-6">
        <div className="text-center">
          <span className="text-[10px] uppercase tracking-[0.25em] font-black text-odonto-gold">
            Auditoria Pública Segura
          </span>
          <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tighter text-odonto-navy leading-none">
            VALIDADOR DE CHANCELA DIGITAL
          </h1>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500 max-w-lg mx-auto leading-relaxed">
            Verifique eletronicamente a autenticidade jurídica de assinaturas emitidas pela coordenação de Odontologia do Centro Universitário Estácio Unimeta.
          </p>
        </div>

        {/* Option selectors: Protocol Search */}
        <div className="max-w-xl mx-auto">
          
          {/* Method 1: Protocol number */}
          <div className="bg-white rounded-none border-2 border-odonto-navy p-6 flex flex-col justify-between space-y-4 shadow-xl">
            <div>
              <h2 className="text-xs font-black text-odonto-navy flex items-center gap-1.5 uppercase tracking-wider mb-2">
                <Search className="w-4 h-4 text-odonto-sky" /> Chave de Protocolo do Termo
              </h2>
              <p className="text-xs text-slate-500 leading-normal">
                Insira o código de protocolo impresso na folha de validação ou no certificado (Ex: UNIMETA-E4D2) para resgatar o selo digital e a certidão de autenticidade.
              </p>
            </div>

            <form onSubmit={handleQuerySubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: UNIMETA-DF72"
                required
                value={searchCode}
                onChange={e => setSearchCode(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm border-2 border-slate-200 focus:border-odonto-navy bg-slate-50 focus:bg-white rounded-none font-bold text-slate-800 uppercase focus:outline-none focus:ring-1 focus:ring-odonto-navy"
              />
              <button
                type="submit"
                disabled={loading || !searchCode.trim()}
                className="bg-odonto-navy hover:bg-black text-white font-black text-xs uppercase tracking-widest px-6 py-2.5 rounded-none transition border-2 border-odonto-navy duration-200"
                id="btn-search-validator"
              >
                {loading ? "Validando..." : "Validar"}
              </button>
            </form>
          </div>

        </div>

        {/* Global Error Prompt */}
        {errorMsg && (
          <div className="bg-rose-50 border-2 border-rose-900 max-w-xl mx-auto p-5 flex items-start gap-3 shadow-md">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <span className="font-black text-xs block text-rose-950 uppercase tracking-widest">FALHA NA VERIFICAÇÃO</span>
              <p className="text-xs opacity-90 mt-1 font-medium text-rose-900">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Verification Certificate Panel (Prints nicely) */}
      {checkedDoc && (
        <div id="verified-certificate-panel" className="relative">
          
          {/* Back button and Print Action (Hidden on Print) */}
          <div className="print:hidden flex justify-between items-center mb-4">
            <button
              onClick={() => { setCheckedDoc(null); setVerifiedVia(null); setErrorMsg(null); }}
              className="text-xs text-odonto-navy hover:text-odonto-gold flex items-center gap-1 font-black uppercase tracking-wider"
            >
              <ArrowLeft className="w-4 h-4" /> Validar Outro Documento
            </button>

            <button
              onClick={handlePrint}
              className="bg-odonto-navy hover:bg-black text-white font-black text-xs uppercase tracking-widest px-5 py-3 rounded-none transition flex items-center gap-1.5 shadow"
              id="print-certificate-btn"
            >
              <Printer className="w-4 h-4 text-odonto-gold animate-pulse" /> Imprimir Chancela / Salvar PDF
            </button>
          </div>

          {/* Core Print Document Certificate Sheet */}
          <div 
            className="bg-white border-[12px] border-double border-odonto-navy p-6 md:p-12 rounded-none shadow-2xl font-sans max-w-3xl mx-auto space-y-8 relative overflow-hidden"
            style={{ minHeight: "297mm" }} // classic A4 height ratio hint
          >
            {/* Visual background watermark layout */}
            <div className="absolute inset-0 bg-contain bg-center opacity-[0.03] pointer-events-none select-none bg-[url('https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=watermark')]" />

            {/* Certificate Header Stamp */}
            <div className="text-center border-b-[3px] border-odonto-navy pb-6">
              <span className="text-odonto-navy font-black uppercase tracking-widest text-[12px] block">
                CENTRO UNIVERSITÁRIO ESTÁCIO UNIMETA
              </span>
              <span className="text-[10px] text-odonto-gold font-extrabold block tracking-widest uppercase mt-0.5">
                AUTORIDADE ACADÊMICA DA COORDENAÇÃO DE ODONTOLOGIA
              </span>
              <h2 className="text-xl md:text-2xl font-serif font-black text-odonto-navy border-none mt-3 uppercase tracking-tight">
                Certidão de Autenticidade Digital
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                Pelo presente instrumento, certifica-se e chancela-se eletronicamente a validade jurídica do seguinte termo de estágio.
              </p>
            </div>

            {/* Validation Notification Banner (Hidden on Print) */}
            <div className="print:hidden bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl p-4 flex items-start gap-2.5">
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5 animate-bounce" />
              <div>
                <span className="font-extrabold block text-emerald-950">
                  {verifiedVia === "file" 
                    ? "ARQUIVO INTEGRALMENTE CONVENIADO E AUTÊNTICO MATCH!" 
                    : "PROTOCOLO VALIDADO COM SUCESSO!"
                  }
                </span>
                <p className="opacity-90 leading-relaxed text-[11px] mt-0.5">
                  Este documento de autenticação foi chancelado eletronicamente e encontra-se registrado de forma imutável nos registros do Centro Universitário Estácio Unimeta.
                </p>
              </div>
            </div>

            {/* 1. Aluno & Document details */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-extrabold text-odonto-navy border-b border-slate-100 pb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-odonto-gold" /> 1. Dados Básicos do Estagiário
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Estagiário de Odontologia</span>
                  <span className="text-odonto-navy font-extrabold text-sm">{checkedDoc.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Nº de Matrícula Acadêmica</span>
                  <span className="text-odonto-navy font-mono font-bold">{checkedDoc.studentRegistration}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Período Letivo do Estágio</span>
                  <span className="text-slate-700 font-semibold">{checkedDoc.studentPeriod}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Contato eletrônico fornecido</span>
                  <span className="text-slate-700 font-semibold">{checkedDoc.studentEmail}</span>
                </div>
              </div>
            </div>

            {/* 2. Estágio details */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-extrabold text-odonto-navy border-b border-slate-100 pb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-odonto-sky" /> 2. Informações Gerais do Estágio
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs">
                {checkedDoc.concedenteName ? (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Unidade Clínica/Instituição Concedente</span>
                    <span className="text-slate-800 font-bold">{checkedDoc.concedenteName}</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Modalidade do Estágio</span>
                    <span className="text-slate-800 font-bold">Estágio Clínico Supervisionado / Prática Acadêmica Individual</span>
                  </div>
                )}

                {checkedDoc.internshipHours ? (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Carga Horária Total</span>
                    <span className="text-slate-800 font-bold">{checkedDoc.internshipHours} Horas Semanais/Totais</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Carga Horária Regular</span>
                    <span className="text-slate-800 font-bold">Conforme carga horária regulamentar do Centro Universitário</span>
                  </div>
                )}

                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Status de Homologação</span>
                  <span className="text-emerald-700 font-extrabold uppercase tracking-wide flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 inline shrink-0" /> Chancelado eletronicamente pela Coordenação de Odontologia Estácio Unimeta
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Hashes cryptography */}
            <div className="bg-slate-50 rounded-none p-4 border border-slate-200 space-y-3">
              <h3 className="text-[10px] font-bold text-odonto-gold uppercase tracking-wider">
                3. Integridade Criptográfica do Registro (Metadados Técnicos)
              </h3>
              
              <div className="space-y-1.5 font-mono text-[9px] text-slate-600">
                <div className="flex flex-col md:flex-row md:items-center gap-1 justify-between bg-white px-2.5 py-1.5 rounded border border-slate-100">
                  <span className="font-bold shrink-0">HASH DE ORIGEM DO DOCUMENTO (SHA-256):</span>
                  <span className="text-slate-850 font-bold select-all truncate max-w-sm md:max-w-md" title={checkedDoc.fileHash}>
                    {checkedDoc.fileHash}
                  </span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-1 justify-between bg-white px-2.5 py-1.5 rounded border border-slate-100">
                  <span className="font-bold shrink-0">CHAVE ASSENTADA DE CHANCELA DIGITAL (MD5-SHA):</span>
                  <span className="text-blue-900 font-bold select-all truncate max-w-md" title={checkedDoc.signatureHash}>
                    {checkedDoc.signatureHash}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[8px] text-slate-400 font-sans pt-1">
                  <span>Nome do arquivo anexo original: <strong>{checkedDoc.fileName}</strong></span>
                  <span>Formato: <strong>{checkedDoc.fileType}</strong></span>
                </div>
              </div>
            </div>

            {/* 4. Coordinator official Signature seals and QR Verification */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-dashed border-slate-200">
              
              {/* QR Code and verification address (Left on print) */}
              <div className="md:col-span-1 flex flex-col items-center text-center space-y-2">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Verificação Mobile QR
                </span>
                {qrCodeUrl ? (
                  <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                    <img
                      src={qrCodeUrl}
                      alt="QR Verification Link"
                      className="w-28 h-28 mix-blend-multiply"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <QrCode className="w-24 h-24 text-slate-300" />
                )}
                <span className="text-[8px] font-mono text-slate-400 select-all leading-none">
                  Selo: {checkedDoc.id}
                </span>
              </div>

              {/* Electronic validation seal containing letters and numbers */}
              <div className="md:col-span-2 flex flex-col items-center md:items-end md:justify-center text-center md:text-right space-y-3">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Selo Eletrônico de Autenticidade
                </span>

                <div className="bg-slate-50 border-2 border-odonto-navy p-3 text-center rounded-none shadow-sm min-w-[210px] md:text-right md:items-end flex flex-col justify-center">
                  <span className="text-[8px] font-extrabold text-slate-400 tracking-widest block uppercase">Chave de Chancela</span>
                  <span className="text-sm font-mono font-black text-blue-900 tracking-wider uppercase block select-all">
                    {checkedDoc.signatureKey || checkedDoc.id || "-"}
                  </span>
                  <div className="border-t border-dashed border-slate-300 mt-1.5 pt-1.5 text-[8px] text-emerald-800 font-black uppercase tracking-widest flex items-center justify-end gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" /> ASSINATURA ELETRÔNICA
                  </div>
                </div>

                <div className="space-y-1 text-slate-700 font-sans text-xs">
                  <p className="font-extrabold tracking-wide text-slate-900 border-b border-dashed border-slate-200 pb-1">
                    {checkedDoc.coordinatorName || "Coordenador de Odontologia"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Coordenador de Odontologia – Estácio Unimeta
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono flex items-center justify-end gap-1 font-semibold">
                    <Clock className="w-3 h-3 text-slate-400 inline" /> Chancelado em: {new Date(checkedDoc.reviewedAt!).toLocaleDateString("pt-BR")} às {new Date(checkedDoc.reviewedAt!).toLocaleTimeString("pt-BR")}
                  </p>
                </div>
              </div>

            </div>

            {/* Official seal footer details */}
            <div className="border-t border-blue-950 pt-4 text-center">
              <p className="text-[9px] font-bold text-slate-400 leading-normal">
                Centro Universitário Estácio Unimeta, Rio Branco - AC.
              </p>
              <p className="text-[8px] text-slate-400 opacity-75 leading-none mt-1 font-medium select-all">
                Endereço de Auditoria Pública: {window.location.origin}/#validador
              </p>
            </div>

          </div>

          {/* Visualizador do Termo Chancelado com pdfSigner embutido */}
          {resolvedUrl && (
            <div className="bg-white rounded-none border-2 border-odonto-navy p-6 shadow-xl space-y-4 print:hidden">
              <div className="border-b-2 border-slate-100 pb-3">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <FileText className="w-5 h-5 text-odonto-sky" /> Termo com Folha de Homologação Embutida
                </h2>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-1">
                  Visualize abaixo o PDF original contendo a chancela eletrônica e a folha de autenticação adicionada.
                </p>
              </div>

              <div className="min-h-[500px] h-[650px] overflow-hidden">
                <DocumentViewer
                  fileUrl={resolvedUrl}
                  fileType={checkedDoc.fileType || "application/pdf"}
                  fileName={checkedDoc.fileName}
                  docData={checkedDoc}
                />
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
