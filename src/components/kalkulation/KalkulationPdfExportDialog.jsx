import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function KalkulationPdfExportDialog({ isOpen, onClose, onExport }) {
  const [textMode, setTextMode] = useState("short");
  const [vortext, setVortext] = useState("");
  const [schlusstext, setSchlusstext] = useState("");
  const [unserZeichen, setUnserZeichen] = useState("");
  const [unserZeichenOptionen, setUnserZeichenOptionen] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadStammdaten();
    }
  }, [isOpen]);

  const loadStammdaten = async () => {
    try {
      setLoading(true);
      const companies = await base44.entities.Stammdatum.filter({ typ: "unternehmen", aktiv: true }, undefined, 1);
      if (companies?.length > 0) {
        const company = companies[0];
        setVortext(company.angebot_vortext || "");
        setSchlusstext(company.angebot_schlusstext || "");
        setUnserZeichenOptionen(company.unser_zeichen_optionen || []);
      }
      setUnserZeichen("");
    } catch (err) {
      console.error("Fehler beim Laden der Stammdaten:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    onExport({
      textMode,
      vortext,
      schlusstext,
      unserZeichen
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PDF-Export-Optionen</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Text-Modus */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Textinhalte exportieren</Label>
              <RadioGroup value={textMode} onValueChange={setTextMode}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="short" id="short" />
                  <Label htmlFor="short" className="font-normal cursor-pointer">Nur Kurztext</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="both" id="both" />
                  <Label htmlFor="both" className="font-normal cursor-pointer">Kurztext und Langtext</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Unser Zeichen */}
            <div className="space-y-2">
              <Label htmlFor="unserZeichen" className="text-sm font-semibold">Unser Zeichen</Label>
              {unserZeichenOptionen.length > 0 ? (
                <Select value={unserZeichen} onValueChange={setUnserZeichen}>
                  <SelectTrigger id="unserZeichen">
                    <SelectValue placeholder="Unser Zeichen wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unserZeichenOptionen.map((zeichen, idx) => (
                      <SelectItem key={idx} value={zeichen}>
                        {zeichen}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="unserZeichen"
                  value={unserZeichen}
                  onChange={(e) => setUnserZeichen(e.target.value)}
                  placeholder="Keine Optionen definiert. Bitte in Stammdaten konfigurieren."
                  disabled
                />
              )}
            </div>

            {/* Vortext */}
            <div className="space-y-2">
              <Label htmlFor="vortext" className="text-sm font-semibold">Vortext (oben im Angebot)</Label>
              <Textarea
                id="vortext"
                value={vortext}
                onChange={(e) => setVortext(e.target.value)}
                placeholder="Optionaler Vortext am Anfang des Angebots..."
                className="min-h-24"
              />
            </div>

            {/* Schlusstext */}
            <div className="space-y-2">
              <Label htmlFor="schlusstext" className="text-sm font-semibold">Schlusstext (unten im Angebot)</Label>
              <Textarea
                id="schlusstext"
                value={schlusstext}
                onChange={(e) => setSchlusstext(e.target.value)}
                placeholder="Optionaler Schlusstext am Ende des Angebots..."
                className="min-h-24"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            Als PDF exportieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}