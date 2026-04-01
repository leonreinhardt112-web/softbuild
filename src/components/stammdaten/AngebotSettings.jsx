import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { X, Plus, Palette } from "lucide-react";

export default function AngebotSettings({ form, setForm, newZeichen, setNewZeichen }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-2 block">
            <Palette className="w-3.5 h-3.5" />
            Tabellen-Header-Farbe (gilt für Angebote und alle Dokumente)
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

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Vortext (oben im Angebot)</label>
          <Textarea
            value={form.angebot_vortext || ""}
            onChange={e => setForm(f => ({ ...f, angebot_vortext: e.target.value }))}
            placeholder="Optionaler Text am Anfang des Angebots..."
            rows={4}
            className="text-xs"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Schlusstext (unten im Angebot)</label>
          <Textarea
            value={form.angebot_schlusstext || ""}
            onChange={e => setForm(f => ({ ...f, angebot_schlusstext: e.target.value }))}
            placeholder="Optionaler Text am Ende des Angebots..."
            rows={4}
            className="text-xs"
          />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">„Unser Zeichen" Dropdown-Optionen</label>
          <div className="space-y-2">
            {form.unser_zeichen_optionen && form.unser_zeichen_optionen.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.unser_zeichen_optionen.map((zeichen, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-secondary px-2.5 py-1.5 rounded text-xs">
                    <span className="font-medium">{zeichen}</span>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        unser_zeichen_optionen: f.unser_zeichen_optionen.filter((_, i) => i !== idx)
                      }))}
                      className="hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newZeichen}
                onChange={e => setNewZeichen(e.target.value)}
                placeholder="z.B. JM, AB, Ref-123"
                onKeyDown={e => {
                  if (e.key === "Enter" && newZeichen.trim()) {
                    e.preventDefault();
                    setForm(f => ({
                      ...f,
                      unser_zeichen_optionen: [...(f.unser_zeichen_optionen || []), newZeichen.trim()]
                    }));
                    setNewZeichen("");
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (newZeichen.trim()) {
                    setForm(f => ({
                      ...f,
                      unser_zeichen_optionen: [...(f.unser_zeichen_optionen || []), newZeichen.trim()]
                    }));
                    setNewZeichen("");
                  }
                }}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}