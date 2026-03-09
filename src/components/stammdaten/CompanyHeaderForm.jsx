import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Palette } from "lucide-react";

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
  });

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
        <CardTitle className="text-base font-semibold">Unternehmens-Briefkopf</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Unternehmensname *</label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="z.B. Muster Bau GmbH"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Logo-URL</label>
            <Input
              value={form.briefkopf_logo_url}
              onChange={e => setForm(f => ({ ...f, briefkopf_logo_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Straße & Hausnummer</label>
            <Input
              value={form.briefkopf_strasse}
              onChange={e => setForm(f => ({ ...f, briefkopf_strasse: e.target.value }))}
              placeholder="z.B. Musterstraße 12"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">PLZ</label>
            <Input
              value={form.briefkopf_plz}
              onChange={e => setForm(f => ({ ...f, briefkopf_plz: e.target.value }))}
              placeholder="z.B. 45127"
              maxLength={5}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Stadt</label>
            <Input
              value={form.briefkopf_stadt}
              onChange={e => setForm(f => ({ ...f, briefkopf_stadt: e.target.value }))}
              placeholder="z.B. Essen"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Telefon</label>
            <Input
              value={form.briefkopf_telefon}
              onChange={e => setForm(f => ({ ...f, briefkopf_telefon: e.target.value }))}
              placeholder="z.B. +49 (0) 201 123456"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">E-Mail</label>
            <Input
              value={form.briefkopf_email}
              onChange={e => setForm(f => ({ ...f, briefkopf_email: e.target.value }))}
              placeholder="z.B. info@muster-bau.de"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Website</label>
            <Input
              value={form.briefkopf_website}
              onChange={e => setForm(f => ({ ...f, briefkopf_website: e.target.value }))}
              placeholder="z.B. www.muster-bau.de"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-2">
              <Palette className="w-3.5 h-3.5" />
              Angebots-Header-Farbe
            </label>
            <div className="flex gap-3 items-center">
              <Input
                type="color"
                value={form.angebot_header_farbe}
                onChange={e => setForm(f => ({ ...f, angebot_header_farbe: e.target.value }))}
                className="h-10 w-16 cursor-pointer"
              />
              <Input
                type="text"
                value={form.angebot_header_farbe}
                onChange={e => setForm(f => ({ ...f, angebot_header_farbe: e.target.value }))}
                placeholder="#4682B4"
                className="flex-1 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">PDF-Footer linke Spalte</label>
            <Textarea
              value={form.pdf_footer_links}
              onChange={e => setForm(f => ({ ...f, pdf_footer_links: e.target.value }))}
              placeholder="z.B.&#10;OWL Bau GmbH&#10;Herforder Straße 285&#10;D-33609 Bielefeld&#10;T: +49 (0)170 / 7762622"
              rows={4}
              className="text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">PDF-Footer mittlere Spalte</label>
            <Textarea
              value={form.pdf_footer_mitte}
              onChange={e => setForm(f => ({ ...f, pdf_footer_mitte: e.target.value }))}
              placeholder="z.B.&#10;Geschäftsführer: Max Mustermann&#10;Bielefeld, HRB 12345&#10;Steuer-Nr. 123/456/789"
              rows={4}
              className="text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">PDF-Footer rechte Spalte</label>
            <Textarea
              value={form.pdf_footer_rechts}
              onChange={e => setForm(f => ({ ...f, pdf_footer_rechts: e.target.value }))}
              placeholder="z.B.&#10;Bank: Musterbank eG&#10;IBAN: DE61 1234 5678 9012 3456 78&#10;BIC: MUSTDE33"
              rows={4}
              className="text-xs"
            />
          </div>
          </div>

        <div className="flex gap-2 justify-end">
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