#!/usr/bin/env node
/**
 * Build an embedded people JSON file that includes parents, spouses, and children
 * arrays on each person object by merging data/people.json and data/relationships.json.
 *
 * Usage:
 *   node scripts/build_embedded_people.js
 *
 * Output:
 *   data/people.embedded.json
 */
const fs = require("fs");
const path = require("path");

function readJSON(p) {
  const abs = path.resolve(process.cwd(), p);
  try {
    const raw = fs.readFileSync(abs, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[build_embedded_people] Failed to read ${p}:`, err.message);
    return [];
  }
}

function writeJSON(p, data) {
  const abs = path.resolve(process.cwd(), p);
  try {
    fs.writeFileSync(abs, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(`[build_embedded_people] Wrote ${p} (${data.length} people)`);
  } catch (err) {
    console.error(`[build_embedded_people] Failed to write ${p}:`, err.message);
    process.exitCode = 1;
  }
}

function uniqPush(arr, id) {
  if (!arr.includes(id)) arr.push(id);
}

function buildEmbedded(people, relationships) {
  // Index people and clone objects to avoid mutating source
  const peopleById = new Map(people.map((p) => [p.id, { ...p }]));

  // Initialize relationship arrays
  for (const p of peopleById.values()) {
    if (!Array.isArray(p.parents)) p.parents = [];
    if (!Array.isArray(p.spouses)) p.spouses = [];
    if (!Array.isArray(p.children)) p.children = [];
  }

  for (const r of relationships || []) {
    if (r.type === "spouse") {
      const a = peopleById.get(r.personAId);
      const b = peopleById.get(r.personBId);
      if (a && b) {
        uniqPush(a.spouses, b.id);
        uniqPush(b.spouses, a.id);
      }
    } else if (r.type === "parent-child") {
      const child = peopleById.get(r.childId);
      if (!child) continue;
      const parentIds = Array.isArray(r.parents)
        ? r.parents
        : r.parentId
        ? [r.parentId]
        : [];
      for (const pid of parentIds) {
        const parent = peopleById.get(pid);
        if (!parent) continue;
        uniqPush(child.parents, pid);
        uniqPush(parent.children, child.id);
      }
    }
  }

  // Optional: sort relationships for consistency (string/numeric-safe)
  const cmp = (a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true });
  for (const p of peopleById.values()) {
    p.parents.sort(cmp);
    p.spouses.sort(cmp);
    p.children.sort(cmp);
  }

  return Array.from(peopleById.values());
}

function main() {
  const people = readJSON("data/people.json");
  const relationships = readJSON("data/relationships.json");

  if (!Array.isArray(people) || people.length === 0) {
    console.error(
      "[build_embedded_people] No people found in data/people.json"
    );
    process.exit(1);
  }
  if (!Array.isArray(relationships)) {
    console.error(
      "[build_embedded_people] relationships.json missing or invalid, continuing with no relationships"
    );
  }

  const embedded = buildEmbedded(people, relationships || []);
  writeJSON("data/people.embedded.json", embedded);
}

if (require.main === module) {
  main();
}
