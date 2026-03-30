import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import UnternehmensDashboard from "@/components/dashboard/UnternehmensDashboard";
import PersonalDashboard from "@/components/dashboard/PersonalDashboard";

const ROLLEN_LABELS = {
  admin: "Admin",
  geschaeftsfuehrung: "Geschäftsführung",
  kalkulation: "Kalkulation",
  bauleitung: "Bauleitung",
  buchhaltung: "Buchhaltung",
};
const ROLLEN_COLORS = {
  admin: "bg-red-100 text-red-700",
  geschaeftsfuehrung: "bg-purple-100 text-purple-700",
  kalkulation: "bg-blue-100 text-blue-700",
  bauleitung: "bg-orange-100 text-orange-700",
  buchhaltung: "bg-green-100 text-green-700",
};

const UNTERNEHMENS_ROLLEN = ["admin", "geschaeftsfuehrung"];

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setCurrentUser(u); setUserLoading(false); }).catch(() => setUserLoading(false));
  }, []);

  const { data: alleProjekte = [], isLoading: projLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });
  const { data: rechnungen = [] } = useQuery({
    queryKey: ["rechnungen-dash"],
    queryFn: () => base44.entities.Rechnung.list("-created_date", 200),
  });
  const { data: fristen = [] } = useQuery({
    queryKey: ["fristen-dash"],
    queryFn: () => base44.entities.ProjektFrist.list("-datum", 200),
  });
  const { data: schriftverkehr = [] } = useQuery({
    queryKey: ["schriftverkehr-dash"],
    queryFn: () => base44.entities.SchriftverkehrEintrag.list("-datum", 100),
  });
  const { data: aufgaben = [] } = useQuery({
    queryKey: ["aufgaben-dash"],
    queryFn: () => base44.entities.Aufgabe.list("-created_date", 200),
  });
  const { data: zustaendigkeiten = [] } = useQuery({
    queryKey: ["zustaendigkeiten-dash"],
    queryFn: () => base44.entities.ProjektZustaendigkeit.list("-created_date", 500),
  });

  const isLoading = userLoading || projLoading;
  const role = currentUser?.role;
  const isUnternehmensRolle = UNTERNEHMENS_ROLLEN.includes(role);

  // Projekte filtern: Admin/GF sehen alle, andere nur ihre zugeordneten
  const meineProjektIds = new Set(
    zustaendigkeiten
      .filter(z => z.user_email === currentUser?.email)
      .map(z => z.project_id)
  );
  const meineProjekte = isUnternehmensRolle
    ? alleProjekte
    : alleProjekte.filter(p => meineProjektIds.has(p.id));

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-foreground">
              {isUnternehmensRolle ? "Dashboard" : `Hallo, ${currentUser?.full_name?.split(" ")[0] || "–"}`}
            </h1>
            {role && (
              <Badge className={`text-xs ${ROLLEN_COLORS[role] || "bg-secondary text-secondary-foreground"}`}>
                {ROLLEN_LABELS[role] || role}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isUnternehmensRolle ? "Unternehmensüberblick" : "Meine Aufgaben & Projekte"} · {format(new Date(), "dd.MM.yyyy")}
          </p>
        </div>
      </div>

      {/* Rollenbasiertes Dashboard */}
      {isUnternehmensRolle ? (
        <UnternehmensDashboard
          projects={alleProjekte}
          rechnungen={rechnungen}
          fristen={fristen}
          schriftverkehr={schriftverkehr}
          aufgaben={aufgaben}
          isLoading={false}
        />
      ) : (
        <PersonalDashboard
          user={currentUser}
          meineProjekte={meineProjekte}
          alleProjekte={alleProjekte}
          rechnungen={rechnungen}
          fristen={fristen}
          schriftverkehr={schriftverkehr}
          aufgaben={aufgaben}
          zustaendigkeiten={zustaendigkeiten}
        />
      )}
    </div>
  );
}