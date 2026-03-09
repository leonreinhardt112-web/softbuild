import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

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