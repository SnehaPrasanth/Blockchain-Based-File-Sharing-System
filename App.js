import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { supabase } from './src/services/supabaseService';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import * as Updates from 'expo-updates';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // Function to check for app updates
  async function checkForUpdates() {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        // New update has been downloaded
        Alert.alert(
          "Update Available",
          "An update has been downloaded. Restart to use the new version.",
          [
            { text: "Later", style: "cancel" },
            { text: "Restart", onPress: async () => await Updates.reloadAsync() }
          ]
        );
      }
    } catch (error) {
      console.log('Error checking for updates:', error);
    }
  }

  useEffect(() => {
    // Check for user session
    checkUser();
    
    // Check for updates when app starts (only in production)
    if (!__DEV__) {
      checkForUpdates();
    }
    
    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => {
      if (authListener?.unsubscribe) {
        authListener.unsubscribe();
      }
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Error checking user:', error.message);
    } finally {
      setIsLoading(false);
      setIsReady(true);
    }
  };

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading application...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator user={user} />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
