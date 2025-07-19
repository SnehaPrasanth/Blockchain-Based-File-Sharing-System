import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFileTypeIcon } from '../utils/helpers';

const FileTypeIcon = ({ fileName, size = 24, color = '#2563eb', style = {} }) => {
  const iconName = getFileTypeIcon(fileName);
  
  return (
    <View style={[styles.container, style]}>
      <Ionicons name={iconName} size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FileTypeIcon;
