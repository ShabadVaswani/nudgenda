import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { Kalam_400Regular, Kalam_700Bold } from '@expo-google-fonts/kalam';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { CalendarProvider } from '@/calendar/CalendarProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ArchivoBlack_400Regular,
    Kalam_400Regular,
    Kalam_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <CalendarProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="chat" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="settings/calendar" />
      </Stack>
    </CalendarProvider>
  );
}
