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
import { Plus, CheckCircle2, AlertTriangle, Mail, Star } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";

export const TYP_LABELS = { email: "E-Mail", brief: "Brief", pdf_schreiben: "PDF-Schreiben", protokoll: "Protokoll", telefonnotiz: "Telefonnotiz", sonstiges: "Sonstiges" };
const STATUS_LABELS = { offen: "Offen", beobachten: "Beobachten", erledigt: "Erledigt" };

const EMPTY = { betreff: "", typ: "email", absender: "", empfaenger: "", datum: "", status: "offen", kurzzusammenfassung: "", inhalt_notiz: "", follow_up_datum: "", wichtig: false, manuell_erledigt: false, entwurf_vorhanden: false, versandfreigabe_erforderlich: true, quelle: "manuell" };

export default function SchriftverkehrTab({ projectId, eintraege }) {
  const qc = useQueryClient();
  const [filterTyp, setFilterTyp] = useState("alle");
  const [filterStatus, setFilterStatus] = useState("alle");
  const [showDialog, setShowDialog] = useState(false);
  const [editEintrag, setEditEintrag] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.SchriftverkehrEintrag.create({ ...d, project_id: projectId }),
    onSuccess: () => { qc.invalidateQueries(["schriftverkehr", projectId]); setShowDialog(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SchriftverkehrEintrag.update(id, data),
    onSuccess: () => qc.invalidateQueries(["schriftverkehr", projectId]),
  });

  const handleOpen = (e = null) => {
    setEditEintrag(e); setForm(e ? { ...e } : { ...EMPTY }); setShowDialog(true);
  };

  const handleSave = () => {
    if (editEintrag) updateMut.mutate({ id: editEintrag.id, data: form });
    else createMut.mutate(form);
    setShowDialog(false);
  };

  const isFollowUpUeberfaellig = (e) => e.follow_up_datum && isPast(parseISO(e.follow_up_datum)) && e.status !== "erledigt";

  const filtered = eintraege.filter(e => {
    const typOk = filterTyp === "alle" || e.typ === filterTyp;
    const statusOk = filterStatus === "alle" || e.status === filterStatus;
    return typOk && statusOk;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={filterTyp} onValueChange={setFilterTyp}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Typen</SelectItem>
              {Object.entries(TYP_LABELS).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="gap-1.5" onClick={()=>handleOpen()}>
          <Plus className="w-3.5 h-3.5" />Eintrag anlegen
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Kein Schriftverkehr vorhanden</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.sort((a,b)=>(b.datum||"").localeCompare(a.datum||"")).map(e => (
            <Card key={e.id} className={isFollowUpUeberfaellig(e)?"border-amber-300 bg-amber-50/40":""}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{e.betreff}</span>
                        {e.wichtig && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        <Badge variant="outline" className="text-xs">{TYP_LABELS[e.typ]||e.typ}</Badge>
                        <Badge className={`text-xs ${e.status==="erledigt"?"bg-green-100 text-green-700":e.status==="beobachten"?"bg-blue-100 text-blue-700":"bg-gray-100 text-gray-700"}`}>
                          {STATUS_LABELS[e.status]||e.status}
                        </Badge>
                        {isFollowUpUeberfaellig(e) && (
                          <Badge className="bg-amber-100 text-amber-700 text-xs gap-1">
                            <AlertTriangle className="w-3 h-3" />Follow-up überfällig
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                        {e.datum && <span>{format(parseISO(e.datum),"dd.MM.yyyy")}</span>}
                        {e.absender && <span>Von: {e.absender}</span>}
                        {e.empfaenger && <span>An: {e.empfaenger}</span>}
                        {e.follow_up_datum && <span>Follow-up: {format(parseISO(e.follow_up_datum),"dd.MM.yyyy")}</span>}
                      </div>
                      {e.kurzzusammenfassung && <p className="text-xs text-muted-foreground mt-1 truncate">{e.kurzzusammenfassung}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>handleOpen(e)}>Bearbeiten</Button>
                    {e.status !== "erledigt" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                        onClick={()=>updateMut.mutate({id:e.id,data:{status:"erledigt",manuell_erledigt:true}})}>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editEintrag?"Eintrag bearbeiten":"Neuer Schriftverkehrseintrag"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Betreff *</Label><Input value={form.betreff} onChange={e=>setForm({...form,betreff:e.target.value})} className="mt-1" /></div>
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
              <div><Label className="text-xs">Absender</Label><Input value={form.absender||""} onChange={e=>setForm({...form,absender:e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Empfänger</Label><Input value={form.empfaenger||""} onChange={e=>setForm({...form,empfaenger:e.target.value})} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([k,v])=><SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Follow-up-Datum</Label><Input type="date" value={form.follow_up_datum||""} onChange={e=>setForm({...form,follow_up_datum:e.target.value})} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs">Kurzzusammenfassung</Label><Input value={form.kurzzusammenfassung||""} onChange={e=>setForm({...form,kurzzusammenfassung:e.target.value})} className="mt-1" /></div>
            <div><Label className="text-xs">Inhalt / Notiz</Label><Textarea value={form.inhalt_notiz||""} onChange={e=>setForm({...form,inhalt_notiz:e.target.value})} className="mt-1 h-20" /></div>
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!form.wichtig} onChange={e=>setForm({...form,wichtig:e.target.checked})} />Wichtig</label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!form.entwurf_vorhanden} onChange={e=>setForm({...form,entwurf_vorhanden:e.target.checked})} />Entwurf vorhanden</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={!form.betreff||!form.datum}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}