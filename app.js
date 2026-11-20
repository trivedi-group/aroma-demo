"use strict";

var CONFIG = window.AROMA || { mode: "inline", banner: "", vocab: {} };
var VOC = CONFIG.vocab || {};
var CARDS = window.OLFACTOCARDS || [];
var FETCH_MODE = !window.OLFACTOCARDS;

function vname(kind, code) {
  return (VOC[kind] && VOC[kind][code]) || code;
}

function sectionState(card, name) {
  return card.sections ? card.sections[name] : card[name].status;
}

var MATRIX = {
  skin_sebum: "Skin and sebum",
  breath: "Breath",
  indoor_air: "Indoor air",
  outdoor_air: "Outdoor air",
  food: "Food and flavour"
};
var ROLE = {
  panel: "Panel",
  anchor: "Cross-domain anchor",
  extender: "Shape-space extender",
  control: "Control"
};
var LIFECYCLE = [
  ["draft", "Draft"],
  ["identity_populated", "Identity populated"],
  ["measured", "Measured"],
  ["qc_passed", "QC passed"],
  ["released", "Released"]
];
var SECTION_LABEL = {
  identity: "Identity",
  shape: "Shape (IM-MS)",
  detectability: "Detectability",
  matrix_effect: "Matrix effect",
  perception: "Perception",
  provenance: "Provenance and QC"
};
var SECTION_ORDER = ["identity", "shape", "detectability", "matrix_effect", "perception", "provenance"];
var STATE_WORD = { pending: "Pending", partial: "Partial", complete: "Complete" };

var TYPEMAP = {
  identity: "t-identity", shape: "t-shape", detectability: "t-quant",
  matrix_effect: "t-quant", perception: "t-human", provenance: "t-record"
};
var main = document.getElementById("main");
var filters = { q: "", matrix: "", role: "", cls: "", sort: "id" };

function esc(value) {
  return String(value).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function formula(text) {
  return esc(text).replace(/([A-Za-z])(\d+)/g, "$1<sub>$2</sub>");
}

function box(state, section) {
  return '<span class="box ' + state + (section ? " " + TYPEMAP[section] : "") + '" title="' + (section ? SECTION_LABEL[section] + ": " : "") + STATE_WORD[state] + '"></span>';
}

function progress(card) {
  return '<span class="prog" aria-label="Section progress">' +
    SECTION_ORDER.map(function (s) { return box(sectionState(card, s), s); }).join("") + "</span>";
}

function quantity(q) {
  if (!q) { return '<span class="pending">Pending</span>'; }
  var text = String(q.value);
  if (q.expanded_uncertainty !== undefined) {
    text += " ± " + q.expanded_uncertainty;
  }
  return esc(text + " " + q.unit);
}

function tags(list, solid) {
  if (!list || !list.length) { return '<span class="muted">None listed</span>'; }
  return list.map(function (m) {
    return '<span class="tag' + (solid ? " solid" : "") + '">' + esc(MATRIX[m] || m) + "</span>";
  }).join("");
}

function find(slug) {
  for (var i = 0; i < CARDS.length; i += 1) {
    if (CARDS[i].slug === slug) { return CARDS[i]; }
  }
  return null;
}

/* Index */

function unique(values) {
  var seen = {};
  var out = [];
  values.forEach(function (v) { if (!seen[v]) { seen[v] = true; out.push(v); } });
  return out.sort();
}

function matches(card) {
  var id = card.identity;
  if (filters.q) {
    var hay = (id.name + " " + id.formula + " " + id.chemical_class + " " + card.id + " " + id.reported_odour.text).toLowerCase();
    if (hay.indexOf(filters.q.toLowerCase()) === -1) { return false; }
  }
  if (filters.matrix && card.contributed_by.indexOf(filters.matrix) === -1) { return false; }
  if (filters.role && card.panel_role !== filters.role) { return false; }
  if (filters.cls && id.chemical_class !== filters.cls) { return false; }
  return true;
}

function sorted(list) {
  var copy = list.slice();
  if (filters.sort === "name") {
    copy.sort(function (a, b) { return a.identity.name.localeCompare(b.identity.name); });
  } else if (filters.sort === "mass") {
    copy.sort(function (a, b) { return a.identity.monoisotopic_mass - b.identity.monoisotopic_mass; });
  } else {
    copy.sort(function (a, b) { return a.id.localeCompare(b.id); });
  }
  return copy;
}

function rowsHtml() {
  var list = sorted(CARDS.filter(matches));
  document.getElementById("count").textContent =
    list.length + " of " + CARDS.length + " cards";
  if (!list.length) {
    return '<tr><td colspan="8" class="muted">No cards match these filters.</td></tr>';
  }
  return list.map(function (c) {
    var id = c.identity;
    return '<tr class="row" data-slug="' + esc(c.slug) + '">' +
      "<td>" + esc(c.id) + "</td>" +
      '<td><a href="#/card/' + esc(c.slug) + '"><b>' + esc(id.name) + "</b></a></td>" +
      "<td>" + formula(id.formula) + "</td>" +
      '<td class="num">' + id.monoisotopic_mass.toFixed(4) + "</td>" +
      '<td class="hide-sm">' + esc(id.chemical_class) + "</td>" +
      '<td class="hide-sm">' + tags(c.contributed_by) + "</td>" +
      '<td class="hide-sm">' + esc(ROLE[c.panel_role]) + "</td>" +
      "<td>" + progress(c) + "</td></tr>";
  }).join("");
}

function renderIndex() {
  document.title = "OlfactoCards";
  var classes = unique(CARDS.map(function (c) { return c.identity.chemical_class; }));
  var matrixOptions = Object.keys(MATRIX).map(function (k) {
    return '<option value="' + k + '">' + MATRIX[k] + "</option>";
  }).join("");
  var roleOptions = Object.keys(ROLE).map(function (k) {
    return '<option value="' + k + '">' + ROLE[k] + "</option>";
  }).join("");
  var classOptions = classes.map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + "</option>";
  }).join("");

  main.innerHTML =
    "<h1>OlfactoCards</h1>" +
    '<p class="lede">A standardised reference record for each analyte in the AROMA archive. Every card links a molecule to its identity, ion shape, detectability, matrix effects and human perception, measured under common protocols across laboratories. <a href="#/about">How a card is organised</a>.</p>' +
    '<div class="controls" role="search">' +
    '<div><label for="q">Search</label><input id="q" type="search" placeholder="Name, formula, class or odour"></div>' +
    '<div><label for="fm">Matrix</label><select id="fm"><option value="">All matrices</option>' + matrixOptions + "</select></div>" +
    '<div><label for="fr">Panel role</label><select id="fr"><option value="">All roles</option>' + roleOptions + "</select></div>" +
    '<div><label for="fc">Chemical class</label><select id="fc"><option value="">All classes</option>' + classOptions + "</select></div>" +
    '<div><label for="fs">Sort by</label><select id="fs"><option value="id">Card ID</option><option value="name">Name</option><option value="mass">Monoisotopic mass</option></select></div>' +
    "</div>" +
    legend() +
    '<p class="count" id="count" aria-live="polite"></p>' +
    '<div class="tablewrap"><table><thead><tr><th>ID</th><th>Compound</th><th>Formula</th><th class="num">Mass (Da)</th>' +
    '<th class="hide-sm">Class</th><th class="hide-sm">Expected in</th><th class="hide-sm">Role</th><th>Sections</th></tr></thead>' +
    '<tbody id="rows"></tbody></table></div>';

  var q = document.getElementById("q");
  q.value = filters.q;
  document.getElementById("fm").value = filters.matrix;
  document.getElementById("fr").value = filters.role;
  document.getElementById("fc").value = filters.cls;
  document.getElementById("fs").value = filters.sort;
  var tbody = document.getElementById("rows");
  function refresh() { tbody.innerHTML = rowsHtml(); }
  q.addEventListener("input", function () { filters.q = q.value; refresh(); });
  document.getElementById("fm").addEventListener("change", function (e) { filters.matrix = e.target.value; refresh(); });
  document.getElementById("fr").addEventListener("change", function (e) { filters.role = e.target.value; refresh(); });
  document.getElementById("fc").addEventListener("change", function (e) { filters.cls = e.target.value; refresh(); });
  document.getElementById("fs").addEventListener("change", function (e) { filters.sort = e.target.value; refresh(); });
  tbody.addEventListener("click", function (e) {
    var tr = e.target.closest("tr.row");
    if (tr && !e.target.closest("a")) { location.hash = "#/card/" + tr.getAttribute("data-slug"); }
  });
  refresh();
}

/* Card */

var TYPE = {
  identity: "t-identity",
  shape: "t-shape",
  detectability: "t-quant",
  matrix_effect: "t-quant",
  perception: "t-human",
  provenance: "t-record"
};
var TYPE_INFO = [
  ["t-identity", "Identity and cross-links", "Calculated from structure or taken from other databases"],
  ["t-shape", "Shape", "CCS from ion mobility mass spectrometry"],
  ["t-quant", "Detectability and matrix effect", "LOD, LOQ, linearity and response in matrix"],
  ["t-human", "Human perception", "Assessor detection, intensity and descriptors"],
  ["t-record", "Provenance and QC", "SOPs, raw data and retained quality records"]
];
/* The rows printed on the card in the sprint proposal. Data from any other platform or
   laboratory adds rows, so a new laboratory or platform needs no change to this file. */
var PLATFORMS = [
  ["GCQTOF", "UOM"],
  ["TDQQQ", "WYT"],
  ["TDGCMS", "LU"],
  ["GCMS", "UOR"]
];
var MATRIX_ROWS = ["sebum", "breath", "food", "fridge_air", "outdoor_air"];
var MAX_PLATFORM_ROWS = 8;

function legend() {
  return '<ul class="legend" aria-label="Data types">' + TYPE_INFO.map(function (t) {
    return '<li><span class="sw ' + t[0] + '"></span><span><b>' + esc(t[1]) + "</b><br>" + esc(t[2]) + "</span></li>";
  }).join("") + "</ul>";
}

function lowerFirst(text) {
  return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function blank(text) {
  return '<span class="blank">' + esc(text || "[\u00a0]") + "</span>";
}

function qv(q, fallback) {
  if (!q) { return blank(fallback); }
  return esc(q.value + (q.expanded_uncertainty !== undefined ? " ± " + q.expanded_uncertainty : ""));
}

function qvu(q) {
  return qv(q) + (q && q.unit ? " " + esc(q.unit) : "");
}

function row(label, valueHtml) {
  return '<div class="f"><span class="k">' + label + '</span><span class="v">' + valueHtml + "</span></div>";
}

function head(title) {
  return "<h2>" + title + "</h2>";
}

function panelText(card) {
  if (!card.contributed_by.length) { return "none listed"; }
  return card.contributed_by.map(function (m) {
    return m === "food" ? "food and flavour" : (MATRIX[m] || m).toLowerCase();
  }).join(", ");
}

function identityBlock(card) {
  var id = card.identity;
  var x = id.cross_links;
  var ident = id.identification;
  var level = ident.status === "pending" ? blank("[ ]") : esc(ident.msi_level);
  var mh = id.adducts.filter(function (a) { return a.adduct === "[M+H]+"; })[0];
  var links1 = [x.pubchem_cid ? "PubChem " + esc(x.pubchem_cid) : blank("[PubChem]"), x.hmdb ? esc(x.hmdb) : blank("[HMDB]"), x.chebi ? "ChEBI:" + esc(x.chebi) : blank("[ChEBI]")].join(", ");
  var links2 = [x.chembl ? esc(x.chembl) : blank("[ChEMBL]"), "CSD " + (x.csd_refcode ? esc(x.csd_refcode) : blank("[refcode]"))].join(", ");
  return '<section class="blk t-identity" id="identity">' + head("IDENTITY") +
    '<div class="idtop"><img src="structures/' + esc(card.slug) + '.svg" alt="Skeletal structure of ' + esc(id.name) + '" width="120" height="87">' +
    '<div class="kv">' +
    row("Name", esc(lowerFirst(id.name))) +
    row("Formula", formula(id.formula)) +
    row("Class", esc(lowerFirst(id.chemical_class))) +
    row("Panel", esc(panelText(card))) +
    "</div></div>" +
    '<div class="kv wide">' +
    row("Exact mass", esc(id.monoisotopic_mass.toFixed(4)) + " Da") +
    row("[M+H]<sup>+</sup> <i>m/z</i>", esc(mh.mz.toFixed(4))) +
    row("InChIKey", esc(id.inchikey)) +
    row("SMILES", esc(id.smiles)) +
    row("ID confidence", "level " + level + (ident.msi_level === 1 ? " (standard)" : "")) +
    row("Cross-links", links1 + "<br>" + links2) +
    "</div></section>";
}

function shapeBlock(card) {
  var s = card.shape.summary || {};
  var x = card.identity.cross_links;
  return '<section class="blk t-shape" id="shape">' + head("SHAPE (IM-MS)") +
    '<div class="kv wide">' +
    row("CCS (N<sub>2</sub>), [M+H]<sup>+</sup>", s.ccs ? qv(s.ccs) + " Å<sup>2</sup>" : blank("[ ]") + " Å<sup>2</sup>") +
    row("Method, calibrant", (s.method ? esc(s.method.replace(/_/g, " ")) : blank("[ ]")) + ", " + (s.calibrant ? esc(s.calibrant) : blank("[ ]"))) +
    row("Labs, CSD structure", (s.labs && s.labs.length ? esc(s.labs.map(function (l) { return vname("labs", l); }).join(", ")) : blank("[ ]")) + ", " + (x.csd_refcode ? esc(x.csd_refcode) : blank("[refcode]"))) +
    "</div></section>";
}

function platformLabel(platform, lab) {
  return esc(vname("platforms", platform)) + " (" + esc(vname("labs", lab)) + ")";
}

function detectBlock(card) {
  var data = card.detectability.by_platform.slice().sort(function (x, y) {
    return (vname("platforms", x.platform) + x.lab).localeCompare(vname("platforms", y.platform) + y.lab);
  });
  var seen = {};
  var rows = data.map(function (d) {
    seen[d.platform + "|" + d.lab] = true;
    var lin = d.linearity;
    return "<tr><td>" + platformLabel(d.platform, d.lab) + "</td><td>" + qv(d.lod) + "</td><td>" + qv(d.loq) + "</td><td>" +
      (lin ? esc(lin.range_low + " to " + lin.range_high) : blank("[ ]")) +
      "</td><td>" + (lin && lin.r_squared !== undefined ? esc(lin.r_squared) : blank("[ ]")) + "</td></tr>";
  });
  PLATFORMS.forEach(function (p) {
    if (!seen[p[0] + "|" + p[1]]) {
      rows.push("<tr><td>" + platformLabel(p[0], p[1]) + "</td><td>" + blank("[ ]") + "</td><td>" + blank("[ ]") +
        "</td><td>" + blank("[ ]") + "</td><td>" + blank("[ ]") + "</td></tr>");
    }
  });
  var extra = rows.length - MAX_PLATFORM_ROWS;
  if (extra > 0) {
    rows = rows.slice(0, MAX_PLATFORM_ROWS);
    rows.push('<tr><td colspan="5" class="muted">+ ' + extra + ' more in the <a href="api/v1/cards/' + esc(card.slug) + '.json">JSON record</a></td></tr>');
  }
  return '<section class="blk t-quant" id="detectability">' + head("DETECTABILITY") +
    '<table class="plat"><thead><tr><th>Platform (lab)</th><th>LOD (ng)</th><th>LOQ (ng)</th><th>Range (ng)</th><th>R<sup>2</sup></th></tr></thead><tbody>' +
    rows.join("") + "</tbody></table></section>";
}

function span(values) {
  var lo = Math.min.apply(null, values);
  var hi = Math.max.apply(null, values);
  return lo === hi ? esc(lo) : esc(lo) + " to " + esc(hi);
}

function matrixBlock(card) {
  var me = card.matrix_effect;
  var keys = MATRIX_ROWS.slice();
  me.by_matrix.forEach(function (m) { if (keys.indexOf(m.matrix) === -1) { keys.push(m.matrix); } });
  function cell(key) {
    var hits = me.by_matrix.filter(function (m) { return m.matrix === key; });
    var label = key === "food" ? "food" : vname("matrices", key);
    return esc(label) + " " + (hits.length ? span(hits.map(function (h) { return h.response_relative_to_neat.value; })) : blank("[ ]"));
  }
  var cells = keys.map(cell);
  var shifts = me.by_matrix.filter(function (m) { return m.lod_shift_fold; }).map(function (m) { return m.lod_shift_fold.value; });
  return '<section class="blk t-quant" id="matrix_effect">' + head("MATRIX EFFECT") +
    '<div class="kv wide">' +
    row("Response in matrix<br>relative to neat", cells.slice(0, 3).join(", ") + "<br>" + cells.slice(3).join(", ")) +
    row("LOD shift in matrix", (shifts.length ? span(shifts) : blank("[ ]")) + " fold") +
    "</div></section>";
}

function perceptionBlock(card) {
  var p = card.perception;
  var s = p.summary || {};
  var lit = p.concentration_dependent_quality || [];
  var text = esc(card.identity.reported_odour.text);
  var bar;
  if (lit.length === 2) {
    bar = '<div class="grad"><span>' + esc(lowerFirst(lit[0].descriptor)) + ' (trace)</span><span>' + esc(lowerFirst(lit[1].descriptor)) + ' (high)</span></div>' +
      '<div class="marks"><div class="m1"><i class="tri"></i>detection ' + (s.detection_level ? qvu(s.detection_level) : blank("[ ]")) + "</div>" +
      '<div class="m2"><i class="tri"></i>quality change ' + (s.quality_change_level ? qvu(s.quality_change_level) : blank("[ ]")) + "</div></div>";
  } else {
    bar = '<div class="kv wide">' +
      row("Detection", s.detection_level ? qvu(s.detection_level) : blank("[ ]")) +
      row("Quality change", s.quality_change_level ? qvu(s.quality_change_level) : blank("[ ]")) + "</div>";
  }
  return '<section class="blk t-human" id="perception">' + head("PERCEPTION") +
    '<p class="odour">' + text + "</p>" + bar +
    '<div class="kv wide">' +
    row("GC-O detection", (s.gco_neat ? qvu(s.gco_neat) : blank("[ ]")) + " neat, " + (s.gco_in_matrix ? qvu(s.gco_in_matrix) : blank("[ ]")) + " in matrix") +
    row("Intensity, descriptor", (s.intensity !== undefined ? esc(s.intensity) : blank("[ ]")) + ", " + (s.descriptor ? esc(s.descriptor) : blank("[ ]"))) +
    row("Assessors, lexicon", "n = " + (s.assessors_n !== undefined ? esc(s.assessors_n) : blank("[ ]")) + ", v" + (s.lexicon_version ? esc(s.lexicon_version) : blank("[ ]"))) +
    "</div></section>";
}

function provenanceBlock(card) {
  var pv = card.provenance;
  var sop = pv.sops && pv.sops.length ? pv.sops[0] : null;
  var more = pv.sops && pv.sops.length > 1 ? " +" + (pv.sops.length - 1) : "";
  var raw = pv.file_counts && pv.file_counts.raw_vendor;
  var mz = pv.file_counts && pv.file_counts.mzml;
  var retained = pv.run_count ? pv.blank_runs + " blanks, " + pv.qc_flags.length + " QC flags, " + pv.failed_runs + " failed runs" : "blanks, QC flags, failed runs";
  return '<section class="blk t-record" id="provenance">' + head("PROVENANCE AND QC") +
    '<div class="kv wide">' +
    row("SOP", (sop ? esc(sop.id) : blank("[ID]")) + ", version " + (sop ? esc(sop.version) : blank("[ ]")) + esc(more)) +
    row("Raw data", (raw ? esc(raw) + " vendor files, " : "vendor files, ") + (mz ? esc(mz) + " mzML " : "mzML ") +
      (pv.raw_data_doi ? '<a href="https://doi.org/' + esc(pv.raw_data_doi) + '">' + esc(pv.raw_data_doi) + "</a>" : blank("[DOI]"))) +
    row("Retained", esc(retained)) +
    "</div></section>";
}

function renderCard(card) {
  document.title = card.identity.name + " - OlfactoCard " + card.id;
  var current = LIFECYCLE.map(function (x) { return x[0]; }).indexOf(card.status);
  var steps = LIFECYCLE.map(function (s, i) {
    return '<li class="' + (i < current ? "done" : (i === current ? "now" : "")) + '">' + s[1] + "</li>";
  }).join("");
  var versionText = "version " + card.schema_version.split(".").slice(0, 2).join(".") + ", Sprint pilot, example layout";

  main.innerHTML =
    '<p class="crumbs"><a href="#/">All cards</a> / ' + esc(card.identity.name) + "</p>" +
    '<div class="pagebar"><ol class="steps" aria-label="Card status">' + steps + "</ol>" +
    '<span class="small">Download: <a href="api/v1/cards/' + esc(card.slug) + '.json">JSON record</a></span></div>' +
    legend() +
    '<article class="oc" aria-label="OlfactoCard ' + esc(card.id) + '">' +
    '<header class="oc-head"><div><b>OlfactoCard</b><span>' + esc(card.id) + ", " + esc(card.identity.name) + "</span></div>" +
    "<div>" + esc(versionText) + "</div></header>" +
    '<div class="oc-grid">' +
    '<div class="col">' + identityBlock(card) + "</div>" +
    '<div class="col">' + shapeBlock(card) + detectBlock(card) + matrixBlock(card) + "</div>" +
    '<div class="col">' + perceptionBlock(card) + provenanceBlock(card) + "</div>" +
    "</div></article>" +
    '<p class="small muted note-under">An empty bracket means the value has not yet been measured. Calculated and cross-linked identity values are shown without brackets.</p>';
}

/* About */

function renderAbout() {
  document.title = "About the card - OlfactoCards";
  main.innerHTML =
    '<div class="about"><p class="crumbs"><a href="#/">All cards</a> / About the card</p>' +
    "<h1>About the card</h1>" +
    '<p class="lede">An OlfactoCard combines multi-laboratory measurements of identity, mass-to-charge ratio, collision cross section, limit of detection, limit of quantification, linearity and matrix effect with human perception data, gathered under common standard operating procedures.</p>' +
    "<h2>Colour key</h2>" + legend() +
    "<h2>The six sections</h2><ol>" +
    "<li><b>Identity</b> (blue). Name, formula, class, panel, exact mass, calculated [M+H]<sup>+</sup> m/z, InChIKey, SMILES, identification confidence and cross-links to HMDB, ChEBI, ChEMBL and the Cambridge Structural Database.</li>" +
    "<li><b>Shape (IM-MS)</b> (magenta). CCS in N<sub>2</sub> for [M+H]<sup>+</sup>, method, calibrant and laboratories.</li>" +
    "<li><b>Detectability</b> (green, shared with matrix effect). LOD, LOQ, range and R<sup>2</sup> for each platform and laboratory, kept separate so platforms can be compared.</li>" +
    "<li><b>Matrix effect</b> (green, shared with detectability). Response in sebum, breath, food, fridge air and outdoor air relative to neat, and the LOD shift in matrix.</li>" +
    "<li><b>Perception</b> (orange). Odour description, the concentrations at which detection and quality change occur, GC-O detection neat and in matrix, intensity, descriptor, assessors and lexicon version.</li>" +
    "<li><b>Provenance and QC</b> (grey). SOP identifier and version, raw data and mzML with a DOI, and the retained blanks, QC flags and failed runs.</li></ol>" +
    "<h2>What is real and what is pending</h2>" +
    "<p>Identity values on every card are calculated from the structure and checked against the panel table. Every measured field is empty until a laboratory deposits a result. The site never shows a placeholder number, so an empty field always means not yet measured.</p>" +
    "<h2>How a card moves to release</h2>" +
    "<ul><li>Each laboratory submits CSV tables and raw files named under the common convention. The AROMA checker tests them before they are accepted.</li>" +
    "<li>The AROMA build loads every submission into one database and derives the LOD, LOQ, linear range, matrix effect and CCS summary by the published definitions. No laboratory types a derived value.</li>" +
    "<li>Cards are regenerated from the database, so a new measurement updates the card without anyone editing it.</li>" +
    "<li>Reviewers check quality control and raw-file links. A card is released to AROMA once it passes QC, and each change creates a new card version.</li></ul>" +
    "<h2>Open and controlled data</h2>" +
    "<p>This site holds only open-tier content. Human-linked metadata sits in a controlled-access tier and is never published here.</p>" +
    "<h2>Machine access</h2>" +
    '<p>The <a href="api/v1/cards.json">card index</a> and every full record are static JSON files. The record structure is defined by the <a href="schema/olfactocard.schema.json">JSON Schema</a>.</p></div>';
}

/* Router */

function loadIndex(done) {
  fetch("api/v1/cards.json").then(function (r) { return r.json(); }).then(function (idx) {
    CARDS = idx.cards.map(function (c) {
      return {
        id: c.id, slug: c.slug, contributed_by: c.contributed_by, panel_role: c.panel_role, status: c.status,
        sections: c.sections,
        identity: { name: c.name, formula: c.formula, monoisotopic_mass: c.monoisotopic_mass,
                    chemical_class: c.chemical_class, reported_odour: { text: c.reported_odour || "" } }
      };
    });
    done();
  }).catch(function () {
    main.innerHTML = "<h1>Cards could not be loaded</h1><p>Serve this folder over HTTP to load the card index.</p>";
  });
}

function route() {
  var hash = location.hash || "#/";
  var m = hash.match(/^#\/card\/([a-z0-9-]+)$/);
  if (m) {
    if (FETCH_MODE) {
      fetch("api/v1/cards/" + m[1] + ".json").then(function (r) {
        if (!r.ok) { throw new Error("missing"); }
        return r.json();
      }).then(renderCard).catch(function () {
        main.innerHTML = '<h1>Card not found</h1><p><a href="#/">Back to all cards</a></p>';
      });
    } else {
      var card = find(m[1]);
      if (card) { renderCard(card); } else {
        main.innerHTML = '<h1>Card not found</h1><p><a href="#/">Back to all cards</a></p>';
      }
    }
  } else if (hash === "#/about") {
    renderAbout();
  } else {
    renderIndex();
  }
  window.scrollTo(0, 0);
}

if (CONFIG.banner) { document.getElementById("banner").textContent = CONFIG.banner; }
window.addEventListener("hashchange", route);
if (FETCH_MODE) { loadIndex(route); } else { route(); }
