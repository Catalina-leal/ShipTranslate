import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { uploadEdiFile } from '../services/api.js';

// Pantalla que reconstruye/genera el archivo EDI descargable desde datos parseados o editados.
// Aqui se conservan rutas, BLs, fechas, contenedores y cambios realizados por el usuario.

function getOriginalContent(payload) {
  return payload?.originalContent || payload?.ediPayload?.originalContent || '';
}

function getMessageList(parsedData) {
  // Normaliza la entrada para trabajar siempre con una lista de mensajes.
  if (Array.isArray(parsedData)) return parsedData;
  if (parsedData?.ediMessages) return parsedData.ediMessages;
  return parsedData ? [parsedData] : [];
}

function getSelectedTransport(message) {
  // Selecciona el transporte principal usando el TDT de mayor etapa.
  const routes = Array.isArray(message?.transport?.routes)
    ? message.transport.routes
    : [];

  const targetRoute = routes.reduce((best, route) => {
    const currentStage = parseInt(route?.stage, 10);
    const bestStage = parseInt(best?.stage, 10);

    if (!best) return route;
    if (Number.isNaN(currentStage)) return best;
    if (Number.isNaN(bestStage) || currentStage > bestStage) return route;
    return best;
  }, null);

  return {
    stage: targetRoute?.stage || '',
    vessel:
      message?.transport?.selectedVessel ||
      message?.transport?.vessel ||
      targetRoute?.vessel ||
      '',
    lloyd:
      message?.transport?.selectedLloyd ||
      message?.transport?.lloyd ||
      message?.transport?.loyd ||
      targetRoute?.lloyd ||
      '',
    voyage:
      message?.transport?.selectedVoyage ||
      message?.transport?.voyage ||
      targetRoute?.voyage ||
      '',
  };
}

function getTargetTdtIndexes(segments, messages) {
  // Ubica dentro del EDI original que TDT corresponde a cada mensaje,
  // para actualizar el tramo correcto al exportar.
  const tdtByMessage = [];
  let messageIndex = -1;

  segments.forEach((segment, segmentIndex) => {
    if (segment.startsWith('UNH+')) {
      messageIndex += 1;
      tdtByMessage[messageIndex] = [];
    }

    if (messageIndex < 0 || !segment.startsWith('TDT+')) return;

    const parts = segment.split('+');
    tdtByMessage[messageIndex].push({
      index: segmentIndex,
      stage: parts[1] || '',
    });
  });

  return tdtByMessage
    .map((tdts, index) => {
      if (!tdts || tdts.length === 0) return null;

      const selected = getSelectedTransport(messages[index]);

      if (selected.stage) {
        const matchingStage = tdts.find((tdt) => tdt.stage === selected.stage);
        if (matchingStage) return matchingStage.index;
      }

      const highestStage = tdts.reduce((best, tdt) => {
        const currentStage = parseInt(tdt.stage, 10);
        const bestStage = parseInt(best?.stage, 10);

        if (!best) return tdt;
        if (Number.isNaN(currentStage)) return best;
        if (Number.isNaN(bestStage) || currentStage > bestStage) return tdt;
        return best;
      }, null);

      return highestStage?.index || tdts[tdts.length - 1].index;
    })
    .filter((index) => index !== null);
}

function updateTdtSegment(segment, message) {
  const selected = getSelectedTransport(message);

  if (!selected.vessel && !selected.lloyd && !selected.voyage) {
    return segment;
  }

  const parts = segment.split('+');

  if (selected.voyage) {
    parts[2] = selected.voyage;
  }

  while (parts.length <= 8) {
    parts.push('');
  }

  const vesselInfo = parts[8] || '';
  const [existingLloyd, existingVessel] = vesselInfo.includes(':::')
    ? vesselInfo.split(':::')
    : ['', vesselInfo.split(':').pop() || ''];

  const lloyd = selected.lloyd || existingLloyd || '';
  const vessel = selected.vessel || existingVessel || '';

  if (vessel) {
    parts[8] = lloyd ? `${lloyd}:::${vessel}` : vessel;
  }

  return parts.join('+');
}

function buildEdiFromOriginal(originalContent, messages) {
  const segments = originalContent
    .replace(/\r/g, '')
    .split("'")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const targetIndexes = new Set(getTargetTdtIndexes(segments, messages));
  let messageIndex = -1;

  const updatedSegments = segments.map((segment, index) => {
    if (segment.startsWith('UNH+')) {
      messageIndex += 1;
    }

    if (targetIndexes.has(index)) {
      return updateTdtSegment(segment, messages[messageIndex]);
    }

    return segment;
  });

  return `${updatedSegments.map((segment) => `${segment}'`).join('\n')}\n`;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function sanitizeEdiValue(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/'/g, ' ')
    .replace(/\+/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toDateStamp(value) {
  if (!value) return '';

  const raw = String(value).trim();

  if (/^\d{8}$/.test(raw)) return raw;
  if (/^\d{12}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) return '';

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  const hh = String(parsed.getHours()).padStart(2, '0');
  const min = String(parsed.getMinutes()).padStart(2, '0');

  if (hh !== '00' || min !== '00') {
    return `${yyyy}${mm}${dd}${hh}${min}`;
  }

  return `${yyyy}${mm}${dd}`;
}

function splitFreeText(value, size = 320) {
  const text = sanitizeEdiValue(value);
  if (!text) return [];

  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function getContainerNumber(container) {
  if (typeof container === 'string') return sanitizeEdiValue(container);
  return sanitizeEdiValue(
    container?.number ||
      container?.containerNumber ||
      container?.id ||
      container?.container ||
      ''
  );
}

function getContainerSealList(container) {
  if (!container || typeof container === 'string') return [];

  return [
    ...asArray(container.seals),
    ...asArray(container.seal),
  ]
    .map((seal) =>
      typeof seal === 'object'
        ? seal.number || seal.id || seal.value || ''
        : seal
    )
    .map(sanitizeEdiValue)
    .filter(Boolean);
}

function addSegment(segments, value) {
  const segment = String(value || '')
    .replace(/'/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim();
  if (segment) segments.push(segment);
}

function buildEdiFromPdfData(pdfData, options) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const interchangeDate = `${yy}${mm}${dd}:${hh}${min}`;
  const documentDate = toDateStamp(pdfData.documentDate) || `${yyyy}${mm}${dd}`;
  const controlRef = `${dd}${mm}${yy}${hh}${min}`;
  const senderCode = sanitizeEdiValue(options.sender || pdfData.carrier || 'PDF');
  const receiverCode = sanitizeEdiValue(options.receiver || 'AGUNSA');
  const blNumber = sanitizeEdiValue(
    pdfData.blNumber ||
      pdfData.bookingNumber ||
      `PDF${controlRef}`
  );
  const bookingNumber = sanitizeEdiValue(pdfData.bookingNumber);
  const documentType = sanitizeEdiValue(options.documentType || 'MBL');
  const containers = asArray(pdfData.containers);
  const segments = [];

  addSegment(segments, 'UNH+1+IFTMCS:D:00B:UN');
  addSegment(segments, `BGM+707+${blNumber}+9`);
  addSegment(segments, `DTM+342:${documentDate}:102`);
  addSegment(segments, 'TSR+30+2');

  addSegment(segments, `RFF+BM:${blNumber}`);
  if (bookingNumber) addSegment(segments, `RFF+BN:${bookingNumber}`);
  addSegment(segments, `RFF+DOC:${documentType}`);

  asArray(pdfData.references).forEach((reference, index) => {
    const value =
      typeof reference === 'object'
        ? reference.value || reference.number || reference.reference || ''
        : reference;
    const qualifier =
      typeof reference === 'object'
        ? reference.type || reference.qualifier || `REF${index + 1}`
        : `REF${index + 1}`;

    if (value) {
      addSegment(
        segments,
        `RFF+${sanitizeEdiValue(qualifier)}:${sanitizeEdiValue(value)}`
      );
    }
  });

  const origin = sanitizeEdiValue(pdfData.origin);
  const destination = sanitizeEdiValue(pdfData.destination);
  const portOfLoading = sanitizeEdiValue(pdfData.portOfLoading || origin);
  const portOfDischarge = sanitizeEdiValue(pdfData.portOfDischarge || destination);
  const transshipment = sanitizeEdiValue(pdfData.transshipment);

  if (destination) addSegment(segments, `LOC+7+${destination}`);
  if (origin) addSegment(segments, `LOC+88+${origin}`);
  if (portOfLoading) addSegment(segments, `LOC+76+${portOfLoading}`);
  if (portOfDischarge) addSegment(segments, `LOC+170+${portOfDischarge}`);
  if (transshipment) addSegment(segments, `LOC+13+${transshipment}`);

  asArray(pdfData.places).forEach((place, index) => {
    const placeValue =
      typeof place === 'object'
        ? place.name || place.value || place.location || ''
        : place;
    if (placeValue) addSegment(segments, `LOC+ZZ${index + 1}+${sanitizeEdiValue(placeValue)}`);
  });

  if (pdfData.freightCondition) {
    addSegment(segments, `TOD+5+${sanitizeEdiValue(pdfData.freightCondition)}`);
  }
  if (pdfData.incoterm) {
    addSegment(segments, `TOD+1+${sanitizeEdiValue(pdfData.incoterm)}`);
  }

  const voyage = sanitizeEdiValue(pdfData.voyage);
  const carrier = sanitizeEdiValue(pdfData.carrier);
  const lloyd = sanitizeEdiValue(pdfData.lloyd);
  const vessel = sanitizeEdiValue(pdfData.vessel);
  const vesselInfo = vessel ? `${lloyd ? `${lloyd}:::` : ''}${vessel}` : '';

  if (voyage || carrier || vesselInfo) {
    addSegment(segments, `TDT+20+${voyage}+++${carrier}+++${vesselInfo}`);
  }

  if (portOfLoading) addSegment(segments, `LOC+9+${portOfLoading}`);
  if (pdfData.etd) addSegment(segments, `DTM+133:${toDateStamp(pdfData.etd)}:102`);
  if (portOfDischarge) addSegment(segments, `LOC+11+${portOfDischarge}`);
  if (pdfData.eta) addSegment(segments, `DTM+132:${toDateStamp(pdfData.eta)}:102`);

  if (pdfData.shipper) addSegment(segments, `NAD+CZ+++${sanitizeEdiValue(pdfData.shipper)}`);
  if (pdfData.consignee) addSegment(segments, `NAD+CN+++${sanitizeEdiValue(pdfData.consignee)}`);
  if (pdfData.notify) addSegment(segments, `NAD+N1+++${sanitizeEdiValue(pdfData.notify)}`);

  const packages = sanitizeEdiValue(pdfData.packages) || '1';
  const packageType = sanitizeEdiValue(pdfData.packageType);
  addSegment(segments, `GID+${packages}+${packageType}`);
  if (pdfData.hsCode) addSegment(segments, `PIA+5+${sanitizeEdiValue(pdfData.hsCode)}:HS`);

  splitFreeText(pdfData.cargoDescription).forEach((chunk) => {
    addSegment(segments, `FTX+AAA+++${chunk}`);
  });

  splitFreeText(pdfData.marks).forEach((chunk) => {
    addSegment(segments, `PCI++${chunk}`);
  });

  if (pdfData.grossWeight) addSegment(segments, `MEA+AAE+G+KGM:${sanitizeEdiValue(pdfData.grossWeight)}`);
  if (pdfData.netWeight) addSegment(segments, `MEA+AAE+N+KGM:${sanitizeEdiValue(pdfData.netWeight)}`);
  if (pdfData.volume) addSegment(segments, `MEA+AAE+AAW+MTQ:${sanitizeEdiValue(pdfData.volume)}`);

  containers.forEach((container) => {
    const number = getContainerNumber(container);
    if (!number) return;

    const type =
      typeof container === 'object'
        ? sanitizeEdiValue(container.type || container.sizeType || container.equipmentType)
        : '';
    const quantity =
      typeof container === 'object'
        ? sanitizeEdiValue(container.packages || container.packageQuantity)
        : '';
    const movementType =
      typeof container === 'object'
        ? sanitizeEdiValue(container.movementType)
        : '';

    addSegment(segments, `SGP+${number}+${quantity || packages}`);
    addSegment(segments, `EQD+CN+${number}+${type}`);
    if (movementType) addSegment(segments, `TMD+${movementType}`);

    getContainerSealList(container).forEach((seal) => {
      addSegment(segments, `SEL+${seal}`);
    });

    if (typeof container === 'object') {
      if (container.grossWeight) addSegment(segments, `MEA+AAE+G+KGM:${sanitizeEdiValue(container.grossWeight)}`);
      if (container.netWeight) addSegment(segments, `MEA+AAE+N+KGM:${sanitizeEdiValue(container.netWeight)}`);
      if (container.volume) addSegment(segments, `MEA+AAE+AAW+MTQ:${sanitizeEdiValue(container.volume)}`);
      if (container.temperature) addSegment(segments, `TMP+1+${sanitizeEdiValue(container.temperature)}:CEL`);
      if (container.imoClass || container.unNumber) {
        addSegment(segments, `DGS+IMD+${sanitizeEdiValue(container.imoClass)}+${sanitizeEdiValue(container.unNumber)}`);
      }
    }
  });

  asArray(pdfData.charges).forEach((charge) => {
    if (!charge) return;

    if (typeof charge === 'string') {
      addSegment(segments, `FTX+PRI+++${charge}`);
      return;
    }

    const type = sanitizeEdiValue(charge.type || charge.code || 'CHARGE');
    const currency = sanitizeEdiValue(charge.currency);
    const amount = sanitizeEdiValue(charge.amount || charge.totalAmount || charge.value);
    const quantity = sanitizeEdiValue(charge.quantity);

    addSegment(segments, `TCC+${type}`);
    if (currency) addSegment(segments, `CUX+2:${currency}`);
    if (amount) addSegment(segments, `MOA+203+${amount}`);
    if (quantity) addSegment(segments, `QTY+${quantity}`);
  });

  if (pdfData.freight) addSegment(segments, `FTX+PRI+++${pdfData.freight}`);

  asArray(pdfData.remarks).forEach((remark) => {
    splitFreeText(remark).forEach((chunk) => addSegment(segments, `FTX+AAI+++${chunk}`));
  });

  splitFreeText(pdfData.rawText, 420).forEach((chunk, index) => {
    addSegment(segments, `FTX+ZZZ+++PDF RAW ${index + 1}: ${chunk}`);
  });

  const untCount = segments.length + 1;

  return [
    `UNB+UNOA:2+${senderCode}+${receiverCode}+${interchangeDate}+${controlRef}'`,
    ...segments.map((segment) => `${segment}'`),
    `UNT+${untCount}+1'`,
    `UNZ+1+${controlRef}'`,
    '',
  ].join('\n');
}

function buildGeneratedEdiFileName(pdfData) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const bl = sanitizeEdiValue(pdfData?.blNumber || pdfData?.bookingNumber || 'pdf');

  return `edi_pdf_${bl}_${dd}${mm}${yy}.txt`;
}

function ConvertToEdiPage() {

  const location = useLocation();
  const navigate = useNavigate();

  const pdfData = location.state?.pdfData || {};
  const parsedData = location.state?.parsedData || null;
  const ediPayload = location.state?.ediPayload || location.state?.shipment || null;
  const sourceFile = location.state?.file || null;

  const [selectedType, setSelectedType] =
    useState('');

  const [lastEdi, setLastEdi] =
    useState('');

  const [sender, setSender] =
    useState(pdfData.carrier || '');

  const [receiver, setReceiver] =
    useState('AGUNSA');

  const ediOptions = [
    {
      code: 'MBL',
      title: 'Master Bill of Lading',
      description:
        'Documento principal emitido por la naviera.',
    },
    {
      code: 'HBL',
      title: 'House Bill of Lading',
      description:
        'Documento emitido por freight forwarders.',
    },
    {
      code: 'NBL',
      title: 'Nieto Bill of Lading',
      description:
        'Subnivel documental asociado al HBL.',
    },
    {
      code: 'BNBL',
      title: 'BisNieto Bill of Lading',
      description:
        'Nivel documental adicional para consolidaciones.',
    },
  ];

  let shipmentData;

  function getLocationText(message, field) {
    const value = message?.locations?.[field] || message?.[field] || '';

    if (!value) return '';

    if (typeof value === 'string') {
      const parts = value.split(':::');
      return parts[1] || parts[0] || '';
    }

    return value.name || value.code || '';
  }

  function getMessageEta(message) {
    const finalRoute = message?.transport?.routes
      ?.slice()
      ?.sort((a, b) => (parseInt(b.stage, 10) || 0) - (parseInt(a.stage, 10) || 0))
      ?.[0];

    return (
      message?.transport?.selectedETA ||
      finalRoute?.arrival?.eta ||
      message?.dates?.eta ||
      ''
    );
  }

  function formatSummaryDate(value) {
    if (!value) return '';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) return value;

    return parsed.toLocaleDateString();
  }

  if (
    Array.isArray(parsedData) &&
    parsedData.length > 1
  ) {

    const totalBls = parsedData.length;

    const unique = (arr) => [
      ...new Set(arr.filter(Boolean)),
    ];

    const origins = unique(
      parsedData.map((p) => getLocationText(p, 'origin'))
    );

    const destinations = unique(
      parsedData.map((p) => getLocationText(p, 'destination'))
    );

    const etas = unique(
      parsedData
        .map((p) => getMessageEta(p))
        .filter(Boolean)
        .map(formatSummaryDate)
    );

    const lloyds = unique(
      parsedData.map(
        (p) =>
          p.transport?.selectedLloyd ||
          p.transport?.lloyd ||
          p.transport?.loyd
      )
    );

    const vessels = unique(
      parsedData.map(
        (p) =>
          p.transport?.selectedVessel ||
          p.transport?.vessel
      )
    );

    shipmentData = {
      bl: `Total: ${totalBls}`,
      origin: origins.join(', ') || '-',
      destination:
        destinations.join(', ') || '-',
      eta:
        etas.length === 0
          ? '-'
          : etas.length === 1
          ? etas[0]
          : `${etas[0]} - ${
              etas[etas.length - 1]
            }`,
      transshipment: '-',
      lloyd: lloyds.join(', ') || '-',
      vessel: vessels.join(', ') || '-',
      containers: parsedData.reduce(
        (sum, p) =>
          sum +
          (Array.isArray(p.containers)
            ? p.containers.length
            : p.containers || 0),
        0
      ),
    };

  } else {
    const firstMessage = getMessageList(parsedData)[0] || {};

    shipmentData = {
      bl:
        pdfData.blNumber ||
        firstMessage.referenceNumber ||
        firstMessage.documentNumber ||
        '-',
      origin:
        pdfData.origin ||
        getLocationText(firstMessage, 'origin') ||
        '-',
      destination:
        pdfData.destination ||
        getLocationText(firstMessage, 'destination') ||
        '-',
      eta:
        pdfData.eta ||
        formatSummaryDate(getMessageEta(firstMessage)) ||
        '-',
      transshipment:
        pdfData.transshipment ||
        'Panamá',
      lloyd:
        pdfData.lloyd ||
        firstMessage.transport?.selectedLloyd ||
        firstMessage.transport?.lloyd ||
        firstMessage.transport?.loyd ||
        pdfData.carrier ||
        '-',
      vessel:
        pdfData.vessel ||
        firstMessage.transport?.selectedVessel ||
        firstMessage.transport?.vessel ||
        '-',
      containers:
        Array.isArray(
          pdfData.containers
        )
          ? pdfData.containers.length
          : pdfData.containers ||
            (Array.isArray(firstMessage.containers)
              ? firstMessage.containers.length
              : 0),
    };

  }

  async function handleConvert() {
    const sourceOriginalContent =
      getOriginalContent(ediPayload) ||
      (sourceFile && typeof sourceFile.text === 'function'
        ? await sourceFile.text()
        : '');

    const messages = getMessageList(parsedData);

    if (sourceOriginalContent && messages.length > 0) {
      const edi = buildEdiFromOriginal(sourceOriginalContent, messages);
      downloadEdi(edi);
      return;
    }

    if (pdfData && Object.keys(pdfData).length > 0) {
      const edi = buildEdiFromPdfData(pdfData, {
        sender,
        receiver,
        documentType: selectedType || 'MBL',
      });

      const generatedFileName = buildGeneratedEdiFileName(pdfData);
      const generatedFile = new File(
        [edi],
        generatedFileName,
        {
          type: 'text/plain;charset=utf-8',
        }
      );

      try {
        await uploadEdiFile(generatedFile);
      } catch (saveError) {
        console.error(saveError);
        alert(
          'No se pudo registrar el EDI generado en el histórico.'
        );
        return;
      }

      downloadEdi(edi);
      return;
    }

    if (!selectedType) {
      alert(
        'Selecciona un tipo de BL'
      );
      return;
    }

    if (!sender.trim()) {
      alert(
        'Ingresa el emisor'
      );
      return;
    }

    if (!receiver.trim()) {
      alert(
        'Ingresa el receptor'
      );
      return;
    }

    const now = new Date();

    const year = String(
      now.getFullYear()
    ).slice(2);

    const mm = String(
      now.getMonth() + 1
    ).padStart(2, '0');

    const dd = String(
      now.getDate()
    ).padStart(2, '0');

    const hh = String(
      now.getHours()
    ).padStart(2, '0');

    const min = String(
      now.getMinutes()
    ).padStart(2, '0');

    const dateStamp =
      `${year}${mm}${dd}:${hh}${min}`;

    if (
      !messages ||
      messages.length === 0
    ) {
      alert(
        'No hay mensajes EDI para convertir'
      );
      return;
    }

    let edi = '';

    edi +=
      `UNB+UNOA:1+${sender}+${receiver}+${dateStamp}+0001'\n`;

    messages.forEach((m, i) => {

      const msgId =
        m.messageId ||
        `MSG${i + 1}`;

      const segments = [];

      segments.push(
        `UNH+${msgId}+CONTRL`
      );

      const bl =
        m.referenceNumber ||
        m.documentNumber ||
        `BL${i + 1}`;

      segments.push(
        `BGM+${bl}+${bl}+9`
      );

      const origin =
        (m.locations &&
          (m.locations.origin.name ||
            m.locations.origin.code)) ||
        m.origin ||
        '';

      const destination =
        (m.locations &&
          (m.locations.destination.name ||
            m.locations.destination.code)) ||
        m.destination ||
        '';

      if (origin)
        segments.push(
          `LOC+88+${origin}`
        );

      if (destination)
        segments.push(
          `LOC+7+${destination}`
        );

      const eta =
        m.dates?.eta ||
        m.transport?.selectedETA ||
        null;

      if (eta) {

        const d = new Date(eta);

        if (
          !Number.isNaN(
            d.valueOf()
          )
        ) {

          const yyyy =
            d.getFullYear();

          const mm2 = String(
            d.getMonth() + 1
          ).padStart(2, '0');

          const dd2 = String(
            d.getDate()
          ).padStart(2, '0');

          segments.push(
            `DTM+132:${yyyy}${mm2}${dd2}:102`
          );

        }
      }

      const vessel =
        m.transport
          ?.selectedVessel ||
        m.transport?.vessel ||
        '';

      const lloyd =
        m.transport
          ?.selectedLloyd ||
        m.transport?.loyd ||
        '';

      const voyage =
        m.transport
          ?.selectedVoyage ||
        m.transport?.voyage ||
        '';

      if (
        vessel ||
        lloyd ||
        voyage
      ) {

        segments.push(
          `TDT+1+${voyage}+++${lloyd}::${vessel}`
        );

      }

      if (
        Array.isArray(
          m.containers
        ) &&
        m.containers.length
      ) {

        m.containers.forEach(
          (c) => {

            segments.push(
              `EQD+CN+${c.number}+${c.type || ''}`
            );

          }
        );
      }

      const segmentCount =
        segments.length + 1;

      edi +=
        segments
          .map(
            (s) => s + "'\n"
          )
          .join('') +
        `UNT+${segmentCount}+${msgId}'\n`;

    });

    edi +=
      `UNZ+${messages.length}+0001'\n`;

    downloadEdi(edi);
  }

  function downloadEdi(edi) {
    setLastEdi(edi);

    const now = new Date();
    const year = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const blob = new Blob(
      [edi],
      {
        type:
          'text/plain;charset=utf-8',
      }
    );

    const fileName =
      `edi_export_${dd}${mm}${year}.txt`;

    const link =
      document.createElement('a');

    link.href =
      URL.createObjectURL(blob);

    link.download = fileName;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();
    URL.revokeObjectURL(link.href);

    alert(
      `EDI generado y descargado: ${fileName}`
    );

    navigate('/');
  }

  return (

    <section className="convert-page">

      <div className="home-background-gradient" />

      <div className="convert-container">

        {/* HEADER */}

        <div className="convert-hero">

          <div className="hero-badge">
            <span className="badge-dot" />
            Generación automática EDI
          </div>

          <h1 className="hero-title">
            Conversión a{' '}
            <span className="hero-title-accent">
              EDI
            </span>
          </h1>

          <p className="hero-description">
            Revisa la información
            extraída, define el tipo
            de estructura y genera
            automáticamente el
            archivo EDI listo para
            intercambio documental.
          </p>

        </div>

        {/* SUMMARY */}

        <div className="convert-card">

          <div className="convert-card-header">

            <div>

              <h2>
                Resumen del BL
              </h2>

              <p>
                Datos detectados
                desde el documento.
              </p>

            </div>

            <span className="summary-badge">
              {
                Array.isArray(
                  parsedData
                )
                  ? `${parsedData.length} BL`
                  : '1 BL'
              }
            </span>

          </div>

          <div className="convert-grid">

            <div className="convert-item">
              <strong>BL</strong>
              <span>
                {shipmentData.bl}
              </span>
            </div>

            <div className="convert-item">
              <strong>Origen</strong>
              <span>
                {
                  shipmentData.origin
                }
              </span>
            </div>

            <div className="convert-item">
              <strong>Destino</strong>
              <span>
                {
                  shipmentData.destination
                }
              </span>
            </div>

            <div className="convert-item">
              <strong>ETA</strong>
              <span>
                {shipmentData.eta}
              </span>
            </div>

            <div className="convert-item">
              <strong>Buque</strong>
              <span>
                {
                  shipmentData.vessel
                }
              </span>
            </div>

            <div className="convert-item">
              <strong>Lloyd</strong>
              <span>
                {
                  shipmentData.lloyd
                }
              </span>
            </div>

          </div>

        </div>

        {/* SENDER / RECEIVER */}

        <div className="convert-card">

          <div className="convert-card-header">

            <div>

              <h2>
                Intercambio EDI
              </h2>

              <p>
                Define las partes del
                intercambio UNB.
              </p>

            </div>

          </div>

          <div className="edi-form-grid">

            <div className="edi-input-group">

              <label>
                Emisor
              </label>

              <input
                type="text"
                value={sender}
                onChange={(e) =>
                  setSender(
                    e.target.value
                  )
                }
                placeholder="Ej: MSC"
                className="edi-input"
              />

            </div>

            <div className="edi-input-group">

              <label>
                Receptor
              </label>

              <input
                type="text"
                value={receiver}
                onChange={(e) =>
                  setReceiver(
                    e.target.value
                  )
                }
                placeholder="Ej: AGUNSA"
                className="edi-input"
              />

            </div>

          </div>

        </div>

        {/* TYPES */}

        <div className="convert-card">

          <div className="convert-card-header">

            <div>

              <h2>
                Tipo de estructura
              </h2>

              <p>
                Selecciona el formato
                documental EDI.
              </p>

            </div>

          </div>

          <div className="edi-options-grid">

            {ediOptions.map(
              (option) => (

                <button
                  key={option.code}
                  type="button"
                  className={`edi-modern-option ${
                    selectedType ===
                    option.code
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    setSelectedType(
                      option.code
                    )
                  }
                >

                  <div className="edi-modern-code">
                    {option.code}
                  </div>

                  <div className="edi-modern-info">

                    <h3>
                      {
                        option.title
                      }
                    </h3>

                    <p>
                      {
                        option.description
                      }
                    </p>

                  </div>

                </button>

              )
            )}

          </div>

        </div>

        {/* ACTIONS */}

        <div className="convert-actions">

          <button
            className="btn-primary-hero"
            onClick={handleConvert}
          >

            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 16 12 12 8 16"/>
              <line
                x1="12"
                y1="12"
                x2="12"
                y2="21"
              />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>

            Generar EDI

          </button>

        </div>

        {/* PREVIEW */}

        {lastEdi && (

          <div className="convert-card">

            <div className="convert-card-header">

              <div>

                <h2>
                  Vista previa EDI
                </h2>

                <p>
                  Resultado generado
                  automáticamente.
                </p>

              </div>

            </div>

            <pre className="edi-preview-box">
              {lastEdi}
            </pre>

          </div>

        )}

      </div>

    </section>

  );
}

export default ConvertToEdiPage;
