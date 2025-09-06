const OpenAI = require('openai');

class LLMService {
  constructor() {
    // Set the API key from environment or use the provided key
    const apiKey = process.env.OPENAI_API_KEY || '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';
    
    if (!apiKey || apiKey === 'your-api-key-here') {
      console.warn('⚠️ OPENAI_API_KEY not set - using mock responses');
      this.mockMode = true;
    } else {
      console.log('✅ OpenAI API key configured');
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
      this.mockMode = false;
    }
  }

  async createCompletion(options) {
    if (this.mockMode) {
      console.log('🎭 Using mock GPT response (no API key)');
      return this.getMockResponse(options);
    }

    try {
      return await this.openai.chat.completions.create(options);
    } catch (error) {
      console.error('❌ OpenAI API error:', error.message);
      console.log('🎭 Falling back to mock response');
      return this.getMockResponse(options);
    }
  }

  getMockResponse(options) {
    const userMessage = options.messages.find(m => m.role === 'user')?.content || '';
    
    // Generate dynamic mock response based on user input
    let mockStructure;
    
    if (userMessage.toLowerCase().includes('movie') || userMessage.toLowerCase().includes('film')) {
      mockStructure = {
        summary: "Movie collection tracker with ratings and viewing details",
        worksheets: [{
          name: "My Movies",
          columns: [
            { header: "Title", key: "title", width: 30 },
            { header: "Genre", key: "genre", width: 15 },
            { header: "Rating", key: "rating", width: 10 },
            { header: "Date Watched", key: "date_watched", width: 15 },
            { header: "Notes", key: "notes", width: 40 }
          ],
          data: [
            { title: "The Matrix", genre: "Sci-Fi", rating: 9.0, date_watched: "2024-01-15", notes: "Mind-bending classic" },
            { title: "Inception", genre: "Thriller", rating: 8.5, date_watched: "2024-02-20", notes: "Complex but amazing" }
          ]
        }]
      };
    } else if (userMessage.toLowerCase().includes('budget') || userMessage.toLowerCase().includes('expense')) {
      mockStructure = {
        summary: "Personal budget tracker for monthly expenses and income",
        worksheets: [{
          name: "Monthly Budget",
          columns: [
            { header: "Category", key: "category", width: 20 },
            { header: "Budgeted", key: "budgeted", width: 15 },
            { header: "Actual", key: "actual", width: 15 },
            { header: "Difference", key: "difference", width: 15 }
          ],
          data: [
            { category: "Rent", budgeted: 1500, actual: 1500, difference: 0 },
            { category: "Food", budgeted: 400, actual: 450, difference: -50 }
          ]
        }]
      };
    } else if (userMessage.toLowerCase().includes('workout') || userMessage.toLowerCase().includes('fitness') || userMessage.toLowerCase().includes('exercise')) {
      mockStructure = {
        summary: "Workout tracker for exercises, sets, and progress monitoring",
        worksheets: [{
          name: "Workout Log",
          columns: [
            { header: "Date", key: "date", width: 12 },
            { header: "Exercise", key: "exercise", width: 25 },
            { header: "Sets", key: "sets", width: 8 },
            { header: "Reps", key: "reps", width: 8 },
            { header: "Weight", key: "weight", width: 12 }
          ],
          data: [
            { date: "2024-01-15", exercise: "Bench Press", sets: 3, reps: 10, weight: "185 lbs" },
            { date: "2024-01-15", exercise: "Squats", sets: 4, reps: 8, weight: "225 lbs" }
          ]
        }]
      };
    } else {
      // Default to a generic data structure
      mockStructure = {
        summary: "Custom data organizer based on your request",
        worksheets: [{
          name: "Data",
          columns: [
            { header: "Item", key: "item", width: 25 },
            { header: "Category", key: "category", width: 20 },
            { header: "Value", key: "value", width: 15 },
            { header: "Notes", key: "notes", width: 30 }
          ],
          data: [
            { item: "Sample Item 1", category: "Category A", value: "Value 1", notes: "Sample note" },
            { item: "Sample Item 2", category: "Category B", value: "Value 2", notes: "Another note" }
          ]
        }]
      };
    }

    return {
      choices: [{
        message: {
          content: JSON.stringify(mockStructure)
        }
      }]
    };
  }
}

module.exports = LLMService;