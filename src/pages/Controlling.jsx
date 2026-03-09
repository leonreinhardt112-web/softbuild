import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { format } from "date-fns";

export default function Controlling() {
  const [selectedProject, setSelectedProject] = useState("alle");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });
  const { data: kalks = [] } = useQuery({
    queryKey: ["kalkulationen"],
    queryFn: () => base44.entities.Kalkulation.list("-created_date", 100),
  });
  const { data: rechnungen = [] } = useQuery({
    queryKey: ["rechnungen"],
    queryFn: () => base44.entities.Rechnung.list("-created_date", 100),
  });
  const { data: nachtraege = [] } = useQuery({
    queryKey: ["nachtraege"],
    queryFn: () => base44.entities.Nachtrag.list("-created_date", 100),
  });

  const filterP = selectedProject === "alle" ? projects : projects.filter(p => p.id === selectedProject);

  const chartData = filterP.map(p => {
    const kalk = kalks.find(k => k.project_id === p.id && k.status === "beauftragt");
    const rechns = rechnungen.filter(r => r.project_id === p.id && r.status !== "storniert");
    const nachts = nachtraege.filter(n => n.project_id === p.id && n.status === "beauftragt");
    const umsatz = rechns.reduce((s, r) => s + (r.betrag_netto || 0), 0);
    const nachtragsV = nachts.reduce((s, n) => s + (n.betrag_beauftragt || n.betrag_angemeldet || 0), 0);
    return {
      name: p.project_name.length > 14 ? p.project_name.substring(0, 14) + "…" : p.project_name,
      Auftragssumme: p.auftragssumme || 0,
      Nachträge: nachtragsV,
      Umsatz: umsatz,
      SollKosten: kalk?.kalkulierte_herstellkosten || 0,
    };
  }).filter(d => d.Auftragssumme > 0 || d.Umsatz > 0);

  const gesamtAuftrag = filterP.reduce((s, p) => s + (p.auftragssumme || 0), 0);
  const gesamtUmsatz = rechnungen
    .filter(r => r.status !== "storniert" && (selectedProject === "alle" || r.project_id === selectedProject))
    .reduce((s, r) => s + (r.betrag_netto || 0), 0);
  const gesamtNachtraege = nachtraege
    .filter(n => n.status === "beauftragt" && (selectedProject === "alle" || n.project_id === selectedProject))
    .reduce((s, n) => s + (n.betrag_beauftragt || n.betrag_angemeldet || 0), 0);
  const offeneForderungen = rechnungen
    .filter(r => !["bezahlt", "storniert"].includes(r.status) && (selectedProject === "alle" || r.project_id === selectedProject))
    .reduce((s, r) => s + ((r.betrag_brutto || 0) - (r.zahlungseingang || 0)), 0);

  const leistungsgrad = gesamtAuftrag > 0 ? ((gesamtUmsatz / gesamtAuftrag) * 100).toFixed(1) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controlling</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Wirtschaftliche Projektkennzahlen und Forecast</p>
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Alle Projekte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Projekte</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Auftragsvolumen", val: `${(gesamtAuftrag / 1000).toFixed(0)}k €`, icon: BarChart3, color: "text-primary" },
          { label: "Umsatz (netto)", val: `${(gesamtUmsatz / 1000).toFixed(0)}k €`, icon: TrendingUp, color: "text-green-600" },
          { label: "Nachträge beauftragt", val: `${(gesamtNachtraege / 1000).toFixed(0)}k €`, icon: TrendingUp, color: "text-amber-600" },
          { label: "Offene Forderungen", val: `${(offeneForderungen / 1000).toFixed(0)}k €`, icon: AlertTriangle, color: "text-destructive" },
        ].map(({ label, val, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold mt-1">{val}</p>
                </div>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leistungsgrad */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Leistungsgrad (Umsatz / Auftragsvolumen)</p>
            <span className="text-2xl font-bold text-primary">{leistungsgrad}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-primary rounded-full h-3 transition-all duration-500"
              style={{ width: `${Math.min(100, parseFloat(leistungsgrad))}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Projektübersicht – Volumen & Umsatz</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => `${v.toLocaleString("de-DE")} €`} />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
                <Bar dataKey="Auftragssumme" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Umsatz" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Nachträge" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Projekttabelle */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Projektkennzahlen</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Projekt</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Auftragssumme</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Nachträge</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Umsatz</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Offen</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">AFU</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filterP.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">Keine Projekte vorhanden</td></tr>
                ) : filterP.map(p => {
                  const rechns = rechnungen.filter(r => r.project_id === p.id && r.status !== "storniert");
                  const nachts = nachtraege.filter(n => n.project_id === p.id && n.status === "beauftragt");
                  const umsatz = rechns.reduce((s, r) => s + (r.betrag_netto || 0), 0);
                  const nV = nachts.reduce((s, n) => s + (n.betrag_beauftragt || n.betrag_angemeldet || 0), 0);
                  const offen = rechnungen.filter(r => r.project_id === p.id && !["bezahlt", "storniert"].includes(r.status))
                    .reduce((s, r) => s + ((r.betrag_brutto || 0) - (r.zahlungseingang || 0)), 0);
                  const afuColors = { ausfuehrungsreif: "bg-green-100 text-green-700", nicht_ausfuehrungsreif: "bg-red-100 text-red-700", in_pruefung: "bg-amber-100 text-amber-700", ausstehend: "bg-secondary text-secondary-foreground" };
                  const afuLabels = { ausfuehrungsreif: "✓ Reif", nicht_ausfuehrungsreif: "✗ Risiko", in_pruefung: "In Prüfung", ausstehend: "–" };
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-accent/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-xs">{p.project_name}</div>
                        <div className="text-xs text-muted-foreground">{p.project_number}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs">{p.auftragssumme ? p.auftragssumme.toLocaleString("de-DE") + " €" : "–"}</td>
                      <td className="px-4 py-3 text-right text-xs text-amber-600">{nV > 0 ? nV.toLocaleString("de-DE") + " €" : "–"}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium">{umsatz > 0 ? umsatz.toLocaleString("de-DE") + " €" : "–"}</td>
                      <td className={`px-4 py-3 text-right text-xs font-semibold ${offen > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {offen > 0 ? offen.toLocaleString("de-DE") + " €" : "–"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${afuColors[p.afu_status || "ausstehend"]}`}>
                          {afuLabels[p.afu_status || "ausstehend"]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={createPageUrl(`ProjectDetail?id=${p.id}`)}>
                          <button className="text-muted-foreground hover:text-foreground"><ArrowRight className="w-3.5 h-3.5" /></button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}