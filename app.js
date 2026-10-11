
// Supabase: Project Settings -> API (URL и публичный anon key; он безопасен для фронтенда,
// запись закрыта правилами RLS)
const SUPABASE_URL = "https://kitwekuehldxtkmtacrh.supabase.co";
const SUPABASE_KEY = "sb_publishable_WiNelnQznSawnLT51_yCYQ_B-ZXOFF1";

const H = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
if (SUPABASE_KEY.startsWith("eyJ")) H.Authorization = `Bearer ${SUPABASE_KEY}`; // только для старых JWT-ключей
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = (n) => parseInt(n.split(" ")[1], 10);

async function api(path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, body
    ? { method: "POST", headers: H, body: JSON.stringify(body) }
    : { headers: H });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

// PostgREST отдаёт максимум 1000 строк за запрос — забираем всё страницами
async function apiAll(path) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const rows = await api(`${path}&limit=1000&offset=${off}`);
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const wrap = (inner) => `
<div class="top-bar"><a href="index.html" class="back">← Volver</a></div>
${inner}`;

function renderList(rows) {
  rows.sort((a, b) => num(a.number) - num(b.number));
  return wrap(`
<h1>Lista de trenes</h1>
<p class="subtitle">Número de tren, ruta completa y periodicidad</p>
<div class="table-wrapper table-wrapper--list">
<table class="trains-table">
<thead><tr><th>Tren</th><th>Ruta completa</th><th>Periodicidad</th></tr></thead>
<tbody>${rows.map((r) => `
<tr><td class="train-num-cell"><a href="${trainHref(r.number)}">${esc(r.number)}</a></td>
<td class="route-cell">${esc(r.origin)} → ${esc(r.destination)}</td>
<td class="freq-cell">${esc(r.freq)}</td></tr>`).join("")}
</tbody></table></div>
<footer>Lista de trenes · Datos de ejemplo</footer>`);
}

const cell = (t) => (!t || !t[0] ? "" : t[0] === t[1] || !t[1] ? t[0] : `${t[0]} / ${t[1]}`);

function renderPage(p, notes = [], noDirect = false) {
  p.directions = p.directions || [];
  const types = new Set(p.directions.flatMap((d) => (d.services || []).map((s) => s.type)));
  const isMd = (d) => (d.services || []).length > 0 && d.services.every((s) => s.type === "md");
  const noteOf = (i) => (notes.find((n) => n.direction === i) || {}).note || "";

  const tables = p.directions.map((d, i) => {
    const ids = new Set(d.stations.map((s) => s.id));
    const first = d.stations[0].city, last = d.stations[d.stations.length - 1].city;
    const note = noteOf(i) || (isMd(d) ? "Media Distancia" : "");
    const head = (d.services || []).map((s) => {
      const nt = [ids.has(s.origin.id) ? "" : `desde ${esc(s.origin.city)}`, ids.has(s.destination.id) ? "" : `→ ${esc(s.destination.city)}`]
        .filter(Boolean).join(" ");
      return `<th><div class="th-train"><span class="th-logo-badge"><img class="th-logo th-logo-${s.type}" src="images/${s.type}.svg" alt="${s.type}"></span>
        <span class="th-code"><a href="${trainHref(s.number)}">${esc(s.number)}</a></span>${nt ? `<span class="route-note">${nt}</span>` : ""}</div></th>`;
    }).join("");
    const days = (d.services || []).map((s) => `<th class="days">${esc(s.freq)}</th>`).join("");
    const body = d.stations.map((st) =>
      `<tr><td class="station">${esc(st.name)}</td>${(d.services || []).map((s) => `<td>${cell(s.times[st.id])}</td>`).join("")}</tr>`).join("");
    return `<h2 class="section-title">${esc(first)} → ${esc(last)}${note ? ` (${esc(note)})` : ""}</h2>
<div class="table-wrapper" style="max-width:${Math.min(1100, 360 + (d.services || []).length * 120)}px"><table>
<thead><tr><th></th>${head}</tr><tr><th class="days"></th>${days}</tr></thead>
<tbody>${body}</tbody></table></div>`;
  }).join("");

  if (!p.directions.some((d) => (d.services || []).length)) return wrap(`
<h1>${esc(p.title)}</h1>
<p class="subtitle">Horarios de trenes</p>
<div class="note" style="max-width:560px;text-align:center">${noDirect
    ? "No hay trenes directos entre estas dos ciudades."
    : "Todavía no hay horarios añadidos para esta ruta."}</div>
<footer>${esc(p.title)} · Datos de ejemplo</footer>`);

  return wrap(`
<h1>${esc(p.title)}</h1>
<p class="subtitle">Horarios de trenes</p>
${logosHtml(types)}
${tables}
<footer>${esc(p.title)} · Datos de ejemplo</footer>`);
}


const logosHtml = (types) => `<div class="train-operators">${OPERATORS.filter(([t]) => types.has(t)).map(([t, alt]) =>
  `<img src="images/${t}.svg" alt="${alt}" class="operator-logo operator-${t}">`).join("")}</div>`;

/* ---------- страница одного поезда ---------- */
const trainHref = (n) => `train.html?n=${encodeURIComponent(n)}`;
function renderTrain(rows, n) {
  const body = rows.map((sv) => {
    const st = sv.stops, last = st.length - 1;
    const trs = st.map((s, i) => `<tr><td class="station">${esc(s.stations.name)}</td>
      <td>${i == 0 ? "—" : esc(hhmm(s.arrival))}</td><td>${i == last ? "—" : esc(hhmm(s.departure))}</td></tr>`).join("");
    return `<h2 class="section-title">${esc(st[0].stations.name)} → ${esc(st[last].stations.name)}</h2>
<p class="subtitle">${esc(sv.freq)}</p>
<div class="table-wrapper table-wrapper--long-names"><table>
<thead><tr><th>Estación</th><th>Llegada</th><th>Salida</th></tr></thead><tbody>${trs}</tbody></table></div>`;
  }).join("");
  return `<div class="top-bar"><a href="lista-trenes.html" class="back">← Lista de trenes</a></div>
<h1>${esc(n)}</h1>
${logosHtml(new Set(rows.map((r) => r.type)))}
${body}
<footer>${esc(n)} · Datos de ejemplo</footer>`;
}
const hhmm = (t) => (t ? t.slice(0, 5) : "");

/* ---------- главная: список маршрутов из таблицы pages ---------- */
const OPERATORS = [["avant", "Avant"], ["ave", "AVE"], ["alvia", "Alvia"], ["avlo", "Avlo"], ["iryo", "iryo"], ["md", "Media Distancia"], ["ouigo", "OUIGO"], ["ic", "IC"], ["regional", "Regional"]];
const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Столицы провинций по убыванию населения (INE, 1 января 2025). Порядок = порядок групп на главной.
// Маршруты только между ними идут в первый блок, остальные (Gijón, Avilés, Irun…) — во второй.
const CAPITALS = ["Madrid", "Barcelona", "València", "Zaragoza", "Sevilla", "Málaga", "Murcia", "Alicante", "Bilbao", "Córdoba", "Valladolid", "Vitoria-Gasteiz", "A Coruña", "Granada", "Oviedo", "Pamplona", "Almería", "San Sebastián", "Castelló De La Plana", "Burgos", "Santander", "Albacete", "Logroño", "Badajoz", "Lleida", "Salamanca", "Huelva", "Tarragona", "León", "Jaén", "Cádiz", "Girona", "Ourense", "Lugo", "Cáceres", "Guadalajara", "Toledo", "Pontevedra", "Palencia", "Ciudad Real", "Zamora", "Ávila", "Cuenca", "Huesca", "Segovia", "Soria", "Teruel", "Palma", "Las Palmas de Gran Canaria", "Santa Cruz de Tenerife"];
const CAP_RANK = new Map(CAPITALS.map((c, i) => [norm(c), i]));
const capRank = (n) => (CAP_RANK.has(n) ? CAP_RANK.get(n) : 999);

// no_direct — признак из админки; page_services[0].count — сколько поездов привязано к странице
const routeState = (p) => ((p.page_services && p.page_services[0] && p.page_services[0].count) > 0 ? "" : p.no_direct ? " route--nodirect" : " route--empty");

const routeCard = (p) => {
  const [from, to] = p.title.split("↔").map(norm);
  return `<a href="page.html?p=${encodeURIComponent(p.slug)}" class="route${routeState(p)}" data-from="${esc(from)}" data-to="${esc(to || "")}">
  <h2 data-original="${esc(p.title)}">${esc(p.title)}</h2></a>`;
};

function renderRoutes(pages) {
  const caps = new Map(), other = [];
  pages.forEach((p) => {
    const [a, b] = p.title.split("↔").map(norm);
    if (CAP_RANK.has(a) && CAP_RANK.has(b ?? a)) {
      const g = caps.get(a) || { title: p.title.split("↔")[0].trim(), list: [] };
      g.list.push(p); caps.set(a, g);
    } else other.push(p);
  });
  const origins = [...caps].sort((x, y) => capRank(x[0]) - capRank(y[0])).map(([, g]) => `<div class="origin-group">
<h3 class="origin-title">${esc(g.title)}</h3>
<div class="routes-grid">${g.list.map(routeCard).join("\n")}</div></di
