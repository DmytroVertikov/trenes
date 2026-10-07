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

function renderPage(p) {
  const types = new Set(p.directions.flatMap((d) => (d.services || []).map((s) => s.type)));
  const tables = p.directions.map((d) => {
    const ids = new Set(d.stations.map((s) => s.id));
    const first = d.stations[0].city, last = d.stations[d.stations.length - 1].city;
    const head = (d.services || []).map((s) => {
      const note = [ids.has(s.origin.id) ? "" : `desde ${esc(s.origin.city)}`, ids.has(s.destination.id) ? "" : `→ ${esc(s.destination.city)}`]
        .filter(Boolean).join(" ");
      return `<th><div class="th-train"><span class="th-logo-badge"><img class="th-logo th-logo-${s.type}" src="images/${s.type}.svg" alt="${s.type}"></span>
        <span class="th-code"><a href="${trainHref(s.number)}">${esc(s.number)}</a></span>${note ? `<span class="route-note">${note}</span>` : ""}</div></th>`;
    }).join("");
    const days = (d.services || []).map((s) => `<th class="days">${esc(s.freq)}</th>`).join("");
    const body = d.stations.map((st) =>
      `<tr><td class="station">${esc(st.name)}</td>${(d.services || []).map((s) => `<td>${cell(s.times[st.id])}</td>`).join("")}</tr>`).join("");
    return `<h2 class="section-title">${esc(first)} → ${esc(last)}</h2>
<div class="table-wrapper"><table>
<thead><tr><th></th>${head}</tr><tr><th class="days"></th>${days}</tr></thead>
<tbody>${body}</tbody></table></div>`;
  }).join("");
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
const OPERATORS = [["ave", "AVE"], ["alvia", "Alvia"], ["md", "Media Distancia"], ["avlo", "Avlo"], ["iryo", "iryo"], ["ouigo", "OUIGO"], ["ic", "IC"], ["regional", "Regional"]];
const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function renderRoutes(pages) {
  return pages.map((p) => {
    const types = new Set(p.page_services.map((x) => x.services && x.services.type));
    const [from, to] = p.title.split("↔").map(norm);
    const logos = OPERATORS.filter(([t]) => types.has(t)).map(([t, alt]) =>
      `<img src="images/${t}.svg" alt="${alt}" class="operator-logo operator-${t}">`).join("\n            ");
    return `<a href="page.html?p=${encodeURIComponent(p.slug)}" class="route" data-from="${esc(from)}" data-to="${esc(to || "")}">
        <h2 data-original="${esc(p.title)}">${esc(p.title)}</h2>
        <div class="train-operators">
            ${logos}
        </div>
    </a>`;
  }).join("\n");
}

async function renderIndex() {
  const box = document.getElementById("routes");
  try {
    const pages = await api("pages?select=slug,title,sort,page_services(services(type))&order=sort");
    box.innerHTML = renderRoutes(pages);
  } catch (e) {
    box.textContent = "No se pudieron cargar los horarios. " + e.message;
    return;
  }
  // поиск подключаем только когда маршруты уже на странице
  await new Promise((done) => {
    const sc = document.createElement("script");
    sc.src = "search.js";
    sc.onload = sc.onerror = done;
    document.body.appendChild(sc);
  });
  document.dispatchEvent(new Event("DOMContentLoaded")); // на случай, если search.js ждёт это событие
}

(async () => {
  const app = document.getElementById("app");
  const slug = new URLSearchParams(location.search).get("p") || document.body.dataset.page;
  if (!slug) return location.replace("index.html");
  if (slug === "index") return renderIndex();
  try {
    if (slug === "train") {
      const n = new URLSearchParams(location.search).get("n");
      if (!n) return location.replace("lista-trenes.html");
      const rows = await api(`services?select=number,freq,type,stops(seq,arrival,departure,stations(name))&number=eq.${encodeURIComponent(n)}&stops.order=seq&order=freq`);
      if (!rows.length) throw new Error(`Tren «${n}» no encontrado`);
      document.title = `${n} — Horarios`;
      app.innerHTML = renderTrain(rows, n);
    } else if (slug === "lista-trenes") {
      app.innerHTML = renderList(await api("train_list?select=number,freq,origin,destination"));
    } else {
      const p = await api("rpc/get_page", { p_slug: slug });
      if (!p) throw new Error(`Página «${slug}» no encontrada`);
      document.title = `${p.title} — Horarios`;
      app.innerHTML = renderPage(p);
    }
  } catch (e) {
    app.textContent = "No se pudieron cargar los horarios. " + e.message;
  }
})();
