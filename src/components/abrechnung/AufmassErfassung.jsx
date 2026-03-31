import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Save, FileText, Calculator, Lock } from "lucide-react";
import { format } from "date-fns";

const fmt = (n) => (n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtEur = (n) => (n || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export default function AufmassErfassung({ aufmass, project, vorherigeAufmasse, onClose }) {
  const [positionen, setPositionen] = useState([]);
  const [datum, setDatum] = useState(aufmass.datum || "");
  const [abrechner, setAbrechner] = useState(aufmass.abrechner || "");
  const [status, setStatus] = useState(aufmass.status || "entwurf");

  useEffect(() => {
    if (aufmass?.positionen) {
      // Vorperioden aus früheren Aufmaßen berechnen
      const posMap = {};
      for (const prev of vorherigeAufmasse) {
        for (const pp of (prev.positionen || [])) {
          if (!posMap[pp.oz]) posMap[pp.oz] = 0;
          posMap[pp.oz] += (pp.menge_aktuell || 0);
        }
      }

      setPositionen(aufmass.positionen.map(p => ({
        ...p,
        menge_vorperioden: posMap[p.oz] || 0,
        aufmass_zeilen: p.aufmass_zeilen?.length ? p.aufmass_zeilen : [{ beschreibung: "", menge: 0 }],
      })));
    }
  }, [aufmass, vorherigeAufmasse]);

  const saveMut = useMutation({
    mutationFn: (d) => base44.entities.Aufmass.update(aufmass.id, d),
  });

  // Aktuell-Summe aus Aufmaßzeilen berechnen
  const calcMengeAktuell = (zeilen) =>
    (zeilen || []).reduce((s, z) => s + (parseFloat(z.menge) || 0), 0);

  const updateZeile = (posIdx, zeileIdx, field, val) => {
    setPositionen(prev => prev.map((p, pi) => {
      if (pi !== posIdx) return p;
      const zeilen = p.aufmass_zeilen.map((z, zi) =>
        zi === zeileIdx ? { ...z, [field]: field === "menge" ? parseFloat(val) || 0 : val } : z
      );
      const menge_aktuell = calcMengeAktuell(zeilen);
      const menge_kumuliert = (p.menge_vorperioden || 0) + menge_aktuell;
      return {
        ...p,
        aufmass_zeilen: zeilen,
        menge_aktuell,
        menge_kumuliert,
        gp_aktuell: menge_aktuell * (p.ep || 0),
        gp_kumuliert: menge_kumuliert * (p.ep || 0),
      };
    }));
  };

  const addZeile = (posIdx) => {
    setPositionen(prev => prev.map((p, pi) =>
      pi === posIdx
        ? { ...p, aufmass_zeilen: [...(p.aufmass_zeilen || []), { beschreibung: "", menge: 0 }] }
        : p
    ));
  };

  const removeZeile = (posIdx, zeileIdx) => {
    setPositionen(prev => prev.map((p, pi) => {
      if (pi !== posIdx) return p;
      const zeilen = p.aufmass_zeilen.filter((_, zi) => zi !== zeileIdx);
      const menge_aktuell = calcMengeAktuell(zeilen);
      const menge_kumuliert = (p.menge_vorperioden || 0) + menge_aktuell;
      return {
        ...p,
        aufmass_zeilen: zeilen,
        menge_aktuell,
        menge_kumuliert,
        gp_aktuell: menge_aktuell * (p.ep || 0),
        gp_kumuliert: menge_kumuliert * (p.ep || 0),
      };
    }));
  };

  const betrag_aktuell = positionen.reduce((s, p) => s + (p.gp_aktuell || 0), 0);
  const betrag_vorperioden = positionen.reduce((s, p) => s + ((p.menge_vorperioden || 0) * (p.ep || 0)), 0);
  const betrag_netto = betrag_vorperioden + betrag_aktuell;

  const handleSave = async (newStatus) => {
    const data = {
      positionen,
      datum,
      abrechner,
      status: newStatus || status,
      betrag_aktuell,
      betrag_vorperioden,
      betrag_netto,
    };
    await saveMut.mutateAsync(data);
    onClose();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onClose}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{aufmass.bezeichnung}</h2>
            <Badge className={status === "abgerechnet" ? "bg-green-100 text-green-700" : status === "freigegeben" ? "bg-blue-100 text-blue-700" : "bg-secondary text-secondary-foreground"}>
              {status === "abgerechnet" ? "Abgerechnet" : status === "freigegeben" ? "Freigegeben" : "Entwurf"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{project.project_name} · {project.project_number}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave()} disabled={saveMut.isPending}>
            <Save className="w-4 h-4 mr-1" /> Speichern
          </Button>
          {status === "entwurf" && (
            <Button size="sm" onClick={() => handleSave("freigegeben")} disabled={saveMut.isPending}>
              Freigeben & Rechnung erstellen
            </Button>
          )}
        </div>
      </div>

      {/* Metadaten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Datum</label>
          <Input type="date" value={datum} onChange={e => setDatum(e.target.value)} className="text-sm h-8" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Abrechner</label>
          <Input value={abrechner} onChange={e => setAbrechner(e.target.value)} placeholder="Name..." className="text-sm h-8" />
        </div>
        <div className="sm:col-span-2 flex items-end gap-4">
          <div className="flex-1 bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground">Diese Periode</p>
            <p className="font-bold text-primary text-sm">{fmtEur(betrag_aktuell)}</p>
          </div>
          <div className="flex-1 bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground">Kumuliert (inkl. Vorperioden)</p>
            <p className="font-bold text-sm">{fmtEur(betrag_netto)}</p>
          </div>
        </div>
      </div>

      {/* Positionstabelle */}
      <div className="space-y-3">
        {positionen.map((pos, pi) => (
          <Card key={pi} className="overflow-hidden">
            <CardHeader className="py-2 px-4 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-primary w-16 shrink-0">{pos.oz}</span>
                <span className="text-sm font-medium flex-1 truncate">{pos.short_text}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3" /> EP: <strong className="text-foreground">{fmt(pos.ep)} €/{pos.einheit}</strong>
                  </span>
                  <span>LV: {fmt(pos.menge_lv)} {pos.einheit}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/10">
                    <th className="text-left px-4 py-1.5 font-medium text-muted-foreground">Beschreibung / Formel</th>
                    <th className="text-right px-4 py-1.5 font-medium text-muted-foreground w-24">Menge</th>
                    <th className="text-left px-4 py-1.5 font-medium text-muted-foreground w-10">{pos.einheit}</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {/* Vorperioden-Zeile (read-only) */}
                  {pos.menge_vorperioden > 0 && (
                    <tr className="border-b border-border/40 bg-muted/20">
                      <td className="px-4 py-1.5 text-muted-foreground italic">Vorperioden (kumuliert)</td>
                      <td className="px-4 py-1.5 text-right font-medium text-muted-foreground">{fmt(pos.menge_vorperioden)}</td>
                      <td className="px-4 py-1.5 text-muted-foreground">{pos.einheit}</td>
                      <td />
                    </tr>
                  )}
                  {/* Aufmaßzeilen */}
                  {(pos.aufmass_zeilen || []).map((z, zi) => (
                    <tr key={zi} className="border-b border-border/40 hover:bg-accent/10">
                      <td className="px-4 py-1">
                        <Input
                          value={z.beschreibung}
                          onChange={e => updateZeile(pi, zi, "beschreibung", e.target.value)}
                          placeholder="z.B. 179,07m + 53,76m oder Bauteil A..."
                          className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
                        />
                      </td>
                      <td className="px-4 py-1">
                        <Input
                          type="number"
                          value={z.menge || ""}
                          onChange={e => updateZeile(pi, zi, "menge", e.target.value)}
                          className="h-7 text-xs text-right w-20 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-1.5 text-muted-foreground">{pos.einheit}</td>
                      <td className="px-2 py-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeZeile(pi, zi)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20 border-t border-border">
                    <td className="px-4 py-1.5">
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground hover:text-primary" onClick={() => addZeile(pi)}>
                        <Plus className="w-3 h-3" /> Zeile
                      </Button>
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <span className="font-semibold">{fmt(pos.menge_aktuell)}</span>
                      <span className="text-muted-foreground ml-1">| kum: {fmt(pos.menge_kumuliert)}</span>
                    </td>
                    <td className="px-4 py-1.5 text-muted-foreground">{pos.einheit}</td>
                    <td className="px-4 py-1.5 text-right font-semibold text-primary">
                      {fmtEur(pos.gp_kumuliert)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summe */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Vorperioden gesamt</p>
              <p className="font-semibold">{fmtEur(betrag_vorperioden)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Diese Periode</p>
              <p className="font-semibold text-primary">{fmtEur(betrag_aktuell)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kumuliert netto</p>
              <p className="font-bold text-lg">{fmtEur(betrag_netto)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}