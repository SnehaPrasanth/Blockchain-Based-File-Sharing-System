import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Get Supabase URL and anon key
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Create a custom storage implementation for React Native
const reactNativeStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: reactNativeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Helper function to handle database errors
export const handleSupabaseError = (error) => {
  console.error('Supabase error:', error);
  
  // Extract meaningful error message if possible
  let errorMessage = 'An unexpected error occurred';
  
  if (error.message) {
    errorMessage = error.message;
  } else if (error.error_description) {
    errorMessage = error.error_description;
  }
  
  return errorMessage;
};

// Initialize Supabase database if needed
export const initializeDatabase = async () => {
  try {
    // Check if tables exist and create them if they don't
    // This is typically handled during setup, but included for reference
    
    // Example: Check if files table exists
    const { error } = await supabase
      .from('files')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') { // Table doesn't exist
      console.log('Database tables need to be initialized');
      // In a real app, you might want to implement migration logic here
      // or provide instructions to the user
    }
    
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    return false;
  }
};

// Clean up function for when the app is closed
export const cleanupSupabase = () => {
  // Perform any cleanup if needed
};
