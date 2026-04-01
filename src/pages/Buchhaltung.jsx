import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, TrendingUp, TrendingDown, Scale, CreditCard, AlertTriangle } from "lucide-react";
import MahnwesenTabelle from "@/components/buchhaltung/MahnwesenTabelle";
import OffenePostenTabelle from "@/components/buchhaltung/OffenePostenTabelle";
import PartnerSaldoTabelle from "@/components/buchhaltung/PartnerSaldoTabelle";
import EingangsRechnungForm from "@/components/buchhaltung/EingangsRechnungForm.jsx";
import KIBelegErfassung from "@/components/buchhaltung/KIBelegErfassung";
import { EinzelZahlungDialog, AKontoDialog } from "@/components/buchhaltung/ZahlungBuchenDialog";
import { ZahlungskuerzungDialog } from "@/components/buchhaltung/ZahlungskuerzungDialog";

const fmt = (v) => v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export default function Buchhaltung() {
  const qc = useQueryClient();
  const [showKreditorForm, setShowKreditorForm] = useState(false);
  const [zahlungRechnung, setZahlungRechnung] = useState(null); // für Einzelzahlung
  const [kuerzungRechnung, setKuerzungRechnung] = useState(null); // für Zahlungskürzung (Debitoren)
  const [aKontoKreditor, setAKontoKreditor] = useState(null);   // für A-Konto
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => { base44.auth.me().then(u => setCurrentUser(u)).catch(() => {}); }, []);

  const { data: rechnungen = [], isLoading: rLoading } = useQuery({
    queryKey: ["rechnungen"],
    queryFn: () => base44.entities.Rechnung.list("-rechnungsdatum", 200),
  });
  const { data: eingangsRechnungen = [], isLoading: eLoading } = useQuery({
    queryKey: ["eingangsRechnungen"],
    queryFn: () => base44.entities.EingangsRechnung.list("-rechnungsdatum", 200),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });
  const { data: stammdaten = [] } = useQuery({
    queryKey: ["stammdaten-kreditoren"],
    queryFn: () => base44.entities.Stammdatum.list("-created_date", 200),
  });
  const { data: aufmasse = [] } = useQuery({
    queryKey: ["aufmasse-all"],
    queryFn: () => base44.entities.Aufmass.list("-datum", 500),
  });

  const createEingang = useMutation({
    mutationFn: (d) => base44.entities.EingangsRechnung.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["eingangsRechnungen"] }); setShowKreditorForm(false); },
  });

  const updateRechnung = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Rechnung.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rechnungen"] });
      qc.invalidateQueries({ queryKey: ["saldo"] });
    },
  });
  const updateEingang = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EingangsRechnung.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eingangsRechnungen"] });
      qc.invalidateQueries({ queryKey: ["saldo"] });
    },
  });

  const offeneDebitoren = rechnungen.filter(r => !["bezahlt", "storniert"].includes(r.status));
  const offeneKreditoren = eingangsRechnungen.filter(r => !["bezahlt", "storniert"].includes(r.status));

  const sumOffenDebitor = offeneDebitoren.reduce((s, r) => s + Math.max(0, (r.betrag_brutto || 0) - (r.zahlungseingang || 0) - (r.einbehalt || 0)), 0);
  const sumOffenKreditor = offeneKreditoren.reduce((s, r) => s + Math.max(0, (r.betrag_brutto || 0) - (r.zahlungsausgang || 0) - (r.einbehalt || 0)), 0);
  const nettosaldo = sumOffenDebitor - sumOffenKreditor;

  const handleDebitorZahlung = (r) => {
    // Für Debitoren: Zahlungskürzung-Dialog (wegen Bauwesen-Realität mit Prüfungskürzungen)
    setKuerzungRechnung(r);
  };

  // Einzelzahlung (mit Skonto)
  const handleEinzelZahlungSave = (id, data) => {
    updateEingang.mutate({ id, data });
  };

  // A-Konto: mehrere Rechnungen auf einmal
  const handleAKontoSave = (updates) => {
    updates.forEach(u => updateEingang.mutate({ id: u.id, data: u.data }));
  };

  // Eindeutige Kreditoren aus offenen Rechnungen
  const kreditoren = [...new Set(offeneKreditoren.map(r => r.kreditor_name).filter(Boolean))];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6" /> Buchhaltung
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Debitoren (Ausgangsrechnungen / Forderungen) · Kreditoren (Eingangsrechnungen / Verbindlichkeiten)
        </p>
      </div>

      {/* KPI-Leiste */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Offene Forderungen (Debitoren)", val: fmt(sumOffenDebitor), color: "bg-blue-500", icon: TrendingUp },
          { label: "Offene Verbindlichkeiten (Kreditoren)", val: fmt(sumOffenKreditor), color: "bg-red-500", icon: TrendingDown },
          { label: "Netto-Liquiditätssaldo", val: fmt(nettosaldo), color: nettosaldo >= 0 ? "bg-green-500" : "bg-amber-500", icon: Scale },
          { label: "Offene Debitoren-Posten", val: offeneDebitoren.length, color: "bg-amber-500", icon: TrendingUp },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
                  <p className="text-lg font-bold mt-0.5">{s.val}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="debitoren">
        <TabsList>
          <TabsTrigger value="debitoren" className="text-xs gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Debitoren – Offene Posten
          </TabsTrigger>
          <TabsTrigger value="kreditoren" className="text-xs gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" /> Kreditoren – Offene Posten
          </TabsTrigger>
          <TabsTrigger value="saldo" className="text-xs gap-1.5">
            <Scale className="w-3.5 h-3.5" /> Saldo je Partner
          </TabsTrigger>
          <TabsTrigger value="mahnwesen" className="text-xs gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Mahnwesen
            {rechnungen.filter(r => !["bezahlt","storniert","entwurf"].includes(r.status) && r.faellig_am && (r.zahlungseingang||0) === 0 && ((r.betrag_brutto||0)-(r.einbehalt||0))>0 && new Date() > new Date(r.faellig_am)).length > 0 && (
              <span className="ml-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {rechnungen.filter(r => !["bezahlt","storniert","entwurf"].includes(r.status) && r.faellig_am && (r.zahlungseingang||0) === 0 && ((r.betrag_brutto||0)-(r.einbehalt||0))>0 && new Date() > new Date(r.faellig_am)).length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* --- DEBITOREN --- */}
        <TabsContent value="debitoren" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border bg-blue-50/40 flex items-center justify-between">
                <p className="text-xs text-blue-800 font-semibold">
                  Ausgangsrechnungen · Forderungen gegenüber Auftraggebern
                </p>
                <span className="text-xs text-muted-foreground">
                  Rechnungen werden in der <strong>Abrechnung</strong> angelegt
                </span>
              </div>
              <OffenePostenTabelle
                rows={rechnungen}
                typ="debitor"
                projects={projects}
                aufmasse={aufmasse}
                stammdaten={stammdaten}
                onZahlung={handleDebitorZahlung}
                isLoading={rLoading}
                currentUser={currentUser}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- KREDITOREN --- */}
         <TabsContent value="kreditoren" className="mt-4 space-y-4">
           {/* Prüfung ausstehend Badge */}
           {eingangsRechnungen.filter(r => r.status === "eingegangen" && !["bezahlt", "storniert"].includes(r.status)).length > 0 && (
             <Card className="border-amber-200 bg-amber-50/40">
               <CardContent className="p-4 flex items-center gap-2">
                 <AlertTriangle className="w-4 h-4 text-amber-600" />
                 <p className="text-xs text-amber-700 font-semibold">
                   {eingangsRechnungen.filter(r => r.status === "eingegangen").length} Eingangsrechnung(en) warten auf Bauleiter-Prüfung
                 </p>
               </CardContent>
             </Card>
           )}

           <KIBelegErfassung
            projects={projects}
            stammdaten={stammdaten}
            onSaved={() => qc.invalidateQueries({ queryKey: ["eingangsRechnungen"] })}
          />

          {/* A-Konto Schnellzugriff */}
          {kreditoren.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> A-Konto-Zahlung (Sammelzahlung je Kreditor)
                </p>
                <div className="flex flex-wrap gap-2">
                  {kreditoren.map(k => (
                    <Button key={k} variant="outline" size="sm" className="text-xs gap-1.5 h-7"
                      onClick={() => setAKontoKreditor(k)}>
                      <CreditCard className="w-3 h-3" /> {k}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setShowKreditorForm(true)}>
              <Plus className="w-4 h-4" /> Einzelne Eingangsrechnung anlegen
            </Button>
          </div>

          {showKreditorForm && (
            <EingangsRechnungForm
              projects={projects}
              stammdaten={stammdaten}
              onSave={(d) => createEingang.mutate(d)}
              onCancel={() => setShowKreditorForm(false)}
              isPending={createEingang.isPending}
            />
          )}

          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border bg-red-50/40 flex items-center justify-between">
                <p className="text-xs text-red-800 font-semibold">
                  Eingangsrechnungen · alle Verbindlichkeiten
                </p>
                {eingangsRechnungen.filter(r => r.status === "eingegangen").length > 0 && (
                  <span className="text-[10px] text-amber-600 font-semibold bg-amber-100 px-2 py-1 rounded">
                    {eingangsRechnungen.filter(r => r.status === "eingegangen").length} Prüfung ausstehend
                  </span>
                )}
              </div>
              <OffenePostenTabelle
                rows={eingangsRechnungen.filter(r => r.status !== "storniert")}
                typ="kreditor"
                projects={projects}
                onZahlung={(r) => setZahlungRechnung(r)}
                isLoading={eLoading}
              />
              </CardContent>
              </Card>
              </TabsContent>

              {/* --- SALDO JE PARTNER --- */}
        <TabsContent value="saldo" className="mt-4">
          <PartnerSaldoTabelle
            rechnungen={rechnungen}
            eingangsRechnungen={eingangsRechnungen}
            projects={projects}
          />
        </TabsContent>

        {/* --- MAHNWESEN --- */}
        <TabsContent value="mahnwesen" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border bg-amber-50/40 flex items-center justify-between">
                <p className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Überfällige Ausgangsrechnungen · Mahnwesen
                </p>
              </div>
              <MahnwesenTabelle
                rechnungen={rechnungen}
                projects={projects}
                stammdaten={stammdaten}
                onMahnungSave={(id, data) => updateRechnung.mutate({ id, data })}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Zahlungskürzung-Dialog (für Debitoren / Ausgangsrechnungen) */}
      <ZahlungskuerzungDialog
        rechnung={kuerzungRechnung}
        open={!!kuerzungRechnung}
        onClose={() => setKuerzungRechnung(null)}
        onSave={(id, data) => updateRechnung.mutate({ id, data })}
      />

      {/* Einzelzahlung-Dialog (für Kreditoren / Eingangsrechnungen) */}
      <EinzelZahlungDialog
        rechnung={zahlungRechnung}
        open={!!zahlungRechnung}
        onClose={() => setZahlungRechnung(null)}
        onSave={(id, data) => handleEinzelZahlungSave(id, data)}
      />

      {/* A-Konto-Dialog */}
      <AKontoDialog
        kreditorName={aKontoKreditor}
        offeneRechnungen={offeneKreditoren.filter(r => r.kreditor_name === aKontoKreditor)}
        open={!!aKontoKreditor}
        onClose={() => setAKontoKreditor(null)}
        onSave={handleAKontoSave}
      />
    </div>
  );
}