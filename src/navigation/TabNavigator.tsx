import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HomeScreen from '@/screens/HomeScreen';
import LibraryScreen from '@/screens/LibraryScreen';
import CreatorsScreen from '@/screens/CreatorsScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

interface TabBarIconProps {
  focused: boolean;
  color: string;
  size: number;
}

function homeIcon({ focused, color, size }: TabBarIconProps) {
  return (
    <Ionicons
      name={focused ? 'home' : 'home-outline'}
      size={size}
      color={color}
    />
  );
}

function libraryIcon({ focused, color, size }: TabBarIconProps) {
  return (
    <Ionicons
      name={focused ? 'library' : 'library-outline'}
      size={size}
      color={color}
    />
  );
}

function creatorsIcon({ focused, color, size }: TabBarIconProps) {
  return (
    <Ionicons
      name={focused ? 'people' : 'people-outline'}
      size={size}
      color={color}
    />
  );
}

function settingsIcon({ focused, color, size }: TabBarIconProps) {
  return (
    <Ionicons
      name={focused ? 'settings' : 'settings-outline'}
      size={size}
      color={color}
    />
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: homeIcon, title: 'Home' }}
      />
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{ tabBarIcon: libraryIcon, title: 'Library' }}
      />
      <Tab.Screen
        name="Creators"
        component={CreatorsScreen}
        options={{ tabBarIcon: creatorsIcon, title: 'Creators' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: settingsIcon, title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}