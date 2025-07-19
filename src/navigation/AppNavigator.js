import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import FileUploadScreen from '../screens/FileUploadScreen';
import FileDetailsScreen from '../screens/FileDetailsScreen';
import MyFilesScreen from '../screens/MyFilesScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="HomeScreen" 
        component={HomeScreen} 
        options={{ title: 'Home' }}
      />
      <Stack.Screen 
        name="FileDetails" 
        component={FileDetailsScreen} 
        options={{ title: 'File Details' }}
      />
    </Stack.Navigator>
  );
}

function MyFilesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="MyFilesScreen" 
        component={MyFilesScreen} 
        options={{ title: 'My Files' }}
      />
      <Stack.Screen 
        name="FileDetails" 
        component={FileDetailsScreen} 
        options={{ title: 'File Details' }}
      />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Upload') {
            iconName = focused ? 'cloud-upload' : 'cloud-upload-outline';
          } else if (route.name === 'MyFiles') {
            iconName = focused ? 'folder' : 'folder-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeStack} 
        options={{ headerShown: false }}
      />
      <Tab.Screen 
        name="Upload" 
        component={FileUploadScreen} 
        options={{ title: 'Upload File' }}
      />
      <Tab.Screen 
        name="MyFiles" 
        component={MyFilesStack} 
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator({ user }) {
  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
