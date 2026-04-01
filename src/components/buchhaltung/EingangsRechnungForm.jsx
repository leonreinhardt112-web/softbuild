import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, X, FileUp, FileCheck } from "lucide-react";

const KOSTENKATEGORIEN = [
  { value: "nachunternehmer", label: "Nachunternehmer" },
  { value: "material", label: "Material" },
  { value: "geraete_maschinen", label: "Geräte / Maschinen" },
  { value: "kraftstoff", label: "Kraftstoff" },
  { value: "miete_leasing", label: "Miete / Leasing" },
  { value: "versicherung", label: "Versicherung" },
  { value: "buero_verwaltung", label: "Büro / Verwaltung" },
  { value: "fahrzeuge", label: "Fahrzeuge" },
  { value: "personal_fremd", label: "Personal (Fremd)" },
  { value: "entsorgung", label: "Entsorgung" },
  { value: "gebuehren_abgaben", label: "Gebühren / Abgaben" },
  { value: "sonstiges", label: "Sonstiges" },
];

export default function EingangsRechnungForm({ projects = [], stammdaten = [], onSave, onCancel, isPending }) {
  const [form, setForm] = useState({
    kreditor_name: "",
    rechnungsnummer: "",
    rechnungsart: "eingangsrechnung",
    kostenkategorie: "sonstiges",
    rechnungsdatum: new Date().toISOString().split("T")[0],
    faellig_am: "",
    betrag_netto: "",
    mwst_satz: 19,
    betrag_brutto: "",
    skonto_prozent: "",
    skonto_frist: "",
    project_id: "",
    beschreibung: "",
    notes: "",
    datei_url: "",
    datei_name: "",
  });
  const [kostenverteilung, setKostenverteilung] = useState([]);
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === "betrag_netto" || k === "mwst_satz") {
      const netto = parseFloat(k === "betrag_netto" ? v : f.betrag_netto) || 0;
      const mwst = parseFloat(k === "mwst_satz" ? v : f.mwst_satz) || 0;
      next.betrag_brutto = (netto * (1 + mwst / 100)).toFixed(2);
    }
    return next;
  });

  const addKV = () => setKostenverteilung(kv => [...kv, { project_id: "", project_name: "", anteil_prozent: "", betrag_netto: "" }]);
  const removeKV = (i) => setKostenverteilung(kv => kv.filter((_, idx) => idx !== i));
  const setKV = (i, k, v) => setKostenverteilung(kv => {
    const next = [...kv];
    next[i] = { ...next[i], [k]: v };
    if (k === "anteil_prozent") {
      const netto = parseFloat(form.betrag_netto) || 0;
      next[i].betrag_netto = ((parseFloat(v) || 0) / 100 * netto).toFixed(2);
    }
    if (k === "project_id") {
      const p = projects.find(x => x.id === v);
      next[i].project_name = p ? p.project_name : "";
    }
    return next;
  });

  const kvSum = kostenverteilung.reduce((s, kv) => s + (parseFloat(kv.anteil_prozent) || 0), 0);
  const kvValid = kostenverteilung.length === 0 || Math.abs(kvSum - 100) < 0.01;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!kvValid) return;
    const data = { ...form };
    if (kostenverteilung.length > 0) data.kostenverteilung = kostenverteilung;
    onSave(data);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, datei_url: file_url, datei_name: file.name }));
    } catch (err) {
      console.error("Upload-Fehler:", err);
    }
    setUploading(false);
  };

  const kreditoren = stammdaten.filter(s => ["nachunternehmer", "lieferant"].includes(s.typ));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          Eingangsrechnung anlegen
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kreditor */}
            <div className="space-y-1.5">
              <Label>Kreditor / Rechnungssteller *</Label>
              <Input
                value={form.kreditor_name}
                onChange={e => set("kreditor_name", e.target.value)}
                placeholder="Name des Rechnungsstellers"
                list="kreditoren-list"
                required
              />
              <datalist id="kreditoren-list">
                {kreditoren.map(k => <option key={k.id} value={k.name} />)}
              </datalist>
            </div>

            {/* Rechnungsnummer */}
            <div className="space-y-1.5">
              <Label>Rechnungsnummer *</Label>
              <Input
                value={form.rechnungsnummer}
                onChange={e => set("rechnungsnummer", e.target.value)}
                placeholder="z. B. RE-2026-0001"
                required
              />
            </div>

            {/* Rechnungsart */}
            <div className="space-y-1.5">
              <Label>Rechnungsart</Label>
              <Select value={form.rechnungsart} onValueChange={v => set("rechnungsart", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eingangsrechnung">Eingangsrechnung</SelectItem>
                  <SelectItem value="teilrechnung">Teilrechnung</SelectItem>
                  <SelectItem value="schlussrechnung">Schlussrechnung</SelectItem>
                  <SelectItem value="gutschrift">Gutschrift</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Kostenkategorie */}
            <div className="space-y-1.5">
              <Label>Kostenkategorie</Label>
              <Select value={form.kostenkategorie} onValueChange={v => set("kostenkategorie", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KOSTENKATEGORIEN.map(k => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rechnungsdatum */}
            <div className="space-y-1.5">
              <Label>Rechnungsdatum</Label>
              <Input type="date" value={form.rechnungsdatum} onChange={e => set("rechnungsdatum", e.target.value)} />
            </div>

            {/* Fällig am */}
            <div className="space-y-1.5">
              <Label>Fällig am</Label>
              <Input type="date" value={form.faellig_am} onChange={e => set("faellig_am", e.target.value)} />
            </div>

            {/* Betrag netto */}
            <div className="space-y-1.5">
              <Label>Betrag netto (€)</Label>
              <Input type="number" step="0.01" value={form.betrag_netto} onChange={e => set("betrag_netto", e.target.value)} placeholder="0,00" />
            </div>

            {/* MwSt */}
            <div className="space-y-1.5">
              <Label>MwSt-Satz (%)</Label>
              <Input type="number" value={form.mwst_satz} onChange={e => set("mwst_satz", e.target.value)} />
            </div>

            {/* Betrag brutto */}
            <div className="space-y-1.5">
              <Label>Betrag brutto (€)</Label>
              <Input type="number" step="0.01" value={form.betrag_brutto} onChange={e => set("betrag_brutto", e.target.value)} placeholder="0,00" />
            </div>

            {/* Skonto */}
            <div className="space-y-1.5">
              <Label>Skonto (%)</Label>
              <Input type="number" step="0.1" min="0" max="100" value={form.skonto_prozent} onChange={e => set("skonto_prozent", e.target.value)} placeholder="z. B. 2" />
            </div>
            <div className="space-y-1.5">
              <Label>Skontofrist (bis)</Label>
              <Input type="date" value={form.skonto_frist} onChange={e => set("skonto_frist", e.target.value)} />
            </div>

          {/* Projekt (optional) */}
            <div className="space-y-1.5">
              <Label>Projekt (optional – leer = AGK)</Label>
              <Select value={form.project_id || "__none__"} onValueChange={v => set("project_id", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Kein Projekt (AGK)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">– Kein Projekt (AGK) –</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.project_number} {p.project_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Datei-Upload */}
           <div className="space-y-1.5">
             <Label>Rechnungs-Datei (PDF/Bild) *</Label>
             <div className="flex gap-2">
               <Input
                 type="file"
                 accept=".pdf,.jpg,.jpeg,.png"
                 onChange={handleFileUpload}
                 disabled={uploading}
                 className="flex-1"
               />
               {form.datei_url && !uploading && (
                 <div className="flex items-center gap-1 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-xs text-green-700">
                   <FileCheck className="w-3.5 h-3.5" />
                   <span>Datei hochgeladen</span>
                 </div>
               )}
               {uploading && (
                 <div className="flex items-center gap-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700">
                   <FileUp className="w-3.5 h-3.5 animate-spin" />
                   <span>Lädt...</span>
                 </div>
               )}
             </div>
           </div>

           {/* Beschreibung */}
           <div className="space-y-1.5">
             <Label>Beschreibung / Leistung</Label>
             <Input value={form.beschreibung} onChange={e => set("beschreibung", e.target.value)} placeholder="z. B. Baggerarbeiten März 2026" />
           </div>

          {/* Notizen */}
          <div className="space-y-1.5">
            <Label>Anmerkungen</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>

          {/* Kostenverteilung */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Kostenverteilung auf mehrere Projekte (optional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addKV} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> Projekt hinzufügen
              </Button>
            </div>
            {kostenverteilung.map((kv, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Projekt</Label>
                  <Select value={kv.project_id || "__none__"} onValueChange={v => setKV(i, "project_id", v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Projekt wählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">– AGK –</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.project_number} {p.project_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Anteil %</Label>
                  <Input
                    className="h-8 text-xs"
                    type="number" min="0" max="100" step="0.1"
                    value={kv.anteil_prozent}
                    onChange={e => setKV(i, "anteil_prozent", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Betrag netto</Label>
                  <Input className="h-8 text-xs bg-muted" readOnly value={kv.betrag_netto} placeholder="0,00" />
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeKV(i)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            {kostenverteilung.length > 0 && (
              <p className={`text-xs ${kvValid ? "text-muted-foreground" : "text-destructive font-semibold"}`}>
                Summe: {kvSum.toFixed(1)} % {!kvValid && "– muss 100 % ergeben"}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
            <Button type="submit" disabled={isPending || !kvValid}>
              {isPending ? "Speichert…" : "Speichern"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}