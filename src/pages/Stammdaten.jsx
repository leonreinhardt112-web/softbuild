import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Archive, Trash2, Search, Database, Users, Truck, Package, Edit2, Zap } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  { key: "auftraggeber_archiv", label: "Archivierte AG", isArchiv: true },
  { key: "nachunternehmer", label: "Nachunternehmer" },
  { key: "lieferant", label: "Lieferanten" },
  { key: "mitarbeiter", label: "Mitarbeiter" },
  { key: "geraet", label: "Geräte" },
  { key: "material", label: "Materialien" },
];

function StammdatenForm({ typ, item, onSave, onCancel }) {
  const [form, setForm] = useState(() => {
    if (!item) return { typ, name: "", kuerzel: "", kontakt_name: "", email: "", telefon: "", strasse: "", plz: "", ort: "", adresse: "", kategorie: "", kostensatz: "", einheit: "", qualifikation: "", aktiv: true };
    // Parse adresse zurück zu strasse, plz, ort falls vorhanden
    let strasse = item.strasse || "", plz = item.plz || "", ort = item.ort || "";
    if (item.adresse && !strasse && !plz && !ort) {
      const parts = item.adresse.split(", ");
      strasse = parts[0] || "";
      if (parts[1]) {
        const plzOrtMatch = parts[1].match(/^(\d+)\s+(.+)$/);
        if (plzOrtMatch) { plz = plzOrtMatch[1]; ort = plzOrtMatch[2]; }
      }
    }
    return { ...item, strasse, plz, ort };
  });
  const [plzLoading, setPlzLoading] = useState(false);

  const handlePlzChange = async (plz) => {
    setForm(f => ({ ...f, plz }));
    if (plz.length === 5) {
      setPlzLoading(true);
      fetch(`https://openplzapi.org/de/Localities?postalCode=${plz}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.length > 0) setForm(f => ({ ...f, ort: data[0].name }));
        })
        .catch(() => {})
        .finally(() => setPlzLoading(false));
    }
  };

  const handleSave = () => {
    const adresse = [form.strasse, `${form.plz} ${form.ort}`.trim()].filter(Boolean).join(", ");
    const { strasse, plz, ort, ...rest } = form;
    onSave({ ...rest, adresse });
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{item ? `${TYP_LABELS[typ]} bearbeiten` : `${TYP_LABELS[typ]} anlegen`}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: "name", label: "Name *", required: true },
            { key: "kuerzel", label: "Kürzel" },
            { key: "kontakt_name", label: "Ansprechpartner" },
            { key: "email", label: "E-Mail" },
            { key: "telefon", label: "Telefon" },
            { key: "kategorie", label: "Kategorie / Gewerk" },
            ...(["geraet", "material"].includes(typ) ? [{ key: "einheit", label: "Einheit" }, { key: "kostensatz", label: "Kostensatz (€)", type: "number" }] : []),
            { key: "qualifikation", label: "Bemerkung" },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
              <Input type={type || "text"} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          {/* Adressfelder */}
          <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Straße & Hausnummer</label>
              <Input value={form.strasse} onChange={e => setForm(f => ({ ...f, strasse: e.target.value }))} placeholder="z.B. Musterstraße 12" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">PLZ</label>
              <Input value={form.plz} onChange={e => handlePlzChange(e.target.value)} maxLength={5} placeholder="z.B. 45127" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ort</label>
              <div className="relative">
                <Input value={form.ort} onChange={e => setForm(f => ({ ...f, ort: e.target.value }))} placeholder={plzLoading ? "Wird ermittelt..." : "z.B. Essen"} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={!form.name}>Speichern</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Stammdaten() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("auftraggeber");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [search, setSearch] = useState("");
  const [showFixDialog, setShowFixDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const { data: stammdaten = [], isLoading } = useQuery({
    queryKey: ["stammdaten"],
    queryFn: () => base44.entities.Stammdatum.list("name", 500),
  });

  useEffect(() => {
    base44.auth.me().then(u => setIsAdmin(u?.role === "admin")).catch(() => {});
  }, []);

  const createMut = useMutation({
    mutationFn: async (d) => {
      let extra = {};
      if (d.typ === "auftraggeber") {
        // Counter aus Unternehmen holen; falls 0 oder fehlt: aus vorhandenen Kundennummern ableiten
        const [unternehmen, alleAG] = await Promise.all([
          base44.entities.Stammdatum.filter({ typ: "unternehmen" }, undefined, 1),
          base44.entities.Stammdatum.filter({ typ: "auftraggeber" }, "name", 500),
        ]);
        const firma = unternehmen[0];
        let currentCounter = firma?.kundennummer_counter || 0;
        // Fallback: höchste vorhandene Kundennummer ermitteln (inkl. archivierter)
        if (currentCounter === 0 && alleAG.length > 0) {
          alleAG.forEach(ag => {
            if (ag.kundennummer) {
              const num = parseInt(ag.kundennummer.replace("KD-", ""), 10);
              if (!isNaN(num) && num > currentCounter) currentCounter = num;
            }
          });
        }
        const newCounter = currentCounter + 1;
        extra.kundennummer = `KD-${String(newCounter).padStart(5, "0")}`;
        if (firma) {
          await base44.entities.Stammdatum.update(firma.id, { kundennummer_counter: newCounter });
        }
      }
      return base44.entities.Stammdatum.create({ ...d, ...extra, kostensatz: d.kostensatz ? parseFloat(d.kostensatz) : undefined });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stammdaten"] }); setShowForm(false); setEditingItem(null); },
  });
  const updateMut = useMutation({
   mutationFn: (d) => {
     const { id, ...updateData } = d;
     return base44.entities.Stammdatum.update(id, { ...updateData, kostensatz: updateData.kostensatz ? parseFloat(updateData.kostensatz) : undefined });
   },
   onSuccess: () => { qc.invalidateQueries({ queryKey: ["stammdaten"] }); setShowForm(false); setEditingItem(null); },
  });
  // Auftraggeber werden archiviert, nicht gelöscht
  const archiviereMut = useMutation({
    mutationFn: (id) => base44.entities.Stammdatum.update(id, { aktiv: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stammdaten"] }),
  });
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(null);
  const deleteMut = useMutation({
    mutationFn: async (id) => {
      if (activeTab === "auftraggeber") {
        // Check if AG has linked projects
        const projekte = await base44.entities.Project.filter({ client_id: id });
        if (projekte.length > 0) {
          throw new Error(`Auftraggeber hat ${projekte.length} verlinkte Projekte. Bitte diese erst anpassen.`);
        }
      }
      return base44.entities.Stammdatum.delete(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stammdaten"] }),
    onError: (err) => {
      alert("Fehler: " + err.message);
    },
  });

  const fixDuplicatesMut = useMutation({
    mutationFn: () => base44.functions.invoke("fixDuplicateKundennummern", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stammdaten"] });
      setShowFixDialog(false);
    },
  });

  const filtered = stammdaten.filter(s => {
    // Archivierte Auftraggeber Tab
    if (activeTab === "auftraggeber_archiv") {
      return s.typ === "auftraggeber" && s.aktiv === false &&
        (s.name?.toLowerCase().includes(search.toLowerCase()) || s.kuerzel?.toLowerCase().includes(search.toLowerCase()));
    }
    // Normale Auftraggeber (nur aktive)
    if (activeTab === "auftraggeber") {
      return s.typ === "auftraggeber" && s.aktiv !== false &&
        (s.name?.toLowerCase().includes(search.toLowerCase()) || s.kuerzel?.toLowerCase().includes(search.toLowerCase()));
    }
    // Andere Typen
    return s.typ === activeTab &&
      (s.name?.toLowerCase().includes(search.toLowerCase()) || s.kuerzel?.toLowerCase().includes(search.toLowerCase()));
  });

  const counts = {};
  TABS.forEach(t => {
    if (t.key === "auftraggeber_archiv") {
      counts[t.key] = stammdaten.filter(s => s.typ === "auftraggeber" && s.aktiv === false).length;
    } else if (t.key === "auftraggeber") {
      counts[t.key] = stammdaten.filter(s => s.typ === "auftraggeber" && s.aktiv !== false).length;
    } else {
      counts[t.key] = stammdaten.filter(s => s.typ === t.key).length;
    }
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmDialog} onOpenChange={(open) => !open && setDeleteConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auftraggeber wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Auftraggeber "{deleteConfirmDialog?.name}" wird unwiederbringlich gelöscht. Projekte, die diesem Auftraggeber zugewiesen sind, müssen vorher angepasst werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteMut.mutate(deleteConfirmDialog.id); setDeleteConfirmDialog(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin: Fix Duplikate Dialog */}
      {isAdmin && (
        <AlertDialog open={showFixDialog} onOpenChange={setShowFixDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kundennummern-Duplikate bereinigen?</AlertDialogTitle>
              <AlertDialogDescription>
                Dies werden alle doppelt vergebenen Kundennummern automatisch korrigiert. Jeder Auftraggeber erhält eine eindeutige Nummer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => fixDuplicatesMut.mutate()}>Bereinigen</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stammdaten</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Zentrale Datenbasis – Auftraggeber, NU, Mitarbeiter, Geräte, Materialien</p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => setShowFixDialog(true)}>
            <Zap className="w-4 h-4" />Fix Duplikate
          </Button>
        )}
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
        {activeTab !== "auftraggeber_archiv" && (
          <Button className="gap-2" onClick={() => { setEditingItem(null); setShowForm(true); }}><Plus className="w-4 h-4" />{TYP_LABELS[activeTab] || "Auftraggeber"} anlegen</Button>
        )}
      </div>

      {showForm && activeTab !== "auftraggeber_archiv" && <StammdatenForm typ={activeTab} item={editingItem} onSave={(d) => editingItem ? updateMut.mutate(d) : createMut.mutate(d)} onCancel={() => { setShowForm(false); setEditingItem(null); }} />}

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
          {TABS.map(t => {
            const isAGArchiv = t.key === "auftraggeber_archiv";
            const isAG = t.key === "auftraggeber" || isAGArchiv;
            return (
            <TabsContent key={t.key} value={t.key} className="mt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Name</th>
                      {isAG && <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Kunden-Nr.</th>}
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
                        {isAGArchiv ? "Keine archivierten Auftraggeber" : `Keine Einträge für „${TYP_LABELS[t.key] || t.label}" ${search ? `mit „${search}"` : ""}`}
                      </td></tr>
                    ) : filtered.map(s => (
                      <tr key={s.id} className={`border-b border-border hover:bg-accent/30 ${isAGArchiv ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3 font-medium text-xs">{s.name}</td>
                        {isAG && <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{s.kundennummer || "–"}</td>}
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.kuerzel || "–"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.kontakt_name || "–"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {s.email || "–"}{s.telefon ? ` · ${s.telefon}` : ""}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.kategorie || "–"}</td>
                        {["geraet", "material"].includes(t.key) && (
                          <td className="px-4 py-3 text-right text-xs">{s.kostensatz ? `${s.kostensatz} €/${s.einheit || "ME"}` : "–"}</td>
                        )}
                        <td className="px-4 py-3 flex gap-1">
                         {!isAGArchiv && (
                           <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                             onClick={() => { setEditingItem(s); setShowForm(true); }}>
                             <Edit2 className="w-3.5 h-3.5" />
                           </Button>
                         )}
                         {t.key === "auftraggeber" ? (
                           <>
                             <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-amber-600"
                               title="Auftraggeber archivieren (Kundennummer bleibt erhalten)"
                               onClick={() => archiviereMut.mutate(s.id)}>
                               <Archive className="w-3.5 h-3.5" />
                             </Button>
                             {isAdmin && (
                               <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                 title="Auftraggeber löschen (nur Admin)"
                                 onClick={() => setDeleteConfirmDialog(s)}>
                                 <Trash2 className="w-3.5 h-3.5" />
                               </Button>
                             )}
                           </>
                         ) : isAGArchiv ? (
                           <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-green-600"
                             onClick={() => updateMut.mutate({ id: s.id, aktiv: true })}>
                             Wiederherstellen
                           </Button>
                         ) : (
                           <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                             onClick={() => deleteMut.mutate(s.id)}>
                             <Trash2 className="w-3.5 h-3.5" />
                           </Button>
                         )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          );})}
        </Tabs>
      </Card>
    </div>
  );
}