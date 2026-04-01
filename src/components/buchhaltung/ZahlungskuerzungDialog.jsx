import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

const fmt = (v) => v != null ? v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "–";
const fmtDate = (d) => { try { return d ? format(parseISO(d), "dd.MM.yyyy") : "–"; } catch { return "–"; } };

/**
 * Dialog für Zahlungskürzungen bei Debitoren (Ausgangsrechnungen)
 * 
 * Typisches Szenario im öffentlichen Bauwesen:
 * - Wir stellen Rechnung über 100.000 € aus
 * - AG prüft und zahlt nur 90.000 € (Mengenabweichung, Baugrundrisiko, etc.)
 * - Wir dokumentieren Rechnung: 100k, Zahlung: 90k, Kürzung: 10k (mit Grund)
 * - Status: Teilbezahlt mit Kürzungsgrund
 */
export function ZahlungskuerzungDialog({ rechnung, open, onClose, onSave }) {
  const today = new Date().toISOString().split("T")[0];
  const [zahlBetrag, setZahlBetrag] = useState(() => {
    const offen = (rechnung?.betrag_brutto || 0) - (rechnung?.zahlungseingang || 0) - (rechnung?.einbehalt || 0);
    return (Math.max(0, offen * 0.95)).toFixed(2); // Vorschlag: 95% (typisch für Bauwesen)
  });
  const [zahlDatum, setZahlDatum] = useState(today);
  const [kuerzungsGrund, setKuerzungsGrund] = useState("Prüfungskürzung AG");
  const [kuerzungBeschreibung, setKuerzungBeschreibung] = useState("");

  if (!rechnung) return null;

  const offen = (rechnung.betrag_brutto || 0) - (rechnung.zahlungseingang || 0) - (rechnung.einbehalt || 0);
  const zahlBetragNum = parseFloat(zahlBetrag) || 0;
  const kuerzeung = Math.max(0, offen - zahlBetragNum);
  const sollGesamt = rechnung.betrag_brutto || 0;
  const prozent = sollGesamt > 0 ? Math.round((zahlBetragNum / sollGesamt) * 10000) / 100 : 0;

  const handleSave = () => {
    // Zahlung erfassen
    const gezahlt = zahlBetragNum;
    const neuerZahlungseingang = (rechnung.zahlungseingang || 0) + gezahlt;
    const restOffen = (rechnung.betrag_brutto || 0) - neuerZahlungseingang - (rechnung.einbehalt || 0);
    
    // Status bestimmen
    let neuerStatus = "teilbezahlt";
    if (restOffen <= 0.005) {
      neuerStatus = kuerzeung > 0.005 ? "teilbezahlt" : "bezahlt"; // Mit Kürzung = teilbezahlt (es ist ja nicht vollständig bezahlt)
    }

    const neueZahlungen = [...(rechnung.zahlungen || []), {
      datum: zahlDatum,
      betrag: gezahlt,
      typ: kuerzeung > 0.005 ? "kuerzeung" : "normal",
      notiz: kuerzeung > 0.005 
        ? `${kuerzungsGrund} · ${fmt(kuerzeung)}${kuerzungBeschreibung ? ": " + kuerzungBeschreibung : ""}`
        : "",
    }];

    onSave(rechnung.id, {
      zahlungseingang: neuerZahlungseingang,
      status: neuerStatus,
      zahlungen: neueZahlungen,
      // Optional: Kürzung als Feld speichern für Nachverfolgung
      ...(kuerzeung > 0.005 ? {
        kuerzung_betrag: (rechnung.kuerzung_betrag || 0) + kuerzeung,
        kuerzung_grund: kuerzungsGrund,
        kuerzung_notiz: kuerzungBeschreibung,
      } : {}),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Zahlungskürzung – {rechnung.rechnungsnummer}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Rechnungs-Übersicht */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-1 text-sm">
            <p><span className="text-muted-foreground">Debitor:</span> <strong>{rechnung.client || "–"}</strong></p>
            <p><span className="text-muted-foreground">Rechnungsbetrag:</span> {fmt(rechnung.betrag_brutto)}</p>
            <p><span className="text-muted-foreground">Bereits gezahlt:</span> {fmt(rechnung.zahlungseingang)}</p>
            <p><span className="text-muted-foreground">Noch offen:</span> <strong className="text-amber-600">{fmt(offen)}</strong></p>
          </div>

          {/* Warnung bei Kürzung */}
          {kuerzeung > 0.005 && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-amber-900">
                Kürzung erkannt: {fmt(kuerzeung)} ({(100 - prozent).toFixed(1)}%)
              </p>
              <p className="text-xs text-amber-700">
                Die AG zahlt nur {prozent.toFixed(1)}% der Rechnungssumme. Dies wird als Kürzung dokumentiert.
              </p>
            </div>
          )}

          {/* Zahlungsbetrag */}
          <div className="space-y-1.5">
            <Label>Zahlungsbetrag (€) *</Label>
            <Input
              type="number"
              step="0.01"
              value={zahlBetrag}
              onChange={(e) => setZahlBetrag(e.target.value)}
              className="font-medium"
            />
            {zahlBetragNum > offen + 0.005 && (
              <p className="text-xs text-red-600">Betrag überschreitet offenen Posten!</p>
            )}
          </div>

          {/* Zahlungsdatum */}
          <div className="space-y-1.5">
            <Label>Zahlungsdatum</Label>
            <Input type="date" value={zahlDatum} onChange={(e) => setZahlDatum(e.target.value)} />
          </div>

          {/* Kürzungsgrund (wenn Kürzung erkannt) */}
          {kuerzeung > 0.005 && (
            <>
              <div className="space-y-1.5">
                <Label className="text-amber-900">Kürzungsgrund *</Label>
                <select
                  value={kuerzungsGrund}
                  onChange={(e) => setKuerzungsGrund(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="Prüfungskürzung AG">Prüfungskürzung AG / Bauherr</option>
                  <option value="Prüfungskürzung Bauherrenvertretung">Prüfungskürzung Bauherrenvertretung</option>
                  <option value="Sicherheitseinbehalt">Sicherheitseinbehalt / Retentionsrecht</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-amber-900">Erklärung zur Kürzung</Label>
                <Textarea
                  placeholder="z. B. AG hat Menge in Position 5.1 von 500 m auf 425 m geprüft, daher Kürzung..."
                  value={kuerzungBeschreibung}
                  onChange={(e) => setKuerzungBeschreibung(e.target.value)}
                  className="resize-none h-20"
                />
              </div>
            </>
          )}

          {/* Dokumentationshinweis */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800 leading-relaxed">
              <strong>Dokumentation:</strong> Diese Zahlungskürzung wird vollständig dokumentiert. Sie können später jederzeit einsehen, warum welcher Betrag wie zustande kam.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={zahlBetragNum <= 0 || zahlBetragNum > offen + 0.005} className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Zahlung + Kürzung buchen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}