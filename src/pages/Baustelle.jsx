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
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, HardHat, Cloud, Sun, CloudRain, Snowflake, Wind, Trash2, ArrowRight, FileText } from "lucide-react";
import { format } from "date-fns";

const WETTER_ICONS = { sonnig: Sun, bewoelkt: Cloud, regnerisch: CloudRain, windig: Wind, schnee: Snowflake, frost: Snowflake };
const WETTER_LABELS = { sonnig: "Sonnig", bewoelkt: "Bewölkt", regnerisch: "Regnerisch", windig: "Windig", schnee: "Schnee", frost: "Frost" };

export default function Baustelle() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    project_id: "", datum: format(new Date(), "yyyy-MM-dd"),
    wetter: "sonnig", temperatur: "", kolonnen: "", geraete: "", leistungen: "", mengen: "", besondere_ereignisse: "", bauleiter: ""
  });

  const { data: berichte = [], isLoading } = useQuery({
    queryKey: ["bautagesberichte"],
    queryFn: () => base44.entities.Bautagesbericht.list("-datum", 50),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Bautagesbericht.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bautagesberichte"] }); setShowForm(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Bautagesbericht.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bautagesberichte"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Bautagesbericht.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bautagesberichte"] }),
  });

  const aktiveProjects = projects.filter(p => p.status === "in_ausfuehrung");

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Baustelle</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Bautagesberichte, Behinderungen, Dokumentation</p>
        </div>
        <Button className="gap-2" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" />Bautagesbericht</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Aktive Baustellen", val: aktiveProjects.length, color: "bg-primary" },
          { label: "Berichte gesamt", val: berichte.length, color: "bg-purple-500" },
          { label: "Berichte heute", val: berichte.filter(b => b.datum === format(new Date(), "yyyy-MM-dd")).length, color: "bg-amber-500" },
          { label: "Freigegeben", val: berichte.filter(b => b.status === "freigegeben").length, color: "bg-green-500" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.val}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Neuer Bautagesbericht</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Projekt *</label>
                <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Projekt..." /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Datum *</label>
                <Input type="date" value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Wetter</label>
                <Select value={form.wetter} onValueChange={v => setForm(f => ({ ...f, wetter: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(WETTER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Temperatur (°C)</label>
                <Input type="number" value={form.temperatur} onChange={e => setForm(f => ({ ...f, temperatur: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bauleiter</label>
                <Input value={form.bauleiter} onChange={e => setForm(f => ({ ...f, bauleiter: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: "kolonnen", label: "Eingesetzte Kolonnen / Personal" },
                { key: "geraete", label: "Eingesetzte Geräte" },
                { key: "leistungen", label: "Ausgeführte Leistungen" },
                { key: "mengen", label: "Erbrachte Mengen" },
                { key: "besondere_ereignisse", label: "Besondere Ereignisse / Behinderungen" },
              ].map(({ key, label }) => (
                <div key={key} className={key === "besondere_ereignisse" ? "sm:col-span-2" : ""}>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
                  <textarea
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none h-20 focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
              <Button onClick={() => createMut.mutate(form)} disabled={!form.project_id || createMut.isPending}>Speichern</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Bautagesberichte</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Datum</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Projekt</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Wetter</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Bauleiter</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Leistungen (Kurzform)</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? Array(4).fill(0).map((_, i) => (
                  <tr key={i} className="border-b"><td colSpan={7} className="px-4 py-3"><Skeleton className="h-4" /></td></tr>
                )) : berichte.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">Keine Berichte vorhanden</td></tr>
                ) : berichte.map(b => {
                  const proj = projects.find(p => p.id === b.project_id);
                  const WIcon = WETTER_ICONS[b.wetter] || Cloud;
                  return (
                    <tr key={b.id} className="border-b border-border hover:bg-accent/30">
                      <td className="px-4 py-3 font-medium text-xs">{b.datum ? format(new Date(b.datum), "dd.MM.yyyy") : "–"}</td>
                      <td className="px-4 py-3 text-xs">{proj?.project_name || "–"}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <WIcon className="w-3.5 h-3.5" />{WETTER_LABELS[b.wetter] || b.wetter}
                          {b.temperatur ? ` · ${b.temperatur}°C` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{b.bauleiter || "–"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{b.leistungen || "–"}</td>
                      <td className="px-4 py-3">
                        <Badge className={b.status === "freigegeben" ? "bg-green-100 text-green-700 text-[10px]" : "bg-secondary text-secondary-foreground text-[10px]"}>
                          {b.status === "freigegeben" ? "Freigegeben" : "Entwurf"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 flex gap-1">
                        {b.status === "entwurf" && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateMut.mutate({ id: b.id, data: { status: "freigegeben" } })}>
                            Freigeben
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMut.mutate(b.id)}>
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
    </div>
  );
}