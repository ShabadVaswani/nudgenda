import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useState } from 'react';

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

  useSpeechRecognitionEvent('start', () => {
    setError(undefined);
    setIsListening(true);
  });
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    setVolume(-2);
  });
  useSpeechRecognitionEvent('result', (event) => {
    const nextTranscript = event.results[0]?.transcript?.trim();
    if (nextTranscript) setTranscript(nextTranscript);
  });
  useSpeechRecognitionEvent('volumechange', (event) => setVolume(event.value));
  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    setVolume(-2);
    if (event.error !== 'aborted') {
      setError(readableSpeechError(event.error, event.message));
    }
  });

  const start = useCallback(async ({ contextualStrings = [] }: StartVoiceOptions = {}) => {
    setError(undefined);
    setTranscript('');

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
      ExpoSpeechRecognitionModule.start({
        contextualStrings,
        continuous: false,
        interimResults: true,
        lang: Intl.DateTimeFormat().resolvedOptions().locale || 'en-US',
        maxAlternatives: 1,
        requiresOnDeviceRecognition: false,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      });
      return true;
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : 'Speech recognition could not start.',
      );
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { error, isListening, start, stop, transcript, volume };
}
