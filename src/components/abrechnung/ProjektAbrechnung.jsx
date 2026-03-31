import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileText, Receipt, Lock, ChevronRight, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import AufmassErfassung from "./AufmassErfassung";

const fmt = (n) => (n || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

const STATUS_COLORS = {
  entwurf: "bg-secondary text-secondary-foreground",
  freigegeben: "bg-blue-100 text-blue-700",
  abgerechnet: "bg-green-100 text-green-700",
};
const STATUS_LABELS = { entwurf: "Entwurf", freigegeben: "Freigegeben", abgerechnet: "Abgerechnet" };

export default function ProjektAbrechnung({ project, kalkulationen }) {
  const qc = useQueryClient();
  const [showNeu, setShowNeu] = useState(false);
  const [editAufmass, setEditAufmass] = useState(null);

  // Beauftragte Kalkulation (eingefroren)
  const beauftragt = kalkulationen.find(k => k.status === "beauftragt");

  const { data: aufmasse = [] } = useQuery({
    queryKey: ["aufmasse", project.id],
    queryFn: () => base44.entities.Aufmass.filter({ project_id: project.id }, "-ar_nummer"),
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

  // Wenn Aufmaß geöffnet ist
  if (editAufmass) {
    return (
      <AufmassErfassung
        aufmass={editAufmass}
        project={project}
        vorherigeAufmasse={aufmasse.filter(a => a.ar_nummer < editAufmass.ar_nummer)}
        onClose={() => { setEditAufmass(null); qc.invalidateQueries({ queryKey: ["aufmasse", project.id] }); }}
      />
    );
  }

  return (
    <div className="space-y-6">

      {/* Hinweis wenn keine beauftragte Kalkulation */}
      {!beauftragt && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Keine beauftragte Kalkulation</p>
              <p className="text-xs mt-1">Um Abschlagsrechnungen zu erstellen, muss zuerst eine Kalkulation auf Status „Beauftragt" gesetzt werden. Diese wird dann eingefroren und dient als Basis für alle Rechnungen.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Abschlagsrechnungen</h3>
          {beauftragt && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Basis: {beauftragt.version_name} · {(beauftragt.positions || []).length} Positionen · {fmt(beauftragt.angebotsumme || beauftragt.kalkulierte_herstellkosten)}
            </p>
          )}
        </div>
        <Button className="gap-2" size="sm" onClick={handleNeu} disabled={!beauftragt || createMut.isPending}>
          <Plus className="w-4 h-4" /> {naechsteNr}. AR erstellen
        </Button>
      </div>

      {/* Liste */}
      {aufmasse.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">Noch keine Abschlagsrechnungen</p>
            <p className="text-xs text-muted-foreground mt-1">Erstelle die erste AR mit Aufmaß-Erfassung</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {aufmasse.map(a => (
            <Card key={a.id} className="hover:shadow-sm transition-all cursor-pointer" onClick={() => setEditAufmass(a)}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{a.bezeichnung}</span>
                    <Badge className={`text-[10px] ${STATUS_COLORS[a.status]}`}>{STATUS_LABELS[a.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.datum ? format(new Date(a.datum), "dd.MM.yyyy") : "–"}
                    {a.abrechner ? ` · ${a.abrechner}` : ""}
                    {" · "}
                    <span className="font-medium text-foreground">{fmt(a.betrag_aktuell)} diese Periode</span>
                    {a.betrag_netto ? <span> · {fmt(a.betrag_netto)} kumuliert</span> : null}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}