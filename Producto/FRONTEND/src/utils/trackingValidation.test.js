import { describe, expect, it } from 'vitest';
import {
  REQUIRED_SCANNED_FIELDS,
  REQUIRED_TRAMP_FIELDS,
  hasMissingRequiredFields,
  hasMissingRequiredTrampFields,
  isRequiredFieldMissing,
} from './trackingValidation.js';

function completeData(requiredFields) {
  return Object.fromEntries([...requiredFields].map((field) => [field, 'dato']));
}

describe('validacion de BL escaneado', () => {
  it('acepta un BL con todos sus campos obligatorios', () => {
    expect(
      hasMissingRequiredFields(completeData(REQUIRED_SCANNED_FIELDS), REQUIRED_SCANNED_FIELDS)
    ).toBe(false);
  });

  it('detecta valores vacios o compuestos solo por espacios', () => {
    const bl = completeData(REQUIRED_SCANNED_FIELDS);
    bl.shipper = '   ';

    expect(isRequiredFieldMissing(bl, 'shipper', REQUIRED_SCANNED_FIELDS)).toBe(true);
    expect(hasMissingRequiredFields(bl, REQUIRED_SCANNED_FIELDS)).toBe(true);
  });

  it('no exige Freight payable at porque es opcional', () => {
    const bl = completeData(REQUIRED_SCANNED_FIELDS);
    bl.freightPayableAt = '';

    expect(hasMissingRequiredFields(bl, REQUIRED_SCANNED_FIELDS)).toBe(false);
  });
});

describe('validacion de BL tramp', () => {
  it('detecta un campo obligatorio faltante en cualquiera de los BL', () => {
    const firstBl = completeData(REQUIRED_TRAMP_FIELDS);
    const secondBl = completeData(REQUIRED_TRAMP_FIELDS);
    secondBl.dateOfIssue = '';

    expect(hasMissingRequiredTrampFields([firstBl, secondBl])).toBe(true);
  });

  it('mantiene Measurement y Prepaid at como campos opcionales', () => {
    const bl = {
      ...completeData(REQUIRED_TRAMP_FIELDS),
      measurement: '',
      prepaidAt: '',
    };

    expect(hasMissingRequiredTrampFields([bl])).toBe(false);
  });
});
