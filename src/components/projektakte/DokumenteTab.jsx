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
import { Plus, Upload, Star, FileText, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";

const KAT_LABELS = {
  vertragsunterlagen: "Vertragsunterlagen", angebotsunterlagen: "Angebotsunterlagen",
  lv_unterlagen: "LV-Unterlagen", plaene: "Pläne", schriftverkehr: "Schriftverkehr",
  protokolle: "Protokolle", rechnungen: "Rechnungen", eingangsrechnungen: "Eingangsrechnungen",
  aufmass: "Aufmaß", nachtraege: "Nachträge", fotos: "Fotos", sonstiges: "Sonstiges",
};

const EMPTY = { titel: "", kategorie: "sonstiges", dateiname: "", versionsstand: "", dokumentdatum: "", bemerkung: "", wichtig: false };

export default function DokumenteTab({ projectId, dokumente }) {
  const qc = useQueryClient();
  const [filterKat, setFilterKat] = useState("alle");
  const [nurWichtig, setNurWichtig] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editDok, setEditDok] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.ProjektDokument.create({ ...d, project_id: projectId }),
    onSuccess: () => { qc.invalidateQueries(["dokumente", projectId]); setShowDialog(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProjektDokument.update(id, data),
    onSuccess: () => qc.invalidateQueries(["dokumente", projectId]),
  });

  const handleOpen = (dok = null) => {
    setEditDok(dok); setForm(dok ? { ...dok } : { ...EMPTY }); setFile(null); setShowDialog(true);
  };

  const handleSave = async () => {
    let datei = form.datei;
    let dateiname = form.dateiname;
    if (file) {
      setUploading(true);
      const res = await base44.integrations.Core.UploadFile({ file });
      datei = res.file_url;
      dateiname = file.name;
      setUploading(false);
    }
    const data = { ...form, datei, dateiname };
    if (editDok) updateMut.mutate({ id: editDok.id, data });
    else createMut.mutate(data);
    setShowDialog(false);
  };

  const filtered = dokumente.filter(d => {
    const katOk = filterKat === "alle" || d.kategorie === filterKat;
    const wOk = !nurWichtig || d.wichtig;
    return katOk && wOk;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={filterKat} onValueChange={setFilterKat}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Kategorien</SelectItem>
              {Object.entries(KAT_LABELS).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant={nurWichtig?"default":"outline"} size="sm" className="h-8 text-xs gap-1"
            onClick={()=>setNurWichtig(!nurWichtig)}>
            <Star className="w-3 h-3" />Nur wichtige
          </Button>
        </div>
        <Button size="sm" className="gap-1.5" onClick={()=>handleOpen()}>
          <Plus className="w-3.5 h-3.5" />Dokument hinzufügen
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Keine Dokumente gefunden</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
            <Card key={d.id} className="hover:shadow-sm transition-all">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{d.titel}</span>
                        {d.wichtig && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        <Badge variant="outline" className="text-xs">{KAT_LABELS[d.kategorie]||d.kategorie}</Badge>
                        {d.versionsstand && <Badge variant="secondary" className="text-xs">{d.versionsstand}</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                        {d.dokumentdatum && <span>{format(parseISO(d.dokumentdatum),"dd.MM.yyyy")}</span>}
                        {d.dateiname && <span>{d.dateiname}</span>}
                        {d.bemerkung && <span className="truncate max-w-xs">{d.bemerkung}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {d.datei && (
                      <a href={d.datei} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <ExternalLink className="w-3 h-3" />Öffnen
                        </Button>
                      </a>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>handleOpen(d)}>Bearbeiten</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editDok?"Dokument bearbeiten":"Neues Dokument"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Titel *</Label><Input value={form.titel} onChange={e=>setForm({...form,titel:e.target.value})} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Kategorie</Label>
                <Select value={form.kategorie} onValueChange={v=>setForm({...form,kategorie:v})}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(KAT_LABELS).map(([k,v])=><SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Datum</Label><Input type="date" value={form.dokumentdatum||""} onChange={e=>setForm({...form,dokumentdatum:e.target.value})} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Versionsstand</Label><Input value={form.versionsstand||""} onChange={e=>setForm({...form,versionsstand:e.target.value})} placeholder="z.B. V1.0" className="mt-1" /></div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!form.wichtig} onChange={e=>setForm({...form,wichtig:e.target.checked})} />
                  Als wichtig markieren
                </label>
              </div>
            </div>
            <div>
              <Label className="text-xs">Datei hochladen</Label>
              <div className="mt-1 flex items-center gap-2">
                <input type="file" onChange={e=>setFile(e.target.files[0])} className="text-xs" />
              </div>
              {form.datei && !file && (
                <p className="text-xs text-muted-foreground mt-1">Vorhanden: <a href={form.datei} target="_blank" rel="noopener noreferrer" className="text-primary underline">{form.dateiname||"Datei"}</a></p>
              )}
            </div>
            <div><Label className="text-xs">Bemerkung</Label><Textarea value={form.bemerkung||""} onChange={e=>setForm({...form,bemerkung:e.target.value})} className="mt-1 h-16" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={!form.titel||uploading}>{uploading?"Hochladen...":"Speichern"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}