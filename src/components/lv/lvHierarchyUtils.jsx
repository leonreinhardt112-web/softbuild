/**
 * Universal OZ and Hierarchy Logic for Bill of Quantities (LV)
 * Handles arbitrary numbering schemes without modification
 */

/**
 * Parse OZ into parts (e.g., "01.01.0001" -> ["01", "01", "0001"])
 */
export const parseOZ = (oz) => {
  if (!oz) return [];
  return String(oz).replace(/\s/g, "").split(".").filter(Boolean);
};

/**
 * Get OZ prefix up to a certain depth
 * depth=1: "01.01.0001" -> "01"
 * depth=2: "01.01.0001" -> "01.01"
 */
export const getOZPrefix = (oz, depth = 1) => {
  const parts = parseOZ(oz);
  return parts.slice(0, depth).join(".");
};

/**
 * Calculate hierarchy depth from OZ (number of parts - 1)
 * "01" -> 0 (Haupttitel)
 * "01.01" -> 1 (Untertitel)
 * "01.01.0001" -> 2+ (Position)
 * Works with any numbering scheme: "1", "1.1", "1.1.10" etc.
 */
export const getOZDepth = (oz) => {
  return parseOZ(oz).length - 1;
};

/**
 * Determine node type based on OZ structure, quantity, and explicit type
 */
export const determineNodeType = (item) => {
  // Explicit type takes priority
  if (item.type === "title") return "title";
  if (item.type === "position") return "position";
  
  // Check if it has quantity/unit (kalkulierbare Position)
  const hasQty = item.quantity && item.quantity !== "0" && item.quantity !== "";
  const hasUnit = item.unit && item.unit !== "";
  
  if (!hasQty && !hasUnit) {
    // No quantity/unit = hierarchical element (Titel/Untertitel)
    const depth = getOZDepth(item.oz);
    return depth === 0 ? "title" : depth === 1 ? "subtitle" : "position";
  }
  
  // Has quantity/unit = kalkulierbare Position
  return "position";
};

/**
 * Find parent OZ for a given OZ
 * "01.01.0001" -> parent "01.01"
 * "01.01" -> parent "01"
 * "01" -> parent null
 */
export const findParentOZ = (oz, allOZs = []) => {
  const parts = parseOZ(oz);
  if (parts.length <= 1) return null;
  
  const parentPrefix = parts.slice(0, -1).join(".");
  
  // Find exact match in existing OZs
  const exactMatch = allOZs.find(o => o === parentPrefix);
  if (exactMatch) return exactMatch;
  
  // Return constructed parent
  return parentPrefix;
};

/**
 * Build hierarchical structure from flat list of OZs
 * Groups items by Haupttitel -> Untertitel -> Positions
 */
export const buildHierarchy = (items) => {
  const grouped = [];
  const titleMap = {};
  const subtitleMap = {};
  
  // First pass: collect all unique OZs for parent resolution
  const allOZs = items.map(item => item.oz).filter(Boolean);
  
  // Second pass: build hierarchy
  items.forEach((item) => {
    const type = determineNodeType(item);
    const depth = getOZDepth(item.oz);
    
    if (type === "title" || depth === 0) {
      // Haupttitel level
      const oz = item.oz;
      if (!titleMap[oz]) {
        const node = {
          oz,
          type: "title",
          short_text: item.short_text,
          long_text: item.long_text,
          subtitles: []
        };
        titleMap[oz] = node;
        grouped.push(node);
      }
    } else if (type === "subtitle" || depth === 1) {
      // Untertitel level
      const oz = item.oz;
      const parentOZ = findParentOZ(oz, allOZs);
      
      if (!titleMap[parentOZ]) {
        titleMap[parentOZ] = {
          oz: parentOZ,
          type: "title",
          short_text: "",
          long_text: "",
          subtitles: []
        };
        grouped.push(titleMap[parentOZ]);
      }
      
      if (!subtitleMap[oz]) {
        const node = {
          oz,
          type: "subtitle",
          short_text: item.short_text,
          long_text: item.long_text,
          positions: [],
          parentOZ
        };
        subtitleMap[oz] = node;
        titleMap[parentOZ].subtitles.push(node);
      }
    } else {
      // Position level (depth >= 2)
      const parentPrefix = getOZPrefix(item.oz, getOZDepth(item.oz));
      const parentOZ = findParentOZ(item.oz, allOZs);
      
      if (!titleMap[getOZPrefix(item.oz, 1)]) {
        titleMap[getOZPrefix(item.oz, 1)] = {
          oz: getOZPrefix(item.oz, 1),
          type: "title",
          short_text: "",
          long_text: "",
          subtitles: []
        };
        grouped.push(titleMap[getOZPrefix(item.oz, 1)]);
      }
      
      if (!subtitleMap[parentOZ]) {
        const node = {
          oz: parentOZ,
          type: "subtitle",
          short_text: "",
          long_text: "",
          positions: [],
          parentOZ: getOZPrefix(parentOZ, getOZDepth(parentOZ))
        };
        subtitleMap[parentOZ] = node;
        const titleOZ = getOZPrefix(item.oz, 1);
        if (titleMap[titleOZ]) {
          titleMap[titleOZ].subtitles.push(node);
        }
      }
      
      const posNode = {
        oz: item.oz,
        type: "position",
        short_text: item.short_text,
        long_text: item.long_text,
        quantity: item.quantity,
        unit: item.unit,
        parentOZ,
        original_item: item
      };
      
      subtitleMap[parentOZ].positions.push(posNode);
    }
  });
  
  return grouped;
};

/**
 * Flatten hierarchical structure back to simple list for display/filtering
 */
export const flattenHierarchy = (hierarchy) => {
  const flat = [];
  
  const processNode = (node, depth = 0) => {
    flat.push({
      ...node,
      depth
    });
    
    if (node.subtitles) {
      node.subtitles.forEach(sub => processNode(sub, depth + 1));
    }
    
    if (node.positions) {
      node.positions.forEach(pos => processNode(pos, depth + 1));
    }
  };
  
  hierarchy.forEach(node => processNode(node));
  
  return flat;
};

/**
 * Extract display OZ style from existing OZs
 * Returns pattern info: { hasLeadingZeros, separators, pattern }
 */
export const extractOZStyle = (items) => {
  const ozList = items.map(item => item.oz).filter(Boolean);
  if (ozList.length === 0) return { hasLeadingZeros: false, separators: ".", pattern: null };
  
  const hasLeadingZeros = ozList.some(oz => /^0\d/.test(String(oz)));
  const separators = "."; // Most common in German LVs
  
  return { hasLeadingZeros, separators, pattern: null };
};

/**
 * Generate new OZ for manually created position
 * Respects the style of existing LV
 */
export const generateNewPositionOZ = (subtitleOZ, existingPositionCount, ozStyle) => {
  const { hasLeadingZeros, separators } = ozStyle;
  
  const nextNum = String(existingPositionCount + 1);
  const paddedNum = hasLeadingZeros ? nextNum.padStart(4, "0") : nextNum;
  
  return `${subtitleOZ}${separators}${paddedNum}`;
};

/**
 * Validate OZ format (basic check for valid structure)
 */
export const isValidOZ = (oz) => {
  return oz && /^[\d.]+$/.test(String(oz).replace(/\s/g, ""));
};

/**
 * Filter positions from items (exclude titles/subtitles)
 */
export const getPositions = (items) => {
  return items.filter(item => {
    const type = determineNodeType(item);
    return type === "position";
  });
};