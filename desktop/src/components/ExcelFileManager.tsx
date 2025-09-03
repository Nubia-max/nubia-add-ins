import React, { useState, useEffect } from 'react';
import { ExcelFile, excelFileHandler, FileOperationResult } from '../services/excelFileHandler';

interface ExcelFileManagerProps {
  theme?: 'light' | 'dark';
  onFileOperation?: (result: FileOperationResult) => void;
  onFileSelect?: (file: ExcelFile) => void;
}

export const ExcelFileManager: React.FC<ExcelFileManagerProps> = ({
  theme = 'dark',
  onFileOperation,
  onFileSelect
}) => {
  const [openFiles, setOpenFiles] = useState<ExcelFile[]>([]);
  const [activeFile, setActiveFile] = useState<ExcelFile | null>(null);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [fileStats, setFileStats] = useState(excelFileHandler.getFileStats());

  useEffect(() => {
    // Refresh files periodically
    const interval = setInterval(refreshFiles, 2000);
    refreshFiles();
    return () => clearInterval(interval);
  }, []);

  const refreshFiles = () => {
    const files = excelFileHandler.getOpenFiles();
    const active = excelFileHandler.getActiveFile();
    const stats = excelFileHandler.getFileStats();
    
    setOpenFiles(files);
    setActiveFile(active);
    setFileStats(stats);
  };

  const handleCreateNewFile = async () => {
    if (!newFileName.trim()) return;

    const result = await excelFileHandler.createNewFile(
      newFileName.endsWith('.xlsx') ? newFileName : `${newFileName}.xlsx`
    );
    
    if (onFileOperation) {
      onFileOperation(result);
    }

    if (result.success) {
      setShowNewFileDialog(false);
      setNewFileName('');
      refreshFiles();
    }
  };

  const handleFileSelect = (file: ExcelFile) => {
    excelFileHandler.setActiveFile(file.id);
    refreshFiles();
    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const handleCloseFile = async (fileId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const result = await excelFileHandler.closeFile(fileId);
    
    if (onFileOperation) {
      onFileOperation(result);
    }

    refreshFiles();
  };

  const handleSaveFile = async (fileId: string) => {
    const result = await excelFileHandler.saveFile(fileId);
    
    if (onFileOperation) {
      onFileOperation(result);
    }

    refreshFiles();
  };

  const handleOpenRecentFile = async () => {
    const result = await excelFileHandler.openRecentFile();
    
    if (onFileOperation) {
      onFileOperation(result);
    }

    refreshFiles();
  };

  const getFileIcon = (file: ExcelFile) => {
    switch (file.type) {
      case 'xlsx':
        return '📊';
      case 'xls':
        return '📋';
      case 'csv':
        return '📄';
      default:
        return '📊';
    }
  };

  const getFileStatusColor = (file: ExcelFile) => {
    if (file.isActive) return 'border-primary-500 bg-primary-500/10';
    return theme === 'dark' ? 'border-surface-700' : 'border-surface-200';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={`excel-file-manager p-4 space-y-4 ${
      theme === 'dark' ? 'text-white' : 'text-surface-900'
    }`}>
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
            Excel Files
          </h3>
          <div className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
            {fileStats.openFiles} files • {fileStats.totalSheets} sheets
            {fileStats.activeFile && ` • Active: ${fileStats.activeFile}`}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenRecentFile}
            className={`
              px-3 py-1.5 text-xs rounded-lg border transition-colors
              ${theme === 'dark'
                ? 'bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700'
                : 'bg-white border-surface-300 text-surface-700 hover:bg-surface-50'
              }
            `}
          >
            Open Recent
          </button>
          
          <button
            onClick={() => setShowNewFileDialog(true)}
            className="px-3 py-1.5 text-xs bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            New File
          </button>
        </div>
      </div>

      {/* New File Dialog */}
      {showNewFileDialog && (
        <div className={`p-4 rounded-lg border ${
          theme === 'dark' 
            ? 'bg-surface-800 border-surface-700' 
            : 'bg-surface-50 border-surface-200'
        }`}>
          <h4 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
            Create New Excel File
          </h4>
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Enter file name..."
              className={`
                flex-1 px-3 py-2 rounded border focus:ring-2 focus:ring-primary-500 focus:border-transparent
                ${theme === 'dark' 
                  ? 'border-surface-700 bg-surface-900 text-white placeholder-surface-500' 
                  : 'border-surface-300 bg-white text-surface-900 placeholder-surface-400'
                }
              `}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateNewFile()}
            />
            <button
              onClick={handleCreateNewFile}
              disabled={!newFileName.trim()}
              className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowNewFileDialog(false);
                setNewFileName('');
              }}
              className={`
                px-4 py-2 rounded border transition-colors
                ${theme === 'dark'
                  ? 'border-surface-700 text-surface-300 hover:bg-surface-700'
                  : 'border-surface-300 text-surface-700 hover:bg-surface-50'
                }
              `}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Open Files List */}
      {openFiles.length === 0 ? (
        <div className={`
          text-center py-8 border-2 border-dashed rounded-lg
          ${theme === 'dark' ? 'border-surface-700 text-surface-500' : 'border-surface-300 text-surface-500'}
        `}>
          <div className="text-4xl mb-2">📂</div>
          <p className="text-sm">No Excel files are currently open</p>
          <p className="text-xs mt-1">Create a new file or open an existing one to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {openFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => handleFileSelect(file)}
              className={`
                group p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md
                ${getFileStatusColor(file)}
                ${theme === 'dark' ? 'hover:bg-surface-800/50' : 'hover:bg-surface-50'}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="text-2xl">{getFileIcon(file)}</div>
                  
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${
                      file.isActive 
                        ? 'text-primary-500' 
                        : theme === 'dark' ? 'text-white' : 'text-surface-900'
                    }`}>
                      {file.name}
                      {file.isActive && <span className="ml-2 text-xs">(Active)</span>}
                    </div>
                    
                    <div className={`text-sm flex items-center space-x-3 ${
                      theme === 'dark' ? 'text-surface-400' : 'text-surface-600'
                    }`}>
                      <span>{file.sheets.length} sheet{file.sheets.length !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{file.lastModified.toLocaleDateString()}</span>
                    </div>

                    {file.path && (
                      <div className={`text-xs mt-1 truncate ${
                        theme === 'dark' ? 'text-surface-500' : 'text-surface-500'
                      }`}>
                        {file.path}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Save button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveFile(file.id);
                    }}
                    className={`
                      p-1.5 rounded transition-colors
                      ${theme === 'dark'
                        ? 'hover:bg-surface-700 text-surface-400 hover:text-white'
                        : 'hover:bg-surface-200 text-surface-600 hover:text-surface-900'
                      }
                    `}
                    title="Save file"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </button>

                  {/* Close button */}
                  <button
                    onClick={(e) => handleCloseFile(file.id, e)}
                    className={`
                      p-1.5 rounded transition-colors hover:bg-red-500 hover:text-white
                      ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}
                    `}
                    title="Close file"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Sheets list for active file */}
              {file.isActive && file.sheets.length > 1 && (
                <div className="mt-3 pt-3 border-t border-surface-700">
                  <div className={`text-xs font-medium mb-2 ${
                    theme === 'dark' ? 'text-surface-300' : 'text-surface-700'
                  }`}>
                    Sheets:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {file.sheets.map((sheet) => (
                      <span
                        key={sheet.id}
                        className={`
                          px-2 py-1 text-xs rounded border
                          ${theme === 'dark'
                            ? 'bg-surface-700 border-surface-600 text-surface-300'
                            : 'bg-surface-100 border-surface-300 text-surface-700'
                          }
                        `}
                      >
                        {sheet.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      {openFiles.length > 0 && (
        <div className={`pt-4 border-t ${
          theme === 'dark' ? 'border-surface-700' : 'border-surface-200'
        }`}>
          <div className={`text-sm font-medium mb-3 ${
            theme === 'dark' ? 'text-white' : 'text-surface-900'
          }`}>
            Quick Actions
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => {
                const result = await excelFileHandler.importCSV('sample.csv');
                if (onFileOperation) onFileOperation(result);
                refreshFiles();
              }}
              className={`
                px-3 py-1.5 text-xs rounded-lg border transition-colors
                ${theme === 'dark'
                  ? 'bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700'
                  : 'bg-white border-surface-300 text-surface-700 hover:bg-surface-50'
                }
              `}
            >
              📄 Import CSV
            </button>
            
            <button
              onClick={() => {
                excelFileHandler.closeAllFiles();
                refreshFiles();
              }}
              className={`
                px-3 py-1.5 text-xs rounded-lg border transition-colors text-red-500 border-red-500/30 hover:bg-red-500/10
              `}
            >
              Close All Files
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelFileManager;