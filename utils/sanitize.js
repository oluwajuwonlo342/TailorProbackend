// Keys that belong to the record itself and must never come from typed measurement parts
const RESERVED_KEYS = [
  '_id', 'id', '__v', 'user', 'customer', 'subProfileId', 'targetType',
  'title', 'unit', 'gender', 'notes', 'recordedDate', 'createdAt', 'updatedAt',
  'measurementsData', 'values'
];

const MAX_KEY_LENGTH = 60;
const MAX_VALUE_LENGTH = 40;

const cleanText = (value, max = 80) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

// Returns a flat { "Bust": "36", ... } object containing only safe keys and plain values
const cleanMeasurementFields = (input) => {
  const result = {};

  const add = (rawKey, value) => {
    const key = String(rawKey)
      .trim()
      .replace(/\./g, '')   // dots break MongoDB field paths
      .replace(/^\$+/, ''); // a leading $ is a MongoDB operator
    if (!key || key.length > MAX_KEY_LENGTH || RESERVED_KEYS.includes(key)) return;

    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = value;
    } else if (typeof value === 'string' && value.trim() !== '') {
      result[key] = value.trim().slice(0, MAX_VALUE_LENGTH);
    }
  };

  Object.entries(input || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Older public form sent { "Gown": { "Bust": "36" } }: flatten to "Gown Bust"
      Object.entries(value).forEach(([innerKey, innerValue]) =>
        add(`${key} ${innerKey}`, innerValue)
      );
    } else {
      add(key, value);
    }
  });

  return result;
};

module.exports = { cleanMeasurementFields, cleanText, MAX_FIELDS: 60 };
