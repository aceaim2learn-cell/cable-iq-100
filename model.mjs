export const categories = {
  '5e': { label: 'Cat 5e', frequency: 100, maxLength: 100, maxLoss: 24, minNext: 27.1, lossRate: .241, nextBase: 42, nextRate: .13 },
  '6': { label: 'Cat 6', frequency: 250, maxLength: 100, maxLoss: 21.7, minNext: 30.1, lossRate: .218, nextBase: 46, nextRate: .12 },
  '6a': { label: 'Cat 6A', frequency: 500, maxLength: 100, maxLoss: 18.6, minNext: 26.1, lossRate: .186, nextBase: 44, nextRate: .14 },
};

export const conductors = [
  ['W/Or', '#f57c00', true], ['Or', '#f57c00', false],
  ['W/Gr', '#2e7d32', true], ['Bl', '#1565c0', false],
  ['W/Bl', '#1565c0', true], ['Gr', '#2e7d32', false],
  ['W/Br', '#5d4037', true], ['Br', '#5d4037', false],
];

export const modes = ['10BASE-T', '100BASE-TX', '1000BASE-T'];
export const pinNumbers = conductors.map((_, index) => index + 1);

function variation(seed, spread) {
  const wave = 10000 * Math.sin(seed * 99.13);
  return (wave - Math.floor(wave) - .5) * 2 * spread;
}

export function estimate(category, length, sequence) {
  if (!Number.isFinite(length) || length <= 0) return null;
  const loss = length * category.lossRate + .6 + variation(length + sequence, .4);
  const next = category.nextBase - length * category.nextRate + variation(length + 2 * sequence, .6);
  return { loss: Number(loss.toFixed(1)), next: Number(next.toFixed(1)) };
}

export function inspectWiremap(map) {
  const issues = [];
  const counts = new Map();
  for (const pin of map) {
    if (pin) counts.set(pin, (counts.get(pin) ?? 0) + 1);
  }
  map.forEach((destination, index) => {
    const source = index + 1;
    if (!destination) issues.push(`Open at A${source}`);
    else if (destination !== source) issues.push(`A${source} → B${destination}`);
  });
  for (const [destination, count] of counts) {
    if (count > 1) issues.push(`Multiple connections to B${destination}`);
  }
  const correct = pin => map[pin - 1] === pin && counts.get(pin) === 1;
  const twoPairs = [1, 2, 3, 6].every(correct);
  const fourPairs = pinNumbers.every(correct);
  return { issues, modes: [twoPairs, twoPairs, fourPairs], correct: fourPairs };
}

export function evaluatePort(category, length, sequence, map) {
  const readings = estimate(category, length, sequence);
  if (!readings) return null;
  const wiring = inspectWiremap(map);
  const lengthPass = length <= category.maxLength;
  const lossPass = readings.loss <= category.maxLoss;
  const nextPass = readings.next >= category.minNext;
  return {
    ...readings, ...wiring, lengthPass, lossPass, nextPass,
    overall: lengthPass && lossPass && nextPass && wiring.correct,
  };
}
