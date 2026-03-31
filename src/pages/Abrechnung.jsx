import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Receipt, Trash2, Euro, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { format } from "date-fns";
import PositionsRechnungDialog from "@/components/abrechnung/PositionsRechnungDialog";

const R_STATUS_COLORS = {
  entwurf: "bg-secondary text-secondary-foreground",
  gestellt: "bg-blue-100 text-blue-700",
  teilbezahlt: "bg-amber-100 text-amber-700",
  bezahlt: "bg-green-100 text-green-700",
  gemahnt: "bg-red-100 text-red-700",
  storniert: "bg-gray-100 text-gray-500",
};
const R_STATUS_LABELS = {
  entwurf: "Entwurf", gestellt: "Gestellt", teilbezahlt: "Teilbezahlt",
  bezahlt: "Bezahlt", gemahnt: "Gemahnt", storniert: "Storniert",
};
const N_STATUS_COLORS = {
  angemeldet: "bg-secondary text-secondary-foreground",
  eingereicht: "bg-blue-100 text-blue-700",
  in_verhandlung: "bg-amber-100 text-amber-700",
  beauftragt: "bg-green-100 text-green-700",
  abgelehnt: "bg-red-100 text-red-700",
};
const N_STATUS_LABELS = {
  angemeldet: "Angemeldet", eingereicht: "Eingereicht", in_verhandlung: "In Verhandlung",
  beauftragt: "Beauftragt", abgelehnt: "Abgelehnt",
};

export default function Abrechnung() {
  const qc = useQueryClient();
  const [showRForm, setShowRForm] = useState(false);
  const [showPosRDialog, setShowPosRDialog] = useState(false);
  const [showNForm, setShowNForm] = useState(false);
  const [rForm, setRForm] = useState({
    project_id: "", rechnungsnummer: "", rechnungsart: "abschlagsrechnung",
    rechnungsdatum: format(new Date(), "yyyy-MM-dd"), betrag_netto: "", mwst_satz: 19,
  });
  const [nForm, setNForm] = useState({
    project_id: "", nachtrag_nr: "", bezeichnung: "", grund: "Zusatzleistung", betrag_angemeldet: ""
  });

  const { data: rechnungen = [], isLoading: rLoading } = useQuery({
    queryKey: ["rechnungen"],
    queryFn: () => base44.entities.Rechnung.list("-rechnungsdatum", 100),
  });
  const { data: nachtraege = [], isLoading: nLoading } = useQuery({
    queryKey: ["nachtraege"],
    queryFn: () => base44.entities.Nachtrag.list("-created_date", 100),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });
  const { data: kalkulationen = [] } = useQuery({
    queryKey: ["kalkulationen"],
    queryFn: () => base44.entities.Kalkulation.list("-created_date", 100),
  });

  const createR = useMutation({
    mutationFn: (d) => {
      // Wenn betrag_brutto bereits gesetzt (aus Positionsdialog), direkt übernehmen
      if (d.betrag_brutto) return base44.entities.Rechnung.create(d);
      const netto = parseFloat(d.betrag_netto) || 0;
      const brutto = netto * (1 + d.mwst_satz / 100);
      return base44.entities.Rechnung.create({ ...d, betrag_netto: netto, betrag_brutto: brutto });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rechnungen"] }); setShowRForm(false); setShowPosRDialog(false); },
  });
  const deleteR = useMutation({
    mutationFn: (id) => base44.entities.Rechnung.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rechnungen"] }),
  });
  const updateR = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Rechnung.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rechnungen"] }),
  });

  const createN = useMutation({
    mutationFn: (d) => base44.entities.Nachtrag.create({ ...d, betrag_angemeldet: parseFloat(d.betrag_angemeldet) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nachtraege"] }); setShowNForm(false); },
  });
  const deleteN = useMutation({
    mutationFn: (id) => base44.entities.Nachtrag.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nachtraege"] }),
  });
  const updateN = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Nachtrag.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nachtraege"] }),
  });

  const offeneForderungen = rechnungen.filter(r => !["bezahlt", "storniert"].includes(r.status))
    .reduce((s, r) => s + ((r.betrag_brutto || 0) - (r.zahlungseingang || 0)), 0);
  const gestelltVolumen = rechnungen.filter(r => r.status !== "storniert").reduce((s, r) => s + (r.betrag_netto || 0), 0);
  const nachtragsVolumen = nachtraege.filter(n => n.status === "beauftragt").reduce((s, n) => s + (n.betrag_beauftragt || n.betrag_angemeldet || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Abrechnung</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Rechnungen, Nachträge und Forderungsmanagement</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Offene Forderungen", val: `${offeneForderungen.toLocaleString("de-DE", { maximumFractionDigits: 0 })} €`, color: "bg-amber-500" },
          { label: "Gestelltes Volumen", val: `${(gestelltVolumen / 1000).toFixed(0)}k €`, color: "bg-primary" },
          { label: "Beauftragte Nachträge", val: `${(nachtragsVolumen / 1000).toFixed(0)}k €`, color: "bg-green-500" },
          { label: "Offene Nachträge", val: nachtraege.filter(n => ["angemeldet", "eingereicht", "in_verhandlung"].includes(n.status)).length, color: "bg-destructive" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.val}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="rechnungen">
        <TabsList>
          <TabsTrigger value="rechnungen" className="text-xs">Rechnungen</TabsTrigger>
          <TabsTrigger value="nachtraege" className="text-xs">Nachträge</TabsTrigger>
        </TabsList>

        <TabsContent value="rechnungen" className="mt-4 space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowPosRDialog(true)}>
              <FileText className="w-4 h-4" /> Aus Kalkulation erstellen
            </Button>
            <Button className="gap-2" onClick={() => setShowRForm(true)}>
              <Plus className="w-4 h-4" /> Manuell anlegen
            </Button>
          </div>

          {showRForm && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Neue Rechnung</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Projekt *</label>
                    <Select value={rForm.project_id} onValueChange={v => setRForm(f => ({ ...f, project_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Projekt..." /></SelectTrigger>
                      <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Rechnungsnummer *</label>
                    <Input value={rForm.rechnungsnummer} onChange={e => setRForm(f => ({ ...f, rechnungsnummer: e.target.value }))} placeholder="2024-001" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Art</label>
                    <Select value={rForm.rechnungsart} onValueChange={v => setRForm(f => ({ ...f, rechnungsart: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="abschlagsrechnung">Abschlagsrechnung</SelectItem>
                        <SelectItem value="schlussrechnung">Schlussrechnung</SelectItem>
                        <SelectItem value="teilrechnung">Teilrechnung</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Datum</label>
                    <Input type="date" value={rForm.rechnungsdatum} onChange={e => setRForm(f => ({ ...f, rechnungsdatum: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Betrag netto (€)</label>
                    <Input type="number" value={rForm.betrag_netto} onChange={e => setRForm(f => ({ ...f, betrag_netto: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">MwSt (%)</label>
                    <Input type="number" value={rForm.mwst_satz} onChange={e => setRForm(f => ({ ...f, mwst_satz: +e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowRForm(false)}>Abbrechen</Button>
                  <Button onClick={() => createR.mutate(rForm)} disabled={!rForm.project_id || !rForm.rechnungsnummer || createR.isPending}>Anlegen</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Re-Nr.</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Projekt</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Art</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Datum</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Netto</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Brutto</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Offen</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rLoading ? Array(4).fill(0).map((_, i) => (
                      <tr key={i} className="border-b"><td colSpan={9} className="px-4 py-3"><Skeleton className="h-4" /></td></tr>
                    )) : rechnungen.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">Keine Rechnungen vorhanden</td></tr>
                    ) : rechnungen.map(r => {
                      const proj = projects.find(p => p.id === r.project_id);
                      const offen = (r.betrag_brutto || 0) - (r.zahlungseingang || 0);
                      return (
                        <tr key={r.id} className="border-b border-border hover:bg-accent/30">
                          <td className="px-4 py-3 font-medium text-xs">{r.rechnungsnummer}</td>
                          <td className="px-4 py-3 text-xs">{proj?.project_name || "–"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{r.rechnungsart?.replace("rechnung", "").replace("schlag", "schlag-") || "–"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{r.rechnungsdatum ? format(new Date(r.rechnungsdatum), "dd.MM.yyyy") : "–"}</td>
                          <td className="px-4 py-3 text-right text-xs">{r.betrag_netto ? r.betrag_netto.toLocaleString("de-DE", { maximumFractionDigits: 2 }) + " €" : "–"}</td>
                          <td className="px-4 py-3 text-right text-xs font-medium">{r.betrag_brutto ? r.betrag_brutto.toLocaleString("de-DE", { maximumFractionDigits: 2 }) + " €" : "–"}</td>
                          <td className={`px-4 py-3 text-right text-xs font-semibold ${offen > 0 ? "text-amber-600" : "text-green-600"}`}>
                            {offen > 0 ? offen.toLocaleString("de-DE", { maximumFractionDigits: 2 }) + " €" : "–"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`text-[10px] ${R_STATUS_COLORS[r.status]}`}>{R_STATUS_LABELS[r.status]}</Badge>
                          </td>
                          <td className="px-4 py-3 flex gap-1">
                            {r.status === "gestellt" && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600"
                                onClick={() => updateR.mutate({ id: r.id, data: { status: "bezahlt", zahlungseingang: r.betrag_brutto } })}>
                                Bezahlt
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteR.mutate(r.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nachtraege" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setShowNForm(true)}><Plus className="w-4 h-4" />Nachtrag anlegen</Button>
          </div>

          {showNForm && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Neuer Nachtrag</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Projekt *</label>
                    <Select value={nForm.project_id} onValueChange={v => setNForm(f => ({ ...f, project_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Projekt..." /></SelectTrigger>
                      <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nachtrags-Nr.</label>
                    <Input value={nForm.nachtrag_nr} onChange={e => setNForm(f => ({ ...f, nachtrag_nr: e.target.value }))} placeholder="N-001" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Grund</label>
                    <Select value={nForm.grund} onValueChange={v => setNForm(f => ({ ...f, grund: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Mengenabweichung", "Zusatzleistung", "Behinderung", "Planungsaenderung", "Baugrundrisiko", "Sonstiges"].map(g =>
                          <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bezeichnung *</label>
                    <Input value={nForm.bezeichnung} onChange={e => setNForm(f => ({ ...f, bezeichnung: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Betrag angemeldet (€ netto)</label>
                    <Input type="number" value={nForm.betrag_angemeldet} onChange={e => setNForm(f => ({ ...f, betrag_angemeldet: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowNForm(false)}>Abbrechen</Button>
                  <Button onClick={() => createN.mutate(nForm)} disabled={!nForm.project_id || !nForm.bezeichnung || createN.isPending}>Anlegen</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Nr.</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Projekt</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Bezeichnung</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Grund</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Angemeldet</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Beauftragt</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {nLoading ? Array(4).fill(0).map((_, i) => (
                      <tr key={i} className="border-b"><td colSpan={8} className="px-4 py-3"><Skeleton className="h-4" /></td></tr>
                    )) : nachtraege.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">Keine Nachträge vorhanden</td></tr>
                    ) : nachtraege.map(n => {
                      const proj = projects.find(p => p.id === n.project_id);
                      return (
                        <tr key={n.id} className="border-b border-border hover:bg-accent/30">
                          <td className="px-4 py-3 font-medium text-xs">{n.nachtrag_nr || "–"}</td>
                          <td className="px-4 py-3 text-xs">{proj?.project_name || "–"}</td>
                          <td className="px-4 py-3 text-xs max-w-xs truncate">{n.bezeichnung}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{n.grund}</td>
                          <td className="px-4 py-3 text-right text-xs">{n.betrag_angemeldet ? n.betrag_angemeldet.toLocaleString("de-DE", { maximumFractionDigits: 2 }) + " €" : "–"}</td>
                          <td className="px-4 py-3 text-right text-xs font-medium text-green-700">{n.betrag_beauftragt ? n.betrag_beauftragt.toLocaleString("de-DE", { maximumFractionDigits: 2 }) + " €" : "–"}</td>
                          <td className="px-4 py-3">
                            <Select value={n.status} onValueChange={v => updateN.mutate({ id: n.id, data: { status: v } })}>
                              <SelectTrigger className="h-7 text-xs w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(N_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteN.mutate(n.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PositionsRechnungDialog
        open={showPosRDialog}
        onClose={() => setShowPosRDialog(false)}
        onSave={(d) => createR.mutate(d)}
        projects={projects}
        kalkulationen={kalkulationen}
        vorherige_rechnungen={rechnungen}
      />
    </div>
  );
}