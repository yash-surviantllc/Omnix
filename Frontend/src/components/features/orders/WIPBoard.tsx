import { Clock, Package, TrendingUp, AlertCircle, BarChart3, X, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEffect, useMemo, useState } from 'react';
import {
  wipApi,
  WIPAlertResponse,
  WIPBoardResponse,
  WIPBoardStageMetrics,
} from '@/lib/api/wip';
import { stagesApi, Stage } from '@/lib/api/stages';
import { wipBoardWebsocket, WIPBoardEvent } from '@/lib/websocket/wipBoard';
import { StageHistoryChart } from './StageHistoryChart';

type WIPBoardProps = {
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

export function WIPBoard({ language }: WIPBoardProps) {
  const [board, setBoard] = useState<WIPBoardResponse | null>(null);
  const [stages, setStages] = useState<WIPBoardStageMetrics[]>([]);
  const [alerts, setAlerts] = useState<WIPAlertResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);

  // Quick Lookup State
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [assignmentRules, setAssignmentRules] = useState<{ sku_assignments: any; wo_assignments: any } | null>(null);
  const [configStagesMap, setConfigStagesMap] = useState<Record<string, Stage[]>>({});

  // Toggle expansion
  const toggleStage = (stageId: string) => {
    setExpandedStageId(prev => (prev === stageId ? null : stageId));
  };

  const handleQuickLookup = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await wipApi.listWorkingOrders({ search: searchQuery });
      setLookupResult(results);
    } catch (err) {
      console.error('Lookup failed', err);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchAssignmentsAndStages = async () => {
    try {
      const [rules, defaultStages, config2Stages, config3Stages] = await Promise.all([
        stagesApi.getAssignmentRules(),
        stagesApi.listStages(true, 'default'),
        stagesApi.listStages(true, 'config_2'),
        stagesApi.listStages(true, 'config_3'),
      ]);
      setAssignmentRules(rules);
      setConfigStagesMap({
        'default': defaultStages,
        'config_2': config2Stages,
        'config_3': config3Stages,
      });
    } catch (err) {
      console.error('Error fetching configuration knowledge', err);
    }
  };

  const resolveDisplayStage = (wo: any) => {
    if (!assignmentRules) return wo.operation;

    const configId = wo.config_id ||
      assignmentRules.wo_assignments[wo.work_order_number] ||
      assignmentRules.sku_assignments[wo.product_code] ||
      'default';

    const configStages = configStagesMap[configId];
    if (!configStages || configStages.length === 0) return wo.operation;

    // Resolve matching stage
    const matchingStage = configStages.find(s => s.code === wo.operation || s.name === wo.operation);
    if (matchingStage) return matchingStage.name;

    // Fallback for "Planned" orders that might have a stale operation in DB
    if (wo.status === 'Planned') return configStages[0].name;

    return wo.operation;
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initialize = async () => {
      await Promise.all([
        refreshBoardAndAlerts(),
        fetchAssignmentsAndStages()
      ]);
      wipBoardWebsocket.connect();
      unsubscribe = wipBoardWebsocket.subscribe(handleWebsocketEvent);
    };

    initialize();

    return () => {
      unsubscribe?.();
      wipBoardWebsocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshBoardAndAlerts = async () => {
    try {
      setError(null);
      const [snapshot, alertData] = await Promise.all([
        wipApi.getWIPBoard(),
        wipApi.listWIPAlerts(),
      ]);
      setBoard(snapshot);
      setStages(snapshot.stages);
      setAlerts(alertData);
    } catch (err: any) {
      console.error('Error fetching WIP board data:', err);
      setError(err?.detail || err?.message || 'Failed to load WIP data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebsocketEvent = (event: WIPBoardEvent) => {
    if (event.event_type === 'stage_update') {
      setStages((prev) => {
        const next = updateStageMetrics(prev, event.data);
        setBoard((current) => (current ? recomputeBoard(current, next) : current));
        return next;
      });
    } else if (event.event_type === 'transfer_recorded') {
      refreshBoardAndAlerts();
    } else if (event.event_type === 'alert') {
      setAlerts((prev) => [event.data, ...prev].slice(0, 20));
    }
  };

  const updateStageMetrics = (
    current: WIPBoardStageMetrics[],
    updated: WIPBoardStageMetrics,
  ): WIPBoardStageMetrics[] => {
    const exists = current.some((stage) => stage.stage_id === updated.stage_id);
    if (!exists) {
      return [...current, updated].sort((a, b) => a.sequence_number - b.sequence_number);
    }
    return current.map((stage) =>
      stage.stage_id === updated.stage_id ? updated : stage,
    );
  };

  const recomputeBoard = (
    snapshot: WIPBoardResponse,
    updatedStages: WIPBoardStageMetrics[],
  ): WIPBoardResponse => {
    const total_orders = updatedStages.reduce((sum, stage) => sum + stage.orders_count, 0);
    const total_units = updatedStages.reduce((sum, stage) => sum + stage.units_count, 0);
    const avg_cycle_time =
      updatedStages.length > 0
        ? updatedStages.reduce((sum, stage) => sum + Number(stage.avg_time_minutes), 0) /
        updatedStages.length
        : 0;

    const bottleneckCandidates = updatedStages.filter(
      (stage) => stage.health_status !== 'Healthy',
    );

    const bottleneck_stage =
      bottleneckCandidates.length > 0
        ? bottleneckCandidates.reduce((prev, current) =>
          current.utilization_percentage > prev.utilization_percentage ? current : prev,
        ).stage_name
        : null;

    return {
      ...snapshot,
      stages: updatedStages,
      total_orders,
      total_units,
      avg_cycle_time,
      bottleneck_stage,
      last_updated: new Date().toISOString(),
    };
  };

  const calculateElapsedTime = (startDate?: string) => {
    if (!startDate) return 0;
    const start = new Date(startDate).getTime();
    const now = new Date().getTime();
    return Math.max(0, Math.round((now - start) / (1000 * 60)));
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
      close: 'Close',
      details: 'Details'
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
      utilization: 'उपयोग',
      viewTrend: 'ट्रेंड देखें',
      close: 'बंद करें',
      details: 'विवरण'
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
      utilization: 'ಬಳಕೆ',
      viewTrend: 'ಟ್ರೆಂಡ್ ನೋಡಿ',
      close: 'ಮುಚ್ಚಿ',
      details: 'ವಿವರಗಳು'
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
      utilization: 'பயன்பாடு',
      viewTrend: 'போக்கைக் காண்க',
      close: 'மூடு',
      details: 'விவரங்கள்'
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
      utilization: 'వినియోగం',
      viewTrend: 'ట్రెండ్ చూడండి',
      close: 'మూసివేయండి',
      details: 'వివరాలు'
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
      utilization: 'वापर',
      viewTrend: 'ट्रेंड पहा',
      close: 'बंद करा',
      details: 'तपशील'
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
      utilization: 'ઉપયોગ',
      viewTrend: 'ટ્રેંડ જુઓ',
      close: 'બંધ કરો',
      details: 'વિગતો'
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
      utilization: 'ਵਰਤੋਂ',
      viewTrend: 'ਟ੍ਰੈਂਡ ਦੇਖੋ',
      close: 'ਬੰਦ ਕਰੋ',
      details: 'ਵੇਰਵੇ'
    }
  };

  const t = translations[language];

  const summary = useMemo(
    () => ({
      totalOrders: board?.total_orders ?? 0,
      totalUnits: board?.total_units ?? 0,
      avgCycleTime: board?.avg_cycle_time ?? 0,
      bottleneckStage: board?.bottleneck_stage ?? null,
    }),
    [board],
  );

  const bottleneckStageData = useMemo(
    () =>
      summary.bottleneckStage
        ? stages.find((stage) => stage.stage_name === summary.bottleneckStage)
        : null,
    [summary.bottleneckStage, stages],
  );

  const recentAlerts = useMemo(() => alerts.slice(0, 5), [alerts]);

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'Healthy':
        return <Badge className="bg-emerald-500">{t.healthy}</Badge>;
      case 'Warning':
        return <Badge className="bg-yellow-500">{t.warning}</Badge>;
      case 'Delayed':
        return <Badge className="bg-red-500">{t.delayed}</Badge>;
      default:
        return <Badge>{health}</Badge>;
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

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
            onClick={refreshBoardAndAlerts}
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1>{t.title}</h1>

        {/* Quick Lookup */}
        <div className="flex gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder={language === 'en' ? 'Search PO/WO...' : 'PO/WO खोजें...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickLookup()}
              className="pl-3 pr-10 py-2 border rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleQuickLookup}
              disabled={isSearching}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-blue-500"
            >
              {isSearching ? (
                <div className="h-4 w-4 border-2 border-zinc-300 border-t-blue-500 rounded-full animate-spin" />
              ) : (
                <AlertCircle className="h-4 w-4 rotate-45 transform" /> // Search Icon improvised
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Inline Search Results (Detailed Table View) */}
      {(lookupResult.length > 0 || isSearching) && (
        <Card className="border-indigo-100 bg-white overflow-hidden shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1 rounded">
                <Search className="h-3.5 w-3.5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">
                {language === 'en' ? 'Live Order Search Results' : 'लाइव ऑर्डर खोज परिणाम'}
              </h3>
              <Badge variant="outline" className="ml-2 bg-white text-indigo-600 border-indigo-200 font-bold">
                {lookupResult.length} {language === 'en' ? 'Orders Found' : 'ऑर्डर मिले'}
              </Badge>
            </div>
            <button
              onClick={() => {
                setLookupResult([]);
                setSearchQuery('');
              }}
              className="text-indigo-400 hover:text-indigo-600 p-1 hover:bg-indigo-100 rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="text-left p-4 font-semibold text-zinc-600">{t.stage}</th>
                  <th className="text-left p-4 font-semibold text-zinc-600">{t.orders}</th>
                  <th className="text-left p-4 font-semibold text-zinc-600">{t.units}</th>
                  <th className="text-left p-4 font-semibold text-zinc-600">{t.avgTime}</th>
                  <th className="text-left p-4 font-semibold text-zinc-600">{t.targetAvgTime}</th>
                  <th className="text-left p-4 font-semibold text-zinc-600">{t.utilization}</th>
                  <th className="text-left p-4 font-semibold text-zinc-600">{t.health}</th>
                  <th className="text-left p-4 font-semibold text-zinc-600">{language === 'en' ? 'Actions' : 'कार्रवाई'}</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Helper to resolve config ID
                  const resolveConfigId = (res: any) => {
                    return res.config_id ||
                      (assignmentRules?.wo_assignments?.[res.work_order_number]) ||
                      (assignmentRules?.sku_assignments?.[res.product_code]) ||
                      'default';
                  };

                  // 1. Identify all relevant stages for the current search results
                  const relevantStageNames = new Set<string>();
                  lookupResult.forEach(res => {
                    const cId = resolveConfigId(res);
                    const cStages = configStagesMap[cId] || configStagesMap['default'] || [];
                    cStages.forEach(s => relevantStageNames.add(s.name));
                  });

                  // If no results, or fallbacks needed, maybe show all? 
                  // But user specifically asked to hide unrelated stages.
                  // If relevantStageNames is empty (shouldn't happen if lookupResult > 0), show default.

                  // 2. Pre-calculate search metrics by stage
                  const searchMetricsByStage = lookupResult.reduce((acc: any, res: any) => {
                    const resolvedStageName = resolveDisplayStage(res);
                    if (!acc[resolvedStageName]) {
                      acc[resolvedStageName] = {
                        count: 0,
                        units: 0,
                        totalTime: 0,
                        countWithTime: 0,
                        delayedCount: 0
                      };
                    }

                    const metrics = acc[resolvedStageName];
                    metrics.count += 1;
                    metrics.units += (res.target_qty || 0);

                    const elapsedTime = calculateElapsedTime(res.actual_start);
                    if (res.actual_start) {
                      metrics.totalTime += elapsedTime;
                      metrics.countWithTime += 1;
                    }

                    // Check delay logic
                    const configId = resolveConfigId(res);
                    const configStages = configStagesMap[configId] || [];
                    const targetTime = configStages.find(s => s.name === resolvedStageName)?.target_avg_time_minutes || 30;

                    if (elapsedTime > targetTime) {
                      metrics.delayedCount += 1;
                    }

                    return acc;
                  }, {});

                  // 3. Filter board stages to only those in the relevant set
                  // We still map over 'stages' to preserve the correct board order/metadata, 
                  // but we filter first.
                  const displayedStages = stages.filter(s => relevantStageNames.has(s.stage_name));

                  return displayedStages.map((stage) => {
                    const metrics = searchMetricsByStage[stage.stage_name] || {
                      count: 0,
                      units: 0,
                      totalTime: 0,
                      countWithTime: 0,
                      delayedCount: 0
                    };

                    const avgTime = metrics.countWithTime > 0
                      ? Math.round(metrics.totalTime / metrics.countWithTime)
                      : 0;

                    const targetTime = stage.target_avg_time_minutes;

                    // Dynamic Utilization for Search View
                    const utilization = avgTime > 0
                      ? (targetTime / avgTime) * 100
                      : 0;

                    // Determine aggregate health for filtered view
                    // < 80%: Delayed (Underutilization)
                    // > 110%: Warning (Overutilization)
                    // Else: Healthy
                    let healthStatus = 'Healthy';

                    if (metrics.count === 0) {
                      healthStatus = 'Healthy';
                    } else if (metrics.delayedCount > 0) {
                      healthStatus = 'Delayed'; // Keep explicit delay count focus
                    } else if (utilization < 80) {
                      healthStatus = 'Delayed';
                    } else if (utilization > 110) {
                      healthStatus = 'Warning';
                    }

                    return (
                      <tr key={stage.stage_id} className="border-b hover:bg-zinc-50 transition-colors">
                        <td className="p-4">
                          <span className="font-bold text-indigo-900">{stage.stage_name}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-medium text-zinc-900">{metrics.count}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{metrics.units}</span>
                            <span className="text-xs text-zinc-500">{t.units}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-mono text-zinc-700">
                            {metrics.count > 0 ? `${avgTime} ${t.min}` : '-'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-emerald-600 font-medium">
                            {Math.round(Number(targetTime))} {t.min}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden w-24">
                              <div
                                className={`h-full rounded-full ${utilization < 80 ? 'bg-red-500' : utilization > 110 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-500">{Math.round(utilization)}%</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {getHealthBadge(healthStatus)}
                        </td>
                        <td className="p-4">
                          <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1">
                            <BarChart3 className="h-4 w-4" /> {t.viewTrend}
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Main Board Content (Hidden when searching) */}
      {!isSearching && lookupResult.length === 0 && (
        <>
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
                      ? `${bottleneckStageData.stage_name} is delayed - ${Math.round(
                        bottleneckStageData.utilization_percentage,
                      )}% capacity utilization`
                      : `${bottleneckStageData.stage_name} विलंबित है - ${Math.round(
                        bottleneckStageData.utilization_percentage,
                      )}% क्षमता उपयोग`}
                  </p>
                  <button className="text-sm text-red-900 underline">{t.askBot}</button>
                </div>
              </div>
            </Card>
          )}

          {/* Stage Cards - Mobile View */}
          <div className="lg:hidden space-y-3">
            {stages.map((stage) => (
              <Card key={stage.stage_id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="mb-1">{stage.stage_name}</h3>
                    {getHealthBadge(stage.health_status)}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-zinc-600">{t.utilization}</div>
                    <div className="text-lg">
                      {Math.round(stage.utilization_percentage)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <div className="text-zinc-600 mb-1">{t.orders}</div>
                    <div>{stage.orders_count}</div>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <div className="text-zinc-600 mb-1">{t.units}</div>
                    <div>{stage.units_count}</div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600">{t.avgTime}</span>
                    <span>
                      {Math.round(Number(stage.avg_time_minutes))} {t.min}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600">{t.targetAvgTime}</span>
                    <span className="text-emerald-600">
                      {Math.round(Number(stage.target_avg_time_minutes))} {t.min}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${stage.health_status === 'Delayed'
                        ? 'bg-red-500'
                        : stage.health_status === 'Warning'
                          ? 'bg-yellow-500'
                          : 'bg-emerald-500'
                        }`}
                      style={{ width: `${Math.min(stage.utilization_percentage, 150)}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => toggleStage(stage.stage_id)}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <BarChart3 className="h-4 w-4" />
                  {expandedStageId === stage.stage_id ? t.close : t.viewTrend}
                </button>

                {expandedStageId === stage.stage_id && (
                  <div className="mt-4 border-t pt-4 animate-in slide-in-from-top-2 duration-300">
                    <StageHistoryChart
                      stageId={stage.stage_id}
                      stageName={stage.stage_name}
                      days={7}
                      language={language}
                    />
                  </div>
                )}
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
                  {stages.map((stage) => {
                    const isExpanded = expandedStageId === stage.stage_id;
                    return (
                      <>
                        <tr key={stage.stage_id} className={`border-b hover:bg-zinc-50 ${isExpanded ? 'bg-zinc-50' : ''}`}>
                          <td className="p-4 font-medium">{stage.stage_name}</td>
                          <td className="p-4">{stage.orders_count}</td>
                          <td className="p-4">{stage.units_count}</td>
                          <td className="p-4">
                            {Math.round(Number(stage.avg_time_minutes))} {t.min}
                          </td>
                          <td className="p-4">
                            <span className="text-emerald-600">
                              {Math.round(Number(stage.target_avg_time_minutes))} {t.min}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden max-w-[100px]">
                                <div
                                  className={`h-full transition-all ${stage.health_status === 'Delayed'
                                    ? 'bg-red-500'
                                    : stage.health_status === 'Warning'
                                      ? 'bg-yellow-500'
                                      : 'bg-emerald-500'
                                    }`}
                                  style={{
                                    width: `${Math.min(stage.utilization_percentage, 150)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-sm text-zinc-600 min-w-[3rem]">
                                {Math.round(stage.utilization_percentage)}%
                              </span>
                            </div>
                          </td>
                          <td className="p-4">{getHealthBadge(stage.health_status)}</td>
                          <td className="p-4">
                            <button
                              onClick={() => toggleStage(stage.stage_id)}
                              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${isExpanded ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                }`}
                            >
                              <BarChart3 className="h-4 w-4" />
                              {isExpanded ? t.close : t.viewTrend}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-zinc-50/50">
                            <td colSpan={8} className="p-4 border-b">
                              <div className="bg-white p-4 rounded-lg border shadow-sm animate-in fade-in duration-300">
                                <h4 className="mb-4 font-semibold text-zinc-800 flex items-center gap-2">
                                  <BarChart3 className="h-4 w-4 text-blue-600" />
                                  {language === 'en' ? `Trend Analysis: ${stage.stage_name}` : `ट्रेंड विश्लेषण: ${stage.stage_name}`}
                                </h4>
                                <StageHistoryChart
                                  stageId={stage.stage_id}
                                  stageName={stage.stage_name}
                                  days={7}
                                  language={language}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Live Alerts */}
          {recentAlerts.length > 0 && (
            <Card className="p-4 border border-orange-200 bg-orange-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-orange-900 font-semibold">
                  {language === 'en' ? 'Live Alerts' : 'लाइव अलर्ट्स'}
                </h3>
                <Badge className="bg-orange-600 text-white">{recentAlerts.length}</Badge>
              </div>
              <div className="space-y-3">
                {recentAlerts.map((alert) => (
                  <div
                    key={`${alert.stage_id}-${alert.detected_at}-${alert.alert_type}`}
                    className="flex items-start gap-3 border border-orange-200 rounded-lg bg-white p-3"
                  >
                    <Badge className={getSeverityBadgeClass(alert.severity)}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-medium text-orange-900">
                        {alert.stage_name} • {alert.alert_type.replace('_', ' ')}
                      </p>
                      <p className="text-sm text-orange-800">{alert.message}</p>
                      <p className="text-xs text-orange-600 mt-1">
                        {new Date(alert.detected_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500 text-white flex items-center justify-center">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-zinc-600">{language === 'en' ? 'Total Orders' : 'कुल ऑर्डर'}</p>
                  <h3>{summary.totalOrders}</h3>
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
                  <h3>{summary.totalUnits}</h3>
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
                  <h3>{Math.round(summary.avgCycleTime)} {t.min}</h3>
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
                  <h3 className="text-sm">
                    {summary.bottleneckStage || (language === 'en' ? 'None' : 'कोई नहीं')}
                  </h3>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

    </div>
  );
}
