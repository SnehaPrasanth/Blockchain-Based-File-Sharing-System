import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { ProgressBar } from 'react-native-paper';

const LoadingIndicator = ({ message = 'Loading...', progress = null }) => {
  return (
    <View style={styles.container}>
      {progress !== null ? (
        <>
          <ProgressBar 
            progress={progress} 
            color="#2563eb" 
            style={styles.progressBar}
          />
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
        </>
      ) : (
        <ActivityIndicator size="large" color="#2563eb" />
      )}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  progressBar: {
    width: 200,
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 8,
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default LoadingIndicator;
