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
import { Users, UserPlus, Plus, Trash2, FolderOpen, Mail } from "lucide-react";

const ROLLEN = {
  admin: "Admin",
  geschaeftsfuehrung: "Geschäftsführung",
  kalkulation: "Kalkulation",
  bauleitung: "Bauleitung",
  buchhaltung: "Buchhaltung",
};
const ROLLEN_COLORS = {
  admin: "bg-red-100 text-red-700",
  geschaeftsfuehrung: "bg-purple-100 text-purple-700",
  kalkulation: "bg-blue-100 text-blue-700",
  bauleitung: "bg-orange-100 text-orange-700",
  buchhaltung: "bg-green-100 text-green-700",
};
const PROJEKT_ROLLEN = { bauleitung: "Bauleitung", kalkulation: "Kalkulation", buchhaltung: "Buchhaltung", nur_lesen: "Nur lesen" };

export default function Benutzerverwaltung() {
  const qc = useQueryClient();
  const [showZuordnungDialog, setShowZuordnungDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [zuordnungForm, setZuordnungForm] = useState({ project_id: "", rolle: "nur_lesen" });
  const [inviteForm, setInviteForm] = useState({ email: "", role: "kalkulation" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");

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

  const handleAddZuordnung = () => {
    if (!zuordnungForm.project_id || !selectedUser) return;
    createZuordnungMut.mutate({
      project_id: zuordnungForm.project_id,
      user_email: selectedUser.email,
      user_name: selectedUser.full_name,
      rolle: zuordnungForm.rolle,
    });
  };

  const handleInvite = async () => {
    if (!inviteForm.email) return;
    setInviteLoading(true);
    setInviteError("");
    try {
      await base44.users.inviteUser(inviteForm.email, inviteForm.role);
      setShowInviteDialog(false);
      setInviteForm({ email: "", role: "kalkulation" });
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      setInviteError(e?.message || "Einladung fehlgeschlagen.");
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" />Benutzerverwaltung
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Rollen, Aktivierung und Projektzuständigkeiten verwalten</p>
        </div>
        <Button onClick={() => { setInviteForm({ email: "", role: "kalkulation" }); setInviteError(""); setShowInviteDialog(true); }} className="shrink-0">
          <UserPlus className="w-4 h-4 mr-1.5" />Benutzer einladen
        </Button>
      </div>

      {/* Benutzerliste */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Benutzer</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Lade Benutzer...</div>
          ) : users.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Keine Benutzer gefunden</div>
          ) : (
            <div className="divide-y divide-border">
              {users.map(u => {
                const userZustaendigkeiten = zustaendigkeiten.filter(z => z.user_email === u.email);
                return (
                  <div key={u.id} className="px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Avatar + Name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary">
                            {u.full_name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{u.full_name || "–"}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>

                      {/* Rolle */}
                      <div className="flex items-center gap-2">
                        <Select
                          value={u.role || "kalkulation"}
                          onValueChange={v => updateUserMut.mutate({ id: u.id, data: { role: v } })}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLLEN).map(([k, v]) => (
                              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Aktiv/Inaktiv */}
                        <Button
                          size="sm"
                          variant={u.aktiv !== false ? "outline" : "secondary"}
                          className={`h-8 text-xs ${u.aktiv !== false ? "text-green-700 border-green-300" : "text-muted-foreground"}`}
                          onClick={() => updateUserMut.mutate({ id: u.id, data: { aktiv: !(u.aktiv !== false) } })}
                        >
                          {u.aktiv !== false ? "Aktiv" : "Inaktiv"}
                        </Button>

                        {/* Projektzuordnung */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs gap-1"
                          onClick={() => { setSelectedUser(u); setZuordnungForm({ project_id: "", rolle: "nur_lesen" }); setShowZuordnungDialog(true); }}
                        >
                          <Plus className="w-3 h-3" />Projekt
                        </Button>
                      </div>
                    </div>

                    {/* Projektzuständigkeiten */}
                    {userZustaendigkeiten.length > 0 && (
                      <div className="mt-3 ml-12 flex flex-wrap gap-2">
                        {userZustaendigkeiten.map(z => {
                          const p = projects.find(pr => pr.id === z.project_id);
                          return (
                            <div key={z.id} className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2.5 py-1">
                              <FolderOpen className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs">{p?.project_name || z.project_id}</span>
                              <Badge variant="outline" className="text-[9px] px-1">{PROJEKT_ROLLEN[z.rolle]}</Badge>
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Einlade-Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4" />Benutzer einladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">E-Mail-Adresse</Label>
              <Input
                type="email"
                placeholder="name@beispiel.de"
                value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Rolle</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLLEN).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Abbrechen</Button>
            <Button onClick={handleInvite} disabled={!inviteForm.email || inviteLoading}>
              {inviteLoading ? "Sende..." : "Einladen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zuordnungs-Dialog */}
      <Dialog open={showZuordnungDialog} onOpenChange={setShowZuordnungDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Projekt zuordnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Benutzer: <strong>{selectedUser?.full_name}</strong></p>
            <div>
              <Label className="text-xs">Projekt</Label>
              <Select value={zuordnungForm.project_id} onValueChange={v => setZuordnungForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Projekt wählen..." /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  <span className="block max-w-[260px] truncate">{p.project_name}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">({p.project_number})</span>
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
                  {Object.entries(PROJEKT_ROLLEN).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
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