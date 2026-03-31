import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isAfter } from "date-fns";
import { CheckCircle2, Percent, AlertTriangle } from "lucide-react";

const fmt = (v) => v != null ? v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "–";
const fmtDate = (d) => { try { return d ? format(parseISO(d), "dd.MM.yyyy") : "–"; } catch { return "–"; } };

/**
 * Dialog zum Buchen einer einzelnen Zahlung (mit optionalem Skonto)
 */
export function EinzelZahlungDialog({ rechnung, open, onClose, onSave }) {
  const offen = (rechnung?.betrag_brutto || 0) - (rechnung?.zahlungsausgang || 0) - (rechnung?.einbehalt || 0);
  const today = new Date().toISOString().split("T")[0];

  const skontoMoeglich = rechnung?.skonto_prozent > 0 && rechnung?.skonto_frist &&
    isAfter(parseISO(rechnung.skonto_frist), new Date());
  const skontoBetrag = skontoMoeglich ? Math.round(offen * (rechnung.skonto_prozent / 100) * 100) / 100 : 0;
  const zahlbetragMitSkonto = Math.max(0, offen - skontoBetrag);

  const [mitSkonto, setMitSkonto] = useState(skontoMoeglich);
  const [betrag, setBetrag] = useState(() => (skontoMoeglich ? zahlbetragMitSkonto : offen).toFixed(2));
  const [datum, setDatum] = useState(today);
  const [notiz, setNotiz] = useState("");

  if (!rechnung) return null;

  const handleSkontoToggle = (checked) => {
    setMitSkonto(checked);
    setBetrag(checked ? zahlbetragMitSkonto.toFixed(2) : offen.toFixed(2));
  };

  const handleSave = () => {
    const gezahlt = parseFloat(betrag) || 0;
    const neuerZahlungsausgang = (rechnung.zahlungsausgang || 0) + gezahlt;
    const neuerOffen = (rechnung.betrag_brutto || 0) - neuerZahlungsausgang - (rechnung.einbehalt || 0);
    const neuerStatus = neuerOffen <= 0.005 ? "bezahlt" : "teilbezahlt";

    const neueZahlungen = [...(rechnung.zahlungen || []), {
      datum,
      betrag: gezahlt,
      typ: mitSkonto ? "skonto" : "normal",
      notiz: mitSkonto ? `Skonto ${rechnung.skonto_prozent}% = ${fmt(skontoBetrag)}${notiz ? " · " + notiz : ""}` : notiz,
    }];

    onSave(rechnung.id, {
      zahlungsausgang: neuerZahlungsausgang,
      status: neuerStatus,
      zahlungen: neueZahlungen,
      ...(mitSkonto ? { skonto_betrag: (rechnung.skonto_betrag || 0) + skontoBetrag } : {}),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Zahlung buchen – {rechnung.rechnungsnummer}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/40 rounded-lg p-3 space-y-1 text-sm">
            <p><span className="text-muted-foreground">Kreditor:</span> <strong>{rechnung.kreditor_name}</strong></p>
            <p><span className="text-muted-foreground">Rechnungsbetrag:</span> {fmt(rechnung.betrag_brutto)}</p>
            <p><span className="text-muted-foreground">Bereits gezahlt:</span> {fmt(rechnung.zahlungsausgang)}</p>
            <p><span className="text-muted-foreground">Noch offen:</span> <strong className="text-amber-600">{fmt(offen)}</strong></p>
          </div>

          {skontoMoeglich && (
            <div className="border border-green-200 bg-green-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Skonto verfügbar: {rechnung.skonto_prozent}% bis {fmtDate(rechnung.skonto_frist)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  id="skonto-check"
                  checked={mitSkonto}
                  onChange={e => handleSkontoToggle(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="skonto-check" className="cursor-pointer text-green-700">
                  Mit Skonto bezahlen → Ersparnis <strong>{fmt(skontoBetrag)}</strong>, Zahlung: <strong>{fmt(zahlbetragMitSkonto)}</strong>
                </label>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Zahlungsbetrag (€)</Label>
            <Input
              type="number" step="0.01"
              value={betrag}
              onChange={e => setBetrag(e.target.value)}
              className={parseFloat(betrag) > offen + 0.005 ? "border-red-400 focus-visible:ring-red-400" : ""}
            />
            {parseFloat(betrag) > offen + 0.005 && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Betrag überschreitet den offenen Posten um {fmt(parseFloat(betrag) - offen)} – bitte korrigieren.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Zahlungsdatum</Label>
            <Input type="date" value={datum} onChange={e => setDatum(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notiz (optional)</Label>
            <Input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="z. B. Überweisung via Online-Banking" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={parseFloat(betrag) > offen + 0.005 || (parseFloat(betrag) || 0) <= 0} className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Zahlung buchen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A-Konto-Dialog: Einen Betrag auf alle offenen Rechnungen eines Kreditors verteilen
 */
export function AKontoDialog({ kreditorName, offeneRechnungen, open, onClose, onSave }) {
  const [betrag, setBetrag] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [notiz, setNotiz] = useState("");

  if (!open) return null;

  const gesamtOffen = offeneRechnungen.reduce((s, r) => {
    return s + Math.max(0, (r.betrag_brutto || 0) - (r.zahlungsausgang || 0) - (r.einbehalt || 0));
  }, 0);

  const eingabe = parseFloat(betrag) || 0;

  // Verteilung: älteste Rechnung zuerst, dann weitere
  const sortiert = [...offeneRechnungen].sort((a, b) =>
    (a.rechnungsdatum || "").localeCompare(b.rechnungsdatum || "")
  );

  let verbleibend = eingabe;
  const verteilung = sortiert.map(r => {
    const offen = Math.max(0, (r.betrag_brutto || 0) - (r.zahlungsausgang || 0) - (r.einbehalt || 0));
    const zahlung = Math.min(offen, verbleibend);
    verbleibend = Math.max(0, verbleibend - zahlung);
    return { rechnung: r, offen, zahlung };
  });

  const handleSave = () => {
    const updates = verteilung
      .filter(v => v.zahlung > 0)
      .map(v => {
        const neuerZahlungsausgang = (v.rechnung.zahlungsausgang || 0) + v.zahlung;
        const neuerOffen = (v.rechnung.betrag_brutto || 0) - neuerZahlungsausgang - (v.rechnung.einbehalt || 0);
        const neuerStatus = neuerOffen <= 0.005 ? "bezahlt" : "teilbezahlt";
        const neueZahlungen = [...(v.rechnung.zahlungen || []), {
          datum, betrag: v.zahlung, typ: "akonto",
          notiz: `A-Konto-Zahlung${notiz ? " · " + notiz : ""}`,
        }];
        return {
          id: v.rechnung.id,
          data: { zahlungsausgang: neuerZahlungsausgang, status: neuerStatus, zahlungen: neueZahlungen },
        };
      });
    onSave(updates);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>A-Konto-Zahlung – {kreditorName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">Offene Rechnungen:</span> <strong>{offeneRechnungen.length}</strong></p>
            <p><span className="text-muted-foreground">Gesamtbetrag offen:</span> <strong className="text-amber-600">{fmt(gesamtOffen)}</strong></p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Zahlungsbetrag (€) *</Label>
              <Input type="number" step="0.01" value={betrag} onChange={e => setBetrag(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Datum</Label>
              <Input type="date" value={datum} onChange={e => setDatum(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notiz (optional)</Label>
            <Input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="z. B. Sammelüberweisung März" />
          </div>

          {eingabe > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Verteilung auf Rechnungen (älteste zuerst):</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {verteilung.map(v => (
                  <div key={v.rechnung.id} className="flex items-center justify-between text-xs border rounded px-3 py-2">
                    <div>
                      <span className="font-medium">{v.rechnung.rechnungsnummer}</span>
                      <span className="text-muted-foreground ml-2">offen: {fmt(v.offen)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={v.zahlung > 0 ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                        {v.zahlung > 0 ? `– ${fmt(v.zahlung)}` : "nicht berührt"}
                      </span>
                      {v.zahlung >= v.offen && v.offen > 0 && (
                        <Badge className="text-[9px] bg-green-100 text-green-700">bezahlt</Badge>
                      )}
                      {v.zahlung > 0 && v.zahlung < v.offen && (
                        <Badge className="text-[9px] bg-amber-100 text-amber-700">teilbez.</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {verbleibend > 0.005 && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Betrag überschreitet den Gesamtbetrag aller offenen Rechnungen um {fmt(verbleibend)} – Zahlung nicht möglich.
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={eingabe <= 0 || verbleibend > 0.005} className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> A-Konto buchen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}