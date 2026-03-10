import { jsPDF } from "jspdf";

const fmt = (val, dec = 2) =>
  val != null && val !== "" && !isNaN(val)
    ? Number(val).toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : "";

const fmtPct = (val) => (val != null && !isNaN(val) ? Number(val).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "");

// ─────────────────────────────────────────────
// EFB 221 – Preisermittlung bei Zuschlagskalkulation
// ─────────────────────────────────────────────
export async function generateEFB221(project, kalkulation, stammdaten) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const z = kalkulation?.zuschlaege || {};
  const W = 210;
  const mL = 20;
  const mR = W - 20;
  const cW = mR - mL; // 170mm

  doc.setLineWidth(0.3);

  const text = (txt, x, y, opts = {}) => {
    doc.setFontSize(opts.size || 9);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    if (opts.align === "right") doc.text(String(txt ?? ""), x, y, { align: "right" });
    else if (opts.align === "center") doc.text(String(txt ?? ""), x, y, { align: "center" });
    else doc.text(String(txt ?? ""), x, y);
  };

  // ── SEITE 1 ─────────────────────────────────────────────────────────────

  // Kennnummer oben rechts
  text("221", mR, 12, { bold: true, size: 16 });
  text("(Preisermittlung bei Zuschlagskalkulation)", mR, 17, { size: 7, align: "right" });

  let y = 22;
  const firm = stammdaten?.find((s) => s.typ === "unternehmen");

  // ── Bieter / Vergabenummer / Datum ─────────────────────────────────────
  // Zwei Zeilen: Labelezeile + Wertezeile → je 6mm hoch
  const bieterW = cW * 0.5;
  const vergabeW = cW * 0.3;
  const datumW = cW - bieterW - vergabeW;

  doc.rect(mL, y, bieterW, 6);
  doc.rect(mL + bieterW, y, vergabeW, 6);
  doc.rect(mL + bieterW + vergabeW, y, datumW, 6);
  text("Bieter", mL + 1, y + 4.5, { size: 7 });
  text("Vergabenummer", mL + bieterW + 1, y + 4.5, { size: 7 });
  text("Datum", mL + bieterW + vergabeW + 1, y + 4.5, { size: 7 });
  y += 6;

  doc.rect(mL, y, bieterW, 7);
  doc.rect(mL + bieterW, y, vergabeW, 7);
  doc.rect(mL + bieterW + vergabeW, y, datumW, 7);
  text(firm?.name || "", mL + 1, y + 5, { size: 9, bold: true });
  text(project?.project_number || "", mL + bieterW + 1, y + 5, { size: 9, bold: true });
  text(new Date().toLocaleDateString("de-DE"), mL + bieterW + vergabeW + 1, y + 5, { size: 9 });
  y += 7;

  // ── Baumaßnahme ─────────────────────────────────────────────────────────
  doc.rect(mL, y, cW, 6);
  text("Baumaßnahme", mL + 1, y + 4.5, { size: 7 });
  y += 6;
  doc.rect(mL, y, cW, 10);
  const projName = project?.project_name || "";
  // Wrap long names
  const nameLines = doc.splitTextToSize(projName, cW - 3);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(nameLines.slice(0, 2), mL + 1, y + 5);
  y += 10;

  // ── Leistung ────────────────────────────────────────────────────────────
  doc.rect(mL, y, cW, 6);
  text("Leistung", mL + 1, y + 4.5, { size: 7 });
  y += 6;
  doc.rect(mL, y, cW, 10);
  const leistung = (project?.selected_trades || []).join(", ") || (project?.location || "");
  const leistungLines = doc.splitTextToSize(leistung, cW - 3);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(leistungLines.slice(0, 2), mL + 1, y + 5);
  y += 10;

  y += 3;

  // ── "Angaben zur Kalkulation..." Überschrift ───────────────────────────
  text("Angaben zur Kalkulation mit vorbestimmten Zuschlägen", mL, y + 4, { bold: true, size: 9 });
  y += 8;

  // ── Section 1: Verrechnungslohn ─────────────────────────────────────────
  // Spalten: Nr(10) | Label(cW-10-col2W-col3W) | Zuschlag%(col2W) | €/h(col3W)
  const s1numW = 10;
  const s1col2W = 22; // Zuschlag %
  const s1col3W = 22; // €/h
  const s1labelW = cW - s1numW - s1col2W - s1col3W;

  // Section-1 Header
  doc.rect(mL, y, s1numW, 8);
  doc.rect(mL + s1numW, y, s1labelW, 8);
  doc.rect(mL + s1numW + s1labelW, y, s1col2W, 8);
  doc.rect(mL + s1numW + s1labelW + s1col2W, y, s1col3W, 8);
  text("1", mL + 2, y + 5.5, { bold: true, size: 9 });
  text("Angaben über den Verrechnungslohn", mL + s1numW + 2, y + 5.5, { bold: true, size: 9 });
  text("Zuschlag", mL + s1numW + s1labelW + s1col2W / 2, y + 3.5, { size: 7, align: "center" });
  text("%", mL + s1numW + s1labelW + s1col2W / 2, y + 7, { size: 7, align: "center" });
  text("€/h", mL + s1numW + s1labelW + s1col2W + s1col3W / 2, y + 5.5, { size: 7, align: "center" });
  y += 8;

  const lohnRows = [
    { nr: "1.1", label: "Mittellohn ML", sub: "einschl. Lohnzulagen u. Lohnerhöhung, wenn keine Lohngleitklausel vereinbart wird" },
    { nr: "1.2", label: "Lohngebundene Kosten", sub: "Sozialkosten und Soziallöhne, als Zuschlag auf ML" },
    { nr: "1.3", label: "Lohnnebenkosten", sub: "Auslösungen, Fahrgelder, als Zuschlag auf ML" },
    { nr: "1.4", label: "Kalkulationslohn KL", sub: "(Summe 1.1 bis 1.3)" },
    { nr: "1.5", label: "Zuschlag auf Kalkulationslohn", sub: "(aus Zeile 2.4, Spalte 1)" },
    { nr: "1.6", label: "Verrechnungslohn VL", sub: "(Summe 1.4 und 1.5, VL im Formblatt 223 berücksichtigen)" },
  ];

  // Verrechnungslohn-Berechnungen
  const ml     = Number(z.ml_euro)  || 0;
  const lgkPct = Number(z.lgk_pct) || 0;
  const lnkPct = Number(z.lnk_pct) || 0;
  const kl     = ml * (1 + lgkPct / 100 + lnkPct / 100);
  const totalLohnZ = (Number(z.lohn_bgk) || 0) + (Number(z.lohn_agk) || 0) + (Number(z.lohn_wg) || 0);
  const vl     = kl * (1 + totalLohnZ / 100);

  lohnRows.forEach((row) => {
    const rh = 13;
    doc.rect(mL, y, s1numW, rh);
    doc.rect(mL + s1numW, y, s1labelW, rh);
    doc.rect(mL + s1numW + s1labelW, y, s1col2W, rh);
    doc.rect(mL + s1numW + s1labelW + s1col2W, y, s1col3W, rh);
    text(row.nr, mL + 2, y + 5, { bold: true, size: 9 });
    text(row.label, mL + s1numW + 2, y + 5, { bold: true, size: 9 });
    if (row.sub) text(row.sub, mL + s1numW + 2, y + 9.5, { size: 6.5 });

    const pctX = mL + s1numW + s1labelW + s1col2W - 2;
    const eurX = mL + s1numW + s1labelW + s1col2W + s1col3W - 2;
    if (row.nr === "1.1" && ml > 0)  text(fmt(ml, 2),  eurX, y + 7, { size: 8, align: "right" });
    if (row.nr === "1.2" && lgkPct > 0) { text(fmtPct(lgkPct), pctX, y + 7, { size: 8, align: "right" }); if (ml > 0) text(fmt(ml * lgkPct / 100, 2), eurX, y + 7, { size: 8, align: "right" }); }
    if (row.nr === "1.3" && lnkPct > 0) { text(fmtPct(lnkPct), pctX, y + 7, { size: 8, align: "right" }); if (ml > 0) text(fmt(ml * lnkPct / 100, 2), eurX, y + 7, { size: 8, align: "right" }); }
    if (row.nr === "1.4" && kl > 0)  text(fmt(kl, 2),  eurX, y + 7, { size: 8, align: "right" });
    if (row.nr === "1.5") { text(fmtPct(totalLohnZ), pctX, y + 7, { size: 8, align: "right" }); if (kl > 0) text(fmt(kl * totalLohnZ / 100, 2), eurX, y + 7, { size: 8, align: "right" }); }
    if (row.nr === "1.6" && vl > 0)  text(fmt(vl, 2),  eurX, y + 7, { size: 8, align: "right" });
    y += rh;
  });

  y += 5;

  // ── Section 2: Zuschläge ─────────────────────────────────────────────────
  // Section-2 Header (breite Zeile)
  const s2numW = 10;
  const s2labelW = 48;
  const s2dataW = (cW - s2numW - s2labelW) / 5;

  doc.rect(mL, y, cW, 8);
  text("2", mL + 2, y + 5.5, { bold: true, size: 9 });
  text("Zuschläge auf die Einzelkosten der Teilleistungen = unmittelbare Herstellungskosten", mL + s2numW + 2, y + 5.5, { bold: true, size: 8 });
  y += 8;

  // Sub-Header: Leerzeile mit "Zuschläge in % auf" oben, Spaltennamen unten
  // Obere Headerzeile: nur Spalten ohne Inhalt + "Zuschläge in % auf" Überschrift
  const subHdrH1 = 6;
  doc.rect(mL, y, s2numW, subHdrH1);
  doc.rect(mL + s2numW, y, s2labelW, subHdrH1);
  const valZoneStart = mL + s2numW + s2labelW;
  const valZoneW = s2dataW * 5;
  doc.rect(valZoneStart, y, valZoneW, subHdrH1);
  text("Zuschläge in % auf", valZoneStart + valZoneW / 2, y + 4.2, { size: 7, align: "center" });
  y += subHdrH1;

  // Spalten-Header Zeile
  const colHeaders = ["Lohn", "Stoffkosten", "Geräte-\nkosten", "Sonstige Kos-\nten", "Nachunter-\nnehmer-\nleistungen"];
  const subHdrH2 = 14;
  doc.rect(mL, y, s2numW, subHdrH2);
  doc.rect(mL + s2numW, y, s2labelW, subHdrH2);
  colHeaders.forEach((h, i) => {
    const cx = valZoneStart + i * s2dataW;
    doc.rect(cx, y, s2dataW, subHdrH2);
    const lines = h.split("\n");
    const startY = y + subHdrH2 / 2 - (lines.length - 1) * 2.2;
    lines.forEach((l, li) => text(l, cx + s2dataW / 2, startY + li * 4, { size: 6.5, align: "center" }));
  });
  y += subHdrH2;

  const bgkRow = [z.lohn_bgk, z.material_bgk, z.geraet_bgk, z.sonstiges_bgk, z.nu_bgk];
  const agkRow = [z.lohn_agk, z.material_agk, z.geraet_agk, z.sonstiges_agk, z.nu_agk];
  const wgRow  = [z.lohn_wg,  z.material_wg,  z.geraet_wg,  z.sonstiges_wg,  z.nu_wg];
  const totRow = bgkRow.map((_, i) =>
    (Number(bgkRow[i]) || 0) + (Number(agkRow[i]) || 0) + (Number(wgRow[i]) || 0)
  );

  // Datareihen: 2.1, 2.2, 2.3 (mit Kreuzschraffur), 2.3.1, 2.3.2, 2.3.3, 2.4
  const sec2Rows = [
    { nr: "2.1",   label: "Baustellengemeinkosten",     vals: bgkRow, bold: true, hatch: false },
    { nr: "2.2",   label: "Allgemeine Geschäftskosten", vals: agkRow, bold: true, hatch: false },
    { nr: "2.3",   label: "Wagnis und Gewinn",          vals: null,   bold: true, hatch: true  },
    { nr: "2.3.1", label: "Gewinn",                     vals: null,   bold: true, hatch: false },
    { nr: "2.3.2", label: "betriebsbezogenes Wagnis\u00b9", vals: null, bold: true, hatch: false },
    { nr: "2.3.3", label: "leistungsbezogenes Wagnis\u00b2", vals: null, bold: true, hatch: false },
    { nr: "2.4",   label: "Gesamtzuschläge",            vals: totRow, bold: true, hatch: false },
  ];

  sec2Rows.forEach((row) => {
    const rh = 9;
    doc.rect(mL, y, s2numW, rh);
    doc.rect(mL + s2numW, y, s2labelW, rh);
    text(row.nr, mL + 2, y + 6, { bold: true, size: 8 });
    text(row.label, mL + s2numW + 2, y + 6, { bold: row.bold, size: 8 });

    for (let i = 0; i < 5; i++) {
      const cx = valZoneStart + i * s2dataW;
      doc.rect(cx, y, s2dataW, rh);
      if (row.hatch) {
        // Kreuzschraffur für 2.3
        doc.setLineWidth(0.2);
        doc.line(cx, y, cx + s2dataW, y + rh);
        doc.line(cx, y + rh, cx + s2dataW, y);
        doc.setLineWidth(0.3);
      } else if (row.vals) {
        const v = row.vals[i];
        if (v != null) text(fmtPct(v), cx + s2dataW - 2, y + 6, { size: 8, align: "right" });
      }
    }
    y += rh;
  });

  // Fußnoten Seite 1
  y += 8;
  doc.setLineWidth(0.3);
  doc.line(mL, y, mL + 55, y);
  y += 3.5;
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.text("\u00b9 Wagnis f\u00fcr das allgemeine Unternehmensrisiko", mL, y);
  y += 4;
  doc.text("\u00b2 Mit der Ausf\u00fchrung der Leistungen verbundenes Wagnis", mL, y);

  // Footer Seite 1
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("\u00a9", mL, 289);
  doc.setFont("helvetica", "normal");
  doc.text(" VHB - Bund - Ausgabe 2017", mL + 3, 289);
  doc.text("Seite 1 von 2", mR, 289, { align: "right" });

  // ── SEITE 2 ─────────────────────────────────────────────────────────────
  doc.addPage();
  doc.setLineWidth(0.3);

  text("221", mR, 12, { bold: true, size: 16 });
  text("(Preisermittlung bei Zuschlagskalkulation)", mR, 17, { size: 7, align: "right" });

  y = 22;

  // ── Section 3: Ermittlung der Angebotssumme ────────────────────────────
  // Spalten: Nr(10) | Label(s3labelW) | EK(s3ekW) | Zuschlag%(s3zW) | Angebotssumme(s3asW)
  const s3numW  = 10;
  const s3asW   = 35;  // Angebotssumme
  const s3zW    = 25;  // Gesamtzuschläge %
  const s3ekW   = 40;  // Einzelkosten €
  const s3labelW = cW - s3numW - s3ekW - s3zW - s3asW;

  // Section 3 Header
  doc.rect(mL, y, s3numW, 8);
  doc.rect(mL + s3numW, y, s3labelW + s3ekW + s3zW + s3asW, 8);
  text("3.", mL + 2, y + 5.5, { bold: true, size: 9 });
  text("Ermittlung der Angebotssumme", mL + s3numW + 2, y + 5.5, { bold: true, size: 9 });
  y += 8;

  // Spalten-Header für Section 3
  const s3hdrH = 28;
  doc.rect(mL, y, s3numW, s3hdrH);
  doc.rect(mL + s3numW, y, s3labelW, s3hdrH);
  doc.rect(mL + s3numW + s3labelW, y, s3ekW, s3hdrH);
  doc.rect(mL + s3numW + s3labelW + s3ekW, y, s3zW, s3hdrH);
  doc.rect(mL + s3numW + s3labelW + s3ekW + s3zW, y, s3asW, s3hdrH);

  // EK-Spalte Header
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  const ekHdrX = mL + s3numW + s3labelW + 2;
  doc.text("Einzelkosten der", ekHdrX, y + 6);
  doc.text("Teilleistungen =", ekHdrX, y + 10);
  doc.text("unmittelbare Her-", ekHdrX, y + 14);
  doc.text("stellungskosten", ekHdrX, y + 18);
  doc.text("\u20ac", ekHdrX, y + 23);

  // Gesamtzuschläge-Spalte Header
  const zHdrX = mL + s3numW + s3labelW + s3ekW + 2;
  doc.text("Gesamt-", zHdrX, y + 8);
  doc.text("zuschlä-", zHdrX, y + 12);
  doc.text("ge", zHdrX, y + 16);
  doc.text("gem. 2.4", zHdrX, y + 20);
  doc.text("%", zHdrX, y + 25);

  // Angebotssumme-Spalte Header
  const asHdrX = mL + s3numW + s3labelW + s3ekW + s3zW + 2;
  doc.text("Angebotssumme", asHdrX, y + 10);
  doc.text("\u20ac", asHdrX, y + 25);
  y += s3hdrH;

  // Aggregierte Werte
  const allRows = (kalkulation?.positions || []).flatMap((p) => p.rows || []);
  const sumByType = { Lohn: 0, Material: 0, "Gerät": 0, NU: 0, Sonstiges: 0 };
  allRows.forEach((r) => {
    const t = r.kostentyp in sumByType ? r.kostentyp : "Sonstiges";
    sumByType[t] += Number(r.kosten_einheit || 0);
  });

  const typeZuschlaege = {
    Lohn: totRow[0], Material: totRow[1], "Gerät": totRow[2], Sonstiges: totRow[3], NU: totRow[4],
  };

  const sec3Rows = [
    { nr: "3.1", label: "Eigene Lohnkosten",       sub: "Verrechnungslohn (1.6)  \u00d7  Gesamtstunden", type: "Lohn",      hatch: true },
    { nr: "3.2", label: "Stoffkosten",             sub: "(einschl. Kosten f\u00fcr Hilfsstoffe)",           type: "Material",  hatch: false },
    { nr: "3.3", label: "Gerätekosten",            sub: "(einschlie\u00dflich Kosten f\u00fcr Energie und Betriebsstoffe)", type: "Gerät", hatch: false },
    { nr: "3.4", label: "Sonstige Kosten",         sub: "(vom Bieter zu erl\u00e4utern)",                  type: "Sonstiges", hatch: false },
    { nr: "3.5", label: "Nachunternehmerleistungen \u00b3", sub: "",                                       type: "NU",        hatch: false },
  ];

  let angebotssumme = 0;
  sec3Rows.forEach((row) => {
    const ekX = mL + s3numW + s3labelW;
    const zX  = ekX + s3ekW;
    const asX = zX + s3zW;

    if (row.nr === "3.1") {
      // ── Zeile A: Label + Subtext + Felder ──────────────────────────────
      const rhA = 14;
      doc.rect(mL, y, s3numW, rhA);
      doc.rect(mL + s3numW, y, s3labelW, rhA);
      doc.rect(ekX, y, s3ekW, rhA);
      doc.rect(zX, y, s3zW, rhA);
      doc.rect(asX, y, s3asW, rhA);
      text("3.1", mL + 2, y + 5, { bold: true, size: 9 });
      text("Eigene Lohnkosten", mL + s3numW + 2, y + 5, { bold: true, size: 9 });
      text("Verrechnungslohn (1.6)  \u00d7  Gesamtstunden", mL + s3numW + 2, y + 10, { size: 7.5 });
      // Kreuzschraffur
      doc.setLineWidth(0.25);
      doc.line(asX, y, asX + s3asW, y + rhA);
      doc.line(asX, y + rhA, asX + s3asW, y);
      doc.setLineWidth(0.3);
      // Werte
      const ek31 = sumByType["Lohn"] || 0;
      const pct31 = typeZuschlaege["Lohn"] || 0;
      if (ek31 > 0) {
        text(fmt(ek31), ekX + s3ekW - 2, y + 8, { size: 8, align: "right" });
        text(fmtPct(pct31), zX + s3zW - 2, y + 8, { size: 8, align: "right" });
      }
      y += rhA;

      // ── Zeile B: VL | × | Gesamtstunden ───────────────────────────────
      const rhB = 10;
      doc.rect(mL, y, s3numW, rhB);
      doc.rect(mL + s3numW, y, s3labelW, rhB);
      doc.rect(ekX, y, s3ekW, rhB);
      doc.rect(zX, y, s3zW, rhB);
      doc.rect(asX, y, s3asW, rhB);
      // "x" zentriert in Label-Spalte
      text("x", mL + s3numW + s3labelW / 2, y + 6.5, { size: 9, align: "center" });
      // Kreuzschraffur
      doc.setLineWidth(0.25);
      doc.line(asX, y, asX + s3asW, y + rhB);
      doc.line(asX, y + rhB, asX + s3asW, y);
      doc.setLineWidth(0.3);
      y += rhB;
      return;
    }

    const rh = 14;
    doc.rect(mL, y, s3numW, rh);
    doc.rect(mL + s3numW, y, s3labelW, rh);
    doc.rect(ekX, y, s3ekW, rh);
    doc.rect(zX, y, s3zW, rh);
    doc.rect(asX, y, s3asW, rh);

    text(row.nr, mL + 2, y + 5, { bold: true, size: 9 });
    text(row.label, mL + s3numW + 2, y + 5, { bold: true, size: 9 });
    if (row.sub) text(row.sub, mL + s3numW + 2, y + 10, { size: 7.5 });

    const ek = sumByType[row.type] || 0;
    const pct = typeZuschlaege[row.type] || 0;
    const as = ek * (1 + pct / 100);
    angebotssumme += as;

    if (ek > 0) {
      text(fmt(ek), ekX + s3ekW - 2, y + 8, { size: 8, align: "right" });
      text(fmtPct(pct), zX + s3zW - 2, y + 8, { size: 8, align: "right" });
      text(fmt(as), asX + s3asW - 2, y + 8, { size: 8, align: "right" });
    }
    y += rh;
  });

  // Angebotssumme Footer-Zeile
  const fh = 10;
  doc.rect(mL, y, s3numW + s3labelW + s3ekW + s3zW, fh);
  doc.rect(mL + s3numW + s3labelW + s3ekW + s3zW, y, s3asW, fh);
  text("Angebotssumme ohne Umsatzsteuer", mL + 2, y + 6.5, { bold: true, size: 10 });
  text(angebotssumme > 0 ? fmt(angebotssumme) : "", mL + s3numW + s3labelW + s3ekW + s3zW + s3asW - 2, y + 6.5, { align: "right", size: 9, bold: true });
  y += fh;

  // Erläuterungen
  y += 8;
  text("eventuelle Erläuterungen des Bieters:", mL, y, { size: 8 });
  y += 5;
  // Linienfeld für Erläuterungen (12 Zeilen)
  for (let i = 0; i < 12; i++) {
    doc.rect(mL, y + i * 8, cW, 8);
  }

  // Fußnoten Seite 2
  const fn2Y = 264;
  doc.setLineWidth(0.3);
  doc.line(mL, fn2Y, mL + 60, fn2Y);
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.text("3  Auf Verlangen sind f\u00fcr diese Leistungen die Angaben zur Kalkulation der(s) Nachunternehmer(s) dem Auftraggeber vorzulegen.", mL, fn2Y + 4);

  // Footer Seite 2
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("\u00a9", mL, 289);
  doc.setFont("helvetica", "normal");
  doc.text(" VHB - Bund - Ausgabe 2017", mL + 3, 289);
  doc.text("Seite 2 von 2", mR, 289, { align: "right" });

  doc.save(`EFB_221_${project?.project_number || "Kalkulation"}.pdf`);
}

// ─────────────────────────────────────────────
// EFB 223 – Aufgliederung der Einheitspreise
// ─────────────────────────────────────────────
export async function generateEFB223(project, kalkulation) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const z = kalkulation?.zuschlaege || {};
  const W = 297;
  const mL = 15;
  const mR = W - 15;
  const cW = mR - mL;

  const text = (txt, x, y, opts = {}) => {
    doc.setFontSize(opts.size || 8);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    if (opts.align === "right") doc.text(String(txt ?? ""), x, y, { align: "right" });
    else if (opts.align === "center") doc.text(String(txt ?? ""), x, y, { align: "center" });
    else doc.text(String(txt ?? ""), x, y);
  };

  // Kostentyp → Zuschlag-Keys (NU fließt in Sonstiges)
  const COST_KEYS = {
    Lohn:      { bgk: "lohn_bgk",      agk: "lohn_agk",      wg: "lohn_wg" },
    Material:  { bgk: "material_bgk",  agk: "material_agk",  wg: "material_wg" },
    "Gerät":   { bgk: "geraet_bgk",    agk: "geraet_agk",    wg: "geraet_wg" },
    NU:        { bgk: "nu_bgk",        agk: "nu_agk",        wg: "nu_wg" },
    Sonstiges: { bgk: "sonstiges_bgk", agk: "sonstiges_agk", wg: "sonstiges_wg" },
  };

  const applyMarkup = (ek, kostentyp) => {
    const key = COST_KEYS[kostentyp] || COST_KEYS["Sonstiges"];
    const bgk = Number(z[key.bgk] ?? 0) / 100;
    const agk = Number(z[key.agk] ?? 0) / 100;
    const wg  = Number(z[key.wg]  ?? 0) / 100;
    return ek * (1 + bgk) * (1 + agk) * (1 + wg);
  };

  // Aggregiert EK+Zuschläge je Anzeigespalte (Lohn, Stoffe, Geräte, Sonstiges inkl. NU)
  const getColValues = (rows) => {
    const res = { Lohn: 0, Material: 0, "Gerät": 0, Sonstiges: 0 };
    rows.forEach((r) => {
      const ek = Number(r.kosten_einheit || 0);
      const typ = r.kostentyp;
      const withMarkup = applyMarkup(ek, typ);
      if (typ === "Lohn") res.Lohn += withMarkup;
      else if (typ === "Material") res.Material += withMarkup;
      else if (typ === "Gerät") res["Gerät"] += withMarkup;
      else res.Sonstiges += withMarkup; // NU + Sonstiges → Sonstiges
    });
    return res;
  };

  const positions = (kalkulation?.positions || []).filter((p) => (p.rows || []).length > 0);

  // ── Column layout ──────────────────────────────
  // Sp. 1=OZ, 2=Kurztext, 3=Menge, 4=Einh., 5=Zeitansatz, 6=Löhne, 7=Stoffe, 8=Geräte, 9=Sonstiges, 10=EP
  const colOZ   = 20;
  const colKT   = 62;
  const colMge  = 18;
  const colEinh = 13;
  const colZeit = 16;
  const remaining = cW - colOZ - colKT - colMge - colEinh - colZeit;
  const colVal  = remaining / 5; // 5 Wertspalten

  const cols = [
    { label: "OZ\ndes\nLV ¹", w: colOZ },
    { label: "Kurzbezeichnung d. Teilleistung ¹", w: colKT },
    { label: "Menge ¹", w: colMge },
    { label: "Mengen-\neinheit", w: colEinh },
    { label: "Zeitan-\nsatz ²", w: colZeit },
    { label: "Löhne ²,³", w: colVal },
    { label: "Stoffe ²", w: colVal },
    { label: "Geräte ²,⁴", w: colVal },
    { label: "Sonstiges ²", w: colVal },
    { label: "Angebotener\nEinheitspreis\n(Sp. 6+7+8+9)", w: colVal },
  ];

  let pageNum = 1;

  const drawPageHeader = () => {
    // Kennnummer
    text("223", mR, 10, { bold: true, size: 14 });
    text("(Aufgliederung der Einheitspreise)", mR, 15, { size: 7, align: "right" });

    doc.setLineWidth(0.3);
    const metaY = 18;
    // Bieter | Vergabenummer | Datum
    doc.rect(mL, metaY, cW * 0.45, 8);
    doc.rect(mL + cW * 0.45, metaY, cW * 0.33, 8);
    doc.rect(mL + cW * 0.78, metaY, cW * 0.22, 8);
    text("Bieter", mL + 1, metaY + 3.5, { size: 6 });
    text("Vergabenummer", mL + cW * 0.45 + 1, metaY + 3.5, { size: 6 });
    text(project?.project_number || "", mL + cW * 0.45 + 1, metaY + 7, { size: 7.5, bold: true });
    text("Datum", mL + cW * 0.78 + 1, metaY + 3.5, { size: 6 });

    // Baumaßnahme
    const bauY = metaY + 8;
    doc.rect(mL, bauY, cW, 12);
    text("Baumaßnahme", mL + 1, bauY + 4, { size: 6 });
    text(project?.project_name || "", mL + 1, bauY + 10, { size: 8, bold: true });

    // Leistung
    const lY = bauY + 12;
    doc.rect(mL, lY, cW, 10);
    text("Leistung", mL + 1, lY + 4, { size: 6 });
    const leistung = (project?.selected_trades || []).join(", ") || (project?.location || "");
    text(leistung, mL + 1, lY + 9, { size: 8, bold: true });

    const titleY = lY + 14;
    text("Aufgliederung der Einheitspreise", mL, titleY, { bold: true, size: 9 });

    return titleY + 5;
  };

  const drawTableHeader = (y) => {
    // Oberer Subheader: "Teilkosten einschl. Zuschläge..."
    const thH1 = 8;
    const valStart = mL + colOZ + colKT + colMge + colEinh + colZeit;
    const valTotal = colVal * 5;
    doc.setFillColor(235, 235, 235);
    doc.rect(valStart, y, valTotal, thH1, "F");
    doc.rect(valStart, y, valTotal, thH1);
    text("Teilkosten einschl. Zuschläge in €", valStart + valTotal / 2, y + 3.5, { size: 6, align: "center" });
    text("(ohne Umsatzsteuer) je Mengeneinheit ²", valStart + valTotal / 2, y + 7, { size: 6, align: "center" });

    const thH2 = 12;
    const y2 = y + thH1;
    doc.setFillColor(235, 235, 235);
    doc.rect(mL, y2, cW, thH2, "F");
    let cx = mL;
    cols.forEach((c, i) => {
      doc.rect(cx, y2, c.w, thH2);
      text(c.label, cx + c.w / 2, y2 + 4.5, { size: 5.5, align: "center" });
      cx += c.w;
    });

    // Spaltennummern
    const numH = 5;
    const y3 = y2 + thH2;
    doc.setFillColor(235, 235, 235);
    doc.rect(mL, y3, cW, numH, "F");
    cx = mL;
    cols.forEach((c, i) => {
      doc.rect(cx, y3, c.w, numH);
      text(String(i + 1), cx + c.w / 2, y3 + 3.5, { size: 5.5, align: "center" });
      cx += c.w;
    });

    return y3 + numH;
  };

  let y = drawPageHeader();
  y = drawTableHeader(y);

  // ── Positionen ──────────────────────────────
  positions.forEach((pos) => {
    if (y > 185) {
      doc.addPage("a4", "landscape");
      pageNum++;
      y = drawPageHeader();
      y = drawTableHeader(y);
    }

    const rows = pos.rows || [];
    const colVals = getColValues(rows);
    const epGesamt = colVals.Lohn + colVals.Material + colVals["Gerät"] + colVals.Sonstiges;
    const rh = 9;

    const vals = [
      pos.oz || "",
      (pos.short_text || "").substring(0, 38),
      fmt(pos.menge, 3),
      pos.einheit || "",
      "", // Zeitansatz – leer lassen
      colVals.Lohn > 0     ? fmt(colVals.Lohn)       : "",
      colVals.Material > 0 ? fmt(colVals.Material)    : "",
      colVals["Gerät"] > 0 ? fmt(colVals["Gerät"])    : "",
      colVals.Sonstiges > 0? fmt(colVals.Sonstiges)   : "",
      epGesamt > 0         ? fmt(epGesamt)             : "",
    ];

    let cx = mL;
    cols.forEach((c, i) => {
      doc.rect(cx, y, c.w, rh);
      if (i >= 5) {
        // Zahlenspalten rechtsbündig
        text(vals[i], cx + c.w - 1, y + 6, { size: 7, align: "right" });
      } else if (i === 2 || i === 3) {
        text(vals[i], cx + c.w - 1, y + 6, { size: 7, align: "right" });
      } else {
        const maxChars = Math.floor(c.w / 1.7);
        const label = vals[i].length > maxChars ? vals[i].substring(0, maxChars) + "…" : vals[i];
        text(label, cx + 1, y + 6, { size: 7 });
      }
      cx += c.w;
    });
    y += rh;
  });

  // ── Fußnoten ────────────────────────────────
  y += 4;
  const footnotes = [
    "¹  Wird vom Auftraggeber vorgegeben.",
    "²  Ist bei allen Teilleistungen anzugeben, unabhängig davon ob sie der Auftragnehmer oder ein Nachunternehmer erbringen wird.",
    "³  Sofern der zugrunde gelegte Verrechnungslohn nicht mit den Angaben in den Formblättern 221 oder 222 übereinstimmt, hat der Bieter dies offenzulegen.",
    "⁴  Für Gerätekosten einschl. der Betriebsstoffkosten, soweit diese den Einzelkosten der angegebenen Ordnungszahlen zugerechnet worden sind.",
  ];
  doc.setLineWidth(0.2);
  doc.line(mL, y, mL + 80, y);
  y += 3;
  footnotes.forEach((fn) => {
    text(fn, mL, y, { size: 5.5 });
    y += 3.5;
  });

  // Footer
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  for (let p = 1; p <= pageNum; p++) {
    doc.setPage(p);
    doc.text("© VHB - Bund - Ausgabe 2017", mL, 203);
    doc.text(`Seite ${p} von ${pageNum}`, mR, 203, { align: "right" });
  }

  doc.save(`EFB_223_${project?.project_number || "Kalkulation"}.pdf`);
}