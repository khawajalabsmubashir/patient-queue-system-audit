import React, { useState } from "react";
import { Download, FileCode2, Trash2, CheckCircle2, ShieldCheck } from "lucide-react";

export default function App() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    const link = document.createElement("a");
    link.href = "/api/download-zip";
    link.download = "queuecare-updated-files.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(false), 2000);
  };

  const updatedFiles = [
    "src/routes/patient.tsx (Footer with Dr. Umar Zafar Ali contact & no hours)",
    "src/routes/patient.dashboard.tsx (Non-clickable live queue badge & clean history)",
    "src/routes/patient.appointments.tsx (Redesigned grid & counts)",
    "src/routes/admin.clinics.tsx (Clinics & Add Area functionality)",
    "src/routes/account.tsx (Unified profile & account settings)",
    "src/routes/__root.tsx (iOS Safari viewport-fit=cover & SEO metadata)",
    "src/components/app-link.tsx (SPA navigation helper)",
    "src/components/appointment-rows.tsx",
    "src/components/appointment-tokens.tsx",
    "src/components/billing-workspace.tsx",
    "src/components/clinic-location-picker.tsx",
    "src/components/clinical.tsx",
    "src/components/final-operations.tsx",
    "src/components/form-controls.tsx (iOS Safari text-base sm:text-sm font scaling)",
    "src/components/notification-center.tsx",
    "src/components/qc.tsx",
    "src/providers/clinic-provider.tsx",
    "src/styles.css (iOS Safari touch & zoom fixes)",
    "server/index.ts (Optional Supabase Postgres + SQLite fallback)",
    "server/routes/operations.ts",
    "server/routes/token-documents.ts",
    "server/services/document-storage.ts",
    "server/services/final.ts",
    "vite.config.ts (Port 3000 & API proxy setup)",
    "metadata.json"
  ];

  const deletedFiles = [
    "src/routes/patient.live-queue.tsx",
    "src/routes/patient.prescriptions.tsx",
    "src/routes/patient.prescription.$visitId.tsx",
    "src/routes/patient.visit.$visitId.tsx",
    "src/routes/patient.visits.tsx",
    "src/routes/patient.queue.tsx",
    "src/routes/patient.history.tsx",
    "src/routes/patient.documents.tsx",
    "src/routes/patient.get-token.tsx",
    "src/routes/patient.join-queue.tsx"
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20">
              QC
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">QueueCare GitHub Export Package</h1>
              <p className="text-xs text-slate-500">Ready for Vercel & Supabase Repository Sync</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="size-3.5" />
            Production Verified
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-white p-8 shadow-sm">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Download All Changed Files in One ZIP
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Click the button below to download <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-emerald-800">queuecare-updated-files.zip</code>. The ZIP contains all modified files placed inside their exact relative folder structure. Simply extract and replace them in your local Git repository, then push to GitHub for automatic Vercel deployment.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              >
                <Download className="size-4" />
                {downloading ? "Preparing ZIP Archive…" : "Download Updated Files ZIP"}
              </button>
              <span className="text-xs text-slate-500">
                Includes <code className="font-semibold text-slate-700">DELETIONS.txt</code> checklist
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {/* Included Files */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900 font-semibold mb-4">
              <FileCode2 className="size-5 text-emerald-600" />
              <h3>Updated & Added Files in ZIP ({updatedFiles.length})</h3>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 max-h-[380px] overflow-y-auto pr-2">
              {updatedFiles.map((file, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  <span className="font-mono">{file}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Files to Delete */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900 font-semibold mb-4">
              <Trash2 className="size-5 text-rose-600" />
              <h3>Files to Delete from Repo ({deletedFiles.length})</h3>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 max-h-[380px] overflow-y-auto pr-2">
              {deletedFiles.map((file, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg bg-rose-50/50 p-2.5 border border-rose-100/60">
                  <span className="mt-0.5 size-3.5 shrink-0 text-rose-500 font-bold text-center">×</span>
                  <span className="font-mono text-rose-900">{file}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Deployment Steps:</h3>
          <ol className="mt-3 grid gap-3 text-xs text-slate-600 sm:grid-cols-3">
            <li className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <span className="font-bold text-slate-900 block mb-1">1. Download & Extract</span>
              Download the ZIP archive and extract it on your computer.
            </li>
            <li className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <span className="font-bold text-slate-900 block mb-1">2. Replace & Delete</span>
              Copy the extracted folders over your local repository and delete the obsolete route files listed above.
            </li>
            <li className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <span className="font-bold text-slate-900 block mb-1">3. Commit & Push</span>
              Run <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">git add . && git commit -m "UI/UX & Supabase update" && git push</code>. Vercel will automatically update.
            </li>
          </ol>
        </div>
      </main>
    </div>
  );
}
