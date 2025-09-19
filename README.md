# Nubia - Excel Add-in for AI-Powered Automation

Nubia is an Excel add-in that provides AI-powered automation and assistance directly within Microsoft Excel. Built with Office.js and powered by a Node.js backend with Firebase integration.

## Architecture

- **Add-in Frontend**: Office.js-based Excel add-in (TypeScript/HTML/CSS)
- **Backend API**: Node.js Express server with Firebase integration
- **Shared Types**: Common TypeScript definitions
- **Firebase Functions**: Cloud functions for extended functionality

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

### Prerequisites

- Node.js 18+
- npm 9+
- Microsoft Excel (for testing)
- Firebase project setup

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd Nubia
   npm install
   ```

2. **Start the backend server:**
   ```bash
   npm run dev:backend
   ```

3. **Start the add-in development server:**
   ```bash
   npm run dev:add-in
   ```

4. **Sideload the add-in in Excel:**
   ```bash
   cd add-in
   npm run sideload
   ```

### Development

- **Backend development**: `npm run dev:backend`
- **Add-in development**: `npm run dev:add-in`
- **Build all**: `npm run build`
- **Type checking**: `npm run type-check`
- **Linting**: `npm run lint`

## Features

### AI-Powered Chat Interface
- Natural language interaction with Excel
- Context-aware responses based on current worksheet
- Real-time Excel automation

### Quick Automation
- Ribbon button for instant data analysis
- Smart suggestions based on selected data
- One-click automation execution

### Excel Integration
- Direct manipulation of Excel objects via Office.js
- Formula generation and insertion
- Data formatting and analysis
- Chart and pivot table creation

### Authentication & Security
- Firebase authentication integration
- Secure API communication
- Token-based authorization

## Backend API Integration

The add-in communicates with the existing Nubia backend API:

- **Authentication**: `/api/auth/*`
- **Chat**: `/api/chat/*`
- **Automation**: `/api/automation/*`
- **Subscriptions**: `/api/subscription/*`

All existing backend functionality remains intact and reusable.

## Deployment

### Development
1. Install Office development certificates: `npm run start` (in add-in folder)
2. Sideload manifest.xml in Excel
3. Start backend server

### Production
1. Build add-in: `npm run build`
2. Deploy to web server (HTTPS required)
3. Update manifest.xml URLs to production
4. Submit to Microsoft AppSource or deploy via admin center

## Configuration

### Environment Variables
```bash
# Backend (.env)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
BACKEND_PORT=3001

# Add-in (manifest.xml)
- Update SourceLocation URLs for production
- Update AppDomain entries
```

### Manifest Configuration
Key sections in `manifest.xml`:
- **SourceLocation**: Points to your hosted add-in
- **AppDomains**: Allowed domains for the add-in
- **Permissions**: Excel access permissions
- **Ribbon buttons**: Custom UI elements

## Key Components

### Task Pane (`taskpane.ts`)
- Main chat interface
- Authentication handling
- Excel context integration
- Real-time communication with backend

### Commands (`commands.ts`)
- Ribbon button handlers
- Quick automation functions
- Dialog management

### API Integration
- Axios-based HTTP client
- Token management
- Error handling
- Excel action execution

## Firebase Integration

Existing Firebase services remain fully functional:
- **Authentication**: User login/registration
- **Firestore**: Data storage and chat history
- **Functions**: Server-side processing
- **Storage**: File uploads and processing

## Office.js APIs Used

- **Excel.run()**: Main Excel context
- **Worksheet operations**: Data reading/writing
- **Range manipulation**: Cell selection and formatting
- **Office.onReady()**: Add-in initialization
- **UI.displayDialog()**: Modal dialogs

## Support

- **Documentation**: Office.js docs + Firebase docs
- **Development**: Use Excel Online or Desktop for testing
- **Debugging**: Browser dev tools + Office Add-in debugging

---

**Ready for Excel add-in development!** 🚀