import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const CONTRACT_TYPES = [
  "Einheitspreisvertrag",
  "Pauschalvertrag",
  "Stundenlohnvertrag",
  "GMP-Vertrag",
];

export default function ProjectForm({ open, onOpenChange, onSave, initialData }) {
  const [form, setForm] = useState(
    initialData || {
      project_name: "",
      client: "",
      project_number: "",
      location: "",
      planning_office: "",
      contract_type: "",
      vob_agreed: false,
      project_start: "",
      review_date: new Date().toISOString().split("T")[0],
      reviewer: "",
      selected_trades: ["allgemein"],
      status: "entwurf",
    }
  );

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
            <div className="space-y-1.5">
              <Label htmlFor="project_name">Projektname *</Label>
              <Input
                id="project_name"
                value={form.project_name}
                onChange={(e) => handleChange("project_name", e.target.value)}
                placeholder="z.B. Kanalsanierung Hauptstraße"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project_number">Projektnummer *</Label>
              <Input
                id="project_number"
                value={form.project_number}
                onChange={(e) => handleChange("project_number", e.target.value)}
                placeholder="z.B. 2024-KB-0042"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client">Auftraggeber</Label>
              <Input
                id="client"
                value={form.client}
                onChange={(e) => handleChange("client", e.target.value)}
                placeholder="z.B. Stadtverwaltung Musterstadt"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Standort</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => handleChange("location", e.target.value)}
                placeholder="z.B. 45127 Essen"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="planning_office">Planungsbüro</Label>
              <Input
                id="planning_office"
                value={form.planning_office}
                onChange={(e) => handleChange("planning_office", e.target.value)}
                placeholder="z.B. Ingenieurbüro Müller"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contract_type">Vertragsart</Label>
              <Select
                value={form.contract_type}
                onValueChange={(v) => handleChange("contract_type", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vertragsart wählen" />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>
                      {ct}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project_start">Projektstart</Label>
              <Input
                id="project_start"
                type="date"
                value={form.project_start}
                onChange={(e) => handleChange("project_start", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review_date">Prüfdatum</Label>
              <Input
                id="review_date"
                type="date"
                value={form.review_date}
                onChange={(e) => handleChange("review_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reviewer">Bearbeiter</Label>
              <Input
                id="reviewer"
                value={form.reviewer}
                onChange={(e) => handleChange("reviewer", e.target.value)}
                placeholder="Name des Bearbeiters"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="vob_agreed"
                checked={form.vob_agreed}
                onCheckedChange={(v) => handleChange("vob_agreed", v)}
              />
              <Label htmlFor="vob_agreed" className="cursor-pointer">
                VOB/B vereinbart
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit">
              {initialData ? "Speichern" : "Projekt anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}