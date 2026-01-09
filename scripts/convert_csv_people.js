// scripts/convert_csv_people.js
// Convert tblPersons.csv -> merged data/people.generated.json (non-destructive).
// - Keeps existing data/people.json as-is (especially P001..P009 unchanged)
// - Adds new people based on RecNo -> id Pxxx (e.g., RecNo 40 => P040)
// - Splits Name into firstName/lastName using frequency heuristics
// - Splits PlaceDateBirth/PlaceDateDeath into placeBirth/birthDate and placeDeath/deathDate
// - Normalizes dates into ISO-like formats: YYYY, YYYY-MM, or YYYY-MM-DD
// - Sets photo to placeholder and leaves occupation/bio empty
// - Writes output to data/people.generated.json for review

const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(process.cwd(), "tblPersons.csv");
const PEOPLE_PATH = path.join(process.cwd(), "data", "people.json");
const OUTPUT_PATH = path.join(process.cwd(), "data", "people.generated.json");

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

/** Robust-ish CSV line splitter (supports quotes and commas inside quotes) */
function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // escaped quote
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCSVLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = splitCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j] || `col_${j}`;
      row[key] = (parts[j] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function normalizeWhitespace(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/[ \t]+([,.;])/g, "$1")
    .trim();
}

function stripParensContent(name) {
  const parenMatches = [];
  let stripped = name.replace(/\(([^)]+)\)/g, (m, g1) => {
    parenMatches.push(g1.trim());
    return "";
  });
  return { stripped: normalizeWhitespace(stripped), notes: parenMatches };
}

function tokenizeName(name) {
  const cleaned = name
    .replace(/[^\p{L}\p{N}\s'.-]/gu, " ")
    .replace(/['.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  return cleaned.split(" ").filter(Boolean);
}

function buildSurnameCandidates(rows) {
  const freq = new Map();
  for (const r of rows) {
    const nm = (r.Name || "").trim();
    if (!nm) continue;
    const { stripped } = stripParensContent(nm);
    const toks = tokenizeName(stripped);
    for (const t of toks) {
      const key = t.toLowerCase();
      if (key.length <= 2) continue; // skip initials
      if (["nee", "divorced", "from"].includes(key)) continue;
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
  // candidates = tokens seen often (surname-like)
  const candidates = new Set();
  for (const [tok, n] of freq.entries()) {
    if (n >= 3) candidates.add(tok);
  }
  return candidates;
}

function chooseLastNameToken(tokens, candidates) {
  // Prefer a token that appears frequently among names (probable surname)
  // Strategy:
  // 1) If last token is a candidate, use it
  // 2) If first token is a candidate, use it
  // 3) If any token ends with "ge" or "pura"/"purage" (Sinhala patronymic / family name), use it
  // 4) Else, default to last token
  const lower = tokens.map((t) => t.toLowerCase());
  const lastIdx = tokens.length - 1;
  if (candidates.has(lower[lastIdx])) return lastIdx;
  if (candidates.has(lower[0])) return 0;

  const endsWithHints = ["ge", "pura", "purage"];
  for (let i = 0; i < lower.length; i++) {
    if (endsWithHints.some((suf) => lower[i].endsWith(suf))) return i;
  }
  // Also try any other candidate token inside the name
  for (let i = 0; i < lower.length; i++) {
    if (candidates.has(lower[i])) return i;
  }
  return lastIdx;
}

function splitNameSmart(name, candidates) {
  const original = normalizeWhitespace(name || "");
  if (!original) return { firstName: "", lastName: "" };

  const { stripped, notes } = stripParensContent(original);
  const tokens = tokenizeName(stripped);
  if (tokens.length === 0) return { firstName: "", lastName: "" };
  if (tokens.length === 1) return { firstName: tokens[0], lastName: "" };

  const lnIdx = chooseLastNameToken(tokens, candidates);
  const lastName = tokens[lnIdx];
  const firstPart = tokens.slice(0, lnIdx).concat(tokens.slice(lnIdx + 1));
  let firstName = firstPart.join(" ").trim();

  // If firstName empty (surname as first token), try the remaining tokens as first name
  if (!firstName && lnIdx === 0 && tokens.length > 1) {
    firstName = tokens.slice(1).join(" ");
  }

  return { firstName, lastName, notes };
}

const MONTHS = new Map([
  ["jan", "01"],
  ["january", "01"],
  ["feb", "02"],
  ["february", "02"],
  ["mar", "03"],
  ["march", "03"],
  ["apr", "04"],
  ["april", "04"],
  ["may", "05"],
  ["jun", "06"],
  ["june", "06"],
  ["jul", "07"],
  ["july", "07"],
  ["aug", "08"],
  ["august", "08"],
  ["sep", "09"],
  ["sept", "09"],
  ["september", "09"],
  ["oct", "10"],
  ["october", "10"],
  ["nov", "11"],
  ["november", "11"],
  ["dec", "12"],
  ["december", "12"],
]);

function normalizeDate(raw) {
  if (!raw) return "unknown";
  let s = raw
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+on\s+/gi, " ")
    .replace(/\s+at\s+/gi, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return "unknown";

  // Handle explicit unknowns
  const unk = /not\s*(known|available)|unknown/i;
  if (unk.test(s)) return "unknown";

  // Preserve approximate "~YYYY"
  const approxYear = s.match(/~\s*(\d{4})/);
  if (approxYear) return `~${approxYear[1]}`;

  // Day Month Year
  let m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\.?\s+(\d{4})/i);
  if (m) {
    const day = String(parseInt(m[1], 10)).padStart(2, "0");
    const mo = MONTHS.get(m[2].toLowerCase().replace(/\.$/, "")) || "01";
    const yr = m[3];
    return `${yr}-${mo}-${day}`;
  }

  // Month Year
  m = s.match(/([A-Za-z]{3,})\.?\s+(\d{4})/i);
  if (m) {
    const mo = MONTHS.get(m[1].toLowerCase().replace(/\.$/, "")) || "01";
    const yr = m[2];
    return `${yr}-${mo}`;
  }

  // Year
  m = s.match(/(\d{4})/);
  if (m) {
    return m[1];
  }

  return "unknown";
}

function splitPlaceAndDate(raw) {
  let s = normalizeWhitespace(raw || "");
  if (!s) return { place: "", date: "unknown" };

  // Cases like "Negombo - 7 Nov. 2023"
  const hy = s.split(/\s-\s/);
  if (hy.length === 2) {
    const place = normalizeWhitespace(hy[0].replace(/\.$/, ""));
    const date = normalizeDate(hy[1]);
    return { place, date };
  }

  // Find last 4-digit year to separate place/date when mixed with dots/commas
  const yearMatch = [...s.matchAll(/(\d{4})/g)].pop();
  if (yearMatch) {
    const idx = yearMatch.index;
    const yr = yearMatch[1];
    // Take substring from idx backwards to find a boundary, else split near idx
    let boundary = s.lastIndexOf(".", idx);
    if (boundary === -1) boundary = s.lastIndexOf(",", idx);
    if (boundary === -1) boundary = s.lastIndexOf(" ", idx);
    if (boundary !== -1) {
      const placePart = s.slice(0, boundary).replace(/\.$/, "");
      const datePart = s.slice(boundary).replace(/^[\s,.\-]+/, "");
      return {
        place: normalizeWhitespace(placePart),
        date: normalizeDate(datePart),
      };
    }
    // Fallback: assume place before year token
    return {
      place: normalizeWhitespace(s.slice(0, idx).replace(/\.$/, "")),
      date: normalizeDate(s.slice(idx)),
    };
  }

  // Explicit unknown dates inside string
  if (/date\s*unknown|unknown|not\s*known/i.test(s)) {
    const place = normalizeWhitespace(
      s.replace(/date\s*unknown|unknown/gi, "").replace(/\.$/, "")
    );
    return { place, date: "unknown" };
  }

  // No date found, treat all as place
  return { place: s.replace(/\.$/, ""), date: "unknown" };
}

function main() {
  const csvText = readText(CSV_PATH);
  const rows = parseCSV(csvText);

  const surnameCandidates = buildSurnameCandidates(rows);

  const peopleText = readText(PEOPLE_PATH);
  let existing = [];
  try {
    existing = JSON.parse(peopleText);
    if (!Array.isArray(existing)) existing = [];
  } catch (e) {
    existing = [];
  }
  const existingById = new Map(existing.map((p) => [String(p.id), p]));

  const protectedIds = new Set(
    Array.from({ length: 9 }, (_, i) => `P${String(i + 1).padStart(3, "0")}`)
  );

  const out = [...existing];
  let added = 0;
  let skipped = 0;

  for (const r of rows) {
    const recRaw =
      r.RecNo || r.Recno || r.recno || r.recNo || r["Rec No"] || "";
    const recNo = parseInt(String(recRaw).replace(/[^\d]/g, ""), 10);
    if (!recNo || Number.isNaN(recNo)) continue;

    const id = `P${pad3(recNo)}`;
    if (protectedIds.has(id) || existingById.has(id)) {
      skipped++;
      continue;
    }

    const name = r.Name || "";
    const { firstName, lastName } = splitNameSmart(name, surnameCandidates);

    const gen = r.Generation ? parseInt(String(r.Generation), 10) : undefined;
    const sex = (r.Sex || r.Gender || "").trim().toUpperCase();
    const gender = sex === "F" ? "F" : sex === "M" ? "M" : "";

    const { place: placeBirth, date: birthDate } = splitPlaceAndDate(
      r.PlaceDateBirth || ""
    );
    const { place: placeDeath, date: deathDate } = splitPlaceAndDate(
      r.PlaceDateDeath || ""
    );

    const remarks = normalizeWhitespace(r.Remarks || "");

    const person = {
      id,
      firstName: firstName || "",
      lastName: lastName || "",
      generation: Number.isFinite(gen) ? gen : undefined,
      placeBirth: placeBirth || "",
      placeDeath: placeDeath || "",
      remarks,
      gender,
      birthDate: birthDate || "unknown",
      deathDate: deathDate || "unknown",
      occupation: "",
      bio: "",
      photo: "./assets/img/placeholders/placeholder.jpg",
    };

    out.push(person);
    existingById.set(id, person);
    added++;
  }

  // Sort by numeric ID for cleanliness
  out.sort((a, b) => {
    const na = parseInt(String(a.id).replace(/[^\d]/g, ""), 10);
    const nb = parseInt(String(b.id).replace(/[^\d]/g, ""), 10);
    return na - nb;
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2), "utf8");

  console.log(
    `Wrote ${OUTPUT_PATH}. Added: ${added}, Skipped (existing/protected): ${skipped}`
  );
  console.log(
    `Sample surname candidates: ${Array.from(surnameCandidates)
      .slice(0, 20)
      .join(", ")}`
  );
}
