import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";

/**
 * Generiert und lädt eine GAEB DA XML (.x84) Datei herunter.
 * Enthält OZ, Kurztext, Einheit, Menge, EP je Position.
 */
export default function GaebX84Export({ kalkulation, projekt }) {
  const handleExport = () => {
    const positions = kalkulation.positions || [];
    const today = format(new Date(), "yyyy-MM-dd");
    const projNr = projekt?.project_number || "000";
    const projName = projekt?.project_name || "Projekt";

    // GAEB DA XML X84 (Angebotsabgabe mit EP)
    const posXml = positions.map((p, idx) => {
      const oz = p.oz || String(idx + 1).padStart(3, "0");
      const ep = (p.ep || 0).toFixed(3);
      const menge = (p.menge || 0).toFixed(3);
      const einheit = escapeXml(p.einheit || "St.");
      const kurztext = escapeXml(p.short_text || "");
      return `    <BoQCtgy RNoPart="${oz}">
      <Qty>${menge}</Qty>
      <QU>${einheit}</QU>
      <Description>
        <CompleteText>
          <DetailTxt>
            <Text>${kurztext}</Text>
          </DetailTxt>
        </CompleteText>
      </Description>
      <UP>${ep}</UP>
    </BoQCtgy>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA84/3.3">
  <GAEBInfo>
    <Version>3.3</Version>
    <Date>${today}</Date>
    <Conversion>false</Conversion>
  </GAEBInfo>
  <Award>
    <DP>84</DP>
    <Prj>${escapeXml(projNr)}</Prj>
    <Info>
      <Name>${escapeXml(projName)}</Name>
    </Info>
    <BoQ>
      <BoQBody>
${posXml}
      </BoQBody>
    </BoQ>
  </Award>
</GAEB>`;

    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projNr}_${kalkulation.version_name || "Angebot"}.x84`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExport}>
      <Download className="w-3.5 h-3.5" /> GAEB X84 Export
    </Button>
  );
}

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}