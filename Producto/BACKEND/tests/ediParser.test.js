import { describe, expect, it } from 'vitest';
import { parseEdiContent } from '../src/controllers/shipmentsController.js';

describe('parseEdiContent', () => {
  it('extrae los datos principales de un mensaje EDI', () => {
    const edi = [
      'UNB+UNOA:2+YML+AGUNSA+260520:1200+CTRL001',
      'UNH+1+IFTMCS:D:99B:UN',
      'BGM+710+BL001',
      'RFF+BM:REF001',
      'NAD+CZ++SHIPPER SPA',
      'NAD+CN++CONSIGNEE LTDA',
      'NAD+N1++NOTIFY SA',
      'LOC+9+CNBAY:BAYUQUAN',
      'LOC+11+CLVAP:VALPARAISO',
      'GID+48+COILS',
      'FTX+AAA+++PRIME HOT ROLLED STEEL',
      'MEA+AAE+G+KGM:396360',
      'UNT+11+1',
      'UNZ+1+CTRL001',
    ].join("'");

    const result = parseEdiContent(edi, 'carga.edi');
    const message = result.ediMessages[0];

    expect(result.interchange).toMatchObject({
      sender: 'YANG MING',
      receiver: 'AGUNSA',
      interchangeId: 'CTRL001',
      totalMessages: 1,
    });
    expect(message.documentNumber).toBe('BL001');
    expect(message.referenceNumber).toBe('REF001');
    expect(message.parties).toEqual({
      shipper: 'SHIPPER SPA',
      consignee: 'CONSIGNEE LTDA',
      notify: 'NOTIFY SA',
    });
    expect(message.locations.portOfLoading).toEqual({
      code: 'CNBAY',
      name: 'BAYUQUAN',
    });
    expect(message.locations.portOfDischarge.name).toBe('VALPARAISO');
    expect(message.goods).toMatchObject({
      packages: 48,
      packageType: 'COILS',
      description: 'PRIME HOT ROLLED STEEL',
      grossWeight: 396360,
    });
  });

  it('selecciona la ETA del TDT con la etapa numericamente mayor', () => {
    const edi = [
      'UNB+UNOA:2+YML+AGUNSA+260520:1200+CTRL002',
      'UNH+1+IFTMCS:D:99B:UN',
      'BGM+710+BL002',
      'TDT+20+V20++++++1111111:::VESSEL INICIAL',
      'DTM+132:20260701:102',
      'TDT+40+V40++++++2222222:::MOMI ARROW',
      'DTM+132:20260715:102',
      'UNT+6+1',
      'UNZ+1+CTRL002',
    ].join("'");

    const message = parseEdiContent(edi, 'eta.edi').ediMessages[0];

    expect(message.transport.selectedVoyage).toBe('V40');
    expect(message.transport.selectedVessel).toBe('MOMI ARROW');
    expect(message.summary.eta).toEqual(new Date(2026, 6, 15));
  });

  it('devuelve cero mensajes cuando no existe un bloque UNH', () => {
    const result = parseEdiContent("UNB+UNOA:2+YML+AGUNSA+260520:1200+CTRL003'UNZ+0+CTRL003'", 'vacio.edi');

    expect(result.ediMessages).toEqual([]);
    expect(result.interchange.totalMessages).toBe(0);
  });
});
