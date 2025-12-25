import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Mic, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { MaterialRequestProcessor, MaterialRequest } from '@/lib/material-request-processor';
import { BOM_DATA, SKUs, INVENTORY_STOCK, PRODUCTION_ORDERS } from '@/lib/apparel-data';

type Message = {
  id: string;
  type: 'user' | 'bot';
  content: string;
  actionCard?: ActionCard;
  materialRequest?: MaterialRequest;
};

type ActionCard = {
  type: 'bom' | 'transfer' | 'stock' | 'shortage' | 'material_request' | 'navigation';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
};

type ChatBotProps = {
  isOpen: boolean;
  onToggle: () => void;
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
  onNavigate: (view: string) => void;
};

export function ChatBot({ isOpen, onToggle, language, onNavigate }: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: language === 'en' 
        ? 'Hi! I\'m your Manufacturing Assistant. I can help you create BOMs, transfer materials, check stock, and more. How can I help you today?'
        : 'नमस्ते! मैं आपका निर्माण सहायक हूं। मैं BOM बनाने, सामग्री स्थानांतरण, स्टॉक जांच में मदद कर सकता हूं। आज मैं आपकी कैसे मदद कर सकता हूं?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const translations = {
    en: {
      title: 'AI Assistant',
      placeholder: 'Type your message or use voice...',
      quickActions: 'Quick Actions:',
      action1: 'Create BOM for <Product>',
      action2: 'Show shortages for PO-101',
      action3: 'Move 20kg Steel to Assembly',
      action4: 'What is stock of Screws?',
      confirm: 'Confirm',
      cancel: 'Cancel',
      edit: 'Edit',
      createBOM: 'Create BOM',
      updateStock: 'Update Stock',
      transfer: 'Transfer'
    },
    hi: {
      title: 'AI सहायक',
      placeholder: 'अपना संदेश टाइप करें या आवाज का उपयोग करें...',
      quickActions: 'त्वरित क्रियाएं:',
      action1: '<उत्पाद> के लिए BOM बनाएं',
      action2: 'PO-101 के लिए कमी दिखाएं',
      action3: '20kg स्टील को असेंबली में ले जाएं',
      action4: 'स्क्रू का स्टॉक क्या है?',
      confirm: 'पुष्टि करें',
      cancel: 'रद्द करें',
      edit: 'संपादित करें',
      createBOM: 'BOM बनाएं',
      updateStock: 'स्टॉक अपडेट करें',
      transfer: 'स्थानांतरण'
    },
    kn: {
      title: 'AI ಸಹಾಯಕ',
      placeholder: 'ನಿಮ್ಮ ಸಂದೇಶವನ್ನು ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಧ್ವನಿಯನ್ನು ಬಳಸಿ...',
      quickActions: 'ತ್ವರಿತ ಕ್ರಿಯೆಗಳು:',
      action1: '<ಉತ್ಪನ್ನ>ಕ್ಕಾಗಿ BOM ರಚಿಸಿ',
      action2: 'PO-101 ಗಾಗಿ ಕೊರತೆಗಳನ್ನು ತೋರಿಸಿ',
      action3: '20kg ಸ್ಟೀಲ್ ಅನ್ನು ಅಸೆಂಬ್ಲಿಗೆ ಸರಿಸಿ',
      action4: 'ಸ್ಕ್ರೂಗಳ ಸ್ಟಾಕ್ ಏನು?',
      confirm: 'ದೃಢೀಕರಿಸಿ',
      cancel: 'ರದ್ದುಮಾಡಿ',
      edit: 'ಸಂಪಾದಿಸಿ',
      createBOM: 'BOM ರಚಿಸಿ',
      updateStock: 'ಸ್ಟಾಕ್ ನವೀಕರಿಸಿ',
      transfer: 'ವರ್ಗಾವಣೆ'
    },
    ta: {
      title: 'AI உதவியாளர்',
      placeholder: 'உங்கள் செய்தியை தட்டச்சு செய்யவும் அல்லது குரலைப் பயன்படுத்தவும்...',
      quickActions: 'விரைவு செயல்கள்:',
      action1: '<தயாரிப்பு>க்கான BOM உருவாக்கவும்',
      action2: 'PO-101க்கான பற்றாக்குறைகளைக் காட்டு',
      action3: '20kg எஃகு அசெம்பிளிக்கு நகர்த்தவும்',
      action4: 'திருகுகளின் பங்கு என்ன?',
      confirm: 'உறுதிப்படுத்தவும்',
      cancel: 'ரத்துசெய்',
      edit: 'திருத்து',
      createBOM: 'BOM உருவாக்கவும்',
      updateStock: 'பங்கு புதுப்பிக்கவும்',
      transfer: 'இடமாற்றம்'
    },
    te: {
      title: 'AI సహాయకుడు',
      placeholder: 'మీ సందేశాన్ని టైప్ చేయండి లేదా వాయిస్ ఉపయోగించండి...',
      quickActions: 'త్వరిత చర్యలు:',
      action1: '<ఉత్పత్తి> కోసం BOM సృష్టించండి',
      action2: 'PO-101 కోసం లోటులను చూపించు',
      action3: '20kg ఉక్కును అసెంబ్లీకి తరలించండి',
      action4: 'స్క్రూల స్టాక్ ఏమిటి?',
      confirm: 'నిర్ధారించండి',
      cancel: 'రద్దు చేయండి',
      edit: 'సవరించు',
      createBOM: 'BOM సృష్టించండి',
      updateStock: 'స్టాక్ నవీకరించండి',
      transfer: 'బదిలీ'
    },
    mr: {
      title: 'AI सहाय्यक',
      placeholder: 'तुमचा संदेश टाइप करा किंवा आवाज वापरा...',
      quickActions: 'जलद क्रिया:',
      action1: '<उत्पादन> साठी BOM तयार करा',
      action2: 'PO-101 साठी कमतरता दाखवा',
      action3: '20kg स्टील असेंब्लीमध्ये हलवा',
      action4: 'स्क्रूचा स्टॉक काय आहे?',
      confirm: 'पुष्टी करा',
      cancel: 'रद्द करा',
      edit: 'संपादित करा',
      createBOM: 'BOM तयार करा',
      updateStock: 'स्टॉक अपडेट करा',
      transfer: 'हस्तांतरण'
    },
    gu: {
      title: 'AI સહાયક',
      placeholder: 'તમારો સંદેશ ટાઇપ કરો અથવા અવાજનો ઉપયોગ કરો...',
      quickActions: 'ઝડપી ક્રિયાઓ:',
      action1: '<ઉત્પાદન> માટે BOM બનાવો',
      action2: 'PO-101 માટે ઉણપ બતાવો',
      action3: '20kg સ્ટીલને એસેમ્બલીમાં ખસેડો',
      action4: 'સ્ક્રૂનો સ્ટોક શું છે?',
      confirm: 'પુષ્ટિ કરો',
      cancel: 'રદ કરો',
      edit: 'સંપાદિત કરો',
      createBOM: 'BOM બનાવો',
      updateStock: 'સ્ટોક અપડેટ કરો',
      transfer: 'સ્થાનાંતરણ'
    },
    pa: {
      title: 'AI ਸਹਾਇਕ',
      placeholder: 'ਆਪਣਾ ਸੁਨੇਹਾ ਟਾਈਪ ਕਰੋ ਜਾਂ ਆਵਾਜ਼ ਵਰਤੋਂ...',
      quickActions: 'ਤੇਜ਼ ਕਾਰਵਾਈਆਂ:',
      action1: '<ਉਤਪਾਦ> ਲਈ BOM ਬਣਾਓ',
      action2: 'PO-101 ਲਈ ਕਮੀਆਂ ਦਿਖਾਓ',
      action3: '20kg ਸਟੀਲ ਅਸੈਂਬਲੀ ਵਿੱਚ ਭੇਜੋ',
      action4: 'ਸਕਰੂਆਂ ਦਾ ਸਟਾਕ ਕੀ ਹੈ?',
      confirm: 'ਪੁਸ਼ਟੀ ਕਰੋ',
      cancel: 'ਰੱਦ ਕਰੋ',
      edit: 'ਸੰਪਾਦਿਤ ਕਰੋ',
      createBOM: 'BOM ਬਣਾਓ',
      updateStock: 'ਸਟਾਕ ਅੱਪਡੇਟ ਕਰੋ',
      transfer: 'ਟ੍ਰਾਂਸਫਰ'
    }
  };

  const t = translations[language];

  const quickActions = [
    t.action1,
    t.action2,
    t.action3,
    t.action4
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const processMessage = (text: string): Message => {
    const lowercaseText = text.toLowerCase();
    
    // Check if it's a material request/transfer command
    if (lowercaseText.includes('request') || lowercaseText.includes('move') || lowercaseText.includes('transfer') || 
        lowercaseText.includes('स्थानांतरण') || lowercaseText.includes('material') || lowercaseText.includes('सामग्री') ||
        lowercaseText.includes('send') || lowercaseText.includes('भेज') || lowercaseText.includes('needs') || lowercaseText.includes('need') ||
        lowercaseText.includes('beku') || lowercaseText.includes('venum') || lowercaseText.includes('चाहिए') ||
        (lowercaseText.match(/(\d+)\s*(kg|m|pcs|units?|metre|meter|किलो|मीटर|litres?)/i) && 
         (lowercaseText.includes('cotton') || lowercaseText.includes('fabric') || lowercaseText.includes('thread') || 
          lowercaseText.includes('कपास') || lowercaseText.includes('धागा') || lowercaseText.includes('cutting') || 
          lowercaseText.includes('sewing') || lowercaseText.includes('stitching') || lowercaseText.includes('qc')))) {
      
      // Use Enhanced Material Request Processor
      const materialRequest = MaterialRequestProcessor.processRequestAdvanced(text, language);
      const responseText = MaterialRequestProcessor.generateResponseEnhanced(materialRequest, language === 'en' ? 'en' : 'hi');
      
      return {
        id: Date.now().toString(),
        type: 'bot',
        content: responseText,
        materialRequest: materialRequest,
        actionCard: materialRequest.status === 'partial_stock' || materialRequest.status === 'insufficient_stock' 
          ? {
              type: 'material_request',
              data: materialRequest
            }
          : undefined
      };
    }
    
    // BOM Creation
    if (lowercaseText.includes('bom') || lowercaseText.includes('ts-001') || lowercaseText.includes('hd-001') || lowercaseText.includes('tr-001') || lowercaseText.includes('t-shirt') || lowercaseText.includes('hoodie') || lowercaseText.includes('track pants')) {
      const sku = lowercaseText.includes('ts-001') || lowercaseText.includes('t-shirt') || lowercaseText.includes('टी-शर्ट') ? 'TS-001' : 
                  lowercaseText.includes('hd-001') || lowercaseText.includes('hoodie') || lowercaseText.includes('हुडी') ? 'HD-001' :
                  'TR-001';
      
      const bomData = BOM_DATA[sku as keyof typeof BOM_DATA];
      const productName = SKUs[sku as keyof typeof SKUs];
      
      return {
        id: Date.now().toString(),
        type: 'bot',
        content: language === 'en' 
          ? `✅ BOM for ${sku}: ${productName}\n\nHere are the required materials per unit:`
          : `✅ ${sku} के लिए BOM: ${productName}\n\nप्रति यूनिट आवश्यक सामग्री:`,
        actionCard: {
          type: 'bom',
          data: {
            product: `${sku}: ${productName}`,
            materials: bomData
          }
        }
      };
    }
    
    // Stock Inquiry
    if (lowercaseText.includes('stock') || lowercaseText.includes('inventory') || lowercaseText.includes('स्टॉक') || lowercaseText.includes('show')) {
      // Try to extract material name
      let materialName: string | null = null;
      
      // Check for specific materials in inventory
      for (const material of Object.keys(INVENTORY_STOCK)) {
        if (lowercaseText.includes(material.toLowerCase())) {
          materialName = material;
          break;
        }
      }
      
      // Check aliases
      if (!materialName) {
        const parsed = MaterialRequestProcessor.parseRequest(text);
        if (parsed.materials && parsed.materials.length > 0) {
          materialName = parsed.materials[0].name;
        }
      }
      
      if (materialName && INVENTORY_STOCK[materialName as keyof typeof INVENTORY_STOCK]) {
        const stockData = INVENTORY_STOCK[materialName as keyof typeof INVENTORY_STOCK];
        const allocated = Math.floor(stockData.qty * 0.3);
        const free = stockData.qty - allocated;
        
        return {
          id: Date.now().toString(),
          type: 'bot',
          content: language === 'en'
            ? `📦 Stock Status: ${materialName}`
            : `📦 स्टॉक स्थिति: ${materialName}`,
          actionCard: {
            type: 'stock',
            data: {
              material: materialName,
              available: `${stockData.qty} ${stockData.unit}`,
              allocated: `${allocated} ${stockData.unit}`,
              free: `${free} ${stockData.unit}`,
              location: stockData.location
            }
          }
        };
      }
    }
    
    // Production Order Status
    if (lowercaseText.includes('po-') || lowercaseText.includes('production') || lowercaseText.includes('order') || lowercaseText.includes('status')) {
      const poMatch = text.match(/po[-\s]?(\d+)/i);
      if (poMatch) {
        const poId = `PO-${poMatch[1]}`;
        const order = PRODUCTION_ORDERS.find(o => o.id === poId);
        
        if (order) {
          return {
            id: Date.now().toString(),
            type: 'bot',
            content: language === 'en'
              ? `📊 ${poId} Status\n\nProduct: ${order.product}\nQuantity: ${order.qty} units\nProgress: ${order.progress}%\nDue: ${order.dueDate}\nStage: ${order.stage}\nStatus: ${order.status}`
              : `📊 ${poId} स्थिति\n\nउत्पाद: ${order.product}\nमात्रा: ${order.qty} यूनिट\nप्रगति: ${order.progress}%\nदेय: ${order.dueDate}\nचरण: ${order.stage}\nस्थिति: ${order.status}`
          };
        }
      }
    }
    
    // Shortage Check
    if (lowercaseText.includes('shortage') || lowercaseText.includes('short') || lowercaseText.includes('कमी') || lowercaseText.includes('low stock')) {
      const shortages: Array<{material: string; available: number; reorderLevel: number; shortage: number}> = [];
      
      Object.entries(INVENTORY_STOCK).forEach(([material, data]) => {
        const reorderLevel = data.qty * 0.2;
        if (data.qty < reorderLevel * 2) {
          shortages.push({
            material,
            available: data.qty,
            reorderLevel: Math.ceil(reorderLevel),
            shortage: Math.ceil(reorderLevel * 2 - data.qty)
          });
        }
      });
      
      if (shortages.length > 0) {
        return {
          id: Date.now().toString(),
          type: 'bot',
          content: language === 'en'
            ? `⚠️ Material Shortages Detected (${shortages.length} items)`
            : `⚠️ सामग्री की कमी का पता चला (${shortages.length} आइटम)`,
          actionCard: {
            type: 'shortage',
            data: {
              items: shortages.map(s => ({
                material: s.material,
                required: s.reorderLevel * 2,
                available: s.available,
                shortage: s.shortage
              }))
            }
          }
        };
      } else {
        return {
          id: Date.now().toString(),
          type: 'bot',
          content: language === 'en'
            ? '✅ All materials are at sufficient levels!'
            : '✅ सभी सामग्री पर्याप्त स्तर पर हैं!'
        };
      }
    }
    
    // Default response with enhanced examples
    return {
      id: Date.now().toString(),
      type: 'bot',
      content: language === 'en'
        ? 'I can help you with:\n\n🔹 Material Requests\n• "Request 50 kg Cotton Fabric for Cutting"\n• "Cutting को 20 kg cotton भेज दो"\n• "QC-ge 5 litres chemical beku"\n\n🔹 BOMs & Production\n• "Show BOM for TS-001"\n• "Status of PO-1001"\n\n🔹 Inventory\n• "Stock status of Thread"\n• "Show material shortages"\n\n💡 Tip: Click here to open Material Request page →'
        : 'मैं मदद कर सकता हूं:\n\n🔹 सामग्री अनुरोध\n• "कटिंग के लिए 50 किलो कपास का अनुरोध करें"\n• "Cutting को 20 kg cotton भेज दो"\n• "Stitching को thread चाहिए"\n\n🔹 BOM और उत्पादन\n• "TS-001 के लिए BOM दिखाएं"\n• "PO-1001 की स्थिति"\n\n🔹 इन्वेंटरी\n• "थ्रेड की स्टॉक स्थिति"\n• "सामग्री की कमी दिखाएं"\n\n💡 सुझाव: सामग्री अनुरोध पेज खोलने के लिए यहां क्लिक करें →',
      actionCard: {
        type: 'navigation',
        data: {
          text: language === 'en' ? 'Open Material Request Page' : 'सामग्री अनुरोध पेज खोलें',
          view: 'material-request'
        }
      }
    };
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    
    setTimeout(() => {
      const botResponse = processMessage(input);
      setMessages(prev => [...prev, botResponse]);
    }, 500);

    setInput('');
  };

  const handleVoiceInput = () => {
    setIsListening(true);
    
    // Simulate voice recognition
    setTimeout(() => {
      const simulatedInput = language === 'en' 
        ? "Move 5 bundles from Cutting to Sewing Line 2"
        : "5 बंडल को कटिंग से सिलाई लाइन 2 में ले जाएं";
      setInput(simulatedInput);
      setIsListening(false);
    }, 2000);
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
    handleSend();
  };

  const handleConfirmAction = (_message: Message) => {
    const confirmMessage: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: language === 'en' 
        ? '✓ Action completed successfully! The system has been updated.'
        : '✓ क्रिया सफलतापूर्वक पूर्ण हुई! सिस्टम अपडेट हो गया है।'
    };
    setMessages(prev => [...prev, confirmMessage]);
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
        </div>
        <Button variant="ghost" size="sm" onClick={onToggle} className="text-white hover:bg-emerald-700">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Quick Actions */}
      {messages.length === 1 && (
        <div className="p-4 border-b bg-zinc-50">
          <div className="mb-2 text-zinc-600">{t.quickActions}</div>
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
              <div className={`max-w-[80%] ${message.type === 'user' ? 'bg-emerald-600 text-white' : 'bg-zinc-100'} rounded-lg p-3`}>
                {message.content}
                
                {message.actionCard && (
                  <ActionCardComponent
                    card={message.actionCard}
                    onConfirm={() => handleConfirmAction(message)}
                    language={language}
                    onNavigate={onNavigate}
                  />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t.placeholder}
            className="flex-1"
          />
          <Button
            variant={isListening ? 'default' : 'outline'}
            size="sm"
            onClick={handleVoiceInput}
            disabled={isListening}
          >
            <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
          </Button>
          <Button size="sm" onClick={handleSend}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function ActionCardComponent({ card, onConfirm, language, onNavigate }: { card: ActionCard; onConfirm: () => void; language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa'; onNavigate: (view: string) => void }) {
  const translations = {
    en: {
      confirm: 'Confirm',
      edit: 'Edit',
      material: 'Material',
      qty: 'Qty/Unit',
      unit: 'Unit',
      scrap: 'Scrap',
      action: 'Action',
      count: 'Count',
      from: 'From',
      to: 'To',
      available: 'Available',
      allocated: 'Allocated',
      free: 'Free',
      location: 'Location',
      required: 'Required',
      shortage: 'Shortage',
      cancel: 'Cancel',
      status: 'Status'
    },
    hi: {
      confirm: 'पुष्टि करें',
      edit: 'संपादित करें',
      material: 'सामग्री',
      qty: 'मात्रा/यूनिट',
      unit: 'यूनिट',
      scrap: 'स्क्रैप',
      action: 'क्रिया',
      count: 'गिनती',
      from: 'से',
      to: 'को',
      available: 'उपलब्ध',
      allocated: 'आवंटित',
      free: 'मुक्त',
      location: 'स्थान',
      required: 'आवश्यक',
      shortage: 'कमी',
      cancel: 'रद्द करें',
      status: 'स्थिति'
    },
    kn: {
      confirm: 'ದೃಢೀಕರಿಸಿ',
      edit: 'ಸಂಪಾದಿಸಿ',
      material: 'ವಸ್ತು',
      qty: 'ಪ್ರಮಾಣ/ಘಟಕ',
      unit: 'ಘಟಕ',
      scrap: 'ಸ್ಕ್ರಾಪ್',
      action: 'ಕ್ರಿಯೆ',
      count: 'ಎಣಿಕೆ',
      from: 'ನಿಂದ',
      to: 'ಗೆ',
      available: 'ಲಭ್ಯ',
      allocated: 'ನಿಯೋಜಿತ',
      free: 'ಮುಕ್ತ',
      location: 'ಸ್ಥಳ',
      required: 'ಅಗತ್ಯವಿದೆ',
      shortage: 'ಕೊರತೆ',
      cancel: 'ರದ್ದುಮಾಡಿ',
      status: 'ಸ್ಥಿತಿ'
    },
    ta: {
      confirm: 'உறுதிப்படுத்தவும்',
      edit: 'திருத்து',
      material: 'பொருள்',
      qty: 'அளவு/அலகு',
      unit: 'அலகு',
      scrap: 'ஸ்க்ராப்',
      action: 'செயல்',
      count: 'எண்ணிக்கை',
      from: 'இருந்து',
      to: 'செல்',
      available: 'கிடைக்கும்',
      allocated: 'ஒதுக்கப்பட்டது',
      free: 'இலவசம்',
      location: 'இடம்',
      required: 'தேவை',
      shortage: 'பற்றாக்குறை',
      cancel: 'ரத்துசெய்',
      status: 'நிலை'
    },
    te: {
      confirm: 'నిర్ధారించండి',
      edit: 'సవరించు',
      material: 'పదార్థం',
      qty: 'పరిమాణం/యూనిట్',
      unit: 'యూనిట్',
      scrap: 'స్క్రాప్',
      action: 'చర్య',
      count: 'లెక్క',
      from: 'నుండి',
      to: 'కు',
      available: 'అందుబాటులో',
      allocated: 'కేటాయించబడింది',
      free: 'ఉచిత',
      location: 'స్థానం',
      required: 'అవసరం',
      shortage: 'కొరత',
      cancel: 'రద్దు చేయండి',
      status: 'స్థితి'
    },
    mr: {
      confirm: 'पुष्टी करा',
      edit: 'संपादित करा',
      material: 'साहित्य',
      qty: 'प्रमाण/युनिट',
      unit: 'युनिट',
      scrap: 'स्क्रॅप',
      action: 'क्रिया',
      count: 'गणना',
      from: 'पासून',
      to: 'ला',
      available: 'उपलब्ध',
      allocated: 'वाटप केले',
      free: 'मोकळे',
      location: 'स्थान',
      required: 'आवश्यक',
      shortage: 'कमतरता',
      cancel: 'रद्द करा',
      status: 'स्थिती'
    },
    gu: {
      confirm: 'પુષ્ટિ કરો',
      edit: 'સંપાદિત કરો',
      material: 'સામગ્રી',
      qty: 'જથ્થો/એકમ',
      unit: 'એકમ',
      scrap: 'સ્ક્રેપ',
      action: 'ક્રિયા',
      count: 'ગણતરી',
      from: 'થી',
      to: 'ને',
      available: 'ઉપલબ્ધ',
      allocated: 'ફાળવેલ',
      free: 'મફત',
      location: 'સ્થાન',
      required: 'જરૂરી',
      shortage: 'ઉણપ',
      cancel: 'રદ કરો',
      status: 'સ્થિતિ'
    },
    pa: {
      confirm: 'ਪੁਸ਼ਟੀ ਕਰੋ',
      edit: 'ਸੰਪਾਦਿਤ ਕਰੋ',
      material: 'ਸਮੱਗਰੀ',
      qty: 'ਮਾਤਰਾ/ਯੂਨਿਟ',
      unit: 'ਯੂਨਿਟ',
      scrap: 'ਸਕ੍ਰੈਪ',
      action: 'ਕਾਰਵਾਈ',
      count: 'ਗਿਣਤੀ',
      from: 'ਤੋਂ',
      to: 'ਨੂੰ',
      available: 'ਉਪਲਬਧ',
      allocated: 'ਅਲਾਟ ਕੀਤਾ',
      free: 'ਮੁਫ਼ਤ',
      location: 'ਸਥਾਨ',
      required: 'ਲੋੜੀਂਦਾ',
      shortage: 'ਕਮੀ',
      cancel: 'ਰੱਦ ਕਰੋ',
      status: 'ਸਥਿਤੀ'
    }
  };

  const t = translations[language];

  if (card.type === 'bom') {
    return (
      <Card className="mt-3 p-3 bg-white text-zinc-900">
        <div className="mb-2">BOM Draft: {card.data.product}</div>
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="text-left p-2">{t.material}</th>
                <th className="text-left p-2">{t.qty}</th>
                <th className="text-left p-2">{t.unit}</th>
                <th className="text-left p-2">{t.scrap}</th>
              </tr>
            </thead>
            <tbody>
              {card.data.materials.map((mat: any, idx: number) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">{mat.name}</td>
                  <td className="p-2">{mat.qty}</td>
                  <td className="p-2">{mat.unit}</td>
                  <td className="p-2">{mat.scrap}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={onConfirm} className="flex-1">
            {t.confirm}
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            {t.edit}
          </Button>
        </div>
      </Card>
    );
  }

  if (card.type === 'transfer') {
    return (
      <Card className="mt-3 p-3 bg-white text-zinc-900">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-600">{t.action}:</span>
            <span>Transfer WorkUnits</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">{t.count}:</span>
            <span>{card.data.quantity} {card.data.unit}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">{t.from}:</span>
            <span>{card.data.from}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">{t.to}:</span>
            <span>{card.data.to}</span>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={onConfirm} className="flex-1">
            {t.confirm}
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            {t.cancel}
          </Button>
        </div>
      </Card>
    );
  }

  if (card.type === 'stock') {
    return (
      <Card className="mt-3 p-3 bg-white text-zinc-900">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-600">{t.available}:</span>
            <span>{card.data.available}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">{t.allocated}:</span>
            <span>{card.data.allocated}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">{t.free}:</span>
            <span className="text-emerald-600">{card.data.free}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">{t.location}:</span>
            <span>{card.data.location}</span>
          </div>
        </div>
      </Card>
    );
  }

  if (card.type === 'shortage') {
    return (
      <Card className="mt-3 p-3 bg-white text-zinc-900">
        <div className="space-y-2">
          {card.data.items.map((item: any, idx: number) => (
            <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded">
              <div>{item.material}</div>
              <div className="flex justify-between text-sm mt-1">
                <span>{t.required}: {item.required}</span>
                <span>{t.available}: {item.available}</span>
                <span className="text-red-600">{t.shortage}: {item.shortage}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (card.type === 'material_request') {
    return (
      <Card className="mt-3 p-3 bg-white text-zinc-900">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-600">{t.material}:</span>
            <span>{card.data.material}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">{t.count}:</span>
            <span>{card.data.quantity} {card.data.unit}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">{t.status}:</span>
            <span className="text-emerald-600">{card.data.status || 'Pending'}</span>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={onConfirm} className="flex-1">
            {t.confirm}
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            {t.cancel}
          </Button>
        </div>
      </Card>
    );
  }

  if (card.type === 'navigation') {
    return (
      <Card className="mt-3 p-3 bg-white text-zinc-900">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-600">{t.action}:</span>
            <span>{card.data.text}</span>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={() => onNavigate(card.data.view)} className="flex-1">
            {t.confirm}
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            {t.cancel}
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}