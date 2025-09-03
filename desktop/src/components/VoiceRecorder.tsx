import React, { useState, useRef, useEffect, useCallback } from 'react';

// Add this type declaration for SpeechRecognition API
declare global {
  interface SpeechRecognitionEvent extends Event {
    results: {
      length: number;
      item(index: number): any;
      [index: number]: {
        length: number;
        item(index: number): any;
        [index: number]: {
          transcript: string;
          confidence: number;
        };
        isFinal: boolean;
      };
    };
    resultIndex: number;
  }
  
  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onspeechstart: (() => void) | null;
    onspeechend: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }

  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };

  var webkitSpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };
}

interface VoiceRecorderProps {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
  theme: 'light' | 'dark';
}

interface WaveVisualizerProps {
  isRecording: boolean;
  theme: 'light' | 'dark';
}

const WaveVisualizer: React.FC<WaveVisualizerProps> = ({ isRecording, theme }) => {
  return (
    <div className={`absolute inset-0 rounded-xl overflow-hidden ${isRecording ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
      <div className="absolute inset-0 flex items-center justify-center space-x-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`w-1 bg-white rounded-full transition-all duration-100 ${
              isRecording ? 'animate-wave' : 'h-2'
            }`}
            style={{
              height: isRecording ? `${Math.random() * 16 + 8}px` : '8px',
              animationDelay: `${i * 0.1}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`
            }}
          />
        ))}
      </div>
      
      {/* Pulsing ring effect */}
      <div className="absolute inset-0 rounded-xl border-2 border-white/30 animate-ping" />
    </div>
  );
};

const SoundEffects = {
  playStartSound: () => {
    // Create a simple audio context for sound effects
    if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
      const AudioCtx = AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      
      // Create start recording sound (rising tone)
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    }
  },
  
  playStopSound: () => {
    if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
      const AudioCtx = AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      
      // Create stop recording sound (falling tone)
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    }
  }
};

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscript, disabled, theme }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const playSound = useCallback((type: 'start' | 'stop') => {
    // Check if sound effects are enabled
    const settings = JSON.parse(localStorage.getItem('nubia-settings') || '{}');
    if (settings.soundEffects !== false) {
      if (type === 'start') {
        SoundEffects.playStartSound();
      } else {
        SoundEffects.playStopSound();
      }
    }
  }, []);

  useEffect(() => {
    // Check if Speech Recognition is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognition();
      
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        setIsListening(true);
        playSound('start');
      };

      recognition.onend = () => {
        setIsRecording(false);
        setIsListening(false);
        setTranscript('');
        playSound('stop');
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
            setConfidence(result[0].confidence);
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        if (finalTranscript) {
          onTranscript(finalTranscript);
          recognition.stop();
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        setIsListening(false);
        setTranscript('');
      };

      recognition.onspeechstart = () => {
        setIsListening(true);
      };

      recognition.onspeechend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onTranscript, playSound]);

  const toggleRecording = () => {
    if (!recognitionRef.current || disabled) return;

    if (isRecording) {
      recognitionRef.current.stop();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    } else {
      setTranscript('');
      setConfidence(0);
      recognitionRef.current.start();
      
      // Auto-stop after 30 seconds
      timeoutRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      }, 30000);
    }
  };

  if (!isSupported) {
    return (
      <div className={`
        p-3 rounded-xl flex-shrink-0 transition-all duration-200 cursor-not-allowed opacity-50
        ${theme === 'dark' ? 'bg-surface-700 text-surface-500' : 'bg-surface-200 text-surface-400'}
      `} title="Voice recording not supported in this browser">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={toggleRecording}
        disabled={disabled}
        className={`
          voice-recorder relative p-3 rounded-xl flex-shrink-0 transition-all duration-200 overflow-hidden
          ${isRecording
            ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25'
            : theme === 'dark'
              ? 'bg-surface-700 hover:bg-surface-600 text-surface-300 hover:text-white'
              : 'bg-surface-200 hover:bg-surface-300 text-surface-600 hover:text-surface-700'
          } 
          disabled:opacity-50 disabled:cursor-not-allowed
          transform hover:scale-105 active:scale-95
        `}
        title={isRecording ? 'Stop recording (click or wait)' : 'Start voice recording'}
      >
        {/* Wave visualizer overlay */}
        <WaveVisualizer isRecording={isRecording && isListening} theme={theme} />
        
        {/* Icon */}
        <div className="relative z-10">
          {isRecording ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zm-1 17.93c-3.94-.49-7-3.85-7-7.93h2c0 2.76 2.24 5 5 5s5-2.24 5-5h2c0 4.08-3.06 7.44-7 7.93V22h-2v-2.07z" />
            </svg>
          )}
        </div>
      </button>

      {/* Real-time transcript display */}
      {transcript && isRecording && (
        <div className={`
          absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-3 py-2 rounded-lg text-sm max-w-xs
          ${theme === 'dark' 
            ? 'bg-surface-800 text-surface-200 border border-surface-700' 
            : 'bg-white text-surface-800 border border-surface-200'
          }
          shadow-lg animate-slide-up
        `}>
          <div className="text-xs opacity-60 mb-1">Listening...</div>
          <div className="font-medium">{transcript}</div>
          
          {/* Confidence indicator */}
          {confidence > 0 && (
            <div className="mt-2">
              <div className={`text-xs ${theme === 'dark' ? 'text-surface-400' : 'text-surface-500'}`}>
                Confidence: {Math.round(confidence * 100)}%
              </div>
              <div className={`w-full h-1 rounded-full mt-1 ${theme === 'dark' ? 'bg-surface-700' : 'bg-surface-200'}`}>
                <div 
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Pointer */}
          <div className={`
            absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45
            ${theme === 'dark' ? 'bg-surface-800 border-r border-b border-surface-700' : 'bg-white border-r border-b border-surface-200'}
          `} />
        </div>
      )}

      {/* Recording status indicator */}
      {isRecording && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse">
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
        </div>
      )}

      {/* Listening status indicator */}
      {isRecording && isListening && (
        <div className="absolute -bottom-1 -left-1 flex space-x-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-1 h-1 bg-primary-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};