const incidentMemory = [];

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function findSimilarIncident(errorLog) {
  const normalizedInput = normalizeText(errorLog);

  if (!normalizedInput) {
    return null;
  }

  return (
    incidentMemory.find((item) => item.normalizedError === normalizedInput) ||
    incidentMemory.find((item) => normalizedInput.includes(item.normalizedError)) ||
    null
  );
}

export function saveIncident(errorLog, solution, source) {
  const normalizedError = normalizeText(errorLog);

  if (!normalizedError) {
    return null;
  }

  const record = {
    id: incidentMemory.length + 1,
    errorLog,
    normalizedError,
    solution,
    source,
    createdAt: new Date().toISOString()
  };

  incidentMemory.unshift(record);
  return record;
}

export function getMemoryStats() {
  return {
    totalIncidents: incidentMemory.length
  };
}
