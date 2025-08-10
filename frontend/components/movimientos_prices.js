/* components/movimientos_prices.js
   --- CSV FIX ---
   Robust CSV parser for the Inviu export (e.g. "Garcia Leticia.csv").
   - detects delimiter
   - supports quoted fields
   - finds ticker + price even with header rows/extra columns
   - stores mapping in localStorage (movements_prices_v1)
   - updates UI: shows value per specie, client totals, global total
*/

document.addEventListener('DOMContentLoaded', () => {
  const CSV_KEY = 'movements_prices_v1';
  const uploadBtn = document.getElementById('csvUploadBtn');
  const fileInput = document.getElementById('csvFileInput');
  const clientsContainer = document.getElementById('clientsContainer');
  const summaryNominalEl = document.getElementById('summaryNominal');
  const csvStatusText = document.getElementById('csvStatusText');
  const clearCsvBtn = document.getElementById('clearCsvBtn');

  if (!fileInput || !uploadBtn) {
    // nothing to do on pages without the CSV controls
    return;
  }

  uploadBtn.addEventListener('click', () => fileInput.click());
  clearCsvBtn.addEventListener('click', () => {
    localStorage.removeItem(CSV_KEY);
    csvStatusText.textContent = 'Precios eliminados';
    clearCsvBtn.style.display = 'none';
    // trigger app reload so numbers reset (movimientos.js expone reload)
    if (window.__movementsApp && typeof window.__movementsApp.reload === 'function') {
      window.__movementsApp.reload();
    } else {
      // fallback: just remove displayed values
      clearDisplayedValues();
    }
  });

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const text = ev.target.result;
        const mapping = parseCSVtoMapping(text);
        if (!mapping || Object.keys(mapping).length === 0) {
          alert('No se pudieron detectar pares especie-precio en el CSV. Revisá el archivo.');
          return;
        }
        localStorage.setItem(CSV_KEY, JSON.stringify(mapping));
        csvStatusText.textContent = `Precios cargados (${Object.keys(mapping).length} entries) — ${f.name}`;
        clearCsvBtn.style.display = 'inline-block';
        // apply immediately
        updateValuesFromMapping(mapping);
        alert('CSV cargado correctamente. Valores actualizados en pantalla.');
      } catch(err) {
        console.error(err);
        alert('Error leyendo CSV: ' + (err && err.message ? err.message : err));
      } finally {
        fileInput.value = '';
      }
    };
    reader.readAsText(f, 'utf-8');
  });

  // small CSV line splitter that supports quoted fields
  function splitCsvLine(line, delim) {
    const res = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        // peek next char to handle escaped quotes ("")
        if (inQuotes && i + 1 < line.length && line[i+1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delim && !inQuotes) {
        res.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    res.push(cur);
    return res.map(c => c.trim());
  }

  function detectDelimiter(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 8);
    let commaCount = 0, semiCount = 0, tabCount = 0;
    lines.forEach(l => {
      commaCount += (l.match(/,/g)||[]).length;
      semiCount += (l.match(/;/g)||[]).length;
      tabCount += (l.match(/\t/g)||[]).length;
    });
    if (semiCount > commaCount && semiCount >= tabCount) return ';';
    if (tabCount > commaCount && tabCount >= semiCount) return '\t';
    return ',';
  }

  // parse robust number strings like "1.286,11" or "$ 1.286,11" => 1286.11
  function parseNumber(s) {
    if (s === null || s === undefined) return NaN;
    let t = String(s).trim();
    if (t === '') return NaN;
    // remove currency symbols and non-breaking spaces
    t = t.replace(/\u00A0/g,' ').replace(/\$/g,'').replace(/\s/g,'');
    // if quoted like " $ 1.234,56 " remove $
    // detect both . and , patterns
    const hasDot = t.indexOf('.') !== -1;
    const hasComma = t.indexOf(',') !== -1;
    if (hasDot && hasComma) {
      // typical: 1.234,56 -> remove dots and convert comma to dot
      if (t.indexOf('.') < t.indexOf(',')) {
        t = t.replace(/\./g,'').replace(',','.');
      } else {
        // ambiguous: 1,234.56 -> remove commas
        t = t.replace(/,/g,'');
      }
    } else if (hasComma && !hasDot) {
      t = t.replace(',', '.');
    }
    // remove any non-digit except dot and minus
    t = t.replace(/[^0-9\.\-]/g, '');
    const v = parseFloat(t);
    return isFinite(v) ? v : NaN;
  }

  function normalizeName(s) {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // remove accents
      .replace(/[\s\.\,\-_"'()\/\\]+/g,'') // remove punctuation & spaces
      .replace(/[^a-z0-9]/g,'') // keep alnum
      .trim();
  }

  // try many heuristics to extract ticker + price from messy Inviu CSV
  function parseCSVtoMapping(text) {
    const delim = detectDelimiter(text);
    const rawLines = text.split(/\r?\n/);
    const rows = rawLines.map(l => splitCsvLine(l, delim)).filter(r => r.some(c => c && c.trim() !== ''));
    const mapping = {};

    // helper to skip totals / footer tokens
    function isFooterOrTotalCell(s) {
      if (!s) return false;
      const ss = s.toLowerCase();
      return ss.includes('total') || ss.includes('subtotal') || ss.includes('total general') || ss.includes('fondo') || ss.includes('total');
    }

    for (const row of rows) {
      // prefer the common Inviu layout: ticker at index 1, price at index 5 (0-based)
      if (row.length >= 6) {
        const candTicker = (row[1]||'').trim();
        const candPrice = (row[5]||'');
        const pVal = parseNumber(candPrice);
        if (candTicker && !isFooterOrTotalCell(candTicker) && !isNaN(pVal)) {
          addMappingForRow(row, 1, 5, mapping, pVal);
          continue;
        }
      }

      // general heuristic: find a ticker-like cell and a numeric cell nearby
      let tickerIdx = -1;
      for (let i = 0; i < row.length; i++) {
        const cell = (row[i]||'').trim();
        if (!cell) continue;
        // prefer short uppercase tokens with letters/numbers (e.g. YPFD, AMZN, AE38)
        const token = cell.replace(/[^A-Za-z0-9]/g, '');
        if (token.length >= 2 && token.length <= 6 && /[A-Za-z]/.test(token)) {
          // ensure it's not a purely alpha word like 'TOTAL' etc
          const low = token.toLowerCase();
          if (low === 'total' || low === 'fondo' || low === 'dolar') continue;
          tickerIdx = i;
          break;
        }
      }

      // if none found, fallback: choose first non-empty textual cell
      if (tickerIdx === -1) {
        for (let i = 0; i < row.length; i++) {
          const cell = (row[i]||'').trim();
          if (!cell) continue;
          // avoid rows that are just "PESOS" / "USD" etc.
          const low = cell.toLowerCase();
          if (['pesos','usd','u$s','dólar','dolar','%','fondo'].some(k => low.includes(k))) continue;
          tickerIdx = i;
          break;
        }
      }

      if (tickerIdx === -1) continue;

      // find numeric candidate to the right within next 6 columns
      let priceIdx = -1;
      for (let j = tickerIdx + 1; j < Math.min(row.length, tickerIdx + 7); j++) {
        const val = parseNumber(row[j]);
        if (!isNaN(val)) { priceIdx = j; break; }
      }
      // fallback: look left a bit
      if (priceIdx === -1) {
        for (let j = Math.max(0, tickerIdx - 3); j <= tickerIdx; j++) {
          const val = parseNumber(row[j]);
          if (!isNaN(val)) { priceIdx = j; break; }
        }
      }
      // fallback: any numeric in row
      if (priceIdx === -1) {
        for (let j = 0; j < row.length; j++) {
          const val = parseNumber(row[j]);
          if (!isNaN(val)) { priceIdx = j; break; }
        }
      }

      if (priceIdx === -1) continue;
      const pVal = parseNumber(row[priceIdx]);
      if (isNaN(pVal)) continue;
      addMappingForRow(row, tickerIdx, priceIdx, mapping, pVal);
    }

    // if mapping still empty, try naive columns (col 1 and col 5)
    if (Object.keys(mapping).length === 0 && rows.length > 0) {
      for (const r of rows) {
        if (r.length >= 6) {
          const ticker = (r[1]||'').trim();
          const p = parseNumber(r[5]||'');
          if (ticker && !isNaN(p)) addMappingForRow(r, 1, 5, mapping, p);
        }
      }
    }

    return mapping;
  }

  // add mapping with multiple normalization keys for better matching
  function addMappingForRow(row, tickerIdx, priceIdx, mapping, pVal) {
    const rawTicker = (row[tickerIdx]||'').trim();
    let rawDesc = '';
    // description often sits right after ticker; try to capture it
    if (tickerIdx + 1 < row.length) rawDesc = (row[tickerIdx+1]||'').trim();
    // build various keys
    const keysToAdd = new Set();

    if (rawTicker) {
      keysToAdd.add(normalizeName(rawTicker));
      keysToAdd.add(String(rawTicker).toUpperCase().replace(/[^A-Z0-9]/g,''));
      // add variant removing trailing D (CEDEAR suffix) and adding trailing D
      const tno = rawTicker.replace(/[^A-Za-z0-9]/g,'');
      if (tno.length > 1) {
        if (/[dD]$/.test(tno)) keysToAdd.add(normalizeName(tno.slice(0,-1)));
        else keysToAdd.add(normalizeName(tno + 'D'));
      }
    }
    if (rawDesc) {
      keysToAdd.add(normalizeName(rawDesc));
      // also first token of description
      const firstTok = rawDesc.split(/\s+/)[0];
      if (firstTok) keysToAdd.add(normalizeName(firstTok));
    }
    // also add a combined ticker + desc key
    if (rawTicker && rawDesc) keysToAdd.add(normalizeName(rawTicker + ' ' + rawDesc));

    // store numeric price
    const priceNum = Number(pVal);
    keysToAdd.forEach(k => {
      if (k && !isNaN(priceNum)) mapping[k] = priceNum;
    });
  }

  // remove displayed values (used when clearing mapping)
  function clearDisplayedValues() {
    if (!clientsContainer) return;
    clientsContainer.querySelectorAll('.client-card').forEach(card => {
      // remove .especie-value or set to '-'
      card.querySelectorAll('.especie-value').forEach(el => el.textContent = ' - ');
      const ct = card.querySelector('.client-total');
      if (ct) ct.textContent = '$ 0';
    });
    if (summaryNominalEl) summaryNominalEl.textContent = fmtCurrency(0);
  }

  // helper: same currency format used elsewhere
  function fmtCurrency(n) { return `$ ${Number(n).toLocaleString(undefined, {maximumFractionDigits:2})}`; }

  // Update UI using mapping object
  function updateValuesFromMapping(mapping) {
    if (!clientsContainer) return;
    const clientCards = clientsContainer.querySelectorAll('.client-card');
    let globalTotal = 0;

    clientCards.forEach(card => {
      let clientTotal = 0;
      // ensure client-total element exists
      const header = card.querySelector('.client-header');
      if (header && !header.querySelector('.client-total')) {
        const div = document.createElement('div');
        div.className = 'client-total';
        div.style.marginLeft = '12px';
        div.style.fontWeight = '600';
        div.textContent = '$ 0';
        header.querySelector('.client-left').appendChild(div);
      }

      const lis = card.querySelectorAll('.fund-list li');
      lis.forEach(li => {
        const nameEl = li.querySelector('span');
        const nomEl = li.querySelector('strong');
        if (!nameEl || !nomEl) return;
        const displayName = nameEl.textContent.trim();
        const nominalRaw = nomEl.textContent || '0';
        // nominal in UI is formatted (1.234,56 or 1,234.56 or plain). parse robustly:
        const nominal = parseNumber(nominalRaw);
        const normName = normalizeName(displayName);

        let price = undefined;

        // 1) direct match
        if (mapping[normName] !== undefined) price = mapping[normName];

        // 2) try fuzzy variants (add/remove trailing D)
        if (price === undefined) {
          if (normName.length > 0) {
            // if ends with d, try without
            if (normName.endsWith('d')) {
              const v = normName.slice(0, -1);
              if (mapping[v] !== undefined) price = mapping[v];
            } else {
              // try adding 'd'
              const v = normName + 'd';
              if (mapping[v] !== undefined) price = mapping[v];
            }
          }
        }

        // 3) try include/contains (fuzzy)
        if (price === undefined) {
          for (const k of Object.keys(mapping)) {
            if (!k) continue;
            if (k.includes(normName) || normName.includes(k)) { price = mapping[k]; break; }
          }
        }

        // 4) try splitting displayName and check tokens (e.g. "YPF S.A." -> "YPF")
        if (price === undefined) {
          const tokens = displayName.split(/\s+/).map(t => normalizeName(t)).filter(Boolean);
          for (const tok of tokens) {
            if (mapping[tok] !== undefined) { price = mapping[tok]; break; }
            // add trailing d heuristic
            if (tok && !tok.endsWith('d') && mapping[tok + 'd'] !== undefined) { price = mapping[tok + 'd']; break; }
          }
        }

        // compute value
        const value = (isNaN(price) || price === undefined) ? NaN : (Number(nominal) * Number(price));

        // update or create value span
        let valueEl = li.querySelector('.especie-value');
        if (!valueEl) {
          valueEl = document.createElement('span');
          valueEl.className = 'especie-value';
          valueEl.style.marginLeft = '8px';
          valueEl.style.fontWeight = '600';
          li.appendChild(valueEl);
        }
        if (isNaN(value)) {
          valueEl.textContent = ' - ';
        } else {
          valueEl.textContent = ('$ ' + Number(value).toLocaleString(undefined, {maximumFractionDigits:2}));
          clientTotal += Number(value);
        }
      });

      const clientTotalEl = card.querySelector('.client-total');
      if (clientTotalEl) clientTotalEl.textContent = '$ ' + Number(clientTotal).toLocaleString(undefined, {maximumFractionDigits:2});
      globalTotal += clientTotal;
    });

    // update summary bar if exists (overrides nominal with value total)
    if (summaryNominalEl) summaryNominalEl.textContent = '$ ' + Number(globalTotal).toLocaleString(undefined, {maximumFractionDigits:2});
  }

  // apply stored mapping on load (if present)
  (function applyStored() {
    try {
      const raw = localStorage.getItem(CSV_KEY);
      if (!raw) return;
      const map = JSON.parse(raw);
      if (map && Object.keys(map).length > 0) {
        csvStatusText.textContent = `Precios cargados (${Object.keys(map).length})`;
        clearCsvBtn.style.display = 'inline-block';
        // Wait a tick so DOM rendered by movimientos.js exists
        setTimeout(() => updateValuesFromMapping(map), 150);
      }
    } catch(e) { console.error(e); }
  })();

  // observe changes to clients container and re-run update (debounced)
  if (clientsContainer) {
    let timer = null;
    const mo = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const raw = localStorage.getItem(CSV_KEY);
        if (!raw) return;
        try {
          const map = JSON.parse(raw);
          if (map) updateValuesFromMapping(map);
        } catch(e) { console.error(e); }
      }, 200);
    });
    mo.observe(clientsContainer, {childList:true, subtree:true, attributes:false});
  }

}); // DOMContentLoaded
