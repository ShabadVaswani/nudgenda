import { BowlbyOneSC_400Regular } from '@expo-google-fonts/bowlby-one-sc';
import { Kalam_700Bold } from '@expo-google-fonts/kalam';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AgentSettingsProvider } from '@/agent/AgentSettingsProvider';
import { CalendarProvider } from '@/calendar/CalendarProvider';
import { ImportedContextProvider } from '@/context/ImportedContextProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BowlbyOneSC_400Regular,
    Kalam_700Bold,
    PatrickHand_400Regular,
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
    <AgentSettingsProvider>
      <ImportedContextProvider>
        <CalendarProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="chat" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="connect/google" />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="settings/calendar" />
            <Stack.Screen name="settings/import-context" />
          </Stack>
        </CalendarProvider>
      </ImportedContextProvider>
    </AgentSettingsProvider>
  );
}
