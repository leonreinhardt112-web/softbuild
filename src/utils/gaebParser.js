const TRADE_KEYWORDS = {
  erdbau: ["erdbau", "erdarbeiten", "aushub", "boden", "verfüllung", "bodenklasse", "massenermittlung", "oberboden", "mutterboden"],
  verbau: ["verbau", "spundwand", "trägerbohlwand", "baugrubenverbau", "verbauplanung", "steifen", "anker"],
  kanalbau: ["kanal", "rohr", "schacht", "abwasser", "entwässerung", "haltung", "kanalisation", "nennweite", "dn ", "rinne"],
  strassenbau: ["asphalt", "pflaster", "fahrbahn", "gehweg", "tragschicht", "frostschutz", "bordstein", "straßenbau", "oberbau", "rsto"],
  wasserhaltung: ["wasserhaltung", "grundwasser", "pumpe", "pumpensumpf", "absenkung", "einleitung"],
  draen_versickerung: ["drän", "drainage", "versickerung", "rigole", "mulde", "kf-wert", "sickerschacht"],
};

export function parseX83(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const positions = [];

  const getText = (el, ...selectors) => {
    for (const sel of selectors) {
      const found = el.querySelector(sel);
      if (found?.textContent?.trim()) return found.textContent.trim();
    }
    for (const sel of selectors) {
      const tagName = sel.split(" ")[0];
      for (let child of el.childNodes) {
        if (child.nodeType === 1 && child.tagName?.toUpperCase() === tagName.toUpperCase()) {
          if (child.textContent?.trim()) return child.textContent.trim();
        }
      }
    }
    return "";
  };

  const getNonBoolText = (el) => {
    if (!el) return "";
    const t = el.textContent?.trim();
    if (!t) return "";
    const lower = t.toLowerCase();
    if (lower === "yes" || lower === "no" || lower === "true" || lower === "false") return "";
    return t;
  };

  const processItem = (node, parentOz) => {
    let oz = getText(node, "ItemNo", "OZ", "Pos") || node.getAttribute("RNoPart") || "";
    let shortText = "";
    let longText = "";

    const outlineTextEl = node.querySelector("TextOutlTxt") || node.querySelector("OutlineText OutlTxt Text") || node.querySelector("OutlTxt Text");
    if (outlineTextEl) shortText = getNonBoolText(outlineTextEl);

    if (!shortText) {
      const lblEl = node.querySelector("LblTx Text") || node.querySelector("LblTx");
      if (lblEl) shortText = getNonBoolText(lblEl);
    }

    if (!shortText) {
      const kurzEl = node.querySelector("KurzText") || node.querySelector("KurzTxt");
      if (kurzEl) shortText = getNonBoolText(kurzEl);
    }

    const detailEl = node.querySelector("DetailTxt Text") || node.querySelector("DetailTxt");
    if (detailEl) longText = detailEl.textContent?.trim() || "";

    if (!longText) {
      const completeEl = node.querySelector("CompleteText");
      if (completeEl) {
        const detailInComplete = completeEl.querySelector("DetailTxt Text") || completeEl.querySelector("DetailTxt");
        if (detailInComplete) longText = detailInComplete.textContent?.trim() || "";
      }
    }

    const qty = getText(node, "Qty", "Menge") || "";
    const unit = getText(node, "QU", "QtyUnit", "Einheit") || "";

    if (!oz || oz.length < 2) {
      oz = parentOz ? `${parentOz}.0001` : "0001";
    } else if (parentOz && !oz.includes(".")) {
      oz = `${parentOz}.${oz}`;
    }

    if (oz || shortText) {
      positions.push({ oz, short_text: shortText, long_text: longText, quantity: qty, unit, type: "position" });
    }
  };

  const processDP = (node, parentOz) => {
    let oz = getText(node, "OZ", "Pos") || "";
    const shortText = getText(node, "Kurz", "KurzText", "Text") || "";
    const qty = getText(node, "Menge", "Qty") || "";
    const unit = getText(node, "ME", "QU") || "";
    const isTitle = !qty || qty === "0";
    if (parentOz && !oz.includes(".")) oz = `${parentOz}.${oz}`;
    if (oz || shortText) {
      positions.push({ oz, short_text: shortText, long_text: "", quantity: qty, unit, type: isTitle ? "title" : "position" });
    }
  };

  const processNode = (node, parentOz = "") => {
    const tag = node.tagName;
    if (tag === "BoQCtgy") {
      const rawOz = getText(node, "CtgyNo", "OZ", "Pos") || node.getAttribute("RNoPart") || "";
      const shortText = getText(node, "LblTx ShortText", "LblTx", "ShortText", "KurzText", "Description") || "";
      const dotCount = (rawOz.match(/\./g) || []).length;
      let oz = rawOz;
      if (parentOz && dotCount === 0 && rawOz) oz = `${parentOz}.${rawOz}`;
      if (oz || shortText) {
        positions.push({ oz, short_text: shortText, long_text: "", quantity: "", unit: "", type: "title" });
      }
      const walkChildren = (el, parentOzLocal) => {
        for (let i = 0; i < el.children.length; i++) {
          const child = el.children[i];
          const t = child.tagName?.toUpperCase();
          if (t === "BOQCTGY") processNode(child, parentOzLocal);
          else if (t === "ITEM") processItem(child, parentOzLocal);
          else if (t === "DP") processDP(child, parentOzLocal);
          else walkChildren(child, parentOzLocal);
        }
      };
      walkChildren(node, oz);
    } else if (tag === "Item" || tag === "item") {
      processItem(node, parentOz);
    } else if (tag === "DP") {
      processDP(node, parentOz);
    }
  };

  const searchAll = (el, parentOz = "") => {
    if (!el.children) return;
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      const tag = child.tagName?.toUpperCase();
      if (tag === "BOQCTGY") processNode(child, parentOz);
      else if (tag === "ITEM" || tag === "DP") tag === "ITEM" ? processItem(child, parentOz) : processDP(child, parentOz);
      else searchAll(child, parentOz);
    }
  };

  searchAll(doc);
  return positions;
}

export function detectTradesFromPositions(positions) {
  const allText = positions.map((p) => `${p.short_text} ${p.long_text}`).join(" ").toLowerCase();
  const detected = new Set(["allgemein"]);
  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
    if (keywords.some((kw) => allText.includes(kw))) detected.add(trade);
  }
  return [...detected];
}

export function isGaebFile(filename) {
  return /\.(x83|x82|x81)$/i.test(filename);
}

export function isUnterlagFile(filename) {
  return /\.(pdf|doc|docx|txt)$/i.test(filename);
}