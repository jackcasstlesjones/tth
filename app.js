// ---- Constants: update these when rates change ----
const SALARY = 1047.5;            // per director, tax-free
const CT_RESERVE = 0.2;           // set aside for Corporation Tax
const DIVIDEND_TAX_RATE = 0.1075; // basic-rate dividend tax
const CHEATSHEET_START = 5000;
const CHEATSHEET_END = 30000;
const CHEATSHEET_STEP = 1000;

const DIRECTORS = 2;
const MIN_POT = SALARY * DIRECTORS;

// ---- Calculation ----
function calculate(amount, mode) {
  const ctReserve = mode === 'before' ? amount * CT_RESERVE : 0;
  const pot = mode === 'before' ? amount * (1 - CT_RESERVE) : amount;
  if (pot < MIN_POT) return { ctReserve, pot, shortfall: true };

  const grossDividend = (pot - MIN_POT) / DIRECTORS;
  const dividendTax = grossDividend * DIVIDEND_TAX_RATE;
  const takeHome = SALARY + grossDividend - dividendTax;
  return { ctReserve, pot, shortfall: false, grossDividend, dividendTax, takeHome };
}

if (typeof module !== 'undefined') module.exports = { calculate };

// ---- UI ----
if (typeof document !== 'undefined') {
  const gbp = new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const pct = (rate) => `${+(rate * 100).toFixed(2)}%`;
  const fmt = (n) => (n === undefined ? '—' : gbp.format(n));

  const $ = (id) => document.getElementById(id);
  const amountInput = $('amount');
  const takeHomeEl = $('take-home');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  $('tax-label').textContent = `Dividend tax (${pct(DIVIDEND_TAX_RATE)})`;
  $('cheatsheet-sub').textContent =
    `${fmt(CHEATSHEET_START)} – ${fmt(CHEATSHEET_END)} before CT, in ${fmt(CHEATSHEET_STEP)} steps.`;

  // Cheatsheet rows are built once; only the highlight changes.
  const cheatsheetRows = [];
  for (let amount = CHEATSHEET_START; amount <= CHEATSHEET_END; amount += CHEATSHEET_STEP) {
    const r = calculate(amount, 'before');
    const tr = document.createElement('tr');
    tr.style.setProperty('--i', cheatsheetRows.length);
    tr.innerHTML = `<td>${fmt(amount)}</td><td>${fmt(r.pot)}</td><td>${fmt(r.takeHome)}</td>`;
    $('cheatsheet-body').append(tr);
    cheatsheetRows.push({ amount, tr });
  }

  // Count-up animation for the headline figure.
  let shown = null;
  let frame = 0;
  function setHeadline(target) {
    cancelAnimationFrame(frame);
    if (target === undefined) {
      shown = null;
      takeHomeEl.textContent = '—';
      return;
    }
    if (shown === null || reducedMotion) {
      shown = target;
      takeHomeEl.textContent = gbp.format(target);
      return;
    }
    const from = shown;
    const start = performance.now();
    const duration = 450;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      shown = from + (target - from) * (1 - (1 - t) ** 3);
      takeHomeEl.textContent = gbp.format(shown);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }

  function highlightNearest(amount) {
    const idx = Number.isFinite(amount)
      ? Math.round((Math.min(Math.max(amount, CHEATSHEET_START), CHEATSHEET_END) - CHEATSHEET_START) / CHEATSHEET_STEP)
      : -1;
    cheatsheetRows.forEach(({ tr }, i) => tr.classList.toggle('is-active', i === idx));
  }

  function render() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const amount = amountInput.value === '' ? NaN : Number(amountInput.value);
    const valid = Number.isFinite(amount);
    const r = valid ? calculate(amount, mode) : {};

    document.body.dataset.mode = mode;
    $('mode-hint').textContent = mode === 'before'
      ? `${pct(CT_RESERVE)} is set aside for Corporation Tax first.`
      : 'Amount is already net of Corporation Tax.';

    $('ct-wrap').classList.toggle('is-open', mode === 'before');
    $('ct-reserve').textContent = valid ? fmt(r.ctReserve) : '—';
    $('pot').textContent = valid ? fmt(r.pot) : '—';
    $('salary').textContent = fmt(SALARY);
    $('gross-dividend').textContent = fmt(r.grossDividend);
    $('dividend-tax').textContent = fmt(r.dividendTax);
    setHeadline(r.takeHome);

    $('warning-wrap').classList.toggle('is-open', !!r.shortfall);
    if (r.shortfall) {
      $('warning-text').textContent =
        `A pot of ${fmt(r.pot)} doesn't cover both salaries (${fmt(MIN_POT)} needed), so there's no dividend to pay.`;
    }

    highlightNearest(mode === 'before' && valid ? amount : NaN);
  }

  amountInput.addEventListener('input', render);
  document.querySelectorAll('input[name="mode"]').forEach((el) => el.addEventListener('change', render));
  render();
}
