import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFileTypeIcon, getFileSize, formatDate } from '../utils/helpers';

const FileItem = ({ file, onPress }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.iconContainer}>
        <Ionicons 
          name={getFileTypeIcon(file.file_name)} 
          size={24} 
          color="#2563eb" 
        />
      </View>
      
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{file.file_name}</Text>
        <View style={styles.fileDetails}>
          <Text style={styles.fileSize}>{getFileSize(file.file_size)}</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.date}>{formatDate(file.created_at)}</Text>
        </View>
      </View>
      
      <View style={styles.metadata}>
        {file.is_public ? (
          <View style={styles.visibilityBadge}>
            <Ionicons name="globe-outline" size={12} color="#059669" />
            <Text style={styles.visibilityText}>Public</Text>
          </View>
        ) : (
          <View style={[styles.visibilityBadge, styles.privateBadge]}>
            <Ionicons name="lock-closed-outline" size={12} color="#7C3AED" />
            <Text style={[styles.visibilityText, styles.privateText]}>Private</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
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
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  fileDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileSize: {
    fontSize: 14,
    color: '#6b7280',
  },
  dot: {
    fontSize: 14,
    color: '#9ca3af',
    marginHorizontal: 6,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  privateBadge: {
    backgroundColor: '#f5f3ff',
  },
  visibilityText: {
    fontSize: 12,
    color: '#059669',
    marginLeft: 4,
    fontWeight: '500',
  },
  privateText: {
    color: '#7C3AED',
  },
});

export default FileItem;
