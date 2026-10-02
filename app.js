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
<tr><td class="train-num-cell">${esc(r.number)}</td>
<td class="route-cell">${esc(r.origin)} → ${esc(r.destination)}</td>
<td class="freq-cell">${esc(r.freq)}</td></tr>`).join("")}
</tbody></table></div>
<footer>Lista de trenes · Datos de ejemplo</footer>`);
}

const cell = (t) => (!t || !t[0] ? "" : t[0] === t[1] || !t[1] ? t[0] : `${t[0]} / ${t[1]}`);

function renderPage(p) {
  const types = [...new Set(p.directions.flatMap((d) => d.services.map((s) => s.type)))];
  const tables = p.directions.map((d) => {
    const ids = new Set(d.stations.map((s) => s.id));
    const first = d.stations[0].city, last = d.stations[d.stations.length - 1].city;
    const head = d.services.map((s) => {
      const from = ids.has(s.origin.id) ? "" : ` desde ${esc(s.origin.city)}`;
      const to = ids.has(s.destination.id) ? "" : ` → ${esc(s.destination.city)}`;
      return `<th><img src="images/${s.type}.svg" alt="" height="18"> ${esc(s.number)}${from}${to}</th>`;
    }).join("");
    const freq = d.services.map((s) => `<td>${esc(s.freq)}</td>`).join("");
    const body = d.stations.map((st) =>
      `<tr><td>${esc(st.name)}</td>${d.services.map((s) => `<td>${cell(s.times[st.id])}</td>`).join("")}</tr>`).join("");
    return `<h2>${esc(first)} → ${esc(last)}</h2>
<div class="table-wrapper"><table class="trains-table">
<thead><tr><th></th>${head}</tr><tr><td></td>${freq}</tr></thead>
<tbody>${body}</tbody></table></div>`;
  }).join("");
  return wrap(`
<h1>${esc(p.title)}</h1>
<p class="subtitle">Horarios de trenes</p>
<div>${types.map((t) => `<img src="images/${t}.svg" alt="${t}" height="24">`).join(" ")}</div>
${tables}
<footer>${esc(p.title)} · Datos de ejemplo</footer>`);
}


/* ---------- главная: список маршрутов из таблицы pages ---------- */
const OPERATORS = [["ave", "AVE"], ["alvia", "Alvia"], ["avlo", "Avlo"], ["iryo", "iryo"], ["ouigo", "OUIGO"], ["ic", "IC"], ["regional", "Regional"]];
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
    if (slug === "lista-trenes") {
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
