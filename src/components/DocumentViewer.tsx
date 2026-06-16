import { useState, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCw, Download, FileText, ImageIcon, Eye } from "lucide-react";

interface DocumentViewerProps {
  fileUrl: string;
  fileType: string;
  fileName: string;
}

export default function DocumentViewer({ fileUrl, fileType, fileName }: DocumentViewerProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [blobUrl, setBlobUrl] = useState<string>("");

  const isPdf = fileType.includes("pdf") || fileUrl.startsWith("data:application/pdf");
  const isImage = fileType.startsWith("image/") || fileUrl.startsWith("data:image/");

  useEffect(() => {
    let url = "";
    if (fileUrl.startsWith("data:application/pdf")) {
      try {
        const parts = fileUrl.split(';base64,');
        const contentType = parts[0].split(':')[1] || "application/pdf";
        const byteCharacters = atob(parts[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: contentType });
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (e) {
        console.error("Error creating blob URL from base64:", e);
        setBlobUrl(fileUrl);
      }
    } else {
      setBlobUrl(fileUrl);
    }

    return () => {
      if (url && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    };
  }, [fileUrl]);

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-none overflow-hidden border-2 border-slate-900 select-none">
      {/* File Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-850 border-b-2 border-slate-900 text-slate-300">
        <div className="flex items-center gap-2 max-w-xs md:max-w-md">
          {isPdf ? (
            <FileText className="w-5 h-5 text-red-400 shrink-0" />
          ) : (
            <ImageIcon className="w-5 h-5 text-blue-400 shrink-0" />
          )}
          <span className="text-xs font-mono font-medium truncate" title={fileName}>
            {fileName}
          </span>
        </div>

        <div className="flex items-center gap-2 bg-slate-905 bg-opacity-50 p-1 rounded-lg">
          {isPdf && blobUrl && (
            <a
              href={blobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700 hover:text-white rounded text-xs text-odonto-gold font-bold transition mr-1"
              title="Visualizar em Tela Cheia"
            >
              <Eye className="w-4 h-4 text-odonto-gold" />
              <span className="hidden sm:inline">Tela Cheia</span>
            </a>
          )}
          {isImage && (
            <>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="p-1 px-1.5 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-50 transition"
                title="Afastar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono w-10 text-center">{zoom}%</span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
                className="p-1 px-1.5 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-50 transition"
                title="Aproximar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-slate-700 mx-1"></div>
              <button
                type="button"
                onClick={handleRotate}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-300 transition"
                title="Rotacionar 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </>
          )}
          <a
            href={blobUrl || fileUrl}
            download={fileName}
            className="p-1.5 hover:bg-slate-700 rounded text-sky-450 transition ml-1"
            title="Baixar Arquivo Original"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Main File Viewport */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950 relative min-h-[300px] md:min-h-[500px]">
        {isPdf ? (
          <div className="w-full h-full min-h-[400px] md:min-h-[550px] flex flex-col items-center justify-center relative">
            {blobUrl ? (
              <iframe
                src={blobUrl}
                title={fileName}
                className="w-full h-full rounded border-2 border-slate-800 bg-white"
                style={{ minHeight: "550px" }}
              />
            ) : (
              <div className="text-center p-6 text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-odonto-gold mx-auto mb-4"></div>
                <p className="text-sm font-mono">Processando PDF com Segurança...</p>
              </div>
            )}
            
            {/* Action Overlay/Toolbar */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3 bg-slate-900 bg-opacity-95 p-3 shadow-2xl border-2 border-slate-700 max-w-md w-11/12 justify-center z-10 rounded-sm">
              <a
                href={blobUrl || fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-odonto-navy hover:bg-black text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-none transition border border-odonto-gold"
              >
                <Eye className="w-4 h-4 text-odonto-gold" /> Visualizar Cheio / Imprimir
              </a>
              <a
                href={blobUrl || fileUrl}
                download={fileName}
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-none transition border border-slate-650"
              >
                <Download className="w-4 h-4 text-sky-400" /> Baixar PDF
              </a>
            </div>
          </div>
        ) : isImage ? (
          <div
            className="transition-transform duration-200 ease-out flex items-center justify-center"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              maxWidth: "100%",
            }}
          >
            <img
              src={fileUrl}
              alt={fileName}
              referrerPolicy="no-referrer"
              className="max-h-[60vh] max-w-full rounded shadow-lg object-contain border border-slate-800 bg-white"
            />
          </div>
        ) : (
          <div className="text-center p-4 text-slate-400">
            <p className="text-sm">Formato de arquivo não suportado para visualização.</p>
            <a
              href={fileUrl}
              download={fileName}
              className="mt-3 inline-flex items-center gap-2 text-blue-400 hover:underline"
            >
              Exibir/Baixar Arquivo
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
