import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, collection, query, getDocs } from "firebase/firestore";
import { DocumentStatus, InternshipDocument, CoordinatorConfig } from "../types";
import { generateSignatureHash, fileToBase64 } from "../utils/crypto";
import DocumentViewer from "./DocumentViewer";
import { resolveFileUrl, deleteFileFromDbAndCache, getOfflineDocuments, saveOfflineDocument } from "../utils/fileHelper";
import { saveFile } from "../utils/indexedDB";
import { generateSignedPdf } from "../utils/pdfSigner";
import { 
  KeyRound, ShieldCheck, PenTool, CheckCircle2, XCircle, 
  Settings2, Eye, Compass, LogOut, Check, ChevronRight, 
  Trash2, FileCheck, CircleSlash, RefreshCw, Star, Info, Upload
} from "lucide-react";

export default function CoordinatorDashboard() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<CoordinatorConfig | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // Onboarding Setup Form
  const [setupForm, setSetupForm] = useState({
    name: "",
    title: "Coordenador(a) de Curso de Odontologia",
    institution: "Centro Universitário Estácio Unimeta",
    accessCode: ""
  });

  // Edit Settings states for electronic signature key
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editSignatureKey, setEditSignatureKey] = useState("");

  // Sync settings inputs when config loads
  useEffect(() => {
    if (config) {
      setEditName(config.name);
      setEditTitle(config.title);
      setEditSignatureKey(config.signatureKey || "");
    }
  }, [config]);

  // Main Dashboard states
  const [documents, setDocuments] = useState<InternshipDocument[]>([]);
  const [filter, setFilter] = useState<DocumentStatus | "TODOS">("TODOS");
  const [selectedDoc, setSelectedDoc] = useState<InternshipDocument | null>(null);
  const [resolvedFileUrl, setResolvedFileUrl] = useState<string>("");
  const [rejectionFeedback, setRejectionFeedback] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Hook to resolve documents from IndexedDB if they were over 1MB
  useEffect(() => {
    async function loadWithIndexedDB() {
      if (selectedDoc) {
        try {
          const url = await resolveFileUrl(selectedDoc.id, selectedDoc.fileUrl);
          setResolvedFileUrl(url || selectedDoc.fileUrl);
        } catch (error) {
          console.error("Error resolving file URL", error);
          setResolvedFileUrl(selectedDoc.fileUrl);
        }
      } else {
        setResolvedFileUrl("");
      }
    }
    loadWithIndexedDB();
  }, [selectedDoc?.id, selectedDoc?.fileUrl]);

  // Signature Canvas state
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Settings pane
  const [showSettings, setShowSettings] = useState(false);

  // Check coordinator profile existence on Mount
  useEffect(() => {
    fetchCoordinatorConfig();
  }, []);

  const fetchCoordinatorConfig = async () => {
    setLoading(true);
    try {
      const configDoc = await getDoc(doc(db, "config", "coordinator"));
      if (configDoc.exists()) {
        const loadedData = configDoc.data() as CoordinatorConfig;
        if (!loadedData.signatureKey) {
          const generatedKey = "ODONTO-SIG-" + Math.random().toString(36).substring(2, 8).toUpperCase();
          const migratedData = { ...loadedData, signatureKey: generatedKey };
          await updateDoc(doc(db, "config", "coordinator"), { signatureKey: generatedKey });
          setConfig(migratedData);
        } else {
          setConfig(loadedData);
        }
      }
    } catch (err) {
      console.error("Error reading coordinator profile", err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const docList: InternshipDocument[] = [];
      try {
        const querySnapshot = await getDocs(collection(db, "documents"));
        querySnapshot.forEach(snap => {
          docList.push(snap.data() as InternshipDocument);
        });
      } catch (firestoreErr) {
        console.warn("Could not fetch Firestore documents, loading offline database", firestoreErr);
      }

      // Merge and deduplicate offline documents
      const offlineDocs = getOfflineDocuments();
      offlineDocs.forEach(offlineDoc => {
        if (!docList.some(item => item.id === offlineDoc.id)) {
          docList.push(offlineDoc);
        }
      });

      // Sort oldest to newest for pending review queue
      docList.sort((a, b) => b.createdAt - a.createdAt);
      setDocuments(docList);
    } catch (err) {
      console.error("Erro ao carregar documentos", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadDocuments();
    }
  }, [isAuthenticated]);

  // Passcode verification
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!config) return;

    if (passcodeInput.trim() === config.accessCode) {
      setIsAuthenticated(true);
      setPasscodeInput("");
    } else {
      setLoginError("Código de acesso incorreto. Verifique com cuidado.");
    }
  };

  // Onboarding submit
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupForm.name || !setupForm.accessCode) {
      alert("Preencha todos os campos e o código de acesso de segurança.");
      return;
    }

    setLoading(true);
    try {
      const randomKey = "ODONTO-SIG-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      const newConfig: CoordinatorConfig = {
        name: setupForm.name.trim(),
        title: setupForm.title.trim(),
        institution: setupForm.institution.trim(),
        accessCode: setupForm.accessCode.trim(),
        signatureKey: randomKey
      };

      await setDoc(doc(db, "config", "coordinator"), newConfig);
      setConfig(newConfig);
      setIsAuthenticated(true); // Auto logs in
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar configuração inicial. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // --- Drawing Signature Logic ---
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#1e3a8a"; // Deep navy blue ink
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return; e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const generateRandomKey = () => {
    const key = "ODONTO-SIG-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    setEditSignatureKey(key);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    if (!editName.trim() || !editTitle.trim() || !editSignatureKey.trim()) {
      alert("Por favor, preencha todos os campos do perfil de assinatura eletrônica.");
      return;
    }

    setLoading(true);
    try {
      const updatedConfig = {
        ...config,
        name: editName.trim(),
        title: editTitle.trim(),
        signatureKey: editSignatureKey.trim().toUpperCase()
      };
      
      await setDoc(doc(db, "config", "coordinator"), updatedConfig);
      setConfig(updatedConfig);
      alert("Sua chave de assinatura eletrônica e perfil foram salvos com sucesso!");
      setShowSettings(false);
    } catch (err) {
      console.error("Error saving settings", err);
      alert("Erro ao persistir configurações da chave eletrônica.");
    } finally {
      setLoading(false);
    }
  };

  // --- Coordinator Decision Logic ---

  const handleApprove = async () => {
    if (!selectedDoc || !config) return;

    setActionLoading(true);
    try {
      const timestamp = Date.now();
      const documentHash = selectedDoc.fileHash;
      
      // Calculate secure digital seal hash linking coordinator + doc hash + unique timestamp keys
      const sHash = await generateSignatureHash(documentHash, config.name, timestamp);
      const sealKey = config.signatureKey || "ODONTO-SIG-" + Math.random().toString(36).substring(2, 8).toUpperCase();

      const updatedFields = {
        status: DocumentStatus.APPROVED,
        reviewedAt: timestamp,
        coordinatorName: config.name,
        coordinatorSignatureText: `${config.title} - Chancelado eletronicamente via Sistema Estácio Unimeta.`,
        signatureHash: sHash,
        signatureKey: sealKey
      };

      let isOffline = false;
      try {
        await updateDoc(doc(db, "documents", selectedDoc.id), updatedFields);
      } catch (firestoreErr: any) {
        console.warn("Firestore updateDoc failed, using local offline fallback", firestoreErr);
        isOffline = true;
      }

      // 1. Resolve original PDF base64
      const originalPdfBase64 = await resolveFileUrl(selectedDoc.id, selectedDoc.fileUrl);
      
      // 2. Build full updated doc data object to pass to shape signing function
      const updatedDoc = {
        ...selectedDoc,
        ...updatedFields
      };

      if (isOffline) {
        saveOfflineDocument(updatedDoc);
      }

      // 3. Generate the signed PDF on-the-fly containing all stamps and Certidão validation page
      let signedPdfBase64 = "";
      try {
        signedPdfBase64 = await generateSignedPdf(originalPdfBase64, updatedDoc);
        // Make sure signed document is cached locally so student can view it
        await saveFile(selectedDoc.id, signedPdfBase64);
      } catch (signErr) {
        console.error("Error generating signed PDF during approval:", signErr);
        signedPdfBase64 = originalPdfBase64;
      }

      // 4. Send the email request to our backend express server API
      let emailStatusMessage = "";
      try {
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            to: selectedDoc.studentEmail,
            studentName: selectedDoc.studentName,
            docId: selectedDoc.id,
            pdfBase64: signedPdfBase64,
            verificationUrl: `${window.location.origin}/?protocolo=${selectedDoc.id}#validador`
          })
        });

        const mailRes = await response.json();
        if (mailRes.success) {
          emailStatusMessage = `📨 Um e-mail com a Certidão de Autenticidade Digital (Protocolo: ${selectedDoc.id}) e o arquivo do Termo Assinado e Chancelado (.pdf) em anexo foi enviado para: ${selectedDoc.studentEmail}`;
        } else if (mailRes.warning === "SMTP_NOT_CONFIGURED") {
          emailStatusMessage = `⚠️ O termo de estágio foi assinado e chancelado com sucesso, mas o e-mail não pôde ser enviado porque as credenciais de e-mail SMTP não foram configuradas nas variáveis de ambiente do sistema (.env.example).`;
          console.warn("SMTP has not been configured. Email dispatch skipped.");
        } else {
          emailStatusMessage = `⚠️ O termo foi chancelado, mas houve uma falha interna no envio do e-mail: ${mailRes.error || "Erro desconhecido"}`;
        }
      } catch (mailErr: any) {
        console.error("Failed to call send-email API:", mailErr);
        emailStatusMessage = `⚠️ O termo foi chancelado com sucesso, mas ocorreu uma falha de conexão ao tentar enviar o e-mail para ${selectedDoc.studentEmail}.`;
      }

      // Save locally
      const updatedList = documents.map(docItem => {
        if (docItem.id === selectedDoc.id) {
          return { ...docItem, ...updatedFields };
        }
        return docItem;
      });

      setDocuments(updatedList);
      setSelectedDoc(prev => (prev ? { ...prev, ...updatedFields } : null));

      if (isOffline) {
        alert(`✓ Termo chancelado e assinado LOCALMENTE com sucesso (Offline - Cota do Firebase excedida)!\n\n${emailStatusMessage}`);
      } else {
        alert(`✓ Termo chancelado e assinado eletronicamente!\n\n${emailStatusMessage}`);
      }
    } catch (err) {
      console.error(err);
      alert("Falha ao assinar. Tente novamente.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !rejectionFeedback.trim()) return;

    setActionLoading(true);
    try {
      const timestamp = Date.now();
      const updatedFields = {
        status: DocumentStatus.REJECTED,
        reviewedAt: timestamp,
        coordinatorFeedback: rejectionFeedback.trim()
      };

      let isOffline = false;
      try {
        await updateDoc(doc(db, "documents", selectedDoc.id), updatedFields);
      } catch (firestoreErr) {
        console.warn("Firestore updateDoc failed during rejection, saving offline", firestoreErr);
        isOffline = true;
      }

      const updatedDoc = {
        ...selectedDoc,
        ...updatedFields
      };

      if (isOffline) {
        saveOfflineDocument(updatedDoc);
      }

      const updatedList = documents.map(docItem => {
        if (docItem.id === selectedDoc.id) {
          return { ...docItem, ...updatedFields };
        }
        return docItem;
      });

      setDocuments(updatedList);
      setSelectedDoc(prev => (prev ? { ...prev, ...updatedFields } : null));
      setRejectionFeedback("");

      if (isOffline) {
        alert("Termo rejeitado com sucesso LOCALMENTE (Offline - Cota do Firebase excedida). O feedback foi salvo.");
      } else {
        alert("Termo rejeitado com sucesso. O feedback foi reportado ao aluno.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!window.confirm("Você tem certeza que deseja excluir permanentemente este documento e todos os seus dados? Esta ação não pode ser desfeita.")) {
      return;
    }
    
    setActionLoading(true);
    try {
      await deleteFileFromDbAndCache(id);
      
      // Update state
      setDocuments(prev => prev.filter(d => d.id !== id));
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
      }
      alert("Documento excluído com sucesso!");
    } catch (err) {
      console.error("Erro ao excluir documento:", err);
      alert("Erro ao excluir documento. Tente novamente.");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDocs = documents.filter(docItem => {
    if (filter === "TODOS") return true;
    return docItem.status === filter;
  });

  const getStatusCount = (status: DocumentStatus) => {
    return documents.filter(docItem => docItem.status === status).length;
  };

  // Reset/Onboarding Setup View
  if (loading && !config) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-none h-10 w-10 border-4 border-slate-200 border-t-slate-900"></div>
      </div>
    );
  }

  // --- VIEW 1: FIRST TIME SETUP ONBOARDING ---
  if (!config) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4" id="coordinator-onboarding">
        <div className="bg-white rounded-none shadow-2xl border-2 border-slate-900 overflow-hidden">
          <div className="bg-slate-900 text-white p-8 text-center relative">
            <span className="bg-slate-800 text-white text-[10px] font-black px-3 py-1 rounded-none uppercase tracking-widest block w-max mx-auto mb-3 border border-slate-700">
              Primeiro Acesso
            </span>
            <h1 className="text-2xl font-black uppercase tracking-tight border-none">Painel da Coordenação</h1>
            <p className="text-slate-300 text-xs mt-2 max-w-sm mx-auto font-medium">
              Configure seu perfil oficial de assinatura uma vez para habilitar a chancela digital de termos de estágio.
            </p>
          </div>

          <form onSubmit={handleSetupSubmit} className="p-6 space-y-6" id="onboarding-setup-form">
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800">Nome Oficial do Coordenador</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prof. Dr. Rômulo Chaves"
                  value={setupForm.name}
                  onChange={e => setSetupForm({ ...setupForm, name: e.target.value })}
                  className="px-4 py-2.5 text-sm border-2 border-slate-200 focus:border-slate-900 rounded-none bg-slate-50 focus:bg-white font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800">Cargo Oficial</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Coordenador do Curso de Odontologia"
                  value={setupForm.title}
                  onChange={e => setSetupForm({ ...setupForm, title: e.target.value })}
                  className="px-4 py-2.5 text-sm border-2 border-slate-200 focus:border-slate-900 rounded-none bg-slate-50 focus:bg-white font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800">Instituição de Ensino</label>
                <input
                  type="text"
                  required
                  value={setupForm.institution}
                  onChange={e => setSetupForm({ ...setupForm, institution: e.target.value })}
                  className="px-4 py-2.5 text-sm border-2 border-slate-200 focus:border-slate-900 rounded-none bg-slate-100 font-bold text-slate-600 focus:outline-none"
                  readOnly
                />
              </div>

              <div className="flex flex-col gap-1.5 bg-slate-50 p-4 rounded-none border-2 border-slate-900">
                <label className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1">
                  <KeyRound className="w-4 h-4 text-slate-900" /> Criar Código de Acesso (Senha)
                </label>
                <p className="text-[10px] text-slate-500 font-semibold mb-2">
                  Esta senha será solicitada sempre que você abrir este painel administrativo para avaliar os termos.
                </p>
                <input
                  type="password"
                  required
                  placeholder="Defina uma senha administrativa"
                  value={setupForm.accessCode}
                  onChange={e => setSetupForm({ ...setupForm, accessCode: e.target.value })}
                  className="px-4 py-2.5 text-sm border-2 border-slate-200 focus:border-slate-900 rounded-none font-bold text-slate-800 bg-white focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest py-3.5 px-4 rounded-none shadow transition"
              id="btn-onboarding-submit"
            >
              Setar Perfil da Coordenação
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- VIEW 2: LOGIN SECURITY SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4" id="coordinator-login">
        <div className="bg-white rounded-none shadow-2xl border-2 border-odonto-navy overflow-hidden p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-slate-50 text-odonto-navy rounded-none border-2 border-odonto-navy flex items-center justify-center mx-auto shadow-md">
            <KeyRound className="w-8 h-8 text-odonto-gold animate-pulse" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-black uppercase tracking-tight text-odonto-navy border-none">Acesso Restrito Coordenador</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Olá, <strong>{config.name}</strong>. Insira sua chave de acesso acadêmica da Odontologia Estácio Unimeta.
            </p>
          </div>

          {loginError && (
            <div className="bg-rose-50 border-2 border-rose-950 text-rose-900 text-xs p-3 rounded-none font-bold uppercase tracking-wide">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" id="coordinator-login-form">
            <input
              type="password"
              placeholder="Digite o código de acesso"
              value={passcodeInput}
              onChange={e => setPasscodeInput(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-none bg-slate-50 focus:bg-white focus:border-odonto-navy text-center font-extrabold tracking-widest text-lg focus:outline-none focus:ring-1 focus:ring-odonto-navy"
              autoFocus
            />

            <button
              type="submit"
              className="w-full bg-odonto-navy hover:bg-black text-white font-black text-xs uppercase tracking-widest py-3.5 px-4 rounded-none shadow transition border-2 border-odonto-navy duration-200"
              id="btn-login"
            >
              Entrar no Painel
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- VIEW 3: MAIN ADMINISTRATIVE DASHBOARD ---
  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 space-y-8" id="admin-dashboard">
      
      {/* Upper Navigation and Header info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-none border-2 border-odonto-navy shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-odonto-navy text-white rounded-none flex items-center justify-center font-black uppercase text-xs border border-odonto-gold">
            Od
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black uppercase tracking-tight text-odonto-navy border-none leading-none m-0 p-0">
                {config.name}
              </h1>
              <span className="bg-odonto-navy text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-none border border-odonto-gold">
                Ativo
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide mt-1">
              {config.title} • {config.institution}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-none border-2 transition ${
              showSettings 
                ? "bg-odonto-navy border-odonto-navy text-white shadow-md cursor-pointer" 
                : "bg-white border-odonto-navy text-odonto-navy hover:bg-slate-50 cursor-pointer"
            }`}
            id="settings-toggle-btn"
          >
            <Settings2 className="w-4 h-4 text-odonto-gold" /> Configurar Chave Eletrônica
          </button>
          
          <button
            onClick={() => {
              setIsAuthenticated(false);
              setSelectedDoc(null);
              setShowSettings(false);
            }}
            className="flex items-center justify-center p-2.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-none border-2 border-transparent hover:border-rose-300 transition cursor-pointer"
            title="Sair do Sistema"
            id="logout-btn"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Signature Key Drawer */}
      {showSettings && (
        <div className="bg-white border-2 border-odonto-navy rounded-none p-6 relative shadow-xl" id="signature-key-modal">
          <div className="max-w-xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-md font-black uppercase tracking-tight text-slate-900 border-none">Configuração de Assinatura Eletrônica</h3>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Mude seus dados e sua chave de autenticação (letras e números) de validade jurídica.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-800">Nome do Coordenador</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="px-3 py-2 text-xs border-2 border-slate-200 focus:border-odonto-navy rounded-none font-bold text-slate-800 bg-slate-50 focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-800">Cargo Oficial</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="px-3 py-2 text-xs border-2 border-slate-200 focus:border-odonto-navy rounded-none font-bold text-slate-800 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-4 border-2 border-dashed border-odonto-navy space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-odonto-gold" /> Chave Alfanumérica de Chancela
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomKey}
                    className="text-[10px] text-odonto-navy hover:underline font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    Gerar Nova Chave 🎲
                  </button>
                </div>
                
                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">
                  Esta chave de letras e números substitui sua assinatura manual física e é aplicada nas certidões dos termos com validade acadêmica.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={25}
                    placeholder="Ex: ODONTO-COORD-7A8B"
                    value={editSignatureKey}
                    onChange={e => setEditSignatureKey(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    className="flex-1 px-4 py-2 text-sm border-2 border-slate-300 focus:border-odonto-navy rounded-none uppercase font-mono font-black text-blue-900 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 border-2 border-slate-200 hover:bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest rounded-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-odonto-navy hover:bg-black text-white font-black text-xs uppercase tracking-widest px-5 py-2 rounded-none transition shadow border-2 border-odonto-navy cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Counters & Filter Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="stats-panel">
        <button
          onClick={() => { setFilter("TODOS"); setSelectedDoc(null); }}
          className={`p-4 rounded-none border-2 text-left shadow-xl transition cursor-pointer ${
            filter === "TODOS" 
              ? "bg-odonto-navy border-odonto-navy text-white font-extrabold" 
              : "bg-white border-odonto-navy hover:bg-slate-50 text-slate-900"
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider font-black block text-odonto-gold">Total Coletados</span>
          <span className="text-2xl font-black mt-1 block">{documents.length}</span>
        </button>

        <button
          onClick={() => { setFilter(DocumentStatus.PENDING); setSelectedDoc(null); }}
          className={`p-4 rounded-none border-2 text-left shadow-xl transition cursor-pointer ${
            filter === DocumentStatus.PENDING 
              ? "bg-amber-400 border-odonto-navy text-slate-950 font-black" 
              : "bg-white border-odonto-navy hover:bg-slate-50 text-slate-900"
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider font-black block">Fila Pendente</span>
          <span className="text-2xl font-black mt-1 block">{getStatusCount(DocumentStatus.PENDING)}</span>
        </button>

        <button
          onClick={() => { setFilter(DocumentStatus.APPROVED); setSelectedDoc(null); }}
          className={`p-4 rounded-none border-2 text-left shadow-xl transition cursor-pointer ${
            filter === DocumentStatus.APPROVED 
              ? "bg-odonto-navy border-odonto-navy text-white font-extrabold" 
              : "bg-white border-odonto-navy hover:bg-slate-50 text-slate-900"
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider font-black block text-emerald-400">Chancelados (Assinados)</span>
          <span className="text-2xl font-black mt-1 block">{getStatusCount(DocumentStatus.APPROVED)}</span>
        </button>

        <button
          onClick={() => { setFilter(DocumentStatus.REJECTED); setSelectedDoc(null); }}
          className={`p-4 rounded-none border-2 text-left shadow-xl transition cursor-pointer ${
            filter === DocumentStatus.REJECTED 
              ? "bg-rose-600 border-odonto-navy text-white font-extrabold" 
              : "bg-white border-odonto-navy hover:bg-slate-50 text-slate-900"
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider font-black block">Recusados</span>
          <span className="text-2xl font-black mt-1 block">{getStatusCount(DocumentStatus.REJECTED)}</span>
        </button>
      </div>

      {/* Main workspace layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Termos List queue */}
        <div className="lg:col-span-4 space-y-4" id="documents-list-sidebar">
          <div className="flex justify-between items-center">
            <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Termos {filter} Encontrados ({filteredDocs.length})
            </h2>
            <button
              onClick={loadDocuments}
              className="text-xs text-slate-900 hover:opacity-80 flex items-center gap-1 font-black uppercase tracking-wider"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar Banco
            </button>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredDocs.length === 0 ? (
              <div className="bg-white rounded-none p-8 border-2 border-odonto-navy text-center text-slate-400">
                <CircleSlash className="w-8 h-8 rounded-none border border-slate-300 p-1 mx-auto mb-2" />
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Sem registros encontrados.</p>
              </div>
            ) : (
              filteredDocs.map(docItem => (
                <div
                  key={docItem.id}
                  onClick={() => {
                    setSelectedDoc(docItem);
                    setRejectionFeedback("");
                  }}
                  className={`p-4 rounded-none border-2 text-left cursor-pointer transition relative overflow-hidden ${
                    selectedDoc?.id === docItem.id
                      ? "bg-odonto-navy text-white border-odonto-navy shadow-xl"
                      : "bg-white border-odonto-navy hover:bg-slate-50 text-slate-900"
                  }`}
                >
                  <div className="flex justify-between items-start gap-1 pb-1">
                    <span className={`text-[10px] font-mono font-bold ${
                      selectedDoc?.id === docItem.id ? "text-slate-200" : "text-slate-400"
                    }`}>
                      {docItem.id}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-none ${
                      docItem.status === DocumentStatus.APPROVED
                        ? "bg-emerald-600 text-white"
                        : docItem.status === DocumentStatus.REJECTED
                        ? "bg-rose-600 text-white"
                        : "bg-amber-400 text-amber-950 font-black"
                    }`}>
                      {docItem.status}
                    </span>
                  </div>

                  <h3 className="text-xs font-black uppercase tracking-tight truncate leading-snug">
                    {docItem.studentName}
                  </h3>
                  <p className={`text-[10px] uppercase font-bold truncate tracking-wider ${selectedDoc?.id === docItem.id ? "text-odonto-gold" : "text-slate-500"}`}>
                    Matrícula: {docItem.studentRegistration}
                  </p>

                  <div className="flex justify-between items-center border-t border-current border-opacity-10 pt-2 mt-2 text-[9px] uppercase font-bold tracking-wider opacity-85">
                    <span>{docItem.studentPeriod}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[120px]">{docItem.studentEmail}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDoc(docItem.id);
                        }}
                        className={`p-1.5 border border-transparent hover:border-rose-400 hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition cursor-pointer`}
                        title="Excluir este termo permanentemente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Document evaluation focus workspace */}
        <div className="lg:col-span-8" id="document-evaluation-workspace">
          {selectedDoc ? (
            <div className="bg-white rounded-none border-2 border-odonto-navy shadow-2xl overflow-hidden p-6 md:p-8 space-y-6">
              
              {/* Document Header Metadata */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-2 border-odonto-navy pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      ID: {selectedDoc.id}
                    </span>
                    {selectedDoc.status === DocumentStatus.APPROVED && (
                      <span className="flex items-center gap-1 bg-emerald-600 text-white font-black uppercase tracking-widest text-[9px] px-2 py-0.5 rounded-none border border-emerald-700">
                        <FileCheck className="w-3.5 h-3.5 text-white" /> CHANCELADO
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-odonto-navy leading-tight">
                    Avaliação: {selectedDoc.studentName}
                  </h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    Matrícula: {selectedDoc.studentRegistration} • {selectedDoc.studentPeriod}
                  </p>
                </div>

                <div className="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end">
                  <div className="text-xs text-slate-450 text-right font-bold uppercase tracking-wider">
                    <p className="text-slate-400">Enviado em:</p>
                    <span className="font-extrabold text-slate-900">
                      {new Date(selectedDoc.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteDoc(selectedDoc.id)}
                    className="flex items-center gap-1.5 px-3 py-2 border-2 border-rose-600 hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-black uppercase tracking-wider text-[10px] cursor-pointer transition active:scale-95"
                    title="Excluir este termo permanentemente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                </div>
              </div>

              {/* Side-by-Side: Document file + detail sheet */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Visualizer (2/3 space) */}
                <div className="md:col-span-2 space-y-4">
                  {((resolvedFileUrl || selectedDoc.fileUrl || "").length < 1500) && (
                    <div className="bg-amber-50 border-2 border-amber-500 p-4 rounded-none">
                      <div className="flex items-start gap-2.5">
                        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                        <div className="space-y-1.5 flex-1 text-amber-900">
                          <span className="font-extrabold text-xs block uppercase tracking-wider">Aviso: Arquivo Original não Sincronizado</span>
                          <p className="text-xs leading-relaxed font-semibold">
                            O arquivo PDF original deste documento não está disponível no Firebase (provocado pela cota diária gratuita do banco de dados excedida ou documento gravado offline).
                          </p>
                          <p className="text-[11px] leading-relaxed opacity-95">
                            Para chancelar ou visualizar este termo, basta selecionar o arquivo PDF original em seu computador. O sistema o carregará de maneira segura e local para que você possa visualizá-lo e assiná-lo perfeitamente!
                          </p>
                          <label className="mt-2 inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-widest px-3 py-2 border border-amber-700 cursor-pointer transition active:scale-95">
                            <Upload className="w-3.5 h-3.5" />
                            Preencher PDF Original Manualmente
                            <input
                              type="file"
                              accept=".pdf"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const base64 = await fileToBase64(file);
                                    setResolvedFileUrl(base64);
                                    await saveFile(selectedDoc.id, base64);
                                    alert("✓ PDF carregado localmente com sucesso! Agora você pode visualizá-lo e chancelá-lo normalmente.");
                                  } catch (err) {
                                    console.error("Erro ao ler arquivo local:", err);
                                    alert("Erro ao ler o arquivo PDF.");
                                  }
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  <DocumentViewer
                    fileUrl={resolvedFileUrl || selectedDoc.fileUrl}
                    fileType={selectedDoc.fileType}
                    fileName={selectedDoc.fileName}
                    docData={selectedDoc}
                  />
                </div>

                {/* Details validation sheet form (1/3 space) */}
                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-none p-4 border-2 border-odonto-navy space-y-3.5">
                    <h3 className="text-[10px] font-black text-odonto-navy uppercase tracking-widest">
                      Ficha de Identificação
                    </h3>

                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block font-black">Aluno</span>
                        <span className="text-xs text-slate-900 font-extrabold uppercase tracking-wide">{selectedDoc.studentName}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-300">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block font-black">Matrícula</span>
                          <span className="text-xs text-slate-900 font-extrabold uppercase">{selectedDoc.studentRegistration}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block font-black">Período</span>
                          <span className="text-xs text-slate-900 font-extrabold uppercase">{selectedDoc.studentPeriod}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-300">
                        <span className="text-[10px] text-slate-400 uppercase block font-black">E-mail para Notificação</span>
                        <span className="text-xs text-slate-900 font-extrabold break-all">{selectedDoc.studentEmail}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-odonto-navy text-white rounded-none p-4 border-2 border-odonto-navy space-y-2 shadow-lg">
                    <h4 className="text-[10px] font-black text-odonto-gold flex items-center gap-1 uppercase tracking-widest">
                      <ShieldCheck className="w-4 h-4 text-odonto-gold" /> Integridade Cripto
                    </h4>
                    <p className="text-[10px] text-slate-300 leading-snug font-medium uppercase tracking-wide">
                      O arquivo enviado possui uma assinatura hash para validação em caso de alteração de conteúdo.
                    </p>
                    <div className="text-[9px] font-mono select-all bg-black/20 border border-white/20 p-1.5 rounded-none text-white truncate font-bold" title={selectedDoc.fileHash}>
                      SHA256: {selectedDoc.fileHash}
                    </div>
                  </div>

                  {/* Actions area based on status */}
                  {selectedDoc.status === DocumentStatus.PENDING ? (
                    <div className="space-y-4">
                      {/* Approve button */}
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="w-full bg-odonto-navy hover:bg-black text-white font-black text-xs uppercase tracking-widest py-3.5 px-4 rounded-none shadow transition flex items-center justify-center gap-2 border-2 border-odonto-navy duration-200 cursor-pointer"
                        id="approve-btn"
                      >
                        <CheckCircle2 className="w-5 h-5 text-odonto-gold" /> {actionLoading ? "Chancelando..." : "Aprovar & Assinar Digitalmente"}
                      </button>

                      <div className="border-t-2 border-odonto-navy pt-4">
                        {/* Reject Form */}
                        <form onSubmit={handleReject} className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">Rejeitar com feedback:</label>
                          <textarea
                            placeholder="Descreva o que o aluno precisa corrigir. Ex: Data do termo diverge da concedente."
                            required
                            rows={3}
                            value={rejectionFeedback}
                            onChange={e => setRejectionFeedback(e.target.value)}
                            className="w-full p-2.5 text-xs border-2 border-slate-200 focus:border-odonto-navy rounded-none bg-slate-50 focus:bg-white font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-odonto-navy"
                          />
                          <button
                            type="submit"
                            disabled={actionLoading || !rejectionFeedback.trim()}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest py-3.5 px-3 rounded-none shadow transition border-2 border-rose-600 cursor-pointer"
                            id="reject-btn"
                          >
                            Recusar Termo
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-none p-4 border-2 border-odonto-navy text-center space-y-2 shadow-md">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block">
                        Ação Concluída
                      </span>
                      <p className="text-xs text-slate-800 font-bold uppercase tracking-wide">
                        {selectedDoc.status === DocumentStatus.APPROVED
                          ? `Aprovado por coordenação.`
                          : "Rejeitado com feedback enviado."
                        }
                      </p>
                      
                      {selectedDoc.status === DocumentStatus.REJECTED && (
                        <div className="bg-white border-2 border-slate-200 p-2.5 rounded-none text-left text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-wider">
                          <strong>Feedback:</strong> {selectedDoc.coordinatorFeedback}
                        </div>
                      )}

                      {/* Let Coordinator set pending again if made a mistake */}
                      <button
                        onClick={async () => {
                          if (confirm("Resetar este termo para pendente novamente?")) {
                            setLoading(true);
                            try {
                              const docRef = doc(db, "documents", selectedDoc.id);
                              await updateDoc(docRef, {
                                status: DocumentStatus.PENDING,
                                coordinatorFeedback: "",
                                coordinatorSignatureText: "",
                                signatureHash: ""
                              });
                              alert("Documento redefinido para pendente!");
                              await loadDocuments();
                              setSelectedDoc(null);
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setLoading(false);
                            }
                          }
                        }}
                        className="text-[9px] text-rose-600 hover:text-rose-800 font-black uppercase tracking-widest block mx-auto pt-2 cursor-pointer border-b border-rose-200 pb-2"
                      >
                        Desfazer / Retornar Pendente
                      </button>

                      {/* Excluir Termo permanentemente */}
                      <button
                        onClick={() => handleDeleteDoc(selectedDoc.id)}
                        className="w-full mt-2 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-extrabold text-[10px] uppercase tracking-wider py-2 px-3 border-2 border-rose-600 rounded-none shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                        title="Excluir este termo permanentemente do banco"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir Termo Definitivamente
                      </button>
                    </div>
                  )}

                </div>

              </div>

            </div>
          ) : (
            <div className="bg-white border-2 border-odonto-navy rounded-none p-12 text-center text-slate-400 shadow-2xl min-h-[400px] flex flex-col justify-center items-center">
              <Compass className="w-12 h-12 text-odonto-navy mb-3 animate-pulse" />
              <h3 className="font-black uppercase tracking-tight text-odonto-navy text-sm">Nenhum Termo Selecionado</h3>
              <p className="text-xs font-bold uppercase tracking-wider max-w-xs mt-3 leading-relaxed text-slate-500">
                Escolha um dos termos listados na fila esquerda para conferir o PDF/imagem e proceder com a assinatura eletrônica.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
