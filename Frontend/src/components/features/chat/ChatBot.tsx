import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { chatApi } from '@/lib/api/chat';
import { useAuthStore } from '@/stores/authStore';

type Message = {
  id: string;
  type: 'user' | 'bot';
  content: string;
  sources?: string[];
};

type ChatBotProps = {
  isOpen: boolean;
  onToggle: () => void;
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

const translations = {
  en: {
    title: 'AI Assistant',
    placeholder: 'Ask me anything about OMNIX...',
    thinking: 'Thinking...',
    errorMsg: "Sorry, I'm having trouble connecting right now. Please try again.",
    loginRequired: 'Please log in to use the AI Assistant.',
    quickActions: 'Quick Actions:',
    action1: 'Show material shortages',
    action2: 'Show BOM for a product',
    action3: 'Check inventory stock',
    action4: 'List recent orders',
  },
  hi: { title: 'AI सहायक', placeholder: 'OMNIX के बारे में कुछ भी पूछें...', thinking: 'सोच रहा हूं...', errorMsg: 'माफ़ करें, अभी कनेक्ट करने में समस्या है।', loginRequired: 'AI सहायक का उपयोग करने के लिए लॉग इन करें।', quickActions: 'त्वरित क्रियाएं:', action1: 'सामग्री की कमी दिखाएं', action2: 'उत्पाद के लिए BOM दिखाएं', action3: 'इन्वेंटरी स्टॉक जांचें', action4: 'हाल के ऑर्डर सूची' },
  kn: { title: 'AI ಸಹಾಯಕ', placeholder: 'OMNIX ಬಗ್ಗೆ ಏನಾದರೂ ಕೇಳಿ...', thinking: 'ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ...', errorMsg: 'ಕ್ಷಮಿಸಿ, ಈಗ ಸಂಪರ್ಕಿಸಲು ತೊಂದರೆ ಆಗುತ್ತಿದೆ.', loginRequired: 'AI ಸಹಾಯಕ ಬಳಸಲು ಲಾಗಿನ್ ಮಾಡಿ.',  quickActions: 'ತ್ವರಿತ ಕ್ರಿಯೆಗಳು:', action1: 'ಕೊರತೆ ತೋರಿಸಿ', action2: 'BOM ತೋರಿಸಿ', action3: 'ಸ್ಟಾಕ್ ಪರೀಕ್ಷಿಸಿ', action4: 'ಇತ್ತೀಚಿನ ಆರ್ಡರ್‌ಗಳು' },
  ta: { title: 'AI உதவியாளர்', placeholder: 'OMNIX பற்றி எதையும் கேளுங்கள்...', thinking: 'யோசிக்கிறேன்...', errorMsg: 'மன்னிக்கவும், இப்போது இணைக்க சிக்கல் உள்ளது.', loginRequired: 'AI உதவியாளரை பயன்படுத்த உள்நுழையவும்.', quickActions: 'விரைவு செயல்கள்:', action1: 'பற்றாக்குறைகளை காட்டு', action2: 'BOM காட்டு', action3: 'ஸ்டாக் சரிபார்க்க', action4: 'சமீபத்திய ஆர்டர்கள்' },
  te: { title: 'AI సహాయకుడు', placeholder: 'OMNIX గురించి ఏదైనా అడగండి...', thinking: 'ఆలోచిస్తున్నాను...', errorMsg: 'క్షమించండి, ఇప్పుడు కనెక్ట్ చేయడంలో సమస్య.',  loginRequired: 'AI సహాయకుడిని ఉపయోగించడానికి లాగిన్ అవ్వండి.', quickActions: 'త్వరిత చర్యలు:', action1: 'కొరతలు చూపించు', action2: 'BOM చూపించు', action3: 'స్టాక్ తనిఖీ', action4: 'ఇటీవలి ఆర్డర్లు' },
  mr: { title: 'AI सहाय्यक', placeholder: 'OMNIX बद्दल काहीही विचारा...', thinking: 'विचार करत आहे...', errorMsg: 'माफ करा, आत्ता कनेक्ट करण्यात अडचण येत आहे.',  loginRequired: 'AI सहाय्यक वापरण्यासाठी लॉग इन करा.', quickActions: 'जलद क्रिया:', action1: 'साहित्य कमतरता दाखवा', action2: 'BOM दाखवा', action3: 'स्टॉक तपासा', action4: 'अलीकडील ऑर्डर' },
  gu: { title: 'AI સહાયક', placeholder: 'OMNIX વિશે કંઈ પણ પૂછો...', thinking: 'વિચાર કરી રહ્યો છું...', errorMsg: 'માફ કરો, અત્યારે કનેક્ટ કરવામાં સમસ્યા.',  loginRequired: 'AI સહાયકનો ઉપયોગ કરવા લૉગ ઇન કરો.', quickActions: 'ઝડપી ક્રિયાઓ:', action1: 'સામગ્રી ઉણપ', action2: 'BOM બતાવો', action3: 'સ્ટૉક ચકાસો', action4: 'તાજેતરના ઓર્ડર' },
  pa: { title: 'AI ਸਹਾਇਕ', placeholder: 'OMNIX ਬਾਰੇ ਕੁਝ ਵੀ ਪੁੱਛੋ...', thinking: 'ਸੋਚ ਰਿਹਾ ਹਾਂ...', errorMsg: 'ਮੁਆਫ਼ ਕਰਨਾ, ਹੁਣ ਕਨੈਕਟ ਕਰਨ ਵਿੱਚ ਮੁਸ਼ਕਲ ਹੈ।', loginRequired: 'AI ਸਹਾਇਕ ਵਰਤਣ ਲਈ ਲੌਗਇਨ ਕਰੋ।', quickActions: 'ਤੇਜ਼ ਕਾਰਵਾਈਆਂ:', action1: 'ਕਮੀਆਂ ਦਿਖਾਓ', action2: 'BOM ਦਿਖਾਓ', action3: 'ਸਟਾਕ ਦੇਖੋ', action4: 'ਤਾਜ਼ੇ ਆਰਡਰ' }
} as const;

export function ChatBot({ isOpen, onToggle, language }: ChatBotProps) {
  const { isAuthenticated, user } = useAuthStore();
  const t = translations[language] ?? translations['en'];

  const getWelcome = (): Message => ({
    id: '1',
    type: 'bot',
    content: isAuthenticated && user
      ? (language === 'en'
        ? `Hi ${user.name}! I'm your OMNIX AI Assistant. I can check inventory, look up orders, verify BOMs, and guide you through any module. How can I help you today?`
        : `नमस्ते ${user.name}! मैं आपका OMNIX AI सहायक हूं।`)
      : t.loginRequired,
  });

  const [messages, setMessages] = useState<Message[]>([getWelcome()]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickActions = [t.action1, t.action2, t.action3, t.action4];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset session and welcome when user changes
  useEffect(() => {
    setMessages([getWelcome()]);
    setSessionId(undefined);
  }, [isAuthenticated, user?.id]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    if (!isAuthenticated) return;

    const userMsg: Message = { id: Date.now().toString(), type: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Derive module context from the current URL path if possible
      const pathParts = window.location.hash.replace('#', '').split('/').filter(Boolean);
      const moduleContext = pathParts[0] || undefined;

      const resp = await chatApi.sendMessage({
        message: text,
        session_id: sessionId,
        module_context: moduleContext,
      });

      setSessionId(resp.session_id);

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: resp.reply,
        sources: resp.sources,
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: t.errorMsg,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
  };

  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 flex items-center justify-center"
      >
        <MessageCircle className="h-6 w-6" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 right-6 z-50 w-full max-w-md h-[600px] lg:h-[700px] bg-white rounded-lg shadow-2xl flex flex-col mx-4 lg:mx-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-emerald-600 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <span>{t.title}</span>
          {sessionId && (
            <span className="text-xs text-emerald-200 ml-1">● Live</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onToggle} className="text-white hover:bg-emerald-700">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Quick Actions - only show at start */}
      {messages.length === 1 && isAuthenticated && (
        <div className="p-4 border-b bg-zinc-50">
          <div className="mb-2 text-sm text-zinc-600">{t.quickActions}</div>
          <div className="space-y-2">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickAction(action)}
                className="w-full text-left px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] ${message.type === 'user' ? 'bg-emerald-600 text-white shadow-md' : 'bg-zinc-100 text-zinc-900 border border-zinc-200 shadow-sm'} rounded-lg p-3 chatbot-markdown`}>
                {message.type === 'user' ? (
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                ) : (
                  <div className="markdown-content text-sm prose prose-sm max-w-none prose-emerald">
                    <ReactMarkdown 
                      components={{
                        p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                        ul: ({ children }: any) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }: any) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                        li: ({ children }: any) => <li className="mb-1">{children}</li>,
                        strong: ({ children }: any) => <strong className="font-bold text-emerald-900">{children}</strong>,
                        code: ({ children }: any) => <code className="bg-zinc-200 px-1 rounded text-xs font-mono">{children}</code>
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-zinc-200">
                    <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Sources</p>
                    <div className="flex flex-wrap gap-1">
                      {message.sources.map(s => (
                        <span key={s} className="px-1.5 py-0.5 bg-zinc-200 rounded text-[10px] text-zinc-600 font-mono italic">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-zinc-100 rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span className="text-sm text-zinc-500">{t.thinking}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isAuthenticated ? t.placeholder : t.loginRequired}
            className="flex-1"
            disabled={!isAuthenticated || isLoading}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!isAuthenticated || isLoading || !input.trim()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}