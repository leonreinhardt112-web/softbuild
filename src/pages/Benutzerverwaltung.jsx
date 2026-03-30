import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, Trash2, FolderOpen, Pencil, Mail, CheckCircle2, XCircle, Inbox, Plus, Globe } from "lucide-react";

const ROLLEN = {
  admin: "Admin",
  geschaeftsfuehrung: "Geschäftsführung",
  kalkulation: "Kalkulation",
  bauleitung: "Bauleitung",
  buchhaltung: "Buchhaltung",
};

const ROLLEN_COLORS = {
  admin: "bg-red-100 text-red-700 border-red-200",
  geschaeftsfuehrung: "bg-purple-100 text-purple-700 border-purple-200",
  kalkulation: "bg-blue-100 text-blue-700 border-blue-200",
  bauleitung: "bg-orange-100 text-orange-700 border-orange-200",
  buchhaltung: "bg-green-100 text-green-700 border-green-200",
};

const PROJEKT_ROLLEN = {
  bauleitung: "Bauleitung",
  kalkulation: "Kalkulation",
  buchhaltung: "Buchhaltung",
  nur_lesen: "Nur lesen",
};

const ANBIETER_LABELS = {
  google_workspace: "Google Workspace",
  outlook_365: "Outlook / Microsoft 365",
  web_de: "web.de",
  sonstiges: "Sonstiges",
};

const DEFAULT_ANLEGEN = { vorname: "", nachname: "", email: "", role: "kalkulation" };
const DEFAULT_POSTFACH = { email_adresse: "", bezeichnung: "", typ: "persoenlich", anbieter: "google_workspace", user_emails: [], notiz: "" };

function normalizeToEmail(str) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9.]/g, "");
}

export default function Benutzerverwaltung() {
  const qc = useQueryClient();

  const [showAnlegenDialog, setShowAnlegenDialog] = useState(false);
  const [showBearbeitenDialog, setShowBearbeitenDialog] = useState(false);
  const [showZuordnungDialog, setShowZuordnungDialog] = useState(false);
  const [showPostfachDialog, setShowPostfachDialog] = useState(false);

  const [anlegenForm, setAnlegenForm] = useState(DEFAULT_ANLEGEN);
  const [anlegenLoading, setAnlegenLoading] = useState(false);
  const [anlegenError, setAnlegenError] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [bearbeitenForm, setBearbeitenForm] = useState({});
  const [zuordnungForm, setZuordnungForm] = useState({ project_id: "", rolle: "nur_lesen" });
  const [postfachForm, setPostfachForm] = useState(DEFAULT_POSTFACH);
  const [editingPostfach, setEditingPostfach] = useState(null);

  // Data
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list("full_name", 100),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-bv"],
    queryFn: () => base44.entities.Project.list("project_name", 100),
  });
  const { data: zustaendigkeiten = [] } = useQuery({
    queryKey: ["zustaendigkeiten"],
    queryFn: () => base44.entities.ProjektZustaendigkeit.list("-created_date", 500),
  });
  const { data: postfaecher = [] } = useQuery({
    queryKey: ["postfaecher"],
    queryFn: () => base44.entities.Postfach.list("bezeichnung", 200),
  });
  // Domain aus Unternehmens-Stammdaten
  const { data: companyData } = useQuery({
    queryKey: ["company-domain"],
    queryFn: async () => {
      const companies = await base44.entities.Stammdatum.filter({ typ: "unternehmen", aktiv: true }, undefined, 1);
      return companies?.[0] || null;
    },
  });
  const emailDomain = companyData?.email_domain || "";

  // Automatischer E-Mail-Vorschlag
  const emailVorschlag = (() => {
    if (!anlegenForm.vorname && !anlegenForm.nachname) return "";
    const v = normalizeToEmail(anlegenForm.vorname);
    const n = normalizeToEmail(anlegenForm.nachname);
    const local = [v, n].filter(Boolean).join(".");
    return emailDomain ? `${local}@${emailDomain}` : local;
  })();

  // Wenn Vorschlag sich ändert und E-Mail noch nicht manuell geändert wurde
  const [emailManuell, setEmailManuell] = useState(false);

  // Mutations
  const updateUserMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
  const createZuordnungMut = useMutation({
    mutationFn: (d) => base44.entities.ProjektZustaendigkeit.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["zustaendigkeiten"] }); setShowZuordnungDialog(false); },
  });
  const deleteZuordnungMut = useMutation({
    mutationFn: (id) => base44.entities.ProjektZustaendigkeit.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["zustaendigkeiten"] }),
  });
  const createPostfachMut = useMutation({
    mutationFn: (d) => base44.entities.Postfach.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["postfaecher"] }); setShowPostfachDialog(false); setPostfachForm(DEFAULT_POSTFACH); },
  });
  const updatePostfachMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Postfach.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["postfaecher"] }); setShowPostfachDialog(false); setEditingPostfach(null); },
  });
  const deletePostfachMut = useMutation({
    mutationFn: (id) => base44.entities.Postfach.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["postfaecher"] }),
  });

  const handleAnlegen = async () => {
    const emailToUse = emailManuell ? anlegenForm.email : (emailVorschlag || anlegenForm.email);
    if (!emailToUse || !anlegenForm.role) return;
    setAnlegenLoading(true);
    setAnlegenError("");
    try {
      await base44.users.inviteUser(emailToUse, anlegenForm.role);
      await new Promise(r => setTimeout(r, 1000));
      const allUsers = await base44.entities.User.list("full_name", 200);
      const neu = allUsers.find(u => u.email === emailToUse);
      if (neu) {
        await base44.entities.User.update(neu.id, {
          arbeits_email: emailToUse,
          vorname: anlegenForm.vorname,
          nachname: anlegenForm.nachname,
        });
      }
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowAnlegenDialog(false);
      setAnlegenForm(DEFAULT_ANLEGEN);
      setEmailManuell(false);
    } catch (e) {
      setAnlegenError(e?.message || "Anlegen fehlgeschlagen. Evtl. ist diese E-Mail bereits registriert.");
    } finally {
      setAnlegenLoading(false);
    }
  };

  const openBearbeiten = (u) => {
    setSelectedUser(u);
    setBearbeitenForm({
      role: u.role || "kalkulation",
      aktiv: u.aktiv !== false,
      arbeits_email: u.arbeits_email || u.email || "",
      vorname: u.vorname || "",
      nachname: u.nachname || "",
    });
    setShowBearbeitenDialog(true);
  };

  const handleBearbeitenSave = () => {
    updateUserMut.mutate({ id: selectedUser.id, data: bearbeitenForm }, {
      onSuccess: () => setShowBearbeitenDialog(false),
    });
  };

  const handleAddZuordnung = () => {
    if (!zuordnungForm.project_id || !selectedUser) return;
    createZuordnungMut.mutate({
      project_id: zuordnungForm.project_id,
      user_email: selectedUser.email,
      user_name: selectedUser.full_name,
      rolle: zuordnungForm.rolle,
    });
  };

  const openPostfachDialog = (pf = null) => {
    if (pf) {
      setEditingPostfach(pf);
      setPostfachForm({ ...pf, user_emails: pf.user_emails || [] });
    } else {
      setEditingPostfach(null);
      setPostfachForm(DEFAULT_POSTFACH);
    }
    setShowPostfachDialog(true);
  };

  const handlePostfachSave = () => {
    if (editingPostfach) {
      updatePostfachMut.mutate({ id: editingPostfach.id, data: postfachForm });
    } else {
      createPostfachMut.mutate(postfachForm);
    }
  };

  // Postfach: Benutzer-Chips
  const [postfachUserInput, setPostfachUserInput] = useState("");
  const addPostfachUser = () => {
    if (!postfachUserInput.trim()) return;
    setPostfachForm(f => ({ ...f, user_emails: [...(f.user_emails || []), postfachUserInput.trim()] }));
    setPostfachUserInput("");
  };
  const removePostfachUser = (email) => {
    setPostfachForm(f => ({ ...f, user_emails: f.user_emails.filter(e => e !== email) }));
  };

  const displayName = (u) => {
    if (u.vorname || u.nachname) return `${u.vorname || ""} ${u.nachname || ""}`.trim();
    return u.full_name || "–";
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" />Benutzerverwaltung
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mitarbeiter anlegen, Rollen vergeben, Postfächer und Projektzuständigkeiten verwalten
          </p>
        </div>
        <Button
          onClick={() => { setAnlegenForm(DEFAULT_ANLEGEN); setAnlegenError(""); setEmailManuell(false); setShowAnlegenDialog(true); }}
          className="shrink-0"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />Mitarbeiter anlegen
        </Button>
      </div>

      <Tabs defaultValue="mitarbeiter">
        <TabsList>
          <TabsTrigger value="mitarbeiter" className="gap-1.5"><Users className="w-3.5 h-3.5" />Mitarbeiter ({users.length})</TabsTrigger>
          <TabsTrigger value="postfaecher" className="gap-1.5"><Inbox className="w-3.5 h-3.5" />Postfächer ({postfaecher.length})</TabsTrigger>
        </TabsList>

        {/* ── Tab: Mitarbeiter ── */}
        <TabsContent value="mitarbeiter" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Lade Benutzer...</div>
              ) : users.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">Noch keine Benutzer vorhanden</div>
              ) : (
                <div className="divide-y divide-border">
                  {users.map(u => {
                    const userZustaendigkeiten = zustaendigkeiten.filter(z => z.user_email === u.email);
                    const isAktiv = u.aktiv !== false;
                    const initials = (u.vorname?.charAt(0) || u.full_name?.charAt(0) || "?").toUpperCase();
                    return (
                      <div key={u.id} className="px-6 py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isAktiv ? "bg-primary/10" : "bg-muted"}`}>
                              <span className={`text-sm font-bold ${isAktiv ? "text-primary" : "text-muted-foreground"}`}>
                                {initials}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-semibold text-sm ${!isAktiv ? "text-muted-foreground" : ""}`}>
                                  {displayName(u)}
                                </p>
                                {u.role && (
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${ROLLEN_COLORS[u.role] || "bg-muted text-muted-foreground"}`}>
                                    {ROLLEN[u.role] || u.role}
                                  </span>
                                )}
                                {!isAktiv && (
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                                    Inaktiv
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Mail className="w-3 h-3" />
                                {u.arbeits_email || u.email}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1"
                              onClick={() => { setSelectedUser(u); setZuordnungForm({ project_id: "", rolle: "nur_lesen" }); setShowZuordnungDialog(true); }}>
                              <FolderOpen className="w-3.5 h-3.5" />Projekt
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => openBearbeiten(u)}>
                              <Pencil className="w-3.5 h-3.5" />Bearbeiten
                            </Button>
                          </div>
                        </div>

                        {userZustaendigkeiten.length > 0 && (
                          <div className="mt-3 pl-[52px] flex flex-wrap gap-2">
                            {userZustaendigkeiten.map(z => {
                              const p = projects.find(pr => pr.id === z.project_id);
                              return (
                                <div key={z.id} className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2.5 py-1">
                                  <FolderOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <span className="text-xs truncate max-w-[160px]">{p?.project_name || z.project_id}</span>
                                  <Badge variant="outline" className="text-[9px] px-1 shrink-0">{PROJEKT_ROLLEN[z.rolle]}</Badge>
                                  <button className="ml-1 text-muted-foreground hover:text-destructive transition-colors" onClick={() => deleteZuordnungMut.mutate(z.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Postfächer ── */}
        <TabsContent value="postfaecher" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Persönliche und geteilte E-Mail-Postfächer verwalten
              </p>
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

          {/* Persönliche Postfächer */}
          {["persoenlich", "geteilt"].map(typ => {
            const gefiltert = postfaecher.filter(p => p.typ === typ);
            return (
              <Card key={typ}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Inbox className="w-4 h-4" />
                    {typ === "persoenlich" ? "Persönliche Postfächer" : "Geteilte Postfächer"}
                    <span className="text-muted-foreground font-normal">({gefiltert.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {gefiltert.length === 0 ? (
                    <div className="px-6 pb-6 text-sm text-muted-foreground">Noch keine {typ === "persoenlich" ? "persönlichen" : "geteilten"} Postfächer angelegt.</div>
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

      {/* ── Mitarbeiter anlegen Dialog ── */}
      <Dialog open={showAnlegenDialog} onOpenChange={setShowAnlegenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />Neuen Mitarbeiter anlegen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Vorname <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Max"
                  value={anlegenForm.vorname}
                  onChange={e => {
                    setAnlegenForm(f => ({ ...f, vorname: e.target.value }));
                    setEmailManuell(false);
                  }}
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Nachname <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Mustermann"
                  value={anlegenForm.nachname}
                  onChange={e => {
                    setAnlegenForm(f => ({ ...f, nachname: e.target.value }));
                    setEmailManuell(false);
                  }}
                  className="mt-1 text-sm"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Arbeits-E-Mail <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder={emailDomain ? `vorname.nachname@${emailDomain}` : "max.mustermann@meinefirma.de"}
                value={emailManuell ? anlegenForm.email : emailVorschlag}
                onChange={e => {
                  setEmailManuell(true);
                  setAnlegenForm(f => ({ ...f, email: e.target.value }));
                }}
                className="mt-1 text-sm"
              />
              {!emailManuell && emailVorschlag && (
                <p className="text-[10px] text-primary mt-1">✓ Automatisch aus Name + Domain generiert</p>
              )}
              {!emailDomain && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Tipp: Domain in den Stammdaten → Unternehmens-Einstellungen hinterlegen für automatischen Vorschlag.
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                Der Mitarbeiter erhält eine Einladung an diese Adresse und setzt dort sein Passwort.
              </p>
            </div>

            <div>
              <Label className="text-xs font-medium">Fachliche Rolle <span className="text-destructive">*</span></Label>
              <Select value={anlegenForm.role} onValueChange={v => setAnlegenForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLLEN).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {anlegenError && (
              <div className="flex items-start gap-2 bg-destructive/10 text-destructive text-xs p-3 rounded-lg">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {anlegenError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnlegenDialog(false)}>Abbrechen</Button>
            <Button
              onClick={handleAnlegen}
              disabled={(!anlegenForm.vorname && !anlegenForm.nachname) || !(emailManuell ? anlegenForm.email : emailVorschlag) || !anlegenForm.role || anlegenLoading}
            >
              {anlegenLoading ? "Anlegen..." : "Mitarbeiter anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bearbeiten Dialog ── */}
      <Dialog open={showBearbeitenDialog} onOpenChange={setShowBearbeitenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />Mitarbeiter bearbeiten
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-1">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{(bearbeitenForm.vorname?.charAt(0) || selectedUser.full_name?.charAt(0) || "?").toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-semibold text-sm">{displayName(selectedUser)}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Vorname</Label>
                  <Input
                    value={bearbeitenForm.vorname || ""}
                    onChange={e => setBearbeitenForm(f => ({ ...f, vorname: e.target.value }))}
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Nachname</Label>
                  <Input
                    value={bearbeitenForm.nachname || ""}
                    onChange={e => setBearbeitenForm(f => ({ ...f, nachname: e.target.value }))}
                    className="mt-1 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">Arbeits-E-Mail</Label>
                <Input
                  type="email"
                  value={bearbeitenForm.arbeits_email || ""}
                  onChange={e => setBearbeitenForm(f => ({ ...f, arbeits_email: e.target.value }))}
                  className="mt-1 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Fachliche Rolle</Label>
                <Select value={bearbeitenForm.role} onValueChange={v => setBearbeitenForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLLEN).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">Status</Label>
                <div className="flex gap-2 mt-1">
                  <Button type="button" size="sm" variant={bearbeitenForm.aktiv ? "default" : "outline"} className="flex-1 gap-1.5 text-xs h-9"
                    onClick={() => setBearbeitenForm(f => ({ ...f, aktiv: true }))}>
                    <CheckCircle2 className="w-3.5 h-3.5" />Aktiv
                  </Button>
                  <Button type="button" size="sm" variant={!bearbeitenForm.aktiv ? "destructive" : "outline"} className="flex-1 gap-1.5 text-xs h-9"
                    onClick={() => setBearbeitenForm(f => ({ ...f, aktiv: false }))}>
                    <XCircle className="w-3.5 h-3.5" />Inaktiv
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBearbeitenDialog(false)}>Abbrechen</Button>
            <Button onClick={handleBearbeitenSave} disabled={updateUserMut.isPending}>
              {updateUserMut.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Projektzuordnung Dialog ── */}
      <Dialog open={showZuordnungDialog} onOpenChange={setShowZuordnungDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Projekt zuordnen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Benutzer: <strong>{selectedUser ? displayName(selectedUser) : ""}</strong></p>
            <div>
              <Label className="text-xs">Projekt</Label>
              <Select value={zuordnungForm.project_id} onValueChange={v => setZuordnungForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Projekt wählen..." /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      <span className="truncate max-w-[240px] block">{p.project_name} ({p.project_number})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Zuständigkeit</Label>
              <Select value={zuordnungForm.rolle} onValueChange={v => setZuordnungForm(f => ({ ...f, rolle: v }))}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJEKT_ROLLEN).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowZuordnungDialog(false)}>Abbrechen</Button>
            <Button onClick={handleAddZuordnung} disabled={!zuordnungForm.project_id}>Zuordnen</Button>
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
              <Input
                placeholder="z.B. Persönlich Max, Rechnung, Info"
                value={postfachForm.bezeichnung}
                onChange={e => setPostfachForm(f => ({ ...f, bezeichnung: e.target.value }))}
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">E-Mail-Adresse <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder={emailDomain ? `rechnung@${emailDomain}` : "rechnung@meinefirma.de"}
                value={postfachForm.email_adresse}
                onChange={e => setPostfachForm(f => ({ ...f, email_adresse: e.target.value }))}
                className="mt-1 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Typ</Label>
                <Select value={postfachForm.typ} onValueChange={v => setPostfachForm(f => ({ ...f, typ: v }))}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="persoenlich" className="text-xs">Persönlich</SelectItem>
                    <SelectItem value="geteilt" className="text-xs">Geteilt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium">Anbieter</Label>
                <Select value={postfachForm.anbieter} onValueChange={v => setPostfachForm(f => ({ ...f, anbieter: v }))}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ANBIETER_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Benutzer mit Zugriff</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="email"
                  placeholder="E-Mail des Benutzers"
                  value={postfachUserInput}
                  onChange={e => setPostfachUserInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addPostfachUser()}
                  className="text-sm"
                />
                <Button type="button" size="sm" variant="outline" onClick={addPostfachUser}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
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
              <Input
                placeholder="Interne Notiz..."
                value={postfachForm.notiz || ""}
                onChange={e => setPostfachForm(f => ({ ...f, notiz: e.target.value }))}
                className="mt-1 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPostfachDialog(false)}>Abbrechen</Button>
            <Button
              onClick={handlePostfachSave}
              disabled={!postfachForm.bezeichnung || !postfachForm.email_adresse || createPostfachMut.isPending || updatePostfachMut.isPending}
            >
              {(createPostfachMut.isPending || updatePostfachMut.isPending) ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}