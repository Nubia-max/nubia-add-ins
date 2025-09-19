// Section parsers and validation utilities

/**
 * Extract a tagged block from text using XML-like tags
 * @param {string} text - The text to search in
 * @param {string} tag - The tag name to search for
 * @returns {string} - The content inside the tags or empty string
 */
function extractTaggedBlock(text, tag) {
  if (!text || !tag) return '';

  // Try square bracket tags first (current DeepSeek format)
  let startTag = `[${tag}]`;
  let endTag = `[/${tag}]`;

  let startIndex = text.indexOf(startTag);
  if (startIndex !== -1) {
    const contentStart = startIndex + startTag.length;
    const endIndex = text.indexOf(endTag, contentStart);
    if (endIndex !== -1) {
      return text.substring(contentStart, endIndex).trim();
    }
  }

  // Fallback to angle bracket tags (legacy format)
  startTag = `<${tag}>`;
  endTag = `</${tag}>`;

  startIndex = text.indexOf(startTag);
  if (startIndex === -1) return '';

  const contentStart = startIndex + startTag.length;
  const endIndex = text.indexOf(endTag, contentStart);
  if (endIndex === -1) return '';

  return text.substring(contentStart, endIndex).trim();
}

/**
 * Safely parse JSON with error handling
 * @param {string} jsonString - The JSON string to parse
 * @returns {object|null} - Parsed object or null if invalid
 */
function safeParseJSON(jsonString) {
  try {
    if (!jsonString || typeof jsonString !== 'string') {
      return null;
    }

    // Clean up common JSON formatting issues
    const cleaned = jsonString.trim()
      .replace(/^```json\s*/, '') // Remove markdown code blocks
      .replace(/\s*```$/, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '');

    return JSON.parse(cleaned);
  } catch (error) {
    console.error('JSON parsing error:', error.message);
    return null;
  }
}

/**
 * Validate Excel structure object
 * @param {object} structure - The Excel structure to validate
 * @returns {object} - Validation result with success and error properties
 */
function validateExcelStructure(structure) {
  try {
    if (!structure || typeof structure !== 'object') {
      return { success: false, error: 'Structure must be an object' };
    }

    // Check for required top-level properties
    if (!structure.workbook || !Array.isArray(structure.workbook)) {
      return { success: false, error: 'Structure must have a workbook array' };
    }

    if (!structure.meta || typeof structure.meta !== 'object') {
      return { success: false, error: 'Structure must have a meta object' };
    }

    // Validate each worksheet
    for (let i = 0; i < structure.workbook.length; i++) {
      const worksheet = structure.workbook[i];

      if (!worksheet.name || typeof worksheet.name !== 'string') {
        return { success: false, error: `Worksheet ${i} must have a name` };
      }

      if (!worksheet.data || !Array.isArray(worksheet.data)) {
        return { success: false, error: `Worksheet ${i} must have a data array` };
      }

      // Validate data rows
      for (let j = 0; j < worksheet.data.length; j++) {
        const row = worksheet.data[j];
        if (!Array.isArray(row)) {
          return { success: false, error: `Worksheet ${i}, row ${j} must be an array` };
        }
      }
    }

    // Validate meta properties
    const requiredMetaFields = ['title', 'summary', 'mode'];
    for (const field of requiredMetaFields) {
      if (!structure.meta[field]) {
        return { success: false, error: `Meta must have ${field} property` };
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: `Validation error: ${error.message}` };
  }
}

module.exports = {
  extractTaggedBlock,
  safeParseJSON,
  validateExcelStructure
};