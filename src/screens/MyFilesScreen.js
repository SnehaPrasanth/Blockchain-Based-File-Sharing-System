import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  RefreshControl, 
  Alert,
  TouchableOpacity,
  Text
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchUserFiles } from '../services/fileService';
import FileItem from '../components/FileItem';
import LoadingIndicator from '../components/LoadingIndicator';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import { supabase } from '../services/supabaseService';

const MyFilesScreen = ({ navigation }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all', 'public', 'private'

  useEffect(() => {
    loadFiles();
    
    // Refresh files when the screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadFiles();
    });

    return unsubscribe;
  }, [navigation]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const filesData = await fetchUserFiles(user.id);
      setFiles(filesData);
    } catch (error) {
      console.error('Error loading files:', error);
      setError('Failed to load your files. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFiles();
  };

  const handleFilePress = (file) => {
    navigation.navigate('FileDetails', { file });
  };

  const filteredFiles = files.filter(file => {
    if (filterType === 'all') return true;
    if (filterType === 'public') return file.is_public;
    if (filterType === 'private') return !file.is_public;
    return true;
  });

  const renderFilterButton = (type, label, icon) => (
    <TouchableOpacity 
      style={[
        styles.filterButton,
        filterType === type && styles.filterButtonActive
      ]}
      onPress={() => setFilterType(type)}
    >
      <Ionicons 
        name={icon} 
        size={16} 
        color={filterType === type ? '#fff' : '#2563eb'} 
      />
      <Text 
        style={[
          styles.filterButtonText,
          filterType === type && styles.filterButtonTextActive
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return <LoadingIndicator message="Loading your files..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadFiles} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All', 'albums-outline')}
        {renderFilterButton('public', 'Public', 'globe-outline')}
        {renderFilterButton('private', 'Private', 'lock-closed-outline')}
      </View>
      
      {filteredFiles.length === 0 ? (
        <EmptyState 
          message="No files found" 
          subMessage={
            filterType === 'all' 
              ? "You haven't uploaded any files yet" 
              : `You don't have any ${filterType} files`
          }
          iconName="document-outline"
        />
      ) : (
        <FlatList
          data={filteredFiles}
          renderItem={({ item }) => (
            <FileItem 
              file={item} 
              onPress={() => handleFilePress(item)}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <TouchableOpacity 
        style={styles.uploadButton}
        onPress={() => navigation.navigate('Upload')}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  uploadButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default MyFilesScreen;
