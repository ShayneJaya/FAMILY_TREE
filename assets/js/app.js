/**
 * app.js
 * Bootstraps the app, wires search and click events, renders directory and details.
 */
import { loadAll } from "./dataLoader.js";
import { renderDirectory, renderDetails } from "./render.js";
import { createTreeView } from "./tree.js";

const els = {
  list: document.getElementById("directoryList"),
  treeContainer: document.getElementById("treeContainer"),
  details: document.getElementById("details"),
  search: document.getElementById("searchInput"),
  count: document.getElementById("peopleCount"),
  viewListBtn: document.getElementById("viewListBtn"),
  viewTreeBtn: document.getElementById("viewTreeBtn"),
};

const MOBILE_MAX_WIDTH = 900;
const isMobile = () =>
  window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;

const state = {
  people: [],
  photos: [],
  filtered: [],
  selectedId: null,
  viewMode: "list",
};

let treeInstance = null;

function buildRelationshipsFromPeople(people) {
  const peopleById = new Map(people.map((p) => [p.id, p]));

  // Spouse links (deduplicated)
  const spouseSet = new Set();
  const spouseLinks = [];
  for (const p of people) {
    const spouses = Array.isArray(p.spouses) ? p.spouses : [];
    for (const sid of spouses) {
      const a = p.id;
      const b = sid;
      if (!peopleById.has(a) || !peopleById.has(b)) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (!spouseSet.has(key)) {
        spouseSet.add(key);
        spouseLinks.push({ type: "spouse", personAId: a, personBId: b });
      }
    }
  }

  // Parent-child links (from children lists and child.parents)
  const childParents = new Map(); // childId -> Set(parentId)
  for (const p of people) {
    const kids = Array.isArray(p.children) ? p.children : [];
    for (const cid of kids) {
      if (!childParents.has(cid)) childParents.set(cid, new Set());
      childParents.get(cid).add(p.id);
    }
  }
  for (const child of people) {
    const parents = Array.isArray(child.parents) ? child.parents : [];
    if (parents.length) {
      if (!childParents.has(child.id)) childParents.set(child.id, new Set());
      const s = childParents.get(child.id);
      parents.forEach((pid) => s.add(pid));
    }
  }

  const parentChildLinks = [];
  for (const [childId, set] of childParents.entries()) {
    if (!peopleById.has(childId)) continue;
    const parents = Array.from(set).filter((pid) => peopleById.has(pid));
    if (parents.length > 0) {
      parentChildLinks.push({ type: "parent-child", parents, childId });
    }
  }

  return [...spouseLinks, ...parentChildLinks];
}

function updateCount() {
  const n = state.filtered.length;
  if (els.count)
    els.count.textContent = `${n} ${n === 1 ? "person" : "people"}`;
}

function applyFilter(q) {
  const raw = (q || "").trim();
  const query = raw.toLowerCase();

  if (!query) {
    state.filtered = [...state.people];
  } else {
    // Modes:
    // - Generation: ONLY when prefixed "g" (e.g., "g5", "G 5")
    // - ID: "p101" or numeric-only "101" (matches numeric part of ID, ignores leading zeros)
    // - Fallback: partial match on name or ID (case-insensitive)
    const genMatch = query.match(/^g\s*(\d+)$/i);
    const idPrefixed = query.match(/^p\s*0*(\d+)$/i);
    const numericOnly = query.match(/^\d+$/);

    if (genMatch) {
      const genNum = Number(genMatch[1]);
      state.filtered = state.people.filter(
        (p) => Number(p.generation) === genNum
      );
    } else if (idPrefixed || numericOnly) {
      const idNum = idPrefixed ? Number(idPrefixed[1]) : Number(query);
      state.filtered = state.people.filter((p) => {
        const m = String(p.id || "").match(/(\d+)/);
        return m && Number(m[1]) === idNum;
      });
    } else {
      // name or id partial (case-insensitive)
      state.filtered = state.people.filter((p) => {
        const name = [p.firstName, p.lastName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const id = String(p.id || "").toLowerCase();
        return name.includes(query) || id.includes(query);
      });
    }
  }

  renderDirectory(els.list, state.filtered, state.selectedId);
  updateCount();
}

function selectPerson(id) {
  state.selectedId = id;
  const person = state.people.find((p) => p.id === id);
  renderDirectory(els.list, state.filtered, state.selectedId);
  renderDetails(els.details, person, state.people, state.photos);
  if (treeInstance) treeInstance.select(id);
}

function setViewMode(mode) {
  if (mode !== "list" && mode !== "tree") return;
  if (isMobile() && mode === "tree") {
    mode = "list";
  }
  state.viewMode = mode;
  document.body.classList.toggle("view-tree", mode === "tree");

  if (els.list) {
    els.list.hidden = mode === "tree";
    els.list.style.display = mode === "tree" ? "none" : "";
  }
  if (els.treeContainer) {
    els.treeContainer.hidden = mode === "list";
    els.treeContainer.style.display = mode === "list" ? "none" : "block";
  }

  if (els.viewListBtn) {
    els.viewListBtn.classList.toggle("active", mode === "list");
    els.viewListBtn.setAttribute("aria-selected", String(mode === "list"));
  }
  if (els.viewTreeBtn) {
    els.viewTreeBtn.classList.toggle("active", mode === "tree");
    els.viewTreeBtn.setAttribute("aria-selected", String(mode === "tree"));
    els.viewTreeBtn.disabled = isMobile();
  }

  if (mode === "tree") {
    if (!treeInstance && els.treeContainer) {
      treeInstance = createTreeView(
        els.treeContainer,
        state.people,
        buildRelationshipsFromPeople(state.people),
        {
          onSelect: (id) => selectPerson(id),
        }
      );
      if (state.selectedId) {
        treeInstance.select(state.selectedId);
      }
      if (treeInstance.fit) treeInstance.fit();
    } else if (treeInstance) {
      treeInstance.resize();
      if (state.selectedId) {
        treeInstance.select(state.selectedId);
      }
      if (treeInstance.fit) treeInstance.fit();
    }
  }
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
      // Clear search and reset directory when navigating within a profile
      if (els.search) {
        els.search.value = "";
      }
      applyFilter("");
      selectPerson(badge.dataset.personId);
      const li = els.list?.querySelector(
        `li[data-id="${badge.dataset.personId}"]`
      );
      li?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  // View toggle
  els.viewListBtn?.addEventListener("click", () => setViewMode("list"));
  els.viewTreeBtn?.addEventListener("click", (e) => {
    if (isMobile()) {
      e.preventDefault();
      return;
    }
    setViewMode("tree");
  });

  // Resize handling for tree view and responsive enforcement
  window.addEventListener("resize", () => {
    if (isMobile() && state.viewMode === "tree") {
      setViewMode("list");
    }
    if (els.viewTreeBtn) {
      els.viewTreeBtn.disabled = isMobile();
    }
    if (state.viewMode === "tree" && treeInstance) {
      treeInstance.resize();
      if (treeInstance.fit) treeInstance.fit();
    }
  });
}

async function main() {
  const { people, photos } = await loadAll();
  state.people = Array.isArray(people) ? people : [];
  state.photos = Array.isArray(photos) ? photos : [];
  state.filtered = [...state.people];

  renderDirectory(els.list, state.filtered, state.selectedId);
  renderDetails(els.details, null, state.people, state.photos);
  updateCount();
  setViewMode("list");
  wireEvents();
  if (els.viewTreeBtn) {
    els.viewTreeBtn.disabled = isMobile();
  }
}

main();
