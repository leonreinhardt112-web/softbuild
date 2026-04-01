import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";

const PRIO_LABELS = { niedrig: "Niedrig", mittel: "Mittel", hoch: "Hoch", kritisch: "Kritisch" };
const PRIO_COLORS = { niedrig: "bg-gray-100 text-gray-700", mittel: "bg-blue-100 text-blue-700", hoch: "bg-amber-100 text-amber-700", kritisch: "bg-red-100 text-red-700" };
const STATUS_LABELS = { offen: "Offen", in_bearbeitung: "In Bearbeitung", erledigt: "Erledigt", verworfen: "Verworfen" };

const EMPTY = { titel: "", beschreibung: "", faellig_am: "", prioritaet: "mittel", status: "offen", zugewiesen_an: "", quelle_typ: "manuell", vorschlag_nur: false, manuelle_bestaetigung_erforderlich: true };

export default function AufgabenTab({ projectId, aufgaben, currentUser }) {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("alle");
  const [filterPrio, setFilterPrio] = useState("alle");
  const [showDialog, setShowDialog] = useState(false);
  const [editAufgabe, setEditAufgabe] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Aufgabe.create({ ...d, project_id: projectId }),
    onSuccess: () => { qc.invalidateQueries(["aufgaben", projectId]); setShowDialog(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Aufgabe.update(id, data),
    onSuccess: () => qc.invalidateQueries(["aufgaben", projectId]),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Aufgabe.delete(id),
    onSuccess: () => qc.invalidateQueries(["aufgaben", projectId]),
  });

  const handleOpen = (a = null) => {
    setEditAufgabe(a); setForm(a ? { ...a } : { ...EMPTY }); setShowDialog(true);
  };

  const handleSave = () => {
    if (editAufgabe) updateMut.mutate({ id: editAufgabe.id, data: form });
    else createMut.mutate(form);
    setShowDialog(false);
  };

  const isUeberfaellig = (a) => a.faellig_am && isPast(parseISO(a.faellig_am)) && !["erledigt","verworfen"].includes(a.status);

  const mineAufgaben = aufgaben.filter(a => !a.project_id || a.project_id === projectId || a.zugewiesen_an === currentUser?.email);
  const filtered = mineAufgaben.filter(a => {
    const statusOk = filterStatus === "alle" || a.status === filterStatus;
    const prioOk = filterPrio === "alle" || a.prioritaet === filterPrio;
    return statusOk && prioOk;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPrio} onValueChange={setFilterPrio}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Prioritäten</SelectItem>
              {Object.entries(PRIO_LABELS).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="gap-1.5" onClick={()=>handleOpen()}>
          <Plus className="w-3.5 h-3.5" />Aufgabe anlegen
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Keine Aufgaben vorhanden</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.sort((a,b)=>{
            const pOrd = {kritisch:0,hoch:1,mittel:2,niedrig:3};
            return (pOrd[a.prioritaet]||2)-(pOrd[b.prioritaet]||2);
          }).map(a => (
            <Card key={a.id} className={`${isUeberfaellig(a)?"border-red-300 bg-red-50/40":""} ${["erledigt","verworfen"].includes(a.status)?"opacity-60":""}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{a.titel}</span>
                      <Badge className={`text-xs ${PRIO_COLORS[a.prioritaet]||"bg-gray-100 text-gray-700"}`}>{PRIO_LABELS[a.prioritaet]||a.prioritaet}</Badge>
                      <Badge variant="outline" className="text-xs">{STATUS_LABELS[a.status]||a.status}</Badge>
                      {isUeberfaellig(a) && (
                        <Badge className="bg-red-100 text-red-700 text-xs gap-1"><AlertTriangle className="w-3 h-3" />Überfällig</Badge>
                      )}
                      {a.vorschlag_nur && <Badge className="bg-purple-100 text-purple-700 text-xs">Vorschlag</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                      {a.faellig_am && <span>Fällig: {format(parseISO(a.faellig_am),"dd.MM.yyyy")}</span>}
                      {a.zugewiesen_an && <span>Zugewiesen: {a.zugewiesen_an}</span>}
                    </div>
                    {a.beschreibung && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.beschreibung}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>handleOpen(a)}>Bearbeiten</Button>
                    {!["erledigt","verworfen"].includes(a.status) && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                        onClick={()=>updateMut.mutate({id:a.id,data:{status:"erledigt"}})}>
                        <CheckCircle2 className="w-3 h-3" />Erledigt
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={()=>deleteMut.mutate(a.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editAufgabe?"Aufgabe bearbeiten":"Neue Aufgabe"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Titel *</Label><Input value={form.titel} onChange={e=>setForm({...form,titel:e.target.value})} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Priorität</Label>
                <Select value={form.prioritaet} onValueChange={v=>setForm({...form,prioritaet:v})}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIO_LABELS).map(([k,v])=><SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([k,v])=><SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Fällig am</Label><Input type="date" value={form.faellig_am||""} onChange={e=>setForm({...form,faellig_am:e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Zugewiesen an</Label><Input value={form.zugewiesen_an||""} onChange={e=>setForm({...form,zugewiesen_an:e.target.value})} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs">Beschreibung</Label><Textarea value={form.beschreibung||""} onChange={e=>setForm({...form,beschreibung:e.target.value})} className="mt-1 h-20" /></div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={!!form.vorschlag_nur} onChange={e=>setForm({...form,vorschlag_nur:e.target.checked})} />
              Nur Vorschlag (noch nicht aktiv)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={!form.titel}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}