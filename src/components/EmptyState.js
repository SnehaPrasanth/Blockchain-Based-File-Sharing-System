import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const EmptyState = ({ 
  message = 'No data found', 
  subMessage = 'There is no data to display at the moment', 
  iconName = 'document-outline'
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={iconName} size={60} color="#9ca3af" />
      </View>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.subMessage}>{subMessage}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  message: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4b5563',
    marginBottom: 8,
  },
  subMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 250,
  },
});

export default EmptyState;
