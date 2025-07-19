import * as Crypto from 'expo-crypto';

// AES encryption constants
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256; // bits
const IV_LENGTH = 16; // bytes
const AUTH_TAG_LENGTH = 16; // bytes

/**
 * Generate a secure key for encryption
 * @returns {Promise<Uint8Array>} - The generated key
 */
export const generateEncryptionKey = async () => {
  const key = await Crypto.getRandomBytesAsync(KEY_LENGTH / 8);
  return key;
};

/**
 * Generate a random initialization vector
 * @returns {Promise<Uint8Array>} - The generated IV
 */
export const generateIV = async () => {
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
  return iv;
};

/**
 * Convert a string to base64
 * @param {string} str - The string to convert
 * @returns {string} - Base64 encoded string
 */
export const stringToBase64 = (str) => {
  return btoa(unescape(encodeURIComponent(str)));
};

/**
 * Convert base64 to string
 * @param {string} base64 - The base64 encoded string
 * @returns {string} - Decoded string
 */
export const base64ToString = (base64) => {
  return decodeURIComponent(escape(atob(base64)));
};

/**
 * Convert array buffer to base64
 * @param {ArrayBuffer} buffer - The array buffer
 * @returns {string} - Base64 encoded string
 */
export const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Convert base64 to array buffer
 * @param {string} base64 - The base64 encoded string
 * @returns {ArrayBuffer} - The array buffer
 */
export const base64ToArrayBuffer = (base64) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Encrypt data using AES encryption
 * @param {string} data - Data to encrypt (base64 string)
 * @param {string} password - Password to derive key from
 * @returns {Promise<{encryptedData: string, iv: string}>} - Encrypted data and IV
 */
export const encryptData = async (data, password) => {
  try {
    // Convert password to a key
    const keyData = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
    
    // Generate IV
    const iv = await generateIV();

    // Convert base64 data to array buffer for encryption
    const dataBuffer = base64ToArrayBuffer(data);
    
    // Encrypt the data (using a simulated implementation since direct AES encryption is not available in expo-crypto)
    // This is a placeholder - in a real implementation, you would use a library that supports AES-GCM
    console.log('Encrypting data of size:', dataBuffer.byteLength);
    
    // For simulation purposes, we'll just encode the data with the password hash and IV
    // In a real implementation, use a proper AES encryption library
    const encryptedData = await simulatedEncrypt(data, keyData, iv);
    
    // Return the encrypted data and IV as base64 strings
    return {
      encryptedData,
      iv: arrayBufferToBase64(iv),
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Decrypt data using AES encryption
 * @param {string} encryptedData - Encrypted data (base64 string)
 * @param {string} iv - Initialization vector (base64 string)
 * @param {string} password - Password to derive key from
 * @returns {Promise<string>} - Decrypted data (base64 string)
 */
export const decryptData = async (encryptedData, iv, password) => {
  try {
    // Convert password to a key
    const keyData = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
    
    // Convert IV from base64 to array buffer
    const ivBuffer = base64ToArrayBuffer(iv);
    
    // Decrypt the data (using a simulated implementation since direct AES decryption is not available in expo-crypto)
    // This is a placeholder - in a real implementation, you would use a library that supports AES-GCM
    console.log('Decrypting data');
    
    // For simulation purposes, we'll just decode the data with the password hash and IV
    // In a real implementation, use a proper AES decryption library
    const decryptedData = await simulatedDecrypt(encryptedData, keyData, ivBuffer);
    
    return decryptedData;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

/**
 * Simulated encryption function - in a real implementation, replace with actual AES encryption
 * @param {string} data - Data to encrypt (base64 string)
 * @param {string} key - Encryption key
 * @param {ArrayBuffer} iv - Initialization vector
 * @returns {Promise<string>} - Encrypted data (base64 string)
 */
const simulatedEncrypt = async (data, key, iv) => {
  // This is a simulation - in a real implementation, use actual AES-GCM encryption
  // For now, we'll just add a marker to indicate encryption
  const ivString = arrayBufferToBase64(iv);
  const keyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA1,
    key
  );
  
  // Combine data with encryption metadata (this is NOT secure, just for simulation)
  const markedData = `ENCRYPTED:${keyHash.substring(0, 8)}:${ivString.substring(0, 8)}:${data}`;
  
  return markedData;
};

/**
 * Simulated decryption function - in a real implementation, replace with actual AES decryption
 * @param {string} encryptedData - Encrypted data (base64 string)
 * @param {string} key - Decryption key
 * @param {ArrayBuffer} iv - Initialization vector
 * @returns {Promise<string>} - Decrypted data (base64 string)
 */
const simulatedDecrypt = async (encryptedData, key, iv) => {
  // This is a simulation - in a real implementation, use actual AES-GCM decryption
  if (!encryptedData.startsWith('ENCRYPTED:')) {
    throw new Error('Invalid encrypted data format');
  }
  
  // Extract the data from our simulated format
  const parts = encryptedData.split(':');
  if (parts.length < 4) {
    throw new Error('Corrupt encrypted data');
  }
  
  const keyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA1,
    key
  );
  
  // Verify the key hash (simulated verification)
  if (parts[1] !== keyHash.substring(0, 8)) {
    throw new Error('Invalid decryption key');
  }
  
  // The original data is in the last part
  return parts.slice(3).join(':');
};
