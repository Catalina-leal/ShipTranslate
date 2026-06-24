export const REQUIRED_SCANNED_FIELDS = new Set([
  'shipper',
  'consignee',
  'notify',
  'vessel',
  'portOfDischarge',
  'marks',
  'portOfLoading',
  'packagesSummary',
  'cargoDescription',
  'grossWeight',
]);

export const REQUIRED_TRAMP_FIELDS = new Set([
  'blNumber',
  'shipper',
  'consignee',
  'notifyParty',
  'oceanVessel',
  'voyageNo',
  'portOfLoading',
  'portOfDischarge',
  'marksNumbers',
  'packages',
  'packageType',
  'goodsDescription',
  'grossWeightKg',
  'placeOfIssue',
  'dateOfIssue',
]);

export function isRequiredFieldMissing(data, field, requiredFields) {
  return requiredFields.has(field) && !String(data?.[field] ?? '').trim();
}

export function hasMissingRequiredFields(data, requiredFields) {
  return [...requiredFields].some((field) =>
    isRequiredFieldMissing(data, field, requiredFields)
  );
}

export function hasMissingRequiredTrampFields(bls) {
  return bls.some((bl) => hasMissingRequiredFields(bl, REQUIRED_TRAMP_FIELDS));
}
