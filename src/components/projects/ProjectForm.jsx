import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, AlertTriangle, Info } from "lucide-react";

const EMPTY_FORM = {
  project_name: "", client: "", client_id: "", project_number: "",
  location: "", project_start: "", project_end: "", submission_date: "",
  review_date: new Date().toISOString().split("T")[0],
  reviewer: "", selected_trades: ["allgemein"], status: "entwurf",
};

export default function ProjectForm({ open, onOpenChange, onSave, initialData }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(initialData || EMPTY_FORM);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: "", strasse: "", plz: "", ort: "", kontakt_name: "", email: "", telefon: "" });
  const [plzLoading, setPlzLoading] = useState(false);



  const handleNewClientPlz = (plz) => {
    setNewClientForm(f => ({ ...f, plz }));
    if (plz.length === 5) {
      setPlzLoading(true);
      fetch(`https://openplzapi.org/de/Localities?postalCode=${plz}`)
        .then(r => r.json())
        .then(data => { if (data && data.length > 0) setNewClientForm(f => ({ ...f, ort: data[0].name })); })
        .catch(() => {})
        .finally(() => setPlzLoading(false));
    }
  };

  // Load current user for auto-fill
  useEffect(() => {
    if (!initialData) {
      base44.auth.me().then(user => {
        if (user) setForm(f => ({ ...f, reviewer: user.full_name || user.email || "" }));
      }).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (initialData) setForm(initialData);
    else setForm(EMPTY_FORM);
  }, [initialData, open]);

  const { data: alleStammdaten = [] } = useQuery({
    queryKey: ["stammdaten"],
    queryFn: () => base44.entities.Stammdatum.list("name", 500),
  });
  const auftraggeber = alleStammdaten.filter(s => s.typ === "auftraggeber");

  // Duplicate check: show warning when typing a new client name
  const duplicateClients = auftraggeber.filter(ag =>
    newClientForm.name.trim().length >= 3 &&
    ag.name.toLowerCase().includes(newClientForm.name.trim().toLowerCase())
  );

  const createClientMut = useMutation({
    mutationFn: async (data) => {
      const all = await base44.entities.Stammdatum.list("-created_date", 500);
      const agAll = all.filter(s => s.typ === "auftraggeber" && s.kundennummer);
      const lastNum = agAll.length > 0
        ? Math.max(...agAll.map(s => parseInt(s.kundennummer.replace(/\D/g, "")) || 0))
        : 0;
      const kundennummer = `KD-${String(lastNum + 1).padStart(5, "0")}`;
      return base44.entities.Stammdatum.create({ ...data, typ: "auftraggeber", kundennummer });
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["stammdaten"] });
      setForm(f => ({ ...f, client: created.name, client_id: created.id }));
      setShowNewClient(false);
      setNewClientForm({ name: "", adresse: "", kontakt_name: "", email: "", telefon: "" });
    },
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleClientSelect = (id) => {
    const ag = auftraggeber.find(a => a.id === id);
    if (ag) setForm(f => ({ ...f, client_id: id, client: ag.name }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client_id) return;
    
    // Generate project number if not editing
    if (!initialData) {
      try {
        const response = await base44.functions.invoke('generateProjeknummer', {});
        form.project_number = response.data.projektNummer;
      } catch (error) {
        console.error('Fehler bei Projektnummernvergabe:', error);
      }
    }
    
    onSave(form);
  };

  const missingDates = form.project_start && !form.project_end;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {initialData ? "Projekt bearbeiten" : "Neues Projekt anlegen"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Projektname + Nummer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="project_name">Projektname *</Label>
              <Input id="project_name" value={form.project_name}
                onChange={e => handleChange("project_name", e.target.value)}
                placeholder="z.B. Kanalsanierung Hauptstraße" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project_number">Projektnummer *</Label>
              <Input id="project_number" value={form.project_number}
                onChange={e => handleChange("project_number", e.target.value)}
                placeholder={initialData ? "z.B. 2024-KB-0042" : "wird automatisch generiert"}
                disabled={!initialData}
                required />
            </div>
          </div>

          {/* Auftraggeber – Pflichtfeld, nur aus Stammdaten */}
          <div className="space-y-1.5">
            <Label>Auftraggeber *</Label>
            {!showNewClient ? (
              <div className="flex gap-2">
                <Select value={form.client_id || ""} onValueChange={handleClientSelect} required>
                  <SelectTrigger className={`flex-1 ${!form.client_id ? "border-amber-400" : ""}`}>
                    <SelectValue placeholder="Auftraggeber aus Stammdaten wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {auftraggeber.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                        Noch keine Auftraggeber in Stammdaten.<br />Bitte zuerst anlegen.
                      </div>
                    ) : auftraggeber.map(ag => (
                      <SelectItem key={ag.id} value={ag.id}>
                        <span className="font-medium">{ag.name}</span>
                        {ag.kundennummer && <span className="text-muted-foreground ml-2 text-xs">({ag.kundennummer})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" title="Neuen Auftraggeber anlegen"
                  onClick={() => setShowNewClient(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="border border-primary/20 rounded-lg p-3 space-y-3 bg-primary/5">
                <p className="text-xs font-semibold text-primary">Neuen Auftraggeber anlegen</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "name", label: "Firmenname *" },
                  { key: "kontakt_name", label: "Ansprechpartner" },
                  { key: "email", label: "E-Mail" },
                  { key: "telefon", label: "Telefon" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input value={newClientForm[key]}
                      onChange={e => setNewClientForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs">Straße & Hausnummer</Label>
                  <Input value={newClientForm.strasse}
                    onChange={e => setNewClientForm(f => ({ ...f, strasse: e.target.value }))} placeholder="z.B. Musterstraße 12" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">PLZ</Label>
                  <Input value={newClientForm.plz} maxLength={5}
                    onChange={e => handleNewClientPlz(e.target.value)} placeholder="z.B. 45127" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ort</Label>
                  <Input value={newClientForm.ort}
                    onChange={e => setNewClientForm(f => ({ ...f, ort: e.target.value }))}
                    placeholder={plzLoading ? "Wird ermittelt..." : "z.B. Essen"} />
                </div>
                </div>
                {duplicateClients.length > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-amber-800">
                      <p className="font-semibold mb-0.5">Mögliche Duplikate gefunden:</p>
                      {duplicateClients.map(ag => (
                        <button key={ag.id} type="button"
                          className="block underline hover:text-amber-900"
                          onClick={() => { handleClientSelect(ag.id); setShowNewClient(false); }}>
                          {ag.name} {ag.kundennummer ? `(${ag.kundennummer})` : ""}
                        </button>
                      ))}
                      <p className="mt-1 text-amber-700">Bitte oben auswählen oder trotzdem neu anlegen.</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" /> Kundennummer wird automatisch vergeben.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewClient(false)}>Abbrechen</Button>
                  <Button type="button" size="sm"
                    disabled={!newClientForm.name || createClientMut.isPending}
                    onClick={() => {
                        const adresse = [newClientForm.strasse, `${newClientForm.plz} ${newClientForm.ort}`.trim()].filter(Boolean).join(", ");
                        createClientMut.mutate({ ...newClientForm, adresse });
                      }}>
                    Anlegen & Auswählen
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Standort */}
          <div className="space-y-1.5">
            <Label htmlFor="location">Standort</Label>
            <Input id="location" value={form.location}
              onChange={e => handleChange("location", e.target.value)}
              placeholder="Wird aus LV ermittelt – bei mehreren Standorten manuell eintragen" />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" /> Wird nach LV-Upload automatisch befüllt. Bei mehreren Standorten bitte manuell anpassen.
            </p>
          </div>

          {/* Submissionsdatum */}
          <div className="space-y-1.5">
            <Label htmlFor="submission_date">Submissionsdatum</Label>
            <Input id="submission_date" type="date" value={form.submission_date || ""}
              onChange={e => handleChange("submission_date", e.target.value)} />
          </div>

          {/* Ausführungszeitraum */}
          <div className="space-y-1.5">
            <Label>Ausführungszeitraum</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Beginn</p>
                <Input type="date" value={form.project_start || ""}
                  onChange={e => handleChange("project_start", e.target.value)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Ende</p>
                <Input type="date" value={form.project_end || ""}
                  onChange={e => handleChange("project_end", e.target.value)} />
              </div>
            </div>
            {missingDates && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Kein Ausführungsende angegeben. Falls aus den Vertragsunterlagen kein Ausführungszeitraum hervorgeht, muss dieser beim Auftraggeber erfragt werden.
                </p>
              </div>
            )}
          </div>

          {/* Prüfdatum AFU */}
          <div className="space-y-1.5">
            <Label htmlFor="review_date">Prüfdatum AFU</Label>
            <Input id="review_date" type="date" value={form.review_date || ""}
              onChange={e => handleChange("review_date", e.target.value)} />
          </div>

          {/* Bearbeiter – auto aus Login */}
          <div className="space-y-1.5">
            <Label htmlFor="reviewer">Bearbeiter</Label>
            <Input id="reviewer" value={form.reviewer || ""}
              onChange={e => handleChange("reviewer", e.target.value)}
              placeholder="Wird automatisch aus Login übernommen" />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" /> Wird automatisch aus dem angemeldeten Nutzer befüllt.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit"
              disabled={!form.project_name || !form.project_number || !form.client_id}>
              {initialData ? "Speichern" : "Projekt anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}