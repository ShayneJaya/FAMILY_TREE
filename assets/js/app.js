/**
 * app.js
 * Bootstraps the app, wires search and click events, renders directory and details.
 */
import { loadAll } from "./dataLoader.js";
import { renderDirectory, renderDetails } from "./render.js";

const els = {
  list: document.getElementById("directoryList"),
  details: document.getElementById("details"),
  search: document.getElementById("searchInput"),
  count: document.getElementById("peopleCount"),
};

const state = {
  people: [],
  relationships: [],
  photos: [],
  filtered: [],
  selectedId: null,
};

function updateCount() {
  const n = state.filtered.length;
  if (els.count)
    els.count.textContent = `${n} ${n === 1 ? "person" : "people"}`;
}

function applyFilter(q) {
  const query = (q || "").trim().toLowerCase();
  if (!query) {
    state.filtered = [...state.people];
  } else {
    state.filtered = state.people.filter((p) => {
      const name = [p.firstName, p.lastName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const id = String(p.id || "").toLowerCase();
      return name.includes(query) || id.includes(query);
    });
  }
  renderDirectory(els.list, state.filtered, state.selectedId);
  updateCount();
}

function selectPerson(id) {
  state.selectedId = id;
  const person = state.people.find((p) => p.id === id);
  renderDirectory(els.list, state.filtered, state.selectedId);
  renderDetails(
    els.details,
    person,
    state.relationships,
    state.people,
    state.photos
  );
}

function wireEvents() {
  els.search?.addEventListener("input", (e) => {
    applyFilter(e.target.value);
  });

  // Directory click (event delegation)
  els.list?.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    if (li) selectPerson(li.dataset.id);
  });
  els.list?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const li = e.target.closest("li[data-id]");
      if (li) selectPerson(li.dataset.id);
    }
  });

  // Details link badges
  els.details?.addEventListener("click", (e) => {
    const badge = e.target.closest("[data-person-id]");
    if (badge && badge.dataset.personId) {
      selectPerson(badge.dataset.personId);
      const li = els.list?.querySelector(
        `li[data-id="${badge.dataset.personId}"]`
      );
      li?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

async function main() {
  const { people, relationships, photos } = await loadAll();
  state.people = Array.isArray(people) ? people : [];
  state.relationships = Array.isArray(relationships) ? relationships : [];
  state.photos = Array.isArray(photos) ? photos : [];
  state.filtered = [...state.people];

  renderDirectory(els.list, state.filtered, state.selectedId);
  renderDetails(
    els.details,
    null,
    state.relationships,
    state.people,
    state.photos
  );
  updateCount();
  wireEvents();
}

main();
