import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { Buffer } from 'buffer';
import AsyncStorage from '@react-native-async-storage/async-storage';

// IPFS configuration using public gateways and Infura (if available)
const IPFS_API_URL = process.env.EXPO_PUBLIC_IPFS_API_URL || 'https://ipfs.infura.io:5001/api/v0';

// Multiple IPFS gateways for better reliability (fallback mechanism)
const IPFS_GATEWAYS = [
  process.env.EXPO_PUBLIC_IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs',
  'https://gateway.pinata.cloud/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://ipfs.fleek.co/ipfs',
  'https://dweb.link/ipfs'
];

// Default primary gateway
const IPFS_GATEWAY_URL = IPFS_GATEWAYS[0];

// Optional Infura project ID and secret for more reliable service
const INFURA_PROJECT_ID = process.env.EXPO_PUBLIC_INFURA_PROJECT_ID || '';
const INFURA_PROJECT_SECRET = process.env.EXPO_PUBLIC_INFURA_PROJECT_SECRET || '';

// AsyncStorage keys for caching
const ASYNC_STORAGE_KEYS = {
  PREFERRED_GATEWAY: 'ipfs_preferred_gateway',
  FILE_METADATA_PREFIX: 'ipfs_metadata_',
  FILE_CACHE_PREFIX: 'ipfs_cache_',
  FILE_STATUS_PREFIX: 'ipfs_status_',
  GATEWAY_SPEED_TEST: 'ipfs_gateway_speeds',
  CACHE_INDEX: 'ipfs_cache_index',
  CACHE_SIZE: 'ipfs_cache_size'
};

// Cache configuration
const CACHE_CONFIG = {
  MAX_CACHE_SIZE: 50 * 1024 * 1024, // 50 MB max cache size
  MAX_CACHE_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
  MAX_CACHE_ITEMS: 100 // Maximum number of files in cache
};

/**
 * Find the fastest IPFS gateway and store it in AsyncStorage
 * @returns {Promise<string>} - The URL of the fastest gateway
 */
export const findFastestGateway = async () => {
  try {
    // Check if we have a recent speed test result
    const cachedResult = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.GATEWAY_SPEED_TEST);
    if (cachedResult) {
      const { timestamp, fastestGateway } = JSON.parse(cachedResult);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      // If the test was run in the last hour, use the cached result
      if (timestamp > oneHourAgo && fastestGateway) {
        console.log('Using cached fastest gateway:', fastestGateway);
        return fastestGateway;
      }
    }
    
    console.log('Testing IPFS gateway speeds...');
    const testResults = [];
    
    // Use a well-known IPFS CID for testing (the IPFS logo)
    const testCid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
    
    // Test each gateway in parallel
    const tests = IPFS_GATEWAYS.map(async (gateway, index) => {
      const startTime = Date.now();
      try {
        const testUrl = `${gateway}/${testCid}/readme`;
        const response = await axios.get(testUrl, { 
          timeout: 5000,
          // Just fetch the headers, no need for the full content
          headers: { 'Range': 'bytes=0-1000' }
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        if (response.status === 200 || response.status === 206) {
          console.log(`Gateway ${gateway} responded in ${responseTime}ms`);
          testResults.push({ gateway, responseTime });
        }
      } catch (error) {
        console.warn(`Gateway ${gateway} failed speed test:`, error.message);
      }
    });
    
    await Promise.all(tests);
    
    if (testResults.length === 0) {
      console.log('No gateways responded to speed test, using default');
      return IPFS_GATEWAY_URL;
    }
    
    // Sort by response time (fastest first)
    testResults.sort((a, b) => a.responseTime - b.responseTime);
    const fastestGateway = testResults[0].gateway;
    
    // Cache the result
    await AsyncStorage.setItem(
      ASYNC_STORAGE_KEYS.GATEWAY_SPEED_TEST, 
      JSON.stringify({
        timestamp: Date.now(),
        fastestGateway,
        allResults: testResults
      })
    );
    
    console.log(`Fastest gateway is ${fastestGateway} (${testResults[0].responseTime}ms)`);
    return fastestGateway;
  } catch (error) {
    console.error('Error finding fastest gateway:', error);
    return IPFS_GATEWAY_URL; // Fall back to default
  }
};

/**
 * Get the preferred IPFS gateway, either from AsyncStorage or by finding the fastest
 * @param {boolean} forceRefresh - Whether to force a refresh of the speed test
 * @returns {Promise<string>} - The URL of the preferred gateway
 */
export const getPreferredGateway = async (forceRefresh = false) => {
  try {
    if (forceRefresh) {
      return await findFastestGateway();
    }
    
    // Check if we have a stored preferred gateway
    const storedGateway = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.PREFERRED_GATEWAY);
    if (storedGateway) {
      return storedGateway;
    }
    
    // Otherwise find the fastest gateway
    const fastestGateway = await findFastestGateway();
    
    // Store it for future use
    await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.PREFERRED_GATEWAY, fastestGateway);
    
    return fastestGateway;
  } catch (error) {
    console.error('Error getting preferred gateway:', error);
    return IPFS_GATEWAY_URL; // Fall back to default
  }
};

// Helper function to create FormData from file information
const createFormData = (fileData, fileName) => {
  // Convert base64 to Blob for FormData
  const byteCharacters = atob(fileData);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray]);
  
  // Create FormData
  const formData = new FormData();
  formData.append('file', blob, fileName);
  
  return formData;
};

/**
 * Upload a file to IPFS using public IPFS API or Infura
 * @param {string} fileData - Base64 encoded file data
 * @param {string} fileName - Name of the file
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<string>} - CID of the uploaded file
 */
export const uploadToFilecoin = async (fileData, fileName, onProgress = () => {}) => {
  try {
    // Report start of upload
    onProgress(10);
    
    // Create temporary file from base64 data
    const tempFilePath = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(tempFilePath, fileData, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Read file info
    const fileInfo = await FileSystem.getInfoAsync(tempFilePath);
    onProgress(20);
    
    // Create form data for multipart upload
    const formData = new FormData();
    formData.append('file', {
      uri: tempFilePath,
      name: fileName,
      type: 'application/octet-stream',
    });
    
    // Set headers for the request
    const headers = {
      'Content-Type': 'multipart/form-data',
    };
    
    // Add authentication if Infura credentials are available
    if (INFURA_PROJECT_ID && INFURA_PROJECT_SECRET) {
      const auth = 'Basic ' + Buffer.from(INFURA_PROJECT_ID + ':' + INFURA_PROJECT_SECRET).toString('base64');
      headers['Authorization'] = auth;
    }
    
    try {
      // Try uploading to primary IPFS API
      console.log(`Attempting to upload to primary IPFS API: ${IPFS_API_URL}`);
      const uploadResponse = await axios.post(
        `${IPFS_API_URL}/add`, 
        formData,
        {
          headers: headers,
          timeout: 60000, // 60 second timeout
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 70) / progressEvent.total
            );
            onProgress(20 + percentCompleted);
          },
        }
      );
      
      // Handle response to get CID
      const cid = uploadResponse.data.Hash || uploadResponse.data.hash || uploadResponse.data.cid;
      
      if (!cid) {
        throw new Error('Failed to retrieve CID from upload response');
      }
      
      // Final progress
      onProgress(100);
      
      console.log('File uploaded to IPFS with CID:', cid);
      
      // Clean up temp file
      await FileSystem.deleteAsync(tempFilePath);
      
      return cid;
    } catch (uploadError) {
      console.warn('Primary IPFS API upload failed:', uploadError.message);
      console.log('Trying alternative upload strategies...');
      
      // If we get here, the main IPFS API failed, so we'll use a fallback strategy
      // For fallback we can:
      // 1. Use Infura's IPFS API endpoint directly if credentials exist
      // 2. For now, we'll need to fail because we can't upload without an API
      //    (Public gateways don't typically allow uploads, only retrievals)
      
      if (INFURA_PROJECT_ID && INFURA_PROJECT_SECRET) {
        try {
          console.log('Attempting upload via Infura direct IPFS API');
          onProgress(30);
          
          const infuraHeaders = {
            'Content-Type': 'multipart/form-data',
            'Authorization': 'Basic ' + Buffer.from(INFURA_PROJECT_ID + ':' + INFURA_PROJECT_SECRET).toString('base64')
          };
          
          const infuraResponse = await axios.post(
            'https://ipfs.infura.io:5001/api/v0/add',
            formData,
            {
              headers: infuraHeaders,
              timeout: 60000,
              onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round(
                  (progressEvent.loaded * 60) / progressEvent.total
                );
                onProgress(30 + percentCompleted);
              },
            }
          );
          
          const infuraCid = infuraResponse.data.Hash || infuraResponse.data.hash || infuraResponse.data.cid;
          
          if (!infuraCid) {
            throw new Error('Failed to retrieve CID from Infura response');
          }
          
          // Final progress
          onProgress(100);
          
          console.log('File uploaded to IPFS via Infura with CID:', infuraCid);
          
          // Clean up temp file
          await FileSystem.deleteAsync(tempFilePath);
          
          return infuraCid;
        } catch (infuraError) {
          console.error('Infura upload failed:', infuraError.message);
          // Continue to cleanup and error
        }
      }
      
      // Clean up temp file before throwing error
      await FileSystem.deleteAsync(tempFilePath);
      throw new Error(`All IPFS upload attempts failed. Primary error: ${uploadError.message}`);
    }
  } catch (error) {
    console.error('Error in IPFS upload process:', error);
    throw new Error(`IPFS upload failed: ${error.message}`);
  }
};

/**
 * Download a file from IPFS
 * @param {string} cid - CID of the file to download
 * @param {Function} onProgress - Progress callback function
 * @param {boolean} skipCache - Whether to skip the local cache and force a new download
 * @returns {Promise<string>} - Base64 encoded file data
 */
export const downloadFromFilecoin = async (cid, onProgress = () => {}, skipCache = false) => {
  let lastError = null;
  
  // Start progress
  onProgress(5);
  
  // Check if we have this file cached locally
  if (!skipCache) {
    try {
      const cacheKey = `${ASYNC_STORAGE_KEYS.FILE_CACHE_PREFIX}${cid}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (cachedData) {
        console.log(`Using cached data for CID: ${cid}`);
        onProgress(100);
        return cachedData;
      }
    } catch (cacheError) {
      console.warn('Error checking cache:', cacheError);
      // Continue with download if cache check fails
    }
  }
  
  onProgress(10);
  
  // Create temporary file path for download
  const tempFilePath = FileSystem.cacheDirectory + 'ipfs_' + cid;
  
  // First try to use the preferred/fastest gateway
  try {
    const preferredGateway = await getPreferredGateway();
    const preferredUrl = `${preferredGateway}/${cid}`;
    
    console.log(`Attempting download from preferred gateway: ${preferredGateway}`);
    
    // Try downloading from the preferred gateway
    try {
      // Download the file
      const downloadResumable = FileSystem.createDownloadResumable(
        preferredUrl,
        tempFilePath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          // Distribute progress from 10% to 90%
          const progressPercent = Math.round(10 + progress * 80);
          onProgress(Math.min(progressPercent, 90));
        }
      );
      
      // Start the download
      const result = await downloadResumable.downloadAsync();
      onProgress(90);
      
      if (!result || !result.uri) {
        throw new Error('Download failed with empty result');
      }
      
      // Read file as base64
      const base64Data = await FileSystem.readAsStringAsync(result.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Cache the result for future use
      try {
        const cacheKey = `${ASYNC_STORAGE_KEYS.FILE_CACHE_PREFIX}${cid}`;
        await AsyncStorage.setItem(cacheKey, base64Data);
        console.log(`Cached file data for CID: ${cid}`);
        
        // Track this file in the cache system
        const fileSize = base64Data.length * 0.75; // Approximate binary size from base64
        await trackCachedFile(cid, fileSize);
      } catch (cacheError) {
        console.warn('Failed to cache file data:', cacheError);
        // Continue anyway, this is non-critical
      }
      
      // Clean up temp file
      await FileSystem.deleteAsync(tempFilePath, { idempotent: true });
      
      // Complete progress
      onProgress(100);
      console.log(`Successfully downloaded from preferred gateway: ${preferredGateway}`);
      
      return base64Data;
    } catch (preferredError) {
      console.warn(`Preferred gateway failed: ${preferredError.message}`);
      // Fall back to trying all gateways in sequence
    }
  } catch (gatewayError) {
    console.warn('Error getting preferred gateway:', gatewayError);
    // Continue with fallbacks
  }
  
  // Try each gateway in sequence until one works
  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const gateway = IPFS_GATEWAYS[i];
    const downloadUrl = `${gateway}/${cid}`;
    
    try {
      console.log(`Attempting download from gateway ${i+1}/${IPFS_GATEWAYS.length}:`, downloadUrl);
      
      // Download the file
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        tempFilePath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          // Distribute progress from 20% to 90% based on current gateway
          const progressPercent = Math.round(20 + progress * 70);
          onProgress(Math.min(progressPercent, 90));
        }
      );
      
      // Start the download
      const result = await downloadResumable.downloadAsync();
      onProgress(90);
      
      if (!result || !result.uri) {
        throw new Error('Download failed with empty result');
      }
      
      // Read file as base64
      const base64Data = await FileSystem.readAsStringAsync(result.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Cache the result for future use
      try {
        const cacheKey = `${ASYNC_STORAGE_KEYS.FILE_CACHE_PREFIX}${cid}`;
        await AsyncStorage.setItem(cacheKey, base64Data);
        console.log(`Cached file data for CID: ${cid}`);
        
        // Track this file in the cache system
        const fileSize = base64Data.length * 0.75; // Approximate binary size from base64
        await trackCachedFile(cid, fileSize);
        
        // Update the preferred gateway with this successful one
        await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.PREFERRED_GATEWAY, gateway);
        console.log(`Updated preferred gateway to: ${gateway}`);
      } catch (cacheError) {
        console.warn('Failed to cache file data:', cacheError);
        // Continue anyway, this is non-critical
      }
      
      // Clean up temp file
      await FileSystem.deleteAsync(tempFilePath, { idempotent: true });
      
      // Complete progress
      onProgress(100);
      console.log(`Successfully downloaded from gateway: ${gateway}`);
      
      return base64Data;
    } catch (error) {
      console.warn(`Failed to download from gateway ${gateway}:`, error.message);
      lastError = error;
      
      // Report partial progress to show we're trying other gateways
      onProgress(20 + (i + 1) * 3);
      
      // Continue to next gateway
      continue;
    }
  }
  
  // If we get here, all gateways failed
  console.error('All IPFS gateways failed:', lastError);
  throw new Error('Failed to download from all IPFS gateways. Please try again later.');
};

/**
 * Mark a file for deletion from IPFS by removing the pin and clearing local cache
 * Note: IPFS content is immutable, so this only unpins content and allows it to be garbage collected
 * @param {string} cid - CID of the file to delete
 * @returns {Promise<boolean>} - Success status
 */
export const deleteFromFilecoin = async (cid) => {
  try {
    console.log(`Attempting to unpin content with CID ${cid}`);
    
    // Clean up any cached data for this CID using the cache management system
    try {
      await removeCachedFile(cid);
      console.log(`Removed cached data for CID: ${cid}`);
    } catch (cacheError) {
      console.warn('Failed to remove cached file data:', cacheError);
      // Continue anyway, this is non-critical
    }
    
    // Set headers for the request
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add authentication if Infura credentials are available
    if (INFURA_PROJECT_ID && INFURA_PROJECT_SECRET) {
      const auth = 'Basic ' + Buffer.from(INFURA_PROJECT_ID + ':' + INFURA_PROJECT_SECRET).toString('base64');
      headers['Authorization'] = auth;
    }
    
    // Try to unpin the content 
    try {
      const response = await axios.post(
        `${IPFS_API_URL}/pin/rm?arg=${cid}`,
        {},
        { headers }
      );
      
      console.log(`File with CID ${cid} has been successfully unpinned`);
      return true;
    } catch (pinError) {
      // If we can't unpin (no credentials or CID not found), just log it
      console.log(`Note: Could not unpin CID ${cid}: ${pinError.message}`);
      
      // Since IPFS is content-addressed and immutable, even if we can't unpin
      // we can consider this a "success" from the user perspective as the reference
      // will be removed from our database
      return true;
    }
  } catch (error) {
    console.error('Error marking file for deletion:', error);
    // Return true anyway since we'll remove the reference from our database
    // Even if the unpinning failed, the content may eventually be garbage collected
    return true;
  }
};

/**
 * Check if a CID exists and is retrievable on IPFS
 * @param {string} cid - CID to check
 * @param {boolean} skipCache - Whether to skip the cache and check directly
 * @returns {Promise<boolean>} - Whether the CID exists and is retrievable
 */
export const checkCidStatus = async (cid, skipCache = false) => {
  // Check if we have a cached status first
  if (!skipCache) {
    try {
      const statusKey = `${ASYNC_STORAGE_KEYS.FILE_STATUS_PREFIX}${cid}`;
      const cachedStatus = await AsyncStorage.getItem(statusKey);
      
      if (cachedStatus) {
        const { status, timestamp } = JSON.parse(cachedStatus);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        // Use cached status if it's recent (within the last hour)
        if (timestamp > oneHourAgo) {
          console.log(`Using cached status for CID ${cid}: ${status}`);
          return status === true;
        }
      }
    } catch (cacheError) {
      console.warn('Error checking cached status:', cacheError);
      // Continue with live check if cache fails
    }
  }
  
  try {
    // First try to check if we already have this file cached locally
    try {
      const cacheKey = `${ASYNC_STORAGE_KEYS.FILE_CACHE_PREFIX}${cid}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (cachedData) {
        console.log(`CID ${cid} exists in local cache`);
        
        // Update the status cache
        await AsyncStorage.setItem(
          `${ASYNC_STORAGE_KEYS.FILE_STATUS_PREFIX}${cid}`,
          JSON.stringify({ status: true, timestamp: Date.now() })
        );
        
        return true;
      }
    } catch (localCacheError) {
      console.warn('Error checking local file cache:', localCacheError);
    }
    
    // Try our preferred gateway first (likely to be fastest)
    try {
      const preferredGateway = await getPreferredGateway();
      console.log(`Checking CID ${cid} on preferred gateway: ${preferredGateway}`);
      
      const preferredResponse = await axios.head(`${preferredGateway}/${cid}`, {
        timeout: 5000 // 5 second timeout
      });
      
      if (preferredResponse.status === 200) {
        console.log(`CID ${cid} is available on preferred gateway`);
        
        // Cache the positive result
        await AsyncStorage.setItem(
          `${ASYNC_STORAGE_KEYS.FILE_STATUS_PREFIX}${cid}`,
          JSON.stringify({ status: true, timestamp: Date.now() })
        );
        
        return true;
      }
    } catch (preferredError) {
      console.warn(`Preferred gateway check failed for CID ${cid}:`, preferredError.message);
      // Continue with other checks
    }
    
    // Next try to check if it's pinned using the IPFS API
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add authentication if Infura credentials are available
    if (INFURA_PROJECT_ID && INFURA_PROJECT_SECRET) {
      const auth = 'Basic ' + Buffer.from(INFURA_PROJECT_ID + ':' + INFURA_PROJECT_SECRET).toString('base64');
      headers['Authorization'] = auth;
    }
    
    try {
      // Try to see if the content is pinned
      const pinResponse = await axios.post(
        `${IPFS_API_URL}/pin/ls?arg=${cid}`,
        {},
        { 
          headers,
          timeout: 10000 // 10 second timeout
        }
      );
      
      // If we get a successful response, the CID exists and is pinned
      console.log(`CID ${cid} is pinned`);
      
      // Cache the positive result
      await AsyncStorage.setItem(
        `${ASYNC_STORAGE_KEYS.FILE_STATUS_PREFIX}${cid}`,
        JSON.stringify({ status: true, timestamp: Date.now() })
      );
      
      return true;
    } catch (apiError) {
      console.log('CID not pinned or API access restricted, falling back to gateway checks:', apiError.message);
      
      // Try each gateway until we find one that has the content
      for (const gateway of IPFS_GATEWAYS) {
        try {
          console.log(`Checking CID ${cid} availability on gateway: ${gateway}`);
          const gatewayResponse = await axios.head(`${gateway}/${cid}`, {
            timeout: 5000, // 5 second timeout per gateway
          });
          
          if (gatewayResponse.status === 200) {
            console.log(`CID ${cid} is available on gateway: ${gateway}`);
            
            // Cache the positive result
            await AsyncStorage.setItem(
              `${ASYNC_STORAGE_KEYS.FILE_STATUS_PREFIX}${cid}`,
              JSON.stringify({ status: true, timestamp: Date.now() })
            );
            
            return true;
          }
        } catch (gatewayError) {
          console.warn(`CID ${cid} not available on gateway ${gateway}:`, gatewayError.message);
          // Continue to next gateway
        }
      }
      
      // If we've tried all gateways and none worked, the content is likely not available
      console.log(`CID ${cid} was not found on any IPFS gateway`);
      
      // Cache the negative result
      await AsyncStorage.setItem(
        `${ASYNC_STORAGE_KEYS.FILE_STATUS_PREFIX}${cid}`,
        JSON.stringify({ status: false, timestamp: Date.now() })
      );
      
      return false;
    }
  } catch (error) {
    console.error('Error checking CID status:', error);
    return false;
  }
};

/**
 * Add a file to the cache index for tracking
 * @param {string} cid - CID of the file
 * @param {number} size - Size of the file in bytes
 * @returns {Promise<void>}
 */
export const trackCachedFile = async (cid, size) => {
  try {
    // Get the current cache index
    let cacheIndex = {};
    try {
      const indexData = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CACHE_INDEX);
      if (indexData) {
        cacheIndex = JSON.parse(indexData);
      }
    } catch (error) {
      console.warn('Error reading cache index:', error);
      // Continue with empty index if it doesn't exist
    }
    
    // Add or update this file in the index
    cacheIndex[cid] = {
      size,
      timestamp: Date.now()
    };
    
    // Save the updated index
    await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.CACHE_INDEX, JSON.stringify(cacheIndex));
    
    // Update the total cache size
    let totalCacheSize = 0;
    try {
      const sizeData = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CACHE_SIZE);
      if (sizeData) {
        totalCacheSize = parseInt(sizeData, 10);
      }
    } catch (error) {
      console.warn('Error reading cache size:', error);
      // Continue with size 0 if it doesn't exist
    }
    
    // Add this file's size to the total (if not already tracked)
    totalCacheSize += size;
    await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.CACHE_SIZE, totalCacheSize.toString());
    
    // Check if we need to clean up the cache
    if (totalCacheSize > CACHE_CONFIG.MAX_CACHE_SIZE) {
      await cleanCache();
    }
  } catch (error) {
    console.error('Error tracking cached file:', error);
    // Non-critical error, don't throw
  }
};

/**
 * Clean the cache by removing old or excess files
 * @returns {Promise<void>}
 */
export const cleanCache = async () => {
  try {
    console.log('Starting cache cleanup process');
    
    // Get the current cache index
    let cacheIndex = {};
    try {
      const indexData = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CACHE_INDEX);
      if (indexData) {
        cacheIndex = JSON.parse(indexData);
      } else {
        console.log('No cache index found, nothing to clean');
        return;
      }
    } catch (error) {
      console.warn('Error reading cache index:', error);
      return;
    }
    
    // Convert the index to an array and sort by timestamp (oldest first)
    const cacheEntries = Object.entries(cacheIndex).map(([cid, data]) => ({
      cid,
      ...data
    }));
    
    // Sort by timestamp (oldest first)
    cacheEntries.sort((a, b) => a.timestamp - b.timestamp);
    
    // Check if we have too many items
    if (cacheEntries.length > CACHE_CONFIG.MAX_CACHE_ITEMS) {
      console.log(`Cache has ${cacheEntries.length} items, max is ${CACHE_CONFIG.MAX_CACHE_ITEMS}`);
      const excessItems = cacheEntries.length - CACHE_CONFIG.MAX_CACHE_ITEMS;
      
      // Remove the oldest items
      for (let i = 0; i < excessItems; i++) {
        const item = cacheEntries[i];
        await removeCachedFile(item.cid);
      }
      
      // Return early since we've already cleaned up
      return;
    }
    
    // Check if we've exceeded the max cache size
    let totalCacheSize = 0;
    try {
      const sizeData = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CACHE_SIZE);
      if (sizeData) {
        totalCacheSize = parseInt(sizeData, 10);
      }
    } catch (error) {
      console.warn('Error reading cache size:', error);
    }
    
    if (totalCacheSize > CACHE_CONFIG.MAX_CACHE_SIZE) {
      console.log(`Cache size ${totalCacheSize} bytes exceeds max of ${CACHE_CONFIG.MAX_CACHE_SIZE} bytes`);
      
      // Remove oldest files until we're under the limit
      let removedSize = 0;
      for (const item of cacheEntries) {
        await removeCachedFile(item.cid);
        removedSize += item.size;
        
        if (totalCacheSize - removedSize <= CACHE_CONFIG.MAX_CACHE_SIZE * 0.8) {
          // Stop when we've reduced to 80% of max
          break;
        }
      }
    }
    
    // Check for files older than max age
    const maxAgeTimestamp = Date.now() - CACHE_CONFIG.MAX_CACHE_AGE;
    for (const item of cacheEntries) {
      if (item.timestamp < maxAgeTimestamp) {
        await removeCachedFile(item.cid);
      } else {
        // Since list is sorted by time, we can stop checking once we hit a new file
        break;
      }
    }
    
    console.log('Cache cleanup complete');
  } catch (error) {
    console.error('Error cleaning cache:', error);
    // Non-critical error, don't throw
  }
};

/**
 * Remove a file from the cache
 * @param {string} cid - CID of the file to remove
 * @returns {Promise<void>}
 */
export const removeCachedFile = async (cid) => {
  try {
    console.log(`Removing cached file ${cid}`);
    
    // Get the file size from the index
    let fileSize = 0;
    let cacheIndex = {};
    
    try {
      const indexData = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CACHE_INDEX);
      if (indexData) {
        cacheIndex = JSON.parse(indexData);
        if (cacheIndex[cid]) {
          fileSize = cacheIndex[cid].size;
        }
      }
    } catch (error) {
      console.warn('Error reading cache index for removal:', error);
    }
    
    // Remove the file from AsyncStorage
    await AsyncStorage.removeItem(`${ASYNC_STORAGE_KEYS.FILE_CACHE_PREFIX}${cid}`);
    await AsyncStorage.removeItem(`${ASYNC_STORAGE_KEYS.FILE_STATUS_PREFIX}${cid}`);
    
    // Update the index
    if (cacheIndex[cid]) {
      delete cacheIndex[cid];
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.CACHE_INDEX, JSON.stringify(cacheIndex));
    }
    
    // Update the total cache size
    if (fileSize > 0) {
      try {
        const sizeData = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CACHE_SIZE);
        if (sizeData) {
          let totalCacheSize = parseInt(sizeData, 10);
          totalCacheSize = Math.max(0, totalCacheSize - fileSize);
          await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.CACHE_SIZE, totalCacheSize.toString());
        }
      } catch (error) {
        console.warn('Error updating cache size after removal:', error);
      }
    }
    
    console.log(`Successfully removed ${cid} from cache`);
  } catch (error) {
    console.error(`Error removing cached file ${cid}:`, error);
    // Non-critical error, don't throw
  }
};
