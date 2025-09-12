import React, { useRef, useState } from 'react';
import FileUploadService, { SelectedFile } from '../services/fileUploadService';
import './FileUpload.css';

interface FileUploadProps {
  selectedFiles: SelectedFile[];
  onFilesSelected: (files: SelectedFile[]) => void;
  onFileRemove: (fileId: string) => void;
  disabled?: boolean;
  onAttachClick?: () => void;
}

// Export the openFileDialog function through ref
export interface FileUploadRef {
  openFileDialog: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  selectedFiles,
  onFilesSelected,
  onFileRemove,
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = async (files: FileList | File[]) => {
    try {
      const fileArray = Array.from(files);
      const { valid, errors } = FileUploadService.validateFiles(files as FileList);

      if (errors.length > 0) {
        // Show user-friendly error messages
        const errorTitle = errors.length === 1 ? 'File Upload Error' : 'File Upload Errors';
        const errorList = errors.map(error => `• ${error}`).join('\n');
        alert(`${errorTitle}:\n\n${errorList}`);
        return;
      }

      const newSelectedFiles: SelectedFile[] = [];
      
      for (const file of valid) {
        try {
          const preview = await FileUploadService.generateFilePreview(file);
          newSelectedFiles.push({
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            preview: preview || undefined
          });
        } catch (error) {
          console.warn(`Failed to generate preview for ${file.name}:`, error);
          // Add file without preview
          newSelectedFiles.push({
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            file,
            name: file.name,
            size: file.size,
            type: file.type
          });
        }
      }

      onFilesSelected([...selectedFiles, ...newSelectedFiles]);
      
    } catch (error) {
      console.error('Error processing files:', error);
      alert('An error occurred while processing the files. Please try again.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const openFileDialog = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  const maxTotalSize = 25 * 1024 * 1024; // 25MB

  return (
    <div className="file-upload-container">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.xlsx,.xls,.csv"
        onChange={handleInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {/* Drag and Drop Zone (shows when files are being dragged) */}
      {dragActive && (
        <div
          className="drag-drop-overlay"
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="drag-drop-content">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path
                d="M24 4L36 16H28V32H20V16H12L24 4Z"
                fill="currentColor"
              />
              <path
                d="M8 40V36H40V40H8Z"
                fill="currentColor"
              />
            </svg>
            <p>Drop files here to upload</p>
            <p className="drag-drop-hint">
              Images, PDFs, Excel files, CSV (max 5 files, 25MB total)
            </p>
          </div>
        </div>
      )}

      {/* Selected Files Preview - Compact Design */}
      {selectedFiles.length > 0 && (
        <div className="selected-files-compact">
          <div className="files-summary">
            <div className="files-info">
              <span className="files-count">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
              </span>
              <span className="files-size">
                {FileUploadService.formatFileSize(totalSize)}
              </span>
            </div>
            
            {/* Size warning - inline */}
            {totalSize > maxTotalSize * 0.8 && (
              <div className={`size-warning-inline ${totalSize > maxTotalSize ? 'size-exceeded' : ''}`}>
                {totalSize > maxTotalSize ? '⚠️ Size limit exceeded' : '⚠️ Close to limit'}
              </div>
            )}
          </div>
          
          <div className="selected-files-horizontal">
            {selectedFiles.map((file) => (
              <div key={file.id} className="file-chip-compact">
                <div className="file-content">
                  <span className="file-icon-small">
                    {FileUploadService.getFileIcon(file.type)}
                  </span>
                  <span className="file-name-short" title={file.name}>
                    {file.name.length > 12 ? `${file.name.substring(0, 9)}...` : file.name}
                  </span>
                  {file.preview && (
                    <div className="file-preview-tiny">
                      <img src={file.preview} alt="" />
                    </div>
                  )}
                </div>
                
                <button
                  className="remove-file-button-small"
                  onClick={() => onFileRemove(file.id)}
                  title="Remove file"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drag handlers for the entire container */}
      <div
        className="drag-handlers"
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      />
    </div>
  );
};

export default FileUpload;