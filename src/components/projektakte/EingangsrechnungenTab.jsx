import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, FileText, Eye, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ZahlungskuerzungDialog } from "@/components/buchhaltung/ZahlungskuerzungDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmt = (v) => v ? v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "–";
const fmtDate = (d) => { try { return d ? format(parseISO(d), "dd.MM.yy") : "–"; } catch { return "–"; } };

const STATUS_COLORS = {
  eingegangen: "bg-secondary text-secondary-foreground",
  geprueft: "bg-green-100 text-green-700",
  freigegeben: "bg-blue-100 text-blue-700",
  teilbezahlt: "bg-amber-100 text-amber-700",
  bezahlt: "bg-green-100 text-green-700",
  gesperrt: "bg-red-100 text-red-700",
  storniert: "bg-gray-100 text-gray-500"
};

const STATUS_LABELS = {
  eingegangen: "Eingegangen",
  geprueft: "Geprüft",
  freigegeben: "Freigegeben",
  teilbezahlt: "Teilbezahlt",
  bezahlt: "Bezahlt",
  gesperrt: "Gesperrt",
  storniert: "Storniert"
};

export default function EingangsrechnungenTab({ projectId, currentUser }) {
  const qc = useQueryClient();
  const [kuerzungRechnung, setKuerzungRechnung] = useState(null);
  const [showDatei, setShowDatei] = useState(null);

  const { data: eingangsRechnungen = [] } = useQuery({
    queryKey: ["eingangsRechnungen-project", projectId],
    queryFn: () => base44.entities.EingangsRechnung.filter({ project_id: projectId }, "-rechnungsdatum", 200),
    enabled: !!projectId
  });

  const updateEingang = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EingangsRechnung.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eingangsRechnungen-project", projectId] });
      qc.invalidateQueries({ queryKey: ["eingangsRechnungen"] });
      setKuerzungRechnung(null);
    }
  });

  // Nur baustellenbezogene Rechnungen (nicht storniert)
  const rechnungen = eingangsRechnungen.filter(r => r.status !== "storniert");
  const pruefungAusstaend = rechnungen.filter(r => r.status === "eingegangen").length;

  const handleMarkAsPrueft = (r) => {
    updateEingang.mutate({ id: r.id, data: { status: "geprueft" } });
  };

  const handleMarkAsFreigegeben = (r) => {
    updateEingang.mutate({ id: r.id, data: { status: "freigegeben" } });
  };

  if (!rechnungen.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Keine Eingangsrechnungen für dieses Projekt vorhanden</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info-Banner */}
      {pruefungAusstaend > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-xs text-amber-700 font-semibold">
              {pruefungAusstaend} Eingangsrechnung(en) warten auf deine Prüfung
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabelle */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Rechnungsnummer</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Kreditor</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Datum</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Betrag netto</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Datei</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rechnungen.map(r => (
              <tr key={r.id} className={`border-b border-border ${r.status === "eingegangen" ? "bg-amber-50/20" : "hover:bg-accent/30"}`}>
                <td className="px-4 py-3 text-xs font-medium">{r.rechnungsnummer}</td>
                <td className="px-4 py-3 text-xs font-medium">{r.kreditor_name || "–"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.rechnungsdatum)}</td>
                <td className="px-4 py-3 text-xs text-right font-medium">{fmt(r.betrag_netto)}</td>
                <td className="px-4 py-3">
                  <Badge className={`text-[10px] ${STATUS_COLORS[r.status] || "bg-secondary"}`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.datei_url ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setShowDatei(r)}
                    >
                      <Eye className="w-3 h-3" />Anschauen
                    </Button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">–</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap flex items-center gap-1">
                  {r.status === "eingegangen" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleMarkAsPrueft(r)}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />Geprüft
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-amber-600"
                        onClick={() => setKuerzungRechnung(r)}
                      >
                        Kürzung
                      </Button>
                    </>
                  )}
                  {r.status === "geprueft" && (
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleMarkAsFreigegeben(r)}
                    >
                      Für Buchhaltung freigeben
                    </Button>
                  )}
                  {["freigegeben", "teilbezahlt", "bezahlt"].includes(r.status) && (
                    <span className="text-[10px] text-green-600 font-semibold">✓ Freigegeben</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Zahlungskürzung-Dialog */}
       <ZahlungskuerzungDialog
         rechnung={kuerzungRechnung}
         open={!!kuerzungRechnung}
         onClose={() => setKuerzungRechnung(null)}
         onSave={(id, data) => {
           updateEingang.mutate({ id, data });
         }}
       />

       {/* Datei-Anschauen Dialog */}
       <Dialog open={!!showDatei} onOpenChange={(open) => !open && setShowDatei(null)}>
         <DialogContent className="max-w-5xl max-h-[95vh]">
           <DialogHeader>
             <DialogTitle>{showDatei?.rechnungsnummer} – {showDatei?.kreditor_name}</DialogTitle>
           </DialogHeader>
           {showDatei?.datei_url && (
             <div className="space-y-3">
               <div className="flex justify-end gap-2">
                 <a
                   href={showDatei.datei_url}
                   download={showDatei.datei_name || `${showDatei.rechnungsnummer}.pdf`}
                   target="_blank"
                   rel="noreferrer"
                   className="inline-flex items-center gap-1"
                 >
                   <Button size="sm" variant="outline" className="gap-1">
                     <Download className="w-3.5 h-3.5" />Herunterladen
                   </Button>
                 </a>
               </div>
               {showDatei.datei_url.endsWith(".pdf") ? (
                 <iframe
                   src={showDatei.datei_url}
                   className="w-full h-[750px] border rounded-lg"
                   title="Rechnung anschauen"
                 />
               ) : (
                 <img
                   src={showDatei.datei_url}
                   alt="Rechnung"
                   className="w-full border rounded-lg max-h-[750px] object-contain"
                 />
               )}
             </div>
           )}
         </DialogContent>
       </Dialog>
      </div>
      );
      }