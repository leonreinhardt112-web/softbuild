import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Plus, Trash2, Sparkles, Search, Loader2, Wand2 } from "lucide-react";

const GEWERK_LABELS = {
  erdbau: "Erdbau", verbau: "Verbau", kanalbau: "Kanalbau",
  strassenbau: "Straßenbau", wasserhaltung: "Wasserhaltung",
  draen_versickerung: "Drän/Versickerung", allgemein: "Allgemein",
};
const GEWERK_COLORS = {
  erdbau: "bg-amber-100 text-amber-700", verbau: "bg-blue-100 text-blue-700",
  kanalbau: "bg-cyan-100 text-cyan-700", strassenbau: "bg-gray-100 text-gray-700",
  wasserhaltung: "bg-sky-100 text-sky-700", draen_versickerung: "bg-green-100 text-green-700",
  allgemein: "bg-secondary text-secondary-foreground",
};

export default function StammLVDialog({ onInsertPositions }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterGewerk, setFilterGewerk] = useState("alle");
  const [showForm, setShowForm] = useState(false);
  const [kiPrompt, setKiPrompt] = useState("");
  const [kiLoading, setKiLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({ oz: "", gewerk: "allgemein", kurztext: "", langtext: "", einheit: "m³", lohn_ep: "", material_ep: "", geraet_ep: "", nu_ep: "", sonstiges_ep: "" });

  const { data: positionen = [], isLoading } = useQuery({
    queryKey: ["stamm-lv"],
    queryFn: () => base44.entities.StammLVPosition.list("kurztext", 500),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.StammLVPosition.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stamm-lv"] }); setShowForm(false); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.StammLVPosition.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stamm-lv"] }),
  });

  const filtered = positionen.filter(p =>
    (filterGewerk === "alle" || p.gewerk === filterGewerk) &&
    (!search || p.kurztext?.toLowerCase().includes(search.toLowerCase()) || p.tags?.toLowerCase().includes(search.toLowerCase()) || p.oz?.includes(search))
  );

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleInsert = () => {
    const toInsert = positionen.filter(p => selected.includes(p.id)).map(p => ({
      oz: p.oz || "",
      short_text: p.kurztext,
      long_text: p.langtext || "",
      einheit: p.einheit,
      menge: 0,
      ep: p.ep_gesamt || 0,
      gp: 0,
      lohn_ep: p.lohn_ep || 0,
      material_ep: p.material_ep || 0,
      geraet_ep: p.geraet_ep || 0,
      nu_ep: p.nu_ep || 0,
      sonstiges_ep: p.sonstiges_ep || 0,
    }));
    onInsertPositions(toInsert);
    setSelected([]);
    setOpen(false);
  };

  const handleKiGenerieren = async () => {
    if (!kiPrompt.trim()) return;
    setKiLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein erfahrener Tiefbaukalkulator. Erstelle auf Basis der folgenden Leistungsbeschreibung 3-8 realistische Leistungsverzeichnis-Positionen mit plausiblen deutschen Einheitspreisen für einen deutschen Tiefbau-Dienstleister (Erdarbeiten, Kanalbau, Straßenbau etc.).

Leistungsbeschreibung: "${kiPrompt}"

Für jede Position liefere:
- oz: Positionsnummer (z.B. 01.001)
- gewerk: eines von [erdbau, verbau, kanalbau, strassenbau, wasserhaltung, draen_versickerung, allgemein]
- kurztext: kurze Positionsbezeichnung (max 80 Zeichen)
- langtext: detaillierte Leistungsbeschreibung (2-4 Sätze)
- einheit: Mengeneinheit (m, m², m³, t, St., Psch.)
- lohn_ep: Lohnanteil Einheitspreis in €
- material_ep: Materialanteil EP in €
- geraet_ep: Geräteanteil EP in €
- nu_ep: Nachunternehmeranteil EP in € (0 wenn eigene Leistung)
- sonstiges_ep: Sonstiges EP in €
- ep_gesamt: Summe aller Anteile
- tags: Schlagwörter kommagetrennt`,
      response_json_schema: {
        type: "object",
        properties: {
          positionen: {
            type: "array",
            items: {
              type: "object",
              properties: {
                oz: { type: "string" }, gewerk: { type: "string" },
                kurztext: { type: "string" }, langtext: { type: "string" },
                einheit: { type: "string" },
                lohn_ep: { type: "number" }, material_ep: { type: "number" },
                geraet_ep: { type: "number" }, nu_ep: { type: "number" },
                sonstiges_ep: { type: "number" }, ep_gesamt: { type: "number" },
                tags: { type: "string" }
              }
            }
          }
        }
      }
    });
    const newPositions = result.positionen || [];
    for (const pos of newPositions) {
      await base44.entities.StammLVPosition.create({ ...pos, ki_generiert: true });
    }
    qc.invalidateQueries({ queryKey: ["stamm-lv"] });
    setKiPrompt("");
    setKiLoading(false);
  };

  const saveForm = () => {
    const ep = ["lohn_ep", "material_ep", "geraet_ep", "nu_ep", "sonstiges_ep"].reduce((s, k) => s + (parseFloat(form[k]) || 0), 0);
    createMut.mutate({ ...form, lohn_ep: parseFloat(form.lohn_ep) || 0, material_ep: parseFloat(form.material_ep) || 0, geraet_ep: parseFloat(form.geraet_ep) || 0, nu_ep: parseFloat(form.nu_ep) || 0, sonstiges_ep: parseFloat(form.sonstiges_ep) || 0, ep_gesamt: ep });
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <BookOpen className="w-4 h-4" />
        Stamm-LV
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Stamm-Leistungsverzeichnis
            </DialogTitle>
          </DialogHeader>

          {/* KI-Generierung */}
          <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">KI-Kalkulation: Positionen automatisch generieren</span>
            </div>
            <p className="text-xs text-muted-foreground">Beschreibe die auszuführende Leistung – die KI erstellt passende LV-Positionen mit kalkulierten Einheitspreisen.</p>
            <div className="flex gap-2">
              <Input
                placeholder="z.B. ‚Kanalisation DN300 mit Bodenaustausch, 80m Länge, innerstädtisch' ..."
                value={kiPrompt}
                onChange={e => setKiPrompt(e.target.value)}
                className="flex-1 text-sm"
                onKeyDown={e => e.key === "Enter" && !kiLoading && handleKiGenerieren()}
              />
              <Button onClick={handleKiGenerieren} disabled={!kiPrompt.trim() || kiLoading} className="gap-2 shrink-0">
                {kiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {kiLoading ? "Generiere..." : "Generieren"}
              </Button>
            </div>
          </div>

          {/* Filter & Suche */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-9 h-8 text-sm" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterGewerk} onValueChange={setFilterGewerk}>
              <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Gewerke</SelectItem>
                {Object.entries(GEWERK_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-3.5 h-3.5" />Manuell anlegen
            </Button>
          </div>

          {/* Manuelles Formular */}
          {showForm && (
            <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-3">
              <p className="text-xs font-semibold">Neue Stammposition manuell anlegen</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">OZ</label><Input className="h-8 text-sm" value={form.oz} onChange={e => setForm(f => ({ ...f, oz: e.target.value }))} /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Gewerk</label>
                  <Select value={form.gewerk} onValueChange={v => setForm(f => ({ ...f, gewerk: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(GEWERK_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs text-muted-foreground block mb-1">Einheit</label><Input className="h-8 text-sm" value={form.einheit} onChange={e => setForm(f => ({ ...f, einheit: e.target.value }))} /></div>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Kurztext *</label><Input className="text-sm" value={form.kurztext} onChange={e => setForm(f => ({ ...f, kurztext: e.target.value }))} /></div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {[["lohn_ep", "Lohn EP"], ["material_ep", "Material EP"], ["geraet_ep", "Gerät EP"], ["nu_ep", "NU EP"], ["sonstiges_ep", "Sonstige EP"]].map(([k, l]) => (
                  <div key={k}><label className="text-xs text-muted-foreground block mb-1">{l} (€)</label><Input type="number" className="h-8 text-sm" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
                <Button size="sm" onClick={saveForm} disabled={!form.kurztext || createMut.isPending}>Speichern</Button>
              </div>
            </div>
          )}

          {/* Positionsliste */}
          <div className="flex-1 overflow-y-auto border border-border rounded-lg">
            {isLoading ? (
              <div className="p-4 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {positionen.length === 0
                  ? "Noch keine Stammpositionen. Nutze die KI-Generierung oder lege Positionen manuell an."
                  : "Keine Positionen gefunden."}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border bg-muted/30">
                    <th className="w-8 px-3 py-2" />
                    <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">OZ / Kurztext</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Gewerk</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2">Lohn</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2">Material</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2">Gerät</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2 font-semibold">EP ges.</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Einheit</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(pos => {
                    const isSelected = selected.includes(pos.id);
                    return (
                      <tr
                        key={pos.id}
                        onClick={() => toggleSelect(pos.id)}
                        className={`border-b border-border/50 cursor-pointer transition-colors ${isSelected ? "bg-primary/8 border-primary/30" : "hover:bg-accent/30"}`}
                      >
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(pos.id)} className="accent-primary" onClick={e => e.stopPropagation()} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-start gap-1.5">
                            {pos.ki_generiert && <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />}
                            <div>
                              {pos.oz && <span className="text-xs text-muted-foreground mr-1.5">{pos.oz}</span>}
                              <span className="text-xs font-medium">{pos.kurztext}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={`text-[10px] ${GEWERK_COLORS[pos.gewerk] || ""}`}>{GEWERK_LABELS[pos.gewerk] || pos.gewerk}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">{pos.lohn_ep ? pos.lohn_ep.toFixed(2) : "–"}</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">{pos.material_ep ? pos.material_ep.toFixed(2) : "–"}</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">{pos.geraet_ep ? pos.geraet_ep.toFixed(2) : "–"}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold">{pos.ep_gesamt ? pos.ep_gesamt.toFixed(2) + " €" : "–"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{pos.einheit}</td>
                        <td className="px-3 py-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={e => { e.stopPropagation(); deleteMut.mutate(pos.id); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {filtered.length} Positionen · {selected.length} ausgewählt
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Schließen</Button>
              {onInsertPositions && (
                <Button onClick={handleInsert} disabled={selected.length === 0} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {selected.length} Position{selected.length !== 1 ? "en" : ""} übernehmen
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}