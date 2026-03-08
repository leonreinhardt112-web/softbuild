import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { TRADE_LABELS, SEVERITY_LABELS } from "../checklistData";
import { format } from "date-fns";

function generateReportHtml(project, checklistItems, openPoints) {
  const totalItems = checklistItems.filter((i) => i.status !== "nicht_relevant").length;
  const fulfilled = checklistItems.filter((i) => i.status === "erfuellt").length;
  const notFulfilled = checklistItems.filter((i) => i.status === "nicht_erfuellt").length;
  const open = checklistItems.filter((i) => i.status === "offen").length;
  const criticalFailed = checklistItems.filter(
    (i) => i.status === "nicht_erfuellt" && i.severity === "kritisch"
  ).length;
  const score = totalItems > 0 ? Math.round((fulfilled / totalItems) * 100) : 0;
  const isReady = criticalFailed === 0 && open === 0 && notFulfilled === 0;

  const trades = [...new Set(checklistItems.map((i) => i.trade))];

  const failedItems = checklistItems.filter((i) => i.status === "nicht_erfuellt");
  const activeOpenPoints = openPoints.filter((p) => p.status !== "erledigt");
  const lvFindings = (project.lv_analysis_findings || []).filter((f) => f.include_in_report);
  const lvPositions = project.lv_positions || [];
  const lvFileName = project.lv_file_name || "";

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>AFU-Prüfbericht - ${project.project_name}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a2e; font-size: 12px; line-height: 1.5; }
  h1 { font-size: 20px; color: #1a56db; margin-bottom: 4px; }
  h2 { font-size: 14px; color: #1a56db; border-bottom: 2px solid #1a56db; padding-bottom: 4px; margin-top: 24px; }
  h3 { font-size: 12px; margin-top: 16px; color: #374151; }
  .header { border-bottom: 3px solid #1a56db; padding-bottom: 16px; margin-bottom: 24px; }
  .subtitle { color: #6b7280; font-size: 13px; }
  .result-box { padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0; font-size: 18px; font-weight: bold; }
  .result-ready { background: #dcfce7; color: #166534; border: 2px solid #86efac; }
  .result-not-ready { background: #fee2e2; color: #991b1b; border: 2px solid #fca5a5; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
  .meta-item { padding: 6px 0; }
  .meta-label { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-value { font-weight: 600; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11px; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; border: 1px solid #e5e7eb; font-weight: 600; }
  td { padding: 6px 8px; border: 1px solid #e5e7eb; }
  .severity-kritisch { color: #dc2626; font-weight: 600; }
  .severity-wichtig { color: #d97706; }
  .severity-hinweis { color: #2563eb; }
  .score-bar { height: 8px; background: #e5e7eb; border-radius: 4px; margin-top: 4px; }
  .score-fill { height: 100%; border-radius: 4px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 10px; text-align: center; }
  @media print { body { padding: 20px; } }
</style></head><body>
<div class="header">
  <h1>AFU-Prüfbericht</h1>
  <p class="subtitle">Prüfung der Ausführungsunterlagen – Tiefbau</p>
</div>

<div class="result-box ${isReady ? "result-ready" : "result-not-ready"}">
  ${isReady ? "✓ AFU AUSFÜHRUNGSREIF" : "✗ AFU NICHT AUSFÜHRUNGSREIF"}
</div>

<h2>Projektdaten</h2>
<div class="meta-grid">
  <div class="meta-item"><div class="meta-label">Projektname</div><div class="meta-value">${project.project_name || "–"}</div></div>
  <div class="meta-item"><div class="meta-label">Projektnummer</div><div class="meta-value">${project.project_number || "–"}</div></div>
  <div class="meta-item"><div class="meta-label">Auftraggeber</div><div class="meta-value">${project.client || "–"}</div></div>
  <div class="meta-item"><div class="meta-label">Standort</div><div class="meta-value">${project.location || "–"}</div></div>
  <div class="meta-item"><div class="meta-label">Planungsbüro</div><div class="meta-value">${project.planning_office || "–"}</div></div>
  <div class="meta-item"><div class="meta-label">Vertragsart</div><div class="meta-value">${project.contract_type || "–"}</div></div>
  <div class="meta-item"><div class="meta-label">VOB/B vereinbart</div><div class="meta-value">${project.vob_agreed ? "Ja" : "Nein"}</div></div>
  <div class="meta-item"><div class="meta-label">Prüfdatum</div><div class="meta-value">${project.review_date ? format(new Date(project.review_date), "dd.MM.yyyy") : "–"}</div></div>
  <div class="meta-item"><div class="meta-label">Bearbeiter</div><div class="meta-value">${project.reviewer || "–"}</div></div>
  <div class="meta-item"><div class="meta-label">Erfüllungsgrad</div><div class="meta-value">${score}% (${fulfilled}/${totalItems})</div></div>
</div>

<h2>Zusammenfassung</h2>
<table>
  <tr><th>Gewerk</th><th>Geprüft</th><th>Erfüllt</th><th>Nicht erfüllt</th><th>Offen</th><th>Quote</th></tr>
  ${trades.map((t) => {
    const ti = checklistItems.filter((i) => i.trade === t && i.status !== "nicht_relevant");
    const tf = ti.filter((i) => i.status === "erfuellt").length;
    const tn = ti.filter((i) => i.status === "nicht_erfuellt").length;
    const to = ti.filter((i) => i.status === "offen").length;
    const ts = ti.length > 0 ? Math.round((tf / ti.length) * 100) : 0;
    return `<tr><td>${TRADE_LABELS[t] || t}</td><td>${ti.length}</td><td>${tf}</td><td>${tn}</td><td>${to}</td><td>${ts}%</td></tr>`;
  }).join("")}
</table>

${failedItems.length > 0 ? `
<h2>Nicht erfüllte Prüfpunkte (${failedItems.length})</h2>
<table>
  <tr><th>Gewerk</th><th>Prüfpunkt</th><th>Schweregrad</th><th>Normverweis</th><th>Verknüpfte LV-Pos.</th><th>Kommentar</th></tr>
  ${failedItems.map((i) => {
    const ozRefs = (i.lv_positions_ref || []);
    const ozDetails = ozRefs.map((oz) => {
      const pos = lvPositions.find((p) => p.oz === oz);
      return pos ? `OZ ${oz}: ${pos.short_text}` : `OZ ${oz}`;
    });
    return `<tr>
    <td>${TRADE_LABELS[i.trade] || i.trade}</td>
    <td>${i.question}</td>
    <td class="severity-${i.severity}">${SEVERITY_LABELS[i.severity]}</td>
    <td>${i.norm_reference || "–"}</td>
    <td>${ozDetails.length > 0 ? ozDetails.join("<br>") : "–"}</td>
    <td>${i.comment || "–"}</td>
  </tr>`;
  }).join("")}
</table>` : ""}

${lvFindings.length > 0 ? `
<h2>LV-Analyse: KI-Befunde (${lvFindings.length})${lvFileName ? ` – ${lvFileName}` : ""}</h2>
<p style="font-size:10px;color:#6b7280;margin-bottom:8px;">
  Automatische Analyse des Leistungsverzeichnisses auf Vollständigkeit und Schlüssigkeit nach VOB/A §7.
</p>
<table>
  <tr><th>Befund</th><th>Kategorie</th><th>Schweregrad</th></tr>
  ${lvFindings.map((f) => `<tr>
    <td>${f.text}</td>
    <td>${f.category || "–"}</td>
    <td class="severity-${f.severity}">${SEVERITY_LABELS[f.severity] || f.severity}</td>
  </tr>`).join("")}
</table>` : ""}

${activeOpenPoints.length > 0 ? `
<h2>Offene Punkte (${activeOpenPoints.length})</h2>
<table>
  <tr><th>Beschreibung</th><th>Gewerk</th><th>Schweregrad</th><th>Verantwortlich</th><th>Fällig</th><th>Status</th></tr>
  ${activeOpenPoints.map((p) => `<tr>
    <td>${p.description}</td>
    <td>${TRADE_LABELS[p.trade] || p.trade || "–"}</td>
    <td class="severity-${p.severity}">${SEVERITY_LABELS[p.severity] || p.severity}</td>
    <td>${p.responsible || "–"}</td>
    <td>${p.due_date ? format(new Date(p.due_date), "dd.MM.yyyy") : "–"}</td>
    <td>${p.status === "offen" ? "Offen" : p.status === "in_bearbeitung" ? "In Bearbeitung" : "Erledigt"}</td>
  </tr>`).join("")}
</table>` : ""}

<h2>Relevante Regelwerke</h2>
<table>
  <tr><th>Regelwerk</th><th>Beschreibung</th></tr>
  <tr><td>VOB/A §7</td><td>Leistungsbeschreibung</td></tr>
  <tr><td>VOB/B §3</td><td>Ausführungsunterlagen</td></tr>
  <tr><td>VOB/B §4</td><td>Ausführung</td></tr>
  <tr><td>VOB/C DIN 18299 ff.</td><td>Allgemeine Technische Vertragsbedingungen</td></tr>
  <tr><td>DIN 4124</td><td>Baugruben und Gräben</td></tr>
  <tr><td>DIN EN 1610</td><td>Verlegung und Prüfung von Abwasserleitungen</td></tr>
  <tr><td>DIN 2425-4</td><td>Planwerke für die Versorgungswirtschaft</td></tr>
  <tr><td>HOAI LP 3–5</td><td>Entwurfs-, Genehmigungs- und Ausführungsplanung</td></tr>
</table>

<div class="footer">
  <p>Erstellt am ${format(new Date(), "dd.MM.yyyy 'um' HH:mm 'Uhr'")}</p>
  <p>AFU-Prüfung · Tiefbau Deutschland</p>
</div>
</body></html>`;
}

export default function PdfReport({ project, checklistItems, openPoints }) {
  const handleDownload = () => {
    const html = generateReportHtml(project, checklistItems, openPoints);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank");
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  return (
    <Button variant="outline" className="gap-2" onClick={handleDownload}>
      <FileDown className="w-4 h-4" />
      PDF-Bericht
    </Button>
  );
}