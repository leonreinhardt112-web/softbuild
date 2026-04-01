import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Sparkles, Check, X, Loader2, FileText, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

const fmt = (v) =>
  v != null ? v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "–";

const STATUS_COLORS = {
  ausstehend: "bg-secondary text-secondary-foreground",
  erkannt: "bg-blue-100 text-blue-700",
  bestaetigt: "bg-green-100 text-green-700",
  abgelehnt: "bg-red-100 text-red-700",
  gespeichert: "bg-green-500 text-white",
};

export default function KIBelegErfassung({ projects, stammdaten, onSaved }) {
  const [belege, setBelege] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [savingIds, setSavingIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileRef = useRef();

  const handleFiles = async (files) => {
    setUploading(true);
    const newBelege = [];

    for (const file of files) {
      const id = Math.random().toString(36).slice(2);
      setBelege(prev => [...prev, { id, name: file.name, status: "ausstehend", file }]);

      try {
        // Upload file
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        // KI-Extraktion
        setBelege(prev => prev.map(b => b.id === id ? { ...b, status: "erkennend" } : b));

        const projektListe = projects.map(p => `${p.id}: ${p.project_name} (${p.project_number})`).join("\n");
        const kreditorListe = stammdaten
          .filter(s => ["nachunternehmer", "lieferant"].includes(s.typ) && s.aktiv !== false)
          .map(s => `${s.id}: ${s.name}`)
          .join("\n");

        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Du bist ein Buchhaltungsexperte für ein Tiefbauunternehmen. Extrahiere aus dieser Eingangsrechnung alle relevanten Daten.

Verfügbare Projekte:
${projektListe || "keine Projekte vorhanden"}

Verfügbare Kreditoren (Nachunternehmer/Lieferanten):
${kreditorListe || "keine Kreditoren vorhanden"}

Extrahiere:
- kreditor_name: Name des Rechnungsstellers
- kreditor_id: ID aus der Kreditoren-Liste (leer wenn nicht gefunden)
- rechnungsnummer: Rechnungsnummer
- rechnungsdatum: Datum im Format YYYY-MM-DD
- faellig_am: Fälligkeitsdatum im Format YYYY-MM-DD (falls nicht angegeben, rechnungsdatum + 30 Tage)
- betrag_netto: Nettobetrag als Zahl
- mwst_satz: MwSt-Satz als Zahl (Standard 19)
- betrag_brutto: Bruttobetrag als Zahl
- gewerk: Leistungsart/Gewerk (z.B. Erdbau, Kanalbau, Straßenbau, Materiallief., etc.)
- project_id: ID des wahrscheinlichsten Projekts aus der Liste (leer wenn unklar)
- rechnungsart: "eingangsrechnung", "teilrechnung", "schlussrechnung" oder "gutschrift"
- notes: Kurze Beschreibung der Leistung (max 1 Satz)
- konfidenz: Deine Konfidenz in die Zuordnung (0-100)
- konfidenz_begruendung: Kurze Begründung für die Projektzuordnung`,
          file_urls: [file_url],
          response_json_schema: {
            type: "object",
            properties: {
              kreditor_name: { type: "string" },
              kreditor_id: { type: "string" },
              rechnungsnummer: { type: "string" },
              rechnungsdatum: { type: "string" },
              faellig_am: { type: "string" },
              betrag_netto: { type: "number" },
              mwst_satz: { type: "number" },
              betrag_brutto: { type: "number" },
              gewerk: { type: "string" },
              project_id: { type: "string" },
              rechnungsart: { type: "string" },
              notes: { type: "string" },
              konfidenz: { type: "number" },
              konfidenz_begruendung: { type: "string" },
            },
          },
        });

        setBelege(prev => prev.map(b =>
          b.id === id ? { ...b, status: "erkannt", data: result, file_url } : b
        ));
        newBelege.push(id);
      } catch (err) {
        setBelege(prev => prev.map(b =>
          b.id === id ? { ...b, status: "fehler", fehler: err.message } : b
        ));
      }
    }
    setUploading(false);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf" || f.type.startsWith("image/"));
    if (files.length) handleFiles(files);
  };

  const handleSave = async (beleg) => {
    setSavingIds(prev => new Set([...prev, beleg.id]));
    try {
      // Prüfe auf Duplikate
      const existing = await base44.entities.EingangsRechnung.filter({
        kreditor_name: beleg.data.kreditor_name,
        rechnungsnummer: beleg.data.rechnungsnummer
      });

      if (existing.length > 0) {
        const existing_beleg = existing[0];
        const datum = new Date(existing_beleg.created_date).toLocaleDateString("de-DE");
        const warnung = `⚠️ Duplikat erkannt:\n\nEine Rechnung von ${beleg.data.kreditor_name} mit Nummer ${beleg.data.rechnungsnummer} wurde bereits am ${datum} durch ${existing_beleg.created_by} gebucht.\n\nTrotzdem nochmal buchen?`;
        if (!window.confirm(warnung)) {
          setSavingIds(prev => { const s = new Set(prev); s.delete(beleg.id); return s; });
          return;
        }
      }

      await base44.entities.EingangsRechnung.create({
        ...beleg.data,
        betrag_netto: beleg.data.betrag_netto || 0,
        betrag_brutto: beleg.data.betrag_brutto || 0,
        status: "eingegangen",
        datei_url: beleg.file_url,
        datei_name: beleg.name,
      });
      setBelege(prev => prev.map(b => b.id === beleg.id ? { ...b, status: "gespeichert" } : b));
      if (onSaved) onSaved();
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(beleg.id); return s; });
    }
  };

  const handleReject = (id) => {
    setBelege(prev => prev.map(b => b.id === id ? { ...b, status: "abgelehnt" } : b));
  };

  const updateField = (id, field, value) => {
    setBelege(prev => prev.map(b =>
      b.id === id ? { ...b, data: { ...b.data, [field]: value } } : b
    ));
  };

  const pending = belege.filter(b => !["gespeichert", "abgelehnt"].includes(b.status));
  const done = belege.filter(b => ["gespeichert", "abgelehnt"].includes(b.status));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          KI-Belegserfassung – Upload Eingangsrechnungen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-border hover:border-primary/60 hover:bg-primary/5"
          }`}
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">PDF-Rechnungen hierher ziehen oder klicken</p>
          <p className="text-xs text-muted-foreground mt-1">Beliebig viele PDFs oder Bilder auf einmal – KI erkennt automatisch alle Daten</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files))}
          />
        </div>

        {uploading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            KI verarbeitet Belege…
          </div>
        )}

        {/* Pending Belege */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {pending.length} Beleg{pending.length !== 1 ? "e" : ""} zur Prüfung
            </p>
            {pending.map(beleg => (
              <BelegCard
                key={beleg.id}
                beleg={beleg}
                projects={projects}
                stammdaten={stammdaten}
                expanded={expandedId === beleg.id}
                onToggle={() => setExpandedId(expandedId === beleg.id ? null : beleg.id)}
                onSave={() => handleSave(beleg)}
                onReject={() => handleReject(beleg.id)}
                onFieldChange={(f, v) => updateField(beleg.id, f, v)}
                saving={savingIds.has(beleg.id)}
              />
            ))}
          </div>
        )}

        {/* Abgeschlossen */}
        {done.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{done.length} abgeschlossen</p>
            {done.map(b => (
              <div key={b.id} className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                {b.status === "gespeichert"
                  ? <Check className="w-3.5 h-3.5 text-green-600" />
                  : <X className="w-3.5 h-3.5 text-red-500" />}
                <FileText className="w-3 h-3" />
                <span className={b.status === "abgelehnt" ? "line-through opacity-50" : ""}>{b.name}</span>
                <Badge className={`text-[10px] ml-auto ${STATUS_COLORS[b.status]}`}>
                  {b.status === "gespeichert" ? "Gebucht" : "Abgelehnt"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BelegCard({ beleg, projects, stammdaten, expanded, onToggle, onSave, onReject, onFieldChange, saving }) {
  const d = beleg.data || {};
  const projekt = projects.find(p => p.id === d.project_id);
  const isLoading = beleg.status === "ausstehend" || beleg.status === "erkennend";
  const konfidenz = d.konfidenz || 0;
  const konfidenzColor = konfidenz >= 80 ? "text-green-600" : konfidenz >= 50 ? "text-amber-600" : "text-red-500";

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{beleg.name}</p>
          {!isLoading && d.kreditor_name && (
            <p className="text-xs text-muted-foreground">{d.kreditor_name} · {d.betrag_brutto ? fmt(d.betrag_brutto) : "–"}</p>
          )}
        </div>
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            KI liest…
          </div>
        ) : (
          <>
            {konfidenz > 0 && (
              <span className={`text-xs font-semibold ${konfidenzColor}`}>{konfidenz}%</span>
            )}
            <Badge className={`text-[10px] ${STATUS_COLORS[beleg.status] || "bg-secondary"}`}>
              {beleg.status === "erkannt" ? "Erkannt" : beleg.status}
            </Badge>
          </>
        )}
        {!isLoading && (expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
      </div>

      {/* Body */}
      {expanded && !isLoading && d.kreditor_name && (
        <div className="p-4 space-y-4 border-t border-border">
          {/* Konfidenz-Hinweis */}
          {konfidenz < 70 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span><strong>Niedrige Konfidenz ({konfidenz}%):</strong> {d.konfidenz_begruendung || "Bitte Daten manuell prüfen."}</span>
            </div>
          )}
          {konfidenz >= 70 && d.konfidenz_begruendung && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{d.konfidenz_begruendung}</span>
            </div>
          )}

          {/* Felder */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <EditableField label="Kreditor" value={d.kreditor_name} onChange={v => onFieldChange("kreditor_name", v)} />
            <EditableField label="Rechnungsnummer" value={d.rechnungsnummer} onChange={v => onFieldChange("rechnungsnummer", v)} />
            <EditableField label="Rechnungsdatum" value={d.rechnungsdatum} onChange={v => onFieldChange("rechnungsdatum", v)} type="date" />
            <EditableField label="Fällig am" value={d.faellig_am} onChange={v => onFieldChange("faellig_am", v)} type="date" />
            <EditableField label="Betrag netto (€)" value={d.betrag_netto} onChange={v => onFieldChange("betrag_netto", parseFloat(v))} type="number" />
            <EditableField label="Betrag brutto (€)" value={d.betrag_brutto} onChange={v => onFieldChange("betrag_brutto", parseFloat(v))} type="number" />
            <EditableField label="Beschreibung / Leistung" value={d.beschreibung} onChange={v => onFieldChange("beschreibung", v)} />
            <div>
              <label className="text-muted-foreground font-medium block mb-1">Projekt <span className="text-[10px] opacity-60">(optional)</span></label>
              <select
                className="w-full border border-input rounded-md px-2 py-1.5 text-xs bg-background"
                value={d.project_id || ""}
                onChange={e => onFieldChange("project_id", e.target.value)}
              >
                <option value="">– kein Projekt (AGK) –</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>
          </div>

          {d.notes && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2 italic">"{d.notes}"</p>
          )}

          {/* Aktionen */}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="gap-1.5 flex-1"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Bestätigen & buchen
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onReject}>
              <X className="w-3.5 h-3.5" /> Ablehnen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditableField({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="text-muted-foreground font-medium block mb-1">{label}</label>
      <input
        type={type}
        className="w-full border border-input rounded-md px-2 py-1.5 text-xs bg-background"
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}