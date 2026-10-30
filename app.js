
// Supabase: Project Settings -> API (URL и публичный anon key; он безопасен для фронтенда,
// запись закрыта правилами RLS)
const SUPABASE_URL = "https://kitwekuehldxtkmtacrh.supabase.co";
const SUPABASE_KEY = "sb_publishable_WiNelnQznSawnLT51_yCYQ_B-ZXOFF1";

const H = { apikey: SUPABASE_KEY, "Content-Type": "application/json" }; // Authorization добавляется после входа

/* ---------- вход (Supabase Auth): без него база не отдаёт данные ---------- */
const SKEY = "sb_session";
const getSession = () => { try { return JSON.parse(localStorage.getItem(SKEY)); } catch (e) { return null; } };
async function authCall(grant, body) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.msg || j.message || "auth error");
  const sess = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in - 60) * 1000 };
  localStorage.setItem(SKEY, JSON.stringify(sess));
  return sess;
}
async function ensureSession() {
  let sess = getSession();
  if (sess && sess.expires_at > Date.now()) { H.Authorization = `Bearer ${sess.access_token}`; return true; }
  if (sess && sess.refresh_token) {
    try { sess = await authCall("refresh_token", { refresh_token: sess.refresh_token }); H.Authorization = `Bearer ${sess.access_token}`; return true; }
    catch (e) { localStorage.removeItem(SKEY); }
  }
  delete H.Authorization;
  return false;
}
function showLogin() {
  return new Promise((resolve) => {
    const inp = "padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:1rem";
    const o = document.createElement("div");
    o.style.cssText = "position:fixed;inset:0;z-index:9999;background:#f5f5f5;display:flex;align-items:center;justify-content:center;padding:16px";
    o.innerHTML = `<form style="background:#fff;padding:24px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.1);width:100%;max-width:340px;display:flex;flex-direction:column;gap:12px">
<h2 style="color:#c60b1e;font-size:1.2rem;text-align:center">Acceso privado</h2>
<input name="email" type="email" placeholder="Correo electrónico" required autocomplete="username" style="${inp}">
<input name="password" type="password" placeholder="Contraseña" required autocomplete="current-password" style="${inp}">
<button style="padding:10px;border:0;border-radius:8px;background:#c60b1e;color:#fff;font-weight:600;font-size:1rem;cursor:pointer">Entrar</button>
<div class="login-err" style="color:#c60b1e;font-size:.85rem;min-height:1em;text-align:center"></div></form>`;
    document.body.appendChild(o);
    o.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target, err = o.querySelector(".login-err");
      err.textContent = "";
      try {
        const sess = await authCall("password", { email: f.email.value.trim(), password: f.password.value });
        H.Authorization = `Bearer ${sess.access_token}`;
        o.remove(); resolve();
      } catch (x) { err.textContent = "Correo o contraseña incorrectos."; }
    };
  });
}
let gatePromise = null;
async function gate() {
  if (await ensureSession()) return;
  if (!gatePromise) gatePromise = showLogin().finally(() => { gatePromise = null; });
  await gatePromise;
}
window.logout = () => { localStorage.removeItem(SKEY); location.reload(); };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let FEED = null; // метаданные последней загрузки (таблица feed_meta)
const fdate = (v) => { const d = new Date(v); return isNaN(d) ? "" : d.toLocaleDateString("es-ES"); };
const sourceFooter = (label) => {
  const stale = FEED && FEED.some((f) => f.valid_to && new Date(f.valid_to) < new Date());
  return `<footer>${esc(label)}<br>Datos de horarios: Renfe Operadora (incluido Cercanías) y OUIGO España, obtenidos del Punto de Acceso Nacional de Transporte Multimodal (NAP) del Ministerio de Transportes y Movilidad Sostenible${FEED && FEED.length ? ` (${FEED.map((f) => `${esc(f.source_file.split(":")[0])}: actualizados el ${fdate(f.feed_date)}, válidos hasta el ${fdate(f.valid_to)}`).join("; ")})` : ""}. Datos procesados por este sitio. <a href="https://www.transportes.gob.es/" rel="noopener">Powered by MITRAMS</a><br>Sitio de uso personal y sin fines comerciales. No es un sitio oficial ni está afiliado a Renfe ni al MITRAMS. Los datos pueden contener errores: confirme los horarios con Renfe.${stale ? "<br><b>⚠ Estos datos han caducado: los horarios pueden no ser vigentes.</b>" : ""}<br><a href="#" onclick="logout();return false">Cerrar sesión</a></footer>`;
};
async function loadFeed() {
  try { FEED = await api("feed_meta?select=source_file,feed_date,valid_to&order=id"); } catch (e) { /* без метаданных футер просто короче */ }
}
const num = (n) => parseInt(n.split(" ")[1], 10);

async function api(path, body) {
  await gate();
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
${sourceFooter("Lista de trenes")}`);
}

const cell = (t) => (!t || !t[0] ? "" : t[0] === t[1] || !t[1] ? t[0] : `${t[0]} / ${t[1]}`);

function renderPage(p, notes = []) {
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
      return `<th><div class="th-train"><span class="th-code"><a href="${trainHref(s.number)}">${esc(s.number)}</a></span>${nt ? `<span class="route-note">${nt}</span>` : ""}</div></th>`;
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
<div class="note" style="max-width:560px;text-align:center">No hay horarios para esta ruta.</div>
${sourceFooter(p.title)}`);

  return wrap(`
<h1>${esc(p.title)}</h1>
<p class="subtitle">Horarios de trenes</p>
${logosHtml(types)}
${tables}
${sourceFooter(p.title)}`);
}


const logosHtml = (types) => `<div class="train-operators">${OPERATORS.filter(([t]) => types.has(t)).map(([, name]) =>
  `<span class="operator-name">${esc(name)}</span>`).join("")}</div>`;

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
${sourceFooter(n)}`;
}
const hhmm = (t) => (t ? t.slice(0, 5) : "");

/* ---------- главная: список маршрутов из таблицы pages ---------- */
const OPERATORS = [["avant", "Avant"], ["ave", "AVE"], ["euromed", "Euromed"], ["alvia", "Alvia"], ["avlo", "Avlo"], ["iryo", "iryo"], ["md", "Media Distancia"], ["ouigo", "OUIGO"], ["ic", "IC"], ["regional", "Regional"], ["cercanias", "Cercanías"], ["proximidad", "Proximidad"], ["trencelta", "TrenCelta"]];
const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Столицы провинций по убыванию населения (INE, 1 января 2025). Порядок = порядок групп на главной.
// Маршруты только между ними идут в первый блок, остальные (Gijón, Avilés, Irun…) — во второй.
const CAPITALS = ["Madrid", "Barcelona", "València", "Zaragoza", "Sevilla", "Málaga", "Murcia", "Alicante", "Bilbao", "Córdoba", "Valladolid", "Vitoria-Gasteiz", "A Coruña", "Granada", "Oviedo", "Pamplona", "Almería", "San Sebastián", "Castelló De La Plana", "Burgos", "Santander", "Albacete", "Logroño", "Badajoz", "Lleida", "Salamanca", "Huelva", "Tarragona", "León", "Jaén", "Cádiz", "Girona", "Ourense", "Lugo", "Cáceres", "Guadalajara", "Toledo", "Pontevedra", "Palencia", "Ciudad Real", "Zamora", "Ávila", "Cuenca", "Huesca", "Segovia", "Soria", "Teruel", "Palma", "Las Palmas de Gran Canaria", "Santa Cruz de Tenerife"];
const CAP_RANK = new Map(CAPITALS.map((c, i) => [norm(c), i]));
const capRank = (n) => (CAP_RANK.has(n) ? CAP_RANK.get(n) : 999);

const routeCard = (p) => {
  const [from0, to] = p.title.split("↔").map(norm);
  const from = from0.replace(/^cercanias.*?:\s*/, ""); // у Cercanías поиск идёт по названию станции
  const shown = p.title.replace(/^Cercanías .+? · /, ""); // сеть уже указана в заголовке группы
  return `<a href="page.html?p=${encodeURIComponent(p.slug)}" class="route" data-from="${esc(from)}" data-to="${esc(to || "")}">
  <h2 data-original="${esc(shown)}">${esc(shown)}</h2></a>`;
};

function renderRoutes(pages) {
  const caps = new Map(), other = [], cerca = new Map();
  pages.forEach((p) => {
    const cm = p.title.match(/^Cercanías (.+?) · /);
    if (cm) { if (!cerca.has(cm[1])) cerca.set(cm[1], []); cerca.get(cm[1]).push(p); return; }
    const [a, b] = p.title.split("↔").map(norm);
    if (CAP_RANK.has(a) && CAP_RANK.has(b ?? a)) {
      const g = caps.get(a) || { title: p.title.split("↔")[0].trim(), list: [] };
      g.list.push(p); caps.set(a, g);
    } else other.push(p);
  });
  const origins = [...caps].sort((x, y) => capRank(x[0]) - capRank(y[0])).map(([, g]) => `<div class="origin-group">
<h3 class="origin-title">${esc(g.title)}</h3>
<div class="routes-grid">${g.list.map(routeCard).join("\n")}</div></div>`).join("\n");
  return `${origins ? `<section class="route-group"><h2 class="group-title">Entre capitales de provincia</h2>\n${origins}</section>` : ""}
${other.length ? `<section class="route-group"><h2 class="group-title">Con otras estaciones y terminales</h2>
<div class="routes-grid">${other.map(routeCard).join("\n")}</div></section>` : ""}
${cerca.size ? `<section class="route-group"><h2 class="group-title">Cercanías (líneas por red)</h2>
${[...cerca].sort((x, y) => x[0].localeCompare(y[0], "es")).map(([net, list]) => `<div class="origin-group">
<h3 class="origin-title">${esc(net)}</h3>
<div class="routes-grid">${list.map(routeCard).join("\n")}</div></div>`).join("\n")}</section>` : ""}`;
}

// прячем заголовок блока, если поиск скрыл все его маршруты
function syncGroups() {
  document.querySelectorAll(".route-group, .origin-group").forEach((g) => {
    const want = ![...g.querySelectorAll(".route")].some((r) => getComputedStyle(r).display !== "none");
    if (g.hidden !== want) g.hidden = want;
  });
}

// убираем из интерфейса фильтры «Con trenes / Aún sin trenes / Sin trenes directos»
function removeOldFilters() {
  const OLD = /^(con trenes|a[uú]n sin trenes|sin trenes directos)$/i;
  ["showEmpty", "showNoDirect", "showWith"].forEach((id) => { const cb = document.getElementById(id); if (cb) (cb.closest("label") || cb).remove(); });
  document.querySelectorAll("body *").forEach((el) => { if (el.isConnected && OLD.test(el.textContent.trim())) el.remove(); });
}

async function renderIndex() {
  const box = document.getElementById("routes");
  try {
    const pages = await apiAll("pages?select=slug,title,sort&order=sort,id");
    box.innerHTML = renderRoutes(pages);
    const oldFooter = document.querySelector("footer");
    if (oldFooter) oldFooter.outerHTML = sourceFooter("Horarios de trenes");
    else box.insertAdjacentHTML("afterend", sourceFooter("Horarios de trenes"));
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
  new MutationObserver(syncGroups).observe(box, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
  syncGroups();
  removeOldFilters();
}

(async () => {
  const app = document.getElementById("app");
  await gate();
  const slug = new URLSearchParams(location.search).get("p") || document.body.dataset.page;
  if (!slug) return location.replace("index.html");
  await loadFeed();
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
      app.innerHTML = renderList(await apiAll("train_list?select=number,freq,origin,destination&order=number"));
    } else {
      const p = await api("rpc/get_page", { p_slug: slug });
      if (!p) throw new Error(`Página «${slug}» no encontrada`);
      let notes = [];
      try {
        notes = await api(`page_dir_notes?select=direction,note,pages!inner(slug)&pages.slug=eq.${encodeURIComponent(slug)}`);
      } catch (e) { /* таблицы примечаний ещё нет — заголовки без них */ }
      document.title = `${p.title} — Horarios`;
      app.innerHTML = renderPage(p, notes);
    }
  } catch (e) {
    app.textContent = "No se pudieron cargar los horarios. " + e.message;
  }
})();
