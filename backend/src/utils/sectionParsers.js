// src/utils/sectionParsers.js
// Robust section parsing for NUBIA Excel automation

function extractTaggedBlock(text, tag) {
  const start = new RegExp(`\\[${tag}\\]`, 'i');
  const end   = new RegExp(`\\[\\/${tag}\\]`, 'i');
  const s = text.search(start);
  const e = text.search(end);
  
  if (s === -1 || e === -1) {
    // Fallback detection for when GPT forgets tags
    if (tag === 'CHAT_RESPONSE') {
      // Look for conversational content before JSON
      const jsonStart = text.search(/\{[\s\S]*"worksheets"/i);
      if (jsonStart > 0) {
        return text.slice(0, jsonStart).trim();
      }
      // If no JSON found, return first paragraph
      const firstParagraph = text.split('\n\n')[0];
      return firstParagraph.length > 10 ? firstParagraph : 'Workbook created successfully.';
    }
    
    if (tag === 'EXCEL_DATA') {
      // Look for JSON object starting with worksheets
      const jsonMatch = text.match(/\{[\s\S]*"worksheets"[\s\S]*\}/i);
      return jsonMatch ? jsonMatch[0] : null;
    }
    
    return null;
  }
  
  const startMatch = text.match(start);
  const endMatch = text.match(end);
  if (!startMatch || !endMatch) return null;
  
  const startPos = s + startMatch[0].length;
  const endPos = text.indexOf(endMatch[0], startPos);
  
  return text.slice(startPos, endPos).trim();
}

function safeParseJSON(jsonText) {
  let t = (jsonText || '').trim();
  if (!t) return null;
  
  // Remove markdown code blocks
  if (t.startsWith('```json')) t = t.replace(/^```json\s*/i, '').replace(/\s*```$/,'');
  if (t.startsWith('```'))     t = t.replace(/^```\s*/i, '').replace(/\s*```$/,'');
  
  try { 
    return JSON.parse(t); 
  } catch {
    // Comprehensive JSON cleanup
    t = t
      .replace(/,\s*([}\]])/g,'$1')           // Remove trailing commas
      .replace(/,\s*,/g, ',')                 // Remove double commas
      .replace(/\/\/.*$/gm, '')               // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')       // Remove block comments
      .replace(/:\s*,/g, ': null,')           // Fix empty values
      .replace(/"\s*:\s*undefined/g, '": null') // Fix undefined values
      .replace(/:\s*undefined/g, ': null')     // Fix unquoted undefined
      .replace(/,(\s*[}\]])/g, '$1')          // Final trailing comma cleanup
      .trim();
    
    try { 
      return JSON.parse(t); 
    } catch (finalError) { 
      console.error('JSON parsing failed after cleanup:', finalError.message);
      console.error('Cleaned text (first 500 chars):', t.slice(0, 500));
      return null; 
    }
  }
}

function validateExcelStructure(structure) {
  if (!structure || typeof structure !== 'object') {
    return { valid: false, error: 'Structure is not an object' };
  }
  
  // Support multiple formats
  const worksheets = structure.worksheets || structure.workbook || [];
  
  if (!Array.isArray(worksheets) || worksheets.length === 0) {
    return { valid: false, error: 'No worksheets found in structure' };
  }
  
  // Validate each worksheet has required fields
  for (let i = 0; i < worksheets.length; i++) {
    const ws = worksheets[i];
    if (!ws.name || typeof ws.name !== 'string') {
      return { valid: false, error: `Worksheet ${i} missing valid name` };
    }
    
    // At least one of these should exist
    if (!ws.data && !ws.rows && !ws.columns && !ws.entries) {
      return { valid: false, error: `Worksheet ${ws.name} has no data` };
    }
  }
  
  return { valid: true };
}

function extractModeFromCommand(command) {
  const cmd = command.toLowerCase();
  
  if (cmd.includes('journal') || cmd.includes('ledger') || cmd.includes('transaction')) {
    return 'BOOKKEEPER';
  }
  if (cmd.includes('cost') || cmd.includes('budget') || cmd.includes('variance') || cmd.includes('margin')) {
    return 'MGMT_COST';
  }
  if (cmd.includes('financial statement') || cmd.includes('balance sheet') || cmd.includes('income statement')) {
    return 'FIN_REPORT';
  }
  if (cmd.includes('ratio') || cmd.includes('analysis') || cmd.includes('performance') || cmd.includes('kpi')) {
    return 'FIN_ANALYST';
  }
  if (cmd.includes('tax') || cmd.includes('deduction') || cmd.includes('1040') || cmd.includes('schedule')) {
    return 'TAX';
  }
  if (cmd.includes('audit') || cmd.includes('control') || cmd.includes('compliance') || cmd.includes('risk')) {
    return 'AUDIT';
  }
  if (cmd.includes('forensic') || cmd.includes('fraud') || cmd.includes('investigation')) {
    return 'FORENSIC';
  }
  
  return 'FIN_REPORT'; // Default mode
}

function detectAccountingFramework(command, region = 'US') {
  const cmd = command.toLowerCase();
  
  if (cmd.includes('ifrs') || cmd.includes('ias')) return 'IFRS';
  if (cmd.includes('ipsas')) return 'IPSAS';
  if (cmd.includes('gaap') && (cmd.includes('us') || cmd.includes('american'))) return 'US_GAAP';
  if (cmd.includes('gaap') && (cmd.includes('uk') || cmd.includes('british'))) return 'UK_GAAP';
  if (cmd.includes('j-gaap') || cmd.includes('japanese')) return 'J_GAAP';
  
  // Regional defaults
  const frameworkMap = {
    'US': 'US_GAAP',
    'CA': 'IFRS',
    'UK': 'UK_GAAP',
    'EU': 'IFRS',
    'JP': 'J_GAAP',
    'AU': 'IFRS',
    'IN': 'IFRS'
  };
  
  return frameworkMap[region] || 'US_GAAP';
}

module.exports = { 
  extractTaggedBlock, 
  safeParseJSON, 
  validateExcelStructure,
  extractModeFromCommand,
  detectAccountingFramework
};