import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bell } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import MahnungDialog from "./MahnungDialog";

const fmt = (v) => v ? v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "–";
const fmtDate = (d) => { try { return d ? format(parseISO(d), "dd.MM.yy") : "–"; } catch { return "–"; } };

const STUFE_COLORS = { 0: "bg-amber-100 text-amber-700", 1: "bg-orange-100 text-orange-700", 2: "bg-red-100 text-red-700", 3: "bg-red-200 text-red-800" };
const STUFE_LABELS = { 0: "Überfällig", 1: "1. Mahnung", 2: "2. Mahnung", 3: "Letzte Mahnung" };

export default function MahnwesenTabelle({ rechnungen, projects, stammdaten, onMahnungSave }) {
  const [selected, setSelected] = useState(null);

  // Nur überfällige, nicht bezahlte Rechnungen (ohne Zahlungseingang = echte offene Posten)
  const ueberfaellig = rechnungen.filter(r => {
    if (["bezahlt", "storniert", "entwurf"].includes(r.status)) return false;
    if ((r.zahlungseingang || 0) > 0) return false; // Sobald Zahlungseingang existiert → nicht ins Mahnwesen
    const offen = (r.betrag_brutto || 0) - (r.einbehalt || 0);
    if (offen <= 0) return false;
    if (!r.faellig_am) return false;
    return differenceInDays(new Date(), parseISO(r.faellig_am)) > 0;
  }).sort((a, b) => {
    const dA = a.faellig_am ? differenceInDays(new Date(), parseISO(a.faellig_am)) : 0;
    const dB = b.faellig_am ? differenceInDays(new Date(), parseISO(b.faellig_am)) : 0;
    return dB - dA; // älteste zuerst
  });

  if (ueberfaellig.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Keine überfälligen Rechnungen – alles im grünen Bereich.</p>
      </div>
    );
  }

  const selectedRechnung = ueberfaellig.find(r => r.id === selected);
  const selectedProjekt = projects?.find(p => p.id === selectedRechnung?.project_id);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Re-Nr.</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Auftraggeber</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Projekt</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Fällig am</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Überfällig seit</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Offen</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Mahngebühren</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Mahnstufe</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {ueberfaellig.map(r => {
              const proj = projects?.find(p => p.id === r.project_id);
              const offen = (r.betrag_brutto || 0) - (r.zahlungseingang || 0) - (r.einbehalt || 0);
              const tage = differenceInDays(new Date(), parseISO(r.faellig_am));
              const stufe = r.mahnstufe || 0;

              return (
                <tr key={r.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-4 py-3 text-xs font-medium">{r.rechnungsnummer}</td>
                  <td className="px-4 py-3 text-xs font-medium">{proj?.client || "–"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{proj?.project_name || "–"}</td>
                  <td className="px-4 py-3 text-xs text-red-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />{fmtDate(r.faellig_am)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-red-700">{tage} Tage</td>
                  <td className="px-4 py-3 text-xs text-right font-bold text-amber-600">{fmt(offen)}</td>
                  <td className="px-4 py-3 text-xs text-right text-muted-foreground">
                    {(r.mahngebuehr || 0) > 0 ? fmt(r.mahngebuehr) : "–"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${STUFE_COLORS[stufe]}`}>
                      {STUFE_LABELS[stufe]}
                    </Badge>
                    {r.letzte_mahnung_am && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">zuletzt {fmtDate(r.letzte_mahnung_am)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {stufe < 3 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                        onClick={() => setSelected(r.id)}>
                        <AlertTriangle className="w-3 h-3" /> Mahnen
                      </Button>
                    )}
                    {stufe >= 3 && (
                      <span className="text-[10px] text-red-600 font-semibold">Letzte Mahnung gestellt</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedRechnung && (
        <MahnungDialog
          open={!!selected}
          rechnung={selectedRechnung}
          projekt={selectedProjekt}
          stammdaten={stammdaten}
          onClose={() => setSelected(null)}
          onSave={(id, data) => {
            onMahnungSave(id, data);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}