/**
 * Voice recognition stub for web
 * @react-native-voice/voice is not available on web
 */

const Voice = {
  onSpeechStart: () => {},
  onSpeechRecognized: () => {},
  onSpeechEnd: () => {},
  onSpeechError: () => {},
  onSpeechResults: () => {},
  onSpeechPartialResults: () => {},
  onSpeechVolumeChanged: () => {},
  
  start: async (locale) => {
    console.warn('Voice recognition not available on web');
    return Promise.resolve();
  },
  
  stop: async () => Promise.resolve(),
  cancel: async () => Promise.resolve(),
  destroy: async () => Promise.resolve(),
  removeAllListeners: () => {},
  
  isAvailable: async () => Promise.resolve(false),
  isRecognizing: async () => Promise.resolve(false),
  getSupportedLocales: async () => Promise.resolve([]),
};

export default Voice;
