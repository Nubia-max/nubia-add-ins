// LEGENDARY NUBIA SECTION PARSERS
// Pure mechanical extraction and validation - NO DECISIONS

function extractTaggedBlock(text, tag) {
  const start = new RegExp(`\\[${tag}\\]`, 'i');
  const end   = new RegExp(`\\[\\/${tag}\\]`, 'i');
  const s = text.search(start);
  const e = text.search(end);
  
  if (s === -1 || e === -1) {
    // Fallback detection for when GPT forgets tags
    if (tag === 'CHAT_RESPONSE') {
      // Look for conversational content before JSON
      const jsonStart = text.search(/\{[\s\S]*"workbook"/i);
      if (jsonStart > 0) {
        return text.slice(0, jsonStart).trim();
      }
      // If no JSON found, return first paragraph
      const firstParagraph = text.split('\n\n')[0];
      return firstParagraph.length > 10 ? firstParagraph : 'I\'ve processed your request.';
    }
    
    if (tag === 'EXCEL_DATA') {
      // AGGRESSIVE: Find ANY JSON object in the response, starting from first {
      let jsonStart = text.indexOf('{');
      if (jsonStart === -1) return null;

      // Find the proper end by counting braces
      let braceCount = 0;
      let jsonEnd = jsonStart;
      let inString = false;
      let escapeNext = false;

      for (let i = jsonStart; i < text.length; i++) {
        const char = text[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }
      }

      if (braceCount === 0 && jsonEnd > jsonStart) {
        let jsonText = text.slice(jsonStart, jsonEnd);
        console.log('🔧 AGGRESSIVE: Extracted JSON length:', jsonText.length);
        console.log('🔧 JSON ends with:', jsonText.slice(-100));
        return jsonText;
      }

      // Fallback: Try simpler patterns
      const patterns = [
        /\{[\s\S]*?"workbook"[\s\S]*?\}/i,
        /\{[\s\S]*?"meta"[\s\S]*?\}/i,
        /\{[\s\S]*?\}/i
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          console.log('🔧 FALLBACK: Using pattern match, length:', match[0].length);
          return match[0];
        }
      }

      return null;
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
  
  // Handle truncated JSON by attempting to complete it
  if (!t.endsWith('}') && !t.endsWith(']')) {
    console.log('🔧 Detected truncated JSON, attempting to complete...');
    
    // Count open vs close braces/brackets
    const openBraces = (t.match(/{/g) || []).length;
    const closeBraces = (t.match(/}/g) || []).length;
    const openBrackets = (t.match(/\[/g) || []).length;
    const closeBrackets = (t.match(/\]/g) || []).length;
    
    // Add missing closing characters
    const missingBrackets = Math.max(0, openBrackets - closeBrackets);
    const missingBraces = Math.max(0, openBraces - closeBraces);
    
    if (missingBrackets > 0 || missingBraces > 0) {
      console.log(`🔧 Adding ${missingBrackets} closing brackets and ${missingBraces} closing braces`);
      t += ']'.repeat(missingBrackets);
      t += '}'.repeat(missingBraces);
    }
  }
  
  try {
    return JSON.parse(t);
  } catch (firstError) {
    console.log('🔧 First JSON parse failed, attempting cleanup...');
    console.log('🔧 Error:', firstError.message);

    // Enhanced JSON cleanup for DeepSeek responses
    t = t
      .replace(/\}\s*[\s\S]*$/, '}')          // Remove everything after final }
      .replace(/,\s*([}\]])/g,'$1')           // Remove trailing commas
      .replace(/,\s*,/g, ',')                 // Remove double commas
      .replace(/\/\/.*$/gm, '')               // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')       // Remove block comments
      .replace(/:\s*,/g, ': null,')           // Fix empty values
      .replace(/"\s*:\s*undefined/g, '": null') // Fix undefined values
      .replace(/:\s*undefined/g, ': null')     // Fix unquoted undefined
      .replace(/,(\s*[}\]])/g, '$1')          // Final trailing comma cleanup
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .trim();

    // Try to find just the main JSON object if there's extra content
    const jsonMatch = t.match(/^\{[\s\S]*?\}(?=\s*$|\s*[^}\],])/);
    if (jsonMatch) {
      t = jsonMatch[0];
      console.log('🔧 Extracted main JSON object, length:', t.length);
    }

    try {
      return JSON.parse(t);
    } catch (finalError) {
      console.error('JSON parsing failed after cleanup:', finalError.message);
      console.error('Cleaned text (first 500 chars):', t.slice(0, 500));
      console.error('Cleaned text (last 100 chars):', t.slice(-100));
      return null;
    }
  }
}

function validateExcelStructure(structure) {
  if (!structure || typeof structure !== 'object') {
    return { valid: false, error: 'Structure is not an object' };
  }
  
  // ENHANCED: Rules-first validation with critical accounting checks
  if (structure.meta) {
    const meta = structure.meta;
    
    // Validate meta section exists
    if (!meta.mode) {
      return { valid: false, error: 'Missing mode in meta section' };
    }
    if (!meta.framework) {
      return { valid: false, error: 'Missing framework in meta section' };
    }
    // Checks are optional - only validate if present
    if (meta.checks && !Array.isArray(meta.checks)) {
      return { valid: false, error: 'Invalid validation checks format in meta section' };
    }
    
    // CRITICAL: Verify accounting integrity checks passed (only if checks exist)
    if (meta.checks && Array.isArray(meta.checks)) {
      const debitsCredits = meta.checks.find(c => 
        c.check === 'DebitsEqualCredits' || c.check.includes('Debit')
      );
      const trialBalance = meta.checks.find(c => 
        c.check === 'TrialBalanceZero' || c.check.includes('TrialBalance')
      );
      
      if (debitsCredits && !debitsCredits.passed) {
        return { 
          valid: false, 
          error: 'CRITICAL: Debits do not equal credits - accounting integrity violation' 
        };
      }
      
      if (trialBalance && !trialBalance.passed) {
        return { 
          valid: false, 
          error: 'CRITICAL: Trial balance does not sum to zero - accounting integrity violation' 
        };
      }
      
      // Check for any failed critical checks
      const failedChecks = meta.checks.filter(c => !c.passed);
      if (failedChecks.length > 0) {
        const criticalFailed = failedChecks.filter(c => 
          c.check.includes('Debits') || 
          c.check.includes('Credits') || 
          c.check.includes('Balance') ||
          c.check.includes('IS_Links') ||
          c.check.includes('PAT')
        );
        
        if (criticalFailed.length > 0) {
          return { 
            valid: false, 
            error: `CRITICAL accounting validation failed: ${criticalFailed.map(c => c.check).join(', ')}` 
          };
        }
      }
    }
  }
  
  // Support multiple workbook formats
  const worksheets = structure.worksheets || structure.workbook || [];
  
  if (!Array.isArray(worksheets) || worksheets.length === 0) {
    return { valid: false, error: 'No worksheets found in structure' };
  }
  
  // Auto-fix worksheet names and validate more leniently
  for (let i = 0; i < worksheets.length; i++) {
    const ws = worksheets[i];
    
    // Auto-fix missing names
    if (!ws.name && !ws.sheetName) {
      ws.name = `Sheet${i + 1}`;
      console.log(`🔧 Auto-assigned name "Sheet${i + 1}" to worksheet ${i}`);
    } else if (!ws.name && ws.sheetName) {
      ws.name = ws.sheetName;
    }
    
    // Be more lenient about data - GPT might use different field names
    const hasData = ws.data || ws.rows || ws.columns || ws.entries || ws.content || 
                   ws.table || ws.items || (ws.headers && ws.values);
    
    if (!hasData) {
      console.log(`⚠️ Worksheet ${ws.name || i} appears to have no data, but allowing it`);
    }
  }
  
  return { valid: true };
}

module.exports = { 
  extractTaggedBlock, 
  safeParseJSON, 
  validateExcelStructure
};

/*
LEGENDARY NUBIA SECTION PARSERS
✅ Pure mechanical extraction - no decisions
✅ Enhanced JSON cleanup and parsing
✅ CRITICAL accounting validation (debits=credits, trial balance=0)
✅ Rules-first validation with integrity checks
✅ No hardcoded mode or framework detection
✅ GPT has complete freedom to decide everything

REMOVED DECISION-MAKING FUNCTIONS:
❌ extractModeFromCommand() - GPT decides mode
❌ detectAccountingFramework() - GPT determines framework

KEPT MECHANICAL FUNCTIONS:
✅ extractTaggedBlock() - pure extraction
✅ safeParseJSON() - mechanical parsing with cleanup
✅ validateExcelStructure() - validation of GPT's decisions

The legendary principle: Parsers parse, GPT decides
*/