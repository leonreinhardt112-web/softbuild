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
  // Verrechnungslohn
  ml_euro: 0,        // 1.1 Mittellohn ML (€/h)
  lgk_pct: 0,        // 1.2 Lohngebundene Kosten (%)
  lnk_pct: 0,        // 1.3 Lohnnebenkosten (%)
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

  // Berechnete Lohnwerte
  const ml = Number(values.ml_euro) || 0;
  const lgkPct = Number(values.lgk_pct) || 0;
  const lnkPct = Number(values.lnk_pct) || 0;
  const kl = ml * (1 + lgkPct / 100 + lnkPct / 100);
  const totalLohnZ = (Number(values.lohn_bgk) || 0) + (Number(values.lohn_agk) || 0) + (Number(values.lohn_wg) || 0);
  const vl = kl * (1 + totalLohnZ / 100);

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="w-4 h-4" />
        Zuschläge
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Kalkulation – Zuschläge & Verrechnungslohn
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
                              type="number" min="0" max="100" step="0.5"
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

          {/* ── Verrechnungslohn ── */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-foreground mb-2">Verrechnungslohn (Abschnitt 1)</p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground py-1.5 px-2 border border-border w-8">#</th>
                  <th className="text-left font-medium text-muted-foreground py-1.5 px-2 border border-border">Position</th>
                  <th className="text-center font-medium text-muted-foreground py-1.5 px-2 border border-border w-28">Zuschlag %</th>
                  <th className="text-center font-medium text-muted-foreground py-1.5 px-2 border border-border w-28">€/h</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1.5 px-2 border border-border font-bold">1.1</td>
                  <td className="py-1.5 px-2 border border-border"><div className="font-semibold">Mittellohn ML</div><div className="text-muted-foreground text-[11px]">einschl. Lohnzulagen u. Lohnerhöhung</div></td>
                  <td className="py-1.5 px-2 border border-border" />
                  <td className="py-1 px-2 border border-border">
                    <div className="relative"><Input type="number" min="0" step="0.01" value={values.ml_euro ?? 0} onChange={e => set("ml_euro", e.target.value)} className="h-7 text-right pr-7 text-xs w-full" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">€</span></div>
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2 border border-border font-bold">1.2</td>
                  <td className="py-1.5 px-2 border border-border"><div className="font-semibold">Lohngebundene Kosten</div><div className="text-muted-foreground text-[11px]">Sozialkosten und Soziallöhne, als Zuschlag auf ML</div></td>
                  <td className="py-1 px-2 border border-border"><div className="relative"><Input type="number" min="0" step="0.5" value={values.lgk_pct ?? 0} onChange={e => set("lgk_pct", e.target.value)} className="h-7 text-right pr-7 text-xs w-full" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span></div></td>
                  <td className="py-1.5 px-2 border border-border text-right pr-3 font-medium">{ml > 0 ? (ml * lgkPct / 100).toFixed(2) : "–"}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2 border border-border font-bold">1.3</td>
                  <td className="py-1.5 px-2 border border-border"><div className="font-semibold">Lohnnebenkosten</div><div className="text-muted-foreground text-[11px]">Auslösungen, Fahrgelder, als Zuschlag auf ML</div></td>
                  <td className="py-1 px-2 border border-border"><div className="relative"><Input type="number" min="0" step="0.5" value={values.lnk_pct ?? 0} onChange={e => set("lnk_pct", e.target.value)} className="h-7 text-right pr-7 text-xs w-full" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span></div></td>
                  <td className="py-1.5 px-2 border border-border text-right pr-3 font-medium">{ml > 0 ? (ml * lnkPct / 100).toFixed(2) : "–"}</td>
                </tr>
                <tr className="bg-muted/30">
                  <td className="py-1.5 px-2 border border-border font-bold">1.4</td>
                  <td className="py-1.5 px-2 border border-border"><div className="font-semibold">Kalkulationslohn KL</div><div className="text-muted-foreground text-[11px]">(Summe 1.1 bis 1.3)</div></td>
                  <td className="py-1.5 px-2 border border-border" />
                  <td className="py-1.5 px-2 border border-border text-right font-bold text-primary pr-3">{kl > 0 ? kl.toFixed(2) + " €" : "–"}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2 border border-border font-bold">1.5</td>
                  <td className="py-1.5 px-2 border border-border"><div className="font-semibold">Zuschlag auf Kalkulationslohn</div><div className="text-muted-foreground text-[11px]">(aus Zeile 2.4, Spalte 1 = {totalLohnZ.toFixed(1)} %)</div></td>
                  <td className="py-1.5 px-2 border border-border text-center font-medium text-primary">{totalLohnZ.toFixed(1)} %</td>
                  <td className="py-1.5 px-2 border border-border text-right pr-3 font-medium">{kl > 0 ? (kl * totalLohnZ / 100).toFixed(2) : "–"}</td>
                </tr>
                <tr className="bg-primary/5">
                  <td className="py-1.5 px-2 border border-border font-bold">1.6</td>
                  <td className="py-1.5 px-2 border border-border"><div className="font-semibold">Verrechnungslohn VL</div><div className="text-muted-foreground text-[11px]">(Summe 1.4 und 1.5)</div></td>
                  <td className="py-1.5 px-2 border border-border" />
                  <td className="py-1.5 px-2 border border-border text-right font-bold text-primary pr-3">{vl > 0 ? vl.toFixed(2) + " €/h" : "–"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}