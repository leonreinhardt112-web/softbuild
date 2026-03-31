import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ALLE_ROLLEN = [
  { key: "geschaeftsfuehrung", label: "Geschäftsführung" },
  { key: "kalkulation", label: "Kalkulation" },
  { key: "bauleitung", label: "Bauleitung" },
  { key: "buchhaltung", label: "Buchhaltung" },
];

const NAV_SEITEN = [
  { page: "Dashboard", name: "Dashboard", immerSichtbar: true },
  { page: "Projects", name: "Projekte", immerSichtbar: true },
  { page: "Postfaecher", name: "Postfächer", immerSichtbar: true },
  { page: "Abrechnung", name: "Abrechnung" },
  { page: "Controlling", name: "Controlling" },
  { page: "Stammdaten", name: "Stammdaten" },
];

const DEFAULT_RECHTE = {
  Abrechnung: ["geschaeftsfuehrung", "buchhaltung"],
  Controlling: ["geschaeftsfuehrung", "kalkulation", "buchhaltung"],
  Stammdaten: ["geschaeftsfuehrung"],
};

export default function NavigationsrechteEditor() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: companyData, isLoading } = useQuery({
    queryKey: ["company-nav-rechte"],
    queryFn: async () => {
      const list = await base44.entities.Stammdatum.filter({ typ: "unternehmen", aktiv: true }, undefined, 1);
      return list?.[0] || null;
    },
  });

  const navRechte = companyData?.nav_rechte || DEFAULT_RECHTE;

  const [rechte, setRechte] = useState(null);
  const currentRechte = rechte ?? navRechte;

  const saveMut = useMutation({
    mutationFn: async (newRechte) => {
      if (companyData?.id) {
        return base44.entities.Stammdatum.update(companyData.id, { nav_rechte: newRechte });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-nav-rechte"] });
      qc.invalidateQueries({ queryKey: ["company-domain"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const toggle = (page, rolle) => {
    setRechte(prev => {
      const base = prev ?? navRechte;
      const current = base[page] || [];
      const updated = current.includes(rolle)
        ? current.filter(r => r !== rolle)
        : [...current, rolle];
      return { ...base, [page]: updated };
    });
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Lade...</div>;
  if (!companyData) return (
    <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
      Bitte zuerst Unternehmens-Stammdaten anlegen (Stammdaten → Unternehmen).
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Navigations-Sichtbarkeit je Rolle
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Admins sehen immer alle Seiten. Dashboard, Projekte und Postfächer sind für alle sichtbar.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Seite</th>
                {ALLE_ROLLEN.map(r => (
                  <th key={r.key} className="text-center py-2 px-3 font-medium text-muted-foreground min-w-[100px]">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NAV_SEITEN.map(seite => (
                <tr key={seite.page} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-foreground">{seite.name}</td>
                  {ALLE_ROLLEN.map(rolle => {
                    const isFixed = seite.immerSichtbar;
                    const isChecked = isFixed || (currentRechte[seite.page] || []).includes(rolle.key);
                    return (
                      <td key={rolle.key} className="text-center py-2.5 px-3">
                        <button
                          disabled={isFixed}
                          onClick={() => toggle(seite.page, rolle.key)}
                          className={cn(
                            "w-6 h-6 rounded border-2 mx-auto flex items-center justify-center transition-colors",
                            isFixed
                              ? "bg-muted border-muted cursor-default"
                              : isChecked
                              ? "bg-primary border-primary text-primary-foreground hover:bg-primary/80"
                              : "border-border hover:border-primary/50 bg-background"
                          )}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            onClick={() => saveMut.mutate(currentRechte)}
            disabled={!rechte || saveMut.isPending}
            className="gap-1.5"
          >
            {saved ? <><Check className="w-3.5 h-3.5" />Gespeichert</> : <><Save className="w-3.5 h-3.5" />Speichern</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}