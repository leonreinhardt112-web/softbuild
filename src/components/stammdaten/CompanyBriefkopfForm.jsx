import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Palette } from "lucide-react";

export default function CompanyBriefkopfForm({ form, setForm }) {
  return (
    <div className="space-y-4">
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
    </div>
  );
}