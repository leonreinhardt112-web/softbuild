import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, CheckCircle2, AlertTriangle, Mail, Star, Search,
  Inbox, Pencil, Trash2, XCircle, Globe, Users, Sparkles
} from "lucide-react";
import KIEmailTriage from "@/components/postfach/KIEmailTriage";
import { format, isPast, parseISO } from "date-fns";

const TYP_LABELS = { email: "E-Mail", brief: "Brief", pdf_schreiben: "PDF-Schreiben", protokoll: "Protokoll", telefonnotiz: "Telefonnotiz", sonstiges: "Sonstiges" };
const STATUS_LABELS = { offen: "Offen", beobachten: "Beobachten", erledigt: "Erledigt" };
const ANBIETER_LABELS = { google_workspace: "Google Workspace", outlook_365: "Outlook / Microsoft 365", web_de: "web.de", sonstiges: "Sonstiges" };

const EMPTY_EINTRAG = { betreff: "", typ: "email", absender: "", empfaenger: "", datum: "", status: "offen", kurzzusammenfassung: "", inhalt_notiz: "", follow_up_datum: "", wichtig: false, manuell_erledigt: false, entwurf_vorhanden: false, versandfreigabe_erforderlich: true, quelle: "manuell", project_id: "" };
const EMPTY_POSTFACH = { email_adresse: "", bezeichnung: "", typ: "persoenlich", anbieter: "google_workspace", user_emails: [], notiz: "" };

export default function Postfaecher() {
  const qc = useQueryClient();

  // ── Schriftverkehr / Inbox State ──
  const [filterTyp, setFilterTyp] = useState("alle");
  const [filterStatus, setFilterStatus] = useState("alle");
  const [filterProjekt, setFilterProjekt] = useState("alle");
  const [search, setSearch] = useState("");
  const [showEintragDialog, setShowEintragDialog] = useState(false);
  const [editEintrag, setEditEintrag] = useState(null);
  const [form, setForm] = useState(EMPTY_EINTRAG);

  // ── Postfach-Verwaltung State ──
  const [showPostfachDialog, setShowPostfachDialog] = useState(false);
  const [editingPostfach, setEditingPostfach] = useState(null);
  const [postfachForm, setPostfachForm] = useState(EMPTY_POSTFACH);
  const [postfachUserInput, setPostfachUserInput] = useState("");

  // ── Data ──
  const { data: eintraege = [], isLoading } = useQuery({
    queryKey: ["schriftverkehr_global"],
    queryFn: () => base44.entities.SchriftverkehrEintrag.list("-datum", 200),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });
  const { data: postfaecher = [] } = useQuery({
    queryKey: ["postfaecher"],
    queryFn: () => base44.entities.Postfach.list("bezeichnung", 200),
  });
  const { data: companyData } = useQuery({
    queryKey: ["company-domain"],
    queryFn: async () => {
      const companies = await base44.entities.Stammdatum.filter({ typ: "unternehmen", aktiv: true }, undefined, 1);
      return companies?.[0] || null;
    },
  });
  const emailDomain = companyData?.email_domain || "";

  // ── Mutations: Schriftverkehr ──
  const createEintragMut = useMutation({
    mutationFn: (d) => base44.entities.SchriftverkehrEintrag.create(d),
    onSuccess: () => { qc.invalidateQueries(["schriftverkehr_global"]); setShowEintragDialog(false); },
  });
  const updateEintragMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SchriftverkehrEintrag.update(id, data),
    onSuccess: () => qc.invalidateQueries(["schriftverkehr_global"]),
  });

  // ── Mutations: Postfach ──
  const createPostfachMut = useMutation({
    mutationFn: (d) => base44.entities.Postfach.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["postfaecher"] }); setShowPostfachDialog(false); setPostfachForm(EMPTY_POSTFACH); },
  });
  const updatePostfachMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Postfach.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["postfaecher"] }); setShowPostfachDialog(false); setEditingPostfach(null); },
  });
  const deletePostfachMut = useMutation({
    mutationFn: (id) => base44.entities.Postfach.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["postfaecher"] }),
  });

  // ── Handlers ──
  const handleOpenEintrag = (e = null) => {
    setEditEintrag(e);
    setForm(e ? { ...e, project_id: e.project_id || "" } : { ...EMPTY_EINTRAG });
    setShowEintragDialog(true);
  };
  const handleSaveEintrag = () => {
    const data = { ...form };
    if (!data.project_id) delete data.project_id;
    if (editEintrag) updateEintragMut.mutate({ id: editEintrag.id, data });
    else createEintragMut.mutate(data);
    setShowEintragDialog(false);
  };

  const openPostfachDialog = (pf = null) => {
    if (pf) { setEditingPostfach(pf); setPostfachForm({ ...pf, user_emails: pf.user_emails || [] }); }
    else { setEditingPostfach(null); setPostfachForm(EMPTY_POSTFACH); }
    setPostfachUserInput("");
    setShowPostfachDialog(true);
  };
  const handlePostfachSave = () => {
    if (editingPostfach) updatePostfachMut.mutate({ id: editingPostfach.id, data: postfachForm });
    else createPostfachMut.mutate(postfachForm);
  };
  const addPostfachUser = () => {
    if (!postfachUserInput.trim()) return;
    setPostfachForm(f => ({ ...f, user_emails: [...(f.user_emails || []), postfachUserInput.trim()] }));
    setPostfachUserInput("");
  };
  const removePostfachUser = (email) => setPostfachForm(f => ({ ...f, user_emails: f.user_emails.filter(e => e !== email) }));

  const isFollowUpUeberfaellig = (e) => e.follow_up_datum && isPast(parseISO(e.follow_up_datum)) && e.status !== "erledigt";
  const projectMap = {};
  projects.forEach(p => { projectMap[p.id] = p; });

  const filtered = eintraege.filter(e => {
    const typOk = filterTyp === "alle" || e.typ === filterTyp;
    const statusOk = filterStatus === "alle" || e.status === filterStatus;
    const projOk = filterProjekt === "alle" || (filterProjekt === "kein_projekt" ? !e.project_id : e.project_id === filterProjekt);
    const searchOk = !search || [e.betreff, e.absender, e.empfaenger, e.kurzzusammenfassung].some(f => f?.toLowerCase().includes(search.toLowerCase()));
    return typOk && statusOk && projOk && searchOk;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Inbox className="w-6 h-6" />Postfächer
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Schriftverkehr & Postfach-Verwaltung</p>
      </div>

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5">
            <Mail className="w-3.5 h-3.5" />Schriftverkehr ({eintraege.length})
          </TabsTrigger>
          <TabsTrigger value="ki-triage" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />KI-Triage
          </TabsTrigger>
          <TabsTrigger value="postfaecher" className="gap-1.5">
            <Inbox className="w-3.5 h-3.5" />Postfächer ({postfaecher.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Schriftverkehr / Inbox ── */}
        <TabsContent value="inbox" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen..." className="pl-8 h-8 text-xs w-52" />
              </div>
              <Select value={filterTyp} onValueChange={setFilterTyp}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Typen</SelectItem>
                  {Object.entries(TYP_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
            <Button className="gap-2 shrink-0" onClick={() => handleOpenEintrag()}>
              <Plus className="w-4 h-4" />Neuer Eintrag
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">Keine Einträge gefunden</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(e => {
                const proj = e.project_id ? projectMap[e.project_id] : null;
                return (
                  <Card key={e.id} className={isFollowUpUeberfaellig(e) ? "border-amber-300 bg-amber-50/40" : ""}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{e.betreff}</span>
                              {e.wichtig && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                              <Badge variant="outline" className="text-xs">{TYP_LABELS[e.typ] || e.typ}</Badge>
                              <Badge className={`text-xs ${e.status === "erledigt" ? "bg-green-100 text-green-700" : e.status === "beobachten" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                                {STATUS_LABELS[e.status] || e.status}
                              </Badge>
                              {isFollowUpUeberfaellig(e) && (
                                <Badge className="bg-amber-100 text-amber-700 text-xs gap-1"><AlertTriangle className="w-3 h-3" />Follow-up fällig</Badge>
                              )}
                              {proj && <Badge variant="secondary" className="text-xs">{proj.project_name}</Badge>}
                              {!e.project_id && <Badge variant="secondary" className="text-xs text-muted-foreground">Kein Projekt</Badge>}
                            </div>
                            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                              {e.datum && <span>{format(parseISO(e.datum), "dd.MM.yyyy")}</span>}
                              {e.absender && <span>Von: {e.absender}</span>}
                              {e.empfaenger && <span>An: {e.empfaenger}</span>}
                              {e.follow_up_datum && <span>Follow-up: {format(parseISO(e.follow_up_datum), "dd.MM.yyyy")}</span>}
                            </div>
                            {e.kurzzusammenfassung && <p className="text-xs text-muted-foreground mt-1 truncate">{e.kurzzusammenfassung}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleOpenEintrag(e)}>Bearbeiten</Button>
                          {e.status !== "erledigt" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                              onClick={() => updateEintragMut.mutate({ id: e.id, data: { status: "erledigt", manuell_erledigt: true } })}>
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
        </TabsContent>

        {/* ── Tab: KI-Triage ── */}
        <TabsContent value="ki-triage" className="mt-4">
          <KIEmailTriage emails={eintraege} projects={projects} />
        </TabsContent>

        {/* ── Tab: Postfach-Verwaltung ── */}
        <TabsContent value="postfaecher" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Persönliche und geteilte E-Mail-Postfächer verwalten</p>
              {emailDomain && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Globe className="w-3 h-3" />Domain: <span className="font-mono font-medium">{emailDomain}</span>
                </p>
              )}
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => openPostfachDialog()}>
              <Plus className="w-3.5 h-3.5" />Postfach anlegen
            </Button>
          </div>

          {["persoenlich", "geteilt"].map(typ => {
            const gefiltert = postfaecher.filter(p => p.typ === typ);
            return (
              <Card key={typ}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {typ === "persoenlich" ? <Mail className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    {typ === "persoenlich" ? "Persönliche Postfächer" : "Gruppenpostfächer"}
                    <span className="text-muted-foreground font-normal">({gefiltert.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {gefiltert.length === 0 ? (
                    <div className="px-6 pb-6 text-sm text-muted-foreground">
                      Noch keine {typ === "persoenlich" ? "persönlichen" : "Gruppen"}postfächer angelegt.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {gefiltert.map(pf => (
                        <div key={pf.id} className="px-6 py-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Mail className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm">{pf.bezeichnung}</p>
                              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                {ANBIETER_LABELS[pf.anbieter] || pf.anbieter}
                              </span>
                              {!pf.aktiv && <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Inaktiv</span>}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">{pf.email_adresse}</p>
                            {pf.user_emails?.length > 0 && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Zugriff: {pf.user_emails.join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPostfachDialog(pf)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deletePostfachMut.mutate(pf.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* ── Schriftverkehr Dialog ── */}
      <Dialog open={showEintragDialog} onOpenChange={setShowEintragDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editEintrag ? "Eintrag bearbeiten" : "Neuer Schriftverkehrseintrag"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Betreff *</Label><Input value={form.betreff} onChange={e => setForm({ ...form, betreff: e.target.value })} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Typ</Label>
                <Select value={form.typ} onValueChange={v => setForm({ ...form, typ: v })}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYP_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Datum *</Label><Input type="date" value={form.datum} onChange={e => setForm({ ...form, datum: e.target.value })} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Absender</Label><Input value={form.absender || ""} onChange={e => setForm({ ...form, absender: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Empfänger</Label><Input value={form.empfaenger || ""} onChange={e => setForm({ ...form, empfaenger: e.target.value })} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Follow-up-Datum</Label><Input type="date" value={form.follow_up_datum || ""} onChange={e => setForm({ ...form, follow_up_datum: e.target.value })} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs">Projektzuordnung (optional)</Label>
              <Select value={form.project_id || "kein"} onValueChange={v => setForm({ ...form, project_id: v === "kein" ? "" : v })}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Kein Projekt" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kein">Kein Projekt</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.project_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Kurzzusammenfassung</Label><Input value={form.kurzzusammenfassung || ""} onChange={e => setForm({ ...form, kurzzusammenfassung: e.target.value })} className="mt-1" /></div>
            <div><Label className="text-xs">Inhalt / Notiz</Label><Textarea value={form.inhalt_notiz || ""} onChange={e => setForm({ ...form, inhalt_notiz: e.target.value })} className="mt-1 h-20" /></div>
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!form.wichtig} onChange={e => setForm({ ...form, wichtig: e.target.checked })} />Wichtig</label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!form.entwurf_vorhanden} onChange={e => setForm({ ...form, entwurf_vorhanden: e.target.checked })} />Entwurf vorhanden</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEintragDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSaveEintrag} disabled={!form.betreff || !form.datum}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Postfach Dialog ── */}
      <Dialog open={showPostfachDialog} onOpenChange={setShowPostfachDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="w-4 h-4" />{editingPostfach ? "Postfach bearbeiten" : "Postfach anlegen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-medium">Bezeichnung <span className="text-destructive">*</span></Label>
              <Input placeholder="z.B. Persönlich Max, Rechnung, Info" value={postfachForm.bezeichnung}
                onChange={e => setPostfachForm(f => ({ ...f, bezeichnung: e.target.value }))} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium">E-Mail-Adresse <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder={emailDomain ? `rechnung@${emailDomain}` : "rechnung@meinefirma.de"}
                value={postfachForm.email_adresse}
                onChange={e => setPostfachForm(f => ({ ...f, email_adresse: e.target.value }))} className="mt-1 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Typ</Label>
                <Select value={postfachForm.typ} onValueChange={v => setPostfachForm(f => ({ ...f, typ: v }))}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="persoenlich" className="text-xs">Persönlich</SelectItem>
                    <SelectItem value="geteilt" className="text-xs">Geteilt / Gruppe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium">Anbieter</Label>
                <Select value={postfachForm.anbieter} onValueChange={v => setPostfachForm(f => ({ ...f, anbieter: v }))}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ANBIETER_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Benutzer mit Zugriff</Label>
              <div className="flex gap-2 mt-1">
                <Input type="email" placeholder="E-Mail des Benutzers" value={postfachUserInput}
                  onChange={e => setPostfachUserInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addPostfachUser()} className="text-sm" />
                <Button type="button" size="sm" variant="outline" onClick={addPostfachUser}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
              {postfachForm.user_emails?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {postfachForm.user_emails.map(e => (
                    <div key={e} className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1">
                      <span className="text-xs">{e}</span>
                      <button onClick={() => removePostfachUser(e)} className="text-muted-foreground hover:text-destructive ml-1">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs font-medium">Notiz</Label>
              <Input placeholder="Interne Notiz..." value={postfachForm.notiz || ""}
                onChange={e => setPostfachForm(f => ({ ...f, notiz: e.target.value }))} className="mt-1 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPostfachDialog(false)}>Abbrechen</Button>
            <Button onClick={handlePostfachSave}
              disabled={!postfachForm.bezeichnung || !postfachForm.email_adresse || createPostfachMut.isPending || updatePostfachMut.isPending}>
              {(createPostfachMut.isPending || updatePostfachMut.isPending) ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}