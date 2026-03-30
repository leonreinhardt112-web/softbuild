import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HardHat, Euro, AlertTriangle, Clock, ArrowRight, Plus,
  FileText, TrendingUp, Receipt, Calculator, XCircle, CheckCircle2,
  AlarmClock, Mail, Zap
} from "lucide-react";
import { format, addDays, isPast, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";

const STATUS_COLORS = {
  entwurf: "bg-secondary text-secondary-foreground",
  kalkulation: "bg-blue-100 text-blue-700",
  eingereicht: "bg-cyan-100 text-cyan-700",
  beauftragt: "bg-teal-100 text-teal-700",
  verloren: "bg-gray-100 text-gray-500",
  in_ausfuehrung: "bg-purple-100 text-purple-700",
  abgeschlossen: "bg-gray-100 text-gray-600",
};
const STATUS_LABELS = {
  entwurf: "Entwurf", kalkulation: "Kalkulation", eingereicht: "Eingereicht",
  beauftragt: "Beauftragt", verloren: "Verloren",
  in_ausfuehrung: "In Ausführung", abgeschlossen: "Abgeschlossen",
};

function KpiCard({ title, value, sub, icon: Icon, color, alert }) {
  return (
    <Card className={alert ? "border-destructive/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${alert ? "text-destructive" : "text-foreground"}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UnternehmensDashboard({ projects, rechnungen, fristen, schriftverkehr, aufgaben, isLoading }) {
  const fmt = (n) => n >= 1000000
    ? `${(n / 1000000).toFixed(2).replace(".", ",")} Mio. €`
    : `${(n / 1000).toFixed(0)}k €`;

  const aktiveProjekte = projects.filter(p => p.status === "in_ausfuehrung");
  const kalkulationProjekte = projects.filter(p => p.status === "kalkulation");
  const auftragsvolumen = aktiveProjekte.reduce((s, p) => s + (p.auftragssumme_netto || p.auftragssumme || 0), 0);
  const gesamtvolumen = projects.filter(p => !["verloren","abgeschlossen"].includes(p.status))
    .reduce((s, p) => s + (p.auftragssumme_netto || p.auftragssumme || 0), 0);

  const offeneForderungen = rechnungen
    .filter(r => !["bezahlt", "storniert"].includes(r.status))
    .reduce((s, r) => s + Math.max(0, (r.betrag_netto || 0) - (r.zahlungseingang || 0)), 0);

  const ueberfaelligeForderungen = rechnungen
    .filter(r => !["bezahlt", "storniert"].includes(r.status) && r.faellig_am && isPast(parseISO(r.faellig_am)));

  const in7Tagen = fristen.filter(f => {
    if (f.status === "erledigt" || !f.datum) return false;
    const d = parseISO(f.datum);
    return isWithinInterval(d, { start: startOfDay(new Date()), end: endOfDay(addDays(new Date(), 7)) });
  });

  const offeneAufgaben = aufgaben.filter(a => !["erledigt","verworfen"].includes(a.status));
  const kritischeAufgaben = offeneAufgaben.filter(a => a.prioritaet === "kritisch" || (a.faellig_am && isPast(parseISO(a.faellig_am))));

  const projekteHandlungsbedarf = projects.filter(p => {
    const hatUeberfaelligeFristen = fristen.some(f => f.project_id === p.id && f.status !== "erledigt" && f.datum && isPast(parseISO(f.datum)));
    return hatUeberfaelligeFristen || ["nicht_ausfuehrungsreif"].includes(p.afu_status);
  });

  const wichtigeKommunikation = schriftverkehr
    .filter(s => s.status !== "erledigt" && (s.wichtig || s.versandfreigabe_erforderlich))
    .slice(0, 5);

  if (isLoading) return <div className="space-y-4">{Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Aktive Projekte" value={aktiveProjekte.length} sub={`${kalkulationProjekte.length} in Kalkulation`} icon={HardHat} color="bg-primary" />
        <KpiCard title="Auftragsvolumen" value={auftragsvolumen > 0 ? fmt(auftragsvolumen) : "–"} sub={`Gesamt (aktiv): ${gesamtvolumen > 0 ? fmt(gesamtvolumen) : "–"}`} icon={TrendingUp} color="bg-green-600" />
        <KpiCard title="Offene Forderungen" value={offeneForderungen > 0 ? fmt(offeneForderungen) : "–"} sub={`${rechnungen.filter(r=>!["bezahlt","storniert"].includes(r.status)).length} offene Rechnungen`} icon={Euro} color="bg-amber-500" />
        <KpiCard title="Überfällige Forderungen" value={ueberfaelligeForderungen.length} sub={ueberfaelligeForderungen.length > 0 ? "Handlungsbedarf!" : "Alles im Plan"} icon={AlertTriangle} color="bg-destructive" alert={ueberfaelligeForderungen.length > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projektliste */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold">Aktuelle Projekte</CardTitle>
              <Link to={createPageUrl("Projects")}>
                <Button variant="ghost" size="sm" className="text-xs gap-1">Alle <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {projects.length === 0 ? (
                <div className="text-center py-10">
                  <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Noch keine Projekte angelegt</p>
                  <Link to={createPageUrl("Projects")}><Button size="sm" className="mt-3 gap-2"><Plus className="w-3 h-3" />Projekt anlegen</Button></Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {projects.slice(0, 8).map(p => (
                    <Link key={p.id} to={createPageUrl(`ProjectDetail?id=${p.id}`)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.project_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.project_number}{p.client ? ` · ${p.client}` : ""}
                          {(p.auftragssumme_netto || p.auftragssumme) ? ` · ${((p.auftragssumme_netto || p.auftragssumme)/1000).toFixed(0)}k €` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <Badge className={`text-[10px] shrink-0 ${STATUS_COLORS[p.status] || ""}`}>
                          {STATUS_LABELS[p.status] || p.status}
                        </Badge>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Projekte mit Handlungsbedarf */}
          {projekteHandlungsbedarf.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />Projekte mit Handlungsbedarf
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {projekteHandlungsbedarf.slice(0, 4).map(p => (
                    <Link key={p.id} to={createPageUrl(`ProjectDetail?id=${p.id}`)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-amber-50 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{p.project_name}</p>
                        <p className="text-xs text-amber-600">Überfällige Fristen oder AFU-Problem</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Rechte Spalte */}
        <div className="space-y-4">
          {/* Projektstatus-Ampel */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Projektstatus</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "In Ausführung", count: aktiveProjekte.length, color: "bg-purple-500" },
                { label: "Beauftragt", count: projects.filter(p=>p.status==="beauftragt").length, color: "bg-teal-500" },
                { label: "Kalkulation", count: kalkulationProjekte.length, color: "bg-blue-400" },
                { label: "Eingereicht", count: projects.filter(p=>p.status==="eingereicht").length, color: "bg-cyan-400" },
                { label: "Verloren", count: projects.filter(p=>p.status==="verloren").length, color: "bg-gray-400" },
                { label: "Abgeschlossen", count: projects.filter(p=>p.status==="abgeschlossen").length, color: "bg-gray-300" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span className="text-muted-foreground text-xs">{item.label}</span>
                  </div>
                  <span className="font-semibold text-xs">{item.count}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Gesamtvolumen (aktiv)</span>
                <span className="font-bold">{fmt(gesamtvolumen)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Fristen nächste 7 Tage */}
          <Card className={in7Tagen.length > 0 ? "border-amber-200" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlarmClock className="w-4 h-4 text-amber-500" />
                Fristen (nächste 7 Tage)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {in7Tagen.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Keine anstehenden Fristen</p>
              ) : (
                <div className="space-y-2">
                  {in7Tagen.slice(0, 5).map(f => (
                    <div key={f.id} className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium truncate">{f.titel}</p>
                      <span className="text-xs text-amber-600 shrink-0 font-medium">{format(parseISO(f.datum), "dd.MM.")}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Offene Freigaben / Kommunikation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4" />Offene Freigaben
              </CardTitle>
            </CardHeader>
            <CardContent>
              {wichtigeKommunikation.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Keine offenen Freigaben</p>
              ) : (
                <div className="space-y-2">
                  {wichtigeKommunikation.map(s => (
                    <div key={s.id} className="text-xs">
                      <p className="font-medium truncate">{s.betreff}</p>
                      <p className="text-muted-foreground">{s.datum ? format(parseISO(s.datum), "dd.MM.yyyy") : ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schnellzugriff */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Schnellzugriff</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {[
                { label: "Neues Projekt", page: "Projects", icon: Plus },
                { label: "Kalkulation", page: "Kalkulation", icon: Calculator },
                { label: "Abrechnung", page: "Abrechnung", icon: Receipt },
                { label: "Controlling", page: "Controlling", icon: TrendingUp },
              ].map(({ label, page, icon: Icon }) => (
                <Link key={page} to={createPageUrl(page)}>
                  <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground">
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}