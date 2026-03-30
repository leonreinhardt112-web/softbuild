import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, Trash2, FolderOpen, Pencil, Mail, Phone, CheckCircle2, XCircle } from "lucide-react";

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

const DEFAULT_ANLEGEN = { email: "", role: "kalkulation", arbeits_email: "", telefon: "" };

export default function Benutzerverwaltung() {
  const qc = useQueryClient();

  // Dialogs
  const [showAnlegenDialog, setShowAnlegenDialog] = useState(false);
  const [showBearbeitenDialog, setShowBearbeitenDialog] = useState(false);
  const [showZuordnungDialog, setShowZuordnungDialog] = useState(false);

  // Forms
  const [anlegenForm, setAnlegenForm] = useState(DEFAULT_ANLEGEN);
  const [anlegenLoading, setAnlegenLoading] = useState(false);
  const [anlegenError, setAnlegenError] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [bearbeitenForm, setBearbeitenForm] = useState({});
  const [zuordnungForm, setZuordnungForm] = useState({ project_id: "", rolle: "nur_lesen" });

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

  // Mutations
  const updateUserMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const createZuordnungMut = useMutation({
    mutationFn: (d) => base44.entities.ProjektZustaendigkeit.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zustaendigkeiten"] });
      setShowZuordnungDialog(false);
    },
  });

  const deleteZuordnungMut = useMutation({
    mutationFn: (id) => base44.entities.ProjektZustaendigkeit.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["zustaendigkeiten"] }),
  });

  // Neuen Mitarbeiter anlegen via Einladung
  const handleAnlegen = async () => {
    if (!anlegenForm.email || !anlegenForm.role) return;
    setAnlegenLoading(true);
    setAnlegenError("");
    try {
      await base44.users.inviteUser(anlegenForm.email, anlegenForm.role);
      // Nach Einladung kurz warten, dann User suchen und Profildaten ergänzen
      await new Promise(r => setTimeout(r, 1000));
      const allUsers = await base44.entities.User.list("full_name", 200);
      const neu = allUsers.find(u => u.email === anlegenForm.email);
      if (neu && (anlegenForm.arbeits_email || anlegenForm.telefon)) {
        await base44.entities.User.update(neu.id, {
          arbeits_email: anlegenForm.arbeits_email || anlegenForm.email,
          telefon: anlegenForm.telefon,
        });
      }
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowAnlegenDialog(false);
      setAnlegenForm(DEFAULT_ANLEGEN);
    } catch (e) {
      setAnlegenError(e?.message || "Anlegen fehlgeschlagen. Evtl. ist diese E-Mail bereits registriert.");
    } finally {
      setAnlegenLoading(false);
    }
  };

  // Bearbeiten-Dialog öffnen
  const openBearbeiten = (u) => {
    setSelectedUser(u);
    setBearbeitenForm({
      role: u.role || "kalkulation",
      aktiv: u.aktiv !== false,
      arbeits_email: u.arbeits_email || u.email || "",
      telefon: u.telefon || "",
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

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" />Benutzerverwaltung
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mitarbeiter anlegen, Rollen vergeben und Projektzuständigkeiten verwalten
          </p>
        </div>
        <Button
          onClick={() => { setAnlegenForm(DEFAULT_ANLEGEN); setAnlegenError(""); setShowAnlegenDialog(true); }}
          className="shrink-0"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />Mitarbeiter anlegen
        </Button>
      </div>

      {/* Benutzerliste */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" />
            Mitarbeiter ({users.length})
          </CardTitle>
        </CardHeader>
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
                return (
                  <div key={u.id} className="px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Avatar + Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isAktiv ? "bg-primary/10" : "bg-muted"}`}>
                          <span className={`text-sm font-bold ${isAktiv ? "text-primary" : "text-muted-foreground"}`}>
                            {u.full_name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-semibold text-sm ${!isAktiv ? "text-muted-foreground" : ""}`}>
                              {u.full_name || "–"}
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
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {u.arbeits_email || u.email}
                            </span>
                            {u.telefon && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />{u.telefon}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm" variant="ghost"
                          className="h-8 text-xs gap-1"
                          onClick={() => { setSelectedUser(u); setZuordnungForm({ project_id: "", rolle: "nur_lesen" }); setShowZuordnungDialog(true); }}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />Projekt
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-8 text-xs gap-1"
                          onClick={() => openBearbeiten(u)}
                        >
                          <Pencil className="w-3.5 h-3.5" />Bearbeiten
                        </Button>
                      </div>
                    </div>

                    {/* Projektzuständigkeiten */}
                    {userZustaendigkeiten.length > 0 && (
                      <div className="mt-3 ml-13 flex flex-wrap gap-2 pl-13">
                        <div className="w-full pl-[52px] flex flex-wrap gap-2">
                          {userZustaendigkeiten.map(z => {
                            const p = projects.find(pr => pr.id === z.project_id);
                            return (
                              <div key={z.id} className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2.5 py-1">
                                <FolderOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="text-xs truncate max-w-[160px]">{p?.project_name || z.project_id}</span>
                                <Badge variant="outline" className="text-[9px] px-1 shrink-0">{PROJEKT_ROLLEN[z.rolle]}</Badge>
                                <button
                                  className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={() => deleteZuordnungMut.mutate(z.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
              <div className="col-span-2">
                <Label className="text-xs font-medium">Login-E-Mail <span className="text-destructive">*</span></Label>
                <Input
                  type="email"
                  placeholder="vorname.nachname@firma.de"
                  value={anlegenForm.email}
                  onChange={e => setAnlegenForm(f => ({ ...f, email: e.target.value }))}
                  className="mt-1 text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Diese E-Mail wird zum Login verwendet. Der Mitarbeiter erhält eine Einladungs-E-Mail.</p>
              </div>

              <div className="col-span-2">
                <Label className="text-xs font-medium">Arbeits-E-Mail</Label>
                <Input
                  type="email"
                  placeholder="wie Login-E-Mail, oder abweichend"
                  value={anlegenForm.arbeits_email}
                  onChange={e => setAnlegenForm(f => ({ ...f, arbeits_email: e.target.value }))}
                  className="mt-1 text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Wird im Schriftverkehr als Absender verwendet. Leer lassen = Login-E-Mail wird übernommen.</p>
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

              <div>
                <Label className="text-xs font-medium">Telefon</Label>
                <Input
                  placeholder="+49 ..."
                  value={anlegenForm.telefon}
                  onChange={e => setAnlegenForm(f => ({ ...f, telefon: e.target.value }))}
                  className="mt-1 text-sm"
                />
              </div>
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
            <Button onClick={handleAnlegen} disabled={!anlegenForm.email || !anlegenForm.role || anlegenLoading}>
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
                  <span className="text-sm font-bold text-primary">{selectedUser.full_name?.charAt(0)?.toUpperCase() || "?"}</span>
                </div>
                <div>
                  <p className="font-semibold text-sm">{selectedUser.full_name || "–"}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs font-medium">Arbeits-E-Mail</Label>
                  <Input
                    type="email"
                    value={bearbeitenForm.arbeits_email || ""}
                    onChange={e => setBearbeitenForm(f => ({ ...f, arbeits_email: e.target.value }))}
                    className="mt-1 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Absender im Schriftverkehr</p>
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
                  <Label className="text-xs font-medium">Telefon</Label>
                  <Input
                    placeholder="+49 ..."
                    value={bearbeitenForm.telefon || ""}
                    onChange={e => setBearbeitenForm(f => ({ ...f, telefon: e.target.value }))}
                    className="mt-1 text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-xs font-medium">Status</Label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      type="button" size="sm"
                      variant={bearbeitenForm.aktiv ? "default" : "outline"}
                      className="flex-1 gap-1.5 text-xs h-9"
                      onClick={() => setBearbeitenForm(f => ({ ...f, aktiv: true }))}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />Aktiv
                    </Button>
                    <Button
                      type="button" size="sm"
                      variant={!bearbeitenForm.aktiv ? "destructive" : "outline"}
                      className="flex-1 gap-1.5 text-xs h-9"
                      onClick={() => setBearbeitenForm(f => ({ ...f, aktiv: false }))}
                    >
                      <XCircle className="w-3.5 h-3.5" />Inaktiv
                    </Button>
                  </div>
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
          <DialogHeader>
            <DialogTitle>Projekt zuordnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Benutzer: <strong>{selectedUser?.full_name}</strong>
            </p>
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
    </div>
  );
}