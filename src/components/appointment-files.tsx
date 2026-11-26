import { uploadPrivateFile } from "@/lib/private-upload";
import { useId, useState } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { api } from "@/api/client";
import { Btn } from "@/components/qc";
import { friendlyError } from "@/services/errors";
import type { AppointmentAttachment } from "@/types/clinical-workflow";

export interface SelectedAttachment {
  key: string;
  file: File;
  title: string;
  type: string;
  state: string;
  error: string;
}

export function AttachmentFields({
  files,
  onChange,
  disabled = false,
}: {
  files: SelectedAttachment[];
  onChange: (f: SelectedAttachment[]) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const [error, setError] = useState("");
  return (
    <section className="space-y-2.5">
      <div className="block text-sm font-medium">
        Add Medical Document / Report{" "}
        <span className="font-normal text-muted-foreground">(Optional)</span>
      </div>
      <label
        htmlFor={inputId}
        className={`flex items-center justify-between gap-3 rounded-xl border border-dashed border-input bg-muted/40 px-4 py-3 transition-colors ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Paperclip className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate text-sm text-muted-foreground">
            {files.length
              ? files.length === 1
                ? files[0]!.file.name
                : `${files.length} files selected`
              : "Tap to attach PDF, JPG, or PNG report"}
          </span>
        </div>
        <span className="shrink-0 rounded-lg border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">
          Browse
        </span>
        <input
          id={inputId}
          aria-label="Add supporting files"
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png"
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            const incoming = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length + incoming.length > 10) {
              setError("Select no more than 10 files.");
              return;
            }
            if (
              incoming.some(
                (f) =>
                  f.size === 0 ||
                  f.size > 5242880 ||
                  !["application/pdf", "image/jpeg", "image/png"].includes(f.type) ||
                  !/\.(pdf|jpe?g|png)$/i.test(f.name),
              )
            ) {
              setError("Choose PDF, JPEG or PNG files between 1 byte and 5 MB.");
              return;
            }
            setError("");
            onChange([
              ...files,
              ...incoming.map((file) => ({
                key: crypto.randomUUID(),
                file,
                title: file.name.replace(/\.[^.]+$/, "") || file.name,
                type: "medical_document",
                state: "Waiting to upload",
                error: "",
              })),
            ]);
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Up to 10 files · PDF, JPG, or PNG up to 5 MB each. Files remain private.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {files.map((f, i) => (
        <div
          key={f.key}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-medium text-foreground">
              {f.file.name}{" "}
              <span className="font-normal text-muted-foreground">
                · {(f.file.size / 1024).toFixed(0)} KB
              </span>
            </p>
            <p role="status" className="text-xs text-muted-foreground">
              {f.state}
            </p>
            {f.error && (
              <p role="alert" className="text-xs text-destructive">
                {f.error}
              </p>
            )}
          </div>
          <Btn
            type="button"
            variant="ghost"
            disabled={disabled || f.state === "Uploaded"}
            onClick={() => onChange(files.filter((x) => x.key !== f.key))}
            className="shrink-0 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span>Remove file {i + 1}</span>
          </Btn>
        </div>
      ))}
    </section>
  );
}

export async function uploadAppointmentFiles(
  id: string,
  files: SelectedAttachment[],
  progress: (key: string, state: string, error?: string) => void,
) {
  let failed = 0;
  for (const f of files) {
    if (f.state === "Uploaded") continue;
    let prepared: string | undefined;
    try {
      progress(f.key, "Preparing upload");
      const p = await api<{ id: string; uploadUrl?: string; ready?: boolean }>(
        `/appointments/${encodeURIComponent(id)}/attachments`,
        {
          method: "POST",
          body: {
            title: f.title,
            type: f.type,
            filename: f.file.name,
            mime: f.file.type,
            size: f.file.size,
            uploadKey: f.key,
          },
        },
      );
      prepared = p.id;
      if (p.ready) {
        progress(f.key, "Uploaded");
        continue;
      }
      if (!p.uploadUrl) throw Error("Unable to prepare this upload.");
      progress(f.key, "Uploading 0%");
      await uploadPrivateFile(p.uploadUrl, f.file, (percent) =>
        progress(f.key, `Uploading ${percent}%`),
      );
      progress(f.key, "Checking file");
      await api(`/appointment-attachments/${p.id}/complete`, { method: "POST", body: {} });
      progress(f.key, "Uploaded");
    } catch (e) {
      failed++;
      progress(f.key, "Upload failed", friendlyError(e));
      if (prepared)
        try {
          await api(`/appointment-attachments/${prepared}`, { method: "DELETE" });
        } catch {
          /* Server retains the private path for cleanup. */
        }
    }
  }
  return failed;
}

export function AppointmentFiles({ files }: { files: AppointmentAttachment[] }) {
  const [error, setError] = useState("");
  return (
    <div className="space-y-3">
      {files.length ? (
        files.map((f) => (
          <article key={f.id} className="rounded-lg border border-border p-4">
            <h3 className="break-words font-semibold">{f.title}</h3>
            <p className="break-all text-sm text-muted-foreground">
              {f.type.replaceAll("_", " ")} · {f.filename} · {f.createdAt.slice(0, 10)} · {f.status}
            </p>
            {f.status === "ready" && (
              <Btn
                type="button"
                variant="ghost"
                onClick={() => {
                  setError("");
                  void api<{ url: string }>(`/appointment-attachments/${f.id}/download`)
                    .then((d) => {
                      const a = document.createElement("a");
                      a.href = d.url;
                      a.target = "_blank";
                      a.rel = "noopener noreferrer";
                      a.click();
                    })
                    .catch((e) => setError(friendlyError(e)));
                }}
              >
                Download file
              </Btn>
            )}
          </article>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No supporting files attached.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
