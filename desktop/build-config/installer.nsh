# Custom NSIS installer script for Nubia

# Set modern UI
!include "MUI2.nsh"
!include "FileFunc.nsh"

# App information
!define APP_NAME "Nubia"
!define APP_DESCRIPTION "AI-Powered Excel Automation Assistant"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "Nubia Team"
!define APP_URL "https://nubia.ai"
!define APP_SUPPORT_URL "https://support.nubia.ai"

# Installer settings
Name "${APP_NAME} ${APP_VERSION}"
OutFile "${APP_NAME}-Setup-${APP_VERSION}.exe"
InstallDir "$PROGRAMFILES64\${APP_NAME}"
InstallDirRegKey HKLM "Software\${APP_NAME}" "InstallLocation"
RequestExecutionLevel admin
ShowInstDetails show
ShowUnInstDetails show

# Modern UI configuration
!define MUI_ABORTWARNING
!define MUI_ICON "${APP_NAME}.ico"
!define MUI_UNICON "${APP_NAME}.ico"
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${APP_NAME} Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of ${APP_NAME}.$\r$\n$\r$\n${APP_DESCRIPTION}$\r$\n$\r$\nClick Next to continue."
!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "${APP_NAME} has been installed successfully.$\r$\n$\r$\nYou can now start automating your Excel tasks with AI assistance!"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_NAME}.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${APP_NAME}"
!define MUI_FINISHPAGE_LINK "Visit our website for documentation and support"
!define MUI_FINISHPAGE_LINK_LOCATION "${APP_URL}"

# Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

# Languages
!insertmacro MUI_LANGUAGE "English"

# Installer sections
Section "Main Application" SecMain
    SectionIn RO
    
    SetOutPath "$INSTDIR"
    
    # Create shortcuts
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_NAME}.exe"
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe"
    CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_NAME}.exe"
    
    # Registry entries
    WriteRegStr HKLM "Software\${APP_NAME}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\${APP_NAME}" "Version" "${APP_VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayName" "${APP_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayVersion" "${APP_VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "Publisher" "${APP_PUBLISHER}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "URLInfoAbout" "${APP_URL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "HelpLink" "${APP_SUPPORT_URL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoRepair" 1
    
    # File associations for Excel files
    WriteRegStr HKCR ".xlsx\OpenWithProgids" "${APP_NAME}.xlsx" ""
    WriteRegStr HKCR ".xls\OpenWithProgids" "${APP_NAME}.xls" ""
    WriteRegStr HKCR "${APP_NAME}.xlsx" "" "Excel Workbook (Nubia Compatible)"
    WriteRegStr HKCR "${APP_NAME}.xlsx\shell\open\command" "" '"$INSTDIR\${APP_NAME}.exe" "%1"'
    WriteRegStr HKCR "${APP_NAME}.xls" "" "Excel 97-2003 Workbook (Nubia Compatible)"
    WriteRegStr HKCR "${APP_NAME}.xls\shell\open\command" "" '"$INSTDIR\${APP_NAME}.exe" "%1"'
    
    # Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

# Uninstaller section
Section "Uninstall"
    # Remove shortcuts
    Delete "$DESKTOP\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk"
    RMDir "$SMPROGRAMS\${APP_NAME}"
    
    # Remove registry entries
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
    DeleteRegKey HKLM "Software\${APP_NAME}"
    DeleteRegKey HKCR "${APP_NAME}.xlsx"
    DeleteRegKey HKCR "${APP_NAME}.xls"
    DeleteRegValue HKCR ".xlsx\OpenWithProgids" "${APP_NAME}.xlsx"
    DeleteRegValue HKCR ".xls\OpenWithProgids" "${APP_NAME}.xls"
SectionEnd