const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');
const swapBtn = document.getElementById('swapBtn');
const fromSuggestions = document.getElementById('fromSuggestions');
const toSuggestions = document.getElementById('toSuggestions');
const routes = document.querySelectorAll('.route[data-from]');

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Собираем список всех станций автоматически из data-атрибутов карточек
const stationsSet = new Set();
routes.forEach(route => {
  stationsSet.add(route.dataset.from);
  stationsSet.add(route.dataset.to);
});
const allStations = [...stationsSet].sort();

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function showSuggestions(input, box) {
  const query = normalize(input.value);
  box.innerHTML = '';

  if (!query) {
    box.style.display = 'none';
    return;
  }

  const matches = allStations.filter(st => normalize(st).includes(query));

  if (matches.length === 0) {
    box.style.display = 'none';
    return;
  }

  matches.forEach(station => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.textContent = capitalize(station);
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // чтобы клик не терялся из-за blur
      input.value = capitalize(station);
      box.style.display = 'none';
      filterRoutes();
    });
    box.appendChild(item);
  });

  box.style.display = 'block';
}

function filterRoutes() {
  const from = normalize(fromInput.value);
  const to = normalize(toInput.value);

  routes.forEach(route => {
    const routeFrom = normalize(route.dataset.from);
    const routeTo = normalize(route.dataset.to);
    const h2 = route.querySelector('h2');

    const forwardMatch = (!from || routeFrom.includes(from)) && (!to || routeTo.includes(to));
    const reverseMatch  = (!from || routeTo.includes(from)) && (!to || routeFrom.includes(to));

    route.style.display = (forwardMatch || reverseMatch) ? '' : 'none';

    const fromMatchesOrigin = from && routeFrom.includes(from);
    const fromMatchesDestination = from && !fromMatchesOrigin && routeTo.includes(from);

    const toMatchesDestination = to && routeTo.includes(to);
    const toMatchesOrigin = to && !toMatchesDestination && routeFrom.includes(to);

    const shouldReverse = fromMatchesDestination || toMatchesOrigin;

    if (shouldReverse) {
      const originalFrom = capitalize(route.dataset.from);
      const originalTo = capitalize(route.dataset.to);
      h2.textContent = `${originalTo} ↔ ${originalFrom}`;
    } else {
      h2.textContent = h2.dataset.original;
    }
  });
}

fromInput.addEventListener('input', () => {
  showSuggestions(fromInput, fromSuggestions);
  filterRoutes();
});

toInput.addEventListener('input', () => {
  showSuggestions(toInput, toSuggestions);
  filterRoutes();
});

fromInput.addEventListener('focus', () => showSuggestions(fromInput, fromSuggestions));
toInput.addEventListener('focus', () => showSuggestions(toInput, toSuggestions));

document.addEventListener('click', (e) => {
  if (!e.target.closest('.field-wrap')) {
    fromSuggestions.style.display = 'none';
    toSuggestions.style.display = 'none';
  }
});

swapBtn.addEventListener('click', () => {
  [fromInput.value, toInput.value] = [toInput.value, fromInput.value];
  filterRoutes();
});
