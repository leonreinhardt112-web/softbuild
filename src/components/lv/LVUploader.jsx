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

  // Helper: get text content of first matching selector (case-insensitive tag search)
  const getText = (el, ...selectors) => {
    for (const sel of selectors) {
      const found = el.querySelector(sel);
      if (found?.textContent?.trim()) return found.textContent.trim();
    }
    // Fallback: search for any matching tag name case-insensitively
    for (const sel of selectors) {
      const tagName = sel.split(" ")[0];
      for (let child of el.childNodes) {
        if (child.nodeType === 1 && child.tagName?.toUpperCase() === tagName.toUpperCase()) {
          if (child.textContent?.trim()) return child.textContent.trim();
        }
      }
    }
    return "";
  };

  // Recursive processor respecting XML hierarchy
  const processNode = (node, parentOz = "") => {
    const tag = node.tagName;

    if (tag === "BoQCtgy") {
      const rawOz = getText(node, "CtgyNo", "OZ", "Pos") || node.getAttribute("RNoPart") || "";
      const shortText = getText(node, "LblTx ShortText", "LblTx", "ShortText", "KurzText", "Description") || "";
      const dotCount = (rawOz.match(/\./g) || []).length;
      let oz = rawOz;
      
      if (parentOz && dotCount === 0 && rawOz) {
        oz = `${parentOz}.${rawOz}`;
      }
      
      if (oz || shortText) {
        positions.push({ oz, short_text: shortText, long_text: "", quantity: "", unit: "", type: "title" });
      }

      // Recurse into all children, not just known tags
      const walkChildren = (el, parentOzLocal) => {
        for (let i = 0; i < el.children.length; i++) {
          const child = el.children[i];
          const t = child.tagName?.toUpperCase();
          if (t === "BOQCTGY") {
            processNode(child, parentOzLocal);
          } else if (t === "ITEM") {
            processItem(child, parentOzLocal);
          } else if (t === "DP") {
            processDP(child, parentOzLocal);
          } else {
            walkChildren(child, parentOzLocal);
          }
        }
      };
      walkChildren(node, oz);
    } else if (tag === "Item" || tag === "item") {
      processItem(node, parentOz);
    } else if (tag === "DP") {
      processDP(node, parentOz);
    }
  };

  const processItem = (node, parentOz) => {
    let oz = getText(node, "ItemNo", "OZ", "Pos") || node.getAttribute("RNoPart") || "";
    
    let shortText = "";
    let longText = "";

    // Kurztext: suche ShortText-Element, aber ignoriere Elemente die nur einen Boolean-Wert enthalten
    // (manche GAEB-Varianten haben <ShortText> mit Boolean-Attributen als Kindelemente)
    const shortCandidates = ["ShortText", "KurzText", "Description ShortText"];
    for (const sel of shortCandidates) {
      const el = node.querySelector(sel);
      if (el) {
        // Sammle nur Textnoten dieses Elements (nicht verschachtelter Kindelemente die Boolean-Flags sind)
        let text = "";
        for (const child of el.childNodes) {
          if (child.nodeType === 3) { // direkte TEXT_NODEs
            text += child.textContent;
          } else if (child.nodeType === 1 && child.children.length === 0) {
            // Leaf-Elemente: nur übernehmen wenn kein Boolean
            const val = child.textContent?.trim();
            const lower = val?.toLowerCase();
            if (val && lower !== "yes" && lower !== "no" && lower !== "true" && lower !== "false") {
              text += val;
            }
          }
        }
        shortText = text.trim();
        // Falls nichts gefunden, ganzen textContent nehmen (außer reiner Boolean)
        if (!shortText) {
          const full = el.textContent?.trim();
          const lower = full?.toLowerCase();
          if (full && lower !== "yes" && lower !== "no" && lower !== "true" && lower !== "false") {
            shortText = full;
          }
        }
        if (shortText) break;
      }
    }
    // Letzter Fallback: Description-Element direkt
    if (!shortText) {
      const descEl = node.querySelector("Description");
      if (descEl) {
        let text = "";
        for (const child of descEl.childNodes) {
          if (child.nodeType === 3) text += child.textContent;
        }
        shortText = text.trim();
        if (!shortText) {
          const full = descEl.textContent?.trim();
          const lower = full?.toLowerCase();
          if (full && lower !== "yes" && lower !== "no" && lower !== "true" && lower !== "false") {
            shortText = full;
          }
        }
      }
    }

    // Suche Langtext NICHT in ShortText, nur in DetailText/LongText Elementen
    const longEl = node.querySelector("DetailTxt Text") || node.querySelector("CompleteText") || node.querySelector("LongText") || node.querySelector("LangText");
    if (longEl?.textContent?.trim()) {
      longText = longEl.textContent.trim();
    }
    
    const qty = getText(node, "Qty", "Menge") || "";
    const unit = getText(node, "QU", "QtyUnit", "Einheit") || "";

    if (!oz || oz.length < 2) {
      if (parentOz) oz = `${parentOz}.0001`;
      else oz = "0001";
    } else if (parentOz && !oz.includes(".")) {
      oz = `${parentOz}.${oz}`;
    }

    if (oz || shortText) {
      positions.push({ oz, short_text: shortText, long_text: longText, quantity: qty, unit, type: "position" });
    }
  };

  const processDP = (node, parentOz) => {
    let oz = getText(node, "OZ", "Pos") || "";
    const shortText = getText(node, "Kurz", "KurzText", "Text") || "";
    const qty = getText(node, "Menge", "Qty") || "";
    const unit = getText(node, "ME", "QU") || "";
    const isTitle = !qty || qty === "0";

    if (parentOz && !oz.includes(".")) {
      oz = `${parentOz}.${oz}`;
    }

    if (oz || shortText) {
      positions.push({ oz, short_text: shortText, long_text: "", quantity: qty, unit, type: isTitle ? "title" : "position" });
    }
  };

  // Deep recursive search through all elements
  const searchAll = (el, parentOz = "") => {
    if (!el.children) return;
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      const tag = child.tagName?.toUpperCase();
      if (tag === "BOQCTGY") {
        processNode(child, parentOz);
      } else if (tag === "ITEM" || tag === "DP") {
        tag === "ITEM" ? processItem(child, parentOz) : processDP(child, parentOz);
      } else {
        searchAll(child, parentOz);
      }
    }
  };

  // Start search from root
  searchAll(doc);

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
  const unterlagen = project?.projekt_unterlagen || [];
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

  // ── Unterlagen Upload (mehrere Dateien) ────────────────────────────────────
  const handleBauDrop = (e) => {
    e.preventDefault();
    setDragOverBau(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(handleBauFile);
  };

  const handleBauSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) await handleBauFile(file);
    e.target.value = "";
  };

  const handleBauFile = async (file) => {
    setError(null);
    setUploadingBau(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const existing = project?.projekt_unterlagen || [];
      // Unterlage im Projekt speichern
      await onUpdate({ projekt_unterlagen: [...existing, { name: file.name, url: file_url }], baulv_conflict_findings: [] });
      // Gleichzeitig als ProjektDokument anlegen → kein Doppel-Upload nötig
      const kat = file.name.toLowerCase().endsWith(".pdf") ? "angebotsunterlagen" : "sonstiges";
      await base44.entities.ProjektDokument.create({
        project_id: project.id,
        titel: file.name,
        dateiname: file.name,
        datei: file_url,
        kategorie: kat,
        bemerkung: "Automatisch aus LV-Unterlagen übernommen",
      });
    } catch (err) {
      setError("Fehler beim Hochladen: " + err.message);
    }
    setUploadingBau(false);
  };

  const handleRemoveUnterlage = async (index) => {
    const updated = (project?.projekt_unterlagen || []).filter((_, i) => i !== index);
    await onUpdate({ projekt_unterlagen: updated, baulv_conflict_findings: [] });
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
    if (!project?.lv_positions?.length || !unterlagen.length) return;
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
        file_urls: unterlagen.map((u) => u.url),
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
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${dragOverLV ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-accent/30"}`}
                onClick={() => lvFileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOverLV(true); }}
                onDragLeave={() => setDragOverLV(false)}
                onDrop={handleLVDrop}
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

        {/* ── Baubeschreibung & sonstige Unterlagen ── */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Baubeschreibung &amp; sonstige Unterlagen</p>

          {/* Hochgeladene Dateien */}
          {unterlagen.length > 0 && (
            <div className="space-y-1.5">
              {unterlagen.map((u, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <p className="text-xs font-medium text-blue-800 truncate max-w-[200px]">{u.name}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground shrink-0" onClick={() => handleRemoveUnterlage(i)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Dropzone (immer sichtbar zum Hinzufügen weiterer Dateien) */}
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${dragOverBau ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-accent/30"}`}
            onClick={() => bauFileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOverBau(true); }}
            onDragLeave={() => setDragOverBau(false)}
            onDrop={handleBauDrop}
          >
            {uploadingBau ? <Loader2 className="w-5 h-5 text-primary mx-auto mb-1.5 animate-spin" /> : <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />}
            <p className="text-sm font-medium">{uploadingBau ? "Wird hochgeladen..." : unterlagen.length > 0 ? "Weitere Dateien hinzufügen" : "Dateien hochladen"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">PDF, Word, Pläne oder sonstige Dokumente · Mehrere möglich</p>
          </div>
          <input ref={bauFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.dwg,.dxf,.jpg,.png" multiple className="hidden" onChange={handleBauSelect} />

          {/* Widerspruchsanalyse */}
          {hasLV && unterlagen.length > 0 && (
            !hasConflicts ? (
              <Button className="w-full gap-2" variant="outline" size="sm" onClick={handleAnalyzeConflicts} disabled={analyzingConflicts}>
                {analyzingConflicts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSearch className="w-3.5 h-3.5" />}
                {analyzingConflicts ? "Analysiere Widersprüche..." : "Widersprüche zwischen Unterlagen und LV prüfen"}
              </Button>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{project.baulv_conflict_findings.length} Widersprüche gefunden</span>
                <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={handleAnalyzeConflicts} disabled={analyzingConflicts}>
                  {analyzingConflicts ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSearch className="w-3 h-3" />}
                  Neu prüfen
                </Button>
              </div>
            )
          )}
          {!hasLV && unterlagen.length > 0 && (
            <p className="text-xs text-muted-foreground text-center py-1">LV hochladen um Widerspruchsanalyse zu starten</p>
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