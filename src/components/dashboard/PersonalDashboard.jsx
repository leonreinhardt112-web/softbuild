import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ListTodo, AlarmClock, ArrowRight, AlertTriangle, CheckCircle2,
  Mail, Calculator, FileText, Euro, Receipt, Clock, Zap, HardHat
} from "lucide-react";
import { format, isPast, parseISO, isToday, isThisWeek, startOfDay } from "date-fns";

const PRIO_COLORS = { kritisch: "bg-red-100 text-red-700", hoch: "bg-orange-100 text-orange-700", mittel: "bg-amber-100 text-amber-700", niedrig: "bg-gray-100 text-gray-600" };
const STATUS_COLORS = {
  entwurf: "bg-secondary text-secondary-foreground", kalkulation: "bg-blue-100 text-blue-700",
  eingereicht: "bg-cyan-100 text-cyan-700", beauftragt: "bg-teal-100 text-teal-700",
  verloren: "bg-gray-100 text-gray-500", in_ausfuehrung: "bg-purple-100 text-purple-700", abgeschlossen: "bg-gray-100 text-gray-600",
};
const STATUS_LABELS = {
  entwurf: "Entwurf", kalkulation: "Kalkulation", eingereicht: "Eingereicht",
  beauftragt: "Beauftragt", verloren: "Verloren", in_ausfuehrung: "In Ausführung", abgeschlossen: "Abgeschlossen",
};

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="text-center py-6">
      <Icon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function SectionCard({ title, icon: Icon, iconColor, children, count }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconColor || "text-muted-foreground"}`} />
          {title}
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="ml-auto text-[10px]">{count}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// --- Bauleitung Dashboard ---
function BauleitungDashboard({ user, meineProjekte, meineFristen, schriftverkehr, aufgaben }) {
  const mineAufgaben = aufgaben.filter(a => {
    const isProjectTask = a.project_id && meineProjekte.some(p => p.id === a.project_id);
    const isAssignedToMe = a.zugewiesen_an && user?.email && a.zugewiesen_an === user.email;
    return isProjectTask || isAssignedToMe;
  });
  const offeneAufgaben = mineAufgaben.filter(a => !["erledigt","verworfen"].includes(a.status));
  const heuteAufgaben = offeneAufgaben.filter(a => a.faellig_am && isToday(parseISO(a.faellig_am)));
  const ueberfaelligAufgaben = offeneAufgaben.filter(a => a.faellig_am && isPast(parseISO(a.faellig_am)) && !isToday(parseISO(a.faellig_am)));
  const dieseWocheFristen = meineFristen.filter(f => f.status !== "erledigt" && f.datum && isThisWeek(parseISO(f.datum)));
  const offenerSchriftverkehr = schriftverkehr.filter(s => s.status !== "erledigt");
  const reaktionsbedarf = schriftverkehr.filter(s => s.status !== "erledigt" && (s.follow_up_datum && isPast(parseISO(s.follow_up_datum))));

  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Meine Projekte", val: meineProjekte.length, icon: HardHat, color: "bg-primary" },
          { label: "Heute fällig", val: heuteAufgaben.length, icon: Clock, color: "bg-amber-500" },
          { label: "Überfällig", val: ueberfaelligAufgaben.length, icon: AlertTriangle, color: "bg-destructive", alert: ueberfaelligAufgaben.length > 0 },
          { label: "Offener Schriftverkehr", val: offenerSchriftverkehr.length, icon: Mail, color: "bg-blue-500" },
        ].map(({ label, val, icon: Icon, color, alert }) => (
          <Card key={label} className={alert ? "border-destructive/40" : ""}>
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${alert ? "text-destructive" : ""}`}>{val}</p>
              </div>
              <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Meine Projekte */}
        <SectionCard title="Meine Projekte" icon={HardHat} iconColor="text-primary" count={meineProjekte.length}>
          {meineProjekte.length === 0 ? <EmptyState icon={HardHat} text="Noch keine Projekte zugeordnet" /> : (
            <div className="divide-y divide-border -mx-6">
              {meineProjekte.map(p => (
                <Link key={p.id} to={createPageUrl(`ProjectDetail?id=${p.id}`)}
                  className="flex items-center justify-between px-6 py-2.5 hover:bg-accent/40 transition-colors group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.project_name}</p>
                    <p className="text-xs text-muted-foreground">{p.project_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</Badge>
                    <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Fristen diese Woche */}
        <SectionCard title="Fristen diese Woche" icon={AlarmClock} iconColor="text-amber-500" count={dieseWocheFristen.length}>
          {dieseWocheFristen.length === 0 ? <EmptyState icon={AlarmClock} text="Keine Fristen diese Woche" /> : (
            <div className="space-y-2">
              {dieseWocheFristen.map(f => (
                <div key={f.id} className="flex items-center justify-between">
                  <p className="text-xs font-medium truncate">{f.titel}</p>
                  <span className="text-xs text-amber-600 font-medium ml-2 shrink-0">{format(parseISO(f.datum), "dd.MM.")}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Offene Aufgaben */}
         <SectionCard title="Offene Aufgaben" icon={ListTodo} iconColor="text-primary" count={offeneAufgaben.length}>
           {offeneAufgaben.length === 0 ? <EmptyState icon={ListTodo} text="Keine offenen Aufgaben" /> : (
             <div className="divide-y divide-border -mx-6">
               {offeneAufgaben.slice(0, 5).map(a => {
                 const dest = a.project_id 
                   ? createPageUrl(`ProjectDetail?id=${a.project_id}&tab=aufgaben`)
                   : "#";
                 return (
                   <Link key={a.id} to={dest} className={`flex items-start justify-between gap-2 px-6 py-2.5 hover:bg-accent/40 transition-colors ${!a.project_id ? "cursor-default" : ""}`}>
                     <div className="min-w-0">
                       <p className="text-xs font-medium truncate">{a.titel}</p>
                       {a.faellig_am && <p className={`text-[10px] ${isPast(parseISO(a.faellig_am)) ? "text-destructive" : "text-muted-foreground"}`}>
                         Fällig: {format(parseISO(a.faellig_am), "dd.MM.yyyy")}
                       </p>}
                     </div>
                     <Badge className={`text-[9px] shrink-0 ${PRIO_COLORS[a.prioritaet]}`}>{a.prioritaet}</Badge>
                   </Link>
                 );
               })}
             </div>
           )}
         </SectionCard>

        {/* Reaktionsbedarf Schriftverkehr */}
        <SectionCard title="Reaktionsbedarf" icon={Mail} iconColor="text-blue-500" count={reaktionsbedarf.length}>
          {reaktionsbedarf.length === 0 ? <EmptyState icon={Mail} text="Kein Reaktionsbedarf" /> : (
            <div className="space-y-2">
              {reaktionsbedarf.map(s => (
                <div key={s.id} className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium truncate">{s.betreff}</p>
                  <span className="text-[10px] text-destructive shrink-0">Follow-up überfällig</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// --- Kalkulation Dashboard ---
function KalkulationDashboard({ meineProjekte, alleProjekte, meineFristen, aufgaben }) {
  const kalkulationsProjekte = alleProjekte.filter(p => p.status === "kalkulation");
  const offeneAufgaben = aufgaben.filter(a => !["erledigt","verworfen"].includes(a.status));
  const heuteAufgaben = offeneAufgaben.filter(a => a.faellig_am && isToday(parseISO(a.faellig_am)));
  const ueberfaellig = offeneAufgaben.filter(a => a.faellig_am && isPast(parseISO(a.faellig_am)) && !isToday(parseISO(a.faellig_am)));
  const anstehendeFristen = meineFristen.filter(f => f.status !== "erledigt" && f.datum && isThisWeek(parseISO(f.datum)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "In Kalkulation", val: kalkulationsProjekte.length, icon: Calculator, color: "bg-blue-500" },
          { label: "Meine Projekte", val: meineProjekte.length, icon: FileText, color: "bg-primary" },
          { label: "Heute fällig", val: heuteAufgaben.length, icon: Clock, color: "bg-amber-500" },
          { label: "Überfällig", val: ueberfaellig.length, icon: AlertTriangle, color: "bg-destructive", alert: ueberfaellig.length > 0 },
        ].map(({ label, val, icon: Icon, color, alert }) => (
          <Card key={label} className={alert ? "border-destructive/40" : ""}>
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${alert ? "text-destructive" : ""}`}>{val}</p>
              </div>
              <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Projekte in Kalkulation" icon={Calculator} iconColor="text-blue-500" count={kalkulationsProjekte.length}>
          {kalkulationsProjekte.length === 0 ? <EmptyState icon={Calculator} text="Keine Projekte in Kalkulation" /> : (
            <div className="divide-y divide-border -mx-6">
              {kalkulationsProjekte.map(p => (
                <Link key={p.id} to={createPageUrl(`ProjectDetail?id=${p.id}`)}
                  className="flex items-center justify-between px-6 py-2.5 hover:bg-accent/40 transition-colors group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.project_name}</p>
                    <p className="text-xs text-muted-foreground">{p.project_number}{p.submission_date ? ` · Sub: ${format(parseISO(p.submission_date), "dd.MM.")}` : ""}</p>
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Anstehende Fristen" icon={AlarmClock} iconColor="text-amber-500" count={anstehendeFristen.length}>
          {anstehendeFristen.length === 0 ? <EmptyState icon={AlarmClock} text="Keine anstehenden Fristen" /> : (
            <div className="space-y-2">
              {anstehendeFristen.map(f => (
                <div key={f.id} className="flex items-center justify-between">
                  <p className="text-xs font-medium truncate">{f.titel}</p>
                  <span className="text-xs text-amber-600 font-medium ml-2 shrink-0">{format(parseISO(f.datum), "dd.MM.")}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Offene Aufgaben" icon={ListTodo} iconColor="text-primary" count={offeneAufgaben.length}>
           {offeneAufgaben.length === 0 ? <EmptyState icon={ListTodo} text="Keine offenen Aufgaben" /> : (
             <div className="divide-y divide-border -mx-6">
               {offeneAufgaben.slice(0, 6).map(a => {
                 const dest = a.project_id 
                   ? createPageUrl(`ProjectDetail?id=${a.project_id}&tab=aufgaben`)
                   : "#";
                 return (
                   <Link key={a.id} to={dest} className={`flex items-start justify-between gap-2 px-6 py-2.5 hover:bg-accent/40 transition-colors ${!a.project_id ? "cursor-default" : ""}`}>
                     <div className="min-w-0">
                       <p className="text-xs font-medium truncate">{a.titel}</p>
                       {a.faellig_am && <p className={`text-[10px] ${isPast(parseISO(a.faellig_am)) ? "text-destructive" : "text-muted-foreground"}`}>
                         {format(parseISO(a.faellig_am), "dd.MM.yyyy")}
                       </p>}
                     </div>
                     <Badge className={`text-[9px] shrink-0 ${PRIO_COLORS[a.prioritaet]}`}>{a.prioritaet}</Badge>
                   </Link>
                 );
               })}
             </div>
           )}
         </SectionCard>

        <SectionCard title="Meine Projekte" icon={FileText} iconColor="text-primary" count={meineProjekte.length}>
          {meineProjekte.length === 0 ? <EmptyState icon={FileText} text="Noch keine Projekte zugeordnet" /> : (
            <div className="divide-y divide-border -mx-6">
              {meineProjekte.map(p => (
                <Link key={p.id} to={createPageUrl(`ProjectDetail?id=${p.id}`)}
                  className="flex items-center justify-between px-6 py-2.5 hover:bg-accent/40 transition-colors group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.project_name}</p>
                    <p className="text-xs text-muted-foreground">{p.project_number}</p>
                  </div>
                  <Badge className={`text-[10px] ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</Badge>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// --- Buchhaltung Dashboard ---
function BuchhaltungDashboard({ rechnungen, meineFristen, aufgaben }) {
  const offeneRechnungen = rechnungen.filter(r => !["bezahlt","storniert"].includes(r.status));
  const ueberfaelligRechnungen = offeneRechnungen.filter(r => r.faellig_am && isPast(parseISO(r.faellig_am)));
  const mahnungen = rechnungen.filter(r => r.status === "gemahnt");
  const offeneAufgaben = aufgaben.filter(a => !["erledigt","verworfen"].includes(a.status));
  const fristen = meineFristen.filter(f => f.status !== "erledigt");
  const fmt = (n) => n?.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) || "–";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Offene Rechnungen", val: offeneRechnungen.length, icon: Receipt, color: "bg-primary" },
          { label: "Überfällig", val: ueberfaelligRechnungen.length, icon: AlertTriangle, color: "bg-destructive", alert: ueberfaelligRechnungen.length > 0 },
          { label: "Mahnungen", val: mahnungen.length, icon: Zap, color: "bg-orange-500", alert: mahnungen.length > 0 },
          { label: "Offene Fristen", val: fristen.length, icon: AlarmClock, color: "bg-amber-500" },
        ].map(({ label, val, icon: Icon, color, alert }) => (
          <Card key={label} className={alert ? "border-destructive/40" : ""}>
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${alert ? "text-destructive" : ""}`}>{val}</p>
              </div>
              <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Überfällige Rechnungen" icon={AlertTriangle} iconColor="text-destructive" count={ueberfaelligRechnungen.length}>
          {ueberfaelligRechnungen.length === 0 ? <EmptyState icon={CheckCircle2} text="Keine überfälligen Rechnungen" /> : (
            <div className="space-y-2">
              {ueberfaelligRechnungen.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{r.rechnungsnummer}</p>
                    <p className="text-[10px] text-destructive">Fällig: {r.faellig_am ? format(parseISO(r.faellig_am), "dd.MM.yyyy") : "–"}</p>
                  </div>
                  <span className="text-xs font-bold text-destructive shrink-0">{fmt(r.betrag_netto)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Offene Ausgangsrechnungen" icon={Receipt} iconColor="text-primary" count={offeneRechnungen.length}>
          {offeneRechnungen.length === 0 ? <EmptyState icon={Receipt} text="Keine offenen Rechnungen" /> : (
            <div className="space-y-2">
              {offeneRechnungen.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{r.rechnungsnummer}</p>
                    <p className="text-[10px] text-muted-foreground">{r.rechnungsart}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold">{fmt(r.betrag_netto)}</p>
                    <Badge variant="outline" className="text-[9px]">{r.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Offene Aufgaben" icon={ListTodo} iconColor="text-primary" count={offeneAufgaben.length}>
           {offeneAufgaben.length === 0 ? <EmptyState icon={ListTodo} text="Keine offenen Aufgaben" /> : (
             <div className="divide-y divide-border -mx-6">
               {offeneAufgaben.slice(0, 5).map(a => {
                 const dest = a.project_id 
                   ? createPageUrl(`ProjectDetail?id=${a.project_id}&tab=aufgaben`)
                   : "#";
                 return (
                   <Link key={a.id} to={dest} className={`flex items-start justify-between gap-2 px-6 py-2.5 hover:bg-accent/40 transition-colors ${!a.project_id ? "cursor-default" : ""}`}>
                     <p className="text-xs font-medium truncate">{a.titel}</p>
                     <Badge className={`text-[9px] shrink-0 ${PRIO_COLORS[a.prioritaet]}`}>{a.prioritaet}</Badge>
                   </Link>
                 );
               })}
             </div>
           )}
         </SectionCard>

        <SectionCard title="Wiedervorlagen & Fristen" icon={AlarmClock} iconColor="text-amber-500" count={fristen.length}>
          {fristen.length === 0 ? <EmptyState icon={AlarmClock} text="Keine offenen Fristen" /> : (
            <div className="space-y-2">
              {fristen.slice(0, 5).map(f => (
                <div key={f.id} className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium truncate">{f.titel}</p>
                  <span className={`text-xs font-medium shrink-0 ${f.datum && isPast(parseISO(f.datum)) ? "text-destructive" : "text-amber-600"}`}>
                    {f.datum ? format(parseISO(f.datum), "dd.MM.") : "–"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default function PersonalDashboard({ user, meineProjekte, alleProjekte, rechnungen, fristen, schriftverkehr, aufgaben, zustaendigkeiten }) {
  const role = user?.role;

  return (
    <div className="space-y-6">
      {role === "bauleitung" && (
        <BauleitungDashboard
          user={user}
          meineProjekte={meineProjekte}
          meineFristen={fristen.filter(f => meineProjekte.some(p => p.id === f.project_id))}
          schriftverkehr={schriftverkehr.filter(s => meineProjekte.some(p => p.id === s.project_id))}
          aufgaben={aufgaben}
        />
      )}
      {role === "kalkulation" && (
        <KalkulationDashboard
          meineProjekte={meineProjekte}
          alleProjekte={alleProjekte}
          meineFristen={fristen.filter(f => meineProjekte.some(p => p.id === f.project_id))}
          aufgaben={aufgaben.filter(a => !a.project_id || meineProjekte.some(p => p.id === a.project_id))}
        />
      )}
      {role === "buchhaltung" && (
        <BuchhaltungDashboard
          rechnungen={rechnungen}
          meineFristen={fristen}
          aufgaben={aufgaben}
        />
      )}
      {!["bauleitung","kalkulation","buchhaltung"].includes(role) && (
        <div className="text-center py-20 text-muted-foreground">
          <p>Kein personalisiertes Dashboard für diese Rolle konfiguriert.</p>
        </div>
      )}
    </div>
  );
}