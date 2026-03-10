import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Palette } from "lucide-react";

export default function PdfFooterSettings({ form, setForm }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">PDF-Footer linke Spalte</label>
          <Textarea
            value={form.pdf_footer_links}
            onChange={e => setForm(f => ({ ...f, pdf_footer_links: e.target.value }))}
            placeholder="z.B.&#10;OWL Bau GmbH&#10;Herforder Straße 285&#10;D-33609 Bielefeld"
            rows={4}
            className="text-xs"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">PDF-Footer mittlere Spalte</label>
          <Textarea
            value={form.pdf_footer_mitte}
            onChange={e => setForm(f => ({ ...f, pdf_footer_mitte: e.target.value }))}
            placeholder="z.B.&#10;Geschäftsführer: Max Mustermann&#10;Bielefeld, HRB 12345"
            rows={4}
            className="text-xs"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">PDF-Footer rechte Spalte</label>
          <Textarea
            value={form.pdf_footer_rechts}
            onChange={e => setForm(f => ({ ...f, pdf_footer_rechts: e.target.value }))}
            placeholder="z.B.&#10;Bank: Musterbank eG&#10;IBAN: DE61 1234 5678 9012 3456 78"
            rows={4}
            className="text-xs"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-2 block">
            <Palette className="w-3.5 h-3.5" />
            PDF-Footer Hintergrundfarbe
          </label>
          <div className="flex gap-3 items-center">
            <Input
              type="color"
              value={form.pdf_footer_farbe}
              onChange={e => setForm(f => ({ ...f, pdf_footer_farbe: e.target.value }))}
              className="h-10 w-16 cursor-pointer"
            />
            <Input
              type="text"
              value={form.pdf_footer_farbe}
              onChange={e => setForm(f => ({ ...f, pdf_footer_farbe: e.target.value }))}
              placeholder="#666666"
              className="flex-1 font-mono text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}