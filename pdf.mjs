import { conductors, modes } from './model.mjs';

const green = '#315d23';
const red = '#b42326';

function drawWiremap(pdf, map, top) {
  const row = index => top + 8 + index * 5.5;
  pdf.setFontSize(8);
  pdf.setTextColor(green);
  pdf.text('SIDE A', 53, top, { align: 'center' });
  pdf.text('SIDE B', 157, top, { align: 'center' });
  pdf.setLineWidth(.65);

  map.forEach((destination, index) => {
    const y = row(index);
    pdf.setDrawColor(conductors[index][1]);
    if (destination) {
      pdf.line(59, y, 151, row(destination - 1));
    } else {
      pdf.setLineDashPattern([1.6, 1], 0);
      pdf.line(59, y, 98, y);
      pdf.setLineDashPattern([], 0);
      pdf.setTextColor(red);
      pdf.text('OPEN', 101, y + 1);
    }
  });

  conductors.forEach(([label, color, striped], index) => {
    const y = row(index);
    pdf.setTextColor('#263127');
    pdf.text(`${index + 1} ${label}`, 49, y + 1, { align: 'right' });
    pdf.text(`${index + 1} ${label}`, 161, y + 1);
    pdf.setFillColor(color);
    pdf.circle(53, y, 1.5, 'F');
    pdf.circle(157, y, 1.5, 'F');
    if (striped) {
      pdf.setDrawColor('#ffffff');
      pdf.line(51.6, y, 54.4, y);
      pdf.line(155.6, y, 158.4, y);
    }
  });
}

function drawResult(pdf, result, category, top) {
  const status = result.overall ? 'PASS' : 'FAIL';
  pdf.setFillColor('#eaf1e6');
  pdf.rect(14, top, 182, 12, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(green);
  const label = pdf.splitTextToSize(result.id, 155).slice(0, 2);
  pdf.text(label, 18, top + (label.length === 1 ? 7.5 : 5));
  pdf.setTextColor(result.overall ? green : red);
  pdf.text(status, 191, top + 7.5, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  modes.forEach((mode, index) => {
    pdf.setTextColor(result.modes[index] ? green : red);
    pdf.text(`${mode} ${result.modes[index] ? 'PASS' : 'FAIL'}`, 18 + index * 60, top + 19);
  });

  const measurements = [
    [`Length ${result.length.toFixed(1)} m (<= ${category.maxLength})`, result.lengthPass],
    [`Attenuation ${result.loss.toFixed(1)} dB (<= ${category.maxLoss})`, result.lossPass],
    [`NEXT ${result.next.toFixed(1)} dB (>= ${category.minNext})`, result.nextPass],
  ];
  measurements.forEach(([label, pass], index) => {
    pdf.setTextColor(pass ? green : red);
    pdf.text(label, 18 + index * 60, top + 25);
  });

  let mapTop = top + 37;
  if (result.issues.length) {
    pdf.setTextColor(red);
    pdf.setFontSize(8);
    const findings = pdf.splitTextToSize(result.issues.join(' | ').replaceAll('→', 'to'), 170);
    pdf.text(findings, 18, top + 31);
    mapTop += findings.length * 3;
  }
  drawWiremap(pdf, result.map, mapTop);
}

export function buildReport(PDF, job, results, logo) {
  const pdf = new PDF({ format: 'a4', unit: 'mm', compress: true });
  pdf.setProperties({ title: 'Aim2Learn Cable IQ 100 training report', author: 'Aim2Learn' });
  pdf.setFillColor('#202b20');
  pdf.rect(0, 0, 210, 34, 'F');
  pdf.setFillColor('#80b849');
  pdf.rect(0, 34, 210, 1.5, 'F');
  const titleX = logo ? 42 : 14;
  if (logo) {
    pdf.setFillColor('#ffffff');
    pdf.roundedRect(14, 7, 22, 20, 2, 2, 'F');
    pdf.addImage(logo, 'PNG', 16, 10, 18, 14.1);
  }
  pdf.setFontSize(10);
  pdf.setTextColor('#c3e3a8');
  pdf.text('AIM2LEARN  /  TELECOMS TRAINING', titleX, 13);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor('#ffffff');
  pdf.setFontSize(20);
  pdf.text('Cable IQ 100 test report', titleX, 23);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`${job.category.label} (${job.category.frequency} MHz)`, titleX, 29);

  const count = results.filter(result => result.overall).length;
  const entries = [
    ['Site', job.site], ['Address', job.address], ['Tested by', job.tester],
    ['Date', job.date], ['Ports passed', `${count} / ${results.length}`],
  ];
  let top = 44;
  pdf.setTextColor('#263127');
  for (const [label, value] of entries) {
    const lines = pdf.splitTextToSize(value, 148);
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, 14, top);
    pdf.setFont('helvetica', 'normal');
    pdf.text(lines, 43, top);
    top += 5 + (lines.length - 1) * 4;
  }

  top += 5;
  for (const result of results) {
    if (top + 98 > 278) {
      pdf.addPage();
      top = 16;
    }
    drawResult(pdf, result, job.category, top);
    top += 99;
  }
  for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
    pdf.setPage(page);
    pdf.setTextColor('#465145');
    pdf.setFontSize(8);
    pdf.text('Training simulation. Attenuation and NEXT are estimates based on length.', 14, 288);
    pdf.text(String(page), 196, 288, { align: 'right' });
  }
  return pdf;
}

export function downloadReport(job, results) {
  const image = document.querySelector('.brand img');
  const logo = image.complete && image.naturalWidth ? image : undefined;
  buildReport(window.jspdf.jsPDF, job, results, logo)
    .save(`Aim2Learn_CableIQ100_${job.date.replaceAll(' ', '-')}.pdf`);
}
