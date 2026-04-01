import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Lock, FileDown, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { exportSchlussrechnungPDF } from "./SchlussrechnungPdfExport";

const fmt = (n) => (n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtEur = (n) => (n || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export default function SchlussrechnungErfassung({ schlussrechnung, project, kalkulation, vorherigeAufmasse, stammdaten, onClose }) {
  const [positionen, setPositionen] = useState([]);
  const [datum, setDatum] = useState(schlussrechnung.datum || new Date().toISOString().split("T")[0]);
  const [abrechner, setAbrechner] = useState(schlussrechnung.abrechner || "");
  const [status, setStatus] = useState(schlussrechnung.status || "entwurf");
  const [rechnungsnummer, setRechnungsnummer] = useState(schlussrechnung.rechnungsnummer || "");
  const [nrLoading, setNrLoading] = useState(false);
  const [showNrConfirm, setShowNrConfirm] = useState(false);
  const [collapsedTitles, setCollapsedTitles] = useState({});

  const isFreigegeben = status === "freigegeben" || status === "abgerechnet" || status === "storniert";

  // Summe aller freigegebenen ARs
  const summeVorherigeARs = vorherigeAufmasse
    .filter(a => a.status === "freigegeben" || a.status === "abgerechnet")
    .reduce((s, a) => s + (a.betrag_netto || 0), 0);

  useEffect(() => {
    if (schlussrechnung?.positionen?.length) {
      setPositionen(schlussrechnung.positionen.map(p => ({
        ...p,
        aufmass_zeilen: p.aufmass_zeilen?.length ? p.aufmass_zeilen : [{ beschreibung: "", menge: 0 }],
      })));
    } else if (kalkulation?.positions) {
      // Initialisierung aus Kalkulation
      setPositionen(kalkulation.positions.map(p => ({
        oz: p.oz,
        short_text: p.short_text,
        einheit: p.einheit,
        ep: p.ep || 0,
        menge_lv: p.menge || 0,
        aufmass_zeilen: [{ beschreibung: "", menge: 0 }],
        menge_gesamt: 0,
        gp_gesamt: 0,
      })));
    }
  }, [schlussrechnung, kalkulation]);

  const saveMut = useMutation({
    mutationFn: (d) => base44.entities.Aufmass.update(schlussrechnung.id, d),
  });

  const updateZeile = (posIdx, zeileIdx, field, val) => {
    if (isFreigegeben) return;
    setPositionen(prev => prev.map((p, pi) => {
      if (pi !== posIdx) return p;
      const zeilen = p.aufmass_zeilen.map((z, zi) =>
        zi === zeileIdx ? { ...z, [field]: field === "menge" ? parseFloat(val) || 0 : val } : z
      );
      const menge_gesamt = zeilen.reduce((s, z) => s + (parseFloat(z.menge) || 0), 0);
      return { ...p, aufmass_zeilen: zeilen, menge_gesamt, gp_gesamt: menge_gesamt * (p.ep || 0) };
    }));
  };

  const addZeile = (posIdx) => {
    if (isFreigegeben) return;
    setPositionen(prev => prev.map((p, pi) =>
      pi === posIdx ? { ...p, aufmass_zeilen: [...(p.aufmass_zeilen || []), { beschreibung: "", menge: 0 }] } : p
    ));
  };

  const removeZeile = (posIdx, zeileIdx) => {
    if (isFreigegeben) return;
    setPositionen(prev => prev.map((p, pi) => {
      if (pi !== posIdx) return p;
      const zeilen = p.aufmass_zeilen.filter((_, zi) => zi !== zeileIdx);
      const menge_gesamt = zeilen.reduce((s, z) => s + (parseFloat(z.menge) || 0), 0);
      return { ...p, aufmass_zeilen: zeilen, menge_gesamt, gp_gesamt: menge_gesamt * (p.ep || 0) };
    }));
  };

  const betrag_gesamt_netto = positionen.reduce((s, p) => s + (p.gp_gesamt || 0), 0);
  const betrag_aktuell = betrag_gesamt_netto - summeVorherigeARs;

  const buildSaveData = (overrideStatus, overrideNr) => ({
    positionen,
    datum,
    abrechner,
    status: overrideStatus || status,
    rechnungsnummer: overrideNr || rechnungsnummer,
    betrag_netto: betrag_gesamt_netto,
    betrag_vorperioden: summeVorherigeARs,
    betrag_aktuell,
  });

  const handleFreigeben = async () => {
    setNrLoading(true);
    let nr = rechnungsnummer;
    if (!nr) {
      const res = await base44.functions.invoke("generateRechnungNummer", {});
      nr = res.data?.rechnungNummer || "";
      setRechnungsnummer(nr);
    }
    setNrLoading(false);
    setShowNrConfirm(true);
  };

  const confirmFreigeben = async () => {
    setShowNrConfirm(false);
    await saveMut.mutateAsync(buildSaveData("freigegeben", rechnungsnummer));
    setStatus("freigegeben");

    await base44.entities.Rechnung.create({
      project_id: schlussrechnung.project_id,
      kalkulation_id: schlussrechnung.kalkulation_id,
      rechnungsnummer,
      rechnungsart: "schlussrechnung",
      rechnungsdatum: datum,
      faellig_am: new Date(new Date(datum).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      positionen: positionen.map(p => ({
        oz: p.oz, short_text: p.short_text, einheit: p.einheit, ep: p.ep || 0,
        menge_kalk: p.menge_lv || 0, menge_aktuell: p.menge_gesamt || 0, gp_aktuell: p.gp_gesamt || 0,
      })),
      betrag_netto: betrag_aktuell,
      mwst_satz: 19,
      betrag_brutto: betrag_aktuell * 1.19,
      status: "gestellt",
      notes: `Schlussrechnung. Gesamtleistung: ${fmtEur(betrag_gesamt_netto)}, Abzug ARs: ${fmtEur(summeVorherigeARs)}`,
    });
  };

  const handlePdfExport = () => {
    exportSchlussrechnungPDF({
      schlussrechnung: { ...schlussrechnung, positionen, betrag_netto: betrag_gesamt_netto, betrag_vorperioden: summeVorherigeARs, betrag_aktuell, rechnungsnummer, datum },
      project,
      stammdaten,
      vorherigeAufmasse,
    });
  };

  // Gruppenstruktur aufbauen
  const mainGroups = [];
  let currentMain = null;
  let currentSub = null;
  positionen.forEach((pos, pi) => {
    const ozParts = (pos.oz || "").split(".");
    if (ozParts.length === 1) {
      currentMain = { title: pos.short_text, oz: pos.oz, subGroups: [] };
      mainGroups.push(currentMain);
      currentSub = null;
    } else if (ozParts.length === 2) {
      if (!currentMain) { currentMain = { title: "", oz: "", subGroups: [] }; mainGroups.push(currentMain); }
      currentSub = { title: pos.short_text, oz: pos.oz, positions: [] };
      currentMain.subGroups.push(currentSub);
    } else {
      if (!currentMain) { currentMain = { title: "Allgemein", oz: "", subGroups: [] }; mainGroups.push(currentMain); }
      if (!currentSub) { currentSub = { title: "Allgemein", oz: "", positions: [] }; currentMain.subGroups.push(currentSub); }
      currentSub.positions.push({ ...pos, _pi: pi });
    }
  });

  return (
    <div className="space-y-6">
      <AlertDialog open={showNrConfirm} onOpenChange={setShowNrConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schlussrechnung freigeben?</AlertDialogTitle>
            <AlertDialogDescription>
              Rechnungsnummer <strong className="text-foreground">{rechnungsnummer}</strong> wird vergeben (GoBD-konform, unveränderlich). Gesamtleistung: <strong>{fmtEur(betrag_gesamt_netto)}</strong>, abzüglich ARs: <strong>{fmtEur(summeVorherigeARs)}</strong>, verbleibend: <strong>{fmtEur(betrag_aktuell)}</strong>. Fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmFreigeben}>Ja, Schlussrechnung stellen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onClose}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold">Schlussrechnung</h2>
            <Badge className={
              status === "freigegeben" ? "bg-green-100 text-green-700" :
              status === "storniert" ? "bg-red-100 text-red-700" :
              "bg-secondary text-secondary-foreground"
            }>
              {status === "freigegeben" ? "Freigegeben" : status === "storniert" ? "Storniert" : "Entwurf"}
            </Badge>
            {rechnungsnummer && (
              <span className="flex items-center gap-1 text-xs font-mono bg-muted px-2 py-0.5 rounded border">
                <Lock className="w-3 h-3 text-muted-foreground" /> {rechnungsnummer}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{project.project_name} · {project.project_number}</p>
        </div>
        <div className="flex gap-2">
          {!isFreigegeben && (
            <Button variant="outline" size="sm" onClick={() => saveMut.mutate(buildSaveData())} disabled={saveMut.isPending}>
              <Save className="w-4 h-4 mr-1" /> Speichern
            </Button>
          )}
          {status === "entwurf" && (
            <Button size="sm" onClick={handleFreigeben} disabled={saveMut.isPending || nrLoading}>
              {nrLoading ? "Nummer wird gezogen…" : "Freigeben & Rechnungsnr. vergeben"}
            </Button>
          )}
          {status === "freigegeben" && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePdfExport}>
              <FileDown className="w-4 h-4" /> PDF
            </Button>
          )}
        </div>
      </div>

      {isFreigegeben && (
        <div className="flex items-start gap-2 text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-800">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Diese Schlussrechnung ist freigegeben und GoBD-konform gespeichert.</span>
        </div>
      )}

      {/* Metadaten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Datum</label>
          <Input type="date" value={datum} onChange={e => setDatum(e.target.value)} className="text-sm h-8" disabled={isFreigegeben} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Abrechner</label>
          <Input value={abrechner} onChange={e => setAbrechner(e.target.value)} placeholder="Name..." className="text-sm h-8" disabled={isFreigegeben} />
        </div>
        <div className="sm:col-span-2 grid grid-cols-3 gap-2">
          <div className="bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground">Gesamtleistung</p>
            <p className="font-bold text-sm">{fmtEur(betrag_gesamt_netto)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground">Abzug ARs</p>
            <p className="font-semibold text-sm text-muted-foreground">- {fmtEur(summeVorherigeARs)}</p>
          </div>
          <div className="bg-primary/10 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground">Restbetrag netto</p>
            <p className="font-bold text-primary text-sm">{fmtEur(betrag_aktuell)}</p>
          </div>
        </div>
      </div>

      {/* Hinweis vorherige ARs */}
      {vorherigeAufmasse.filter(a => a.status === "freigegeben" || a.status === "abgerechnet").length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-blue-800 mb-1.5">Berücksichtigte Abschlagsrechnungen (werden abgezogen):</p>
            <div className="space-y-1">
              {vorherigeAufmasse.filter(a => a.status === "freigegeben" || a.status === "abgerechnet").map(a => (
                <div key={a.id} className="flex items-center justify-between text-xs text-blue-700">
                  <span>{a.bezeichnung} · {a.rechnungsnummer}</span>
                  <span className="font-semibold">{fmtEur(a.betrag_netto)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Positionstabelle */}
      <div className="space-y-4">
        {mainGroups.map((main, mi) => {
          const mainKey = `m${mi}`;
          const isMainCollapsed = collapsedTitles[mainKey];
          const mainSum = main.subGroups.flatMap(s => s.positions).reduce((s, p) => s + (p.gp_gesamt || 0), 0);
          return (
            <div key={mi} className="border border-border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/15 text-left transition-colors"
                onClick={() => setCollapsedTitles(prev => ({ ...prev, [mainKey]: !prev[mainKey] }))}
              >
                {isMainCollapsed ? <ChevronRight className="w-4 h-4 shrink-0 text-primary" /> : <ChevronDown className="w-4 h-4 shrink-0 text-primary" />}
                <span className="font-mono text-xs font-bold text-primary w-8 shrink-0">{main.oz}</span>
                <span className="text-sm font-bold text-foreground uppercase flex-1">{main.title}</span>
                <span className="text-sm font-bold text-primary">{fmtEur(mainSum)}</span>
              </button>

              {!isMainCollapsed && main.subGroups.map((sub, si) => {
                const subKey = `m${mi}_s${si}`;
                const isSubCollapsed = collapsedTitles[subKey];
                const subSum = sub.positions.reduce((s, p) => s + (p.gp_gesamt || 0), 0);
                return (
                  <div key={si} className="border-t border-border">
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2 bg-muted/40 hover:bg-muted/60 text-left transition-colors"
                      onClick={() => setCollapsedTitles(prev => ({ ...prev, [subKey]: !prev[subKey] }))}
                    >
                      {isSubCollapsed ? <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                      <span className="font-mono text-xs font-semibold text-primary w-10 shrink-0">{sub.oz}</span>
                      <span className="text-xs font-semibold text-foreground flex-1">{sub.title}</span>
                      <span className="text-xs font-semibold text-primary">{fmtEur(subSum)}</span>
                    </button>

                    {!isSubCollapsed && sub.positions.map((pos) => {
                      const pi = pos._pi;
                      return (
                        <Card key={pi} className="overflow-hidden rounded-none border-0 border-t border-border/50">
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
                                {(pos.aufmass_zeilen || []).map((z, zi) => (
                                  <tr key={zi} className={`border-b border-border/40 ${!isFreigegeben ? "hover:bg-accent/10" : "bg-muted/5"}`}>
                                    <td className="px-4 py-1">
                                      <Input value={z.beschreibung} onChange={e => updateZeile(pi, zi, "beschreibung", e.target.value)}
                                        placeholder="z.B. 179,07m + 53,76m..." disabled={isFreigegeben}
                                        className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-0 px-0" />
                                    </td>
                                    <td className="px-4 py-1">
                                      <Input type="number" value={z.menge || ""} onChange={e => updateZeile(pi, zi, "menge", e.target.value)}
                                        disabled={isFreigegeben} className="h-7 text-xs text-right w-20 ml-auto" />
                                    </td>
                                    <td className="px-4 py-1.5 text-muted-foreground">{pos.einheit}</td>
                                    <td className="px-2 py-1">
                                      {!isFreigegeben && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeZeile(pi, zi)}>
                                          <AlertTriangle className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-muted/20 border-t border-border">
                                  <td className="px-4 py-1.5">
                                    {!isFreigegeben && (
                                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground hover:text-primary" onClick={() => addZeile(pi)}>
                                        + Zeile
                                      </Button>
                                    )}
                                  </td>
                                  <td className="px-4 py-1.5 text-right">
                                    <span className="font-semibold">{fmt(pos.menge_gesamt)}</span>
                                    <span className="text-muted-foreground ml-1">{pos.einheit}</span>
                                  </td>
                                  <td className="px-4 py-1.5 text-muted-foreground">{pos.einheit}</td>
                                  <td className="px-4 py-1.5 text-right font-semibold text-primary">{fmtEur(pos.gp_gesamt)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Summenblock */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gesamtleistung netto</span>
            <span className="font-semibold">{fmtEur(betrag_gesamt_netto)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Abzug geleistete Abschlagsrechnungen</span>
            <span className="font-semibold text-muted-foreground">- {fmtEur(summeVorherigeARs)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <span className="font-bold">Restbetrag Schlussrechnung netto</span>
            <span className="font-bold text-primary text-base">{fmtEur(betrag_aktuell)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>19,00 % MwSt.</span>
            <span>{fmtEur(betrag_aktuell * 0.19)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <span className="font-bold">Brutto</span>
            <span className="font-bold text-lg">{fmtEur(betrag_aktuell * 1.19)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}