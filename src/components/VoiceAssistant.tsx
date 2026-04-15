import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Volume2, Loader2, Sparkles, User as UserIcon, AlertCircle, CheckCircle2, Clock, X, MessageSquare, ClipboardList, Send } from 'lucide-react';
import { cn } from '../lib/utils';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { TrackedScheme, AVAILABLE_SCHEMES } from '../types/schemes';

interface RecommendedScheme {
  name: string;
  description: string;
  reason: string;
  documentsRequired: string[];
}

export interface TranscriptMessage {
  speaker: 'user' | 'assistant';
  text: string;
}

interface VoiceAssistantProps {
  onAddScheme: (scheme: Omit<TrackedScheme, 'id'>) => void;
  conversationHistory: TranscriptMessage[];
  setConversationHistory: React.Dispatch<React.SetStateAction<TranscriptMessage[]>>;
}

const languageNames: Record<string, string> = {
  hi: 'Hindi',
  en: 'English',
  ta: 'Tamil',
  te: 'Telugu',
  pa: 'Punjabi'
};

export function VoiceAssistant({ onAddScheme, conversationHistory, setConversationHistory }: VoiceAssistantProps) {
  const { t, i18n } = useTranslation();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [recommendedSchemes, setRecommendedSchemes] = useState<RecommendedScheme[]>([]);
  const recommendedSchemesRef = useRef<RecommendedScheme[]>([]);
  useEffect(() => {
    recommendedSchemesRef.current = recommendedSchemes;
  }, [recommendedSchemes]);
  const [showWaitNotification, setShowWaitNotification] = useState(false);
  const [isTranscriptMinimized, setIsTranscriptMinimized] = useState(false);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueue = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const liveSessionRef = useRef<any>(null);
  const waitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const connectionStartTimeRef = useRef<number>(0);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Buffers for non-streaming history
  const currentAssistantText = useRef<string>("");
  const currentUserText = useRef<string>("");

  const handleSendTextMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isTextLoading) return;

    const userMessage = textInput.trim();
    setTextInput('');
    setConversationHistory(prev => [...prev, { speaker: 'user', text: userMessage }]);
    setIsTextLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please ensure GEMINI_API_KEY or API_KEY is set.");
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [
          ...conversationHistory.map(msg => ({
            role: msg.speaker === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          })),
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: `You are 'Sahi Sahayika', a warm and patient assistant for the app 'Sahi Bachat'. 
          Your goal is to help low-income individuals in India discover government schemes.
          CRITICAL: You MUST respond in ${languageNames[i18n.language] || 'the user\'s language'}.
          Keep responses simple, clear, and helpful. 
          
          AVAILABLE SCHEMES:
          ${JSON.stringify(AVAILABLE_SCHEMES, null, 2)}

          RULES:
          1. Do not repeat information you have already provided.
          2. If recommending schemes, explain them briefly and encourage the user to use the voice assistant for a deeper dive.
          3. If the user has already been told about a scheme, do not bring it up again unless they ask.`
        }
      });

      const text = response.text || "I'm sorry, I couldn't generate a response.";
      
      setConversationHistory(prev => [...prev, { speaker: 'assistant', text }]);
    } catch (err) {
      console.error("Text chat error:", err);
      setError("Failed to send message. Please try again.");
    } finally {
      setIsTextLoading(false);
    }
  };

  const historyLengthRef = useRef(0);
  useEffect(() => {
    historyLengthRef.current = conversationHistory.length;
  }, [conversationHistory.length]);

  const stopConversation = useCallback(async (reason?: string) => {
    console.log(`Stopping conversation. Reason: ${reason || 'Not specified'}`);
    const wasConnected = !!sessionRef.current;

    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {}
      currentSourceRef.current = null;
    }

    if (sessionRef.current) {
      try {
        await sessionRef.current.close();
      } catch (e) {
        console.error("Error closing session:", e);
      }
      sessionRef.current = null;
    }
    liveSessionRef.current = null;
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setIsSpeaking(false);
    setIsConnecting(false);
    audioQueue.current = [];
    isPlayingRef.current = false;
    
    // Show receipt if conversation happened and we have data
    if (wasConnected && (historyLengthRef.current > 0 || recommendedSchemesRef.current.length > 0)) {
      setShowReceipt(true);
    }
  }, []);

  const playNextInQueue = useCallback(async () => {
    if (audioQueue.current.length === 0 || !audioContextRef.current) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    const pcmData = audioQueue.current.shift()!;
    
    // Gemini Live API usually outputs at 24000Hz
    const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 0x7FFF;
    }

    const source = audioContextRef.current.createBufferSource();
    currentSourceRef.current = source;
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      if (currentSourceRef.current === source) {
        currentSourceRef.current = null;
      }
      playNextInQueue();
    };
    source.start();
  }, []);

  const startConversation = useCallback(async (force = false) => {
    console.log("startConversation called", { force, isConnecting, isConnected });
    if (isConnecting || isConnected) {
      console.log("Already connecting or connected, ignoring start request");
      return;
    }

    if (!force && historyLengthRef.current > 0 && !showRefreshConfirm) {
      setShowRefreshConfirm(true);
      return;
    }
    setShowRefreshConfirm(false);

    try {
      setError(null);
      setIsConnecting(true);
      setShowWaitNotification(true);
      connectionStartTimeRef.current = Date.now();
      
      if (force) {
        setConversationHistory([]);
        setRecommendedSchemes([]);
        historyLengthRef.current = 0;
        recommendedSchemesRef.current = [];
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) throw new Error("API Key is missing. Please ensure GEMINI_API_KEY or API_KEY is set.");

      const ai = new GoogleGenAI({ apiKey });

      const recommendSchemeTool = {
        functionDeclarations: [
          {
            name: "recommend_schemes",
            description: "Provide a list of government schemes recommended for the user based on their eligibility.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                schemes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "The official name of the scheme" },
                      description: { type: Type.STRING, description: "A brief description of the scheme" },
                      reason: { type: Type.STRING, description: "Why this scheme is recommended for the user" },
                      documentsRequired: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING },
                        description: "A list of documents required to apply for this scheme (e.g. Aadhaar Card, Income Certificate)"
                      }
                    },
                    required: ["name", "description", "reason", "documentsRequired"]
                  },
                  description: "A list of government schemes with their details."
                }
              },
              required: ["schemes"]
            }
          }
        ]
      };

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          tools: [recommendSchemeTool],
          systemInstruction: `You are a warm, friendly, and patient female voice assistant named 'Sahi Sahayika' for the app 'Sahi Bachat'. Your goal is to help low-income individuals in India discover government schemes. 
          
          AVAILABLE SCHEMES TO RECOMMEND:
          ${JSON.stringify(AVAILABLE_SCHEMES, null, 2)}

          1. Greet the user warmly in ${languageNames[i18n.language] || 'their chosen language'}. Supported languages include Hindi, English, Tamil, Telugu, and Punjabi.
          2. You are trained to understand various Indian dialects and accents. Be flexible and patient.
          3. Ask simple questions to understand their eligibility: Age, Gender, Income, Occupation, Location.
          4. Based on their info, suggest relevant schemes from the AVAILABLE SCHEMES list above. 
          5. MANDATORY: When you recommend schemes, you MUST call the 'recommend_schemes' tool. You MUST also verbally explain these schemes to the user.
          6. REPETITION RULE: Do not repeat yourself. If you have already explained a scheme or asked a question, do not repeat it. Keep the conversation moving forward.
          7. Do not end the conversation after recommending schemes. Continue to be helpful, ask if they have any questions.
          8. Explain the benefits in very simple terms.
          9. SAFETY RULE: If the user asks about bank details, explain that you only need to know IF they have a bank account for eligibility, but you will NEVER need their account number, PIN, or password.
          10. Be extremely patient, respectful, and use short, clear sentences.
          11. INITIAL ACTION: Start the conversation immediately by saying 'Hello' and introducing yourself as Sahi Sahayika in ${languageNames[i18n.language] || 'English'}.`,
        },
        callbacks: {
          onopen: async () => {
            console.log("Live session opened successfully. AudioContext state:", audioContext.state);
            
            // Set the session ref immediately
            const session = await sessionPromise;
            liveSessionRef.current = session;
            sessionRef.current = session;

            setIsConnected(true);
            setIsConnecting(false);
            
            // Resume audio context if suspended
            if (audioContext.state === 'suspended') {
              console.log("Resuming suspended AudioContext...");
              audioContext.resume().then(() => {
                console.log("AudioContext resumed. New state:", audioContext.state);
              });
            }
            
            // Ensure notification stays for at least 10 seconds
            const elapsed = Date.now() - connectionStartTimeRef.current;
            const remaining = Math.max(0, 10000 - elapsed);
            
            waitTimerRef.current = setTimeout(() => {
              setShowWaitNotification(false);
            }, remaining);

            // Trigger initial greeting
            session.sendRealtimeInput({ text: "Hello! Please introduce yourself and start the conversation in " + (languageNames[i18n.language] || 'English') });

            // Setup audio source and processor
            const source = audioContext.createMediaStreamSource(stream);
            // Larger buffer size for better stability
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (!liveSessionRef.current || !stream.active) return;

              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              
              // Convert to base64
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              
              liveSessionRef.current.sendRealtimeInput({
                audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
              });
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
          },
          onmessage: async (message: any) => {
            console.log("Live message received:", message);
            
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const binary = atob(base64Audio);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              const pcmData = new Int16Array(bytes.buffer);
              audioQueue.current.push(pcmData);
              if (!isPlayingRef.current) {
                playNextInQueue();
              }
            }

            // Handle transcription
            const modelTurn = message.serverContent?.modelTurn;
            const userTurn = message.serverContent?.userTurn;

            if (modelTurn?.parts) {
              modelTurn.parts.forEach((part: any) => {
                if (part.text) {
                  currentAssistantText.current += part.text;
                }
              });
            }

            if (userTurn?.parts) {
              userTurn.parts.forEach((part: any) => {
                if (part.text) {
                  currentUserText.current += part.text;
                }
              });
            }

            // Update history only when turn is complete (non-streaming)
            if (message.serverContent?.turnComplete) {
              if (currentAssistantText.current.trim()) {
                const text = currentAssistantText.current.trim();
                setConversationHistory(prev => [...prev, { speaker: 'assistant', text }]);
                currentAssistantText.current = "";
              }
              if (currentUserText.current.trim()) {
                const text = currentUserText.current.trim();
                setConversationHistory(prev => [...prev, { speaker: 'user', text }]);
                currentUserText.current = "";
              }
            }

            // Handle tool calls for recommended schemes
            const toolCall = message.toolCall;
            if (toolCall?.functionCalls) {
              const functionResponses = toolCall.functionCalls.map((call: any) => {
                if (call.name === "recommend_schemes") {
                  const { schemes } = call.args;
                  if (Array.isArray(schemes)) {
                    setRecommendedSchemes(prev => {
                      const newSchemes = [...prev];
                      schemes.forEach((scheme: RecommendedScheme) => {
                        if (!newSchemes.find(s => s.name === scheme.name)) {
                          newSchemes.push(scheme);
                        }
                      });
                      return newSchemes;
                    });
                  }
                  return {
                    name: call.name,
                    id: call.id,
                    response: { result: "Schemes successfully added to the recommendation list." }
                  };
                }
                return {
                  name: call.name,
                  id: call.id,
                  response: { error: "Unknown function call" }
                };
              });

              if (liveSessionRef.current && functionResponses.length > 0) {
                liveSessionRef.current.sendToolResponse({ functionResponses });
              }
            }

            // Handle interruption
            if (message.serverContent?.interrupted) {
              console.log("Interrupted by user");
              audioQueue.current = [];
              if (currentSourceRef.current) {
                try {
                  currentSourceRef.current.stop();
                } catch (e) {}
                currentSourceRef.current = null;
              }
              isPlayingRef.current = false;
              setIsSpeaking(false);
              currentAssistantText.current = "";
              currentUserText.current = "";
            }
          },
          onerror: (err) => {
            console.error("Live session error:", err);
            const msg = err.message || "Unknown error";
            setError(`Connection error: ${msg}.`);
            stopConversation("onerror");
          },
          onclose: () => {
            console.log("Live session closed by server or network");
            stopConversation("onclose");
          }
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      console.error("Failed to start conversation:", err);
      setError(`Failed to start: ${err.message || 'Check microphone and connection'}`);
      setIsConnecting(false);
      stopConversation("startConversation catch");
    }
  }, [i18n.language, stopConversation, playNextInQueue]);

  useEffect(() => {
    return () => {
      stopConversation("cleanup");
    };
  }, [stopConversation]);

  const handleSaveSchemes = () => {
    recommendedSchemes.forEach(scheme => {
      onAddScheme({
        schemeName: scheme.name,
        description: scheme.description,
        reason: scheme.reason,
        status: 'not_started',
        lastUpdated: new Date().toLocaleDateString(),
        documents: (scheme.documentsRequired || []).map(docName => ({
          name: docName,
          status: 'pending'
        })),
        officialLink: 'https://www.myscheme.gov.in/'
      });
    });
    setShowReceipt(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-gradient-to-b from-orange-50 to-white relative overflow-hidden">
      {/* Side Chatbot Panel */}
      <motion.div
        initial={false}
        animate={{ 
          width: isMobileChatOpen ? '100%' : (isTranscriptMinimized ? 60 : 350),
          x: 0 
        }}
        className={cn(
          "flex-col border-r border-orange-100 bg-white/80 backdrop-blur-md z-[60] relative transition-all duration-300",
          isMobileChatOpen ? "fixed inset-0 flex bg-white" : "hidden md:flex"
        )}
      >
        <div className="p-4 border-b border-orange-100 flex items-center justify-between overflow-hidden">
          {(!isTranscriptMinimized || isMobileChatOpen) && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 truncate">{t('text_chatbot')}</h3>
            </div>
          )}
          <button 
            onClick={() => {
              if (isMobileChatOpen) {
                setIsMobileChatOpen(false);
              } else {
                setIsTranscriptMinimized(!isTranscriptMinimized);
              }
            }}
            className="p-2 hover:bg-orange-50 rounded-xl text-orange-600 transition-colors shrink-0"
            title={isTranscriptMinimized ? t('expand') : t('minimize')}
          >
            {(isTranscriptMinimized && !isMobileChatOpen) ? <MessageSquare className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>
        
        {(!isTranscriptMinimized || isMobileChatOpen) && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-orange-200">
              {conversationHistory.length > 0 ? (
                conversationHistory.map((line, i) => (
                  <motion.div 
                    key={`history-${i}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-3 rounded-2xl text-sm shadow-sm border max-w-[90%]",
                      line.speaker === 'assistant' 
                        ? "bg-orange-50 text-orange-800 border-orange-100 self-start" 
                        : "bg-blue-50 text-blue-800 border-blue-100 self-end ml-auto"
                    )}
                  >
                    <p className="font-bold text-[10px] uppercase tracking-widest mb-1 opacity-50">
                      {line.speaker === 'assistant' ? t('assistant_name') : t('you')}
                    </p>
                    <p className="whitespace-pre-wrap">{line.text}</p>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40 px-6">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-orange-600" />
                  </div>
                  <p className="text-sm italic">{t('chatbot_welcome')}</p>
                </div>
              )}
              {isTextLoading && (
                <div className="flex gap-2 p-3 bg-orange-50/50 rounded-2xl border border-orange-100 w-16 items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-orange-100 bg-white">
              <form onSubmit={handleSendTextMessage} className="relative">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={t('type_message')}
                  className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isTextLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all disabled:opacity-50 disabled:bg-gray-300"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </motion.div>

      {/* Mobile Chatbot FAB */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsMobileChatOpen(true)}
        className="md:hidden fixed bottom-24 right-6 w-14 h-14 bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center z-40"
      >
        <MessageSquare className="w-6 h-6" />
        {conversationHistory.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {conversationHistory.length}
          </span>
        )}
      </motion.button>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <AnimatePresence>
          {showRefreshConfirm && (
            <motion.div
              key="refresh-confirm"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            >
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
                <h3 className="text-xl font-bold text-gray-800">{t('transcript_refresh_confirm')}</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRefreshConfirm(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowRefreshConfirm(false);
                      startConversation(true);
                    }}
                    className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all"
                  >
                    Yes, Start
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {showWaitNotification && (
          <motion.div
            key="wait-notification"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className="bg-orange-600 text-white p-4 rounded-2xl shadow-xl flex items-start gap-3 relative">
              <div className="bg-white/20 p-2 rounded-lg shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1 pr-6">
                <p className="text-sm font-bold">{t('wait_notification_title')}</p>
                <p className="text-xs opacity-90 mt-1">{t('wait_notification_desc')}</p>
              </div>
              <button 
                onClick={() => setShowWaitNotification(false)}
                className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {showReceipt && (
          <motion.div
            key="receipt-modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800">{t('call_summary')}</h3>
                <p className="text-gray-500">{t('assistant_active_desc')}</p>
              </div>

               <div className="space-y-3 max-h-80 overflow-y-auto p-2">
                {recommendedSchemes.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('schemes_discussed')}</h4>
                    {recommendedSchemes.map((scheme, idx) => (
                      <div key={`rec-${idx}`} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-800 text-sm">{scheme.name}</h4>
                          </div>
                          <div className="flex items-center gap-1 text-orange-600 font-bold text-xs">
                            <Sparkles className="w-4 h-4" />
                            {t('recommended')}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{scheme.description}</p>
                      </div>
                    ))}
                    <button
                      onClick={handleSaveSchemes}
                      className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
                    >
                      <ClipboardList className="w-5 h-5" />
                      {t('save_recommended_schemes')}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 mb-4">
                    <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 italic">{t('no_schemes_recommended')}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('conversation_log')}</h4>
                  {conversationHistory.length > 0 ? (
                    <div className="space-y-3">
                      {conversationHistory.map((line, i) => (
                        <div key={`receipt-line-${i}`} className={cn(
                          "p-3 rounded-2xl text-sm",
                          line.speaker === 'assistant' 
                            ? "bg-orange-50 text-orange-800 border border-orange-100 mr-8" 
                            : "bg-blue-50 text-blue-800 border border-blue-100 ml-8"
                        )}>
                          <p className="font-bold text-[10px] uppercase tracking-widest mb-1 opacity-50">
                            {line.speaker === 'assistant' ? t('assistant_name') : t('you')}
                          </p>
                          <p>{line.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-4 text-gray-400 italic text-sm">{t('no_history_available')}</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowReceipt(false)}
                className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                {t('close')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl w-full text-center space-y-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative inline-block"
        >
          <div className={cn(
            "w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500",
            isConnected ? "bg-orange-100 shadow-2xl shadow-orange-200" : "bg-gray-100",
            isSpeaking && "scale-110 ring-8 ring-orange-200 ring-opacity-50"
          )}>
            <AnimatePresence mode="wait">
              {!isConnected ? (
                <MicOff key="mic-off" className="w-20 h-20 text-gray-400" />
              ) : (
                <motion.div
                  key="mic-on"
                  animate={isSpeaking ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Mic className="w-20 h-20 text-orange-600" />
                </motion.div>
              )}
            </AnimatePresence>
            
            {isSpeaking && (
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-orange-400"
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
          </div>
        </motion.div>

        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-gray-800">
            {isConnected ? t('assistant_listening', 'I\'m listening...') : t('start_conversation', 'Start Conversation')}
          </h2>
          <p className="text-gray-600 max-w-md mx-auto">
            {isConnected 
              ? t('assistant_active_desc', 'Ask me about government schemes for health, education, or income support.')
              : t('assistant_idle_desc', 'Click the button below to start talking with our assistant in your language.')}
          </p>
        </div>

        {isConnected && conversationHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden max-w-md w-full mx-auto bg-white/50 backdrop-blur-sm rounded-3xl p-4 border border-white/50 shadow-sm max-h-40 overflow-y-auto space-y-2 mb-4"
          >
            {conversationHistory.slice(-3).map((line, i) => (
              <div key={`mobile-history-${conversationHistory.length - 3 + i}`} className={cn(
                "text-sm p-2 rounded-xl",
                line.speaker === 'assistant' ? "bg-orange-100/50 text-orange-900" : "bg-blue-100/50 text-blue-900"
              )}>
                <span className="font-bold text-[10px] uppercase mr-2 opacity-50">
                  {line.speaker === 'assistant' ? 'Sahi Sahayika' : 'You'}
                </span>
                {line.text}
              </div>
            ))}
          </motion.div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex flex-col items-center gap-3 justify-center max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </div>
            {(error.toLowerCase().includes('permission') || error.toLowerCase().includes('notallowed') || error.toLowerCase().includes('denied')) && (
              <div className="text-xs text-red-500 bg-white/50 p-3 rounded-lg border border-red-100 space-y-2">
                <p>Microphone access is often blocked in the preview pane. Please try opening the app in a new tab to use the voice assistant.</p>
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="w-full py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                >
                  Open in New Tab
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          {!isConnected ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => startConversation(false)}
                disabled={isConnecting}
                className="px-8 py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {isConnecting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
                {isConnecting ? t('connecting', 'Connecting...') : t('start_talking', 'Start Talking')}
              </button>
              
              {(conversationHistory.length > 0 || recommendedSchemes.length > 0) && (
                <button
                  onClick={() => setShowReceipt(true)}
                  className="px-8 py-4 bg-white text-orange-600 border-2 border-orange-100 hover:border-orange-200 rounded-2xl font-bold transition-all active:scale-95 flex items-center gap-2"
                >
                  <ClipboardList className="w-6 h-6" />
                  {t('call_summary')}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => stopConversation('user_click')}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-lg shadow-red-200 transition-all active:scale-95"
            >
              {t('end_call', 'End Call')}
            </button>
          )}
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-800 mb-1">{t('simple_advice', 'Simple Advice')}</h3>
            <p className="text-sm text-gray-500">{t('simple_advice_desc', 'Get recommendations in simple language you understand.')}</p>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-3">
              <Volume2 className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-bold text-gray-800 mb-1">{t('voice_first', 'Voice First')}</h3>
            <p className="text-sm text-gray-500">{t('voice_first_desc', 'No need to type. Just speak and listen to the responses.')}</p>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
              <UserIcon className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-800 mb-1">{t('personalized', 'Personalized')}</h3>
            <p className="text-sm text-gray-500">{t('personalized_desc', 'Schemes tailored to your age, location, and needs.')}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
