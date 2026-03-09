import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

const CONTRACT_TYPES = [
  "Einheitspreisvertrag", "Pauschalvertrag", "Stundenlohnvertrag", "GMP-Vertrag",
];

export default function ProjectForm({ open, onOpenChange, onSave, initialData }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(
    initialData || {
      project_name: "", client: "", client_id: "", project_number: "",
      location: "", planning_office: "", contract_type: "", vob_agreed: false,
      project_start: "", submission_date: "", review_date: new Date().toISOString().split("T")[0],
      reviewer: "", selected_trades: ["allgemein"], status: "entwurf",
    }
  );
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: "", adresse: "", kontakt_name: "", email: "", telefon: "" });

  useEffect(() => {
    if (initialData) setForm(initialData);
  }, [initialData]);

  const { data: alleStammdaten = [] } = useQuery({
    queryKey: ["stammdaten"],
    queryFn: () => base44.entities.Stammdatum.list("name", 500),
  });
  const auftraggeber = alleStammdaten.filter(s => s.typ === "auftraggeber");

  const createClientMut = useMutation({
    mutationFn: async (data) => {
      // Auto-generate Kundennummer
      const all = await base44.entities.Stammdatum.filter({ typ: "auftraggeber" }, "-created_date", 1);
      const lastNum = all.length > 0 && all[0].kundennummer
        ? parseInt(all[0].kundennummer.replace(/\D/g, "")) || 0
        : 0;
      const kundennummer = `KD-${String(lastNum + 1).padStart(5, "0")}`;
      return base44.entities.Stammdatum.create({ ...data, typ: "auftraggeber", kundennummer });
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["stammdaten-auftraggeber"] });
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {initialData ? "Projekt bearbeiten" : "Neues Projekt anlegen"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Projektname */}
            <div className="space-y-1.5">
              <Label htmlFor="project_name">Projektname *</Label>
              <Input id="project_name" value={form.project_name}
                onChange={e => handleChange("project_name", e.target.value)}
                placeholder="z.B. Kanalsanierung Hauptstraße" required />
            </div>
            {/* Projektnummer */}
            <div className="space-y-1.5">
              <Label htmlFor="project_number">Projektnummer *</Label>
              <Input id="project_number" value={form.project_number}
                onChange={e => handleChange("project_number", e.target.value)}
                placeholder="z.B. 2024-KB-0042" required />
            </div>

            {/* Auftraggeber */}
            <div className="space-y-1.5 md:col-span-2">
              <Label>Auftraggeber *</Label>
              {!showNewClient ? (
                <div className="flex gap-2">
                  <Select value={form.client_id || ""} onValueChange={handleClientSelect}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Auftraggeber aus Stammdaten wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {auftraggeber.map(ag => (
                        <SelectItem key={ag.id} value={ag.id}>
                          <span className="font-medium">{ag.name}</span>
                          {ag.kundennummer && <span className="text-muted-foreground ml-2 text-xs">({ag.kundennummer})</span>}
                          {ag.adresse && <span className="text-muted-foreground ml-2 text-xs">· {ag.adresse}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowNewClient(true)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="border border-primary/20 rounded-lg p-3 space-y-3 bg-primary/5">
                  <p className="text-xs font-semibold text-primary">Neuen Auftraggeber anlegen</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { key: "name", label: "Firmenname *" },
                      { key: "adresse", label: "Adresse *" },
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
                  </div>
                  <p className="text-xs text-muted-foreground">Kundennummer wird automatisch vergeben.</p>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowNewClient(false)}>Abbrechen</Button>
                    <Button type="button" size="sm"
                      disabled={!newClientForm.name || !newClientForm.adresse || createClientMut.isPending}
                      onClick={() => createClientMut.mutate(newClientForm)}>
                      Anlegen & Auswählen
                    </Button>
                  </div>
                </div>
              )}
              {form.client && !showNewClient && (
                <p className="text-xs text-muted-foreground">Ausgewählt: <span className="font-medium text-foreground">{form.client}</span></p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label htmlFor="location">Standort</Label>
              <Input id="location" value={form.location}
                onChange={e => handleChange("location", e.target.value)}
                placeholder="z.B. 45127 Essen" />
            </div>
            {/* Planungsbüro */}
            <div className="space-y-1.5">
              <Label htmlFor="planning_office">Planungsbüro</Label>
              <Input id="planning_office" value={form.planning_office}
                onChange={e => handleChange("planning_office", e.target.value)}
                placeholder="z.B. Ingenieurbüro Müller" />
            </div>
            {/* Vertragsart */}
            <div className="space-y-1.5">
              <Label>Vertragsart</Label>
              <Select value={form.contract_type} onValueChange={v => handleChange("contract_type", v)}>
                <SelectTrigger><SelectValue placeholder="Vertragsart wählen" /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map(ct => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Submissionsdatum */}
            <div className="space-y-1.5">
              <Label htmlFor="submission_date">Submissionsdatum</Label>
              <Input id="submission_date" type="date" value={form.submission_date || ""}
                onChange={e => handleChange("submission_date", e.target.value)} />
            </div>
            {/* Projektstart */}
            <div className="space-y-1.5">
              <Label htmlFor="project_start">Projektstart</Label>
              <Input id="project_start" type="date" value={form.project_start || ""}
                onChange={e => handleChange("project_start", e.target.value)} />
            </div>
            {/* Prüfdatum */}
            <div className="space-y-1.5">
              <Label htmlFor="review_date">Prüfdatum AFU</Label>
              <Input id="review_date" type="date" value={form.review_date || ""}
                onChange={e => handleChange("review_date", e.target.value)} />
            </div>
            {/* Bearbeiter */}
            <div className="space-y-1.5">
              <Label htmlFor="reviewer">Bearbeiter</Label>
              <Input id="reviewer" value={form.reviewer || ""}
                onChange={e => handleChange("reviewer", e.target.value)}
                placeholder="Name des Bearbeiters" />
            </div>
            {/* VOB */}
            <div className="flex items-center gap-3 pt-5">
              <Switch id="vob_agreed" checked={form.vob_agreed}
                onCheckedChange={v => handleChange("vob_agreed", v)} />
              <Label htmlFor="vob_agreed" className="cursor-pointer">VOB/B vereinbart</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={!form.client_id && !form.client}>
              {initialData ? "Speichern" : "Projekt anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}