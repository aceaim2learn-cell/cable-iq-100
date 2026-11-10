import { conductors, modes } from './model.mjs';

const ink = '#202820';
const green = '#315d23';
const red = '#a71e25';
const left = 10;
const right = 200;
const bottom = 285;
const lineHeight = 3.5;
const bandHeight = 17;

function text(pdf, value, x, y, { size = 9, bold = false, color = ink, align = 'left' } = {}) {
  pdf.setFont('helvetica', bold ? 'bold' : 'normal');
  pdf.setFontSize(size);
  pdf.setTextColor(color);
  pdf.text(value, x, y, { align, lineHeightFactor: lineHeight * pdf.internal.scaleFactor / size });
}

function wrap(pdf, value, width, size = 9, bold = false) {
  pdf.setFont('helvetica', bold ? 'bold' : 'normal');
  pdf.setFontSize(size);
  return pdf.splitTextToSize(value, width);
}

function formatDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : date;
}

function drawHeader(pdf, job, results, logo) {
  const titleX = logo ? 33 : 11;
  if (logo) pdf.addImage(logo, 'PNG', 11, 7, 19, 14.9, 'aim2learn-logo');
  text(pdf, 'AIM2LEARN CABLE IQ 100', titleX, 13, { size: 16, bold: true, color: green });
  text(pdf, 'TELECOMS TRAINING', titleX, 18, { size: 9, bold: true, color: green });
  text(pdf, 'Cable test results', right, 13, { size: 11, bold: true, align: 'right' });
  text(pdf, 'Training simulation', right, 18, { size: 9, align: 'right' });

  pdf.setDrawColor(ink);
  pdf.setLineWidth(.25);
  pdf.rect(left, 24, right - left, bottom - 24);
  pdf.setDrawColor('#80b849');
  pdf.setLineWidth(.75);
  pdf.line(left, 23, right, 23);

  const site = wrap(pdf, job.site, 84);
  const address = wrap(pdf, job.address, 84);
  const tester = wrap(pdf, job.tester, 59);
  const passed = results.filter(result => result.overall).length;
  const addressY = 31 + site.length * lineHeight + 2;
  const summaryY = 31 + tester.length * lineHeight + 2;
  const notesY = Math.max(53, addressY + address.length * lineHeight + 4, summaryY + 9);
  text(pdf, 'Site:', 13, 31, { bold: true });
  text(pdf, site, 32, 31);
  text(pdf, 'Address:', 13, addressY, { bold: true });
  text(pdf, address, 32, addressY);
  text(pdf, 'Tested by:', 120, 31, { bold: true });
  text(pdf, tester, 139, 31);
  text(pdf, `${job.category.label} (${job.category.frequency} MHz)`, 120, summaryY);
  text(pdf, `${passed} of ${results.length} cables passed`, 120, summaryY + 4);
  text(pdf, 'Written notes:', 13, notesY, { bold: true });
  pdf.setLineWidth(.2);
  pdf.setDrawColor('#a2a9a0');
  pdf.line(38, notesY + .5, 196, notesY + .5);
  return notesY + 7;
}

function drawWiremap(pdf, map, x, top) {
  const pinX = index => x + 6 + index * 3.25;
  const upper = top + 4.4;
  const lower = top + 10.9;
  pdf.setDrawColor('#8b9589');
  pdf.setFillColor('#ffffff');
  pdf.setLineWidth(.18);
  pdf.rect(x, top, 32, 15, 'FD');
  text(pdf, 'A', x + 2.1, top + 3.4, { size: 6, bold: true, align: 'center' });
  text(pdf, 'B', x + 2.1, top + 14, { size: 6, bold: true, align: 'center' });

  map.forEach((destination, index) => {
    const start = pinX(index);
    pdf.setLineWidth(.35);
    if (destination) {
      pdf.setDrawColor(conductors[index][1]);
      pdf.line(start, upper, pinX(destination - 1), lower);
    } else {
      pdf.setDrawColor(red);
      const end = upper + 3.1;
      pdf.line(start, upper, start, end);
      pdf.line(start - .55, end - .5, start + .55, end + .6);
      pdf.line(start + .55, end - .5, start - .55, end + .6);
    }
    const pin = String(index + 1);
    text(pdf, pin, start, top + 3.4, { size: 6, align: 'center' });
    text(pdf, pin, start, top + 14, { size: 6, align: 'center' });
  });
}

function drawMark(pdf, x, y, pass) {
  pdf.setDrawColor(pass ? green : red);
  pdf.setLineWidth(.48);
  if (pass) {
    pdf.line(x, y - .6, x + .85, y + .35);
    pdf.line(x + .85, y + .35, x + 2.45, y - 1.85);
  } else {
    pdf.line(x + .3, y - 1.6, x + 2.1, y + .25);
    pdf.line(x + 2.1, y - 1.6, x + .3, y + .25);
  }
}

function prepareResult(pdf, result, category) {
  const qualification = modes.map((label, index) => [label, result.modes[index]]).reverse();
  qualification.push(['Wiremap only', result.correct]);
  const qualified = qualification.filter(([, pass]) => pass).map(([label]) => label);
  const disqualified = qualification.filter(([, pass]) => !pass).map(([label]) => label);
  const reasons = result.issues.map(issue => issue.replaceAll('→', 'to'));
  if (!result.lengthPass) reasons.push(`Length exceeds ${category.maxLength} m`);
  if (!result.lossPass) reasons.push(`Attenuation exceeds ${category.maxLoss} dB`);
  if (!result.nextPass) reasons.push(`NEXT below ${category.minNext} dB`);
  const id = wrap(pdf, result.id, 112, 10, true);
  const findings = reasons.length ? wrap(pdf, `Reason: ${reasons.join(' | ')}`, 167, 8) : [];
  const summaryLines = Number(Boolean(qualified.length)) + Number(Boolean(disqualified.length));
  const bandOffset = 8.5 + (id.length - 1 + summaryLines + findings.length) * lineHeight;
  return { id, qualified, disqualified, findings, bandOffset, height: bandOffset + bandHeight };
}

function drawResult(pdf, result, row, date, top) {
  const start = 13;
  const end = 197;
  const bandTop = top + row.bandOffset;
  pdf.setFillColor('#edf0ec');
  pdf.rect(start, bandTop, end - start, bandHeight, 'F');
  pdf.setDrawColor(ink);
  pdf.setLineWidth(.25);
  pdf.rect(start, top, end - start, row.height);

  text(pdf, 'Cable ID:', 15, top + 4.8, { size: 10, bold: true });
  text(pdf, row.id, 32, top + 4.8, { size: 10, bold: true });
  text(pdf, result.overall ? 'PASS' : 'FAIL', 154, top + 4.8,
    { bold: true, color: result.overall ? green : red });
  text(pdf, 'Written notes:', 195, top + 4.8, { size: 8, align: 'right' });
  pdf.setDrawColor('#a2a9a0');
  pdf.setLineWidth(.18);
  pdf.line(173, top + 8, 195, top + 8);

  let y = top + 9 + (row.id.length - 1) * lineHeight;
  for (const [label, values, pass] of [
    ['Qualified:', row.qualified, true],
    ['Disqualified:', row.disqualified, false],
  ]) {
    if (!values.length) continue;
    text(pdf, label, 40, y, { size: 8, bold: true, align: 'right' });
    drawMark(pdf, 42, y, pass);
    text(pdf, values.join(' | '), 46, y, { size: 8 });
    y += lineHeight;
  }
  if (row.findings.length) text(pdf, row.findings, 17, y, { size: 8, color: red });

  const readings = [
    ['Date', date, true, 29],
    ['Length', `${result.length.toFixed(1)} m`, result.lengthPass, 58],
    ['Attenuation', `${result.loss.toFixed(1)} dB`, result.lossPass, 87],
    ['NEXT', `${result.next.toFixed(1)} dB`, result.nextPass, 116],
  ];
  for (const [label, value, pass, x] of readings) {
    text(pdf, label, x, bandTop + 7, { size: 8, align: 'center' });
    text(pdf, value, x, bandTop + 11.5, { size: 9, color: pass ? ink : red, align: 'center' });
  }
  drawWiremap(pdf, result.map, 142, bandTop + 1);
}

export function buildReport(PDF, job, results, logo) {
  const pdf = new PDF({ format: 'a4', unit: 'mm', compress: true });
  pdf.setProperties({ title: 'Aim2Learn Cable IQ 100 training report', author: 'Aim2Learn' });
  const date = formatDate(job.date);
  let top = drawHeader(pdf, job, results, logo);

  for (const result of results) {
    const row = prepareResult(pdf, result, job.category);
    if (top + row.height > 270) {
      pdf.addPage();
      top = drawHeader(pdf, job, results, logo);
    }
    drawResult(pdf, result, row, date, top);
    top += row.height;
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor('#a2a9a0');
    pdf.setLineWidth(.2);
    pdf.line(13, 272, 197, 272);
    text(pdf, 'Qualification reflects the selected wiremap. Attenuation and NEXT are length-based estimates.', 14, 277, { size: 7.5 });
    text(pdf, `${page} / ${pages}`, 105, 282, { size: 8, align: 'center' });
    text(pdf, 'Aim2Learn', 196, 282, { size: 9, bold: true, color: green, align: 'right' });
  }
  return pdf;
}

export function downloadReport(job, results) {
  const image = document.querySelector('.brand img');
  const logo = image.complete && image.naturalWidth ? image : undefined;
  buildReport(window.jspdf.jsPDF, job, results, logo)
    .save(`Aim2Learn_CableIQ100_${job.date.replaceAll(' ', '-')}.pdf`);
}
