import { DEFAULT_CITIES } from "@/domain/cities";
import { normalizeLocation } from "@/domain/locations";
import { useState, useEffect } from "react";
import { SearchableChoice } from "@/components/searchable-choice";
import { useClinicContext } from "@/providers/clinic-provider";

const legacy = "Location not yet specified";

export function ClinicLocationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { clinics } = useClinicContext();
  const active = clinics.filter((c) => c.active !== false);
  const selected = active.find((c) => c.id === value);

  const [city, setCity] = useState(
    selected?.city || (selected ? legacy : ""),
  );

  useEffect(() => {
    const clinic = active.find((c) => c.id === value);

    if (clinic) {
      setCity(clinic.city || legacy);
    }
  }, [value, clinics]);

  const cities = [
    ...new Map(
      [
        ...DEFAULT_CITIES,
        ...active.map((c) => c.city || legacy),
      ].map((name) => [normalizeLocation(name), name]),
    ).values(),
  ].sort((a, b) => a.localeCompare(b));

  const relevant = active.filter(
    (c) =>
      normalizeLocation(c.city || legacy) === normalizeLocation(city),
  );

  return (
    <div className="space-y-4">
      <SearchableChoice
        label="City"
        options={cities}
        value={city}
        onChange={(v) => {
          setCity(v);
          onChange("");
        }}
      />

      <SearchableChoice
        label="Clinic"
        options={relevant.map((c) => c.id)}
        labels={Object.fromEntries(relevant.map((c) => [c.id, c.name]))}
        value={value}
        disabled={!city}
        onChange={onChange}
      />

      {city === legacy && (
        <p className="text-xs text-muted-foreground">
          These existing clinics remain available while location details are updated.
        </p>
      )}
    </div>
  );
}