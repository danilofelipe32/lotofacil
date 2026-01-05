
import { LotofacilDraw, Statistics, DuplicateEntry } from '../types';
import { LOTOFACIL_CONFIG } from '../constants';

export const calculateStatistics = (draws: LotofacilDraw[]): Statistics => {
  const frequency: Record<number, number> = {};
  for (let i = 1; i <= 25; i++) frequency[i] = 0;

  let totalEven = 0;
  let totalOdd = 0;
  let totalSum = 0;
  const sums: number[] = [];
  const primeCountMap: Record<number, number> = {};
  const repeats: number[] = [];
  
  // Para detecção de duplicatas
  const combinationsMap = new Map<string, number[]>();

  draws.forEach((draw, idx) => {
    let drawEven = 0;
    let drawOdd = 0;
    let drawSum = 0;
    let drawPrimes = 0;

    // Registra a combinação para verificar duplicatas
    const comboKey = draw.numbers.sort((a, b) => a - b).join(',');
    const existing = combinationsMap.get(comboKey) || [];
    combinationsMap.set(comboKey, [...existing, draw.concurso]);

    draw.numbers.forEach(n => {
      frequency[n] = (frequency[n] || 0) + 1;
      if (n % 2 === 0) drawEven++; else drawOdd++;
      drawSum += n;
      if (LOTOFACIL_CONFIG.PRIME_NUMBERS.includes(n)) drawPrimes++;
    });

    totalEven += drawEven;
    totalOdd += drawOdd;
    totalSum += drawSum;
    sums.push(drawSum);
    primeCountMap[drawPrimes] = (primeCountMap[drawPrimes] || 0) + 1;

    if (idx > 0) {
      const prevNumbers = new Set(draws[idx - 1].numbers);
      const repeatCount = draw.numbers.filter(n => prevNumbers.has(n)).length;
      repeats.push(repeatCount);
    }
  });

  const avg = totalSum / draws.length;

  // Cálculo de Desvio Padrão
  const variance = sums.reduce((acc, s) => acc + Math.pow(s - avg, 2), 0) / draws.length;
  const stdDev = Math.sqrt(variance);

  // Cálculo de Mediana
  const sortedSums = [...sums].sort((a, b) => a - b);
  const mid = Math.floor(sortedSums.length / 2);
  const median = sortedSums.length % 2 !== 0 
    ? sortedSums[mid] 
    : (sortedSums[mid - 1] + sortedSums[mid]) / 2;

  // Cálculo de Moda
  const sumFreq: Record<number, number> = {};
  let maxFreq = 0;
  sums.forEach(s => {
    sumFreq[s] = (sumFreq[s] || 0) + 1;
    if (sumFreq[s] > maxFreq) maxFreq = sumFreq[s];
  });
  const mode = Object.keys(sumFreq)
    .filter(s => sumFreq[Number(s)] === maxFreq)
    .map(Number);

  const duplicates: DuplicateEntry[] = [];
  combinationsMap.forEach((concursos, comboStr) => {
    if (concursos.length > 1) {
      duplicates.push({
        numbers: comboStr.split(',').map(Number),
        concursos: concursos
      });
    }
  });

  return {
    frequency,
    parity: { even: totalEven / draws.length, odd: totalOdd / draws.length },
    sumAvg: avg,
    sumStdDev: stdDev,
    sumMedian: median,
    sumMode: mode,
    primeCount: primeCountMap,
    repeatsFromPrevious: repeats,
    duplicates
  };
};
