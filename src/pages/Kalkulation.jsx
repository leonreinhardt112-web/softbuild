import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Calculator, Trash2, ArrowRight, Euro, Percent } from "lucide-react";
import { format } from "date-fns";
import ZuschlaegeDialog from "@/components/kalkulation/ZuschlaegeDialog";
import StammLVDialog from "@/components/kalkulation/StammLVDialog";
import KalkulationDetailDialog from "@/components/kalkulation/KalkulationDetailDialog";

const STATUS_LABELS = { entwurf: "Entwurf", eingereicht: "Eingereicht", beauftragt: "Beauftragt", abgelehnt: "Abgelehnt" };
const STATUS_COLORS = { entwurf: "bg-secondary text-secondary-foreground", eingereicht: "bg-blue-100 text-blue-700", beauftragt: "bg-green-100 text-green-700", abgelehnt: "bg-red-100 text-red-700" };

export default function Kalkulation() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingKalkId, setEditingKalkId] = useState(null);
  const [detailKalk, setDetailKalk] = useState(null);
  const [form, setForm] = useState({ project_id: "", version_name: "Hauptangebot", bgk_prozent: 10, agk_prozent: 5, wagnis_gewinn_prozent: 3, notes: "" });

  const { data: kalks = [], isLoading } = useQuery({
    queryKey: ["kalkulationen"],
    queryFn: () => base44.entities.Kalkulation.list("-created_date", 50),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Kalkulation.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kalkulationen"] }); setShowForm(false); setForm({ project_id: "", version_name: "Hauptangebot", bgk_prozent: 10, agk_prozent: 5, wagnis_gewinn_prozent: 3, notes: "" }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Kalkulation.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kalkulationen"] }); setEditingKalkId(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Kalkulation.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kalkulationen"] }),
  });

  const totalVolumen = kalks.filter(k => k.status === "beauftragt").reduce((s, k) => s + (k.angebotsumme || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kalkulation & Angebot</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Angebotsbearbeitung und Preiskalkulation</p>
        </div>
        <div className="flex gap-2">
          <StammLVDialog />
          <Button className="gap-2" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" />Neue Kalkulation</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Kalkulationen gesamt", val: kalks.length, color: "bg-primary" },
          { label: "Beauftragt", val: kalks.filter(k => k.status === "beauftragt").length, color: "bg-green-500" },
          { label: "Eingereicht", val: kalks.filter(k => k.status === "eingereicht").length, color: "bg-blue-500" },
          { label: "Beauftragtes Volumen", val: `${(totalVolumen / 1000).toFixed(0)}k €`, color: "bg-amber-500" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.val}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Neue Kalkulation anlegen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Projekt *</label>
                <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Projekt wählen..." /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name} ({p.project_number})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Versionsbezeichnung</label>
                <Input value={form.version_name} onChange={e => setForm(f => ({ ...f, version_name: e.target.value }))} />
              </div>

            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
              <Button onClick={() => createMut.mutate(form)} disabled={!form.project_id || createMut.isPending}>Anlegen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Projekt</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Version</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Angebotssumme</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">DB %</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Erstellt</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Zuschläge</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array(4).fill(0).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array(7).fill(0).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
                    </tr>
                  ))
                ) : kalks.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">Keine Kalkulationen vorhanden</td></tr>
                ) : (
                  kalks.map(k => {
                    const proj = projects.find(p => p.id === k.project_id);
                    return (
                      <tr key={k.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3 cursor-pointer hover:text-primary" onClick={() => setDetailKalk(k)}>
                          <div className="font-medium text-foreground hover:text-primary">{proj?.project_name || "–"}</div>
                          <div className="text-xs text-muted-foreground">{proj?.project_number || ""}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{k.version_name}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {k.angebotsumme ? k.angebotsumme.toLocaleString("de-DE") + " €" : "–"}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {k.deckungsbeitrag_prozent != null ? k.deckungsbeitrag_prozent.toFixed(1) + "%" : "–"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-[10px] ${STATUS_COLORS[k.status]}`}>{STATUS_LABELS[k.status]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {k.created_date ? format(new Date(k.created_date), "dd.MM.yyyy") : "–"}
                        </td>
                        <td className="px-4 py-3">
                          <ZuschlaegeDialog
                            zuschlaege={k.zuschlaege}
                            onSave={(zuschlaege) => updateMut.mutate({ id: k.id, data: { zuschlaege } })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMut.mutate(k.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <KalkulationDetailDialog
        open={!!detailKalk}
        kalkulation={detailKalk}
        projekt={detailKalk ? projects.find(p => p.id === detailKalk.project_id) : null}
        onClose={() => setDetailKalk(null)}
      />

      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong>Hinweis:</strong> Die detaillierte Positionskalkulation (Lohn, Material, Gerät, NU) wird je Kalkulation in der Projektakte verwaltet. LV-Import über das Modul Vertrag & AVor / AFU-Prüfung.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}