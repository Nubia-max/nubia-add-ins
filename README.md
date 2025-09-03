# Nubia - Excel Automation Chatbot

![Nubia Logo](https://via.placeholder.com/200x100/4472C4/FFFFFF?text=NUBIA)

**Nubia** is a production-ready Excel automation chatbot that combines an intelligent floating bubble GUI with powerful automation capabilities. Built as a modern monorepo, it features real-time chat, voice commands, and both visual and background Excel automation modes.

## 🚀 Features

- **📱 Floating Bubble Interface**: Always-on-top draggable bubble that expands to a full chat interface
- **🤖 Intelligent Chat**: Real-time conversation with Excel automation assistance
- **🎤 Voice Commands**: Built-in voice recording with Web Speech API
- **⚡ Dual Automation Modes**:
  - **Visual Mode**: Uses PyAutoGUI for on-screen automation with progress tracking
  - **Background Mode**: Uses OpenPyXL for fast, invisible Excel manipulation
- **🔒 Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **💾 PostgreSQL Database**: Robust data storage with Prisma ORM
- **🔄 Real-time Updates**: WebSocket communication for live progress updates
- **🐳 Docker Support**: Complete containerization for easy deployment
- **🛠️ TypeScript**: Full type safety across the entire stack

## 🏗️ Architecture

```
Nubia/
├── desktop/          # Electron + React floating bubble GUI
├── backend/          # Node.js + Express API with PostgreSQL
├── automation/       # Python FastAPI for Excel automation
├── shared/           # Shared configs and TypeScript types
├── nginx/            # Nginx configuration for production
└── docker-compose.yml # Multi-service orchestration
```

### Tech Stack

- **Frontend**: Electron, React, TypeScript, TailwindCSS
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL with Redis caching
- **Automation**: Python, FastAPI, PyAutoGUI, OpenPyXL
- **Real-time**: Socket.io, WebSockets
- **Deployment**: Docker, Docker Compose, Nginx

## 📦 Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Python** >= 3.11
- **Docker** & **Docker Compose** (for containerized setup)
- **PostgreSQL** >= 13 (if running without Docker)

## 🚀 Quick Start

### Option 1: Using Docker (Recommended)

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd Nubia
   cp .env.example .env
   ```

2. **Edit environment variables**:
   ```bash
   nano .env  # Configure your settings
   ```

3. **Start all services**:
   ```bash
   make setup
   # Or manually:
   docker-compose up -d
   npm install
   npm run db:migrate
   ```

4. **Launch desktop app**:
   ```bash
   cd desktop
   npm run dev
   ```

### Option 2: Local Development

1. **Setup database**:
   ```bash
   # Install PostgreSQL locally
   createdb nubia_db
   ```

2. **Install dependencies**:
   ```bash
   make install
   # Or manually:
   npm install
   cd desktop && npm install
   cd ../backend && npm install
   cd ../automation && pip install -r requirements.txt
   cd ../shared && npm install
   ```

3. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your local database URL
   ```

4. **Run migrations**:
   ```bash
   cd backend
   npx prisma migrate dev
   ```

5. **Start development servers**:
   ```bash
   npm run dev
   ```

## 🖥️ Desktop App Usage

### Floating Bubble Mode
- **80x80px** bubble stays on top of all windows
- **Draggable** to any screen position
- **Hover** to see tooltip
- **Click** to expand to chat interface

### Chat Interface
- **400x600px** chat window with full functionality
- **Voice recording** button for speech input
- **Settings panel** for automation mode selection
- **Real-time** message history with WebSocket updates
- **Minimize** button to return to bubble mode

### Settings Options
- **Automation Mode**: Choose between Visual and Background
- **Notifications**: Enable/disable system notifications
- **Auto-minimize**: Automatically minimize after task completion

## 🔧 API Endpoints

### Backend API (Port 3001)

#### Authentication
```http
POST /auth/register    # Register new user
POST /auth/login       # User login
GET  /auth/me         # Get user profile
```

#### Chat
```http
GET  /chat/history/:userId  # Get chat history
POST /chat/send            # Send message
```

### Automation Service (Port 8000)

#### Task Management
```http
POST /execute              # Execute automation task
GET  /status/:taskId       # Get task status
POST /abort/:taskId        # Abort running task
GET  /tasks               # List all tasks
```

#### WebSocket
```
WS /ws                    # Real-time task updates
```

## 🤖 Automation Capabilities

### Visual Mode (PyAutoGUI)
- **Live screen interaction** with Excel
- **Progress tracking** with visual feedback
- **Screenshot capability** for debugging
- **Mouse and keyboard automation**
- **Window detection and activation**

### Background Mode (OpenPyXL)
- **Fast file manipulation** without GUI
- **Excel file creation and editing**
- **Formula insertion and calculation**
- **Chart and pivot table generation**
- **Data import/export and formatting**

### Supported Operations
- ✅ Create pivot tables
- ✅ Insert formulas (SUM, AVERAGE, COUNT, etc.)
- ✅ Generate charts (Bar, Line, Pie)
- ✅ Format cells and worksheets
- ✅ Data manipulation and cleaning
- ✅ Multi-sheet operations
- ✅ Custom styling and themes

## 🐳 Docker Deployment

### Production Deployment
```bash
# Build and start production services
make deploy-build
make deploy-up

# Or manually:
docker-compose -f docker-compose.yml --profile production up -d
```

### Development with Tools
```bash
# Start with PgAdmin and Redis Commander
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile tools up -d
```

### Service Health Checks
```bash
make health
# Or check individual services:
curl http://localhost:3001/health  # Backend
curl http://localhost:8000/health  # Automation
```

## 🔐 Environment Configuration

Key environment variables in `.env`:

```bash
# Database
DATABASE_URL="postgresql://nubia:password@localhost:5432/nubia_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Services
BACKEND_PORT=3001
AUTOMATION_PORT=8000
DESKTOP_PORT=3000

# CORS
CORS_ORIGIN="http://localhost:3000"
```

## 📊 Development Commands

```bash
make help              # Show all available commands
make dev              # Start all development servers
make build            # Build all services
make test             # Run tests
make lint             # Run linters
make docker-up        # Start Docker services
make migrate          # Run database migrations
make clean            # Clean build artifacts
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Test specific services
cd backend && npm test
cd desktop && npm test

# Type checking
npm run type-check
```

## 📝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Standards
- **TypeScript** for all JavaScript code
- **ESLint** for code linting
- **Prettier** for code formatting
- **Conventional Commits** for commit messages

## 🔒 Security Features

- **JWT Authentication** with secure token handling
- **bcrypt Password Hashing** with salt rounds
- **Input Validation** using express-validator
- **Rate Limiting** on API endpoints
- **CORS Configuration** for cross-origin requests
- **Helmet.js** for security headers
- **Non-root Docker Users** for container security

## 🚨 Troubleshooting

### Common Issues

**Desktop app won't start**:
```bash
# Rebuild Electron
cd desktop
rm -rf node_modules
npm install
npm run dev
```

**Database connection failed**:
```bash
# Check PostgreSQL status
docker-compose ps postgres
# Reset database
make db-reset
```

**Automation service errors**:
```bash
# Check Python dependencies
cd automation
pip install -r requirements.txt
# Check logs
docker-compose logs automation
```

**Excel automation not working**:
- Ensure Excel is installed and accessible
- Check display settings for GUI mode
- Verify file permissions for background mode

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Electron** - Cross-platform desktop apps
- **React** - UI component library
- **FastAPI** - Modern Python web framework
- **Prisma** - Next-generation ORM
- **OpenPyXL** - Excel file manipulation
- **PyAutoGUI** - GUI automation

## 📞 Support

For support and questions:
- 📧 Email: support@nubia.dev
- 💬 Discord: [Join our community](https://discord.gg/nubia)
- 🐛 Issues: [GitHub Issues](https://github.com/nubia/nubia/issues)

---

**Made with ❤️ by the Nubia Team**