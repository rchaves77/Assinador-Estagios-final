import { useState } from "react";
import { ZoomIn, ZoomOut, RotateCw, Download, FileText, ImageIcon } from "lucide-react";

interface DocumentViewerProps {
  fileUrl: string;
  fileType: string;
  fileName: string;
}

export default function DocumentViewer({ fileUrl, fileType, fileName }: DocumentViewerProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

  const isPdf = fileType.includes("pdf") || fileUrl.startsWith("data:application/pdf");
  const isImage = fileType.startsWith("image/") || fileUrl.startsWith("data:image/");

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
            href={fileUrl}
            download={fileName}
            className="p-1.5 hover:bg-slate-700 rounded text-sky-400 transition ml-1"
            title="Baixar Arquivo Original"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Main File Viewport */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950 relative min-h-[300px] md:min-h-[500px]">
        {isPdf ? (
          <div className="w-full h-full min-h-[400px] md:min-h-[550px] flex flex-col items-center justify-center">
            <object
              data={fileUrl}
              type="application/pdf"
              className="w-full h-full rounded border border-slate-800"
            >
              <embed src={fileUrl} type="application/pdf" />
              <div className="text-center p-6 text-slate-400 max-w-sm">
                <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-sm mb-4">
                  Visualização interna não suportada pelo navegador ou em dispositivo móvel.
                </p>
                <a
                  href={fileUrl}
                  download={fileName}
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-black text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-none transition border border-slate-750"
                >
                  <Download className="w-4 h-4" /> Baixar PDF para Avaliar
                </a>
              </div>
            </object>
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
