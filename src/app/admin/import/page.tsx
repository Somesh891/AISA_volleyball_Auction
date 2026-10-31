
"use client";

import { useState } from "react";

type ImportResult = {
  boys: {
    imported: number;
    alreadyPresent: number;
    duplicateInFile: number;
    invalid: number;
  };
  girls: {
    imported: number;
    alreadyPresent: number;
    duplicateInFile: number;
    invalid: number;
  };
  unknownGenderRows: number;
};

export default function ImportPlayersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleImport() {
    if (!file) {
      setError("Please select your Excel file first.");
      return;
    }

    if (!secret.trim()) {
      setError("Please enter the admin import secret.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/import-players", {
        method: "POST",
        headers: {
          "x-admin-secret": secret,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed.");
      }

      setResult(data.result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <a
          href="/"
          className="text-sm text-sky-400 hover:text-sky-300"
        >
          ← Back to Auction Dashboard
        </a>

        <div className="mt-8 rounded-2xl border border-sky-500/20 bg-[#0b1424] p-6 shadow-2xl sm:p-9">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-sky-400">
              AISA Volleyball Auction
            </p>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              Import Players
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Upload the original Google Forms Excel response file.
              Players will automatically be separated into boys and girls
              auctions. Duplicate PRNs will be skipped.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Admin Import Secret
              </label>

              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Enter your ADMIN_IMPORT_SECRET"
                className="w-full rounded-xl border border-sky-500/20 bg-[#050914] px-4 py-3 text-white outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Player Excel File
              </label>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-sky-500/40 bg-[#050914] px-5 py-10 text-center transition hover:border-sky-400">
                <span className="text-3xl">📊</span>

                <span className="mt-3 font-semibold text-slate-200">
                  {file ? file.name : "Choose your Excel file"}
                </span>

                <span className="mt-2 text-xs text-slate-500">
                  XLSX, XLS or CSV · Maximum 10 MB
                </span>

                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setResult(null);
                    setError("");
                  }}
                />
              </label>
            </div>

            <button
              onClick={handleImport}
              disabled={loading || !file || !secret.trim()}
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-4 font-black text-[#03101d] shadow-lg shadow-sky-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "IMPORTING PLAYERS..." : "IMPORT PLAYERS"}
            </button>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-7 space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h2 className="font-bold text-emerald-300">
                  Import completed successfully!
                </h2>

                <p className="mt-1 text-sm text-slate-300">
                  Check the summary below.
                </p>
              </div>

              {(["boys", "girls"] as const).map((gender) => (
                <div
                  key={gender}
                  className="rounded-xl border border-sky-500/20 bg-[#050914] p-5"
                >
                  <h3 className="mb-4 text-lg font-black capitalize text-sky-300">
                    {gender} Auction
                  </h3>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Stat label="Imported" value={result[gender].imported} />
                    <Stat
                      label="Already present"
                      value={result[gender].alreadyPresent}
                    />
                    <Stat
                      label="Duplicate PRNs"
                      value={result[gender].duplicateInFile}
                    />
                    <Stat
                      label="Invalid rows"
                      value={result[gender].invalid}
                    />
                  </div>
                </div>
              ))}

              <p className="text-sm text-slate-400">
                Rows with unrecognized gender: {result.unknownGenderRows}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
