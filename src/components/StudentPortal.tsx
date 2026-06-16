import React, { useState, useRef, DragEvent } from "react";
import { db } from "../firebase";
import { collection, doc, setDoc, query, where, getDocs } from "firebase/firestore";
import { DocumentStatus, InternshipDocument } from "../types";
import { calculateSHA256, compressImage, fileToBase64, generateProtocolCode } from "../utils/crypto";
import { FileText, Upload, CheckCircle2, Search, ArrowRight, AlertTriangle, ShieldCheck, Mail, Clock, Calendar, Building2, User } from "lucide-react";

export default function StudentPortal() {
  const [activeTab, setActiveTab] = useState<"submit" | "track">("submit");

  // Submission Form State
  const [formData, setFormData] = useState({
    studentName: "",
    studentRegistration: "",
    studentEmail: "",
    studentPeriod: "1º Período",
    concedenteName: "",
    internshipHours: 120,
    internshipStartDate: "",
    internshipEndDate: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedFileData, setProcessedFileData] = useState<{ base64: string; hash: string; type: string; name: string } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [successProtocol, setSuccessProtocol] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tracking State
  const [trackQuery, setTrackQuery] = useState("");
  const [trackingResults, setTrackingResults] = useState<InternshipDocument[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const periods = [
    "1º Período", "2º Período", "3º Período", "4º Período", "5º Período",
    "6º Período", "7º Período", "8º Período", "9º Período", "10º Período"
  ];

  // Drag and Drop Handlers
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setErrorMsg(null);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processSelectedFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (file) {
      await processSelectedFile(file);
    }
  };

  const processSelectedFile = async (file: File) => {
    setSelectedFile(file);
    setLoading(true);
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      if (!isPdf) {
        throw new Error("Formato inválido! Envie apenas arquivos em formato PDF (.pdf).");
      }

      // Calculate SHA256 Hash of original file for digital security
      const arrayBuffer = await file.arrayBuffer();
      const hash = await calculateSHA256(arrayBuffer);

      // Load PDF directly as base64
      const base64String = await fileToBase64(file);
      
      // Firestore has a 1MB database document size limit. Check if the PDF fits.
      const estimatedSize = Math.round((base64String.length - 814) * 0.75);
      if (estimatedSize > 900000) {
        throw new Error("O arquivo PDF é muito grande (limite de 1MB). Por favor, comprima seu arquivo PDF antes de enviá-lo.");
      }

      setProcessedFileData({
        base64: base64String,
        hash,
        type: "application/pdf",
        name: file.name
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao processar o arquivo.");
      setSelectedFile(null);
      setProcessedFileData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processedFileData) {
      setErrorMsg("Por favor, anexe o documento do termo de estágio.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const id = generateProtocolCode();
      const docRef = doc(db, "documents", id);

      const newDoc: InternshipDocument = {
        id,
        studentName: formData.studentName.trim(),
        studentRegistration: formData.studentRegistration.trim(),
        studentEmail: formData.studentEmail.trim(),
        studentPeriod: formData.studentPeriod,
        concedenteName: formData.concedenteName.trim(),
        internshipHours: Number(formData.internshipHours),
        internshipStartDate: formData.internshipStartDate,
        internshipEndDate: formData.internshipEndDate,
        fileName: processedFileData.name,
        fileType: processedFileData.type,
        fileUrl: processedFileData.base64,
        fileHash: processedFileData.hash,
        createdAt: Date.now(),
        status: DocumentStatus.PENDING
      };

      await setDoc(docRef, newDoc);

      setSuccessProtocol(id);
      // Reset form
      setFormData({
        studentName: "",
        studentRegistration: "",
        studentEmail: "",
        studentPeriod: "1º Período",
        concedenteName: "",
        internshipHours: 120,
        internshipStartDate: "",
        internshipEndDate: ""
      });
      setSelectedFile(null);
      setProcessedFileData(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erro ao salvar no banco de dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleTrackSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackQuery.trim()) return;

    setTrackLoading(true);
    setSearched(true);
    setErrorMsg(null);

    try {
      const qMatricula = query(
        collection(db, "documents"),
        where("studentRegistration", "==", trackQuery.trim())
      );
      
      const qProtocolo = query(
        collection(db, "documents"),
        where("id", "==", trackQuery.trim().toUpperCase())
      );

      const [resMatricula, resProtocolo] = await Promise.all([
        getDocs(qMatricula),
        getDocs(qProtocolo)
      ]);

      const list: InternshipDocument[] = [];
      resMatricula.forEach(docSnap => {
        list.push(docSnap.data() as InternshipDocument);
      });
      resProtocolo.forEach(docSnap => {
        if (!list.some(item => item.id === docSnap.id)) {
          list.push(docSnap.data() as InternshipDocument);
        }
      });

      // Sort by newest
      list.sort((a, b) => b.createdAt - a.createdAt);
      setTrackingResults(list);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erro ao buscar histórico. Verifique sua conexão.");
    } finally {
      setTrackLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4" id="portal-do-aluno">
      {/* Title & Header */}
      <div className="text-center mb-10">
        <span className="text-[10px] uppercase tracking-[0.25em] font-black text-odonto-gold">
          Secretaria Acadêmica de Odontologia
        </span>
        <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tighter text-odonto-navy leading-none">
          REGISTRO DE ESTÁGIOS <span className="text-odonto-sky">ESTÁCIO UNIMETA</span>
        </h1>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500 max-w-lg mx-auto">
          Envie os termos de estágio clínico e acompanhe a análise e chancela digital da coordenação de forma simplificada.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-2 border-odonto-navy mb-10 max-w-md mx-auto bg-slate-150 p-1 rounded-none">
        <button
          onClick={() => { setActiveTab("submit"); setSuccessProtocol(null); }}
          className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider rounded-none transition-all ${
            activeTab === "submit"
              ? "bg-odonto-navy text-white shadow-sm border-b-2 border-odonto-gold"
              : "text-slate-500 hover:text-odonto-navy"
          }`}
          id="student-tab-submit"
        >
          Enviar Termo
        </button>
        <button
          onClick={() => { setActiveTab("track"); setErrorMsg(null); }}
          className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider rounded-none transition-all ${
            activeTab === "track"
              ? "bg-odonto-navy text-white shadow-sm border-b-2 border-odonto-gold"
              : "text-slate-500 hover:text-odonto-navy"
          }`}
          id="student-tab-track"
        >
          Acompanhar Envio
        </button>
      </div>

      {activeTab === "submit" ? (
        <div className="bg-white rounded-none border-2 border-odonto-navy shadow-xl overflow-hidden" id="tab-content-submit">
          {successProtocol ? (
            <div className="p-8 text-center" id="submission-success-panel">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Termo Enviado para Análise!</h2>
              <p className="mt-2 text-slate-500 text-sm max-w-sm mx-auto">
                Seu documento foi integrado e gerou uma identidade criptográfica. Guarde o protocolo para rastreamento:
              </p>
              
              <div className="my-6 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 max-w-xs mx-auto">
                <span className="text-xs text-slate-400 font-mono block mb-1 uppercase tracking-wider">Protocolo de Rastreamento</span>
                <span className="text-2xl font-mono font-bold text-blue-900 tracking-wider select-all">
                  {successProtocol}
                </span>
              </div>

              <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl p-4 text-left max-w-lg mx-auto mb-6">
                <p className="font-semibold flex items-center gap-1.5 mb-1 text-blue-900">
                  <ShieldCheck className="w-4 h-4 shrink-0" /> Próximos Passos
                </p>
                <ol className="list-decimal list-inside space-y-1 mt-1 text-blue-800/90 pl-1">
                  <li>O coordenador avalia todo o documento diretamente na plataforma.</li>
                  <li>Sendo aprovado, a coordenação chanca digitalmente o documento.</li>
                  <li>Você pesquisa pela sua <strong>Matrícula</strong> na ala de Acompanhamento para baixar a chancela e o validador.</li>
                </ol>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => {
                    setActiveTab("track");
                    setTrackQuery(successProtocol);
                    setSuccessProtocol(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl py-3 px-6 transition flex items-center gap-1.5"
                  id="btn-go-track"
                >
                  Consultar Protocolo <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSuccessProtocol(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl py-3 px-6 transition"
                  id="btn-new-send"
                >
                  Enviar Outro
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8" id="student-upload-form">
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-sm flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Atenção</span>
                    {errorMsg}
                  </div>
                </div>
              )}

              {/* Informações Básicas do Aluno */}
              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 border-b-2 border-odonto-navy pb-2">
                  1. Identificação do Aluno
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Nome Completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: João da Silva Santos"
                        value={formData.studentName}
                        onChange={e => setFormData({ ...formData, studentName: e.target.value })}
                        className="w-full pl-9 pr-4 py-2.5 text-sm border-2 border-slate-200 focus:border-odonto-navy bg-slate-50 focus:bg-white rounded-none font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-odonto-navy"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Nº de Matrícula</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: 202302345678"
                        value={formData.studentRegistration}
                        onChange={e => setFormData({ ...formData, studentRegistration: e.target.value })}
                        className="w-full pl-9 pr-4 py-2.5 text-sm border-2 border-slate-200 focus:border-odonto-navy bg-slate-50 focus:bg-white rounded-none font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-odonto-navy"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">E-mail para Notifição</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        placeholder="Ex: joao@aluno.estacio.br"
                        value={formData.studentEmail}
                        onChange={e => setFormData({ ...formData, studentEmail: e.target.value })}
                        className="w-full pl-9 pr-4 py-2.5 text-sm border-2 border-slate-200 focus:border-odonto-navy bg-slate-50 focus:bg-white rounded-none font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-odonto-navy"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Período Letivo Atual</label>
                    <select
                      value={formData.studentPeriod}
                      onChange={e => setFormData({ ...formData, studentPeriod: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 focus:border-odonto-navy bg-slate-50 focus:bg-white rounded-none font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-odonto-navy"
                    >
                      {periods.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Upload de Arquivos */}
              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 border-b-2 border-odonto-navy pb-2">
                  2. Anexar Termo de Estágio (Apenas PDF)
                </h3>
                
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed p-8 text-center cursor-pointer transition rounded-none ${
                    dragActive
                      ? "border-odonto-sky bg-odonto-lightsky/30"
                      : "border-slate-400 hover:border-odonto-navy bg-slate-50 hover:bg-slate-100/50"
                  }`}
                  id="dropzone-file"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="input-file-submit"
                  />
                  
                  {processedFileData ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-12 h-12 text-odonto-sky animate-pulse" />
                      <p className="text-sm font-semibold text-slate-800 truncate max-w-sm">
                        {selectedFile?.name}
                      </p>
                      <span className="text-xs bg-odonto-lightsky text-odonto-navy px-2.5 py-0.5 rounded-none font-mono font-bold">
                        {(processedFileData.base64.length * 0.75 / 1024).toFixed(1)} KB
                      </span>
                      <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mt-1 justify-center animate-bounce">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" /> Integridade Criptográfica registrada com sucesso!
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono select-all">
                        SHA256: {processedFileData.hash.slice(0, 16)}...{processedFileData.hash.slice(-16)}
                      </span>
                      <span className="text-xs text-odonto-navy hover:text-odonto-gold underline font-bold mt-3">
                        Substituir arquivo do Termo
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="p-3 bg-white shadow rounded-none text-odonto-sky border border-slate-200 mb-3">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        Arraste seu arquivo aqui ou toque para navegar
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Formato aceito: Apenas PDF (Máx. 1MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Botão Enviar */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  ⚠️ Conexão Criptografada SSL Ativa. Seu arquivo fica blindado no banco do Centro Universitário.
                </div>
                <button
                  type="submit"
                  disabled={loading || !processedFileData}
                  className="w-full sm:w-auto bg-odonto-navy hover:bg-black text-white font-black py-4 px-8 text-xs uppercase tracking-widest rounded-none border-2 border-odonto-navy disabled:opacity-50 transition active:scale-95 shadow-md shrink-0"
                  id="btn-submit-internship"
                >
                  {loading ? "Processando..." : "Submeter para Assinatura"}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* TRACKING TAB */
        <div className="space-y-6" id="tab-content-track">
          <div className="bg-white rounded-none border-2 border-odonto-navy p-6 md:p-8 shadow-xl">
            <h2 className="text-xs uppercase tracking-widest font-black text-odonto-gold mb-2">Consulta de Termo de Estágio</h2>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6">
              Consulte todos os seus termos digitando seu Dígito de Matrícula ou um Código de Protocolo específico.
            </p>

            <form onSubmit={handleTrackSearch} className="flex gap-2 max-w-lg mb-4">
              <input
                type="text"
                placeholder="Matrícula/Protocolo (Ex: 202302345678)"
                value={trackQuery}
                onChange={e => setTrackQuery(e.target.value)}
                className="flex-1 px-4 py-2 text-sm border-2 border-slate-200 focus:border-odonto-navy bg-slate-50 focus:bg-white rounded-none font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-odonto-navy"
              />
              <button
                type="submit"
                disabled={trackLoading || !trackQuery.trim()}
                className="bg-odonto-navy hover:bg-black text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-none disabled:opacity-50 transition flex items-center gap-1.5"
                id="btn-search-track"
              >
                {trackLoading ? "Buscando..." : "Buscar"} <Search className="w-4 h-4" />
              </button>
            </form>

            {/* Error Message */}
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs font-semibold">
                {errorMsg}
              </div>
            )}
          </div>

          {trackLoading && (
            <div className="text-center py-12" id="tracking-loading-spinner">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-950 mx-auto"></div>
              <p className="text-xs text-slate-400 mt-2 font-medium">Buscando envios no banco Estácio...</p>
            </div>
          )}

          {/* Results List */}
          {searched && !trackLoading && (
            <div className="space-y-4" id="tracking-results-container">
              {trackingResults.length === 0 ? (
                <div className="bg-slate-100 rounded-xl p-8 text-center text-slate-500 border border-slate-200">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">Nenhum termo encontrado</p>
                  <p className="text-xs mt-1">
                    Não encontramos envios para o termo pesquisado. Certifique-se de digitar a matrícula exatamente igual à digitada no momento do envio.
                  </p>
                </div>
              ) : (
                trackingResults.map((docItem) => (
                  <div
                    key={docItem.id}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 relative overflow-hidden"
                  >
                    {/* Status accent bar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                        docItem.status === DocumentStatus.APPROVED
                          ? "bg-emerald-500"
                          : docItem.status === DocumentStatus.REJECTED
                          ? "bg-rose-500"
                          : "bg-amber-400"
                      }`}
                    ></div>

                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-400">
                            {docItem.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              docItem.status === DocumentStatus.APPROVED
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : docItem.status === DocumentStatus.REJECTED
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {docItem.status}
                          </span>
                        </div>
                        <h3 className="text-md font-extrabold text-odonto-navy mt-1">
                          Termo de Estágio de Odontologia (.pdf)
                        </h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
                          Estagiário: {docItem.studentName} ({docItem.studentRegistration})
                        </p>
                      </div>

                      <div className="text-right text-xs text-slate-400">
                        <span>Submetido em: </span>
                        <span className="font-extrabold text-slate-700">
                          {new Date(docItem.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-none text-xs font-semibold border border-slate-200">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-black">Período Letivo</span>
                        <span className="text-odonto-navy">{docItem.studentPeriod}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-black">E-mail de Notificação</span>
                        <span className="text-odonto-navy breakdown-all">{docItem.studentEmail}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-black">Código de Autenticidade</span>
                        <span className="text-odonto-gold font-mono">{docItem.id}</span>
                      </div>
                    </div>

                    {/* Feedback from Coordinator if rejected */}
                    {docItem.status === DocumentStatus.REJECTED && docItem.coordinatorFeedback && (
                      <div className="bg-rose-50 border border-rose-100 text-rose-900 rounded-xl p-4 text-xs">
                        <span className="font-bold block text-rose-950 mb-1">Motivo da Rejeição:</span>
                        <p className="opacity-90">{docItem.coordinatorFeedback}</p>
                      </div>
                    )}

                    {/* Seal certificates if approved */}
                    {docItem.status === DocumentStatus.APPROVED && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" /> Chancelado Eletronicamente!
                          </span>
                          <p className="text-[10px] text-emerald-800 leading-relaxed max-w-md">
                            Chancela digital de autenticidade assinada pelo coordenador de Odontologia <strong>{docItem.coordinatorName}</strong> baseada no Hash de Arquivo original.
                          </p>
                          <div className="text-[9px] font-mono text-emerald-700 select-all bg-emerald-100/50 p-1 rounded">
                            Chave Hash: {docItem.signatureHash}
                          </div>
                        </div>

                        {/* Public Link to Certificado */}
                        <a
                          href={`#validador`}
                          onClick={() => {
                            // Let parents scroll or switch window hash
                            window.location.hash = "validador";
                            // Dispatch custom event to app to sync routes
                            window.dispatchEvent(new CustomEvent("route-change", { detail: "validador" }));
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3.5 rounded-lg transition shrink-0 flex items-center gap-1 shadow-sm"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Baixar Certificado/Validar
                        </a>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
