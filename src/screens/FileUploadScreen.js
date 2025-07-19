import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  Switch,
  ScrollView,
  Alert,
  Platform
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { uploadFile } from '../services/fileService';
import { getFileTypeIcon, getFileSize } from '../utils/helpers';
import LoadingIndicator from '../components/LoadingIndicator';
import { supabase } from '../services/supabaseService';

const FileUploadScreen = ({ navigation }) => {
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        return;
      }
      
      const pickedFile = result.assets[0];
      
      // Check file size (limit to 25MB for example)
      if (pickedFile.size > 25 * 1024 * 1024) {
        Alert.alert('Error', 'File size should not exceed 25MB');
        return;
      }

      setFile(pickedFile);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      Alert.alert('Error', 'Please select a file to upload');
      return;
    }

    try {
      setLoading(true);
      setUploadProgress(0);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const fileData = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await uploadFile({
        file: fileData,
        fileName: file.name,
        fileType: file.mimeType,
        fileSize: file.size,
        description,
        isPublic,
        userId: user.id,
        onProgress: (progress) => {
          setUploadProgress(progress);
        }
      });

      Alert.alert(
        'Success', 
        'File uploaded successfully',
        [{ text: 'OK', onPress: () => {
          // Reset form and navigate to My Files
          setFile(null);
          setDescription('');
          setIsPublic(false);
          navigation.navigate('MyFiles');
        }}]
      );
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingIndicator 
        message={`Uploading file... ${Math.round(uploadProgress)}%`}
        progress={uploadProgress / 100} 
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.uploadContainer}>
        <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
          <Ionicons name="cloud-upload-outline" size={48} color="#2563eb" />
          <Text style={styles.uploadText}>
            {file ? 'Change File' : 'Select File to Upload'}
          </Text>
        </TouchableOpacity>
      </View>

      {file && (
        <View style={styles.fileInfoContainer}>
          <View style={styles.fileIconContainer}>
            <Ionicons 
              name={getFileTypeIcon(file.name)} 
              size={36} 
              color="#2563eb" 
            />
          </View>
          <View style={styles.fileDetails}>
            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
            <Text style={styles.fileSize}>{getFileSize(file.size)}</Text>
          </View>
        </View>
      )}

      <View style={styles.formContainer}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          placeholder="Add a description for your file"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <View style={styles.switchContainer}>
          <Text style={styles.label}>Make file public</Text>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={isPublic ? '#2563eb' : '#f4f3f4'}
          />
        </View>

        <Text style={styles.infoText}>
          {isPublic 
            ? 'Public files can be viewed by anyone using the app'
            : 'Private files are only visible to you'}
        </Text>

        <TouchableOpacity 
          style={[
            styles.submitButton, 
            !file && styles.disabledButton
          ]}
          onPress={handleUpload}
          disabled={!file}
        >
          <Text style={styles.submitButtonText}>Upload File</Text>
        </TouchableOpacity>
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
  uploadContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  uploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    width: '100%',
  },
  uploadText: {
    marginTop: 12,
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '500',
  },
  fileInfoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  fileIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 14,
    color: '#666',
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#93c5fd',
  },
});

export default FileUploadScreen;
