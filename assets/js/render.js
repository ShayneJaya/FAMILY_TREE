/**
 * render.js
 * Stateless render helpers for directory list and person details.
 */

function fullName(p) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

function fmtLifespan(p) {
  const b = p.birthDate ? String(p.birthDate) : "";
  const d = p.deathDate ? String(p.deathDate) : "";
  if (!b && !d) return "";
  return `${b}${b || d ? " — " : ""}${d}`;
}

function getPhotoUrl(person) {
  if (person.photo && String(person.photo).trim().length > 0)
    return person.photo;
  return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><rect width="56" height="56" fill="%230b1220"/><circle cx="28" cy="20" r="12" fill="%231f2937"/><rect x="10" y="34" width="36" height="14" rx="7" fill="%231f2937"/></svg>';
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

export function renderDirectory(listEl, people, selectedId = null) {
  if (!listEl) return;
  if (!people || people.length === 0) {
    listEl.innerHTML =
      '<li class="card" style="pointer-events:none"><div style="grid-column: 1 / -1; color: var(--muted);">No people found.</div></li>';
    return;
  }

  const items = people
    .map((p) => {
      const name = fullName(p) || p.id || "Unknown";
      const lifespan = fmtLifespan(p);
      const occupation = p.occupation ? String(p.occupation) : "";
      const selectedCls = selectedId && p.id === selectedId ? " selected" : "";
      return `
      <li class="card${selectedCls}" data-id="${
        p.id
      }" role="button" tabindex="0">
        <img src="${getPhotoUrl(
          p
        )}" alt="${name} portrait" loading="lazy" width="56" height="56"/>
        <div>
          <div class="name">${name}</div>
          <div class="meta">${[lifespan, occupation]
            .filter(Boolean)
            .join(" • ")}</div>
        </div>
      </li>`;
    })
    .join("");
  listEl.innerHTML = items;
}

/* Relationship helpers */
function getSpouses(personId, relationships, peopleById) {
  return relationships
    .filter(
      (r) =>
        r.type === "spouse" &&
        (r.personAId === personId || r.personBId === personId)
    )
    .map((r) => (r.personAId === personId ? r.personBId : r.personAId))
    .map((id) => peopleById.get(id))
    .filter(Boolean);
}
function getParents(personId, relationships, peopleById) {
  return relationships
    .filter((r) => r.type === "parent-child" && r.childId === personId)
    .map((r) => r.parentId)
    .map((id) => peopleById.get(id))
    .filter(Boolean);
}
function getChildren(personId, relationships, peopleById) {
  return relationships
    .filter((r) => r.type === "parent-child" && r.parentId === personId)
    .map((r) => r.childId)
    .map((id) => peopleById.get(id))
    .filter(Boolean);
}

export function renderDetails(
  sectionEl,
  person,
  relationships,
  allPeople,
  photos = []
) {
  if (!sectionEl) return;
  if (!person) {
    sectionEl.innerHTML = `
      <div class="placeholder">
        <h2>Welcome</h2>
        <p>Use the search box or select a person from the directory.</p>
      </div>`;
    return;
  }

  const peopleById = new Map(allPeople.map((p) => [p.id, p]));
  const spouses = getSpouses(person.id, relationships, peopleById);
  const parents = getParents(person.id, relationships, peopleById);
  const children = getChildren(person.id, relationships, peopleById);
  const personPhotos = Array.isArray(photos)
    ? photos.filter(
        (ph) => Array.isArray(ph.people) && ph.people.includes(person.id)
      )
    : [];
  const photosSection = personPhotos.length
    ? `<div class="gallery-grid">
          ${personPhotos
            .map((ph) => {
              const cap =
                ph.caption && String(ph.caption).trim().length
                  ? `<div class="gallery-caption">${escapeHtml(
                      String(ph.caption)
                    )}</div>`
                  : "";
              return `<div class="gallery-item">
                        <a href="${ph.src}" target="_blank" rel="noopener">
                          <img src="${ph.src}" alt="${
                ph.caption ? String(ph.caption) : "Photo"
              }" loading="lazy" width="120" height="90"/>
                        </a>
                        ${cap}
                      </div>`;
            })
            .join("")}
        </div>`
    : '<span class="meta">No photos yet.</span>';

  const photo = getPhotoUrl(person);
  const name = fullName(person) || person.id || "Unknown";
  const lifespan = fmtLifespan(person);

  const list = (arr) =>
    arr.length
      ? arr
          .map(
            (p) =>
              `<span class="badge" data-person-id="${
                p.id
              }" role="link" tabindex="0">${fullName(p) || p.id}</span>`
          )
          .join(" ")
      : '<span class="meta">None</span>';

  sectionEl.innerHTML = `
    <div class="header">
      <img src="${photo}" alt="${name} portrait" width="88" height="88"/>
      <div>
        <h2>${name}</h2>
        <div class="sub">${[lifespan, person.occupation]
          .filter(Boolean)
          .join(" • ")}</div>
      </div>
    </div>

    <div class="section">
      <h3>Biography</h3>
      <div>${
        person.bio
          ? String(person.bio)
          : '<span class="meta">No biography yet.</span>'
      }</div>
    </div>

    <div class="section">
      <h3>Spouse(s)</h3>
      <div>${list(spouses)}</div>
    </div>

    <div class="section">
      <h3>Parents</h3>
      <div>${list(parents)}</div>
    </div>

    <div class="section">
      <h3>Children</h3>
      <div>${list(children)}</div>
    </div>

    <div class="section">
      <h3>Photos</h3>
      ${photosSection}
    </div>
  `;
}
