import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileText, Receipt, Lock, ChevronRight, AlertTriangle, Trash2, FlagTriangleRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import AufmassErfassung from "./AufmassErfassung";
import SchlussrechnungErfassung from "./SchlussrechnungErfassung";

const fmt = (n) => (n || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

const STATUS_COLORS = {
  entwurf: "bg-secondary text-secondary-foreground",
  freigegeben: "bg-blue-100 text-blue-700",
  abgerechnet: "bg-green-100 text-green-700",
};
const STATUS_LABELS = { entwurf: "Entwurf", freigegeben: "Freigegeben", abgerechnet: "Abgerechnet" };

export default function ProjektAbrechnung({ project, kalkulationen, stammdaten }) {
  const qc = useQueryClient();
  const [showNeu, setShowNeu] = useState(false);
  const [editAufmass, setEditAufmass] = useState(null);
  const [editSchluss, setEditSchluss] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => { base44.auth.me().then(u => setCurrentUser(u)).catch(() => {}); }, []);

  // Beauftragte Kalkulation (eingefroren)
  const beauftragt = kalkulationen.find(k => k.status === "beauftragt");

  const { data: aufmasse = [] } = useQuery({
    queryKey: ["aufmasse", project.id],
    queryFn: () => base44.entities.Aufmass.filter({ project_id: project.id }, "-ar_nummer"),
    enabled: !!project.id,
  });

  const { data: rechnungen = [] } = useQuery({
    queryKey: ["rechnungen", project.id],
    queryFn: () => base44.entities.Rechnung.filter({ project_id: project.id }, "-rechnungsdatum"),
    enabled: !!project.id,
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Aufmass.create(d),
    onSuccess: (neu) => {
      qc.invalidateQueries({ queryKey: ["aufmasse", project.id] });
      setShowNeu(false);
      setEditAufmass(neu);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Aufmass.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["aufmasse", project.id] }); setDeleteConfirm(null); },
  });

  const createSchlussrechnungMut = useMutation({
    mutationFn: (d) => base44.entities.Aufmass.create(d),
    onSuccess: (neu) => {
      qc.invalidateQueries({ queryKey: ["aufmasse", project.id] });
      setEditSchluss(neu);
    },
  });

  const handleNeuSchlussrechnung = () => {
    if (!beauftragt) return;
    createSchlussrechnungMut.mutate({
      project_id: project.id,
      kalkulation_id: beauftragt.id,
      ar_nummer: 9999, // Kennzeichen für Schlussrechnung
      bezeichnung: "Schlussrechnung",
      datum: new Date().toISOString().split("T")[0],
      status: "entwurf",
      positionen: (beauftragt.positions || []).map(p => ({
        oz: p.oz,
        short_text: p.short_text,
        einheit: p.einheit,
        ep: p.ep || 0,
        menge_lv: p.menge || 0,
        aufmass_zeilen: [],
        menge_gesamt: 0,
        gp_gesamt: 0,
      })),
      notes: "schlussrechnung",
    });
  };

  const naechsteNr = (aufmasse.length > 0 ? Math.max(...aufmasse.map(a => a.ar_nummer || 0)) : 0) + 1;

  const handleNeu = () => {
    if (!beauftragt) return;
    createMut.mutate({
      project_id: project.id,
      kalkulation_id: beauftragt.id,
      ar_nummer: naechsteNr,
      bezeichnung: `${naechsteNr}. Abschlagsrechnung`,
      datum: new Date().toISOString().split("T")[0],
      status: "entwurf",
      positionen: (beauftragt.positions || []).map(p => ({
        oz: p.oz,
        short_text: p.short_text,
        einheit: p.einheit,
        ep: p.ep || 0,
        menge_lv: p.menge || 0,
        aufmass_zeilen: [],
        menge_aktuell: 0,
        menge_vorperioden: 0,
        menge_kumuliert: 0,
        gp_aktuell: 0,
        gp_kumuliert: 0,
      })),
    });
  };

  // Schlussrechnung vs AR trennen
  const arListe = aufmasse.filter(a => a.notes !== "schlussrechnung" && a.ar_nummer !== 9999);
  const schlussrechnungen = aufmasse.filter(a => a.notes === "schlussrechnung" || a.ar_nummer === 9999);
  const hatSchlussrechnung = schlussrechnungen.length > 0;

  // Wenn Aufmaß geöffnet
  if (editAufmass) {
    return (
      <AufmassErfassung
        aufmass={editAufmass}
        project={project}
        vorherigeAufmasse={arListe.filter(a => a.ar_nummer < editAufmass.ar_nummer)}
        stammdaten={stammdaten}
        onClose={() => { setEditAufmass(null); qc.invalidateQueries({ queryKey: ["aufmasse", project.id] }); }}
      />
    );
  }

  // Wenn Schlussrechnung geöffnet
  if (editSchluss) {
    return (
      <SchlussrechnungErfassung
        schlussrechnung={editSchluss}
        project={project}
        kalkulation={beauftragt}
        vorherigeAufmasse={arListe}
        stammdaten={stammdaten}
        onClose={() => { setEditSchluss(null); qc.invalidateQueries({ queryKey: ["aufmasse", project.id] }); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abschlagsrechnung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteConfirm?.bezeichnung}" wird unwiderruflich gelöscht.
              {deleteConfirm?.status !== "entwurf" && " ⚠️ Diese AR ist bereits freigegeben – nur im Admin-Modus löschbar."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMut.mutate(deleteConfirm.id)}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hinweis wenn kein beauftragtes Angebot */}
      {!beauftragt && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Kein beauftragtes Angebot vorhanden</p>
              <p className="text-xs mt-1">Um Abschlagsrechnungen zu erstellen, muss zuerst ein Angebot im Reiter „Kalkulation" auf Status „Beauftragt" gesetzt werden. Das Angebot wird dann eingefroren und dient als Basis für alle Rechnungen.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header ARs */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Abschlagsrechnungen</h3>
          {beauftragt && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Basis: {beauftragt.version_name} · {(beauftragt.positions || []).length} Positionen · {fmt(beauftragt.angebotsumme || beauftragt.kalkulierte_herstellkosten)}
            </p>
          )}
        </div>
        <Button className="gap-2" size="sm" onClick={handleNeu} disabled={!beauftragt || createMut.isPending || hatSchlussrechnung}>
          <Plus className="w-4 h-4" /> {naechsteNr}. AR erstellen
        </Button>
      </div>

      {/* AR-Liste */}
      {arListe.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">Noch keine Abschlagsrechnungen</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {arListe.map(a => (
            <Card key={a.id} className="hover:shadow-sm transition-all cursor-pointer" onClick={() => setEditAufmass(a)}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{a.bezeichnung}</span>
                    <Badge className={`text-[10px] ${STATUS_COLORS[a.status]}`}>{STATUS_LABELS[a.status]}</Badge>
                    {a.rechnungsnummer && (
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border text-muted-foreground flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> {a.rechnungsnummer}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.datum ? format(new Date(a.datum), "dd.MM.yyyy") : "–"}
                    {a.abrechner ? ` · ${a.abrechner}` : ""}
                    {" · "}
                    <span className="font-medium text-foreground">{fmt(a.betrag_aktuell)} diese Periode</span>
                    {a.betrag_netto ? <span> · {fmt(a.betrag_netto)} kumuliert</span> : null}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {(a.status === "entwurf" || currentUser?.role === "admin") && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(a); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Schlussrechnung-Bereich */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <FlagTriangleRight className="w-4 h-4 text-green-600" /> Schlussrechnung
          </h3>
          {!hatSchlussrechnung && (
            <Button size="sm" variant="outline" className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
              onClick={handleNeuSchlussrechnung} disabled={!beauftragt || createSchlussrechnungMut.isPending}>
              <Plus className="w-4 h-4" /> Schlussrechnung erstellen
            </Button>
          )}
        </div>

        {hatSchlussrechnung ? (
          <div className="space-y-2">
            {schlussrechnungen.map(sr => (
              <Card key={sr.id} className="hover:shadow-sm transition-all cursor-pointer border-green-200" onClick={() => setEditSchluss(sr)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <FlagTriangleRight className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">Schlussrechnung</span>
                      <Badge className={`text-[10px] ${STATUS_COLORS[sr.status]}`}>{STATUS_LABELS[sr.status]}</Badge>
                      {sr.rechnungsnummer && (
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border text-muted-foreground flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> {sr.rechnungsnummer}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sr.datum ? format(new Date(sr.datum), "dd.MM.yyyy") : "–"}
                      {sr.betrag_aktuell ? <span> · Restbetrag: <span className="font-medium text-foreground">{fmt(sr.betrag_aktuell)}</span></span> : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(sr.status === "entwurf" || currentUser?.role === "admin") && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(sr); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-green-200">
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">Noch keine Schlussrechnung</p>
              <p className="text-xs text-muted-foreground mt-1">Erstelle die Schlussrechnung nach Abschluss aller Abschlagsrechnungen</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}