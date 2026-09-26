// search.js
const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');
const swapBtn = document.getElementById('swapBtn');
const routes = document.querySelectorAll('.route[data-from]');

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function filterRoutes() {
  const from = normalize(fromInput.value);
  const to = normalize(toInput.value);

  routes.forEach(route => {
    const routeFrom = normalize(route.dataset.from);
    const routeTo = normalize(route.dataset.to);

    const forwardMatch = (!from || routeFrom.includes(from)) && (!to || routeTo.includes(to));
    const reverseMatch  = (!from || routeTo.includes(from)) && (!to || routeFrom.includes(to));

    route.style.display = (forwardMatch || reverseMatch) ? '' : 'none';
  });
}

fromInput.addEventListener('input', filterRoutes);
toInput.addEventListener('input', filterRoutes);

swapBtn.addEventListener('click', () => {
  [fromInput.value, toInput.value] = [toInput.value, fromInput.value];
  filterRoutes();
});
