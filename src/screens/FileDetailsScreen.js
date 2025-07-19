import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ScrollView,
  Share,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { downloadFile, deleteFile } from '../services/fileService';
import { getFileTypeIcon, getFileSize, formatDate } from '../utils/helpers';
import LoadingIndicator from '../components/LoadingIndicator';
import { supabase } from '../services/supabaseService';

const FileDetailsScreen = ({ route, navigation }) => {
  const { file } = route.params;
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadingFile, setDownloadingFile] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    checkOwnership();
  }, []);

  const checkOwnership = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsOwner(user?.id === file.user_id);
    } catch (error) {
      console.error('Error checking ownership:', error);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloadingFile(true);
      setDownloadProgress(0);

      const fileData = await downloadFile(file.id, (progress) => {
        setDownloadProgress(progress);
      });

      // Create a temporary file
      const fileUri = `${FileSystem.cacheDirectory}${file.file_name}`;
      await FileSystem.writeAsStringAsync(fileUri, fileData, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', error.message || 'Failed to download file');
    } finally {
      setDownloadingFile(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this file? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete }
      ]
    );
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      await deleteFile(file.id);
      Alert.alert('Success', 'File deleted successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Delete Failed', error.message || 'Failed to delete file');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        title: file.file_name,
        message: `Check out this file: ${file.file_name}`,
      });
    } catch (error) {
      Alert.alert('Error', 'Something went wrong sharing the file');
    }
  };

  if (loading) {
    return <LoadingIndicator message="Processing..." />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.fileIconContainer}>
          <Ionicons 
            name={getFileTypeIcon(file.file_name)} 
            size={40} 
            color="#2563eb" 
          />
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName}>{file.file_name}</Text>
          <Text style={styles.fileSize}>{getFileSize(file.file_size)}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>
          {file.description || 'No description provided'}
        </Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Uploaded on</Text>
          <Text style={styles.detailValue}>{formatDate(file.created_at)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Visibility</Text>
          <View style={styles.visibilityContainer}>
            <Text style={styles.detailValue}>
              {file.is_public ? 'Public' : 'Private'}
            </Text>
            <Ionicons 
              name={file.is_public ? 'globe-outline' : 'lock-closed-outline'} 
              size={16} 
              color="#666" 
              style={styles.visibilityIcon}
            />
          </View>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Uploaded by</Text>
          <Text style={styles.detailValue}>{file.user_email || 'Unknown'}</Text>
        </View>
      </View>
      
      <View style={styles.actionContainer}>
        {downloadingFile ? (
          <View style={styles.downloadProgress}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.downloadProgressText}>
              Downloading... {Math.round(downloadProgress)}%
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
            <Ionicons name="cloud-download-outline" size={20} color="#fff" />
            <Text style={styles.buttonText}>Download</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>Share</Text>
        </TouchableOpacity>

        {isOwner && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  fileIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  fileSize: {
    fontSize: 15,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 15,
    color: '#666',
  },
  detailValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  visibilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visibilityIcon: {
    marginLeft: 6,
  },
  actionContainer: {
    marginBottom: 20,
  },
  downloadButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  shareButton: {
    backgroundColor: '#059669',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  downloadProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  downloadProgressText: {
    marginLeft: 8,
    fontSize: 15,
    color: '#2563eb',
  },
});

export default FileDetailsScreen;
