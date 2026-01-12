/**
 * dataLoader.js
 * Fetch JSON data for people and photos with basic error handling.
 * Relationships are now embedded directly in data/people.json (parents, spouses, children).
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

export async function loadPhotos() {
  return await fetchJSON("data/photos.json");
}

export async function loadAll() {
  const [people, photos] = await Promise.all([loadPeople(), loadPhotos()]);
  return { people, photos };
}
