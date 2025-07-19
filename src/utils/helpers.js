import { FILE_TYPES } from './constants';

/**
 * Get the appropriate icon for a file based on its extension
 * @param {string} fileName - The name of the file
 * @returns {string} - Ionicon name for the file type
 */
export const getFileTypeIcon = (fileName) => {
  if (!fileName) return FILE_TYPES.default;
  
  const extension = fileName.split('.').pop().toLowerCase();
  return FILE_TYPES[extension] || FILE_TYPES.default;
};

/**
 * Format file size in a human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const getFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format a date in a user-friendly format
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  
  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  
  // If it's today
  if (date.toDateString() === now.toDateString()) {
    return 'Today, ' + formatTime(date);
  }
  
  // If it's yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday, ' + formatTime(date);
  }
  
  // If it's within the last 7 days
  const daysDiff = Math.round((now - date) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return `${daysDiff} days ago`;
  }
  
  // Otherwise format as a date
  return `${date.getDate()} ${getMonthName(date.getMonth())} ${date.getFullYear()}`;
};

/**
 * Format time in a user-friendly format
 * @param {Date} date - Date object
 * @returns {string} - Formatted time
 */
const formatTime = (date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // Hour '0' should be '12'
  
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  
  return `${hours}:${minutesStr} ${ampm}`;
};

/**
 * Get month name from month index
 * @param {number} monthIndex - Month index (0-11)
 * @returns {string} - Month name
 */
const getMonthName = (monthIndex) => {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return months[monthIndex];
};

/**
 * Generate a random key for encryption
 * @param {number} length - Length of the key
 * @returns {string} - Random key
 */
export const generateRandomKey = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

/**
 * Check if a file is an image
 * @param {string} fileName - The name of the file
 * @returns {boolean} - True if the file is an image
 */
export const isImage = (fileName) => {
  if (!fileName) return false;
  
  const extension = fileName.split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension);
};

/**
 * Validate file name
 * @param {string} fileName - The name of the file
 * @returns {boolean} - True if the file name is valid
 */
export const isValidFileName = (fileName) => {
  if (!fileName) return false;
  
  // Check if the file name contains only valid characters
  const validRegex = /^[a-zA-Z0-9_\-. ()]+$/;
  return validRegex.test(fileName);
};

/**
 * Truncate a string if it's longer than the specified length
 * @param {string} str - The string to truncate
 * @param {number} maxLength - The maximum length
 * @returns {string} - The truncated string
 */
export const truncateString = (str, maxLength = 30) => {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  
  return str.slice(0, maxLength - 3) + '...';
};
