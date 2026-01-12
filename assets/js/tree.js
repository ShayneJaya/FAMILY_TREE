/**
 * tree.js
 * D3-based interactive tree view for the family data.
 * - Pan/zoom
 * - Click node to select and show details (delegated via onSelect)
 * - Optional double-click to re-center on a node
 *
 * Export:
 *   createTreeView(containerEl, people, relationships, options?)
 *     -> { select(id), resize(), destroy() }
 */

function fullName(p) {
  if (!p) return "";
  const n = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return n || p.id || "Unknown";
}

/**
 * Build a forest (virtual root) by attaching each child under a single parent.
 * - For parent-child with two parents, prefer the first listed parent that exists in people.
 * - Spouse relationships are ignored in this simple tree (keeps graph acyclic).
 */
function buildForest(people, relationships) {
  const peopleById = new Map(people.map((p) => [p.id, p]));

  const childrenByParent = new Map(); // parentId -> Set(childId)
  const inChildSet = new Set(); // all childIds assigned under chosen parent

  function addChild(parentId, childId) {
    if (!childrenByParent.has(parentId))
      childrenByParent.set(parentId, new Set());
    childrenByParent.get(parentId).add(childId);
    inChildSet.add(childId);
  }

  for (const r of relationships) {
    if (r.type !== "parent-child") continue;
    const childId = r.childId;
    if (!peopleById.has(childId)) continue;

    let parentIds = [];
    if (Array.isArray(r.parents) && r.parents.length) parentIds = r.parents;
    else if (r.parentId) parentIds = [r.parentId];

    // Choose the first existing parent in people
    let chosen = null;
    for (const pid of parentIds) {
      if (peopleById.has(pid)) {
        chosen = pid;
        break;
      }
    }
    if (chosen) {
      addChild(chosen, childId);
    }
  }

  // Roots = people that are not a child (under chosen-parent mapping)
  let roots = people
    .filter((p) => !inChildSet.has(p.id))
    .sort((a, b) => {
      // sort by generation (asc), then last, first
      const ga = a.generation ?? Number.POSITIVE_INFINITY;
      const gb = b.generation ?? Number.POSITIVE_INFINITY;
      if (ga !== gb) return ga - gb;
      const la = (a.lastName || "").toLowerCase();
      const lb = (b.lastName || "").toLowerCase();
      if (la !== lb) return la.localeCompare(lb);
      const fa = (a.firstName || "").toLowerCase();
      const fb = (b.firstName || "").toLowerCase();
      return fa.localeCompare(fb);
    });

  // Fallback: if somehow none found, pick the minimum generation as roots
  if (roots.length === 0) {
    const gens = people.map((p) =>
      p.generation === undefined || p.generation === null
        ? Number.POSITIVE_INFINITY
        : Number(p.generation)
    );
    const minGen = Math.min(...gens);
    roots = people.filter((p) => Number(p.generation) === minGen);
  }

  // Build a plain object tree suitable for d3.hierarchy
  function buildSubtree(id, visited = new Set()) {
    // Guard against accidental cycles
    if (visited.has(id)) {
      return { id, person: peopleById.get(id), children: [] };
    }
    visited.add(id);

    const childrenSet = childrenByParent.get(id) || new Set();
    const children = Array.from(childrenSet).map((cid) =>
      buildSubtree(cid, new Set(visited))
    );
    return { id, person: peopleById.get(id), children };
  }

  const virtualRoot = {
    id: "__root__",
    person: null,
    children: roots.map((r) => buildSubtree(r.id)),
  };

  return virtualRoot;
}

/**
 * Renders the tree into the given container element using global d3.
 */
export function createTreeView(
  containerEl,
  people,
  relationships,
  options = {}
) {
  if (!containerEl) throw new Error("Tree container element is required");
  const cfg = Object.assign(
    {
      nodeRadius: 20,
      gapX: 180,
      gapY: 385,
      zoomMin: 0.35,
      zoomMax: 3.0,
      transitionMs: 450,
      baseSpouseGap: 200,
      siblingGap: 250,
      narrowScaleStart: 0.6,
      narrowDepthSpan: 5,
      rowMinGap: 250,
    },
    options
  );

  const forest = buildForest(people, relationships);

  // Size
  let width = containerEl.clientWidth || 600;
  let height = containerEl.clientHeight || 500;

  // Root hierarchy and layout
  const root = d3.hierarchy(forest, (d) => d.children);
  const layout = d3
    .tree()
    .nodeSize([cfg.gapX, cfg.gapY])
    .separation((a, b) => {
      const depth = Math.max(a.depth, b.depth);
      const sibling = a.parent === b.parent;
      // Use leaf counts to spread siblings with many descendants
      const leavesA = a.leaves
        ? a.leaves().length
        : a.descendants().filter((d) => !d.children || d.children.length === 0)
            .length;
      const leavesB = b.leaves
        ? b.leaves().length
        : b.descendants().filter((d) => !d.children || d.children.length === 0)
            .length;
      const leafFactor = 0.05 * (leavesA + leavesB);
      const base = sibling ? 2.4 : 2.8;
      return (
        (base + leafFactor) * (1 + Math.min(depth, cfg.narrowDepthSpan) * 0.2)
      );
    });
  layout(root);

  // Compute extents to center content
  const nodes = root.descendants().filter((d) => d.data.id !== "__root__");

  // Align vertical position by generation to keep spouses on the same row
  function genOf(person) {
    const g = Number(person && person.generation);
    return Number.isFinite(g) ? g : 0;
  }
  nodes.forEach((d) => {
    d.y = genOf(d.data.person) * cfg.gapY;
  });

  // Bring spouses to the same row and place them side-by-side
  // Narrow top rows horizontally to make the tree more vertical
  const rows = new Map();
  nodes.forEach((d) => {
    const gy = d.y;
    if (!rows.has(gy)) rows.set(gy, []);
    rows.get(gy).push(d);
  });
  rows.forEach((rowNodes, gy) => {
    const center = d3.mean(rowNodes, (n) => n.x) || 0;
    const gen = Math.round(gy / cfg.gapY);
    const s0 = cfg.narrowScaleStart || 0.65;
    const span = cfg.narrowDepthSpan || 4;
    const t = Math.max(0, Math.min(1, gen / span));
    const scale = s0 + (1 - s0) * t; // narrower at top, wider at bottom
    rowNodes.forEach((n) => {
      n.x = center + (n.x - center) * scale;
    });
  });

  const byIdTmp = new Map(nodes.map((d) => [d.data.id, d]));
  const baseSpouse = cfg.baseSpouseGap || 90;
  relationships
    .filter((r) => r.type === "spouse")
    .forEach((r) => {
      const a = byIdTmp.get(r.personAId);
      const b = byIdTmp.get(r.personBId);
      if (!a || !b) return;

      // Snap both to a shared generation row
      const ga = genOf(a.data.person);
      const gb = genOf(b.data.person);
      const gy = Math.round((ga + gb) / 2) * cfg.gapY;
      a.y = gy;
      b.y = gy;

      // Pull horizontally together around their midpoint with depth-aware spacing
      const cx = (a.x + b.x) / 2;
      const gen = Math.round((ga + gb) / 2);
      const gap = baseSpouse * (1 + Math.min(gen, cfg.narrowDepthSpan) * 0.12);
      a.x = cx - gap / 2;
      b.x = cx + gap / 2;
    });

  // Position children centered under their parent(s), distribute siblings
  const childGroups = new Map(); // key -> { centerX, y, children: [] }
  relationships
    .filter((r) => r.type === "parent-child")
    .forEach((r) => {
      const child = byIdTmp.get(r.childId);
      if (!child) return;

      // Determine parents to compute center
      let parents = [];
      if (Array.isArray(r.parents) && r.parents.length) {
        parents = r.parents.map((pid) => byIdTmp.get(pid)).filter(Boolean);
      } else if (r.parentId && byIdTmp.has(r.parentId)) {
        parents = [byIdTmp.get(r.parentId)];
      }
      if (!parents.length) return;

      const centerX = parents.reduce((acc, p) => acc + p.x, 0) / parents.length;
      const key =
        parents
          .map((p) => p.data.id)
          .sort()
          .join("|") || `__${r.parentId || "none"}__`;

      // Position children one generation below the parents' row
      const parentY = parents.reduce((acc, p) => acc + p.y, 0) / parents.length;

      if (!childGroups.has(key)) {
        childGroups.set(key, { centerX, y: parentY + cfg.gapY, children: [] });
      }
      childGroups.get(key).children.push(child);
    });

  // Apply sibling distribution per group, centered under parent(s)
  childGroups.forEach((group) => {
    const kids = group.children;
    if (!kids || kids.length === 0) return;
    // Use current order by x to preserve rough ordering
    kids.sort((a, b) => a.x - b.x);
    const n = kids.length;
    const gap = cfg.siblingGap || 120;
    const total = (n - 1) * gap;
    const start = group.centerX - total / 2;
    for (let i = 0; i < n; i++) {
      kids[i].x = start + i * gap;
      // Snap to a row directly under parents
      kids[i].y = group.y;
    }
  });

  // Build union hubs for parent pairs and child anchors under those hubs
  // - For two-parent relations, create a hub above the spouse row (between parents) and anchor children to hub.x
  // - For single-parent relations, anchor children to the parent's x

  const hubKey = (a, b) => {
    const [x, y] = [a, b].sort();
    return `${x}|${y}`;
  };

  // First pass: collect hubs by parent pair
  const hubParents = new Map(); // key -> {aId,bId}
  relationships
    .filter((r) => r.type === "parent-child")
    .forEach((r) => {
      if (Array.isArray(r.parents) && r.parents.length === 2) {
        const [pa, pb] = r.parents;
        if (byIdTmp.has(pa) && byIdTmp.has(pb)) {
          const key = hubKey(pa, pb);
          if (!hubParents.has(key)) {
            hubParents.set(key, { aId: pa, bId: pb });
          }
        }
      }
    });

  const hubMap = new Map(); // key -> {x, y, aId, bId}

  // Second pass: compute hub positions from current node positions
  hubParents.forEach(({ aId, bId }, key) => {
    const a = byIdTmp.get(aId);
    const b = byIdTmp.get(bId);
    if (!a || !b) return;

    const x = (a.x + b.x) / 2;
    hubMap.set(key, { x, aId, bId });
  });

  // Build child anchors using hubs (or single-parent x)
  const childAnchorById = new Map();
  relationships
    .filter((r) => r.type === "parent-child")
    .forEach((r) => {
      const child = byIdTmp.get(r.childId);
      if (!child) return;
      if (Array.isArray(r.parents) && r.parents.length === 2) {
        const [pa, pb] = r.parents;
        const key = hubKey(pa, pb);
        const hub = hubMap.get(key);
        if (hub) {
          childAnchorById.set(child.data.id, hub.x);
        }
      } else if (r.parentId && byIdTmp.has(r.parentId)) {
        const p = byIdTmp.get(r.parentId);
        childAnchorById.set(child.data.id, p.x);
      }
    });

  // Final per-row collision resolution to avoid overlaps; treat spouse pairs as a unit
  const rows2 = new Map();
  nodes.forEach((d) => {
    const gy = d.y;
    if (!rows2.has(gy)) rows2.set(gy, []);
    rows2.get(gy).push(d);
  });
  rows2.forEach((rowNodes, gy) => {
    // Build spouse map for this row (both directions)
    const rowIds = new Set(rowNodes.map((n) => n.data.id));
    const spouseMap = new Map();
    relationships
      .filter((r) => r.type === "spouse")
      .forEach((r) => {
        const aId = r.personAId;
        const bId = r.personBId;
        if (rowIds.has(aId) && rowIds.has(bId)) {
          const aNode = rowNodes.find((n) => n.data.id === aId);
          const bNode = rowNodes.find((n) => n.data.id === bId);
          if (aNode && bNode) {
            spouseMap.set(aId, bNode);
            spouseMap.set(bId, aNode);
          }
        }
      });

    // Build units (couples as a single block) and lay them out with fixed gaps
    rowNodes.sort((a, b) => a.x - b.x);
    const minGap = cfg.rowMinGap || cfg.siblingGap || 120;
    const coupleGap = cfg.baseSpouseGap || baseSpouse || 140;

    const units = [];
    const seen = new Set();

    // Build adjacency (spouses within this row)
    const spousesById = new Map();
    rowNodes.forEach((n) => spousesById.set(n.data.id, []));
    relationships
      .filter((r) => r.type === "spouse")
      .forEach((r) => {
        const aId = r.personAId;
        const bId = r.personBId;
        if (spousesById.has(aId) && spousesById.has(bId)) {
          const aNode = rowNodes.find((n) => n.data.id === aId);
          const bNode = rowNodes.find((n) => n.data.id === bId);
          if (aNode && bNode) {
            spousesById.get(aId).push(bNode);
            spousesById.get(bId).push(aNode);
          }
        }
      });

    // Cluster multi-spouse centers: keep all spouses adjacent around the center
    for (const n of rowNodes) {
      if (seen.has(n.data.id)) continue;
      const partners = (spousesById.get(n.data.id) || []).filter(
        (p) => Math.round(p.y) === Math.round(n.y)
      );
      if (partners.length >= 2) {
        // Multi-spouse cluster: [partner1, center, partner2, ...] ordered by anchor
        const center = n;
        const partnerSorted = partners
          .filter((p) => !seen.has(p.data.id))
          .sort((a, b) => a.x - b.x);
        let nodes;
        if (partnerSorted.length === 2) {
          // Ensure the center person is adjacent to both spouses: [leftSpouse, center, rightSpouse]
          const leftSpouse =
            partnerSorted[0].x <= partnerSorted[1].x
              ? partnerSorted[0]
              : partnerSorted[1];
          const rightSpouse =
            leftSpouse === partnerSorted[0]
              ? partnerSorted[1]
              : partnerSorted[0];
          nodes = [leftSpouse, center, rightSpouse];
        } else {
          // Fallback for 3+ partners: insert center at approximate anchor location
          nodes = [...partnerSorted];
          const centerAnchor = childAnchorById.get(center.data.id) ?? center.x;
          let idx = 0;
          for (; idx < nodes.length; idx++) {
            const a = childAnchorById.get(nodes[idx].data.id) ?? nodes[idx].x;
            if (a > centerAnchor) break;
          }
          nodes.splice(idx, 0, center);
        }
        nodes.forEach((p) => seen.add(p.data.id));
        units.push({ type: "cluster", center, nodes });
      }
    }

    // Remaining nodes: couples or singles
    for (const n of rowNodes) {
      if (seen.has(n.data.id)) continue;
      const partner = spouseMap.get(n.data.id);
      if (
        partner &&
        Math.round(partner.y) === Math.round(n.y) &&
        !seen.has(partner.data.id)
      ) {
        const left = n.x <= partner.x ? n : partner;
        const right = left === n ? partner : n;
        units.push({ type: "couple", nodes: [left, right] });
        seen.add(n.data.id);
        seen.add(partner.data.id);
      } else {
        units.push({ type: "single", nodes: [n] });
        seen.add(n.data.id);
      }
    }

    // Order units by current average x to preserve rough order
    units.sort((u1, u2) => {
      const x1 = u1.nodes.reduce((s, n) => s + n.x, 0) / u1.nodes.length;
      const x2 = u2.nodes.reduce((s, n) => s + n.x, 0) / u2.nodes.length;
      return x1 - x2;
    });

    // Place units near their own parent-anchored target positions (prevents global drift)
    function unitAnchor(u) {
      // Prefer anchoring on the central person in a multi-spouse cluster,
      // otherwise use the average parent anchor for the unit, or current mean x.
      if (u.type === "cluster") {
        const c = u.center || u.nodes[Math.floor(u.nodes.length / 2)];
        const a = childAnchorById.get(c.data.id);
        return typeof a === "number" ? a : c.x;
      }
      const anchors = u.nodes
        .map((n) => childAnchorById.get(n.data.id))
        .filter((v) => typeof v === "number");
      if (anchors.length) return d3.mean(anchors);
      const meanX = u.nodes.reduce((s, n) => s + n.x, 0) / u.nodes.length;
      return meanX;
    }
    function unitWidth(u) {
      if (u.type === "cluster")
        return coupleGap * Math.max(0, u.nodes.length - 1);
      if (u.type === "couple") return coupleGap;
      return 0; // single treated as a point with enforced min gaps
    }

    // Sort by desired anchor to keep original left/right intent
    units.sort((u1, u2) => unitAnchor(u1) - unitAnchor(u2));

    // Forward pass: greedy placement honoring targets and minimum gaps
    let cursor = -Infinity;
    for (const u of units) {
      const w = unitWidth(u);
      let center = unitAnchor(u);
      if (cursor > -Infinity) {
        const minCenter = cursor + minGap + w / 2;
        if (center < minCenter) center = minCenter;
      }
      if (u.type === "single") {
        u.nodes[0].x = center;
        cursor = center;
      } else if (u.type === "couple") {
        const leftX = center - w / 2;
        const rightX = center + w / 2;
        u.nodes[0].x = leftX;
        u.nodes[1].x = rightX;
        cursor = rightX;
      } else if (u.type === "cluster") {
        // Place cluster nodes evenly with coupleGap around center
        const leftX = center - w / 2;
        for (let i = 0; i < u.nodes.length; i++) {
          u.nodes[i].x = leftX + i * coupleGap;
        }
        cursor = leftX + w;
      }
    }

    // Optional backward tightening pass: pull items left toward targets without breaking gaps
    cursor = Infinity;
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      const w = unitWidth(u);
      let center = unitAnchor(u);
      if (cursor < Infinity) {
        const maxCenter = cursor - (minGap + w / 2);
        if (center > maxCenter) center = maxCenter;
      }
      if (u.type === "single") {
        // Keep the max to avoid inverting order with previous placement
        u.nodes[0].x = Math.min(u.nodes[0].x, center);
        cursor = u.nodes[0].x;
      } else if (u.type === "couple") {
        const leftX = center - w / 2;
        const rightX = center + w / 2;
        // Keep the max tightening only
        u.nodes[0].x = Math.min(u.nodes[0].x, leftX);
        u.nodes[1].x = Math.min(u.nodes[1].x, rightX);
        cursor = u.nodes[0].x; // next maxCenter will be computed vs this left edge
      } else if (u.type === "cluster") {
        const leftX = center - w / 2;
        for (let i = 0; i < u.nodes.length; i++) {
          const targetX = leftX + i * coupleGap;
          u.nodes[i].x = Math.min(u.nodes[i].x, targetX);
        }
        cursor = leftX; // treat left edge as reference for next unit
      }
    }
  });

  // SVG
  const svg = d3
    .select(containerEl)
    .append("svg")
    .attr("class", "tree-svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g");

  // Zoom/pan
  const zoom = d3
    .zoom()
    .scaleExtent([cfg.zoomMin, cfg.zoomMax])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg.call(zoom);

  // Draw links (parent-child), using midpoint between two parents when available
  const linkGen = d3
    .linkVertical()
    .x((d) => d.x)
    .y((d) => d.y);

  const byId = new Map(nodes.map((d) => [d.data.id, d]));

  // Recompute hub render positions using final node coordinates (after collision resolution)
  const hubRenderMap = new Map();
  hubParents.forEach(({ aId, bId }, key) => {
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a || !b) return;
    const rowY = (a.y + b.y) / 2;
    const x = (a.x + b.x) / 2;
    const attachY = rowY; // children should connect on the spouse row midpoint
    hubRenderMap.set(key, { x, attachY, aId, bId });
  });

  // Build child links via hubs: for two parents, link from hub -> child; for single parent, link parent -> child
  const hubChildLinks = [];
  relationships
    .filter((r) => r.type === "parent-child")
    .forEach((r) => {
      const child = byId.get(r.childId);
      if (!child) return;
      if (Array.isArray(r.parents) && r.parents.length === 2) {
        const [pa, pb] = r.parents;
        if (byId.has(pa) && byId.has(pb)) {
          const key = hubKey(pa, pb);
          const hub = hubRenderMap.get(key);
          if (hub) {
            hubChildLinks.push({
              source: { x: hub.x, y: hub.attachY },
              target: { x: child.x, y: child.y },
              childId: child.data.id,
              parentIds: [pa, pb],
            });
          }
        }
      } else if (r.parentId && byId.has(r.parentId)) {
        const p = byId.get(r.parentId);
        hubChildLinks.push({
          source: { x: p.x, y: p.y },
          target: { x: child.x, y: child.y },
          childId: child.data.id,
          parentIds: [r.parentId],
        });
      }
    });

  g.selectAll("path.tree-link")
    .data(hubChildLinks)
    .enter()
    .append("path")
    .attr("class", "tree-link")
    .attr("data-child-id", (d) => d.childId)
    .attr("d", (d) => linkGen(d));

  // Draw spouse connectors:
  // - For any person with multiple spouses on the same row, draw an arch above the row
  //   instead of a horizontal line (to avoid ambiguity with siblings/children).
  // - Otherwise draw a straight horizontal line.
  const spouseEdges = relationships
    .filter((r) => r.type === "spouse")
    .map((r) => {
      const a = byId.get(r.personAId);
      const b = byId.get(r.personBId);
      if (!a || !b) return null;
      return { a, b };
    })
    .filter(Boolean);

  const spouseDegree = new Map();
  spouseEdges.forEach(({ a, b }) => {
    if (Math.round(a.y) === Math.round(b.y)) {
      spouseDegree.set(a.data.id, (spouseDegree.get(a.data.id) || 0) + 1);
      spouseDegree.set(b.data.id, (spouseDegree.get(b.data.id) || 0) + 1);
    }
  });

  const arcEdges = [];
  const lineEdges = [];
  spouseEdges.forEach(({ a, b }) => {
    const multi =
      (spouseDegree.get(a.data.id) || 0) >= 2 ||
      (spouseDegree.get(b.data.id) || 0) >= 2;

    // Edge-case exception: P110 ↔ P159 should use an arch (no horizontal bar)
    // to avoid crossing siblings due to distant lateral placement.
    const key = hubKey(a.data.id, b.data.id);
    const isException = key === hubKey("P110", "P159");

    if (multi) {
      if (isException) {
        // Exception pair: use arch only to avoid crossings
        arcEdges.push({ x1: a.x, x2: b.x, y: a.y });
      } else {
        // Default for multi-spouse: horizontal bar between spouses
        lineEdges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    } else {
      lineEdges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  });

  // Ensure parent-child links never terminate into "empty space":
  // For any parent pair that has children but is not explicitly marked as "spouse",
  // draw a union bar at the spouse row so hub→child links visibly attach.
  const spouseKeySet = new Set();
  spouseEdges.forEach(({ a, b }) => {
    spouseKeySet.add(hubKey(a.data.id, b.data.id));
  });
  for (const [key, hub] of hubRenderMap.entries()) {
    if (!spouseKeySet.has(key)) {
      const aNode = byId.get(hub.aId);
      const bNode = byId.get(hub.bId);
      if (aNode && bNode) {
        lineEdges.push({
          x1: aNode.x,
          y1: hub.attachY,
          x2: bNode.x,
          y2: hub.attachY,
        });
      }
    }
  }

  const archHeight = Math.max(60, cfg.gapY * 0.45);

  g.selectAll("path.tree-spouse-arc")
    .data(arcEdges)
    .enter()
    .append("path")
    .attr("class", "tree-spouse")
    .attr(
      "d",
      (d) =>
        `M ${d.x1},${d.y} C ${d.x1},${d.y - archHeight} ${d.x2},${
          d.y - archHeight
        } ${d.x2},${d.y}`
    );

  g.selectAll("line.tree-spouse-line")
    .data(lineEdges)
    .enter()
    .append("line")
    .attr("class", "tree-spouse")
    .attr("x1", (d) => d.x1)
    .attr("y1", (d) => d.y1)
    .attr("x2", (d) => d.x2)
    .attr("y2", (d) => d.y2);

  // Draw nodes
  const node = g
    .selectAll("g.tree-node")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", (d) => {
      const gender = d.data.person?.gender;
      const base = "tree-node";
      if (gender === "F") return `${base} node--F`;
      if (gender === "M") return `${base} node--M`;
      return base;
    })
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .style("cursor", "pointer")
    .on("click", (_event, d) => {
      setSelected(d.data.id);
      if (typeof options.onSelect === "function") {
        options.onSelect(d.data.id);
      }
    })
    .on("dblclick", (_event, d) => {
      // Re-center on double-click
      centerOn(d);
    });

  node.append("circle").attr("r", cfg.nodeRadius);

  node
    .append("text")
    .attr("dy", cfg.nodeRadius + 16)
    .attr("text-anchor", "middle")
    .text((d) => fullName(d.data.person));

  // Initial fit to container
  fit();

  // Selection handling
  let selectedId = null;

  function setSelected(id) {
    selectedId = id;
    g.selectAll("g.tree-node").classed("selected", (d) => d.data.id === id);

    // Highlight parent link(s) for the selected child
    const linkSel = g.selectAll("path.tree-link");
    linkSel
      // Primary: this node's link to its parents
      .classed("highlight", (d) => d.childId === id)
      // Secondary: this node's links to its children
      .classed(
        "highlight-secondary",
        (d) => Array.isArray(d.parentIds) && d.parentIds.includes(id)
      )
      .style("stroke-width", (d) =>
        d.childId === id
          ? 4
          : Array.isArray(d.parentIds) && d.parentIds.includes(id)
          ? 2.25
          : null
      )
      .style("stroke", (d) =>
        d.childId === id
          ? "#3b82f6" // brighter
          : Array.isArray(d.parentIds) && d.parentIds.includes(id)
          ? "#60a5fa" // subtler
          : null
      )
      .style("stroke-opacity", (d) =>
        d.childId === id
          ? 1
          : Array.isArray(d.parentIds) && d.parentIds.includes(id)
          ? 0.9
          : null
      );
    // Raise secondary first, then primary on top
    linkSel
      .filter((d) => Array.isArray(d.parentIds) && d.parentIds.includes(id))
      .raise();
    linkSel.filter((d) => d.childId === id).raise();

    // Optionally center on selected node if visible
    const targetNode = g
      .selectAll("g.tree-node")
      .filter((d) => d.data.id === id);
    if (!targetNode.empty()) {
      const d = targetNode.datum();
      centerOn(d);
    }
  }

  function centerOn(d) {
    const t = d3.zoomTransform(svg.node());
    const k = t.k || 1;
    const tx = width / 2 - d.x * k;
    const ty = height / 2 - d.y * k;
    svg
      .transition()
      .duration(cfg.transitionMs)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
  }

  // Fit entire tree content into the container (with padding)
  function fit(pad = 12) {
    try {
      const bbox = g.node().getBBox();
      const bw = bbox.width || 1;
      const bh = bbox.height || 1;
      const cx = bbox.x + bw / 2;
      const cy = bbox.y + bh / 2;

      const scaleY = (height - pad * 2) / bh;
      let k = scaleY;
      k = Math.max(cfg.zoomMin, Math.min(cfg.zoomMax, k));

      const tx = width / 2 - cx * k;
      const ty = height / 2 - cy * k;

      svg
        .transition()
        .duration(cfg.transitionMs)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
    } catch {
      const first = nodes[0];
      if (first) centerOn(first);
    }
  }

  function resize() {
    width = containerEl.clientWidth || width;
    height = containerEl.clientHeight || height;
    svg.attr("width", width).attr("height", height);
    // Keep current transform but ensure the SVG size matches container
    // Consumers can call select() after resize to re-center if desired.
  }

  function destroy() {
    svg.on(".zoom", null);
    svg.remove();
  }

  return {
    select: setSelected,
    resize,
    fit,
    destroy,
  };
}
