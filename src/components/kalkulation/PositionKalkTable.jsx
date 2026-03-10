import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

const COST_TYPES = ["Lohn", "Material", "Gerät", "NU", "Sonstiges"];

// Maps kostentyp to zuschlaege keys
const ZUSCHLAG_KEYS = {
  Lohn:       { bgk: "lohn_bgk", agk: "lohn_agk", wg: "lohn_wg" },
  Material:   { bgk: "material_bgk", agk: "material_agk", wg: "material_wg" },
  "Gerät":    { bgk: "geraet_bgk", agk: "geraet_agk", wg: "geraet_wg" },
  NU:         { bgk: "nu_bgk", agk: "nu_agk", wg: "nu_wg" },
  Sonstiges:  { bgk: "sonstiges_bgk", agk: "sonstiges_agk", wg: "sonstiges_wg" },
};

function getZuschlagEur(kostentyp, kosten_einheit, zuschlaege) {
  const keys = ZUSCHLAG_KEYS[kostentyp] || ZUSCHLAG_KEYS["Sonstiges"];
  const bgk = Number(zuschlaege[keys.bgk] ?? 10) / 100;
  const agk = Number(zuschlaege[keys.agk] ?? 5) / 100;
  const wg = Number(zuschlaege[keys.wg] ?? 3) / 100;
  const base = Number(kosten_einheit || 0);
  return base * (bgk + agk + wg);
}

const UNITS = ["h", "m", "m²", "m³", "St.", "t", "kg"];

function newRow() {
  return { id: crypto.randomUUID(), name: "", beschreibung: "", kostentyp: "Lohn", menge: 1, einheit: "h", kosten_einheit: 0 };
}

export default function PositionKalkTable({ rows = [], onRowsChange, zuschlaege = {} }) {
  const handleChange = (id, field, value) => {
    onRowsChange(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  const handleAdd = () => onRowsChange([...rows, newRow()]);
  const handleDelete = (id) => onRowsChange(rows.filter(r => r.id !== id));

  const totalEP = rows.reduce((sum, r) => {
    const zuschlag = getZuschlagEur(r.kostentyp, r.kosten_einheit, zuschlaege);
    return sum + Number(r.kosten_einheit || 0) + zuschlag;
  }, 0);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              {["Name", "Beschreibung", "Kostentyp", "Einheit", "Menge", "Kosten/Einheit (€)", "Gesamtkosten (€)", "Zuschlag (€)", "Einheitspreis (€)", ""].map((h, i) => (
                <th key={i} className={`px-2 py-2 font-medium text-muted-foreground whitespace-nowrap ${i >= 4 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Noch keine Kalkulationszeilen. Klicke auf „+ Zeile hinzufügen".
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const gesamtkosten = Number(row.menge || 0) * Number(row.kosten_einheit || 0);
              const zuschlag = getZuschlagEur(row.kostentyp, row.kosten_einheit, zuschlaege);
              const ep = Number(row.kosten_einheit || 0) + zuschlag;
              return (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-1 py-1">
                    <Input value={row.name} onChange={e => handleChange(row.id, "name", e.target.value)} className="h-7 text-xs min-w-[100px] border-0 bg-transparent focus:bg-background focus:border focus:border-input" placeholder="Name..." />
                  </td>
                  <td className="px-1 py-1">
                    <Input value={row.beschreibung} onChange={e => handleChange(row.id, "beschreibung", e.target.value)} className="h-7 text-xs min-w-[120px] border-0 bg-transparent focus:bg-background focus:border focus:border-input" placeholder="Beschreibung..." />
                  </td>
                  <td className="px-1 py-1">
                    <Select value={row.kostentyp} onValueChange={v => handleChange(row.id, "kostentyp", v)}>
                      <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COST_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-1 py-1">
                    <Input 
                      value={row.einheit} 
                      onChange={e => handleChange(row.id, "einheit", e.target.value)} 
                      list="units-list"
                      className="h-7 text-xs w-20 border-0 bg-transparent focus:bg-background focus:border focus:border-input text-center" 
                      placeholder="h" 
                    />
                    <datalist id="units-list">
                      {UNITS.map(u => <option key={u} value={u} />)}
                    </datalist>
                  </td>
                  <td className="px-1 py-1">
                    <Input type="number" value={row.menge} onChange={e => handleChange(row.id, "menge", parseFloat(e.target.value) || 0)} className="h-7 text-xs w-20 text-right border-0 bg-transparent focus:bg-background focus:border focus:border-input" />
                  </td>
                  <td className="px-1 py-1">
                    <Input type="number" value={row.kosten_einheit} onChange={e => handleChange(row.id, "kosten_einheit", parseFloat(e.target.value) || 0)} className="h-7 text-xs w-24 text-right border-0 bg-transparent focus:bg-background focus:border focus:border-input" />
                  </td>
                  <td className="px-3 py-1 text-right font-medium tabular-nums">{gesamtkosten.toFixed(2)}</td>
                  <td className="px-3 py-1 text-right text-muted-foreground tabular-nums">{zuschlag.toFixed(2)}</td>
                  <td className="px-3 py-1 text-right font-semibold text-primary tabular-nums">{ep.toFixed(2)}</td>
                  <td className="px-1 py-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(row.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-muted/30 border-t-2 border-border">
                <td colSpan={8} className="px-3 py-2 text-xs font-semibold text-right text-muted-foreground">Einheitspreis gesamt</td>
                <td className="px-3 py-2 text-right text-sm font-bold text-primary tabular-nums">{totalEP.toFixed(2)} €</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleAdd}>
        <Plus className="w-3.5 h-3.5" />Zeile hinzufügen
      </Button>
    </div>
  );
}