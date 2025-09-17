// Compare your system prompt vs minimal prompt
const { LEGENDARY_NUBIA_SYSTEM_PROMPT } = require('./backend/src/constants/systemPrompts');

console.log('🔍 SYSTEM PROMPT ANALYSIS');
console.log('═'.repeat(80));

console.log('📊 LEGENDARY_NUBIA_SYSTEM_PROMPT Statistics:');
console.log('📊 Length:', LEGENDARY_NUBIA_SYSTEM_PROMPT.length, 'characters');
console.log('📊 Lines:', LEGENDARY_NUBIA_SYSTEM_PROMPT.split('\n').length);
console.log('📊 Words:', LEGENDARY_NUBIA_SYSTEM_PROMPT.split(' ').length);

console.log('\n🔍 Checking for problematic instructions...');

const problematicPhrases = [
  'multiply', 'divide', 'calculate', 'adjust', 'modify', 'change',
  'thousands', 'millions', 'currency', 'format', 'scale',
  'interpretation', 'assume', 'treat as', 'consider as'
];

problematicPhrases.forEach(phrase => {
  if (LEGENDARY_NUBIA_SYSTEM_PROMPT.toLowerCase().includes(phrase)) {
    console.log(`⚠️ Contains "${phrase}"`);
  }
});

console.log('\n📄 FIRST 500 CHARACTERS:');
console.log(LEGENDARY_NUBIA_SYSTEM_PROMPT.substring(0, 500));

console.log('\n📄 LAST 500 CHARACTERS:');
console.log(LEGENDARY_NUBIA_SYSTEM_PROMPT.slice(-500));

console.log('\n🔍 HYPOTHESIS:');
console.log('🔍 Your complex system prompt is interfering with DeepSeek\'s natural number interpretation');
console.log('🔍 The website uses minimal/no system prompt, letting DeepSeek think naturally');
console.log('🔍 Your prompt might be causing DeepSeek to misread the base numbers');

console.log('\n═'.repeat(80));