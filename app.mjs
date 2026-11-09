import { categories, conductors, estimate, evaluatePort, inspectWiremap, modes, pinNumbers } from './model.mjs';
import { downloadReport } from './pdf.mjs';

const form = document.querySelector('#tester');
const fields = form.elements;
const portList = document.querySelector('#ports');
const portTemplate = document.querySelector('#port-template');
const report = document.querySelector('#report');
const message = document.querySelector('#message');
const addButton = document.querySelector('#add-port');

const presets = {
  straight: pinNumbers,
  open: [1, 2, 3, 4, 5, 0, 7, 8],
  reversed: [1, 2, 6, 4, 5, 3, 7, 8],
  duplicate: [1, 2, 3, 4, 5, 3, 7, 8],
};

let sequence = 0;
let ports = [];

function localDate() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map(part => String(part).padStart(2, '0')).join('-');
}

function node(tag, content, className) {
  const element = document.createElement(tag);
  if (content != null) element.textContent = content;
  if (className) element.className = className;
  return element;
}

function wireDiagram(map) {
  const row = index => 50 + index * 30;
  const paths = map.map((destination, index) => {
    const start = row(index);
    const end = destination ? row(destination - 1) : start;
    const path = destination ? `M132 ${start} C250 ${start} 450 ${end} 568 ${end}` : `M132 ${start} H349`;
    const color = conductors[index][1];
    const dash = destination ? '' : ' stroke-dasharray="8 5"';
    const open = destination ? '' : `<text x="360" y="${start + 4}" fill="#b42326" font-size="12">OPEN</text>`;
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="3"${dash}/>${open}`;
  });
  const terminals = [true, false].flatMap(left => conductors.map(([name, color, striped], index) => {
    const x = left ? 106 : 594;
    const y = row(index);
    const stripe = striped ? `<path d="M${x - 8} ${y}h16" stroke="white" stroke-width="3"/>` : '';
    return `<text x="${left ? 88 : 612}" y="${y + 4}" text-anchor="${left ? 'end' : 'start'}" font-size="14" fill="#253128">${index + 1} ${name}</text>
      <circle cx="${x}" cy="${y}" r="9" fill="${color}" stroke="#253128"/>${stripe}`;
  }));
  const wrap = node('div', null, 'diagram');
  const description = map.map((destination, index) => `A${index + 1} ${destination ? `to B${destination}` : 'open'}`).join(', ');
  wrap.innerHTML = `<svg viewBox="0 0 700 281" role="img" aria-label="T568B wiremap. ${description}" font-family="Arial,sans-serif">
    <g font-size="16" font-weight="bold" fill="#315d23" text-anchor="middle"><text x="106" y="22">SIDE A</text><text x="594" y="22">SIDE B</text></g>
    ${paths.join('')}${terminals.join('')}
  </svg>`;
  return wrap;
}

function readMap(port) {
  return port.pins.map(select => Number(select.value));
}

function updateWiremap(port) {
  const map = readMap(port);
  const { correct, issues } = inspectWiremap(map);
  port.preset.value = Object.keys(presets).find(key => presets[key].every((pin, i) => pin === map[i])) ?? 'custom';
  port.wireStatus.className = `wire-status ${correct ? 'pass' : 'fail'}`;
  port.wireStatus.textContent = correct ? '✓ Straight-through wiremap' : `Wiremap faults · ${issues.join(' · ')}`;
  port.diagram.replaceChildren(...wireDiagram(map).childNodes);
}

function showReading(element, value, limit, pass) {
  const reading = node('strong', value == null ? '—' : `${value.toFixed(1)} dB`, value == null ? '' : pass ? 'pass' : 'fail');
  element.replaceChildren(reading, node('small', ` ${limit}`));
}

function updateReadings(port) {
  const category = categories[fields.category.value];
  const length = port.length.valueAsNumber;
  const readings = estimate(category, length, port.number);
  const lossPass = readings && readings.loss <= category.maxLoss;
  const nextPass = readings && readings.next >= category.minNext;
  showReading(port.attenuation, readings?.loss, readings ? `≤ ${category.maxLoss} dB` : 'Enter length', lossPass);
  showReading(port.next, readings?.next, readings ? `≥ ${category.minNext} dB` : 'Enter length', nextPass);
  port.calculation.textContent = readings ? [
    `> Length ${length.toFixed(1)} m · ${category.label} (${category.frequency} MHz)`,
    `> Insertion loss = length × ${category.lossRate} dB/m + simulated connector loss`,
    `> NEXT = ${category.nextBase} − (length × ${category.nextRate}) + model variation`,
    `> Attenuation ${lossPass ? 'PASS' : 'FAIL'} · NEXT ${nextPass ? 'PASS' : 'FAIL'} · Length ${length <= category.maxLength ? 'PASS' : 'FAIL'} (≤ ${category.maxLength} m)`,
  ].join('\n') : '> Enter a positive cable length in metres.';
}

function clearReport() {
  report.hidden = true;
  report.replaceChildren();
  message.hidden = true;
}

function addPort(focus = false) {
  const number = ++sequence;
  const card = portTemplate.content.firstElementChild.cloneNode(true);
  const title = card.querySelector('.port-title');
  const remove = card.querySelector('.remove');
  const id = card.querySelector('.port-id');
  const preset = card.querySelector('.preset');
  const pinGrid = card.querySelector('.pins');
  const pins = pinNumbers.map(pin => {
    const label = node('label', `Pin ${pin} →`);
    const select = node('select');
    for (const target of [...pinNumbers, 0]) {
      select.append(new Option(target ? String(target) : 'Open', String(target), target === pin, target === pin));
    }
    label.append(select);
    pinGrid.append(label);
    return select;
  });
  title.textContent = id.value = `Port ${number}`;
  remove.setAttribute('aria-label', `Remove port ${number}`);
  const port = {
    number, card, id, pins, preset,
    length: card.querySelector('.length'),
    attenuation: card.querySelector('.attenuation'),
    next: card.querySelector('.next'),
    calculation: card.querySelector('.calculation'),
    diagram: card.querySelector('.diagram'),
    wireStatus: card.querySelector('.wire-status'),
  };
  remove.addEventListener('click', () => {
    ports = ports.filter(item => item !== port);
    card.remove();
    clearReport();
    addButton.focus();
  });
  port.length.addEventListener('input', () => {
    port.length.removeAttribute('aria-invalid');
    updateReadings(port);
  });
  pinGrid.addEventListener('change', () => {
    updateWiremap(port);
    clearReport();
  });
  preset.addEventListener('change', () => {
    const map = presets[preset.value];
    pins.forEach((select, index) => { select.value = String(map[index]); });
    updateWiremap(port);
    clearReport();
  });
  ports.push(port);
  portList.append(card);
  updateReadings(port);
  updateWiremap(port);
  if (focus) id.focus();
}

function reportSummary(job, results) {
  const list = node('dl');
  for (const [label, value] of [
    ['Site', job.site], ['Tested by', job.tester], ['Address', job.address], ['Date', job.date],
    ['Ports tested', results.length], ['Passed', `${results.filter(result => result.overall).length} / ${results.length}`],
  ]) {
    list.append(node('dt', label), node('dd', value));
  }
  return list;
}

function renderResult(result, category) {
  const card = node('article', null, 'result');
  const header = node('header', null, 'result-head');
  header.append(node('h3', `${result.id} · ${category.label}`),
    node('strong', result.overall ? 'PASS' : 'FAIL', result.overall ? 'pass' : 'fail'));

  const checks = node('div', null, 'standards');
  checks.setAttribute('aria-label', 'Ethernet wiremap checks');
  modes.forEach((mode, i) => {
    const box = node('div', mode, 'standard');
    box.append(node('strong', result.modes[i] ? '✓ PASS' : '✕ FAIL', result.modes[i] ? 'pass' : 'fail'));
    checks.append(box);
  });

  const measurements = node('div', null, 'measurements');
  for (const [reading, pass] of [
    [`Length ${result.length.toFixed(1)} m (≤ ${category.maxLength})`, result.lengthPass],
    [`Attenuation ${result.loss.toFixed(1)} dB (≤ ${category.maxLoss})`, result.lossPass],
    [`NEXT ${result.next.toFixed(1)} dB (≥ ${category.minNext})`, result.nextPass],
  ]) measurements.append(node('span', reading, pass ? 'pass' : 'fail'));

  card.append(header, checks, measurements);
  if (result.issues.length) card.append(node('p', result.issues.join(' · '), 'findings'));
  card.append(wireDiagram(result.map));
  return card;
}

function exportReport(job, results) {
  try {
    downloadReport(job, results);
  } catch (error) {
    console.error(error);
    message.textContent = 'The PDF could not download. Use Print report to save the report as a PDF.';
    message.hidden = false;
  }
}

function renderReport(job, results) {
  const title = node('h2', `Cable test report · ${job.category.label} (${job.category.frequency} MHz)`);
  const note = node('p', 'Simulated training results. Attenuation and NEXT are estimated from length. Ethernet checks describe the selected wiremap.', 'report-note');
  const buttons = node('div', null, 'actions');
  const download = node('button', 'Download PDF');
  download.addEventListener('click', () => exportReport(job, results));
  const print = node('button', 'Print report', 'secondary');
  print.addEventListener('click', () => window.print());
  buttons.append(download, print);
  report.replaceChildren(title, reportSummary(job, results), note,
    ...results.map(result => renderResult(result, job.category)), buttons);
  report.hidden = false;
  report.focus();
}

form.addEventListener('input', clearReport);
fields.category.addEventListener('change', () => {
  ports.forEach(updateReadings);
  clearReport();
});
addButton.addEventListener('click', () => {
  clearReport();
  addPort(true);
});
document.querySelector('#reset').addEventListener('click', () => {
  form.reset();
  fields.testDate.value = localDate();
  portList.replaceChildren();
  ports = [];
  sequence = 0;
  clearReport();
  addPort();
  fields.site.focus();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  clearReport();
  const category = categories[fields.category.value];
  const results = [];
  for (const port of ports) {
    const id = port.id.value.trim() || `Port ${port.number}`;
    const map = readMap(port);
    const length = port.length.valueAsNumber;
    const result = evaluatePort(category, length, port.number, map);
    if (!result) {
      message.textContent = `Enter a positive cable length for ${id}.`;
      message.hidden = false;
      port.length.setAttribute('aria-invalid', 'true');
      port.length.focus();
      return;
    }
    results.push({ id, length, map, ...result });
  }
  if (!results.length) {
    message.textContent = 'Add at least one port to generate a report.';
    message.hidden = false;
    addButton.focus();
    return;
  }
  const job = {
    category, site: fields.site.value.trim() || 'Not specified',
    address: fields.address.value.trim() || 'Not specified',
    tester: fields.testerName.value.trim() || 'Technician',
    date: fields.testDate.value || 'Not specified',
  };
  renderReport(job, results);
  exportReport(job, results);
});

fields.testDate.value = localDate();
addPort();
