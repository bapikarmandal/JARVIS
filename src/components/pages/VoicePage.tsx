import React, { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Mic, Volume2, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface VoicePageProps {
  onRefreshLogs: () => void;
}

export const VoicePage: React.FC<VoicePageProps> = ({ onRefreshLogs }) => {
  const [speechText, setSpeechText] = useState(
    'Hello Commander. JARVIS voice interface is ready. Speech output and push-to-talk transcription are online.'
  );
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Stop speaking when leaving component
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 1.0;
    utterance.pitch = 0.95;

    // Try finding a suitable natural English voice
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') || v.name.includes('Male') || v.name.includes('Google'))
    );
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setStatusMessage('Synthesizing vocal response...');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setStatusMessage('Voice playback complete.');
      onRefreshLogs();
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setStatusMessage('Vocal output interrupted.');
    };

    window.speechSynthesis.speak(utterance);
  };

  const handlePushToTalk = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        'Speech recognition requires a supported Chromium/Webkit browser with microphone authorization.'
      );
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage('Listening for single utterance...');
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setSpeechText(finalTranscript);
          setStatusMessage('Utterance captured.');
        }
      };

      recognition.onerror = (e: any) => {
        setIsListening(false);
        setStatusMessage(`Transcription alert: ${e.error}`);
      };

      recognition.onend = () => {
        setIsListening(false);
        onRefreshLogs();
      };

      recognition.start();
    } catch (err: any) {
      console.error(err);
      setIsListening(false);
      setStatusMessage(`Microphone initialization error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader title="Voice Interface" eyebrow="Speech Output">
        <div className="flex items-center gap-2 text-xs text-[#72e8ff]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Synthesizer Ready</span>
        </div>
      </PageHeader>

      {/* Main Voice Interactive Card */}
      <div className="jarvis-card p-6 space-y-5">
        <div>
          <h3 className="text-sm font-bold text-[#f4f9ff]">
            Vocal Synthesis & Push-to-Talk Terminal
          </h3>
          <p className="text-xs text-[#a9c7dc] mt-1">
            JARVIS can speak responses locally or transcribe one explicit push-to-talk utterance.
          </p>
        </div>

        {/* Text prompt to speak / transcribe */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider text-[#6f9cb8] uppercase">
            Voice Payload / Utterance Buffer
          </label>
          <textarea
            value={speechText}
            onChange={(e) => setSpeechText(e.target.value)}
            rows={4}
            className="w-full jarvis-input font-mono-tech text-sm leading-relaxed"
            placeholder="Type text for JARVIS to synthesize, or use Push-to-talk to transcribe..."
          />
        </div>

        {/* Audio Visualizer Waves */}
        <div className="h-14 rounded-lg bg-[#081827] border border-[#27506c] flex items-center justify-center gap-1.5 px-4 overflow-hidden">
          {Array.from({ length: 32 }).map((_, i) => {
            const active = isListening || isSpeaking;
            const height = active ? Math.max(15, (Math.sin(i * 0.5 + Date.now() * 0.01) + 1) * 35) : 6;
            return (
              <div
                key={i}
                className={`w-1.5 rounded-full transition-all duration-100 ${
                  active
                    ? isListening
                      ? 'bg-rose-400 shadow-[0_0_8px_#f43f5e]'
                      : 'bg-[#72e8ff] shadow-[0_0_8px_#72e8ff]'
                    : 'bg-[#1d4868]'
                }`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>

        {/* Action Controls matching PySide6 buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
          {/* Push to talk button */}
          <button
            onClick={handlePushToTalk}
            className={`flex items-center gap-3 px-6 py-3.5 rounded-full font-bold text-sm tracking-wider uppercase transition-all ${
              isListening
                ? 'bg-rose-600 text-white shadow-[0_0_24px_rgba(244,63,94,0.6)] animate-pulse'
                : 'bg-[#0b5c79] hover:bg-[#0e749a] border-2 border-[#70ebff] text-[#e8f1ff] shadow-[0_0_16px_rgba(112,235,255,0.25)]'
            }`}
          >
            <Mic className="w-5 h-5 text-[#70ebff]" />
            <span>{isListening ? 'Listening Utterance…' : '◉ Push to Talk'}</span>
          </button>

          {/* Speak button */}
          <button
            onClick={handleSpeak}
            className={`flex items-center gap-3 px-6 py-3.5 rounded-full font-bold text-sm tracking-wider uppercase transition-all ${
              isSpeaking
                ? 'bg-[#18517a] text-[#86ebff] border-2 border-[#66d4f0] animate-pulse shadow-[0_0_20px_rgba(102,212,240,0.5)]'
                : 'bg-[#123756] hover:bg-[#18517a] border-2 border-[#29739c] text-[#e8f1ff]'
            }`}
          >
            <Volume2 className="w-5 h-5 text-[#72e8ff]" />
            <span>{isSpeaking ? 'Halting Speech…' : '◎ Speak'}</span>
          </button>
        </div>

        {statusMessage && (
          <p className="text-center text-xs text-[#72e8ff] font-mono-tech mt-2">
            {statusMessage}
          </p>
        )}
      </div>

      {/* Safety Notice Card from PySide6 VoicePage */}
      <div className="jarvis-card p-5 border border-[#1d4868]/60 bg-[#0b1c2f]/70 flex items-start gap-3.5">
        <ShieldCheck className="w-5 h-5 text-[#72e8ff] shrink-0 mt-0.5" />
        <div className="text-xs text-[#a9c7dc] leading-relaxed">
          <span className="font-bold text-[#f4f9ff]">Zero Background Surveillance Policy:</span>{' '}
          JARVIS listens only after you explicitly press <span className="text-[#72e8ff]">Push to talk</span>; it never opens the microphone in the background. Speech recognition and audio synthesis are executed locally via standardized browser Web Speech engines.
        </div>
      </div>
    </div>
  );
};
