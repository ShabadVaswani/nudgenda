import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  getSpeechRestartDelay,
  isRecoverableSpeechError,
  MAX_RESTART_ATTEMPTS,
  mergeFinalTranscript,
  previewTranscript,
} from '@/voice/voiceSession';

type StartVoiceOptions = {
  contextualStrings?: string[];
};

function readableSpeechError(code: string, message?: string) {
  if (code === 'not-allowed') return 'Microphone permission is required for voice input.';
  if (code === 'no-speech' || code === 'speech-timeout') {
    return 'I did not hear anything. Tap the microphone and try again.';
  }
  if (code === 'network') return 'Speech recognition could not reach the phone’s speech service.';
  if (code === 'service-not-allowed' || code === 'language-not-supported') {
    return 'Speech recognition is not available for this language or device.';
  }
  if (code === 'busy') return 'The phone’s speech recognizer is busy. Try again in a moment.';
  return message || 'Speech recognition stopped unexpectedly.';
}

export function useVoiceInput() {
  const [error, setError] = useState<string>();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [volume, setVolume] = useState(-2);
  const completedTranscript = useRef('');
  const desiredActive = useRef(false);
  const restartAttempts = useRef(0);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startOptions = useRef<StartVoiceOptions>({});

  const clearRestart = useCallback(() => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = undefined;
  }, []);

  const startRecognizer = useCallback(() => {
    if (!desiredActive.current) return;
    const { contextualStrings = [] } = startOptions.current;
    ExpoSpeechRecognitionModule.start({
      contextualStrings,
      continuous: true,
      interimResults: true,
      lang: Intl.DateTimeFormat().resolvedOptions().locale || 'en-US',
      maxAlternatives: 1,
      requiresOnDeviceRecognition: false,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
    });
  }, []);

  const endSession = useCallback(
    (abort: boolean) => {
      desiredActive.current = false;
      clearRestart();
      setIsListening(false);
      setVolume(-2);
      if (abort) ExpoSpeechRecognitionModule.abort();
      else ExpoSpeechRecognitionModule.stop();
    },
    [clearRestart],
  );

  const scheduleRestart = useCallback(
    function schedule(attempt: number) {
      if (!desiredActive.current) return;
      if (attempt >= MAX_RESTART_ATTEMPTS) {
        desiredActive.current = false;
        setIsListening(false);
        setError('Speech recognition could not restart. Tap the microphone to try again.');
        return;
      }

      clearRestart();
      restartTimer.current = setTimeout(() => {
        if (!desiredActive.current) return;
        try {
          startRecognizer();
        } catch {
          restartAttempts.current = attempt + 1;
          schedule(attempt + 1);
        }
      }, getSpeechRestartDelay(attempt));
    },
    [clearRestart, startRecognizer],
  );

  useSpeechRecognitionEvent('start', () => {
    setError(undefined);
    setIsListening(true);
    restartAttempts.current = 0;
  });
  useSpeechRecognitionEvent('end', () => {
    setVolume(-2);
    if (!desiredActive.current) {
      setIsListening(false);
      return;
    }

    scheduleRestart(restartAttempts.current);
  });
  useSpeechRecognitionEvent('result', (event) => {
    const nextTranscript = event.results[0]?.transcript?.trim();
    if (!nextTranscript) return;
    if (event.isFinal) {
      completedTranscript.current = mergeFinalTranscript(
        completedTranscript.current,
        nextTranscript,
      );
      setTranscript(completedTranscript.current);
    } else {
      setTranscript(previewTranscript(completedTranscript.current, nextTranscript));
    }
  });
  useSpeechRecognitionEvent('volumechange', (event) => setVolume(event.value));
  useSpeechRecognitionEvent('error', (event) => {
    setVolume(-2);
    if (event.error === 'aborted') return;
    if (desiredActive.current && isRecoverableSpeechError(event.error)) return;

    desiredActive.current = false;
    clearRestart();
    setIsListening(false);
    setError(readableSpeechError(event.error, event.message));
  });

  const start = useCallback(async ({ contextualStrings = [] }: StartVoiceOptions = {}) => {
    clearRestart();
    setError(undefined);
    setTranscript('');
    completedTranscript.current = '';
    startOptions.current = { contextualStrings };

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setError('Speech recognition is not available on this device or browser.');
      return false;
    }

    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone permission is required for voice input.');
      return false;
    }

    try {
      desiredActive.current = true;
      restartAttempts.current = 0;
      setIsListening(true);
      startRecognizer();
      return true;
    } catch (startError) {
      desiredActive.current = false;
      setIsListening(false);
      setError(
        startError instanceof Error ? startError.message : 'Speech recognition could not start.',
      );
      return false;
    }
  }, [clearRestart, startRecognizer]);

  const stop = useCallback(() => {
    endSession(false);
  }, [endSession]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && desiredActive.current) endSession(true);
    });

    return () => {
      appStateSubscription.remove();
      desiredActive.current = false;
      clearRestart();
      ExpoSpeechRecognitionModule.abort();
    };
  }, [clearRestart, endSession]);

  return { error, isListening, start, stop, transcript, volume };
}
