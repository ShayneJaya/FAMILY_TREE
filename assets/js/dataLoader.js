/**
 * dataLoader.js
 * Fetch JSON data for people and relationships with basic error handling.
 */

async function fetchJSON(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[dataLoader] Failed to load", path, err);
    return [];
  }
}

export async function loadPeople() {
  return await fetchJSON("data/people.json");
}

export async function loadRelationships() {
  return await fetchJSON("data/relationships.json");
}

export async function loadPhotos() {
  return await fetchJSON("data/photos.json");
}

export async function loadAll() {
  const [people, relationships, photos] = await Promise.all([
    loadPeople(),
    loadRelationships(),
    loadPhotos(),
  ]);
  return { people, relationships, photos };
}
