import { describe, expect, it } from 'vitest';
import {
  convertAnyMetricTonsToKilogramsText,
  findBestMetricTonWeight,
  formatBlIssueDate,
  metricTonsToKilograms,
  normalizeMetricTonWeightsInData,
} from '../src/routes/shipments.js';

describe('helpers de fechas BL', () => {
  it.each([
    ['Apr 20, 2026', '20-04-2026'],
    ['September 5, 2025', '05-09-2025'],
    ['PLACE: BAYUQUAN, CHINA Jan 1, 2027', '01-01-2027'],
  ])('convierte %s a formato numerico', (input, expected) => {
    expect(formatBlIssueDate(input)).toBe(expected);
  });

  it('devuelve vacio cuando no encuentra una fecha compatible', () => {
    expect(formatBlIssueDate('BAYUQUAN, CHINA')).toBe('');
  });
});

describe('helpers de peso', () => {
  it.each([
    ['48,030', '48030'],
    ['532.110', '532110'],
    ['0.5', '500'],
  ])('convierte %s toneladas metricas a kilogramos', (input, expected) => {
    expect(metricTonsToKilograms(input)).toBe(expected);
  });

  it('prioriza el peso bruto sobre el peso neto', () => {
    const text = 'TOTAL NET WEIGHT: 500.000 MT TOTAL GROSS WEIGHT: 532.110 MT';

    expect(findBestMetricTonWeight(text)).toBe('532.110');
  });

  it('convierte las variantes MT, M/T y metric tons conservando el texto', () => {
    const text = 'CARGO 48,030 MT; NET 2 M/T; EXTRA 1.5 METRIC TONS';

    expect(convertAnyMetricTonsToKilogramsText(text)).toBe(
      'CARGO 48030 KG; NET 2000 KG; EXTRA 1500 KG'
    );
  });

  it('normaliza pesos dentro de objetos y arreglos anidados', () => {
    const data = {
      grossWeight: '48,030 MT',
      bls: [{ goodsDescription: 'TOTAL NET WEIGHT: 532.110 M.T.' }],
      packages: 48,
    };

    expect(normalizeMetricTonWeightsInData(data)).toEqual({
      grossWeight: '48030 KG',
      bls: [{ goodsDescription: 'TOTAL NET WEIGHT: 532110 KG' }],
      packages: 48,
    });
  });
});
