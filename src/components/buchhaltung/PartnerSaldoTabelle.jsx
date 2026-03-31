import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const fmt = (v) => v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export default function PartnerSaldoTabelle({ rechnungen, eingangsRechnungen, projects }) {
  // Debitoren: je Auftraggeber aggregieren
  const debitorMap = {};
  rechnungen.filter(r => r.status !== "storniert").forEach(r => {
    const proj = projects.find(p => p.id === r.project_id);
    const name = proj?.client || "Unbekannt";
    if (!debitorMap[name]) debitorMap[name] = { name, forderungen: 0, eingegangen: 0 };
    debitorMap[name].forderungen += r.betrag_brutto || 0;
    debitorMap[name].eingegangen += r.zahlungseingang || 0;
  });

  // Kreditoren: je NU/Lieferant aggregieren
  const kreditorMap = {};
  eingangsRechnungen.filter(r => r.status !== "storniert").forEach(r => {
    const name = r.kreditor_name || "Unbekannt";
    if (!kreditorMap[name]) kreditorMap[name] = { name, verbindlichkeiten: 0, ausgegangen: 0 };
    kreditorMap[name].verbindlichkeiten += r.betrag_brutto || 0;
    kreditorMap[name].ausgegangen += r.zahlungsausgang || 0;
  });

  const debitoren = Object.values(debitorMap).sort((a, b) => (b.forderungen - b.eingegangen) - (a.forderungen - a.eingegangen));
  const kreditoren = Object.values(kreditorMap).sort((a, b) => (b.verbindlichkeiten - b.ausgegangen) - (a.verbindlichkeiten - a.ausgegangen));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Debitoren */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border bg-blue-50/60">
            <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Debitoren-Saldo (Forderungen an Auftraggeber)
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Auftraggeber</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Gesamt</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Eingegangen</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Offen</th>
              </tr>
            </thead>
            <tbody>
              {debitoren.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">Keine Daten</td></tr>
              ) : debitoren.map(d => {
                const offen = d.forderungen - d.eingegangen;
                return (
                  <tr key={d.name} className="border-b border-border hover:bg-accent/30">
                    <td className="px-4 py-3 text-xs font-medium">{d.name}</td>
                    <td className="px-4 py-3 text-xs text-right text-muted-foreground">{fmt(d.forderungen)}</td>
                    <td className="px-4 py-3 text-xs text-right text-green-700">{fmt(d.eingegangen)}</td>
                    <td className={`px-4 py-3 text-xs text-right font-semibold ${offen > 0 ? "text-amber-600" : "text-green-600"}`}>
                      {fmt(offen)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {debitoren.length > 0 && (
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-4 py-2.5 text-xs">Gesamt</td>
                  <td className="px-4 py-2.5 text-xs text-right">{fmt(debitoren.reduce((s, d) => s + d.forderungen, 0))}</td>
                  <td className="px-4 py-2.5 text-xs text-right text-green-700">{fmt(debitoren.reduce((s, d) => s + d.eingegangen, 0))}</td>
                  <td className="px-4 py-2.5 text-xs text-right text-amber-600">{fmt(debitoren.reduce((s, d) => s + d.forderungen - d.eingegangen, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>

      {/* Kreditoren */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border bg-red-50/60">
            <p className="text-xs font-semibold text-red-800 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" /> Kreditoren-Saldo (Verbindlichkeiten an NU/Lieferanten)
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Kreditor</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Gesamt</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Bezahlt</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Offen</th>
              </tr>
            </thead>
            <tbody>
              {kreditoren.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">Keine Daten</td></tr>
              ) : kreditoren.map(k => {
                const offen = k.verbindlichkeiten - k.ausgegangen;
                return (
                  <tr key={k.name} className="border-b border-border hover:bg-accent/30">
                    <td className="px-4 py-3 text-xs font-medium">{k.name}</td>
                    <td className="px-4 py-3 text-xs text-right text-muted-foreground">{fmt(k.verbindlichkeiten)}</td>
                    <td className="px-4 py-3 text-xs text-right text-green-700">{fmt(k.ausgegangen)}</td>
                    <td className={`px-4 py-3 text-xs text-right font-semibold ${offen > 0 ? "text-red-600" : "text-green-600"}`}>
                      {fmt(offen)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {kreditoren.length > 0 && (
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-4 py-2.5 text-xs">Gesamt</td>
                  <td className="px-4 py-2.5 text-xs text-right">{fmt(kreditoren.reduce((s, k) => s + k.verbindlichkeiten, 0))}</td>
                  <td className="px-4 py-2.5 text-xs text-right text-green-700">{fmt(kreditoren.reduce((s, k) => s + k.ausgegangen, 0))}</td>
                  <td className="px-4 py-2.5 text-xs text-right text-red-600">{fmt(kreditoren.reduce((s, k) => s + k.verbindlichkeiten - k.ausgegangen, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  );
}