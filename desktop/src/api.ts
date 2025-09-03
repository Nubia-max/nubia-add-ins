const OPENAI_API_KEY_STORAGE = 'openai_api_key';

export function getStoredApiKey(): string {
  return localStorage.getItem(OPENAI_API_KEY_STORAGE) || '';
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem(OPENAI_API_KEY_STORAGE, key);
}

export function hasApiKey(): boolean {
  return getStoredApiKey().length > 0;
}

export async function callOpenAI(message: string): Promise<string> {
  const apiKey = getStoredApiKey();
  
  if (!apiKey) {
    return "Please add your OpenAI API key in settings.";
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are Nubia, an Excel automation assistant. Help users with Excel and accounting tasks.' },
          { role: 'user', content: message }
        ]
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        return 'Invalid API key. Please check your OpenAI API key in settings.';
      }
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response from AI';
  } catch (error) {
    console.error('OpenAI API error:', error);
    return 'Error connecting to OpenAI. Please check your API key and internet connection.';
  }
}