import { useState } from "react";
import { api } from "@/api/client";
import { Btn, Field } from "@/components/qc";
import { SearchableChoice } from "@/components/searchable-choice";
import { useClinicalData, ClinicalLoading } from "@/components/clinical";
import { friendlyError } from "@/services/errors";
import type { Condition } from "@/types/workflow";
export function PatientConditions({ patientId }: { patientId: string }) {
  const remote = useClinicalData<Condition[]>("/admin/patients/" + patientId + "/conditions"),
    library = useClinicalData<Condition[]>("/admin/conditions");
  const [name, setName] = useState(""),
    [otherName, setOtherName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const isOther = name.trim().toLowerCase() === "other";
  const effectiveName = isOther ? otherName.trim() : name.trim();
  const baseOptions = (library.data?.map((c) => c.name) ?? []).filter(
    (c) => c.trim().toLowerCase() !== "other",
  );
  const options = [...baseOptions, "Other"];

  async function change(condition?: Condition) {
    if (!condition && !effectiveName) return;
    setBusy(true);
    setError("");
    try {
      await api(
        "/admin/patients/" + patientId + "/conditions" + (condition ? "/" + condition.id : ""),
        {
          method: condition ? "DELETE" : "POST",
          ...(condition ? {} : { body: { name: effectiveName } }),
        },
      );
      setName("");
      setOtherName("");
      remote.reload();
      library.reload();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="surface mb-6 p-5">
      <h2 className="font-semibold">Conditions</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Explicit doctor-recorded tags. Existing diagnosis and clinical notes remain unchanged.
      </p>
      {!remote.data ? (
        <ClinicalLoading error={remote.error} retry={remote.reload} />
      ) : (
        <div className="my-4 flex flex-wrap gap-2">
          {remote.data.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-soft px-3 py-2 text-sm"
            >
              {c.name}
              <button
                aria-label={"Remove " + c.name}
                disabled={busy}
                onClick={() => void change(c)}
              >
                ×
              </button>
            </span>
          ))}
          {!remote.data.length && (
            <p className="text-sm text-muted-foreground">No conditions tagged.</p>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (effectiveName) void change();
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="w-full max-w-sm">
          <SearchableChoice
            label="Condition"
            value={name}
            onChange={(val) => {
              setName(val);
              if (val.trim().toLowerCase() !== "other") {
                setOtherName("");
              }
            }}
            options={options}
            allowCreate
            disabled={busy}
          />
        </div>
        {isOther && (
          <div className="w-full max-w-sm">
            <Field
              label="Other condition"
              name="otherCondition"
              placeholder="Enter custom condition"
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              maxLength={120}
              required
              disabled={busy}
            />
          </div>
        )}
        <Btn variant="secondary" disabled={busy || !effectiveName}>
          Add condition
        </Btn>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
