import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Loader2, Sparkles, X, CheckCircle2, AlertTriangle, FileSearch } from "lucide-react";

const TRADE_KEYWORDS = {
  erdbau: ["erdbau", "erdarbeiten", "aushub", "boden", "verfüllung", "bodenklasse", "massenermittlung", "oberboden", "mutterboden"],
  verbau: ["verbau", "spundwand", "trägerbohlwand", "baugrubenverbau", "verbauplanung", "steifen", "anker"],
  kanalbau: ["kanal", "rohr", "schacht", "abwasser", "entwässerung", "haltung", "kanalisation", "nennweite", "dn ", "rinne"],
  strassenbau: ["asphalt", "pflaster", "fahrbahn", "gehweg", "tragschicht", "frostschutz", "bordstein", "straßenbau", "oberbau", "rsto"],
  wasserhaltung: ["wasserhaltung", "grundwasser", "pumpe", "pumpensumpf", "absenkung", "einleitung"],
  draen_versickerung: ["drän", "drainage", "versickerung", "rigole", "mulde", "kf-wert", "sickerschacht"],
};

/**
 * Parses a GAEB X83/X81/X82 XML file and returns positions + detected trades.
 */
function parseX83(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const positions = [];

  const items = doc.querySelectorAll("Item, item");
  if (items.length > 0) {
    items.forEach((item) => {
      const oz = item.querySelector("ItemNo, Pos, OZ, oz")?.textContent?.trim() || item.getAttribute("RNoPart") || "";
      const shortText = item.querySelector("ShortText, KurzText, short-text")?.textContent?.trim() || "";
      const longText = item.querySelector("DetailTxt Text, LongText, LangText")?.textContent?.trim() || "";
      const qty = item.querySelector("Qty, Menge, qty")?.textContent?.trim() || "";
      const unit = item.querySelector("QU, Einheit, QtyUnit, unit")?.textContent?.trim() || "";
      if (oz || shortText) positions.push({ oz, short_text: shortText, long_text: longText, quantity: qty, unit });
    });
  } else {
    const dpItems = doc.querySelectorAll("DP");
    dpItems.forEach((dp) => {
      const oz = dp.querySelector("OZ, Pos")?.textContent?.trim() || "";
      const shortText = dp.querySelector("Kurz, KurzText, Text")?.textContent?.trim() || "";
      const qty = dp.querySelector("Menge, Qty")?.textContent?.trim() || "";
      const unit = dp.querySelector("ME, QU")?.textContent?.trim() || "";
      if (oz || shortText) positions.push({ oz, short_text: shortText, long_text: "", quantity: qty, unit });
    });
  }
  return positions;
}

function detectTradesFromPositions(positions) {
  const allText = positions.map((p) => `${p.short_text} ${p.long_text}`).join(" ").toLowerCase();
  const detected = new Set(["allgemein"]);
  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
    if (keywords.some((kw) => allText.includes(kw))) {
      detected.add(trade);
    }
  }
  return [...detected];
}

export default function LVUploader({ project, onUpdate, onTradesDetected }) {
  const lvFileRef = useRef();
  const bauFileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [uploadingBau, setUploadingBau] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingConflicts, setAnalyzingConflicts] = useState(false);
  const [error, setError] = useState(null);

  const [dragOverLV, setDragOverLV] = useState(false);
  const [dragOverBau, setDragOverBau] = useState(false);

  const hasLV = project?.lv_positions?.length > 0;
  const hasBau = !!project?.baubeschreibung_file_name;
  const hasAnalysis = project?.lv_analysis_findings?.length > 0;
  const hasConflicts = project?.baulv_conflict_findings?.length > 0;

  // ── LV Upload ──────────────────────────────────────────────────────────────
  const handleLVDrop = (e) => {
    e.preventDefault();
    setDragOverLV(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleLVFile(file);
  };

  const handleLVSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleLVFile(file);
    e.target.value = "";
  };

  const handleLVFile = async (file) => {
    setError(null);
    setUploading(true);
    try {
      const text = await file.text();
      const positions = parseX83(text);
      if (positions.length === 0) {
        setError("Keine LV-Positionen gefunden. Bitte GAEB X83/X82/X81 (XML) verwenden.");
        setUploading(false);
        return;
      }
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const detectedTrades = detectTradesFromPositions(positions);
      await onUpdate({
        lv_file_url: file_url,
        lv_file_name: file.name,
        lv_positions: positions,
        lv_analysis_findings: [],
        baulv_conflict_findings: [],
      });
      if (onTradesDetected) onTradesDetected(detectedTrades);
    } catch (err) {
      setError("Fehler beim Verarbeiten der Datei: " + err.message);
    }
    setUploading(false);
  };

  const handleRemoveLV = async () => {
    await onUpdate({ lv_file_url: null, lv_file_name: null, lv_positions: [], lv_analysis_findings: [], baulv_conflict_findings: [] });
  };

  // ── Baubeschreibung Upload ─────────────────────────────────────────────────
  const handleBauSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingBau(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await onUpdate({ baubeschreibung_file_url: file_url, baubeschreibung_file_name: file.name, baulv_conflict_findings: [] });
    } catch (err) {
      setError("Fehler beim Hochladen der Baubeschreibung: " + err.message);
    }
    setUploadingBau(false);
    e.target.value = "";
  };

  const handleRemoveBau = async () => {
    await onUpdate({ baubeschreibung_file_url: null, baubeschreibung_file_name: null, baulv_conflict_findings: [] });
  };

  // ── KI-Analyse LV ─────────────────────────────────────────────────────────
  const handleAnalyzeLV = async () => {
    if (!project?.lv_positions?.length) return;
    setAnalyzing(true);
    setError(null);
    const positionList = project.lv_positions.map((p) => `OZ ${p.oz}: ${p.short_text} (${p.quantity} ${p.unit})`).join("\n");
    const selectedTrades = (project.selected_trades || []).join(", ");
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Du bist ein erfahrener Tiefbauingenieur und Experte für GAEB-Leistungsverzeichnisse nach VOB.
Analysiere folgendes Leistungsverzeichnis (Gewerke: ${selectedTrades}) auf Vollständigkeit und Schlüssigkeit nach VOB/A §7, VOB/C und einschlägigen DIN-Normen.

LV-Positionen:
${positionList}

Prüfe: fehlende Positionen, unvollständige Beschreibungen, fehlende Mengenangaben, VOB/C-Nebenleistungen, Entsorgungsleistungen, nicht VOB-konforme Formulierungen.
Gib eine strukturierte Liste konkreter Befunde zurück.`,
        response_json_schema: {
          type: "object",
          properties: {
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  severity: { type: "string", enum: ["kritisch", "wichtig", "hinweis"] },
                  category: { type: "string" }
                }
              }
            }
          }
        }
      });
      const findings = (result.findings || []).map((f, i) => ({
        id: `lv_${Date.now()}_${i}`,
        text: f.text,
        severity: f.severity || "wichtig",
        category: f.category || "Vollständigkeit",
        include_in_report: true,
      }));
      await onUpdate({ lv_analysis_findings: findings });
    } catch (err) {
      setError("KI-Analyse fehlgeschlagen: " + err.message);
    }
    setAnalyzing(false);
  };

  // ── Widerspruchsanalyse ────────────────────────────────────────────────────
  const handleAnalyzeConflicts = async () => {
    if (!project?.lv_positions?.length || !project?.baubeschreibung_file_url) return;
    setAnalyzingConflicts(true);
    setError(null);
    const positionList = project.lv_positions.map((p) => `OZ ${p.oz}: ${p.short_text} (${p.quantity} ${p.unit})`).join("\n");
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Du bist ein erfahrener Tiefbauingenieur. Prüfe die beigefügte Baubeschreibung (PDF/Dokument) auf Widersprüche und Unstimmigkeiten mit dem folgenden Leistungsverzeichnis.

LV-Positionen:
${positionList}

Identifiziere konkrete Widersprüche, z.B.:
- Materialangaben in Baubeschreibung weichen von LV ab
- Ausführungsstandards in Baubeschreibung fehlen im LV
- Mengen oder Dimensionen passen nicht zur Baubeschreibung
- Leistungen in Baubeschreibung ohne LV-Position (und umgekehrt)
- Normverweise stimmen nicht überein

Gib eine strukturierte Liste der Widersprüche zurück.`,
        file_urls: [project.baubeschreibung_file_url],
        response_json_schema: {
          type: "object",
          properties: {
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  severity: { type: "string", enum: ["kritisch", "wichtig", "hinweis"] },
                  category: { type: "string" }
                }
              }
            }
          }
        }
      });
      const findings = (result.findings || []).map((f, i) => ({
        id: `conflict_${Date.now()}_${i}`,
        text: f.text,
        severity: f.severity || "wichtig",
        category: f.category || "Widerspruch",
        include_in_report: true,
      }));
      await onUpdate({ baulv_conflict_findings: findings });
    } catch (err) {
      setError("Widerspruchsanalyse fehlgeschlagen: " + err.message);
    }
    setAnalyzingConflicts(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Unterlagen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* ── LV-Datei ── */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Leistungsverzeichnis (GAEB)</p>
          {!hasLV ? (
            <div>
              <div
                className="border-2 border-dashed border-border rounded-lg p-5 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-all"
                onClick={() => lvFileRef.current?.click()}
              >
                {uploading ? <Loader2 className="w-5 h-5 text-primary mx-auto mb-1.5 animate-spin" /> : <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />}
                <p className="text-sm font-medium">{uploading ? "Wird verarbeitet..." : "X83-Datei hochladen"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">GAEB X81 / X82 / X83 · Gewerke werden automatisch erkannt</p>
              </div>
              <input ref={lvFileRef} type="file" accept=".x83,.x82,.x81,.xml,.X83,.X82,.X81" className="hidden" onChange={handleLVSelect} />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-green-800">{project.lv_file_name}</p>
                    <p className="text-[10px] text-green-600">{project.lv_positions.length} Positionen · Gewerke erkannt</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleRemoveLV}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              {!hasAnalysis ? (
                <Button className="w-full gap-2" variant="outline" size="sm" onClick={handleAnalyzeLV} disabled={analyzing}>
                  {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {analyzing ? "KI analysiert LV..." : "LV auf Vollständigkeit prüfen"}
                </Button>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{project.lv_analysis_findings.length} LV-Befunde</span>
                  <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={handleAnalyzeLV} disabled={analyzing}>
                    {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Neu
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Baubeschreibung ── */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Baubeschreibung</p>
          {!hasBau ? (
            <div>
              <div
                className="border-2 border-dashed border-border rounded-lg p-5 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-all"
                onClick={() => bauFileRef.current?.click()}
              >
                {uploadingBau ? <Loader2 className="w-5 h-5 text-primary mx-auto mb-1.5 animate-spin" /> : <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />}
                <p className="text-sm font-medium">{uploadingBau ? "Wird hochgeladen..." : "Baubeschreibung hochladen"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">PDF, Word oder sonstiges Dokument</p>
              </div>
              <input ref={bauFileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleBauSelect} />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-blue-800">{project.baubeschreibung_file_name}</p>
                    <p className="text-[10px] text-blue-600">Baubeschreibung geladen</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleRemoveBau}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              {hasLV && (
                !hasConflicts ? (
                  <Button className="w-full gap-2" variant="outline" size="sm" onClick={handleAnalyzeConflicts} disabled={analyzingConflicts}>
                    {analyzingConflicts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSearch className="w-3.5 h-3.5" />}
                    {analyzingConflicts ? "Analysiere Widersprüche..." : "Baubeschreibung vs. LV prüfen"}
                  </Button>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{project.baulv_conflict_findings.length} Widersprüche</span>
                    <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={handleAnalyzeConflicts} disabled={analyzingConflicts}>
                      {analyzingConflicts ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSearch className="w-3 h-3" />}
                      Neu
                    </Button>
                  </div>
                )
              )}
              {!hasLV && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  LV hochladen um Widerspruchsanalyse zu starten
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}