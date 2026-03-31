import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, Plus, Save } from "lucide-react";

const fmt2 = (v) => (v || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PositionsRechnungDialog({ open, onClose, onSave, projects, kalkulationen, vorherige_rechnungen = [] }) {
  const [step, setStep] = useState(1); // 1=Auswahl, 2=Positionen, 3=Kopfdaten
  const [projektId, setProjektId] = useState("");
  const [kalkId, setKalkId] = useState("");
  const [positionen, setPositionen] = useState([]);
  const [form, setForm] = useState({
    rechnungsnummer: "",
    rechnungsart: "abschlagsrechnung",
    rechnungsdatum: format(new Date(), "yyyy-MM-dd"),
    mwst_satz: 19,
    einbehalt: 0,
    skonto_prozent: 0,
    notes: "",
  });

  const kalk = kalkulationen.find(k => k.id === kalkId);
  const proj = projects.find(p => p.id === projektId);

  // Vorperiodensummen je OZ aus bereits gestellten Rechnungen
  const vorperioden = {};
  vorherige_rechnungen
    .filter(r => r.project_id === projektId && r.kalkulation_id === kalkId && r.status !== "storniert")
    .forEach(r => {
      (r.positionen || []).forEach(p => {
        vorperioden[p.oz] = (vorperioden[p.oz] || 0) + (p.menge_aktuell || 0);
      });
    });

  useEffect(() => {
    if (!kalk) return;
    const pos = (kalk.positions || []).map(p => ({
      oz: p.oz || "",
      short_text: p.short_text || "",
      einheit: p.einheit || "",
      menge_kalk: p.menge || 0,
      ep: p.ep || 0,
      menge_vorperiode: vorperioden[p.oz] || 0,
      menge_aktuell: 0,
      menge_kumuliert: vorperioden[p.oz] || 0,
      gp_aktuell: 0,
    }));
    setPositionen(pos);
  }, [kalkId]);

  const setPos = (idx, field, val) => {
    setPositionen(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const next = { ...p, [field]: parseFloat(val) || 0 };
      if (field === "menge_aktuell") {
        next.menge_kumuliert = (next.menge_vorperiode || 0) + (parseFloat(val) || 0);
        next.gp_aktuell = (parseFloat(val) || 0) * (next.ep || 0);
      }
      if (field === "ep") {
        next.gp_aktuell = (next.menge_aktuell || 0) * (parseFloat(val) || 0);
      }
      return next;
    }));
  };

  const betrag_netto = positionen.reduce((s, p) => s + (p.gp_aktuell || 0), 0);
  const betrag_brutto = betrag_netto * (1 + (form.mwst_satz || 0) / 100);

  const handleSave = () => {
    onSave({
      ...form,
      project_id: projektId,
      kalkulation_id: kalkId,
      positionen,
      betrag_netto,
      betrag_brutto,
      status: "entwurf",
    });
    onClose();
    setStep(1);
    setProjektId(""); setKalkId("");
  };

  const projektKalks = kalkulationen.filter(k => k.project_id === projektId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Rechnung aus Kalkulation erstellen
          </DialogTitle>
        </DialogHeader>

        {/* Schritt 1: Projekt + Kalkulation wählen */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Projekt *</Label>
                <Select value={projektId} onValueChange={v => { setProjektId(v); setKalkId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Projekt wählen..." /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name} ({p.project_number})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Kalkulation / Angebot *</Label>
                <Select value={kalkId} onValueChange={setKalkId} disabled={!projektId}>
                  <SelectTrigger><SelectValue placeholder="Kalkulation wählen..." /></SelectTrigger>
                  <SelectContent>
                    {projektKalks.map(k => <SelectItem key={k.id} value={k.id}>{k.version_name} {k.angebot_nummer ? `(${k.angebot_nummer})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {kalk && (
              <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                <p><span className="text-muted-foreground">Positionen:</span> <strong>{(kalk.positions || []).length}</strong></p>
                <p><span className="text-muted-foreground">Angebotssumme:</span> <strong>{fmt2(kalk.angebotsumme)} €</strong></p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Abbrechen</Button>
              <Button onClick={() => setStep(2)} disabled={!kalkId}>Weiter → Positionen</Button>
            </DialogFooter>
          </div>
        )}

        {/* Schritt 2: Positionen + aktuelle Mengen */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">
                {proj?.project_name} – {kalk?.version_name} · Mengen für diese Periode erfassen
              </p>
              <Badge variant="outline" className="text-xs">Netto: {fmt2(betrag_netto)} €</Badge>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-14">OZ</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Kurztext</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Einh.</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">Kalk. Menge</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-22">EP (€)</th>
                    <th className="text-right px-3 py-2 font-medium text-amber-700 w-24">Vorperiode</th>
                    <th className="text-right px-3 py-2 font-medium text-primary w-24">Aktuell *</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">Kumuliert</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">GP (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {positionen.map((p, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-accent/20">
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{p.oz}</td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate">{p.short_text}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{p.einheit}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">{fmt2(p.menge_kalk)}</td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number" step="0.01"
                          value={p.ep || ""}
                          onChange={e => setPos(idx, "ep", e.target.value)}
                          className="h-7 text-xs text-right w-24"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right text-amber-600">{fmt2(p.menge_vorperiode)}</td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number" step="0.001"
                          value={p.menge_aktuell || ""}
                          onChange={e => setPos(idx, "menge_aktuell", e.target.value)}
                          className="h-7 text-xs text-right w-24 border-primary/40 focus-visible:ring-primary"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">{fmt2(p.menge_kumuliert)}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-primary">{fmt2(p.gp_aktuell)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t-2 border-border">
                    <td colSpan={8} className="px-3 py-2 text-xs font-semibold text-right">Betrag netto:</td>
                    <td className="px-3 py-2 text-right font-bold text-primary">{fmt2(betrag_netto)} €</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>Zurück</Button>
              <Button onClick={() => setStep(3)}>Weiter → Kopfdaten</Button>
            </DialogFooter>
          </div>
        )}

        {/* Schritt 3: Kopfdaten */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Betrag netto:</span> <strong>{fmt2(betrag_netto)} €</strong></p>
              <p><span className="text-muted-foreground">Betrag brutto ({form.mwst_satz}% MwSt):</span> <strong>{fmt2(betrag_brutto)} €</strong></p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Rechnungsnummer *</Label>
                <Input value={form.rechnungsnummer} onChange={e => setForm(f => ({ ...f, rechnungsnummer: e.target.value }))} placeholder="2024-001" />
              </div>
              <div className="space-y-1.5">
                <Label>Art</Label>
                <Select value={form.rechnungsart} onValueChange={v => setForm(f => ({ ...f, rechnungsart: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abschlagsrechnung">Abschlagsrechnung</SelectItem>
                    <SelectItem value="schlussrechnung">Schlussrechnung</SelectItem>
                    <SelectItem value="teilrechnung">Teilrechnung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rechnungsdatum</Label>
                <Input type="date" value={form.rechnungsdatum} onChange={e => setForm(f => ({ ...f, rechnungsdatum: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>MwSt (%)</Label>
                <Input type="number" value={form.mwst_satz} onChange={e => setForm(f => ({ ...f, mwst_satz: +e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Sicherheitseinbehalt (€)</Label>
                <Input type="number" step="0.01" value={form.einbehalt} onChange={e => setForm(f => ({ ...f, einbehalt: +e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Skonto (%)</Label>
                <Input type="number" step="0.1" value={form.skonto_prozent} onChange={e => setForm(f => ({ ...f, skonto_prozent: +e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Anmerkungen</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional..." />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>Zurück</Button>
              <Button onClick={handleSave} disabled={!form.rechnungsnummer} className="gap-1.5">
                <Save className="w-4 h-4" /> Rechnung speichern
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}