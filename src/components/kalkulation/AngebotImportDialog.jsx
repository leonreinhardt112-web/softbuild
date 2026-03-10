import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText, Sparkles, Check, X, Package, Trash2, PlayCircle } from "lucide-react";

const KONFIDENZ_COLOR = (k) => {
  if (k >= 0.8) return "bg-green-100 text-green-700";
  if (k >= 0.6) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
};

export default function AngebotImportDialog({ project, kalkulation, onPositionenApplied }) {
  const [open, setOpen] = useState(false);
  const [lieferantName, setLieferantName] = useState("");
  const [file, setFile] = useState(null);
  const [step, setStep] = useState("upload"); // upload | extracting | review | applying
  const [positionen, setPositionen] = useState([]);
  const [currentImportId, setCurrentImportId] = useState(null);
  const [error, setError] = useState(null);
  const qc = useQueryClient();

  const { data: vorhandeneImports = [], refetch: refetchImports } = useQuery({
    queryKey: ["angebot-imports", kalkulation?.id],
    queryFn: () => base44.entities.AngebotImport.filter({ kalkulation_id: kalkulation.id }),
    enabled: open && !!kalkulation?.id
  });

  const handleDeleteImport = async (imp) => {
    // Alle Kalkulationszeilen aus diesem Import entfernen
    const currentPositions = kalkulation.positions || [];
    const updatedPositions = currentPositions.map(pos => ({
      ...pos,
      rows: (pos.rows || []).filter(row => row.angebot_import_id !== imp.id)
    }));
    await base44.entities.Kalkulation.update(kalkulation.id, { positions: updatedPositions });
    if (onPositionenApplied) onPositionenApplied(updatedPositions);

    await base44.entities.AngebotImport.delete(imp.id);
    refetchImports();
  };

  const handleReviewImport = (imp) => {
    setLieferantName(imp.lieferant_name);
    setCurrentImportId(imp.id);
    setPositionen(imp.extrahierte_positionen || []);
    setStep("review");
  };

  const lvPositions = (project?.lv_positions || []).filter(p => {
    if (p.type === "title") return false;
    const hasNoQty = !p.quantity || p.quantity === "0" || p.quantity === "";
    return !hasNoQty;
  });

  const reset = () => {
    setFile(null);
    setLieferantName("");
    setStep("upload");
    setPositionen([]);
    setError(null);
  };

  const handleExtract = async () => {
    if (!file || !lieferantName) return;
    setStep("extracting");
    setError(null);
    try {
      // Datei hochladen
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Extraktion via Backend-Funktion
      const res = await base44.functions.invoke("extractAngebot", {
        file_url,
        lv_positions: lvPositions.map(p => ({ oz: p.oz, short_text: p.short_text }))
      });

      const extracted = res.data?.positionen || [];

      // AngebotImport-Datensatz speichern
      const importRecord = await base44.entities.AngebotImport.create({
        project_id: project.id,
        kalkulation_id: kalkulation.id,
        lieferant_name: lieferantName,
        file_url,
        file_name: file.name,
        status: "extrahiert",
        extrahierte_positionen: extracted
      });

      setCurrentImportId(importRecord.id);
      setPositionen(extracted);
      setStep("review");
    } catch (e) {
      setError(e.message || "Fehler bei der Extraktion");
      setStep("upload");
    }
  };

  const updateZuordnung = (id, oz) => {
    const lvPos = lvPositions.find(p => p.oz === oz);
    setPositionen(prev => prev.map(p =>
      p.id === id ? {
        ...p,
        zugeordnete_oz: oz,
        zugeordneter_kurztext: lvPos?.short_text || "",
        zuordnung_status: "manuell"
      } : p
    ));
  };

  const toggleIgnore = (id) => {
    setPositionen(prev => prev.map(p =>
      p.id === id ? {
        ...p,
        zuordnung_status: p.zuordnung_status === "ignoriert" ? "offen" : "ignoriert"
      } : p
    ));
  };

  const handleApply = async () => {
    setStep("applying");
    try {
      const zuZuordnen = positionen.filter(p =>
        p.zuordnung_status !== "ignoriert" && p.zugeordnete_oz
      );

      // Kalkulationspositionen aktualisieren
      const updatedPositions = [...(kalkulation.positions || [])];

      for (const ap of zuZuordnen) {
        const lvPos = lvPositions.find(p => p.oz === ap.zugeordnete_oz);
        if (!lvPos) continue;

        const idx = updatedPositions.findIndex(p => p.oz === ap.zugeordnete_oz);
        const newRow = {
          id: crypto.randomUUID(),
          angebot_import_id: currentImportId,
          name: ap.kurztext_angebot,
          beschreibung: `Angebot ${lieferantName}`,
          kostentyp: ap.kostentyp || "Material",
          menge: 1,
          einheit: ap.einheit || lvPos.unit || "pauschal",
          kosten_einheit: ap.ep
        };

        if (idx >= 0) {
          updatedPositions[idx] = {
            ...updatedPositions[idx],
            rows: [...(updatedPositions[idx].rows || []), newRow],
            ep: ap.ep,
            gp: ap.ep * (parseFloat(lvPos.quantity) || 0)
          };
        } else {
          updatedPositions.push({
            oz: ap.zugeordnete_oz,
            short_text: lvPos.short_text,
            menge: parseFloat(lvPos.quantity) || 0,
            einheit: lvPos.unit || "",
            ep: ap.ep,
            gp: ap.ep * (parseFloat(lvPos.quantity) || 0),
            rows: [newRow]
          });
        }
      }

      await base44.entities.Kalkulation.update(kalkulation.id, { positions: updatedPositions });

      if (onPositionenApplied) onPositionenApplied(updatedPositions);
      setOpen(false);
      reset();
    } catch (e) {
      setError(e.message);
      setStep("review");
    }
  };

  const offenePositionen = positionen.filter(p => p.zuordnung_status === "offen").length;
  const zugeordnete = positionen.filter(p => p.zuordnung_status !== "ignoriert" && p.zugeordnete_oz).length;

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setOpen(true)}>
        <Sparkles className="w-3.5 h-3.5" />
        Angebot importieren
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); reset(); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Angebot importieren & Positionen zuordnen</DialogTitle>
          </DialogHeader>

          {/* Vorhandene Imports */}
          {step === "upload" && vorhandeneImports.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                Bereits importierte Angebote ({vorhandeneImports.length})
              </p>
              <div className="space-y-1.5">
                {vorhandeneImports.map(imp => (
                  <div key={imp.id} className="flex items-center justify-between text-xs bg-card rounded-md px-3 py-2 border border-border/50">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{imp.lieferant_name}</span>
                      {imp.file_name && <span className="text-muted-foreground truncate max-w-[180px]">{imp.file_name}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground">{(imp.extrahierte_positionen || []).length} Pos.</span>
                      <Badge className={imp.status === "angewendet" ? "bg-green-100 text-green-700 text-[10px]" : "bg-amber-100 text-amber-700 text-[10px]"}>
                        {imp.status === "angewendet" ? "Angewendet" : imp.status === "geprueft" ? "Geprüft" : "Extrahiert"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={() => handleReviewImport(imp)}
                        title="Positionen überprüfen & anwenden"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteImport(imp.id)}
                        title="Löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Anbieter / Lieferant *</label>
                <Input
                  placeholder="z.B. Müller Tiefbau GmbH"
                  value={lieferantName}
                  onChange={e => setLieferantName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Angebotsdatei (PDF, JPG, PNG) *</label>
                <label
                  className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-accent/5 transition-all"
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-accent/10"); }}
                  onDragLeave={e => { e.currentTarget.classList.remove("border-primary", "bg-accent/10"); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-primary", "bg-accent/10");
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) setFile(dropped);
                  }}
                >
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                  />
                  {file ? (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="font-medium">{file.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Upload className="w-8 h-8" />
                      <span className="text-sm">Datei auswählen oder hierher ziehen</span>
                      <span className="text-xs">PDF, JPG, PNG</span>
                    </div>
                  )}
                </label>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Abbrechen</Button>
                <Button onClick={handleExtract} disabled={!file || !lieferantName} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  KI-Extraktion starten
                </Button>
              </div>
            </div>
          )}

          {/* Step: Extracting */}
          {step === "extracting" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm font-medium">KI analysiert das Angebot...</p>
              <p className="text-xs text-muted-foreground">Positionen werden extrahiert und den LV-Positionen zugeordnet</p>
            </div>
          )}

          {/* Step: Review */}
          {step === "review" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <Badge className="bg-green-100 text-green-700">
                    {zugeordnete} zugeordnet
                  </Badge>
                  {offenePositionen > 0 && (
                    <Badge className="bg-amber-100 text-amber-700">
                      {offenePositionen} offen – manuelle Prüfung erforderlich
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{positionen.length} Positionen extrahiert</p>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-14">Pos.</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Kurztext (Angebot)</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">EP (€)</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Zugeordnete LV-Position</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Konfidenz</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {positionen.map(pos => (
                      <tr key={pos.id} className={`border-b border-border/50 ${pos.zuordnung_status === "ignoriert" ? "opacity-40" : ""}`}>
                        <td className="px-3 py-2 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                         {pos.pos_nr || "–"}
                        </td>
                        <td className="px-3 py-2 text-foreground max-w-[200px]">
                         <span className="line-clamp-2">{pos.kurztext_angebot}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {pos.ep?.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 min-w-[220px]">
                          <Select
                            value={pos.zugeordnete_oz || ""}
                            onValueChange={v => updateZuordnung(pos.id, v)}
                            disabled={pos.zuordnung_status === "ignoriert"}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Nicht zugeordnet...">
                                {pos.zugeordnete_oz ? (
                                  <span className="truncate">{pos.zugeordnete_oz} – {pos.zugeordneter_kurztext}</span>
                                ) : "Nicht zugeordnet..."}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {lvPositions.map(lv => (
                                <SelectItem key={lv.oz} value={lv.oz}>
                                  {lv.oz} – {(lv.short_text || "").substring(0, 50)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {pos.zuordnung_status !== "ignoriert" && pos.konfidenz > 0 && (
                            <Badge className={`text-[10px] ${KONFIDENZ_COLOR(pos.konfidenz)}`}>
                              {Math.round(pos.konfidenz * 100)}%
                            </Badge>
                          )}
                          {pos.zuordnung_status === "offen" && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-700">Prüfen</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 ${pos.zuordnung_status === "ignoriert" ? "text-muted-foreground" : "text-muted-foreground hover:text-destructive"}`}
                            onClick={() => toggleIgnore(pos.id)}
                            title={pos.zuordnung_status === "ignoriert" ? "Wiederherstellen" : "Ignorieren"}
                          >
                            {pos.zuordnung_status === "ignoriert" ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <p className="text-xs text-muted-foreground">
                  Nicht zugeordnete Positionen werden ignoriert. Sie können Zuordnungen manuell korrigieren.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Abbrechen</Button>
                  <Button onClick={handleApply} disabled={zugeordnete === 0} className="gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {zugeordnete} Positionen übernehmen
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step: Applying */}
          {step === "applying" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm font-medium">Positionen werden übernommen...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}