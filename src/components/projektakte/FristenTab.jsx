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
import { Plus, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";

const TYP_LABELS = {
  vertragsbeginn: "Vertragsbeginn", vertragsende: "Vertragsende",
  prueffrist_rechnung: "Prüffrist Rechnung", zahlungsfrist: "Zahlungsfrist",
  nachfrist: "Nachfrist", abnahmefrist: "Abnahmefrist",
  gewaehrleistungsbeginn: "Gewährleistungsbeginn", gewaehrleistungsende: "Gewährleistungsende",
  reaktionsfrist_schriftverkehr: "Reaktionsfrist Schriftverkehr", wiedervorlage: "Wiedervorlage", sonstiges: "Sonstiges",
};

const EMPTY = { titel: "", typ: "wiedervorlage", datum: "", status: "offen", verantwortlich: "", bemerkung: "", erinnerung_aktiv: false, folgeaktion_noetig: false, schreibenvorschlag_erwuenscht: false };

export default function FristenTab({ projectId, fristen }) {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("alle");
  const [filterTyp, setFilterTyp] = useState("alle");
  const [showDialog, setShowDialog] = useState(false);
  const [editFrist, setEditFrist] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.ProjektFrist.create({ ...d, project_id: projectId }),
    onSuccess: () => { qc.invalidateQueries(["fristen", projectId]); setShowDialog(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProjektFrist.update(id, data),
    onSuccess: () => qc.invalidateQueries(["fristen", projectId]),
  });

  const handleOpen = (frist = null) => {
    setEditFrist(frist);
    setForm(frist ? { ...frist } : { ...EMPTY });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (editFrist) updateMut.mutate({ id: editFrist.id, data: form });
    else createMut.mutate(form);
    setShowDialog(false);
  };

  const handleErledigt = (frist) => {
    updateMut.mutate({ id: frist.id, data: { status: "erledigt" } });
  };

  const filtered = fristen.filter(f => {
    const statusOk = filterStatus === "alle" || f.status === filterStatus ||
      (filterStatus === "ueberfaellig" && f.datum && isPast(parseISO(f.datum)) && f.status !== "erledigt");
    const typOk = filterTyp === "alle" || f.typ === filterTyp;
    return statusOk && typOk;
  });

  const isUeberfaellig = (f) => f.datum && isPast(parseISO(f.datum)) && f.status !== "erledigt";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              <SelectItem value="offen">Offen</SelectItem>
              <SelectItem value="ueberfaellig">Überfällig</SelectItem>
              <SelectItem value="erledigt">Erledigt</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTyp} onValueChange={setFilterTyp}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Typen</SelectItem>
              {Object.entries(TYP_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => handleOpen()}>
          <Plus className="w-3.5 h-3.5" />Frist anlegen
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Keine Fristen gefunden</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.sort((a,b) => (a.datum||"").localeCompare(b.datum||"")).map(f => (
            <Card key={f.id} className={isUeberfaellig(f) ? "border-red-300 bg-red-50/50" : f.status === "erledigt" ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{f.titel}</span>
                      <Badge variant="outline" className="text-xs">{TYP_LABELS[f.typ] || f.typ}</Badge>
                      {isUeberfaellig(f) && (
                        <Badge className="bg-red-100 text-red-700 text-xs gap-1">
                          <AlertTriangle className="w-3 h-3" />Überfällig
                        </Badge>
                      )}
                      {f.status === "erledigt" && <Badge className="bg-green-100 text-green-700 text-xs">Erledigt</Badge>}
                      {f.folgeaktion_noetig && <Badge className="bg-amber-100 text-amber-700 text-xs">Folgeaktion</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                      {f.datum && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(parseISO(f.datum), "dd.MM.yyyy")}</span>}
                      {f.verantwortlich && <span>Verantwortlich: {f.verantwortlich}</span>}
                      {f.bemerkung && <span className="truncate max-w-xs">{f.bemerkung}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleOpen(f)}>Bearbeiten</Button>
                    {f.status !== "erledigt" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => handleErledigt(f)}>
                        <CheckCircle2 className="w-3 h-3" />Erledigt
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editFrist ? "Frist bearbeiten" : "Neue Frist"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Titel *</Label><Input value={form.titel} onChange={e=>setForm({...form,titel:e.target.value})} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Typ</Label>
                <Select value={form.typ} onValueChange={v=>setForm({...form,typ:v})}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYP_LABELS).map(([k,v])=><SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Datum *</Label><Input type="date" value={form.datum} onChange={e=>setForm({...form,datum:e.target.value})} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offen">Offen</SelectItem>
                    <SelectItem value="erledigt">Erledigt</SelectItem>
                    <SelectItem value="ueberfaellig">Überfällig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Verantwortlich</Label><Input value={form.verantwortlich||""} onChange={e=>setForm({...form,verantwortlich:e.target.value})} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs">Bemerkung</Label><Textarea value={form.bemerkung||""} onChange={e=>setForm({...form,bemerkung:e.target.value})} className="mt-1 h-20" /></div>
            <div className="flex gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={!!form.folgeaktion_noetig} onChange={e=>setForm({...form,folgeaktion_noetig:e.target.checked})} />
                Folgeaktion nötig
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={!!form.schreibenvorschlag_erwuenscht} onChange={e=>setForm({...form,schreibenvorschlag_erwuenscht:e.target.checked})} />
                Schreibenvorschlag
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={!form.titel||!form.datum}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}