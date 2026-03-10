import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal, Info } from "lucide-react";

const DEFAULT_ZUSCHLAEGE = {
  lohn_bgk: 10, lohn_agk: 5, lohn_wg: 3,
  material_bgk: 5, material_agk: 3, material_wg: 2,
  geraet_bgk: 8, geraet_agk: 4, geraet_wg: 2,
  nu_bgk: 5, nu_agk: 3, nu_wg: 2,
  sonstiges_bgk: 5, sonstiges_agk: 3, sonstiges_wg: 2,
};

const KOSTENARTEN = [
{ key: "lohn", label: "Lohn" },
{ key: "material", label: "Stoffkosten" },
{ key: "geraet", label: "Gerätekosten" },
{ key: "sonstiges", label: "Sonstige Kosten" },
{ key: "nu", label: "NU-Leistungen" },
];

const ZUSCHLAGZEILEN = [
{ suffix: "bgk", label: "Baustellengemeinkosten", nr: "2.1" },
{ suffix: "agk", label: "Allgemeine Geschäftskosten", nr: "2.2" },
{ suffix: "wg", label: "Wagnis und Gewinn", nr: "2.3" },
];

function calcGesamtZuschlag(bgk, agk, wg) {
  return (Number(bgk) + Number(agk) + Number(wg)).toFixed(1);
}

export default function ZuschlaegeDialog({ zuschlaege, onSave }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(DEFAULT_ZUSCHLAEGE);

  useEffect(() => {
    if (zuschlaege) setValues({ ...DEFAULT_ZUSCHLAEGE, ...zuschlaege });
  }, [zuschlaege]);

  const set = (key, val) => setValues(v => ({ ...v, [key]: parseFloat(val) || 0 }));

  const handleSave = () => {
    onSave(values);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="w-4 h-4" />
        Zuschläge
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Zuschläge je Kostengruppe
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1 text-xs text-muted-foreground flex items-start gap-1.5 bg-muted/40 p-3 rounded-lg">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>Zuschläge werden multiplikativ angewendet: EP × (1+BGK%) × (1+AGK%) × (1+W&G%). Die Einzel-EP in der Positionsmatrix sind Netto-Herstellkosten ohne Zuschläge.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">Kostengruppe</th>
                  <th className="text-center text-xs font-medium text-muted-foreground py-2 px-3">BGK (%)</th>
                  <th className="text-center text-xs font-medium text-muted-foreground py-2 px-3">AGK (%)</th>
                  <th className="text-center text-xs font-medium text-muted-foreground py-2 px-3">W&G (%)</th>
                  <th className="text-center text-xs font-medium text-muted-foreground py-2 px-3">Gesamt (%)</th>
                </tr>
              </thead>
              <tbody>
                {GRUPPEN.map(({ key, label, color }) => {
                  const bgk = values[`${key}_bgk`] ?? 0;
                  const agk = values[`${key}_agk`] ?? 0;
                  const wg = values[`${key}_wg`] ?? 0;
                  const gesamt = calcGesamtZuschlag(bgk, agk, wg);
                  return (
                    <tr key={key} className="border-b border-border/50">
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>
                      </td>
                      {[`${key}_bgk`, `${key}_agk`, `${key}_wg`].map(k => (
                        <td key={k} className="py-2 px-3">
                          <div className="relative">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={values[k] ?? 0}
                              onChange={e => set(k, e.target.value)}
                              className="h-8 text-center pr-7 text-sm w-24"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                        </td>
                      ))}
                      <td className="py-2 px-3 text-center">
                        <span className="font-semibold text-primary">+{gesamt}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Zusammenfassung */}
          <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
            <p className="font-medium text-foreground">Vorschau Gesamtzuschläge</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {GRUPPEN.map(({ key, label }) => (
                <div key={key} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{label}:</span>
                  <span className="font-medium">+{calcGesamtZuschlag(values[`${key}_bgk`] ?? 0, values[`${key}_agk`] ?? 0, values[`${key}_wg`] ?? 0)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave}>Zuschläge speichern</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}