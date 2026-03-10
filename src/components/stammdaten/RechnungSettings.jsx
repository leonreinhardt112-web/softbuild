import React from "react";
import { Textarea } from "@/components/ui/textarea";

export default function RechnungSettings({ form, setForm }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Vortext (oben in der Rechnung)</label>
          <Textarea
            value={form.rechnung_vortext || ""}
            onChange={e => setForm(f => ({ ...f, rechnung_vortext: e.target.value }))}
            placeholder="Optionaler Text am Anfang der Rechnung..."
            rows={4}
            className="text-xs"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Schlusstext (unten in der Rechnung)</label>
          <Textarea
            value={form.rechnung_schlusstext || ""}
            onChange={e => setForm(f => ({ ...f, rechnung_schlusstext: e.target.value }))}
            placeholder="Optionaler Text am Ende der Rechnung..."
            rows={4}
            className="text-xs"
          />
        </div>
      </div>
    </div>
  );
}