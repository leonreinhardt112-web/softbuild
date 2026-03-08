import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Loader2, Sparkles, X, CheckCircle2 } from "lucide-react";

/**
 * Parses a GAEB X83 / X81 / X82 XML file and returns an array of LV positions.
 * Handles both GAEB 90 and GAEB DA XML namespaced variants.
 */
function parseX83(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");

  const positions = [];

  // GAEB DA XML format (newer, namespaced)
  const items = doc.querySelectorAll("Item, item");
  if (items.length > 0) {
    items.forEach((item) => {
      const oz =
        item.querySelector("ItemNo, Pos, OZ, oz")?.textContent?.trim() ||
        item.getAttribute("RNoPart") ||
        "";
      const shortText =
        item.querySelector("ShortText, KurzText, short-text")?.textContent?.trim() || "";
      const longText =
        item.querySelector("DetailTxt Text, LongText, LangText")?.textContent?.trim() || "";
      const qty =
        item.querySelector("Qty, Menge, qty")?.textContent?.trim() || "";
      const unit =
        item.querySelector("QU, Einheit, QtyUnit, unit")?.textContent?.trim() || "";

      if (oz || shortText) {
        positions.push({ oz, short_text: shortText, long_text: longText, quantity: qty, unit });
      }
    });
    return positions;
  }

  // GAEB 90 older text-like fallback: try to find OZ-like patterns in raw text
  // Try DP/Ordnungszahl approach
  const dpItems = doc.querySelectorAll("DP");
  dpItems.forEach((dp) => {
    const oz = dp.querySelector("OZ, Pos")?.textContent?.trim() || "";
    const shortText = dp.querySelector("Kurz, KurzText, Text")?.textContent?.trim() || "";
    const qty = dp.querySelector("Menge, Qty")?.textContent?.trim() || "";
    const unit = dp.querySelector("ME, QU")?.textContent?.trim() || "";
    if (oz || shortText) {
      positions.push({ oz, short_text: shortText, long_text: "", quantity: qty, unit });
    }
  });

  return positions;
}

export default function LVUploader({ project, onUpdate }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const hasLV = project?.lv_positions?.length > 0;
  const hasAnalysis = project?.lv_analysis_findings?.length > 0;

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      // Read file text
      const text = await file.text();
      const positions = parseX83(text);

      if (positions.length === 0) {
        setError("Keine LV-Positionen in der Datei gefunden. Bitte prüfen Sie das Format (GAEB X83/X81/X82).");
        setUploading(false);
        return;
      }

      // Upload file for archiving
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      await onUpdate({
        lv_file_url: file_url,
        lv_file_name: file.name,
        lv_positions: positions,
        lv_analysis_findings: [],
      });
    } catch (err) {
      setError("Fehler beim Verarbeiten der Datei: " + err.message);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleAnalyze = async () => {
    if (!project?.lv_positions?.length) return;
    setAnalyzing(true);
    setError(null);

    const positionList = project.lv_positions
      .map((p) => `OZ ${p.oz}: ${p.short_text} (${p.quantity} ${p.unit})`)
      .join("\n");

    const selectedTrades = (project.selected_trades || []).join(", ");

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Du bist ein erfahrener Tiefbauingenieur und Experte für GAEB-Leistungsverzeichnisse nach VOB.
        
Analysiere folgendes Leistungsverzeichnis für ein Tiefbauprojekt (Gewerke: ${selectedTrades}) auf Vollständigkeit und Schlüssigkeit nach VOB/A §7, VOB/C und einschlägigen DIN-Normen.

LV-Positionen:
${positionList}

Prüfe insbesondere:
1. Fehlende Positionen für typische Tiefbaugewerke (z.B. fehlende Verbau-, Wasserhaltungs-, oder Schutzmaßnahmen)
2. Unvollständige Leistungsbeschreibungen (fehlende Angaben zu Material, Ausführung, Qualität)
3. Fehlende Mengenangaben oder nicht plausible Einheiten
4. Fehlende VOB/C-konforme Nebenleistungen
5. Lücken bei Entsorgungsleistungen
6. Nicht VOB-konforme Formulierungen oder Einheitenprobleme

Gib eine strukturierte Liste von konkreten Befunden zurück.`,
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
        id: `finding_${Date.now()}_${i}`,
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

  const handleRemoveLV = async () => {
    await onUpdate({ lv_file_url: null, lv_file_name: null, lv_positions: [], lv_analysis_findings: [] });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Leistungsverzeichnis (GAEB X83)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasLV ? (
          <div>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-all"
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 text-primary mx-auto mb-2 animate-spin" />
              ) : (
                <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              )}
              <p className="text-sm font-medium text-foreground">
                {uploading ? "Wird verarbeitet..." : "X83-Datei hochladen"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                GAEB X81 / X82 / X83 · XML-Format
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".x83,.x82,.x81,.xml,.X83,.X82,.X81"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {/* File info */}
            <div className="flex items-center justify-between p-2.5 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-green-800">{project.lv_file_name}</p>
                  <p className="text-[10px] text-green-600">
                    {project.lv_positions.length} Positionen eingelesen
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={handleRemoveLV}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Analyze button */}
            {!hasAnalysis && (
              <Button
                className="w-full gap-2"
                variant="outline"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {analyzing ? "KI analysiert LV..." : "KI-Analyse starten"}
              </Button>
            )}

            {hasAnalysis && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {project.lv_analysis_findings.length} Befunde gefunden
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 gap-1"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Neu analysieren
                </Button>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}