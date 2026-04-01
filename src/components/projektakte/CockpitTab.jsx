import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Euro, Clock, FileText, AlertTriangle, TrendingUp, Mail, Hammer, Receipt, AlertCircle } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";

function ProgressRing({ percent, color = "#3b82f6", size = 80 }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = ((percent || 0) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 40 40)" />
      <text x="40" y="44" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor">
        {Math.round(percent || 0)}%
      </text>
    </svg>
  );
}

function StatCard({ title, value, sub, icon: Icon, accent }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent || "bg-primary/10"}`}>
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-base font-bold mt-0.5 truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CockpitTab({ project, rechnungen, fristen, schriftverkehr, dokumente, stundenstand }) {
  const auftragssumme = project.auftragssumme_netto || project.auftragssumme || 0;
  const abgerechnet = rechnungen.filter(r => ["gestellt","teilbezahlt","bezahlt"].includes(r.status) && !r.rechnungsnummer?.startsWith("STORNO"))
    .reduce((s, r) => s + (r.betrag_netto || 0), 0);
  const eingegangen = rechnungen.filter(r => ["teilbezahlt","bezahlt"].includes(r.status))
    .reduce((s, r) => s + (r.zahlungseingang || 0), 0);
  const ausstehendeZahlungen = abgerechnet * 1.19 - eingegangen; // brutto ausstehend
  const offen = Math.max(0, auftragssumme - abgerechnet);
  const finanzFortschritt = auftragssumme > 0 ? Math.min(100, (abgerechnet / auftragssumme) * 100) : 0;

  const naechsteFrist = fristen
    .filter(f => f.status !== "erledigt" && f.datum)
    .sort((a, b) => a.datum.localeCompare(b.datum))[0];

  const letzteKomm = [...schriftverkehr]
    .filter(s => s.wichtig)
    .sort((a, b) => (b.datum || "").localeCompare(a.datum || ""))[0]
    || [...schriftverkehr].sort((a, b) => (b.datum || "").localeCompare(a.datum || ""))[0];

  const gebucht = stundenstand?.gebuchte_stunden_gesamt || 0;
  const kalkStunden = project.kalkulierte_stunden_manuell || 0;
  const stundenProzent = kalkStunden > 0 ? Math.min(100, (gebucht / kalkStunden) * 100) : 0;
  const stundenFarbe = stundenProzent > 90 ? "#ef4444" : stundenProzent > 70 ? "#f59e0b" : "#22c55e";
  const stundenKostenSatz = 55; // Annahme €/h – kann später aus Stammdaten kommen
  const stundenKosten = gebucht * stundenKostenSatz;

  const anzahlRechnungen = rechnungen.filter(r => !r.rechnungsnummer?.startsWith("STORNO")).length;
  const anzahlStorniert = rechnungen.filter(r => r.rechnungsnummer?.startsWith("STORNO")).length;

  const fmt = (n) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  return (
    <div className="space-y-6">
      {/* KPI Row – 4 nützliche Werte */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Abgerechnet (netto)"
          value={abgerechnet ? fmt(abgerechnet) : "–"}
          sub={auftragssumme ? `von ${fmt(auftragssumme)} · ${Math.round(finanzFortschritt)}%` : "Keine Auftragssumme"}
          icon={Receipt}
        />
        <StatCard
          title="Noch nicht abgerechnet"
          value={auftragssumme ? fmt(offen) : "–"}
          sub={auftragssumme ? `verbleibendes Potential` : undefined}
          icon={Euro}
          accent="bg-amber-50"
        />
        <StatCard
          title="Ausstehende Zahlungen"
          value={ausstehendeZahlungen > 0.01 ? fmt(ausstehendeZahlungen) : "–"}
          sub={ausstehendeZahlungen > 0.01 ? "Gestellte Rechnungen, noch nicht bezahlt" : "Alles beglichen"}
          icon={AlertCircle}
          accent={ausstehendeZahlungen > 0.01 ? "bg-red-50" : "bg-green-50"}
        />
        <StatCard
          title="Dokumente"
          value={dokumente.length}
          sub={`${dokumente.filter(d=>d.wichtig).length} wichtig · ${anzahlRechnungen} Rechnungen${anzahlStorniert > 0 ? ` · ${anzahlStorniert} storniert` : ""}`}
          icon={FileText}
        />
      </div>

      {/* Fortschritt + Stunden */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Abrechnungsfortschritt</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            <ProgressRing percent={finanzFortschritt} color="#3b82f6" />
            <div>
              <p className="text-sm font-semibold">{fmt(abgerechnet)} abgerechnet</p>
              <p className="text-xs text-muted-foreground mt-0.5">von {auftragssumme ? fmt(auftragssumme) : "–"} Auftragssumme</p>
              <p className="text-xs text-muted-foreground">{fmt(offen)} noch offen</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Stunden</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            <ProgressRing percent={stundenProzent} color={stundenFarbe} />
            <div>
              <p className="text-sm font-semibold">{gebucht} h gebucht</p>
              <p className="text-xs text-muted-foreground">{kalkStunden > 0 ? `von ${kalkStunden} h kalkuliert` : "Keine kalk. Stunden hinterlegt"}</p>
              {stundenstand?.import_datum && (
                <p className="text-xs text-muted-foreground mt-1">Stand: {format(parseISO(stundenstand.import_datum), "dd.MM.yyyy")}</p>
              )}
              {stundenProzent > 90 && <p className="text-xs text-red-600 font-medium mt-1">⚠ Stunden fast ausgeschöpft</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Nächste Frist + letzte Komm */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Nächste offene Frist</CardTitle>
          </CardHeader>
          <CardContent>
            {naechsteFrist ? (
              <div>
                <p className="font-medium text-sm">{naechsteFrist.titel}</p>
                <p className="text-xs text-muted-foreground mt-1">{naechsteFrist.typ?.replace(/_/g," ")}</p>
                <div className="mt-2">
                  {naechsteFrist.datum && isPast(parseISO(naechsteFrist.datum)) ? (
                    <Badge className="bg-red-100 text-red-700 text-xs">
                      Überfällig: {format(parseISO(naechsteFrist.datum), "dd.MM.yyyy")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {naechsteFrist.datum ? format(parseISO(naechsteFrist.datum), "dd.MM.yyyy") : "–"}
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine offenen Fristen</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Mail className="w-4 h-4" />Letzte Kommunikation</CardTitle>
          </CardHeader>
          <CardContent>
            {letzteKomm ? (
              <div>
                <p className="font-medium text-sm truncate">{letzteKomm.betreff}</p>
                <p className="text-xs text-muted-foreground mt-1">{letzteKomm.absender || letzteKomm.empfaenger}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{letzteKomm.datum ? format(parseISO(letzteKomm.datum), "dd.MM.yyyy") : ""}</p>
                {letzteKomm.wichtig && <Badge className="mt-1 bg-amber-100 text-amber-700 text-xs">Wichtig</Badge>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Kein Schriftverkehr vorhanden</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* offene Fristen + Aufgaben Zähler */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Offene Fristen</p>
              <p className="text-xl font-bold">{fristen.filter(f=>f.status!=="erledigt").length}</p>
              {fristen.filter(f=>f.status!=="erledigt" && f.datum && isPast(parseISO(f.datum))).length > 0 && (
                <p className="text-xs text-red-600 font-medium">
                  {fristen.filter(f=>f.status!=="erledigt" && f.datum && isPast(parseISO(f.datum))).length} überfällig
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Schriftverkehr</p>
              <p className="text-xl font-bold">{schriftverkehr.length}</p>
              <p className="text-xs text-muted-foreground">{schriftverkehr.filter(s=>s.status!=="erledigt").length} offen</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}