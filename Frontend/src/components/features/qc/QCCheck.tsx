import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Camera } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type QCCheckProps = {
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

export function QCCheck({ language }: QCCheckProps) {
  const [selectedResult, setSelectedResult] = useState<'pass' | 'rework' | 'scrap' | null>(null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);

  const translations = {
    en: {
      title: 'QC Check',
      orderNumber: 'Order Number',
      product: 'Product',
      quantity: 'Quantity to Check',
      inspectionResult: 'Inspection Result',
      pass: 'Pass',
      rework: 'Rework',
      scrap: 'Scrap',
      selectReason: 'Select Reason',
      reasonsForRework: 'Reasons for Rework',
      reasonsForScrap: 'Reasons for Scrap',
      addPhoto: 'Add Photo',
      notes: 'Notes',
      submit: 'Submit QC',
      recentInspections: 'Recent Inspections',
      units: 'units',
      passed: 'Passed',
      failed: 'Failed',
      chatbotSuggestion: 'Ask chatbot for common defects'
    },
    hi: {
      title: 'QC जांच',
      orderNumber: 'ऑर्डर नंबर',
      product: 'उत्पाद',
      quantity: 'जांच के लिए मात्रा',
      inspectionResult: 'निरीक्षण परिणाम',
      pass: 'पास',
      rework: 'रीवर्क',
      scrap: 'स्क्रैप',
      selectReason: 'कारण चुनें',
      reasonsForRework: 'रीवर्क के कारण',
      reasonsForScrap: 'स्क्रैप के कारण',
      addPhoto: 'फोटो जोड़ें',
      notes: 'नोट्स',
      submit: 'QC सबमिट करें',
      recentInspections: 'हाल के निरीक्षण',
      units: 'यूनिट',
      passed: 'पास',
      failed: 'विफल',
      chatbotSuggestion: 'सामान्य दोषों के लिए चैटबॉट से पूछें'
    },
    kn: {
      title: 'QC ಪರಿಶೋಧನೆ',
      orderNumber: 'ಆರ್ಡರ್ ನಂಬರ್',
      product: 'ಉತ್ಪಾದ',
      quantity: 'ಪರಿಶೋಧನೆ ಮಾತ್ರೆ',
      inspectionResult: 'ಪರಿಶೋಧನೆ ಫಲಿತ',
      pass: 'ಪಾಸ್',
      rework: 'ರಿವರ್ಕ್',
      scrap: 'ಸ್ಕ್ರಾಪ್',
      selectReason: 'ಕಾರಣ ಆಯ್ಕೆಮಾಡಿ',
      reasonsForRework: 'ರಿವರ್ಕ್ ಕಾರಣಗಳು',
      reasonsForScrap: 'ಸ್ಕ್ರಾಪ್ ಕಾರಣಗಳು',
      addPhoto: 'ಫೋಟೋ ಸೇರಿಸಿ',
      notes: 'ಸೂಚನೆಗಳು',
      submit: 'QC ಸಲ್ಯಾಬ್ಮಿಟ್',
      recentInspections: 'ಕ್ರಿಯಾಂತರ ಪರಿಶೋಧನೆಗಳು',
      units: 'ಯೂನಿಟ್ಸ್',
      passed: 'ಪಾಸ್',
      failed: 'ವಿಫಲ',
      chatbotSuggestion: 'ಸಾಮಾನ್ಯ ದೋಷಗಳ ಬಗ್ಗೆ ಚಾಟ್‌बೋಟ್‌ನಿಂದ ಪ್ರಶ್ನೆ ಕೊಡಿ'
    },
    ta: {
      title: 'QC சரிபார்க்கு',
      orderNumber: 'ஆர்டர் எண்',
      product: 'பொருத்தம்',
      quantity: 'சரிபார்க்க அளவு',
      inspectionResult: 'சரிபார்க்கு விளைவு',
      pass: 'சரியான',
      rework: 'மீட்சம்',
      scrap: 'விடுத்து துவக்கு',
      selectReason: 'காரணம் தெரியற்று',
      reasonsForRework: 'மீட்சம் காரணங்கள்',
      reasonsForScrap: 'விடுத்து துவக்கு காரணங்கள்',
      addPhoto: 'புகைபடம் சேர்க்க',
      notes: 'குறிப்புகள்',
      submit: 'QC சமர்ப்பிக்க',
      recentInspections: 'அண்மைய சரிபார்க்குகள்',
      units: 'அலவுகள்',
      passed: 'சரியான',
      failed: 'வி஫ல',
      chatbotSuggestion: 'அடிப்படையான பிழைகளுக்கு சாட்டு போட்டியில் கேட்டு'
    },
    te: {
      title: 'QC పరిశోధన',
      orderNumber: 'ఆర్డర్ నంబర్',
      product: 'ఉత్పాదం',
      quantity: 'పరిశోధన పరిమాణం',
      inspectionResult: 'పరిశోధన ఫలితం',
      pass: 'పాస్',
      rework: 'రీవర్క్',
      scrap: 'స్క్రాప్',
      selectReason: 'కారణాన్ని ఎంచుకో',
      reasonsForRework: 'రీవర్క్ కారణాలు',
      reasonsForScrap: 'స్క్రాప్ కారణాలు',
      addPhoto: 'ఫోటో జోడించు',
      notes: 'ముఖ్యము',
      submit: 'QC సమర్పణించు',
      recentInspections: 'ప్రయోజనాత్మక పరిశోధనలు',
      units: 'యూనిట్స్',
      passed: 'పాస్',
      failed: 'ప్రతిఫలితం',
      chatbotSuggestion: 'సామాన్య దోషాల కోసం చాట్‌బోట్‌ను ప్రశ్నించండి'
    },
    mr: {
      title: 'QC जांच',
      orderNumber: 'ऑर्डर नंबर',
      product: 'उत्पादन',
      quantity: 'जांच करण्यासाठी मात्रा',
      inspectionResult: 'निरीक्षण परिणाम',
      pass: 'पास',
      rework: 'रीवर्क',
      scrap: 'स्क्रैप',
      selectReason: 'कारण चुना',
      reasonsForRework: 'रीवर्क कारण',
      reasonsForScrap: 'स्क्रैप कारण',
      addPhoto: 'फोटो जोडा',
      notes: 'नोट्स',
      submit: 'QC सबमिट करा',
      recentInspections: 'हाल के निरीक्षण',
      units: 'यूनिट',
      passed: 'पास',
      failed: 'विफल',
      chatbotSuggestion: 'सामान्य दोषों के लिए चैटबॉट से पूछा'
    },
    gu: {
      title: 'QC પરિશોધન',
      orderNumber: 'ઑર્ડર નંબર',
      product: 'ઉત્પાદન',
      quantity: 'પરિશોધન માત્રા',
      inspectionResult: 'પરિશોધન ફળિત',
      pass: 'પાસ',
      rework: 'રીવર્ક',
      scrap: 'સ્ક્રાપ',
      selectReason: 'કારણ પસંદ કરો',
      reasonsForRework: 'રીવર્ક કારણો',
      reasonsForScrap: 'સ્ક્રાપ કારણો',
      addPhoto: 'ફોટો જોડો',
      notes: 'નોટ્સ',
      submit: 'QC સબમિટ કરો',
      recentInspections: 'હાલ પરિશોધનો',
      units: 'યૂનિટ્સ',
      passed: 'પાસ',
      failed: 'નિરાકરણ',
      chatbotSuggestion: 'સામાન્ય દોષોનો લિએ ચૈટબોટથી પ્રશ્ન કરો'
    },
    pa: {
      title: 'QC ਪ੍ਰਦਰਸ਼ਨ',
      orderNumber: 'ਆਰਡਰ ਨੰਬਰ',
      product: 'ਉਤਪਾਦਨ',
      quantity: 'ਪ੍ਰਦਰਸ਼ਨ ਮਾਤਰਾ',
      inspectionResult: 'ਪ੍ਰਦਰਸ਼ਨ ਫਲਿਟ',
      pass: 'ਪਾਸ',
      rework: 'ਰੀਵਰਕ',
      scrap: 'ਸਕ੍ਰੈਪ',
      selectReason: 'ਕਾਰਨ ਚੁਣੋ',
      reasonsForRework: 'ਰੀਵਰਕ ਕਾਰਨ',
      reasonsForScrap: 'ਸਕ੍ਰੈਪ ਕਾਰਨ',
      addPhoto: 'ਫੋਟੋ ਜੋੜੋ',
      notes: 'ਨੋਟਸ',
      submit: 'QC ਸਬਮਿਟ ਕਰੋ',
      recentInspections: 'ਹੌਲ ਪ੍ਰਦਰਸ਼ਨ',
      units: 'ਯੂਨਿਟ',
      passed: 'ਪਾਸ',
      failed: 'ਨਿਰਾਕਰਣ',
      chatbotSuggestion: 'ਸਾਮਾਨਿਆਤਮਕ ਦੋਸ਼ਾਂ ਲਈ ਚੈਟਬੋਟ ਤੋਂ ਪ੍ਰਸ਼ਨ ਕਰੋ'
    }
  };

  const t = translations[language];

  const reworkReasons = [
    language === 'en' ? 'Dimensional error' : 'आयामी त्रुटि',
    language === 'en' ? 'Surface defect' : 'सतह दोष',
    language === 'en' ? 'Assembly issue' : 'असेंबली समस्या',
    language === 'en' ? 'Paint defect' : 'पेंट दोष',
    language === 'en' ? 'Missing component' : 'घटक गायब'
  ];

  const scrapReasons = [
    language === 'en' ? 'Material crack' : 'सामग्री में दरार',
    language === 'en' ? 'Beyond repair' : 'मरम्मत से परे',
    language === 'en' ? 'Critical defect' : 'गंभीर दोष',
    language === 'en' ? 'Wrong material' : 'गलत सामग्री'
  ];

  const recentInspections = [
    {
      id: 1,
      order: 'PO-101',
      product: 'Widget A',
      checked: 50,
      passed: 45,
      rework: 5,
      scrap: 0,
      time: '2 hours ago'
    },
    {
      id: 2,
      order: 'PO-102',
      product: 'Gear B',
      checked: 30,
      passed: 28,
      rework: 1,
      scrap: 1,
      time: '4 hours ago'
    }
  ];

  const toggleReason = (reason: string) => {
    if (selectedReasons.includes(reason)) {
      setSelectedReasons(selectedReasons.filter((r) => r !== reason));
    } else {
      setSelectedReasons([...selectedReasons, reason]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1>{t.title}</h1>
      </div>

      {/* QC Form */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-sm text-zinc-600">{t.orderNumber}</label>
            <Input placeholder="PO-XXX" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm text-zinc-600">{t.product}</label>
              <select className="w-full h-10 px-3 border border-zinc-200 rounded-lg bg-white">
                <option>Widget A</option>
                <option>Gear B</option>
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm text-zinc-600">{t.quantity}</label>
              <Input type="number" placeholder="0" />
            </div>
          </div>

          {/* Inspection Result */}
          <div>
            <label className="block mb-3 text-sm text-zinc-600">{t.inspectionResult}</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedResult('pass')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedResult === 'pass'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <CheckCircle
                  className={`h-8 w-8 mx-auto mb-2 ${
                    selectedResult === 'pass' ? 'text-emerald-600' : 'text-zinc-400'
                  }`}
                />
                <div className="text-center">{t.pass}</div>
              </button>
              <button
                onClick={() => setSelectedResult('rework')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedResult === 'rework'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <AlertCircle
                  className={`h-8 w-8 mx-auto mb-2 ${
                    selectedResult === 'rework' ? 'text-yellow-600' : 'text-zinc-400'
                  }`}
                />
                <div className="text-center">{t.rework}</div>
              </button>
              <button
                onClick={() => setSelectedResult('scrap')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedResult === 'scrap'
                    ? 'border-red-500 bg-red-50'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <XCircle
                  className={`h-8 w-8 mx-auto mb-2 ${
                    selectedResult === 'scrap' ? 'text-red-600' : 'text-zinc-400'
                  }`}
                />
                <div className="text-center">{t.scrap}</div>
              </button>
            </div>
          </div>

          {/* Reason Selection for Rework */}
          {selectedResult === 'rework' && (
            <div>
              <label className="block mb-3 text-sm text-zinc-600">{t.reasonsForRework}</label>
              <div className="flex flex-wrap gap-2">
                {reworkReasons.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => toggleReason(reason)}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      selectedReasons.includes(reason)
                        ? 'bg-yellow-500 text-white border-yellow-600'
                        : 'bg-white border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reason Selection for Scrap */}
          {selectedResult === 'scrap' && (
            <div>
              <label className="block mb-3 text-sm text-zinc-600">{t.reasonsForScrap}</label>
              <div className="flex flex-wrap gap-2">
                {scrapReasons.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => toggleReason(reason)}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      selectedReasons.includes(reason)
                        ? 'bg-red-500 text-white border-red-600'
                        : 'bg-white border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Photo Upload */}
          {(selectedResult === 'rework' || selectedResult === 'scrap') && (
            <div>
              <Button variant="outline" className="w-full sm:w-auto">
                <Camera className="h-4 w-4 mr-2" />
                {t.addPhoto}
              </Button>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block mb-2 text-sm text-zinc-600">{t.notes}</label>
            <textarea
              className="w-full min-h-[100px] px-3 py-2 border border-zinc-200 rounded-lg resize-none"
              placeholder={language === 'en' ? 'Add additional notes...' : 'अतिरिक्त नोट्स जोड़ें...'}
            />
          </div>

          <Button className="w-full" disabled={!selectedResult}>
            {t.submit}
          </Button>
        </div>
      </Card>

      {/* Chatbot Suggestion */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-3 text-blue-900">
          <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm">
            AI
          </div>
          <span className="text-sm">{t.chatbotSuggestion}</span>
        </div>
      </Card>

      {/* Recent Inspections */}
      <Card className="p-6">
        <h3 className="mb-4">{t.recentInspections}</h3>
        <div className="space-y-3">
          {recentInspections.map((inspection) => (
            <div key={inspection.id} className="p-4 bg-zinc-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="mr-2">{inspection.order}</span>
                  <span className="text-zinc-600">- {inspection.product}</span>
                </div>
                <span className="text-sm text-zinc-500">{inspection.time}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="text-center p-2 bg-white rounded">
                  <div className="text-zinc-600">{language === 'en' ? 'Checked' : 'जांचे गए'}</div>
                  <div>{inspection.checked}</div>
                </div>
                <div className="text-center p-2 bg-emerald-50 rounded">
                  <div className="text-emerald-700">{t.passed}</div>
                  <div className="text-emerald-900">{inspection.passed}</div>
                </div>
                <div className="text-center p-2 bg-yellow-50 rounded">
                  <div className="text-yellow-700">{t.rework}</div>
                  <div className="text-yellow-900">{inspection.rework}</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                  <div className="text-red-700">{t.scrap}</div>
                  <div className="text-red-900">{inspection.scrap}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}