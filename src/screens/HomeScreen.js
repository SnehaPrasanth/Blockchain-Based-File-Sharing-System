import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { fetchSharedFiles } from '../services/fileService';
import FileItem from '../components/FileItem';
import LoadingIndicator from '../components/LoadingIndicator';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';

const HomeScreen = ({ navigation }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const filesData = await fetchSharedFiles();
      setFiles(filesData);
    } catch (error) {
      console.error('Error loading files:', error);
      setError('Failed to load files. Please try again later.');
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

  if (loading && !refreshing) {
    return <LoadingIndicator message="Loading files..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadFiles} />;
  }

  return (
    <View style={styles.container}>
      {files.length === 0 ? (
        <EmptyState 
          message="No shared files available" 
          subMessage="Shared files from other users will appear here"
          iconName="file-tray-outline"
        />
      ) : (
        <FlatList
          data={files}
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
});

export default HomeScreen;
