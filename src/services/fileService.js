import { supabase, handleSupabaseError } from './supabaseService';
import { uploadToFilecoin, downloadFromFilecoin, deleteFromFilecoin } from './filecoinService';
import { encryptData, decryptData, generateEncryptionKey, generateIV } from './encryptionService';
import { TABLES } from '../utils/constants';

/**
 * Upload a file to the system
 * @param {Object} options - Upload options
 * @param {string} options.file - Base64 encoded file data
 * @param {string} options.fileName - The name of the file
 * @param {string} options.fileType - The MIME type of the file
 * @param {number} options.fileSize - The size of the file in bytes
 * @param {string} options.description - Description of the file
 * @param {boolean} options.isPublic - Whether the file is public or private
 * @param {string} options.userId - The ID of the user uploading the file
 * @param {Function} options.onProgress - Progress callback function
 * @returns {Promise<Object>} - The uploaded file metadata
 */
export const uploadFile = async ({
  file,
  fileName,
  fileType,
  fileSize,
  description,
  isPublic,
  userId,
  onProgress = () => {}
}) => {
  try {
    // Generate secure encryption key and IV
    const encryptionPassword = await generateEncryptionKey();
    
    // Report initial progress
    onProgress(10);
    
    // Encrypt the file
    const { encryptedData, iv } = await encryptData(file, encryptionPassword);
    onProgress(30);
    
    // Upload to Filecoin/IPFS
    const cid = await uploadToFilecoin(encryptedData, fileName, (progress) => {
      // Map progress from 30% to 80%
      onProgress(30 + Math.floor(progress * 0.5));
    });
    onProgress(80);
    
    // Update user's storage quota
    try {
      await supabase.rpc('update_user_storage', { 
        user_id: userId, 
        bytes_added: fileSize 
      });
    } catch (quotaError) {
      console.error('Error updating storage quota:', quotaError);
      // Continue anyway as this is not critical
    }
    
    // Store metadata in database
    const { data, error } = await supabase
      .from(TABLES.FILES)
      .insert([
        {
          user_id: userId,
          file_name: fileName,
          file_size: fileSize,
          file_type: fileType,
          description: description || '',
          ipfs_cid: cid,
          encryption_key: encryptionPassword, // In a production app, encrypt this with user's public key
          encryption_iv: iv,
          is_public: isPublic
        }
      ])
      .select()
      .single();
    
    if (error) throw error;
    
    // Log the upload action in audit log
    try {
      await supabase
        .from(TABLES.AUDIT_LOGS)
        .insert([{
          user_id: userId,
          file_id: data.id,
          action: 'upload',
          details: { fileName, fileSize, fileType, isPublic }
        }]);
    } catch (auditError) {
      console.error('Error logging file upload:', auditError);
      // Continue anyway as this is not critical
    }
    
    onProgress(100);
    
    return data;
  } catch (error) {
    console.error('File upload error:', error);
    throw new Error(handleSupabaseError(error));
  }
};

/**
 * Download a file from the system
 * @param {string} fileId - The ID of the file to download
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<string>} - Base64 encoded file data
 */
export const downloadFile = async (fileId, onProgress = () => {}) => {
  try {
    // Get file metadata from database
    const { data: fileData, error } = await supabase
      .from(TABLES.FILES)
      .select('*')
      .eq('id', fileId)
      .single();
    
    if (error) throw error;
    if (!fileData) throw new Error('File not found');
    
    // Report initial progress
    onProgress(10);
    
    // Download encrypted data from IPFS/Filecoin
    const encryptedData = await downloadFromFilecoin(fileData.ipfs_cid, (progress) => {
      // Map progress from 10% to 70%
      onProgress(10 + Math.floor(progress * 0.6));
    });
    onProgress(70);
    
    // Decrypt the data
    const decryptedData = await decryptData(
      encryptedData,
      fileData.encryption_iv,
      fileData.encryption_key
    );
    onProgress(90);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    
    // Increment download count
    await supabase
      .from(TABLES.FILES)
      .update({ download_count: (fileData.download_count || 0) + 1 })
      .eq('id', fileId);
    
    // Log download in audit log
    if (userId) {
      await supabase
        .from(TABLES.AUDIT_LOGS)
        .insert([{
          user_id: userId,
          file_id: fileId,
          action: 'download',
          details: { 
            fileName: fileData.file_name,
            fileSize: fileData.file_size
          }
        }]);
    }
    
    onProgress(100);
    
    return decryptedData;
  } catch (error) {
    console.error('File download error:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
};

/**
 * Delete a file from the system
 * @param {string} fileId - The ID of the file to delete
 * @returns {Promise<boolean>} - Success status
 */
export const deleteFile = async (fileId) => {
  try {
    // Get file metadata
    const { data: fileData, error: fetchError } = await supabase
      .from(TABLES.FILES)
      .select('ipfs_cid, user_id, file_size, file_name')
      .eq('id', fileId)
      .single();
    
    if (fetchError) throw fetchError;
    if (!fileData) throw new Error('File not found');
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== fileData.user_id) {
      throw new Error('You are not authorized to delete this file');
    }
    
    // Mark for deletion in IPFS/Filecoin 
    await deleteFromFilecoin(fileData.ipfs_cid);
    
    // Update user's storage quota
    try {
      await supabase.rpc('update_user_storage', { 
        user_id: fileData.user_id, 
        bytes_added: -fileData.file_size // negative to subtract
      });
    } catch (quotaError) {
      console.error('Error updating storage quota:', quotaError);
      // Continue anyway as this is not critical
    }
    
    // Log deletion in audit log
    try {
      await supabase
        .from(TABLES.AUDIT_LOGS)
        .insert([{
          user_id: user.id,
          file_id: fileId,
          action: 'delete',
          details: { 
            fileName: fileData.file_name,
            fileSize: fileData.file_size
          }
        }]);
    } catch (auditError) {
      console.error('Error logging file deletion:', auditError);
      // Continue anyway as this is not critical
    }
    
    // Delete from database
    const { error: deleteError } = await supabase
      .from(TABLES.FILES)
      .delete()
      .eq('id', fileId);
    
    if (deleteError) throw deleteError;
    
    return true;
  } catch (error) {
    console.error('File deletion error:', error);
    throw new Error(handleSupabaseError(error));
  }
};

/**
 * Fetch files shared by other users (public files)
 * @returns {Promise<Array>} - List of shared files
 */
export const fetchSharedFiles = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Get public files from other users
    const { data: publicFiles, error: publicFilesError } = await supabase
      .from(TABLES.FILES)
      .select(`
        id,
        file_name,
        file_size,
        file_type,
        description,
        created_at,
        updated_at,
        ipfs_cid,
        is_public,
        view_count,
        download_count,
        user_id,
        users:user_id (username, full_name)
      `)
      .eq('is_public', true)
      .neq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (publicFilesError) throw publicFilesError;
    
    // Get files explicitly shared with this user
    const { data: sharedFiles, error: sharedFilesError } = await supabase
      .from(TABLES.FILE_SHARES)
      .select(`
        id,
        access_level,
        created_at,
        expires_at,
        shared_by,
        users_shared_by:shared_by (username, full_name),
        files:file_id (
          id,
          file_name,
          file_size,
          file_type,
          description,
          created_at,
          ipfs_cid,
          view_count,
          download_count,
          user_id
        )
      `)
      .eq('shared_with', user.id)
      .order('created_at', { ascending: false });
    
    if (sharedFilesError) throw sharedFilesError;
    
    // Combine the results (public files and explicitly shared files)
    const publicFilesFormatted = publicFiles || [];
    
    // Format the shared files to match the structure of public files
    const sharedFilesFormatted = (sharedFiles || []).map(share => {
      const file = share.files;
      return {
        ...file,
        shared_by: share.shared_by,
        shared_by_username: share.users_shared_by?.username,
        shared_by_full_name: share.users_shared_by?.full_name,
        access_level: share.access_level,
        share_expires_at: share.expires_at
      };
    });
    
    // Increment view count for all files viewed
    try {
      // Get all file IDs
      const allFileIds = [
        ...publicFilesFormatted.map(f => f.id),
        ...sharedFilesFormatted.map(f => f.id)
      ];
      
      // Batch update view counts
      if (allFileIds.length > 0) {
        await supabase.rpc('increment_view_counts', { file_ids: allFileIds });
      }
      
      // Log audit for viewing files
      await supabase
        .from(TABLES.AUDIT_LOGS)
        .insert(
          allFileIds.map(fileId => ({
            user_id: user.id,
            file_id: fileId,
            action: 'view_listing',
            details: { context: 'shared_files_list' }
          }))
        );
    } catch (viewError) {
      console.error('Error updating view counts:', viewError);
      // Continue anyway as this is not critical
    }
    
    return [...publicFilesFormatted, ...sharedFilesFormatted];
  } catch (error) {
    console.error('Fetch shared files error:', error);
    throw new Error(handleSupabaseError(error));
  }
};

/**
 * Fetch files uploaded by the current user
 * @param {string} userId - The ID of the user
 * @returns {Promise<Array>} - List of user files
 */
export const fetchUserFiles = async (userId) => {
  try {
    // Get files uploaded by the user
    const { data, error } = await supabase
      .from(TABLES.FILES)
      .select(`
        id,
        file_name,
        file_size,
        file_type,
        description,
        created_at,
        updated_at,
        ipfs_cid,
        is_public,
        view_count,
        download_count
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Get sharing info for each file
    const filesWithSharing = await Promise.all((data || []).map(async (file) => {
      const { data: shareData, error: shareError } = await supabase
        .from(TABLES.FILE_SHARES)
        .select(`
          id,
          shared_with,
          users:shared_with (username, full_name),
          access_level,
          created_at,
          expires_at
        `)
        .eq('file_id', file.id);
      
      if (shareError) {
        console.error('Error fetching share data:', shareError);
        return {
          ...file,
          shared_with: []
        };
      }
      
      return {
        ...file,
        shared_with: shareData || []
      };
    }));
    
    return filesWithSharing;
  } catch (error) {
    console.error('Fetch user files error:', error);
    throw new Error(handleSupabaseError(error));
  }
};

/**
 * Share a file with another user
 * @param {string} fileId - The ID of the file to share
 * @param {string} sharedWithUserId - The ID of the user to share with
 * @param {string} accessLevel - The access level (view, download, edit)
 * @param {Date} expiresAt - Optional expiration date for the share
 * @returns {Promise<Object>} - The sharing record
 */
/**
 * Get detailed information about a file
 * @param {string} fileId - The ID of the file
 * @returns {Promise<Object>} - The file details with sharing information
 */
export const getFileDetails = async (fileId) => {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    // Get the file details
    const { data: fileData, error: fileError } = await supabase
      .from(TABLES.FILES)
      .select(`
        *,
        user:user_id (username, full_name)
      `)
      .eq('id', fileId)
      .single();
      
    if (fileError) throw fileError;
    if (!fileData) throw new Error('File not found');
    
    // Check if user has access to this file
    const isOwner = fileData.user_id === user.id;
    const isPublic = fileData.is_public;
    
    // If not owner and not public, check if shared with user
    if (!isOwner && !isPublic) {
      const { data: shareData, error: shareError } = await supabase
        .from(TABLES.FILE_SHARES)
        .select('access_level, expires_at')
        .eq('file_id', fileId)
        .eq('shared_with', user.id)
        .single();
      
      if (shareError || !shareData) {
        throw new Error('You do not have access to this file');
      }
      
      // Check if share has expired
      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        throw new Error('Your access to this file has expired');
      }
      
      // Add share info to file data
      fileData.accessVia = 'share';
      fileData.accessLevel = shareData.access_level;
      fileData.accessExpires = shareData.expires_at;
    } else if (isOwner) {
      fileData.accessVia = 'owner';
      fileData.accessLevel = 'owner';
    } else {
      fileData.accessVia = 'public';
      fileData.accessLevel = 'view';
    }
    
    // If owner, get sharing information
    if (isOwner) {
      const { data: sharesData, error: sharesError } = await supabase
        .from(TABLES.FILE_SHARES)
        .select(`
          id,
          shared_with,
          user:shared_with (username, full_name),
          access_level,
          created_at,
          expires_at
        `)
        .eq('file_id', fileId);
      
      if (!sharesError) {
        fileData.shares = sharesData || [];
      }
    }
    
    // Increment view count
    await supabase
      .from(TABLES.FILES)
      .update({ view_count: (fileData.view_count || 0) + 1 })
      .eq('id', fileId);
    
    // Log view in audit
    await supabase
      .from(TABLES.AUDIT_LOGS)
      .insert([{
        user_id: user.id,
        file_id: fileId,
        action: 'view_details',
        details: { accessVia: fileData.accessVia }
      }]);
    
    return fileData;
  } catch (error) {
    console.error('Error getting file details:', error);
    throw new Error(handleSupabaseError(error));
  }
};

/**
 * Remove a file share
 * @param {string} shareId - The ID of the share to remove
 * @returns {Promise<boolean>} - Success status
 */
export const removeFileShare = async (shareId) => {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    // Get the share details first to check permissions
    const { data: shareData, error: shareError } = await supabase
      .from(TABLES.FILE_SHARES)
      .select('file_id, shared_by, shared_with')
      .eq('id', shareId)
      .single();
    
    if (shareError) throw shareError;
    if (!shareData) throw new Error('Share not found');
    
    // Check if user has permission to remove this share
    if (shareData.shared_by !== user.id) {
      throw new Error('You do not have permission to remove this share');
    }
    
    // Delete the share
    const { error: deleteError } = await supabase
      .from(TABLES.FILE_SHARES)
      .delete()
      .eq('id', shareId);
    
    if (deleteError) throw deleteError;
    
    // Log the action
    await supabase
      .from(TABLES.AUDIT_LOGS)
      .insert([{
        user_id: user.id,
        file_id: shareData.file_id,
        action: 'unshare',
        details: { shareId, sharedWith: shareData.shared_with }
      }]);
    
    return true;
  } catch (error) {
    console.error('Error removing file share:', error);
    throw new Error(handleSupabaseError(error));
  }
};

/**
 * Search for files
 * @param {Object} options - Search options
 * @param {string} options.query - Search query
 * @param {string} options.fileType - Filter by file type
 * @param {boolean} options.includePrivate - Whether to include user's private files
 * @param {boolean} options.includePublic - Whether to include public files
 * @param {boolean} options.includeShared - Whether to include files shared with user
 * @returns {Promise<Array>} - Search results
 */
export const searchFiles = async ({ 
  query = '', 
  fileType = null, 
  includePrivate = true,
  includePublic = true,
  includeShared = true 
}) => {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    // Start building the query
    let filesQuery = supabase.from(TABLES.FILES).select(`
      id,
      file_name,
      file_size,
      file_type,
      description,
      created_at,
      updated_at,
      ipfs_cid,
      is_public,
      view_count,
      download_count,
      user_id,
      users:user_id (username, full_name)
    `);
    
    // Add search term if provided (search in filename and description)
    if (query && query.trim() !== '') {
      const searchTerm = `%${query.trim()}%`;
      filesQuery = filesQuery.or(`file_name.ilike.${searchTerm},description.ilike.${searchTerm}`);
    }
    
    // Filter by file type if provided
    if (fileType) {
      filesQuery = filesQuery.eq('file_type', fileType);
    }
    
    // Build filter for which files to include
    let filters = [];
    
    // Include user's private files
    if (includePrivate) {
      filters.push(`user_id.eq.${user.id}`);
    }
    
    // Include public files
    if (includePublic) {
      filters.push(`is_public.eq.true`);
    }
    
    // Apply filters
    if (filters.length > 0) {
      filesQuery = filesQuery.or(filters.join(','));
    }
    
    // Execute the query
    const { data: filesData, error: filesError } = await filesQuery.order('created_at', { ascending: false });
    
    if (filesError) throw filesError;
    
    // Get files shared with the user if requested
    let sharedFiles = [];
    if (includeShared) {
      const { data: sharedData, error: sharedError } = await supabase
        .from(TABLES.FILE_SHARES)
        .select(`
          id,
          access_level,
          created_at,
          expires_at,
          shared_by,
          users_shared_by:shared_by (username, full_name),
          files:file_id (
            id,
            file_name,
            file_size,
            file_type,
            description,
            created_at,
            ipfs_cid,
            view_count,
            download_count,
            user_id
          )
        `)
        .eq('shared_with', user.id);
      
      if (!sharedError && sharedData) {
        // Format shared files to match main files structure
        sharedFiles = sharedData
          .filter(share => {
            // Filter by file type if requested
            if (fileType && share.files.file_type !== fileType) {
              return false;
            }
            
            // Filter by search query if provided
            if (query && query.trim() !== '') {
              const searchTerm = query.trim().toLowerCase();
              return (
                share.files.file_name.toLowerCase().includes(searchTerm) ||
                (share.files.description && share.files.description.toLowerCase().includes(searchTerm))
              );
            }
            
            return true;
          })
          .map(share => {
            const file = share.files;
            return {
              ...file,
              shared_by: share.shared_by,
              shared_by_username: share.users_shared_by?.username,
              shared_by_full_name: share.users_shared_by?.full_name,
              access_level: share.access_level,
              share_expires_at: share.expires_at
            };
          });
      }
    }
    
    // Combine results and sort by created_at
    const allFiles = [...(filesData || []), ...sharedFiles];
    allFiles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Log the search in audit
    await supabase
      .from(TABLES.AUDIT_LOGS)
      .insert([{
        user_id: user.id,
        action: 'search',
        details: { 
          query, 
          fileType, 
          includePrivate,
          includePublic,
          includeShared,
          resultCount: allFiles.length 
        }
      }]);
    
    return allFiles;
  } catch (error) {
    console.error('File search error:', error);
    throw new Error(handleSupabaseError(error));
  }
};

/**
 * Get user storage statistics
 * @param {string} userId - The ID of the user
 * @returns {Promise<Object>} - Storage statistics
 */
export const getUserStorageStats = async (userId) => {
  try {
    // Get user data with storage information
    const { data: userData, error: userError } = await supabase
      .from(TABLES.USERS)
      .select('storage_quota, storage_used')
      .eq('id', userId)
      .single();
    
    if (userError) throw userError;
    if (!userData) throw new Error('User not found');
    
    // Get file count and types
    const { data: filesData, error: filesError } = await supabase
      .from(TABLES.FILES)
      .select('id, file_type, file_size')
      .eq('user_id', userId);
    
    if (filesError) throw filesError;
    
    // Calculate statistics
    const totalFiles = filesData ? filesData.length : 0;
    const storageUsed = userData.storage_used || 0;
    const storageQuota = userData.storage_quota || 0;
    const storagePercentage = storageQuota > 0 ? Math.round((storageUsed / storageQuota) * 100) : 0;
    
    // Count by type
    const fileTypeCount = {};
    if (filesData && filesData.length > 0) {
      filesData.forEach(file => {
        const type = file.file_type || 'unknown';
        fileTypeCount[type] = (fileTypeCount[type] || 0) + 1;
      });
    }
    
    return {
      totalFiles,
      storageUsed,
      storageQuota,
      storagePercentage,
      fileTypeCount,
      hasReachedQuota: storageUsed >= storageQuota
    };
  } catch (error) {
    console.error('Error getting storage stats:', error);
    throw new Error(handleSupabaseError(error));
  }
};

/**
 * Share a file with another user
 * @param {string} fileId - The ID of the file to share
 * @param {string} sharedWithUserId - The ID of the user to share with
 * @param {string} accessLevel - The access level (view, download, edit)
 * @param {Date} expiresAt - Optional expiration date for the share
 * @returns {Promise<Object>} - The sharing record
 */
export const shareFile = async (fileId, sharedWithUserId, accessLevel = 'view', expiresAt = null) => {
  try {
    // Verify the file exists and user has permission to share it
    const { data: fileData, error: fileError } = await supabase
      .from(TABLES.FILES)
      .select('user_id, file_name')
      .eq('id', fileId)
      .single();
    
    if (fileError) throw fileError;
    if (!fileData) throw new Error('File not found');
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    // Verify the current user owns the file
    if (user.id !== fileData.user_id) {
      throw new Error('You do not have permission to share this file');
    }
    
    // Verify the target user exists
    const { data: targetUser, error: targetUserError } = await supabase
      .from(TABLES.USERS)
      .select('id, username')
      .eq('id', sharedWithUserId)
      .single();
    
    if (targetUserError) throw targetUserError;
    if (!targetUser) throw new Error('User to share with not found');
    
    // Create the share record
    const { data: shareData, error: shareError } = await supabase
      .from(TABLES.FILE_SHARES)
      .insert([{
        file_id: fileId,
        shared_by: user.id,
        shared_with: sharedWithUserId,
        access_level: accessLevel,
        expires_at: expiresAt
      }])
      .select()
      .single();
    
    if (shareError) throw shareError;
    
    // Log the share action in audit log
    await supabase
      .from(TABLES.AUDIT_LOGS)
      .insert([{
        user_id: user.id,
        file_id: fileId,
        action: 'share',
        details: { 
          sharedWith: targetUser.username,
          sharedWithId: sharedWithUserId,
          accessLevel,
          expiresAt
        }
      }]);
    
    return shareData;
  } catch (error) {
    console.error('File sharing error:', error);
    throw new Error(handleSupabaseError(error));
  }
};
