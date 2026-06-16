import { useState, useEffect } from "react";
import StudentPortal from "./components/StudentPortal";
import SignatureValidator from "./components/SignatureValidator";
import CoordinatorDashboard from "./components/CoordinatorDashboard";
import { ShieldAlert, ShieldCheck, HeartPulse, UserRound, GraduationCap, ClipboardList } from "lucide-react";

type AppRoute = "student" | "validador" | "coordenador";

export default function App() {
  const [route, setRoute] = useState<AppRoute>("student");

  // Synchronize on load with URL hash if any
  useEffect(() => {
    const handleHashRouter = () => {
      const hash = window.location.hash;
      if (hash === "#validador") {
        setRoute("validador");
      } else if (hash === "#coordenador") {
        setRoute("coordenador");
      } else {
        setRoute("student");
      }
    };

    handleHashRouter(); // Run once on mount

    window.addEventListener("hashchange", handleHashRouter);
    return () => window.removeEventListener("hashchange", handleHashRouter);
  }, []);

  // Synchronize deep internal route shifts
  useEffect(() => {
    const syncRouteFromEvent = (e: Event) => {
      const customEvent = e as CustomEvent<AppRoute>;
      if (customEvent.detail === "validador" || customEvent.detail === "coordenador" || customEvent.detail === "student") {
        setRoute(customEvent.detail);
        window.location.hash = customEvent.detail;
      }
    };

    window.addEventListener("route-change", syncRouteFromEvent);
    return () => window.removeEventListener("route-change", syncRouteFromEvent);
  }, []);

  const handleRouteSelection = (selectedRoute: AppRoute) => {
    setRoute(selectedRoute);
    window.location.hash = selectedRoute;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800" id="app-container">
      
      {/* Golden top accessory line */}
      <div className="print:hidden h-1.5 bg-odonto-gold w-full" />

      {/* Upper Top Official Header Ribbon (Hidden on Print so certificates output beautifully) */}
      <header className="print:hidden bg-white border-b-4 border-odonto-navy px-6 py-5 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
          
          {/* Logo / Brand */}
          <div className="cursor-pointer" onClick={() => handleRouteSelection("student")}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-black text-odonto-gold mb-1">Chancela Digital de Estágios</p>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight leading-snug text-odonto-navy uppercase">
              ODONTOLOGIA <span className="inline-block px-2.5 py-0.5 bg-odonto-navy text-white border-2 border-odonto-gold transform -skew-x-2">ESTÁCIO UNIMETA</span>
            </h1>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-wrap items-center justify-center gap-1.5 p-1 bg-white rounded-none border-2 border-odonto-navy" id="main-navigation">
            <button
              onClick={() => handleRouteSelection("student")}
              className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-none transition-all ${
                route === "student"
                  ? "bg-odonto-navy text-white shadow-md border-b-2 border-odonto-gold"
                  : "text-odonto-navy hover:text-odonto-gold hover:bg-slate-50"
              }`}
              id="nav-student-portal"
            >
              <GraduationCap className="w-3.5 h-3.5" /> Portal do Aluno
            </button>

            <button
              onClick={() => handleRouteSelection("validador")}
              className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-none transition-all ${
                route === "validador"
                  ? "bg-odonto-navy text-white shadow-md border-b-2 border-odonto-gold"
                  : "text-odonto-navy hover:text-odonto-gold hover:bg-slate-50"
              }`}
              id="nav-signature-validator"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Auditoria Pública
            </button>

            <button
              onClick={() => handleRouteSelection("coordenador")}
              className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-none transition-all ${
                route === "coordenador"
                  ? "bg-odonto-navy text-white shadow-md border-b-2 border-odonto-gold"
                  : "text-odonto-navy hover:text-odonto-gold hover:bg-slate-50"
              }`}
              id="nav-coordinator-dashboard"
            >
              <UserRound className="w-3.5 h-3.5" /> Coordenação
            </button>
          </nav>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full relative">
        {route === "student" && <StudentPortal />}
        {route === "validador" && <SignatureValidator />}
        {route === "coordenador" && <CoordinatorDashboard />}
      </main>

      {/* Global Academic Institutional footer (Hidden on Print) */}
      <footer className="print:hidden border-t-2 border-odonto-navy bg-white py-6 md:py-8 mt-12 text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
          
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-odonto-navy" />
            <p>
              © {new Date().getFullYear()} Centro Universitário Estácio Unimeta.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="#coordenador"
              onClick={(e) => { e.preventDefault(); handleRouteSelection("coordenador"); }}
              className="hover:text-odonto-gold text-odonto-navy transition font-black"
            >
              Acesso Coordenador
            </a>
            <span className="text-slate-300">|</span>
            <a
              href="#validador"
              onClick={(e) => { e.preventDefault(); handleRouteSelection("validador"); }}
              className="hover:text-odonto-gold text-odonto-navy transition flex items-center gap-1 font-black"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-odonto-sky" /> Auditoria Estácio
            </a>
          </div>

        </div>
      </footer>

    </div>
  );
}
