import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

const EMPTY = { gebuchte_stunden_gesamt: "", quelle: "123erfasst", import_datum: new Date().toISOString().split("T")[0], zeitraum_von: "", zeitraum_bis: "", bemerkung: "" };

export default function StundenstandWidget({ projectId, stundenstaende }) {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.ProjektStundenstand.create({ ...d, project_id: projectId }),
    onSuccess: () => { qc.invalidateQueries(["stundenstand", projectId]); setShowDialog(false); },
  });

  const handleSave = () => {
    createMut.mutate({ ...form, gebuchte_stunden_gesamt: parseFloat(form.gebuchte_stunden_gesamt) || 0 });
  };

  const sorted = [...stundenstaende].sort((a,b) => (b.import_datum||"").localeCompare(a.import_datum||""));
  const latest = sorted[0];

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Stundenstand (123erfasst)</CardTitle>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>{setForm(EMPTY);setShowDialog(true);}}>
          <Plus className="w-3 h-3" />Eintragen
        </Button>
      </CardHeader>
      <CardContent>
        {latest ? (
          <div>
            <div className="text-2xl font-bold">{latest.gebuchte_stunden_gesamt} h</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stand: {latest.import_datum ? format(parseISO(latest.import_datum),"dd.MM.yyyy") : "–"}
              {" · "}{latest.quelle}
            </p>
            {(latest.zeitraum_von || latest.zeitraum_bis) && (
              <p className="text-xs text-muted-foreground">
                Zeitraum: {latest.zeitraum_von ? format(parseISO(latest.zeitraum_von),"dd.MM.yyyy") : "?"} – {latest.zeitraum_bis ? format(parseISO(latest.zeitraum_bis),"dd.MM.yyyy") : "?"}
              </p>
            )}
            {sorted.length > 1 && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer">Verlauf ({sorted.length} Einträge)</summary>
                <div className="mt-2 space-y-1">
                  {sorted.slice(1).map(s => (
                    <div key={s.id} className="text-xs flex justify-between text-muted-foreground">
                      <span>{s.import_datum ? format(parseISO(s.import_datum),"dd.MM.yyyy") : "–"}</span>
                      <span>{s.gebuchte_stunden_gesamt} h</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Noch kein Stundenstand erfasst</p>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Stundenstand erfassen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Gebuchte Stunden gesamt *</Label><Input type="number" step="0.5" value={form.gebuchte_stunden_gesamt} onChange={e=>setForm({...form,gebuchte_stunden_gesamt:e.target.value})} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Quelle</Label>
                <Select value={form.quelle} onValueChange={v=>setForm({...form,quelle:v})}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="123erfasst">123erfasst</SelectItem>
                    <SelectItem value="manuell">Manuell</SelectItem>
                    <SelectItem value="sonstiges">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Importdatum</Label><Input type="date" value={form.import_datum} onChange={e=>setForm({...form,import_datum:e.target.value})} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Zeitraum von</Label><Input type="date" value={form.zeitraum_von||""} onChange={e=>setForm({...form,zeitraum_von:e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Zeitraum bis</Label><Input type="date" value={form.zeitraum_bis||""} onChange={e=>setForm({...form,zeitraum_bis:e.target.value})} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs">Bemerkung</Label><Textarea value={form.bemerkung||""} onChange={e=>setForm({...form,bemerkung:e.target.value})} className="mt-1 h-16" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={!form.gebuchte_stunden_gesamt}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}