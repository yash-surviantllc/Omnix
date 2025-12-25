import { ArrowRight, AlertTriangle, CheckCircle, Clock, Package, TrendingUp, AlertCircle, BarChart3, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { wipApi, WIPStageMetrics } from '@/lib/api/wip';
import { StageHistoryChart } from './StageHistoryChart';

type WIPBoardProps = {
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

export function WIPBoard({ language }: WIPBoardProps) {
  const [stages, setStages] = useState<WIPStageMetrics[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalUnits, setTotalUnits] = useState(0);
  const [avgCycleTime, setAvgCycleTime] = useState(0);
  const [bottleneckStage, setBottleneckStage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [showChartModal, setShowChartModal] = useState(false);

  useEffect(() => {
    fetchWIPDashboard();
    
    // Auto-refresh every 3 seconds for near real-time updates
    const interval = setInterval(fetchWIPDashboard, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchWIPDashboard = async () => {
    try {
      setError(null);
      const data = await wipApi.getDashboard();
      setStages(data.stages);
      setTotalOrders(data.total_orders);
      setTotalUnits(data.total_units);
      setAvgCycleTime(data.avg_cycle_time);
      setBottleneckStage(data.bottleneck_stage);
    } catch (err: any) {
      console.error('Error fetching WIP dashboard:', err);
      setError(err?.detail || err?.message || 'Failed to load WIP data');
    } finally {
      setIsLoading(false);
    }
  };

  const translations = {
    en: {
      title: 'WIP Live Board',
      stage: 'Stage',
      orders: 'Orders',
      units: 'Units',
      health: 'Health',
      avgTime: 'Avg Time',
      targetAvgTime: 'Target Avg Time',
      bottleneck: 'Bottleneck',
      healthy: 'Healthy',
      delayed: 'Delayed',
      warning: 'Warning',
      askBot: 'Ask bot why?',
      stageHealth: 'Stage Health Indicators',
      min: 'min',
      utilization: 'Utilization',
      viewTrend: 'View Trend',
      close: 'Close'
    },
    hi: {
      title: 'WIP लाइव बोर्ड',
      stage: 'स्टेज',
      orders: 'ऑर्डर',
      units: 'यूनिट',
      health: 'स्वास्थ्य',
      avgTime: 'औसत समय',
      targetAvgTime: 'लक्ष्य औसत समय',
      bottleneck: 'बाधा',
      healthy: 'स्वस्थ',
      delayed: 'विलंबित',
      warning: 'चेतावनी',
      askBot: 'बॉट से पूछें क्यों?',
      stageHealth: 'स्टेज स्वास्थ्य संकेतक',
      min: 'मिनट',
      utilization: 'उपयोग'
    },
    kn: {
      title: 'WIP ಲೈವ್ ಬೋರ್ಡ್',
      stage: 'ಸ್ಟೇಜ್',
      orders: 'ಆರ್ಡರ್ಸ್',
      units: 'ಯೂನಿಟ್ಸ್',
      health: 'ಸ್ವಾಸ್ಥ್ಯ',
      avgTime: 'ಸರಾಸರಿ ಸಮಯ',
      targetAvgTime: 'ಗುರಿ ಸರಾಸರಿ ಸಮಯ',
      bottleneck: 'ಅಡಚಣೆ',
      healthy: 'ಆರೋಗ್ಯಕರ',
      delayed: 'ವಿಳಂಬ',
      warning: 'ಎಚ್ಚರಿಕೆ',
      askBot: 'ಬೋಟ್ ಅನ್ನು ಏಕೆ ಕೇಳಿ?',
      stageHealth: 'ಸ್ಟೇಜ್ ಸ್ವಾಸ್ಥ್ಯ ಸೂಚಕಗಳು',
      min: 'ನಿಮಿಷ',
      utilization: 'ಬಳಕೆ'
    },
    ta: {
      title: 'WIP நேரடி பலகை',
      stage: 'நிலை',
      orders: 'ஆர்டர்கள்',
      units: 'அலகுகள்',
      health: 'ஆரோக்கியம்',
      avgTime: 'சராசரி நேரம்',
      targetAvgTime: 'இலக்கு சராசரி நேரம்',
      bottleneck: 'தடை',
      healthy: 'ஆரோக்கியமான',
      delayed: 'தாமதமானது',
      warning: 'எச்சரிக்கை',
      askBot: 'போட் ஏன் என்று கேளுங்கள்?',
      stageHealth: 'நிலை ஆரோக்கிய குறிகாட்டிகள்',
      min: 'நிமிடம்',
      utilization: 'பயன்பாடு'
    },
    te: {
      title: 'WIP లైవ్ బోర్డ్',
      stage: 'దశ',
      orders: 'ఆర్డర్లు',
      units: 'యూనిట్లు',
      health: 'ఆరోగ్యం',
      avgTime: 'సగటు సమయం',
      targetAvgTime: 'లక్ష్య సగటు సమయం',
      bottleneck: 'అడ్డంకి',
      healthy: 'ఆరోగ్యకరమైన',
      delayed: 'ఆలస్యం',
      warning: 'హెచ్చరిక',
      askBot: 'బాట్‌ను ఎందుకు అని అడగండి?',
      stageHealth: 'దశ ఆరోగ్య సూచికలు',
      min: 'నిమిషం',
      utilization: 'వినియోగం'
    },
    mr: {
      title: 'WIP लाइव्ह बोर्ड',
      stage: 'स्टेज',
      orders: 'ऑर्डर्स',
      units: 'युनिट्स',
      health: 'आरोग्य',
      avgTime: 'सरासरी वेळ',
      targetAvgTime: 'लक्ष्य सरासरी वेळ',
      bottleneck: 'अडथळा',
      healthy: 'आरोग्यपूर्ण',
      delayed: 'विलंबित',
      warning: 'चेतावणी',
      askBot: 'बॉट ला का विचारा?',
      stageHealth: 'स्टेज आरोग्य संकेतक',
      min: 'मिनिट',
      utilization: 'वापर'
    },
    gu: {
      title: 'WIP લાઇવ બોર્ડ',
      stage: 'સ્ટેજ',
      orders: 'ઓર્ડર્સ',
      units: 'યુનિટ્સ',
      health: 'આરોગ્ય',
      avgTime: 'સરેરાશ સમય',
      targetAvgTime: 'લક્ષ્ય સરેરાશ સમય',
      bottleneck: 'અવરોધ',
      healthy: 'સ્વસ્થ',
      delayed: 'વિલંબિત',
      warning: 'ચેતવણી',
      askBot: 'બોટને શા માટે પૂછો?',
      stageHealth: 'સ્ટેજ આરોગ્ય સૂચક',
      min: 'મિનિટ',
      utilization: 'ઉપયોગ'
    },
    pa: {
      title: 'WIP ਲਾਈਵ ਬੋਰਡ',
      stage: 'ਪੜਾਅ',
      orders: 'ਆਰਡਰ',
      units: 'ਯੂਨਿਟਾਂ',
      health: 'ਸਿਹਤ',
      avgTime: 'ਔਸਤ ਸਮਾਂ',
      targetAvgTime: 'ਟੀਚਾ ਔਸਤ ਸਮਾਂ',
      bottleneck: 'ਰੁਕਾਵਟ',
      healthy: 'ਸਿਹਤਮੰਦ',
      delayed: 'ਦੇਰੀ ਨਾਲ',
      warning: 'ਚੇਤਾਵਨੀ',
      askBot: 'ਬੋਟ ਨੂੰ ਕਿਉਂ ਪੁੱਛੋ?',
      stageHealth: 'ਪੜਾਅ ਸਿਹਤ ਸੂਚਕ',
      min: 'ਮਿੰਟ',
      utilization: 'ਵਰਤੋਂ'
    }
  };

  const t = translations[language];

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge className="bg-emerald-500">{t.healthy}</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">{t.warning}</Badge>;
      case 'delayed':
        return <Badge className="bg-red-500">{t.delayed}</Badge>;
      default:
        return <Badge>{health}</Badge>;
    }
  };

  const bottleneckStageData = stages.find((s) => s.health === 'delayed');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1>{t.title}</h1>
        <Card className="p-8 text-center">
          <p className="text-zinc-500">{language === 'en' ? 'Loading WIP data...' : 'WIP डेटा लोड हो रहा है...'}</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1>{t.title}</h1>
        <Card className="p-8 text-center">
          <p className="text-red-500">{error}</p>
          <button 
            onClick={fetchWIPDashboard}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {language === 'en' ? 'Retry' : 'पुनः प्रयास करें'}
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>{t.title}</h1>
      </div>

      {/* Bottleneck Alert */}
      {bottleneckStageData && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-red-900 mb-1">
                {language === 'en' ? 'Bottleneck Alert' : 'बाधा चेतावनी'}
              </h3>
              <p className="text-red-700 text-sm mb-2">
                {language === 'en'
                  ? `${bottleneckStageData.name} is delayed - ${bottleneckStageData.utilization}% capacity utilization`
                  : `${bottleneckStageData.name} विलंबित है - ${bottleneckStageData.utilization}% क्षमता उपयोग`}
              </p>
              <button className="text-sm text-red-900 underline">{t.askBot}</button>
            </div>
          </div>
        </Card>
      )}

      {/* Stage Cards - Mobile View */}
      <div className="lg:hidden space-y-3">
        {stages.map((stage) => (
          <Card key={stage.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="mb-1">{stage.name}</h3>
                {getHealthBadge(stage.health)}
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-600">{t.utilization}</div>
                <div className="text-lg">{stage.utilization}%</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-zinc-50 rounded-lg">
                <div className="text-zinc-600 mb-1">{t.orders}</div>
                <div>{stage.orders}</div>
              </div>
              <div className="p-3 bg-zinc-50 rounded-lg">
                <div className="text-zinc-600 mb-1">{t.units}</div>
                <div>{stage.units}</div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">{t.avgTime}</span>
                <span>{Math.round(stage.avgTime)} {t.min}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">{t.targetAvgTime}</span>
                <span className="text-emerald-600">{Math.round(stage.targetAvgTime)} {t.min}</span>
              </div>
              <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    stage.health === 'delayed'
                      ? 'bg-red-500'
                      : stage.health === 'warning'
                      ? 'bg-yellow-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${stage.utilization}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedStage(stage.name);
                setShowChartModal(true);
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              {t.viewTrend}
            </button>
          </Card>
        ))}
      </div>

      {/* Stage Table - Desktop View */}
      <Card className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="text-left p-4">{t.stage}</th>
                <th className="text-left p-4">{t.orders}</th>
                <th className="text-left p-4">{t.units}</th>
                <th className="text-left p-4">{t.avgTime}</th>
                <th className="text-left p-4">{t.targetAvgTime}</th>
                <th className="text-left p-4">{t.utilization}</th>
                <th className="text-left p-4">{t.health}</th>
                <th className="text-left p-4">{language === 'en' ? 'Actions' : 'कार्रवाई'}</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => (
                <tr key={stage.id} className="border-b hover:bg-zinc-50">
                  <td className="p-4">{stage.name}</td>
                  <td className="p-4">{stage.orders}</td>
                  <td className="p-4">{stage.units}</td>
                  <td className="p-4">{Math.round(stage.avgTime)} {t.min}</td>
                  <td className="p-4">
                    <span className="text-emerald-600">{Math.round(stage.targetAvgTime)} {t.min}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden max-w-[100px]">
                        <div
                          className={`h-full transition-all ${
                            stage.health === 'delayed'
                              ? 'bg-red-500'
                              : stage.health === 'warning'
                              ? 'bg-yellow-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${stage.utilization}%` }}
                        />
                      </div>
                      <span className="text-sm text-zinc-600 min-w-[3rem]">{stage.utilization}%</span>
                    </div>
                  </td>
                  <td className="p-4">{getHealthBadge(stage.health)}</td>
                  <td className="p-4">
                    <button
                      onClick={() => {
                        setSelectedStage(stage.name);
                        setShowChartModal(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <BarChart3 className="h-4 w-4" />
                      {t.viewTrend}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500 text-white flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-zinc-600">{language === 'en' ? 'Total Orders' : 'कुल ऑर्डर'}</p>
              <h3>{totalOrders}</h3>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-zinc-600">{language === 'en' ? 'Total Units' : 'कुल यूनिट'}</p>
              <h3>{totalUnits}</h3>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-500 text-white flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-zinc-600">{language === 'en' ? 'Avg Cycle Time' : 'औसत चक्र समय'}</p>
              <h3>{Math.round(avgCycleTime)} {t.min}</h3>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500 text-white flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-zinc-600">{t.bottleneck}</p>
              <h3 className="text-sm">{bottleneckStage || (language === 'en' ? 'None' : 'कोई नहीं')}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Trend Chart Modal */}
      {showChartModal && selectedStage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{selectedStage} - {t.viewTrend}</h2>
              <button
                onClick={() => {
                  setShowChartModal(false);
                  setSelectedStage(null);
                }}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <StageHistoryChart stageName={selectedStage} days={7} language={language} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
