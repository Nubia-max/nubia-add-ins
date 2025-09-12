import cloudApi from './cloudApi';

export interface FileUploadError extends Error {
  code: 'FILE_TOO_LARGE' | 'INVALID_TYPE' | 'TOO_MANY_FILES' | 'TOTAL_SIZE_EXCEEDED' | 'UPLOAD_FAILED';
}

export interface SelectedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
  error?: string;
}

export class FileUploadService {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
  private static readonly MAX_FILES = 5;
  private static readonly ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ];

  static validateFiles(files: FileList): { valid: File[], errors: string[] } {
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    // Check number of files
    if (files.length > this.MAX_FILES) {
      errors.push(`Maximum ${this.MAX_FILES} files allowed. You selected ${files.length} files.`);
      return { valid: validFiles, errors };
    }

    if (files.length === 0) {
      errors.push('No files selected');
      return { valid: validFiles, errors };
    }

    // Check each file
    let totalSize = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size
      if (file.size > this.MAX_FILE_SIZE) {
        const fileSizeMB = Math.round(file.size / 1024 / 1024);
        errors.push(`${file.name} is too large (${fileSizeMB}MB - max 10MB allowed)`);
        continue;
      }

      // Check file type
      if (!this.ALLOWED_TYPES.includes(file.type)) {
        const fileExtension = file.name.split('.').pop()?.toUpperCase() || 'unknown';
        errors.push(`${file.name} (${fileExtension}) is not a supported file type`);
        continue;
      }

      totalSize += file.size;
      validFiles.push(file);
    }

    // Check total size
    if (totalSize > this.MAX_TOTAL_SIZE) {
      const totalSizeMB = Math.round(totalSize / 1024 / 1024);
      errors.push(`Total file size (${totalSizeMB}MB) exceeds the 25MB limit`);
      return { valid: [], errors };
    }

    return { valid: validFiles, errors };
  }

  static isImageType(type: string): boolean {
    return type.startsWith('image/');
  }

  static isPdfType(type: string): boolean {
    return type === 'application/pdf';
  }

  static isSpreadsheetType(type: string): boolean {
    return [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ].includes(type);
  }

  static getFileIcon(type: string): string {
    if (this.isImageType(type)) return '🖼️';
    if (this.isPdfType(type)) return '📄';
    if (this.isSpreadsheetType(type)) return '📊';
    return '📎';
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static generateFilePreview(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      if (this.isImageType(file.type)) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      } else {
        resolve(null);
      }
    });
  }

  static async sendMessageWithFiles(message: string, files: SelectedFile[]): Promise<any> {
    try {
      if (!message && files.length === 0) {
        throw new Error('Message or files are required');
      }

      // Check if cloudApi is available and authenticated
      if (!(await cloudApi.isAuthenticated())) {
        throw new Error('Please log in to upload files');
      }

      // Use the proper file upload endpoint
      const baseUrl = process.env.NODE_ENV === 'production' ? 'https://api.nubia.ai' : 'http://localhost:3001';
      
      const formData = new FormData();
      
      // Add message
      if (message) {
        formData.append('message', message);
      }
      
      // Add files
      files.forEach((selectedFile) => {
        formData.append('files', selectedFile.file);
      });
      
      formData.append('includeContext', 'true');

      const response = await fetch(`${baseUrl}/api/chat/with-files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudApi.getToken()}`
        },
        body: formData
      });

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || `HTTP ${response.status}`;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      return {
        success: true,
        message: result.message || 'Files processed successfully',
        type: result.type || 'chat',
        excelData: result.excelData,
        filesProcessed: files.length
      };
      
    } catch (error) {
      console.error('File upload error:', error);
      
      // Re-throw with user-friendly message if needed
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('An unexpected error occurred during upload');
      }
    }
  }
}

export default FileUploadService;