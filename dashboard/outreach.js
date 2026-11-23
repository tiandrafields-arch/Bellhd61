'use strict';

const PrecinctOutreach = (() => {
  const file = DATA.outreach;
  const format = value => value.toLocaleString('en-US');
  const dollars = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});
  const numberOrder = new Intl.Collator('en-US', {numeric: true});
  const start = ['1-54', '1-96'];
  const outside = file.codes.filter(code => !file.footprint.includes(code));
  const state = {selected: new Set(start), channel: 'doors', cohort: 'core', mailUnit: 'mail',
    sort: 'voters', capacity: '30', price: ''};

  function summarize(cohort, selected) {
    const totals = {voters: 0, doors: 0, mail: 0, mailable: 0};
    const {rows, shared} = file.cohorts[cohort];
    for (const code of selected) {
      for (const metric of Object.keys(totals)) totals[metric] += rows[code][metric];
    }
    // An address used in multiple file precincts counts once in a combined selection.
    for (const metric of ['doors', 'mail']) {
      for (const group of shared[metric]) {
        const matches = group.codes.filter(code => selected.has(code)).length;
        totals[metric] -= Math.max(0, matches - 1) * group.count;
      }
    }
    return totals;
  }

  const template = `
    <header class="out-header"><h2>Precinct outreach planner</h2>
      <p>Choose where Bell will walk or send mail. Precincts 54 and 96 have the most voters who cast a ballot in all three elections reviewed. Start there or choose your own precincts.</p></header>
    <div class="out-controls">
      <label>Outreach method<select data-field="channel"><option value="doors">Door knocking</option><option value="mail">Mailers</option></select></label>
      <label>Voters to include<select data-field="cohort"><option value="core">Voted in all 3 elections</option><option value="expanded">Voted in at least 2 of 3</option></select></label>
      <label data-group="walk">Planned doors per shift<input data-field="capacity" type="number" min="1" step="1"></label>
      <label data-group="mail">Send one piece per<select data-field="mailUnit"><option value="mail">Mailing address</option><option value="mailable">Voter</option></select></label>
      <label data-group="mail">Print and postage per piece ($)<input data-field="price" type="number" min="0" step="any" placeholder="Enter your quote"></label>
    </div>
    <div class="out-scope"><strong>Choose precincts</strong><div class="out-picks">
      <button type="button" data-pick="start">54 and 96</button><button type="button" data-pick="outside">Outside Bell’s 2024 council district</button>
      <button type="button" data-pick="all">All 32 precincts</button><button type="button" data-pick="none">Clear selection</button>
    </div><p class="help" data-el="selected"></p></div>
    <div data-el="result" class="out-result" aria-live="polite" aria-atomic="true"></div>
    <details class="out-map"><summary>Explore the district map</summary><p class="help" data-el="map-caption"></p><div data-el="map"></div></details>
    <div class="out-rank"><div><h3>Compare precincts</h3><p class="help">Check individual precincts to build your own list. A and B appear separately wherever the file lists them.</p></div>
      <label>Sort precincts by<select data-field="sort"><option value="voters">Most voters</option><option value="units">Largest workload</option><option value="ratio">Most voters per stop or piece</option><option value="code">Precinct number</option></select></label></div>
    <div class="out-tbl" role="region" tabindex="0" aria-label="Precinct planning table">
      <table class="tbl"><thead data-el="head"></thead><tbody data-el="rows"></tbody></table></div>
    <p class="out-note">Louisiana active voter file, November 23, 2026. The three elections were October 14, 2023, December 7, 2024 and March 29, 2025. These counts measure recorded participation. Candidate preference and future turnout are unknown.</p>`;

  function mount(container) {
    container.innerHTML = template;
    const element = key => container.querySelector('[data-el="' + key + '"]');
    const input = key => container.querySelector('[data-field="' + key + '"]');
    const mapDetails = container.querySelector('.out-map');
    let map = null;
    for (const key of ['channel', 'cohort', 'mailUnit', 'sort', 'capacity', 'price']) input(key).value = state[key];
    const isWalk = () => state.channel === 'doors';
    const metric = () => isWalk() ? 'doors' : state.mailUnit;
    const measure = () => isWalk() ? 'doors' : 'mail pieces';
    const unitPrice = () => state.price.trim() !== '' && Number.isFinite(+state.price) && +state.price >= 0 ? +state.price : null;
    const validCapacity = () => Number.isSafeInteger(+state.capacity) && +state.capacity > 0;
    function synchronizeControls() {
      container.querySelectorAll('[data-group]').forEach(label => {
        label.hidden = label.dataset.group === 'walk' ? !isWalk() : isWalk();
      });
      input('sort').options[1].textContent = isWalk() ? 'Most doors' : 'Most mail pieces';
      input('sort').options[2].textContent = isWalk() ? 'Most voters per door' : 'Most voters per piece';
    }
    function renderSelection() {
      const selected = file.codes.filter(code => state.selected.has(code));
      if (!selected.length) element('selected').textContent = 'Select a group above or check precincts in the table below.';
      else if (selected.length === file.codes.length) element('selected').textContent = 'All 32 file precincts selected.';
      else element('selected').textContent = selected.length + ' selected · Ward 1 precinct' + (selected.length === 1 ? ' ' : 's ') + selected.map(code => code.slice(2)).join(', ');
      for (const [key, codes] of Object.entries({start, outside, all: file.codes, none: []})) {
        const matches = codes.length === selected.length && codes.every(code => state.selected.has(code));
        container.querySelector('[data-pick="' + key + '"]').setAttribute('aria-pressed', String(matches));
      }
    }
    function renderResult() {
      const core = summarize('core', state.selected);
      const expanded = summarize('expanded', state.selected);
      const all = state.cohort === 'core' ? core : expanded;
      const units = all[metric()];
      const extra = expanded[metric()] - core[metric()];
      const price = unitPrice();
      const stat = (label, value) => '<div><span>' + label + '</span><strong>' + value + '</strong></div>';
      let estimate, hint;
      if (isWalk()) {
        estimate = stat('Volunteer shifts', validCapacity() ? format(Math.ceil(units / +state.capacity)) : 'Set pace');
        hint = validCapacity() ? 'Assumes ' + format(+state.capacity) + ' doors per volunteer shift. Adjacent apartments count separately when a unit is recorded.' : 'Enter a positive whole number of doors per volunteer shift.';
      } else {
        estimate = stat('Estimated mailing cost', price === null ? 'Enter quote' : dollars.format(units * price));
        hint = state.mailUnit === 'mail' ? 'One piece per distinct mailing address, including when voters share an address across precincts.' : 'One addressed piece for each selected voter with a mailing address.';
        hint += ' Confirm the address list with the printer before placing the order.';
      }
      let comparison = 'Check a precinct to see the additional workload for voters who participated in two elections.';
      if (state.selected.size) {
        comparison = 'Including voters who cast a ballot in exactly two elections adds <b>' + format(expanded.voters - core.voters) + ' voters</b> and <b>' + format(extra) + ' ' + measure() + '</b> beyond the all three group.';
        if (!isWalk() && price !== null) comparison += ' That adds ' + dollars.format(extra * price) + ' at your quoted price.';
      }
      let otherChannel = '';
      if (state.selected.size && state.selected.size < file.codes.length) {
        const remaining = new Set(file.codes.filter(code => !state.selected.has(code)));
        const other = summarize(state.cohort, remaining);
        const label = isWalk() ? 'If you walk these precincts' : 'If you mail these precincts';
        const workload = isWalk() ? format(other.mail) + ' pieces at one per mailing address' : format(other.doors) + ' residential stops';
        otherChannel = '<p class="out-complement"><b>' + label + ',</b> the other ' + remaining.size +
          ' precincts contain ' + format(other.voters) + ' voters with the same voting history. ' +
          (isWalk() ? 'One mailing there would take ' : 'Walking them would take ') + workload + '.</p>';
      }
      element('result').innerHTML = '<div class="out-metrics">' + stat('Voters in your selection',format(all.voters)) +
        stat(isWalk() ? 'Distinct residential stops' : 'Pieces for one mailing',format(units)) + estimate +
        '</div><p class="out-hint">' + hint + '</p><p class="out-expand">' + comparison + '</p>' + otherChannel;
    }
    function renderRows() {
      const rows = file.cohorts[state.cohort].rows;
      const key = metric();
      const ratio = r => r[key] ? r.voters / r[key] : 0;
      const sorted = [...file.codes].sort((a,b) => {
        const left = rows[a], right = rows[b];
        let difference = 0;
        if (state.sort === 'voters') difference = right.voters - left.voters;
        if (state.sort === 'units') difference = right[key] - left[key];
        if (state.sort === 'ratio') difference = ratio(right) - ratio(left);
        return difference || numberOrder.compare(a,b);
      });
      element('head').innerHTML = '<tr><th scope="col">Ward / precinct</th><th scope="col" class="num">Voters</th><th scope="col" class="num">' +
        (isWalk() ? 'Door stops' : 'Mail pieces') + '</th><th scope="col" class="num">Voters per ' + (isWalk() ? 'door' : 'piece') +
        '</th><th scope="col" class="num">' + (isWalk() ? 'Shifts' : 'Est. cost') + '</th></tr>';
      element('rows').innerHTML = sorted.map(code => {
        const r = rows[code];
        let effort = 'Enter quote';
        if (isWalk()) effort = validCapacity() ? format(Math.ceil(r.doors / +state.capacity)) : 'Set pace';
        else if (unitPrice() !== null) effort = dollars.format(r[key] * unitPrice());
        return '<tr><th scope="row"><label><input type="checkbox" data-code="' + code + '" ' +
          (state.selected.has(code) ? 'checked' : '') + '>' + code.replace('-', ' / ') +
          '</label></th><td class="num">' + format(r.voters) + '</td><td class="num">' + format(r[key]) +
          '</td><td class="num">' + ratio(r).toFixed(2) + '</td><td class="num">' + effort + '</td></tr>';
      }).join('');
    }
    function renderMap() {
      map?.destroy();
      map = null;
      if (!mapDetails.open) return;
      const key = metric();
      const district = summarize(state.cohort, new Set(file.codes));
      const areaCodes = new Map();
      for (const code of file.codes) {
        const area = code.replace(/[A-Z]$/, '');
        if (!areaCodes.has(area)) areaCodes.set(area,new Set());
        areaCodes.get(area).add(code);
      }
      const areas = new Map([...areaCodes].map(([area,codes]) => [area, summarize(state.cohort, codes)]));
      const unit = isWalk() ? 'Residential stops' : 'Mail pieces';
      element('map-caption').textContent = unit + ' across all 24 mapped areas for the selected voting history. Select a shape or choose a precinct to see its count. The map combines A and B subdivisions.';
      map = window.mountAtlas(element('map'), {compact: true, plan: {
        layer: {name: unit, key: [['Under 100','#d5e5ee'],['100 to 199','#9ebfd4'],['200 or more','#598bae']],
          color(p) { const n = areas.get(p.id)[key]; return n >= 200 ? '#598bae' : n >= 100 ? '#9ebfd4' : '#d5e5ee'; }},
        metrics(id) { const area = id ? areas.get(id) : district; return [[unit,format(area[key])],['Voters',format(area.voters)]]; },
        scope: state.cohort === 'core' ? 'Voted in all 3 elections' : 'Voted in at least 2 of 3 elections',
        note: isWalk() ? 'Stops use recorded residential addresses. The map shows precinct totals. Street access and travel time require local route planning.' :
          (state.mailUnit === 'mail' ? 'One mail piece per distinct mailing address.' : 'One mail piece per voter.') + ' The map places voters in their home precinct even when their mail goes elsewhere.'
      }});
    }

    container.addEventListener('click', event => {
      const pick = event.target.closest('[data-pick]');
      if (!pick) return;
      const presets = {start, outside, all: file.codes, none: []};
      state.selected = new Set(presets[pick.dataset.pick]);
      renderSelection(); renderRows(); renderResult();
    });
    container.addEventListener('change', event => {
      const control = event.target;
      if (control.dataset.code) {
        if (control.checked) state.selected.add(control.dataset.code);
        else state.selected.delete(control.dataset.code);
        renderSelection(); renderResult();
        return;
      }
      if (!['channel','cohort','mailUnit','sort'].includes(control.dataset.field)) return;
      state[control.dataset.field] = control.value;
      synchronizeControls(); renderRows(); renderResult();
      if (control.dataset.field !== 'sort') renderMap();
    });
    container.addEventListener('input', event => {
      const key = event.target.dataset.field;
      if (key === 'capacity' || key === 'price') {state[key] = event.target.value; renderResult(); renderRows();}
    });
    mapDetails.addEventListener('toggle', renderMap);
    synchronizeControls(); renderSelection(); renderRows(); renderResult();
    return {destroy() {mapDetails.removeEventListener('toggle', renderMap); map?.destroy();}};
  }
  return {mount, summarize};
})();
