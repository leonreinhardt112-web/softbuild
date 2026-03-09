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
import { Plus, Trash2, Search, Database, Users, Truck, Package } from "lucide-react";

const TYP_LABELS = {
  auftraggeber: "Auftraggeber", nachunternehmer: "Nachunternehmer", lieferant: "Lieferant",
  mitarbeiter: "Mitarbeiter", geraet: "Gerät", material: "Material",
};
const TYP_COLORS = {
  auftraggeber: "bg-blue-100 text-blue-700", nachunternehmer: "bg-purple-100 text-purple-700",
  lieferant: "bg-amber-100 text-amber-700", mitarbeiter: "bg-green-100 text-green-700",
  geraet: "bg-orange-100 text-orange-700", material: "bg-gray-100 text-gray-700",
};

const TABS = [
  { key: "auftraggeber", label: "Auftraggeber" },
  { key: "nachunternehmer", label: "Nachunternehmer" },
  { key: "lieferant", label: "Lieferanten" },
  { key: "mitarbeiter", label: "Mitarbeiter" },
  { key: "geraet", label: "Geräte" },
  { key: "material", label: "Materialien" },
];

function StammdatenForm({ typ, onSave, onCancel }) {
  const [form, setForm] = useState({ typ, name: "", kuerzel: "", kontakt_name: "", email: "", telefon: "", adresse: "", kategorie: "", kostensatz: "", einheit: "", qualifikation: "", aktiv: true });
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{TYP_LABELS[typ]} anlegen</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: "name", label: "Name *", required: true },
            { key: "kuerzel", label: "Kürzel" },
            { key: "kontakt_name", label: "Ansprechpartner" },
            { key: "email", label: "E-Mail" },
            { key: "telefon", label: "Telefon" },
            { key: "adresse", label: "Adresse" },
            { key: "kategorie", label: "Kategorie / Gewerk" },
            ...(["geraet", "material"].includes(typ) ? [{ key: "einheit", label: "Einheit" }, { key: "kostensatz", label: "Kostensatz (€)", type: "number" }] : []),
            { key: "qualifikation", label: "Bemerkung" },
          ].map(({ key, label, required, type }) => (
            <div key={key}>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
              <Input type={type || "text"} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name}>Speichern</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Stammdaten() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("auftraggeber");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  const { data: stammdaten = [], isLoading } = useQuery({
    queryKey: ["stammdaten"],
    queryFn: () => base44.entities.Stammdatum.list("name", 500),
  });

  const createMut = useMutation({
    mutationFn: async (d) => {
      let extra = {};
      if (d.typ === "auftraggeber") {
        const all = await base44.entities.Stammdatum.filter({ typ: "auftraggeber" }, "-created_date", 1);
        const lastNum = all.length > 0 && all[0].kundennummer
          ? parseInt(all[0].kundennummer.replace(/\D/g, "")) || 0
          : 0;
        extra.kundennummer = `KD-${String(lastNum + 1).padStart(5, "0")}`;
      }
      return base44.entities.Stammdatum.create({ ...d, ...extra, kostensatz: d.kostensatz ? parseFloat(d.kostensatz) : undefined });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stammdaten"] }); setShowForm(false); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Stammdatum.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stammdaten"] }),
  });

  const filtered = stammdaten.filter(s =>
    s.typ === activeTab &&
    (s.name?.toLowerCase().includes(search.toLowerCase()) || s.kuerzel?.toLowerCase().includes(search.toLowerCase()))
  );

  const counts = {};
  TABS.forEach(t => { counts[t.key] = stammdaten.filter(s => s.typ === t.key).length; });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Stammdaten</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Zentrale Datenbasis – Auftraggeber, NU, Mitarbeiter, Geräte, Materialien</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`p-3 rounded-lg border text-left transition-all ${activeTab === t.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="text-xl font-bold">{counts[t.key]}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button className="gap-2" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" />{TYP_LABELS[activeTab]} anlegen</Button>
      </div>

      {showForm && <StammdatenForm typ={activeTab} onSave={(d) => createMut.mutate(d)} onCancel={() => setShowForm(false)} />}

      <Card>
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setShowForm(false); }}>
          <div className="border-b border-border px-4 pt-3 overflow-x-auto">
            <TabsList className="bg-transparent h-auto p-0 gap-0">
              {TABS.map(t => (
                <TabsTrigger key={t.key} value={t.key} className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2.5">
                  {t.label} {counts[t.key] > 0 && <span className="ml-1 text-muted-foreground">({counts[t.key]})</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {TABS.map(t => (
            <TabsContent key={t.key} value={t.key} className="mt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Name</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Kürzel</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Ansprechpartner</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">E-Mail / Tel.</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Kategorie</th>
                      {["geraet", "material"].includes(t.key) && <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Kostensatz</th>}
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? Array(4).fill(0).map((_, i) => (
                      <tr key={i} className="border-b"><td colSpan={7} className="px-4 py-3"><Skeleton className="h-4" /></td></tr>
                    )) : filtered.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Keine Einträge für „{TYP_LABELS[t.key]}" {search ? `mit „${search}"` : ""}
                      </td></tr>
                    ) : filtered.map(s => (
                      <tr key={s.id} className="border-b border-border hover:bg-accent/30">
                        <td className="px-4 py-3 font-medium text-xs">{s.name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.kuerzel || "–"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.kontakt_name || "–"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {s.email || "–"}{s.telefon ? ` · ${s.telefon}` : ""}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.kategorie || "–"}</td>
                        {["geraet", "material"].includes(t.key) && (
                          <td className="px-4 py-3 text-right text-xs">{s.kostensatz ? `${s.kostensatz} €/${s.einheit || "ME"}` : "–"}</td>
                        )}
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMut.mutate(s.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </Card>
    </div>
  );
}