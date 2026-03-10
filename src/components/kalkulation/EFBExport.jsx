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

  // Helper
  const drawRect = (x, y, w, h) => doc.rect(x, y, w, h);
  const fillRect = (x, y, w, h, color) => {
    doc.setFillColor(...color);
    doc.rect(x, y, w, h, "F");
    doc.setFillColor(255, 255, 255);
  };
  const text = (txt, x, y, opts = {}) => {
    doc.setFontSize(opts.size || 9);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    if (opts.align === "right") {
      doc.text(String(txt), x, y, { align: "right" });
    } else {
      doc.text(String(txt), x, y);
    }
  };

  // ── Header ──────────────────────────────────
  text("221", mR, 14, { bold: true, size: 14 });
  text("(Preisermittlung bei Zuschlagskalkulation)", mR, 19, { size: 7, align: "right" });

  let y = 25;
  // Bieter / Vergabenummer / Datum row
  const firm = stammdaten?.find((s) => s.typ === "unternehmen");
  doc.setLineWidth(0.3);
  drawRect(mL, y, cW * 0.5, 12);
  drawRect(mL + cW * 0.5, y, cW * 0.3, 12);
  drawRect(mL + cW * 0.8, y, cW * 0.2, 12);
  text("Bieter", mL + 1, y + 4, { size: 7 });
  text(firm?.name || "", mL + 1, y + 9, { size: 8, bold: true });
  text("Vergabenummer", mL + cW * 0.5 + 1, y + 4, { size: 7 });
  text(project?.project_number || "", mL + cW * 0.5 + 1, y + 9, { size: 8 });
  text("Datum", mL + cW * 0.8 + 1, y + 4, { size: 7 });
  text(new Date().toLocaleDateString("de-DE"), mL + cW * 0.8 + 1, y + 9, { size: 8 });
  y += 12;

  // Baumaßnahme
  drawRect(mL, y, cW, 14);
  text("Baumaßnahme", mL + 1, y + 4, { size: 7 });
  text(project?.project_name || "", mL + 1, y + 10, { size: 8 });
  y += 14;

  // Leistung
  drawRect(mL, y, cW, 12);
  text("Leistung", mL + 1, y + 4, { size: 7 });
  const leistung = (project?.selected_trades || []).join(", ") || (project?.location || "");
  text(leistung, mL + 1, y + 9, { size: 8 });
  y += 14;

  // ── Section 1: Verrechnungslohn ─────────────
  text("Angaben zur Kalkulation mit vorbestimmten Zuschlägen", mL, y, { bold: true, size: 9 });
  y += 6;

  const col1W = 110;
  const col2W = 30;
  const col3W = cW - col1W - col2W;

  // Section 1 header
  fillRect(mL, y, cW, 7, [230, 230, 230]);
  drawRect(mL, y, col1W, 7);
  drawRect(mL + col1W, y, col2W, 7);
  drawRect(mL + col1W + col2W, y, col3W, 7);
  text("1", mL + 1, y + 5, { bold: true });
  text("Angaben über den Verrechnungslohn", mL + 10, y + 5, { bold: true });
  text("Zuschlag %", mL + col1W + 1, y + 5, { size: 7 });
  text("€/h", mL + col1W + col2W + 1, y + 5, { size: 7 });
  y += 7;

  const lohnRows = [
    { nr: "1.1", label: "Mittellohn ML", sub: "einschl. Lohnzulagen u. Lohnerhöhung, wenn keine Lohngleitklausel vereinbart wird" },
    { nr: "1.2", label: "Lohngebundene Kosten", sub: "Sozialkosten und Soziallöhne, als Zuschlag auf ML" },
    { nr: "1.3", label: "Lohnnebenkosten", sub: "Auslösungen, Fahrgelder, als Zuschlag auf ML" },
    { nr: "1.4", label: "Kalkulationslohn KL", sub: "(Summe 1.1 bis 1.3)" },
    { nr: "1.5", label: "Zuschlag auf Kalkulationslohn", sub: "(aus Zeile 2.4, Spalte 1)" },
    { nr: "1.6", label: "Verrechnungslohn VL", sub: "(Summe 1.4 und 1.5, VL im Formblatt 223 berücksichtigen)" },
  ];

  lohnRows.forEach((row) => {
    const rh = 10;
    drawRect(mL, y, col1W, rh);
    drawRect(mL + col1W, y, col2W, rh);
    drawRect(mL + col1W + col2W, y, col3W, rh);
    text(row.nr, mL + 1, y + 4, { bold: true });
    text(row.label, mL + 10, y + 4, { bold: true, size: 8 });
    if (row.sub) text(row.sub, mL + 10, y + 8, { size: 6.5 });
    // Fill 1.5 with BGK lohn value
    if (row.nr === "1.5") {
      const totalLohnZ = (Number(z.lohn_bgk) || 0) + (Number(z.lohn_agk) || 0) + (Number(z.lohn_wg) || 0);
      text(fmtPct(totalLohnZ), mL + col1W + col2W - 2, y + 5, { align: "right" });
    }
    y += rh;
  });

  y += 4;

  // ── Section 2: Zuschläge ─────────────────────
  text("2", mL + 1, y + 5, { bold: true });
  const s2Label = "Zuschläge auf die Einzelkosten der Teilleistungen = unmittelbare Herstellungskosten";
  fillRect(mL, y, cW, 7, [230, 230, 230]);
  drawRect(mL, y, cW, 7);
  text(s2Label, mL + 10, y + 5, { bold: true, size: 8 });
  y += 7;

  // Subheader row
  const hdrH = 12;
  const numColW = 12;
  const labelColW = 55;
  const dataColW = (cW - numColW - labelColW) / 5;

  fillRect(mL, y, cW, hdrH, [230, 230, 230]);
  drawRect(mL, y, numColW, hdrH);
  drawRect(mL + numColW, y, labelColW, hdrH);
  ["Lohn", "Stoffkosten", "Gerätekosten", "Sonstige Kosten", "Nachunternehmer-\nleistungen"].forEach((h, i) => {
    drawRect(mL + numColW + labelColW + i * dataColW, y, dataColW, hdrH);
    text(h, mL + numColW + labelColW + i * dataColW + dataColW / 2 - 8, y + 5, { size: 6.5 });
  });
  text("Zuschläge in % auf", mL + numColW + labelColW + (cW - numColW - labelColW) / 2 - 15, y + 3, { size: 6 });
  y += hdrH;

  const bgkRow = [z.lohn_bgk, z.material_bgk, z.geraet_bgk, z.sonstiges_bgk, z.nu_bgk];
  const agkRow = [z.lohn_agk, z.material_agk, z.geraet_agk, z.sonstiges_agk, z.nu_agk];
  const wgRow  = [z.lohn_wg,  z.material_wg,  z.geraet_wg,  z.sonstiges_wg,  z.nu_wg];

  const calcTotal = (row) => row.map((v) => Number(v) || 0).reduce((a, b) => a + b, 0);
  const totRow = bgkRow.map((_, i) =>
    (Number(bgkRow[i]) || 0) + (Number(agkRow[i]) || 0) + (Number(wgRow[i]) || 0)
  );

  const sec2Rows = [
    { nr: "2.1", label: "Baustellengemeinkosten", vals: bgkRow },
    { nr: "2.2", label: "Allgemeine Geschäftskosten", vals: agkRow },
    { nr: "2.3", label: "Wagnis und Gewinn", vals: wgRow },
    { nr: "2.4", label: "Gesamtzuschläge", vals: totRow, bold: true },
  ];

  sec2Rows.forEach((row) => {
    const rh = 8;
    drawRect(mL, y, numColW, rh);
    drawRect(mL + numColW, y, labelColW, rh);
    text(row.nr, mL + 1, y + 5, { bold: true, size: 8 });
    text(row.label, mL + numColW + 1, y + 5, { bold: row.bold, size: 8 });
    row.vals.forEach((v, i) => {
      drawRect(mL + numColW + labelColW + i * dataColW, y, dataColW, rh);
      text(fmtPct(v), mL + numColW + labelColW + (i + 1) * dataColW - 2, y + 5, { size: 8, align: "right" });
    });
    y += rh;
  });

  // Footer Seite 1
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("© VHB - Bund - Ausgabe 2017", mL, 288);
  doc.text("Seite 1 von 2", mR, 288, { align: "right" });

  // ── Seite 2 ─────────────────────────────────
  doc.addPage();
  text("221", mR, 14, { bold: true, size: 14 });
  text("(Preisermittlung bei Zuschlagskalkulation)", mR, 19, { size: 7, align: "right" });
  y = 25;

  // ── Section 3: Angebotssumme ─────────────────
  fillRect(mL, y, cW, 7, [230, 230, 230]);
  drawRect(mL, y, cW, 7);
  text("3.", mL + 1, y + 5, { bold: true });
  text("Ermittlung der Angebotssumme", mL + 10, y + 5, { bold: true });
  y += 7;

  // Sub-header
  const col3aW = numColW + labelColW + 10;
  const col3bW = 38;
  const col3cW = 23;
  const col3dW = cW - col3aW - col3bW - col3cW;
  const s3hdrH = 26;
  fillRect(mL, y, cW, s3hdrH, [230, 230, 230]);
  drawRect(mL, y, col3aW, s3hdrH);
  drawRect(mL + col3aW, y, col3bW, s3hdrH);
  drawRect(mL + col3aW + col3bW, y, col3cW, s3hdrH);
  drawRect(mL + col3aW + col3bW + col3cW, y, col3dW, s3hdrH);
  // Multi-line header texts rendered line by line
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  [["Einzelkosten der", "Teilleistungen =", "unmittelbare Her-", "stellungskosten", "€"], ].forEach((lines) => {
    lines.forEach((l, i) => doc.text(l, mL + col3aW + 2, y + 6 + i * 3.2));
  });
  [["Gesamt-", "zuschläge", "gem. 2.4", "%"]].forEach((lines) => {
    lines.forEach((l, i) => doc.text(l, mL + col3aW + col3bW + 2, y + 8 + i * 3.2));
  });
  [["Angebotssumme", "€"]].forEach((lines) => {
    lines.forEach((l, i) => doc.text(l, mL + col3aW + col3bW + col3cW + 2, y + 12 + i * 3.5));
  });
  y += s3hdrH;

  // Aggregate values from kalkulation positions rows
  const allRows = (kalkulation?.positions || []).flatMap((p) => p.rows || []);
  const sumByType = { Lohn: 0, Material: 0, "Gerät": 0, NU: 0, Sonstiges: 0 };
  allRows.forEach((r) => {
    const t = r.kostentyp in sumByType ? r.kostentyp : "Sonstiges";
    const kosten = Number(r.kosten_einheit || 0);
    sumByType[t] += kosten;
  });

  const typeZuschlaege = {
    Lohn: totRow[0],
    Material: totRow[1],
    "Gerät": totRow[2],
    Sonstiges: totRow[3],
    NU: totRow[4],
  };

  const sec3Rows = [
    { nr: "3.1", label: "Eigene Lohnkosten", type: "Lohn", sub: "Verrechnungslohn (1.6)  ×  Gesamtstunden" },
    { nr: "3.2", label: "Stoffkosten", type: "Material", sub: "(einschl. Kosten für Hilfsstoffe)" },
    { nr: "3.3", label: "Gerätekosten", type: "Gerät", sub: "(einschließlich Kosten für Energie und Betriebsstoffe)" },
    { nr: "3.4", label: "Sonstige Kosten", type: "Sonstiges", sub: "(vom Bieter zu erläutern)" },
    { nr: "3.5", label: "Nachunternehmerleistungen", type: "NU", sub: "" },
  ];

  let angebotssumme = 0;
  sec3Rows.forEach((row) => {
    const rh = 13;
    drawRect(mL, y, col3aW, rh);
    drawRect(mL + col3aW, y, col3bW, rh);
    drawRect(mL + col3aW + col3bW, y, col3cW, rh);
    drawRect(mL + col3aW + col3bW + col3cW, y, col3dW, rh);
    text(row.nr, mL + 1, y + 5, { bold: true });
    text(row.label, mL + 10, y + 5, { bold: true, size: 8 });
    if (row.sub) text(row.sub, mL + 10, y + 10, { size: 6.5 });
    const ek = sumByType[row.type] || 0;
    const pct = typeZuschlaege[row.type] || 0;
    const as = ek * (1 + pct / 100);
    angebotssumme += as;
    // Row 3.1: Angebotssumme-Spalte mit Kreuzschraffur (VL × h Berechnung)
    if (row.nr === "3.1") {
      const x1 = mL + col3aW + col3bW + col3cW;
      const x2 = x1 + col3dW;
      doc.setLineWidth(0.25);
      doc.line(x1, y, x2, y + rh);
      doc.line(x1, y + rh, x2, y);
      doc.setLineWidth(0.3);
    }
    if (ek > 0) {
      text(fmt(ek), mL + col3aW + col3bW - 2, y + 7, { align: "right", size: 8 });
      text(fmtPct(pct), mL + col3aW + col3bW + col3cW - 2, y + 7, { align: "right", size: 8 });
      if (row.nr !== "3.1") {
        text(fmt(as), mL + cW - 2, y + 7, { align: "right", size: 8 });
      }
    }
    y += rh;
  });

  // Angebotssumme footer
  const fh = 10;
  fillRect(mL, y, cW, fh, [230, 230, 230]);
  drawRect(mL, y, col3aW + col3bW + col3cW, fh);
  drawRect(mL + col3aW + col3bW + col3cW, y, col3dW, fh);
  text("Angebotssumme ohne Umsatzsteuer", mL + 1, y + 6, { bold: true, size: 9 });
  text(fmt(angebotssumme), mL + cW - 2, y + 6, { align: "right", size: 9, bold: true });
  y += fh + 8;

  // Footer note
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("© VHB - Bund - Ausgabe 2017", mL, 288);
  doc.text("Seite 1 von 1", mR, 288, { align: "right" });

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