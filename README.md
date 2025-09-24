# Nubia

AI-powered Excel automation add-in with real-time chat interface and direct code execution capabilities.

## Components

- **Excel Add-in**: Office.js frontend with task pane interface
- **Backend API**: Node.js Express server with DeepSeek AI integration
- **Direct Code Execution**: AI generates and executes Office.js code in Excel
- **Multi-worksheet Context**: Full workbook awareness for complex operations

## Project Structure

```
Nubia/
├── add-in/                     # Excel add-in (Office.js)
│   ├── src/
│   │   ├── taskpane/          # Main task pane UI
│   │   ├── commands/          # Ribbon command handlers
│   │   └── functions/         # Custom Excel functions
│   ├── manifest.xml           # Add-in manifest
│   └── webpack.config.js      # Build configuration
├── backend/                    # Node.js API server
├── shared/                     # Shared TypeScript types
├── functions/                  # Firebase Cloud Functions
└── package.json               # Root workspace configuration
```

## Getting Started

### Requirements

- Node.js 18+
- Microsoft Excel
- DeepSeek API key

### Setup

1. **Backend Server:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Excel Add-in:**
   ```bash
   cd add-in
   npm install
   npm run dev
   ```

3. **Environment Variables:**
   ```bash
   # backend/.env
   DEEPSEEK_API_KEY=your-deepseek-key
   BACKEND_PORT=3001
   ```

## Features

- **Natural Language Processing**: Chat interface for Excel commands
- **Real-time Code Generation**: AI creates Office.js code from user requests
- **Direct Execution**: Generated code runs immediately in Excel
- **Multi-sheet Operations**: Access to all worksheets and their data
- **Step-by-step Processing**: Complex tasks broken into manageable steps
- **Auto-expanding Input**: Responsive textarea for long prompts

## API Endpoints

- `POST /api/chat` - Main chat processing with Excel context
- `POST /api/chat/stream` - Server-sent events for long operations
- `GET /api/health` - Service health check

## Technical Stack

- **Frontend**: Office.js, HTML/CSS/JavaScript
- **Backend**: Node.js, Express, TypeScript
- **AI Integration**: DeepSeek API for code generation
- **Development**: Webpack dev server with hot reload

## Key Files

- `add-in/src/taskpane/taskpane.js` - Main UI and chat logic
- `add-in/src/taskpane/unlimitedExecutor.js` - Code execution engine
- `backend/src/services/directExcelAI.ts` - AI prompt engineering
- `backend/src/controllers/chatController.ts` - Request handling
- `add-in/manifest.xml` - Excel add-in configuration

## How It Works

1. User types natural language command in Excel task pane
2. Frontend captures Excel context (worksheets, data, selection)
3. Backend sends context + command to DeepSeek AI
4. AI generates valid Office.js code
5. Frontend executes code directly in Excel
6. Results appear immediately in spreadsheet