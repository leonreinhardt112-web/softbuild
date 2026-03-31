import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, CheckCircle2, AlertTriangle, Mail, Star, Search } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";

const TYP_LABELS = { email: "E-Mail", brief: "Brief", pdf_schreiben: "PDF-Schreiben", protokoll: "Protokoll", telefonnotiz: "Telefonnotiz", sonstiges: "Sonstiges", bedenken: "Bedenken/Behinderung" };
const STATUS_LABELS = { offen: "Offen", beobachten: "Beobachten", erledigt: "Erledigt" };

const EMPTY = { betreff: "", typ: "email", absender: "", empfaenger: "", datum: "", status: "offen", kurzzusammenfassung: "", inhalt_notiz: "", follow_up_datum: "", wichtig: false, manuell_erledigt: false, entwurf_vorhanden: false, versandfreigabe_erforderlich: true, quelle: "manuell", project_id: "" };

export default function Schriftverkehr() {
  const qc = useQueryClient();
  const [filterTyp, setFilterTyp] = useState("alle");
  const [filterStatus, setFilterStatus] = useState("alle");
  const [filterProjekt, setFilterProjekt] = useState("alle");
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editEintrag, setEditEintrag] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const { data: eintraege = [], isLoading: svLoading } = useQuery({
    queryKey: ["schriftverkehr_global"],
    queryFn: () => base44.entities.SchriftverkehrEintrag.list("-datum", 200),
  });

  const { data: bedenken = [], isLoading: bdLoading } = useQuery({
    queryKey: ["bedenken_global"],
    queryFn: () => base44.entities.Bedenken.list("-eingereicht_am", 200),
  });

  const isLoading = svLoading || bdLoading;
  const combined = [
    ...eintraege,
    ...bedenken.map(b => ({
      id: b.id,
      betreff: b.titel,
      typ: "bedenken",
      datum: b.eingereicht_am,
      absender: b.einreichender,
      empfaenger: b.adressat,
      status: b.status,
      kurzzusammenfassung: b.beschreibung?.substring(0, 100),
      project_id: b.project_id,
      _isBedenken: true,
      _bedenkenData: b,
    }))
  ];

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.SchriftverkehrEintrag.create(d),
    onSuccess: () => { qc.invalidateQueries(["schriftverkehr_global"]); setShowDialog(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SchriftverkehrEintrag.update(id, data),
    onSuccess: () => qc.invalidateQueries(["schriftverkehr_global"]),
  });

  const handleOpen = (e = null) => {
    setEditEintrag(e);
    setForm(e ? { ...e, project_id: e.project_id || "" } : { ...EMPTY });
    setShowDialog(true);
  };

  const handleSave = () => {
    const data = { ...form };
    if (!data.project_id) delete data.project_id;
    if (editEintrag) updateMut.mutate({ id: editEintrag.id, data });
    else createMut.mutate(data);
    setShowDialog(false);
  };

  const isFollowUpUeberfaellig = (e) => e.follow_up_datum && isPast(parseISO(e.follow_up_datum)) && e.status !== "erledigt";

  const projectMap = {};
  projects.forEach(p => { projectMap[p.id] = p; });

  const filtered = combined.filter(e => {
    const typOk = filterTyp === "alle" || e.typ === filterTyp;
    const statusOk = filterStatus === "alle" || e.status === filterStatus;
    const projOk = filterProjekt === "alle" || (filterProjekt === "kein_projekt" ? !e.project_id : e.project_id === filterProjekt);
    const searchOk = !search || [e.betreff, e.absender, e.empfaenger, e.kurzzusammenfassung].some(f => f?.toLowerCase().includes(search.toLowerCase()));
    return typOk && statusOk && projOk && searchOk;
  }).sort((a, b) => new Date(b.datum) - new Date(a.datum));

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Schriftverkehr & Bedenken</h1>
           <p className="text-sm text-muted-foreground mt-0.5">{combined.length} Einträge · globales Kommunikations-Center</p>
        </div>
        <Button className="gap-2" onClick={() => handleOpen()}>
          <Plus className="w-4 h-4" />Neuer Eintrag
        </Button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen..." className="pl-8 h-8 text-xs w-52" />
        </div>
        <Select value={filterTyp} onValueChange={setFilterTyp}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Typen</SelectItem>
            <SelectItem value="email">E-Mail</SelectItem>
            <SelectItem value="brief">Brief</SelectItem>
            <SelectItem value="pdf_schreiben">PDF-Schreiben</SelectItem>
            <SelectItem value="protokoll">Protokoll</SelectItem>
            <SelectItem value="telefonnotiz">Telefonnotiz</SelectItem>
            <SelectItem value="sonstiges">Sonstiges</SelectItem>
            <SelectItem value="bedenken">Bedenken/Behinderung</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProjekt} onValueChange={setFilterProjekt}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Projekte</SelectItem>
            <SelectItem value="kein_projekt">Ohne Projekt</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array(5).fill(0).map((_,i)=><div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">Keine Einträge gefunden</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => {
            const proj = e.project_id ? projectMap[e.project_id] : null;
            const isBedenken = e._isBedenken;
            const statusLabels = isBedenken ? { entwurf: "Entwurf", eingereicht: "Eingereicht", bestätigt: "Bestätigt", widersprochen: "Widersprochen", erledigt: "Erledigt" } : STATUS_LABELS;
            return (
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
                            {statusLabels[e.status]||e.status}
                          </Badge>
                          {isFollowUpUeberfaellig(e) && !isBedenken && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs gap-1"><AlertTriangle className="w-3 h-3" />Follow-up fällig</Badge>
                          )}
                          {isBedenken && e._bedenkenData?.kosten_forderung > 0 && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs">€ {e._bedenkenData.kosten_forderung}</Badge>
                          )}
                          {proj && (
                            <Badge variant="secondary" className="text-xs">{proj.project_name}</Badge>
                          )}
                          {!e.project_id && <Badge variant="secondary" className="text-xs text-muted-foreground">Kein Projekt</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                          {e.datum && <span>{format(parseISO(e.datum),"dd.MM.yyyy")}</span>}
                          {e.absender && !isBedenken && <span>Von: {e.absender}</span>}
                          {e.empfaenger && !isBedenken && <span>An: {e.empfaenger}</span>}
                          {e.follow_up_datum && !isBedenken && <span>Follow-up: {format(parseISO(e.follow_up_datum),"dd.MM.yyyy")}</span>}
                        </div>
                        {e.kurzzusammenfassung && <p className="text-xs text-muted-foreground mt-1 truncate">{e.kurzzusammenfassung}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!isBedenken && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>handleOpen(e)}>Bearbeiten</Button>}
                      {e.status !== "erledigt" && !isBedenken && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                          onClick={()=>updateMut.mutate({id:e.id,data:{status:"erledigt",manuell_erledigt:true}})}>
                          <CheckCircle2 className="w-3 h-3" />Erledigt
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
            <div><Label className="text-xs">Projektzuordnung (optional)</Label>
              <Select value={form.project_id||"kein"} onValueChange={v=>setForm({...form,project_id:v==="kein"?"":v})}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Kein Projekt" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kein">Kein Projekt</SelectItem>
                  {projects.map(p=><SelectItem key={p.id} value={p.id} className="text-xs">{p.project_name}</SelectItem>)}
                </SelectContent>
              </Select>
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