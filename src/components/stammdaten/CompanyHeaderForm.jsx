import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import CompanyBriefkopfForm from "./CompanyBriefkopfForm";
import AngebotSettings from "./AngebotSettings";
import RechnungSettings from "./RechnungSettings";
import PdfFooterSettings from "./PdfFooterSettings";

export default function CompanyHeaderForm() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    briefkopf_strasse: "",
    briefkopf_plz: "",
    briefkopf_stadt: "",
    briefkopf_telefon: "",
    briefkopf_email: "",
    briefkopf_website: "",
    briefkopf_logo_url: "",
    angebot_header_farbe: "#4682B4",
    pdf_footer_links: "",
    pdf_footer_mitte: "",
    pdf_footer_rechts: "",
    pdf_footer_farbe: "#666666",
    unser_zeichen_optionen: [],
    email_domain: "",
  });
  const [newZeichen, setNewZeichen] = useState("");

  useEffect(() => {
    loadCompany();
  }, []);

  const loadCompany = async () => {
    try {
      const companies = await base44.entities.Stammdatum.filter({ typ: "unternehmen", aktiv: true }, undefined, 1);
      if (companies && companies.length > 0) {
        setCompany(companies[0]);
        setForm({
          name: companies[0].name || "",
          briefkopf_strasse: companies[0].briefkopf_strasse || "",
          briefkopf_plz: companies[0].briefkopf_plz || "",
          briefkopf_stadt: companies[0].briefkopf_stadt || "",
          briefkopf_telefon: companies[0].briefkopf_telefon || "",
          briefkopf_email: companies[0].briefkopf_email || "",
          briefkopf_website: companies[0].briefkopf_website || "",
          briefkopf_logo_url: companies[0].briefkopf_logo_url || "",
          angebot_header_farbe: companies[0].angebot_header_farbe || "#4682B4",
          pdf_footer_links: companies[0].pdf_footer_links || "",
          pdf_footer_mitte: companies[0].pdf_footer_mitte || "",
          pdf_footer_rechts: companies[0].pdf_footer_rechts || "",
          pdf_footer_farbe: companies[0].pdf_footer_farbe || "#666666",
          unser_zeichen_optionen: companies[0].unser_zeichen_optionen || [],
          email_domain: companies[0].email_domain || "",
        });
      }
    } catch (e) {
      console.error("Fehler beim Laden der Unternehmens-Daten:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (company) {
        // Update existing
        await base44.entities.Stammdatum.update(company.id, form);
      } else {
        // Create new
        await base44.entities.Stammdatum.create({
          typ: "unternehmen",
          aktiv: true,
          ...form,
        });
      }
      await loadCompany();
    } catch (e) {
      console.error("Fehler beim Speichern:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Unternehmens-Einstellungen</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="briefkopf" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="briefkopf">Briefkopf</TabsTrigger>
            <TabsTrigger value="angebot">Angebot</TabsTrigger>
            <TabsTrigger value="rechnung">Rechnung</TabsTrigger>
            <TabsTrigger value="email">E-Mail</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="briefkopf" className="space-y-6">
              <CompanyBriefkopfForm form={form} setForm={setForm} />
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground mb-3">Design & Farben (für alle Dokumente)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tabellen-Header-Farbe</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={form.angebot_header_farbe} onChange={e => setForm(f => ({ ...f, angebot_header_farbe: e.target.value }))} className="h-9 w-14 cursor-pointer rounded border border-input" />
                      <input type="text" value={form.angebot_header_farbe} onChange={e => setForm(f => ({ ...f, angebot_header_farbe: e.target.value }))} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm font-mono flex-1" placeholder="#4682B4" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Footer-Hintergrundfarbe</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={form.pdf_footer_farbe} onChange={e => setForm(f => ({ ...f, pdf_footer_farbe: e.target.value }))} className="h-9 w-14 cursor-pointer rounded border border-input" />
                      <input type="text" value={form.pdf_footer_farbe} onChange={e => setForm(f => ({ ...f, pdf_footer_farbe: e.target.value }))} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm font-mono flex-1" placeholder="#666666" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground mb-3">PDF-Footer (3 Spalten – erscheint auf allen Dokumenten)</p>
                <PdfFooterSettings form={form} setForm={setForm} hideFarbe />
              </div>
            </TabsContent>

            <TabsContent value="angebot" className="space-y-4">
              <AngebotSettings form={form} setForm={setForm} newZeichen={newZeichen} setNewZeichen={setNewZeichen} />
            </TabsContent>

            <TabsContent value="rechnung" className="space-y-4">
              <RechnungSettings form={form} setForm={setForm} />
            </TabsContent>

            <TabsContent value="email" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">E-Mail-Domain für Mitarbeiter</label>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Diese Domain wird beim Anlegen neuer Mitarbeiter als Vorschlag verwendet (z.B. <span className="font-mono">vorname.nachname@domain.de</span>)
                  </p>
                  <input
                    value={form.email_domain || ""}
                    onChange={e => setForm(f => ({ ...f, email_domain: e.target.value }))}
                    placeholder="z.B. meinefirma.de"
                    className="max-w-xs flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  />
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Postfächer & E-Mail-Integration</p>
                  <p>Für die Verbindung von Postfächern (Gmail, Outlook) gehen Sie zu <strong>Postfächer</strong> in der Navigation.</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex gap-2 justify-end mt-6">
          <Button onClick={handleSave} disabled={!form.name || saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Speichern...
              </>
            ) : (
              "Speichern"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}