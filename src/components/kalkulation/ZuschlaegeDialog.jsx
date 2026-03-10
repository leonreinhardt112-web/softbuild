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
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground py-2 px-2 border border-border w-6">#</th>
                  <th className="text-left font-medium text-muted-foreground py-2 px-2 border border-border">Zuschlagsart</th>
                  {KOSTENARTEN.map(k => (
                    <th key={k.key} className="text-center font-medium text-muted-foreground py-2 px-1 border border-border text-[11px]">{k.label}</th>
                  ))}
                  <th className="text-center font-medium text-muted-foreground py-2 px-1 border border-border">Gesamt %</th>
                </tr>
              </thead>
              <tbody>
                {ZUSCHLAGZEILEN.map(({ suffix, label, nr }) => (
                  <tr key={suffix} className="border-b border-border/50">
                    <td className="py-2 px-2 border border-border font-medium text-muted-foreground">{nr}</td>
                    <td className="py-2 px-2 border border-border font-medium">{label}</td>
                    {KOSTENARTEN.map(k => {
                      const field = `${k.key}_${suffix}`;
                      return (
                        <td key={k.key} className="py-1.5 px-1 border border-border">
                          <div className="relative">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={values[field] ?? 0}
                              onChange={e => set(field, e.target.value)}
                              className="h-7 text-center pr-6 text-xs w-full"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 border border-border text-center font-semibold text-primary">
                      +{KOSTENARTEN.map(k => Number(values[`${k.key}_${suffix}`]) || 0).reduce((a, b) => a + b, 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {/* Gesamtzeile */}
                <tr className="bg-muted/40 font-semibold">
                  <td className="py-2 px-2 border border-border text-muted-foreground">2.4</td>
                  <td className="py-2 px-2 border border-border">Gesamtzuschläge</td>
                  {KOSTENARTEN.map(k => {
                    const gesamt = ZUSCHLAGZEILEN.map(z => Number(values[`${k.key}_${z.suffix}`]) || 0).reduce((a, b) => a + b, 0);
                    return (
                      <td key={k.key} className="py-2 px-2 border border-border text-center text-primary">
                        +{gesamt.toFixed(1)}%
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 border border-border" />
                </tr>
              </tbody>
            </table>
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