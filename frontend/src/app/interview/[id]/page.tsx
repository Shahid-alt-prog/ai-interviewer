"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BrainCircuit,
  Loader2,
  Mic,
  MicOff,
  User,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Info,
  Volume2,
  Home,
  Check,
  PhoneCall,
} from "lucide-react";
import { interviewsApi, candidatesApi, Candidate, InterviewDetail, API_BASE_URL } from "@/lib/api";

export default function ActiveInterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const interviewId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Session tracking states
  const [sessionStarted, setSessionStarted] = useState(false);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false); // Controls the entrance lobby click
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [currentSection, setCurrentSection] = useState<string>("Introduction");
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [selectedInterviewer, setSelectedInterviewer] = useState("Alex");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isTimeExpired, setIsTimeExpired] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [typedResponse, setTypedResponse] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const keyboardModeRef = useRef(keyboardMode);

  useEffect(() => {
    keyboardModeRef.current = keyboardMode;
  }, [keyboardMode]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const parseBackendDateMs = (value: string | null | undefined) => {
    if (!value) return Number.NaN;

    const strValue = typeof value === "string" ? value : new Date(value).toISOString();
    const normalized = strValue.trim().replace(" ", "T");
    
    // Truncate microsecond precision (e.g. .833862) to millisecond precision (.833) for cross-browser safety
    const truncated = normalized.replace(/\.(\d{1,3})\d*/, ".$1");
    
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(truncated);
    return new Date(hasTimezone ? truncated : `${truncated}Z`).getTime();
  };

  // Live Voice and Transcription States
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcription, _setTranscription] = useState("");
  const [interimTranscription, _setInterimTranscription] = useState("");
  const [audioState, setAudioState] = useState<"idle" | "speaking" | "listening" | "thinking">("idle");
  const [mouthFlap, setMouthFlap] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptionRef = useRef("");
  const interimTranscriptionRef = useRef("");
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleSendAnswerRef = useRef<() => void>(() => {});
  const isJoiningRef = useRef(false);
  const isSendingRef = useRef(false);

  // VAD & Interruption states
  const isAiSpeakingRef = useRef(false);
  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);

  const [isInterrupted, setIsInterrupted] = useState(false);
  const typedResponseRef = useRef("");
  useEffect(() => {
    typedResponseRef.current = typedResponse;
  }, [typedResponse]);

  const vadAnimationRef = useRef<number | null>(null);
  const handleInterruptRef = useRef<() => void>(() => {});

  // 1. Load Interview Context on Mount
  useEffect(() => {
    async function loadInterview() {
      try {
        setLoading(true);
        const data = await interviewsApi.get(interviewId);
        setInterview(data);

        // Pre-select recommended recruiter personality based on interview type or existing session metadata
        if (data.metadata_json && (data.metadata_json as any).interviewer_name) {
          setSelectedInterviewer((data.metadata_json as any).interviewer_name);
        } else {
          if (data.interview_type === "technical_round") {
            setSelectedInterviewer("Sarah");
          } else if (data.interview_type === "manager_ops_round") {
            setSelectedInterviewer("Vikram");
          } else {
            setSelectedInterviewer("Alex");
          }
        }

        const cand = await candidatesApi.get(data.candidate_id);
        setCandidate(cand);

        if (data.status === "in_progress" || data.status === "completed" || data.status === "evaluating") {
          setSessionStarted(true);

          if (data.status === "completed" || data.status === "evaluating") {
            setIsComplete(true);
          }

          if (data.conversation_history && data.conversation_history.length > 0) {
            // Restore last question asked
            if (data.status !== "completed") {
              const history = data.conversation_history;
              const lastInterviewer = [...history].reverse().find(
                (m) => m.role === "assistant" || m.role === "interviewer"
              );
              if (lastInterviewer) {
                setCurrentQuestion((lastInterviewer.content || lastInterviewer.text) ?? "");
              }
            }
          }
          
          if (data.current_section) {
            setCurrentSection(data.current_section);
          }
        }
      } catch (error) {
        console.error("Error loading interview:", error);
      } finally {
        setLoading(false);
      }
    }
    loadInterview();

    return () => {
      cancelSpeech();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [interviewId]);

  // Timer sync and tick effects
  useEffect(() => {
    if (!interview || !interview.started_at || isComplete) return;

    const calculateTimeLeft = () => {
      let startedTime = parseBackendDateMs(interview.started_at);
      if (isNaN(startedTime)) {
        // Fallback: if parsing fails, assume the interview was started just now
        startedTime = Date.now();
      }
      const durationMs = interview.duration_minutes * 60 * 1000;
      
      let now = Date.now();
      // Adjust client clock by backend's server_time to eliminate client-server clock desync
      if (interview.server_time) {
        const serverTime = parseBackendDateMs(interview.server_time);
        if (!isNaN(serverTime)) {
          const clockOffsetMs = serverTime - Date.now();
          now = Date.now() + clockOffsetMs;
        }
      }

      const elapsedMs = now - startedTime;
      const remainingSecs = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000));
      setTimeLeft(remainingSecs);
    };

    calculateTimeLeft();
    
    window.addEventListener("focus", calculateTimeLeft);
    return () => window.removeEventListener("focus", calculateTimeLeft);
  }, [interview, isComplete]);

  useEffect(() => {
    if (!hasJoinedRoom || isComplete || timeLeft === null) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasJoinedRoom, isComplete, timeLeft !== null]);

  // Auto-submit / complete when time runs out
  useEffect(() => {
    if (hasJoinedRoom && !isComplete && !isTimeExpired && timeLeft !== null && timeLeft <= 0 && !isSending) {
      const autoWrapUp = async () => {
        if (isSendingRef.current) return;
        isSendingRef.current = true;
        setIsTimeExpired(true);
        stopListening();
        setIsSending(true);
        setAudioState("thinking");
        try {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ message: "Interview time has expired. Conclude the interview." }));
          } else {
            // Fallback if WS not open
            setProgress(100);
            setIsComplete(true);
            setAudioState("idle");
            const finishedMsg = "Thank you! Your interview time has expired, and the session is now complete. We are generating your report.";
            setCurrentQuestion("");
            speakText(finishedMsg);
            setIsSending(false);
            isSendingRef.current = false;
          }
        } catch (error) {
          console.error("Error auto-completing interview:", error);
          setIsComplete(true);
          setAudioState("idle");
          setIsSending(false);
          isSendingRef.current = false;
        }
      };
      autoWrapUp();
    }
  }, [hasJoinedRoom, isComplete, isTimeExpired, timeLeft, isSending, interviewId]);

  // 2. Initialize Web Speech Recognition
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      setKeyboardMode(true); // Automatically fallback to text input on unsupported devices/in-app webviews
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN"; // Set default recognition to Indian English

    recognition.onstart = () => {
      setIsListening(true);
      setAudioState("listening");
      interimTranscriptionRef.current = "";
      _setInterimTranscription("");
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };

    recognition.onerror = (event: any) => {
      // Ignore expected benign errors
      if (event.error === "aborted" || event.error === "no-speech") return;
      
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      setAudioState("idle");

      if (event.error === "not-allowed" || event.error === "audio-capture") {
        alert(
          event.error === "not-allowed"
            ? "Microphone access denied. Switching to keyboard mode so you can continue the interview."
            : "No microphone device found. Switching to keyboard mode so you can continue the interview."
        );
        setKeyboardMode(true);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        const prev = transcriptionRef.current;
        const next = prev ? prev + " " + finalTranscript : finalTranscript;
        transcriptionRef.current = next;
        _setTranscription(next);
      }
      interimTranscriptionRef.current = interimTranscript;
      _setInterimTranscription(interimTranscript);

      // Handle silence/auto-submit timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const hasContent = transcriptionRef.current.trim() || interimTranscript.trim();
      if (hasContent) {
        silenceTimerRef.current = setTimeout(() => {
          console.log("Silence detected. Auto-submitting response.");
          handleSendAnswerRef.current();
        }, 1500); // 1.5s of silence
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  // 3. Pre-warm Speech Synthesis voices on mount
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Trigger loading of voices
    window.speechSynthesis.getVoices();

    const handleVoicesChanged = () => {
      window.speechSynthesis.getVoices();
    };

    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
    };
  }, []);

  // 4. Text-To-Speech (TTS) — using the backend Sarvam AI endpoint
  const speakText = async (text: string, onEndCallback?: () => void) => {
    if (typeof window === "undefined") {
      onEndCallback?.();
      return;
    }

    cancelSpeech(); // Stop any currently playing audio

    // --- Text preprocessing for natural spoken delivery ---
    const cleanText = text
      .replace(/\*\*|__/g, "")         // Remove markdown bold
      .replace(/#+\s*/g, "")           // Remove markdown headers
      .replace(/•\s*/g, "")            // Remove bullets
      .replace(/^\s*-\s+/gm, "")       // Remove list dashes
      .replace(/\[.*?\]\(.*?\)/g, "")  // Remove markdown links
      .replace(/\.\.\./g, ". ")        // Replace ellipsis with natural pause
      .trim();

    if (!cleanText) {
      onEndCallback?.();
      return;
    }

    setIsAiSpeaking(true);
    setAudioState("speaking");

    try {
      const response = await fetch(`${API_BASE_URL}/tts/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          interviewer: selectedInterviewer,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS API failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.onplay = () => {
        // We could implement basic mouth flap here via intervals or web audio API analyzer, 
        // but for now, simple random interval to simulate talking
        const flapInterval = setInterval(() => {
          setMouthFlap(Math.random() > 0.5);
        }, 150);
        (audio as any)._flapInterval = flapInterval;
      };

      audio.onended = () => {
        if ((audio as any)._flapInterval) clearInterval((audio as any)._flapInterval);
        setIsAiSpeaking(false);
        setAudioState("idle");
        setMouthFlap(false);
        URL.revokeObjectURL(audioUrl);
        onEndCallback?.();
      };

      audio.onerror = () => {
        if ((audio as any)._flapInterval) clearInterval((audio as any)._flapInterval);
        console.error("Audio playback error");
        setIsAiSpeaking(false);
        setAudioState("idle");
        setMouthFlap(false);
        URL.revokeObjectURL(audioUrl);
        onEndCallback?.();
      };

      await audio.play();

    } catch (error) {
      console.error("TTS error:", error);
      setIsAiSpeaking(false);
      setAudioState("idle");
      setMouthFlap(false);
      onEndCallback?.();
    }
  };

  const cancelSpeech = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      if ((currentAudioRef.current as any)._flapInterval) {
         clearInterval((currentAudioRef.current as any)._flapInterval);
      }
      currentAudioRef.current = null;
    }
    
    // Also cancel standard web speech synth just in case it was used previously
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    setIsAiSpeaking(false);
    setAudioState("idle");
    setMouthFlap(false);
  };

  const startListening = () => {

    if (typeof window === "undefined" || !recognitionRef.current) return;
    
    cancelSpeech();

    try {
      transcriptionRef.current = "";
      interimTranscriptionRef.current = "";
      _setTranscription("");
      _setInterimTranscription("");
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      recognitionRef.current.start();
    } catch (e) {
      console.warn(e);
    }
  };

  const stopListening = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore if already stopped
      }
      setIsListening(false);
      if (audioState === "listening") {
        setAudioState("idle");
      }
    }
  };

  useEffect(() => {
    handleInterruptRef.current = () => {
      if (!isAiSpeakingRef.current) return;
      
      const currentText = transcriptionRef.current || interimTranscriptionRef.current || typedResponseRef.current || "";
      
      cancelSpeech();
      setIsInterrupted(true);
      setTimeout(() => setIsInterrupted(false), 3000);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "interrupt", text: currentText }));
      }

      if (!keyboardModeRef.current) {
        setTimeout(() => {
          startListening();
        }, 100);
      }
    };
  });

  useEffect(() => {
    if (typeof window === "undefined" || !hasJoinedRoom) return;

    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let microphone: MediaStreamAudioSourceNode;
    let stream: MediaStream;

    const setupVAD = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.minDecibels = -60;
        analyser.maxDecibels = -10;
        analyser.smoothingTimeConstant = 0.8;

        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const detectVolume = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          
          if (isAiSpeakingRef.current && average > 10) { 
            handleInterruptRef.current();
          }

          vadAnimationRef.current = requestAnimationFrame(detectVolume);
        };
        detectVolume();
      } catch (err) {
        console.error("Error setting up VAD:", err);
      }
    };

    setupVAD();

    return () => {
      if (vadAnimationRef.current) cancelAnimationFrame(vadAnimationRef.current);
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (audioContext) {
        if (audioContext.state !== "closed") audioContext.close();
      }
    };
  }, [hasJoinedRoom]);

  // Setup WebSocket when room is joined
  useEffect(() => {
    if (!hasJoinedRoom || isComplete) return;

    const wsUrl = API_BASE_URL.replace(/^https/, "wss").replace(/^http/, "ws") + `/interviews/${interviewId}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const nextTurn = JSON.parse(event.data);
        setProgress(nextTurn.interview_progress);

        if (nextTurn.is_complete) {
          setIsComplete(true);
          setAudioState("idle");
          const finishedMsg = "Thank you! The interview session is now complete. We are generating your report.";
          setCurrentQuestion("");
          speakText(finishedMsg);
        } else {
          setCurrentSection(nextTurn.section);
          setCurrentQuestion(nextTurn.ai_message);
          
          setIsSending(false);
          isSendingRef.current = false;

          speakText(nextTurn.ai_message, () => {
            if (!keyboardModeRef.current) {
              setTimeout(() => {
                startListening();
              }, 600);
            }
          });
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error", error);
      setIsSending(false);
      isSendingRef.current = false;
    };

    return () => {
      ws.close();
    };
  }, [hasJoinedRoom, isComplete, interviewId]);

  // 4. Join Call Room Trigger
  const handleJoinCall = async () => {
    if (isJoiningRef.current) return;

    // Unlock Speech Synthesis context synchronously inside user gesture for mobile/iOS browsers
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch (e) {
        console.warn("SpeechSynthesis unlock failed:", e);
      }
    }

    isJoiningRef.current = true;
    setHasJoinedRoom(true);
    
    if (!sessionStarted) {
      // This is a new session: trigger plan generation
      try {
        setLoading(true);
        const firstTurn = await interviewsApi.start(interviewId, selectedInterviewer);
        setSessionStarted(true);
        setCurrentQuestion(firstTurn.ai_message);
        setCurrentSection(firstTurn.section);
        setProgress(0);
        
        const updatedDetails = await interviewsApi.get(interviewId);
        setInterview(updatedDetails);

        // Auto speak greeting in real time
        setTimeout(() => {
          speakText(firstTurn.ai_message, () => {
            // Small delay to allow iOS to transition audio session from speaking to listening
            setTimeout(() => {
              startListening();
            }, 600);
          });
        }, 400);
      } catch (error: any) {
        console.error("Error starting call:", error);
        alert(error.detail || "Failed to start the interview session.");
        setHasJoinedRoom(false);
      } finally {
        setLoading(false);
        isJoiningRef.current = false;
      }
    } else {
      // Resuming existing session: immediately speak current active question
      if (currentQuestion && !isComplete) {
        setTimeout(() => {
          speakText(currentQuestion, () => {
            // Small delay to allow iOS to transition audio session from speaking to listening
            setTimeout(() => {
              startListening();
            }, 600);
          });
        }, 300);
      }
      isJoiningRef.current = false;
    }
  };

  // 5. Submit Answer Turn
  const handleSendAnswer = async (manualText?: string) => {
    if (isSendingRef.current) return;

    // Unlock Speech Synthesis context synchronously inside user gesture for mobile/iOS browsers
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch (e) {
        console.warn("SpeechSynthesis unlock failed:", e);
      }
    }

    isSendingRef.current = true;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const fullMessage = transcriptionRef.current.trim();
    const interimMessage = interimTranscriptionRef.current.trim();
    
    let answerValue = "";
    if (manualText && manualText.trim()) {
      answerValue = manualText.trim();
    } else {
      if (!fullMessage && !interimMessage) {
        isSendingRef.current = false;
        return;
      }
      answerValue = interimMessage 
        ? `${fullMessage} ${interimMessage}`.trim() 
        : fullMessage;
    }

    stopListening();
    
    transcriptionRef.current = "";
    interimTranscriptionRef.current = "";
    _setTranscription("");
    _setInterimTranscription("");
    setTypedResponse(""); // Reset typed response text field
    
    setIsSending(true);
    setAudioState("thinking");

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ message: answerValue }));
      } else {
        console.error("WebSocket not connected");
        alert("Connection lost. Please try reconnecting or refreshing the page.");
        setAudioState("idle");
        setIsSending(false);
        isSendingRef.current = false;
        if (!keyboardMode) {
          setTimeout(() => {
            startListening();
          }, 600);
        }
      }
    } catch (error: any) {
      console.error("Error sending response:", error);
      alert("Something went wrong. Please try sending your answer again.");
      setAudioState("idle");
      setIsSending(false);
      isSendingRef.current = false;
      if (!keyboardMode) {
        setTimeout(() => {
          startListening();
        }, 600);
      }
    }
  };

  // Keep ref up-to-date to avoid stale closures in listeners
  useEffect(() => {
    handleSendAnswerRef.current = (manualText?: string) => handleSendAnswer(manualText);
  }, [handleSendAnswer]);

  if (loading && !hasJoinedRoom) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#07070a]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">
          Connecting to Voice Channel...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-foreground flex flex-col justify-between overflow-x-hidden overflow-y-auto">
      {/* Top Banner Header */}
      <header className="glass h-16 border-b border-white/[0.05] flex items-center justify-between px-6 md:px-12 fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Volume2 className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight">AI Voice Interview Room</span>
        </div>

        {interview && candidate && hasJoinedRoom && (
          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground bg-white/5 px-4 py-1.5 rounded-full border border-white/[0.05]">
            <span>Candidate: <strong>{candidate.name}</strong></span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Section: <strong>{currentSection}</strong></span>
            {timeLeft !== null && (
              <>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className={`flex items-center gap-1 font-mono font-bold ${
                  timeLeft < 300 ? "text-rose-500 animate-pulse" : "text-emerald-400"
                }`}>
                  Time: {formatTime(timeLeft)}
                </span>
              </>
            )}
          </div>
        )}

        <Link href="/dashboard/interviews">
          <Button variant="ghost" size="sm" className="text-xs flex items-center gap-1 cursor-pointer">
            <Home className="w-4 h-4" />
            Exit Room
          </Button>
        </Link>
      </header>

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 flex flex-col items-center justify-center py-24">
        {!hasJoinedRoom ? (
          /* Lobby Entrance Overlay Card */
          <Card className="glass border-border w-full overflow-hidden shadow-2xl animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-indigo-500/10 p-8 border-b border-white/[0.05] text-center">
              <PhoneCall className="w-12 h-12 text-primary mx-auto mb-3 animate-pulse" />
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Live Voice Interview Lobby
              </h1>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                {interview?.title}
              </p>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <div className="flex gap-3 items-start">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                  <p>
                    <strong>Interactive Call Setup:</strong> Click the button below to connect your microphone. The AI interviewer will greet you and start asking questions immediately.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <Volume2 className="w-5 h-5 text-primary shrink-0" />
                  <p>
                    <strong>Indian Recruiter Voice:</strong> The interview is spoken aloud in a natural Indian English accent.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <Info className="w-5 h-5 text-primary shrink-0" />
                  <p>
                    <strong>Hands-free:</strong> The microphone opens automatically as soon as the interviewer finished speaking. Click &ldquo;Done Speaking&rdquo; when you want to submit.
                  </p>
                </div>
              </div>

              {!sessionStarted && (
                <div className="space-y-3 pt-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block text-center mb-1">
                    Select Your Recruiter Personality
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        name: "Alex",
                        role: "HR Talent Partner",
                        focus: "Culture & Fit",
                        color: "border-primary/20 bg-primary/5 hover:border-primary/50 text-primary"
                      },
                      {
                        name: "Sarah",
                        role: "Technical Lead",
                        focus: "Code & Architecture",
                        color: "border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/50 text-indigo-400"
                      },
                      {
                        name: "Vikram",
                        role: "Systems Architect",
                        focus: "Scale & Performance",
                        color: "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/50 text-emerald-400"
                      }
                    ].map((recruiter) => {
                      const isSelected = selectedInterviewer === recruiter.name;
                      const recommendedRecruiter = 
                        interview?.interview_type === "technical_round" 
                          ? "Sarah" 
                          : interview?.interview_type === "manager_ops_round" 
                          ? "Vikram" 
                          : "Alex";
                      const isRecommended = recruiter.name === recommendedRecruiter;
                      return (
                        <div
                          key={recruiter.name}
                          onClick={() => setSelectedInterviewer(recruiter.name)}
                          className={`flex flex-col p-4 rounded-xl border text-center cursor-pointer transition-all duration-300 relative ${
                            isSelected
                              ? recruiter.name === "Alex"
                                ? "border-primary bg-primary/10 scale-102 ring-1 ring-primary/30"
                                : recruiter.name === "Sarah"
                                ? "border-indigo-500 bg-indigo-500/10 scale-102 ring-1 ring-indigo-500/30"
                                : "border-emerald-500 bg-emerald-500/10 scale-102 ring-1 ring-emerald-500/30"
                              : "border-white/[0.05] hover:bg-white/[0.02]"
                          }`}
                        >
                          {isRecommended && (
                            <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-[6.5px] px-1.5 py-0.5 bg-emerald-500 text-white rounded-full font-black uppercase tracking-wider shadow-md">
                              Rec.
                            </span>
                          )}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 font-black text-xs ${
                            isSelected
                              ? recruiter.name === "Alex"
                                ? "bg-primary text-primary-foreground"
                                : recruiter.name === "Sarah"
                                ? "bg-indigo-500 text-white"
                                : "bg-emerald-500 text-white"
                              : "bg-white/10 text-muted-foreground"
                          }`}>
                            {recruiter.name[0]}
                          </div>
                          <h3 className="text-xs font-bold text-foreground">{recruiter.name}</h3>
                          <span className="text-[9px] text-muted-foreground block mt-0.5 leading-none">{recruiter.role}</span>
                          <span className={`text-[8px] font-bold block mt-1.5 uppercase tracking-wide leading-none p-1 rounded-md ${
                            isSelected 
                              ? recruiter.name === "Alex" 
                                ? "bg-primary/20 text-primary" 
                                : recruiter.name === "Sarah" 
                                ? "bg-indigo-500/20 text-indigo-400" 
                                : "bg-emerald-500/20 text-emerald-400"
                              : "bg-white/5 text-muted-foreground"
                          }`}>
                            {recruiter.focus}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-6 flex flex-col items-center gap-2">
                {isComplete ? (
                  <Link href="/dashboard/interviews">
                    <Button className="group flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-black hover:opacity-90 transition glow-primary cursor-pointer text-sm">
                      <ShieldCheck className="w-4.5 h-4.5" />
                      View Final Report
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Button
                      onClick={handleJoinCall}
                      className="group flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-black hover:opacity-90 transition glow-primary cursor-pointer text-sm"
                    >
                      <PhoneCall className="w-4.5 h-4.5" />
                      {sessionStarted 
                        ? "Resume Interview Call" 
                        : `Connect & Start with ${selectedInterviewer}`}
                    </Button>
                    {!sessionStarted && (
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Voice connection will be established immediately
                      </span>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Active Interactive Voice UI */
          <div className="w-full flex flex-col items-center justify-center space-y-8 min-h-[400px]">
            
            {/* Countdown timer badge */}
            {!isComplete && timeLeft !== null && (
              <div className={`px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 animate-fade-in ${
                timeLeft < 300 
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse" 
                  : "bg-white/5 border-white/10 text-muted-foreground"
              }`}>
                <span className={`w-2 h-2 rounded-full ${timeLeft <= 0 ? "bg-rose-600" : timeLeft < 300 ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
                <span>{timeLeft <= 0 ? "Time's Up! Recruiter wrapping up..." : "Session Time Remaining:"}</span>
                <strong className="font-mono text-sm">{formatTime(timeLeft)}</strong>
              </div>
            )}
            
            {/* Immersive 3D Recruiter Animoji */}
            {!isComplete && (
              <RecruiterAnimoji 
                name={selectedInterviewer} 
                audioState={audioState} 
                mouthFlap={mouthFlap}
              />
            )}

            {/* Subtitles / Caption Blocks */}
            {!isComplete && (
              <div className="w-full space-y-4 pt-4">
                
                {isInterrupted && (
                  <div className="text-center p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 max-w-sm mx-auto animate-fade-in shadow-sm">
                    <span className="text-xs text-orange-400 font-bold flex items-center justify-center gap-2">
                      <Volume2 className="w-4 h-4" />
                      AI Paused (Interrupted)
                    </span>
                  </div>
                )}

                {/* AI Interviewer captions */}
                {currentQuestion && (
                  <div className="text-center p-6 rounded-2xl bg-white/[0.02] border border-white/[0.04] max-w-xl mx-auto shadow-sm">
                    <span className="text-[10px] text-primary font-black uppercase tracking-wider block">
                      AI Recruiter
                    </span>
                    <p className="text-base text-foreground font-semibold mt-1.5 leading-relaxed">
                      &ldquo;{currentQuestion}&rdquo;
                    </p>
                  </div>
                )}

                {/* Candidate Transcription Subtitle Box */}
                {isListening && (transcription || interimTranscription) && (
                  <div className="text-center p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 max-w-xl mx-auto animate-fade-in shadow-sm">
                    <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider block">
                      Transcribing Answer
                    </span>
                    <p className="text-base text-foreground mt-1.5 leading-relaxed font-medium">
                      {transcription} <span className="text-emerald-500/50 italic">{interimTranscription}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Complete Overlay summary */}
            {isComplete && (
              <Card className="glass border-border text-center p-8 space-y-5 animate-fade-in w-full shadow-2xl">
                <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
                <h2 className="text-2xl font-bold text-foreground">Interview Concluded!</h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Your responses have been evaluated and parsed. The recruitment assessment scorecard is being generated.
                </p>
                <div className="pt-4 flex flex-wrap gap-3 items-center justify-center">
                  <Link href="/dashboard/interviews">
                    <Button variant="outline" className="border-border rounded-xl cursor-pointer">
                      Lobby List
                    </Button>
                  </Link>
                  <Link href={`/dashboard/reports/${interviewId}`}>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5 cursor-pointer font-bold">
                      View Recruitment Report
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            )}

            {/* Keyboard Mode Input Form */}
            {sessionStarted && !isComplete && keyboardMode && (
              <div className="w-full max-w-xl mx-auto space-y-4 pt-2 animate-fade-in">
                <textarea
                  value={typedResponse}
                  onChange={(e) => setTypedResponse(e.target.value)}
                  placeholder="Type your response here..."
                  className="w-full p-4 rounded-xl border border-border bg-white/[0.02] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-none leading-relaxed"
                  disabled={isSending}
                />
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => {
                      cancelSpeech();
                      setKeyboardMode(false);
                      setTypedResponse("");
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold cursor-pointer text-muted-foreground hover:text-foreground"
                    disabled={isSending}
                  >
                    <Mic className="w-4 h-4" />
                    Switch to Voice Mode
                  </Button>
                  <Button
                    onClick={() => handleSendAnswer(typedResponse)}
                    disabled={!typedResponse.trim() || isSending}
                    className="flex items-center gap-2 px-8 py-3 rounded-full bg-primary text-primary-foreground font-black shadow-lg hover:opacity-90 transition cursor-pointer text-xs"
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Submit Response
                  </Button>
                </div>
              </div>
            )}
            
            {/* Submit / Done Speaking Microphone Trigger */}
            {sessionStarted && !isComplete && !keyboardMode && (
              <div className="w-full flex flex-col items-center justify-center space-y-4 animate-fade-in">
                <div className="flex justify-center">
                  {audioState === "listening" ? (
                    <Button
                      onClick={() => handleSendAnswer()}
                      disabled={!transcription.trim() && !interimTranscription.trim()}
                      className="flex items-center gap-2 px-8 py-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg transition-all transform hover:scale-102 cursor-pointer text-sm animate-pulse-glow"
                    >
                      <Check className="w-4.5 h-4.5" />
                      Done Speaking (Submit Answer)
                    </Button>
                  ) : audioState === "speaking" ? (
                    <Button
                      disabled
                      className="flex items-center gap-2 px-8 py-4 rounded-full bg-primary/10 border border-primary/20 text-primary/70 font-bold text-xs"
                    >
                      <Volume2 className="w-4 h-4" />
                      AI Recruiter Speaking...
                    </Button>
                  ) : audioState === "thinking" ? (
                    <Button
                      disabled
                      className="flex items-center gap-2 px-8 py-4 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold text-xs"
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Evaluating Turn...
                    </Button>
                  ) : (
                    <Button
                      onClick={startListening}
                      className="flex items-center gap-2 px-8 py-4 rounded-full bg-primary text-primary-foreground font-black shadow-lg hover:opacity-90 cursor-pointer text-sm"
                    >
                      <Mic className="w-4.5 h-4.5" />
                      Unmute Microphone
                    </Button>
                  )}
                </div>
                
                <button
                  onClick={() => {
                    stopListening();
                    cancelSpeech();
                    setKeyboardMode(true);
                  }}
                  className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground hover:text-foreground transition cursor-pointer"
                  disabled={isSending}
                >
                  Type your response instead
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Progress Footer */}
      {sessionStarted && !isComplete && hasJoinedRoom && (
        <div className="fixed bottom-0 left-0 right-0 glass py-3 px-6 z-30">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-6 text-[10px] text-muted-foreground">
            <span className="uppercase tracking-wider font-semibold">Evaluation progress</span>
            <Progress value={progress} className="h-1 bg-white/10 rounded-full flex-1 max-w-[240px] accent-primary" />
            <span className="font-bold text-foreground">{Math.round(progress)}% Complete</span>
          </div>
        </div>
      )}
    </div>
  );
}

function RecruiterAnimoji({
  name,
  audioState,
  mouthFlap,
}: {
  name: string;
  audioState: "speaking" | "listening" | "thinking" | "idle";
  mouthFlap: boolean;
}) {
  const isSpeaking = audioState === "speaking";
  const isListening = audioState === "listening";
  const isThinking = audioState === "thinking";

  let glowColor = "rgba(139,92,246,0.5)";
  let ring1Glow = "rgba(139,92,246,0.75)";
  let ring2Glow = "rgba(236,72,153,0.55)";
  let borderTheme = "border-violet-500/25";
  let textTheme = "text-violet-400";
  let bgTheme = "bg-violet-500/10";

  if (name === "Sarah") {
    glowColor = "rgba(244,63,94,0.5)";
    ring1Glow = "rgba(244,63,94,0.75)";
    ring2Glow = "rgba(6,182,212,0.6)";
    borderTheme = "border-pink-500/25";
    textTheme = "text-pink-400";
    bgTheme = "bg-pink-500/10";
  } else if (name === "Vikram") {
    glowColor = "rgba(16,185,129,0.5)";
    ring1Glow = "rgba(16,185,129,0.75)";
    ring2Glow = "rgba(52,211,153,0.5)";
    borderTheme = "border-emerald-500/25";
    textTheme = "text-emerald-400";
    bgTheme = "bg-emerald-500/10";
  }

  const speakingClass = isSpeaking ? "robo-speaking" : "";
  const thinkingClass = isThinking ? "robo-thinking" : "";

  // Waveform bar heights for speaking animation
  const alexBars  = mouthFlap ? [6,9,5,10,4,8,5]   : [2,2,2,2,2,2,2];
  const sarahBars = mouthFlap ? [5,8,6,10,9,6,8,5]  : [2,2,2,2,2,2,2,2];
  const vikBars   = mouthFlap ? [4,7,5,9,8,6,7,4]   : [2,2,2,2,2,2,2,2];

  return (
    <div className="relative flex flex-col items-center justify-center h-52 w-52 animate-fade-in select-none">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes robo-bob {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          33%      { transform: translateY(-4px) rotate(1.2deg); }
          66%      { transform: translateY(-1.5px) rotate(-0.6deg); }
        }
        @keyframes robo-blink {
          0%,88%,100% { transform: scaleY(1); }
          93%          { transform: scaleY(0.06); }
        }
        @keyframes robo-scan {
          0%,100% { transform: translateX(0px); }
          25%      { transform: translateX(-2px); }
          75%      { transform: translateX(2px); }
        }
        @keyframes led-pulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.45; }
        }
        @keyframes antenna-ping {
          0%,80%,100% { opacity: 1; r: 2.5; }
          90%          { opacity: 0.5; r: 4; }
        }
        @keyframes galaxy-ripple {
          0%   { transform: scale(0.85); opacity: 0.7; }
          100% { transform: scale(1.55); opacity: 0; filter: blur(3px); }
        }
        @keyframes siri-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes star-twinkle {
          0%,100% { opacity: 0.3; transform: scale(0.8); }
          50%      { opacity: 1;   transform: scale(1.3); }
        }
        .robo-head  { transform-origin: 50px 54px; animation: robo-bob 3.8s infinite ease-in-out; }
        .robo-eye   { animation: robo-blink 5.5s infinite; }
        .robo-pupil { animation: led-pulse 2s infinite ease-in-out; }
        .robo-thinking .robo-pupil { animation: robo-scan 2.5s infinite ease-in-out; }
        .antenna-dot { animation: antenna-ping 3.8s infinite ease-in-out; }
        .star-p      { animation: star-twinkle 2s infinite ease-in-out; }
      `}} />

      {/* Background effects */}
      <div className="absolute w-44 h-44 flex items-center justify-center pointer-events-none">
        <div className="absolute inset-0" style={{ animation: "siri-spin 30s infinite linear" }}>
          <div className="absolute top-2 left-10 w-1 h-1 bg-white rounded-full star-p shadow-[0_0_5px_rgba(255,255,255,0.9)]" style={{ animationDelay: "0.2s" }} />
          <div className="absolute top-10 right-3 w-1 h-1 bg-white rounded-full star-p shadow-[0_0_5px_rgba(255,255,255,0.9)]" style={{ animationDelay: "0.8s" }} />
          <div className="absolute bottom-4 left-8 w-0.5 h-0.5 bg-white rounded-full star-p" style={{ animationDelay: "1.3s" }} />
          <div className="absolute bottom-10 right-7 w-1 h-1 bg-white rounded-full star-p shadow-[0_0_5px_rgba(255,255,255,0.9)]" style={{ animationDelay: "0.5s" }} />
        </div>
        <div className="absolute w-36 h-36 rounded-full filter blur-2xl opacity-50 transition-all duration-700"
          style={{ background: `radial-gradient(circle,${glowColor} 0%,transparent 75%)`, transform: isSpeaking ? "scale(1.3)" : "scale(1)" }} />
        {(isSpeaking || isListening) && (<>
          <div className="absolute w-44 h-44 rounded-full border bg-white/[0.003]"
            style={{ borderColor: ring1Glow.replace("0.75","0.4"), animation: "galaxy-ripple 2.5s infinite ease-out" }} />
          <div className="absolute w-44 h-44 rounded-full border bg-white/[0.003]"
            style={{ borderColor: ring1Glow.replace("0.75","0.4"), animation: "galaxy-ripple 2.5s infinite ease-out 0.9s" }} />
        </>)}
        {isThinking && (
          <div className="absolute w-44 h-44 border border-dashed rounded-full"
            style={{ borderColor: ring2Glow.replace("0.5","0.3"), boxShadow: `0 0 14px ${ring2Glow}`, animation: "siri-spin 9s infinite linear" }} />
        )}
      </div>

      {/* Robot SVG */}
      <div className={`w-44 h-44 drop-shadow-[0_8px_32px_rgba(0,0,0,0.85)] z-10 transition-transform duration-500 ${speakingClass} ${thinkingClass}`}>
        <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          <Image 
            src={`/animojis/${name.toLowerCase()}.jpg`} 
            alt={`${name} Animoji`} 
            width={176}
            height={176}
            className="w-full h-full object-cover object-center"
          />
          {isSpeaking && (
            <div className="absolute inset-0 rounded-full border-[6px] border-emerald-400 opacity-80 animate-pulse"></div>
          )}
        </div>
      </div>

      {/* Status label */}
      <div className={`mt-2 text-[9px] uppercase font-bold tracking-widest px-3 py-0.5 rounded-full border backdrop-blur-md shadow-lg transition-colors duration-300 ${
        audioState === "speaking"
          ? `${bgTheme} ${borderTheme} ${textTheme} animate-pulse`
          : audioState === "listening"
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          : audioState === "thinking"
          ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
          : "bg-white/5 border-white/10 text-muted-foreground"
      }`}>
        {audioState === "speaking"  && `${name} speaking`}
        {audioState === "listening" && "Listening"}
        {audioState === "thinking"  && "Thinking..."}
        {audioState === "idle"      && "Ready"}
      </div>
    </div>
  );
}
