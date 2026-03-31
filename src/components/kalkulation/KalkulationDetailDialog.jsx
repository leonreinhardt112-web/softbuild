import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Calculator } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import GaebX84Export from "@/components/kalkulation/GaebX84Export";

const STATUS_LABELS = { entwurf: "Entwurf", eingereicht: "Eingereicht", beauftragt: "Beauftragt", abgelehnt: "Abgelehnt" };
const STATUS_COLORS = { entwurf: "bg-secondary text-secondary-foreground", eingereicht: "bg-blue-100 text-blue-700", beauftragt: "bg-green-100 text-green-700", abgelehnt: "bg-red-100 text-red-700" };

const EMPTY_POS = { oz: "", short_text: "", menge: 0, einheit: "m³", ep: 0, lohn_ep: 0, material_ep: 0, geraet_ep: 0, nu_ep: 0, sonstiges_ep: 0 };

export default function KalkulationDetailDialog({ kalkulation, projekt, open, onClose }) {
  const qc = useQueryClient();
  const [positions, setPositions] = useState([]);
  const [status, setStatus] = useState("entwurf");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (kalkulation) {
      setPositions(kalkulation.positions || []);
      setStatus(kalkulation.status || "entwurf");
      setNotes(kalkulation.notes || "");
    }
  }, [kalkulation]);

  const saveMut = useMutation({
    mutationFn: (data) => base44.entities.Kalkulation.update(kalkulation.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kalkulationen"] }),
  });

  const setPos = (idx, field, val) => {
    setPositions(prev => {
      const updated = prev.map((p, i) => {
        if (i !== idx) return p;
        const next = { ...p, [field]: field === "oz" || field === "einheit" || field === "short_text" ? val : parseFloat(val) || 0 };
        // auto-calc ep from components
        if (["lohn_ep","material_ep","geraet_ep","nu_ep","sonstiges_ep"].includes(field)) {
          const fields = ["lohn_ep","material_ep","geraet_ep","nu_ep","sonstiges_ep"];
          next.ep = fields.reduce((s, f) => s + (next[f] || 0), 0);
        }
        next.gp = (next.ep || 0) * (next.menge || 0);
        return next;
      });
      return updated;
    });
  };

  const addPos = () => setPositions(p => [...p, { ...EMPTY_POS }]);
  const removePos = (idx) => setPositions(p => p.filter((_, i) => i !== idx));

  const herstellkosten = positions.reduce((s, p) => s + (p.gp || 0), 0);

  const handleSave = () => {
    saveMut.mutate({ positions, status, notes, kalkulierte_herstellkosten: herstellkosten });
    onClose();
  };

  if (!kalkulation) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            {projekt?.project_name || "Projekt"} – {kalkulation.version_name}
          </DialogTitle>
        </DialogHeader>

        {/* Header-Info */}
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Status:</span>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-7 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            Herstellkosten: <span className="font-semibold text-foreground">{herstellkosten.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
          </div>
        </div>

        {/* Positionstabelle */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-16">OZ</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Kurztext</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">Menge</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-16">Einh.</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">Lohn EP</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">Mat. EP</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">Ger. EP</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">NU EP</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">EP ges.</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">GP</th>
                <th className="w-8 px-2" />
              </tr>
            </thead>
            <tbody>
              {positions.map((p, idx) => (
                <tr key={idx} className="border-b border-border/60 hover:bg-accent/20">
                  <td className="px-2 py-1.5">
                    <Input value={p.oz} onChange={e => setPos(idx, "oz", e.target.value)} className="h-7 text-xs w-14" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input value={p.short_text} onChange={e => setPos(idx, "short_text", e.target.value)} className="h-7 text-xs min-w-[180px]" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" value={p.menge} onChange={e => setPos(idx, "menge", e.target.value)} className="h-7 text-xs text-right w-20" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input value={p.einheit} onChange={e => setPos(idx, "einheit", e.target.value)} className="h-7 text-xs w-14" />
                  </td>
                  {["lohn_ep","material_ep","geraet_ep","nu_ep"].map(f => (
                    <td key={f} className="px-2 py-1.5">
                      <Input type="number" value={p[f] || 0} onChange={e => setPos(idx, f, e.target.value)} className="h-7 text-xs text-right w-20" />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-medium">{(p.ep || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-primary">{(p.gp || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removePos(idx)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 border-t-2 border-border">
                <td colSpan={9} className="px-3 py-2 text-xs font-semibold text-right">Herstellkosten gesamt:</td>
                <td className="px-3 py-2 text-right font-bold text-primary">{herstellkosten.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <Button variant="outline" size="sm" className="gap-2 w-fit" onClick={addPos}>
          <Plus className="w-3.5 h-3.5" /> Position hinzufügen
        </Button>

        {/* Notizen */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Anmerkungen</label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notizen zur Kalkulation..." className="text-sm" />
        </div>

        <div className="flex justify-between items-center pt-2">
          <GaebX84Export kalkulation={{ ...kalkulation, positions }} projekt={projekt} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Schließen</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending}>Speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}