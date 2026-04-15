import { Tabs } from 'expo-router';
import React from 'react';

import { useAuth } from '@/components/mobile/auth-context';
import { BottomSidebarBar } from '@/components/mobile/bottom-sidebar-bar';
import { HapticTab } from '@/components/haptic-tab';
import { AppTheme } from '@/components/mobile/app-theme';

export default function TabLayout() {
  const { authenticated } = useAuth();

  return (
    <Tabs
      tabBar={(props) => (authenticated ? <BottomSidebarBar {...props} /> : null)}
      screenOptions={{
        tabBarActiveTintColor: AppTheme.text,
        tabBarInactiveTintColor: AppTheme.textSoft,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          display: 'none',
          backgroundColor: '#09090b',
          borderTopColor: 'rgba(255,255,255,0.06)',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: 'Liked Songs',
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: 'New',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
