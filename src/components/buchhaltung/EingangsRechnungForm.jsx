import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const EMPTY = {
  project_id: "", kreditor_name: "", rechnungsnummer: "",
  rechnungsart: "eingangsrechnung", rechnungsdatum: format(new Date(), "yyyy-MM-dd"),
  faellig_am: "", betrag_netto: "", mwst_satz: 19, gewerk: "",
};

export default function EingangsRechnungForm({ projects, stammdaten, onSave, onCancel, isPending }) {
  const [form, setForm] = useState(EMPTY);
  const kreditoren = stammdaten.filter(s => s.aktiv !== false && s.typ !== "unternehmen");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const netto = parseFloat(form.betrag_netto) || 0;
    const brutto = netto * (1 + form.mwst_satz / 100);
    onSave({ ...form, betrag_netto: netto, betrag_brutto: brutto });
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Neue Eingangsrechnung</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Absender / Rechnungssteller *</label>
            <Select value={form.kreditor_name} onValueChange={v => set("kreditor_name", v)}>
              <SelectTrigger><SelectValue placeholder="Auswählen oder manuell..." /></SelectTrigger>
              <SelectContent>
                {kreditoren.map(k => <SelectItem key={k.id} value={k.name}>{k.name}</SelectItem>)}
                <SelectItem value="__manuell__">– Manuell eingeben –</SelectItem>
              </SelectContent>
            </Select>
            {form.kreditor_name === "__manuell__" && (
              <Input className="mt-2" placeholder="z.B. Vermieter, Versicherung, Behörde..." onChange={e => set("kreditor_name", e.target.value)} />
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Projekt</label>
            <Select value={form.project_id} onValueChange={v => set("project_id", v)}>
              <SelectTrigger><SelectValue placeholder="Projekt..." /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Rechnungsnummer *</label>
            <Input value={form.rechnungsnummer} onChange={e => set("rechnungsnummer", e.target.value)} placeholder="RE-2024-001" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Art</label>
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
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Rechnungsdatum</label>
            <Input type="date" value={form.rechnungsdatum} onChange={e => set("rechnungsdatum", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fällig am</label>
            <Input type="date" value={form.faellig_am} onChange={e => set("faellig_am", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Betrag netto (€)</label>
            <Input type="number" value={form.betrag_netto} onChange={e => set("betrag_netto", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">MwSt (%)</label>
            <Input type="number" value={form.mwst_satz} onChange={e => set("mwst_satz", +e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Gewerk</label>
            <Input value={form.gewerk} onChange={e => set("gewerk", e.target.value)} placeholder="z.B. Erdbau" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={!form.kreditor_name || form.kreditor_name === "__manuell__" || !form.rechnungsnummer || isPending}>
            Anlegen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}