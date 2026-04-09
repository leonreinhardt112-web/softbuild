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
import {
  Plus, Upload, Star, FileText, ExternalLink, FolderOpen,
  ChevronRight, ChevronDown, Sparkles, Loader2, X, CheckCircle2
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { parseX83, detectTradesFromPositions, isGaebFile, isUnterlagFile } from "@/utils/gaebParser";

const KAT_LABELS = {
  vertragsunterlagen: "Vertragsunterlagen",
  angebotsunterlagen: "Angebotsunterlagen",
  lv_unterlagen: "LV-Unterlagen",
  plaene: "Pläne",
  schriftverkehr: "Schriftverkehr",
  protokolle: "Protokolle",
  rechnungen: "Rechnungen",
  eingangsrechnungen: "Eingangsrechnungen",
  aufmass: "Aufmaß",
  nachtraege: "Nachträge",
  fotos: "Fotos",
  sonstiges: "Sonstiges",
};

const KAT_ICONS = {
  vertragsunterlagen: "📋",
  angebotsunterlagen: "📄",
  lv_unterlagen: "📑",
  plaene: "📐",
  schriftverkehr: "✉️",
  protokolle: "📝",
  rechnungen: "🧾",
  eingangsrechnungen: "📥",
  aufmass: "📏",
  nachtraege: "➕",
  fotos: "📷",
  sonstiges: "📁",
};

const EMPTY = {
  titel: "", kategorie: "angebotsunterlagen", dateiname: "",
  versionsstand: "", dokumentdatum: "", bemerkung: "", wichtig: false
};

async function detectCategory(filename) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Du bist ein Assistent für Bauunternehmen. Klassifiziere dieses Dokument in eine der folgenden Kategorien basierend auf dem Dateinamen.

Dateiname: "${filename}"

Kategorien:
- vertragsunterlagen: Verträge, VOB, AGBs, Auftragsschreiben
- angebotsunterlagen: Ausschreibungsunterlagen, Bieterbedingungen, Bewerbungsunterlagen, Baubeschreibung
- lv_unterlagen: Leistungsverzeichnisse, GAEB-Dateien, LV-Positionen
- plaene: Baupläne, Lageplan, Schnitte, Grundrisse, DWG, PDF-Pläne
- schriftverkehr: Briefe, E-Mails, Fax
- protokolle: Baubesprechungsprotokolle, Abnahmeprotokolle
- rechnungen: Ausgangsrechnungen, Abschlagsrechnungen
- eingangsrechnungen: Eingangsrechnungen von Lieferanten/NU
- aufmass: Aufmaßblätter, Mengenermittlungen
- nachtraege: Nachtragsangebote, Nachtragsvereinbarungen
- fotos: Baustellenfotos, Bilder
- sonstiges: Alles andere

Antworte NUR mit dem Kategorie-Schlüssel (z.B. "lv_unterlagen"), nichts weiter.`,
    response_json_schema: {
      type: "object",
      properties: { kategorie: { type: "string" } }
    }
  });
  return result?.kategorie || "sonstiges";
}

export default function DokumenteTab({ projectId, dokumente, project, onProjectUpdate }) {
  const qc = useQueryClient();
  const [openFolders, setOpenFolders] = useState(new Set(["angebotsunterlagen", "lv_unterlagen"]));
  const [showDialog, setShowDialog] = useState(false);
  const [editDok, setEditDok] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [aiDetecting, setAiDetecting] = useState(false);
  const [file, setFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.ProjektDokument.create({ ...d, project_id: projectId }),
    onSuccess: () => { qc.invalidateQueries(["dokumente", projectId]); setShowDialog(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProjektDokument.update(id, data),
    onSuccess: () => qc.invalidateQueries(["dokumente", projectId]),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ProjektDokument.delete(id),
    onSuccess: () => qc.invalidateQueries(["dokumente", projectId]),
  });

  const toggleFolder = (kat) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(kat)) next.delete(kat);
      else next.add(kat);
      return next;
    });
  };

  const handleOpen = (dok = null) => {
    setEditDok(dok);
    setForm(dok ? { ...dok } : { ...EMPTY });
    setFile(null);
    setShowDialog(true);
  };

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    if (!selectedFile) return;
    setAiDetecting(true);
    const kat = await detectCategory(selectedFile.name);
    setForm(prev => ({
      ...prev,
      titel: selectedFile.name.replace(/\.[^/.]+$/, ""),
      kategorie: kat,
      dateiname: selectedFile.name,
    }));
    setAiDetecting(false);
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

  /**
   * Handles a single file: upload to storage, save ProjektDokument,
   * and if GAEB → also parse & save to project.lv_positions.
   * If Baubeschreibung/PDF → also add to project.projekt_unterlagen.
   */
  const processFile = async (f) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
    const kat = isGaebFile(f.name) ? "lv_unterlagen" : await detectCategory(f.name);

    await base44.entities.ProjektDokument.create({
      project_id: projectId,
      titel: f.name.replace(/\.[^/.]+$/, ""),
      kategorie: kat,
      datei: file_url,
      dateiname: f.name,
      dokumentdatum: new Date().toISOString().split("T")[0],
    });

    if (isGaebFile(f.name) && onProjectUpdate) {
      // Parse GAEB and save to project
      const text = await f.text();
      const positions = parseX83(text);
      if (positions.length > 0) {
        const detectedTrades = detectTradesFromPositions(positions);
        const currentTrades = project?.selected_trades || ["allgemein"];
        const mergedTrades = [...new Set([...currentTrades, ...detectedTrades])];
        await onProjectUpdate({
          lv_file_url: file_url,
          lv_file_name: f.name,
          lv_positions: positions,
          lv_analysis_findings: [],
          baulv_conflict_findings: [],
          selected_trades: mergedTrades,
        });
      }
    } else if (isUnterlagFile(f.name) && onProjectUpdate) {
      // Also add to projekt_unterlagen for KI conflict analysis
      const existing = project?.projekt_unterlagen || [];
      // Avoid duplicates
      if (!existing.some(u => u.name === f.name)) {
        await onProjectUpdate({
          projekt_unterlagen: [...existing, { name: f.name, url: file_url }],
        });
      }
    }
  };

  const handleBulkUpload = async (files) => {
    if (!files.length) return;
    setBulkUploading(true);
    const fileArr = Array.from(files);
    setBulkProgress({ current: 0, total: fileArr.length, currentName: "" });

    for (let i = 0; i < fileArr.length; i++) {
      const f = fileArr[i];
      setBulkProgress({ current: i + 1, total: fileArr.length, currentName: f.name });
      await processFile(f);
    }

    qc.invalidateQueries(["dokumente", projectId]);
    qc.invalidateQueries(["project", projectId]);
    setBulkUploading(false);
    setBulkProgress(null);
    setOpenFolders(prev => new Set([...prev, ...Object.keys(KAT_LABELS)]));
  };

  // Group by category
  const grouped = {};
  for (const d of dokumente) {
    const kat = d.kategorie || "sonstiges";
    if (!grouped[kat]) grouped[kat] = [];
    grouped[kat].push(d);
  }

  const sortedKats = Object.keys(KAT_LABELS).filter(k => grouped[k]?.length > 0);
  const totalCount = dokumente.length;

  const hasLV = project?.lv_positions?.length > 0;

  return (
    <div className="space-y-4">
      {/* Info-Banner wenn GAEB vorhanden */}
      {hasLV && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>
            <strong>{project.lv_file_name}</strong> ist als GAEB geladen — {project.lv_positions.length} Positionen. Der Kalkulations-Tab greift auf diese Datei zu.
          </span>
        </div>
      )}

      {/* Header actions */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{totalCount} Dokument{totalCount !== 1 ? "e" : ""}</span>
          {!hasLV && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Noch keine GAEB-Datei — beim Upload automatisch erkannt
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <span>
                <Upload className="w-3.5 h-3.5" />
                Mehrere hochladen
              </span>
            </Button>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={e => handleBulkUpload(e.target.files)}
            />
          </label>
          <Button size="sm" className="gap-1.5" onClick={() => handleOpen()}>
            <Plus className="w-3.5 h-3.5" />Dokument
          </Button>
        </div>
      </div>

      {/* Bulk upload progress */}
      {bulkUploading && bulkProgress && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium">KI kategorisiert & verarbeitet...</span>
                <span className="text-muted-foreground">{bulkProgress.current}/{bulkProgress.total}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">{bulkProgress.currentName}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {totalCount === 0 && !bulkUploading && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Noch keine Dokumente</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Lade alle Unterlagen hoch — GAEB, Baubeschreibung, Pläne etc.<br />
              GAEB-Dateien werden automatisch geparst und für die Kalkulation bereitgestellt.
            </p>
            <label className="cursor-pointer">
              <Button variant="outline" className="gap-2" asChild>
                <span><Sparkles className="w-4 h-4 text-violet-500" />Unterlagen hochladen (KI-Kategorisierung)</span>
              </Button>
              <input type="file" multiple className="hidden" onChange={e => handleBulkUpload(e.target.files)} />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Folder tree */}
      {sortedKats.length > 0 && (
        <div className="space-y-1.5">
          {sortedKats.map(kat => {
            const items = grouped[kat] || [];
            const isOpen = openFolders.has(kat);
            return (
              <div key={kat} className="rounded-xl border border-border overflow-hidden">
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                  onClick={() => toggleFolder(kat)}
                >
                  {isOpen
                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  }
                  <span className="text-base">{KAT_ICONS[kat]}</span>
                  <span className="font-medium text-sm">{KAT_LABELS[kat]}</span>
                  {kat === "lv_unterlagen" && hasLV && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">GAEB aktiv</Badge>
                  )}
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">{items.length}</Badge>
                </button>

                {isOpen && (
                  <div className="divide-y divide-border">
                    {items.map(d => (
                      <div key={d.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-accent/30 transition-colors">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium truncate">{d.titel}</span>
                              {d.wichtig && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                              {d.versionsstand && <Badge variant="secondary" className="text-[10px]">{d.versionsstand}</Badge>}
                            </div>
                            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-0.5">
                              {d.dokumentdatum && <span>{format(parseISO(d.dokumentdatum), "dd.MM.yyyy")}</span>}
                              {d.dateiname && <span className="truncate max-w-[200px]">{d.dateiname}</span>}
                              {d.bemerkung && <span className="truncate max-w-[250px] italic">{d.bemerkung}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {d.datei && (
                            <a href={d.datei} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                <ExternalLink className="w-3 h-3" />Öffnen
                              </Button>
                            </a>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleOpen(d)}>
                            Bearbeiten
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editDok ? "Dokument bearbeiten" : "Neues Dokument"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Datei hochladen</Label>
              <div className="mt-1">
                <input
                  type="file"
                  onChange={e => handleFileSelect(e.target.files[0])}
                  className="text-xs w-full"
                />
              </div>
              {form.datei && !file && (
                <p className="text-xs text-muted-foreground mt-1">
                  Vorhanden: <a href={form.datei} target="_blank" rel="noopener noreferrer" className="text-primary underline">{form.dateiname || "Datei"}</a>
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs">Titel *</Label>
              <Input value={form.titel} onChange={e => setForm({ ...form, titel: e.target.value })} className="mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1.5">
                  Kategorie
                  {aiDetecting && <span className="flex items-center gap-1 text-violet-600"><Loader2 className="w-2.5 h-2.5 animate-spin" />KI erkennt...</span>}
                </Label>
                <Select value={form.kategorie} onValueChange={v => setForm({ ...form, kategorie: v })}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(KAT_LABELS).map(([k, v]) =>
                      <SelectItem key={k} value={k} className="text-xs">{KAT_ICONS[k]} {v}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Datum</Label>
                <Input type="date" value={form.dokumentdatum || ""} onChange={e => setForm({ ...form, dokumentdatum: e.target.value })} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Versionsstand</Label>
                <Input value={form.versionsstand || ""} onChange={e => setForm({ ...form, versionsstand: e.target.value })} placeholder="z.B. V1.0" className="mt-1" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!form.wichtig} onChange={e => setForm({ ...form, wichtig: e.target.checked })} />
                  Als wichtig markieren
                </label>
              </div>
            </div>

            <div>
              <Label className="text-xs">Bemerkung</Label>
              <Textarea value={form.bemerkung || ""} onChange={e => setForm({ ...form, bemerkung: e.target.value })} className="mt-1 h-16" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={!form.titel || uploading || aiDetecting}>
              {uploading ? "Hochladen..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}