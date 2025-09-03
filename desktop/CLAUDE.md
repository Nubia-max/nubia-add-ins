# Nubia - Intelligent Excel Automation

## Production Deployment Ready

This desktop application has been fully configured for commercial deployment with comprehensive production features.

## Build & Development Commands

### Development
```bash
# Start development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
```

### Production Builds
```bash
# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux

# Build for all platforms
npm run build:all

# Build and publish
npm run publish
```

## Production Features Implemented

### ✅ 1. Build & Package Configuration
- **electron-builder** configuration for Windows, Mac, and Linux
- Auto-updater integration
- Code signing setup
- Platform-specific metadata and icons
- File associations for Excel files (.xlsx, .xls)

### ✅ 2. Installer Configuration
- **Windows NSIS installer** with custom script
- **Mac DMG** with app signing and notarization support
- **Linux AppImage/deb/rpm** packages
- Desktop shortcuts and Start menu integration
- Uninstaller functionality

### ✅ 3. Production Environment Handling
- Environment-based configuration management
- Development vs production API URLs
- Feature flags and security settings
- Encrypted storage for sensitive data
- Rate limiting and CSP configuration

### ✅ 4. Auto-Updater System
- Automatic update checking on startup
- Background update downloads
- User notifications and dialogs
- Manual update checking
- Update progress tracking
- Configurable update intervals

### ✅ 5. Analytics & Telemetry
- Privacy-compliant event tracking
- GDPR compliance with user consent
- Performance metrics collection
- Error reporting with context
- Excel task tracking
- LLM usage analytics
- Data export and deletion capabilities

### ✅ 6. Licensing System
- License key validation (online/offline)
- Trial period management (30 days)
- Feature restrictions based on license
- Device activation limits
- Usage tracking and limits
- Purchase flow integration
- License deactivation support

### ✅ 7. Performance Optimization
- Bundle optimization and code splitting
- Virtual scrolling for large lists
- Lazy loading components
- Image optimization
- Memory management
- Performance monitoring
- Caching strategies
- Resource preloading

### ✅ 8. Onboarding & Documentation
- Interactive onboarding wizard
- Excel installation detection
- API key configuration
- Sample task walkthrough
- Comprehensive help dialog
- Keyboard shortcuts guide
- Troubleshooting guides
- Support contact information

### ✅ 9. Security Hardening
- Input sanitization and validation
- CSP headers implementation
- Secure IPC communication
- API key encryption
- Rate limiting
- Directory traversal protection
- Suspicious activity monitoring
- Security event logging

### ✅ 10. Final Polish & Deployment
- Professional splash screen
- About dialog with version info
- Crash reporting system
- Error boundary handling
- Loading states and spinners
- Theme consistency
- Professional branding
- Deployment scripts

## Key Components

### Services
- `analytics.ts` - Privacy-compliant analytics
- `licensing.ts` - License management
- `updater.ts` - Auto-update functionality
- `ipcSecurity.ts` - Secure IPC communication

### Security
- `security.ts` - Input validation and encryption
- `crashReporter.ts` - Error reporting and crash handling

### Performance
- `performance.ts` - Performance monitoring
- `bundleOptimization.ts` - Code splitting and optimization

### Components
- `OnboardingWizard.tsx` - First-run setup
- `LicensePanel.tsx` - License management UI
- `UpdatePanel.tsx` - Update management UI
- `HelpDialog.tsx` - Documentation and support
- `SplashScreen.tsx` - Loading screen
- `AboutDialog.tsx` - App information
- `VirtualList.tsx` - Optimized list rendering
- `LazyImage.tsx` - Image lazy loading

### Configuration
- `environment.ts` - Environment management
- `electron-builder.yml` - Build configuration
- `installer.nsh` - Windows installer script
- `entitlements.mac.plist` - macOS permissions

## Security Features

- **Input Sanitization**: All user inputs are validated and sanitized
- **CSP Headers**: Content Security Policy prevents XSS attacks
- **Encrypted Storage**: API keys and sensitive data are encrypted
- **Rate Limiting**: API calls are rate-limited to prevent abuse
- **IPC Security**: Inter-process communication is secured
- **File Path Validation**: Prevents directory traversal attacks

## Privacy & GDPR Compliance

- User consent for data collection
- Data export functionality
- Data deletion capabilities
- Anonymization options
- Clear privacy policies
- Opt-out mechanisms

## Deployment Notes

1. **Code Signing**: Configure certificates for Windows and Mac
2. **Notarization**: Set up Apple Developer account for Mac notarization
3. **Update Server**: Deploy update server at configured URL
4. **License Server**: Deploy license validation server
5. **Analytics**: Configure analytics endpoints
6. **Crash Reporting**: Set up crash collection service

## Environment Variables

```bash
# Required for production
NUBIA_API_URL=https://api.nubia.ai/v1
NUBIA_LICENSE_URL=https://license.nubia.ai/v1
NUBIA_UPDATE_URL=https://updates.nubia.ai/releases
NUBIA_ENCRYPTION_KEY=your-32-char-encryption-key

# Optional
SENTRY_DSN=your-sentry-dsn
MIXPANEL_TOKEN=your-mixpanel-token
```

## Support

- Email: support@nubia.ai
- Documentation: https://docs.nubia.ai
- Website: https://nubia.ai

---

**Ready for commercial deployment** 🚀