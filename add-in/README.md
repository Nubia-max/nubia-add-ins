# Moose Excel Add-in

AI-powered Excel automation and assistance add-in built with Office.js.

## Features

- **AI Chat Interface**: Natural language interaction with Excel data
- **Excel Integration**: Read/write cells, format ranges, create charts
- **Quick Analysis**: Ribbon button for instant AI insights
- **Backend Integration**: Connects to Moose backend API for LLM processing

## Project Structure

```
add-in/
├── manifest.xml              # Office add-in manifest
├── src/
│   ├── taskpane/            # Main chat interface
│   │   ├── taskpane.html    # Chat UI
│   │   └── taskpane.js      # Chat logic & Excel integration
│   ├── commands/            # Ribbon button handlers
│   │   ├── commands.html    # Commands page
│   │   └── commands.js      # Quick analysis function
│   └── functions/           # Excel utility functions
│       └── excel-functions.js  # Read/write Excel data
├── assets/                  # Icons and static files
├── dist/                    # Built files
├── webpack.config.js        # Build configuration
└── package.json            # Dependencies and scripts
```

## Development Setup

### Prerequisites

- Node.js 16+
- Excel (Desktop or Online)
- Moose backend running on localhost:3001

### Installation

1. **Install dependencies:**
   ```bash
   cd add-in
   npm install
   ```

2. **Start development server:**
   ```bash
   npm start
   ```
   This starts webpack dev server on https://localhost:3000

3. **Start backend (in separate terminal):**
   ```bash
   cd ../
   npm run dev:backend
   ```

4. **Sideload add-in:**
   ```bash
   npm run sideload
   ```

### Development Commands

- `npm start` - Start dev server with auto-reload
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run validate` - Validate manifest.xml
- `npm run sideload` - Sideload into Excel
- `npm run stop` - Stop sideloading
- `npm run lint` - Run ESLint

## Usage

### Chat Interface

1. Click "Open Moose" in Excel ribbon
2. Type questions about your Excel data
3. Get AI-powered responses and automation

### Quick Analysis

1. Select data in Excel
2. Click "Quick Analysis" in ribbon
3. View AI insights in popup dialog

### Excel Functions

The add-in provides these core functions:

- `readWorksheetValues(address)` - Read cell/range values
- `writeToCell(address, value)` - Write to specific cell
- `getCurrentSelection()` - Get selected range info
- `insertDataRange(start, data)` - Insert 2D data array
- `formatRange(address, format)` - Format cells
- `createChart(dataRange, type, title)` - Create charts

## Backend Integration

The add-in communicates with the Moose backend with rich Excel context:

- **Endpoint**: `POST /api/chat`
- **Payload**: Enhanced context including sheet data and surrounding information
- **Response**: Context-aware chat messages and Excel actions

### Rich Context Payload

```javascript
{
  "message": "user's text",
  "context": {
    "workbook": {
      "sheetNames": ["Sheet1", "Sheet2", "Data"],
      "activeSheet": "Sheet1",
      "activeSheetIndex": 0
    },
    "sheetName": "Sheet1",
    "selectedRange": "B2:C10",
    "dataPreview": [
      ["Product", "Sales"],
      ["Shoes", 120],
      ["Hats", 85],
      ["Bags", 200]
    ],
    "surroundingContext": {
      "address": "A1:D15",
      "values": [[/* 20x20 array */]],
      "selectionOffset": { "rowOffset": 1, "colOffset": 1 }
    },
    "usedRange": {
      "address": "A1:C20",
      "rowCount": 20,
      "columnCount": 3,
      "sampleData": [[/* first 10 rows */]]
    }
  },
  "source": "excel-addin"
}
```

### Excel Actions

Backend can return Excel actions to execute:

```javascript
// Enhanced Excel Actions with Multi-Sheet Support
{
  "type": "action",
  "action": "writeToCell",
  "args": {
    "address": "A4",
    "value": 500,
    "sheet": "Sheet2"  // Optional: target different sheet
  }
}

{
  "type": "action",
  "action": "formatRange",
  "args": {
    "range": "B2:B10",
    "style": {
      "fillColor": "#ff0000",
      "bold": true,
      "fontSize": 12
    },
    "sheet": "Data"  // Optional: target specific sheet
  }
}

// Multiple actions response
{
  "actions": [
    { "type": "chat", "message": "I'll analyze and update your data:" },
    { "type": "action", "action": "insertFormula", "args": { "address": "C11", "formula": "=SUM(C2:C10)" }},
    { "type": "action", "action": "formatRange", "args": { "range": "C11", "style": { "bold": true }}}
  ]
}
```

## Manifest Configuration

Key manifest settings:

- **ID**: `12345678-1234-5678-9012-123456789abc`
- **Host**: Excel Workbook
- **Permissions**: ReadWriteDocument
- **Source**: https://localhost:3000 (dev) / https://moose.ai (prod)

## Deployment

### Development
- Add-in served from https://localhost:3000
- Manifest points to localhost URLs
- Sideload via Office dev tools

### Production
1. Build: `npm run build`
2. Deploy `dist/` folder to HTTPS server
3. Update manifest URLs to production domain
4. Submit to Microsoft AppSource or deploy via admin

## Security

- HTTPS required for all add-in URLs
- CORS configured for Office.js hosts
- No authentication required (connects to existing backend)
- Input validation on all Excel operations

## Troubleshooting

### Common Issues

1. **Add-in won't load**: Check HTTPS certificates
2. **Backend connection fails**: Verify backend is running on :3001
3. **Manifest validation errors**: Run `npm run validate`
4. **Excel actions fail**: Check cell addresses and data types

### Development Tools

- Browser Dev Tools (F12 in Excel)
- Office Add-in Debugger
- Webpack dev server logs
- Backend API logs

## API Reference

### Taskpane Functions

- `MooseTaskpane.addMessage(sender, content)`
- `MooseTaskpane.getExcelContext()`
- `MooseTaskpane.executeExcelActions(actions)`

### Excel Functions

- `MooseExcelFunctions.setSampleValue()` - Demo: Set A4 to 500
- `MooseExcelFunctions.demonstrateReadFunction()` - Demo: Read selection

---

**Ready for Excel add-in development!** 🚀