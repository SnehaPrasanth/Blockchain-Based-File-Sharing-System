// File types and their corresponding Ionicons
export const FILE_TYPES = {
  // Documents
  pdf: 'document-text-outline',
  doc: 'document-outline',
  docx: 'document-outline',
  txt: 'document-text-outline',
  rtf: 'document-text-outline',
  
  // Spreadsheets
  xls: 'grid-outline',
  xlsx: 'grid-outline',
  csv: 'grid-outline',
  
  // Presentations
  ppt: 'easel-outline',
  pptx: 'easel-outline',
  
  // Images
  jpg: 'image-outline',
  jpeg: 'image-outline',
  png: 'image-outline',
  gif: 'image-outline',
  svg: 'image-outline',
  webp: 'image-outline',
  
  // Audio
  mp3: 'musical-note-outline',
  wav: 'musical-note-outline',
  ogg: 'musical-note-outline',
  
  // Video
  mp4: 'videocam-outline',
  mov: 'videocam-outline',
  avi: 'videocam-outline',
  mkv: 'videocam-outline',
  
  // Archives
  zip: 'archive-outline',
  rar: 'archive-outline',
  tar: 'archive-outline',
  gz: 'archive-outline',
  
  // Code
  html: 'code-outline',
  css: 'code-outline',
  js: 'code-slash-outline',
  json: 'code-slash-outline',
  
  // Executables
  exe: 'cube-outline',
  apk: 'logo-android',
  ipa: 'logo-apple',
  
  // Default
  default: 'document-outline',
};

// Maximum file size (in bytes)
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// Database tables
export const TABLES = {
  USERS: 'users',
  FILES: 'files',
  FILE_SHARES: 'file_shares',
  AUDIT_LOGS: 'audit_logs',
};

// API endpoints (not used in this implementation but kept for reference)
export const API = {
  FILES: '/api/files',
  UPLOAD: '/api/files/upload',
  DOWNLOAD: '/api/files/download',
};

// Messages
export const MESSAGES = {
  UPLOAD_SUCCESS: 'File uploaded successfully',
  UPLOAD_ERROR: 'Failed to upload file',
  DOWNLOAD_SUCCESS: 'File downloaded successfully',
  DOWNLOAD_ERROR: 'Failed to download file',
  DELETE_SUCCESS: 'File deleted successfully',
  DELETE_ERROR: 'Failed to delete file',
  NO_FILES: 'No files found',
  LOGIN_REQUIRED: 'Please login to access this feature',
};
