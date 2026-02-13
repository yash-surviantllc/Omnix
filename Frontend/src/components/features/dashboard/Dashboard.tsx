import { useState, useEffect, useRef } from 'react';
import {
  Package, AlertTriangle, TrendingUp, Clock, ArrowRight, RefreshCw,
  CheckCircle, BarChart, FileText, Clipboard, Settings, User, BarChart2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { dashboardApi, type DashboardResponse } from '@/lib/api/dashboard';
import { getWsUrl } from '@/lib/api/client';

// Icon mapping helper
const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'package': return <Package className="h-5 w-5 text-blue-500" />;
    case 'alert-triangle': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case 'check-circle': return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    case 'clock': return <Clock className="h-5 w-5 text-orange-500" />;
    case 'bar-chart': return <BarChart2 className="h-5 w-5 text-purple-500" />;
    case 'file-text': return <FileText className="h-5 w-5 text-slate-500" />;
    case 'clipboard': return <Clipboard className="h-5 w-5 text-indigo-500" />;
    case 'settings': return <Settings className="h-5 w-5 text-slate-600" />;
    case 'refresh-cw': return <RefreshCw className="h-5 w-5 text-blue-500" />;
    case 'user': return <User className="h-5 w-5 text-cyan-500" />;
    case 'trending-up': return <TrendingUp className="h-5 w-5 text-green-500" />;
    default: return <Package className="h-5 w-5 text-slate-400" />;
  }
};

type DashboardProps = {
  onNavigate: (view: string) => void;
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

export function Dashboard({ onNavigate, language }: DashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const wsRef = useRef<WebSocket | null>(null);
  const [, setWsConnected] = useState(false);

  // Fetch dashboard data
  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardApi.getDashboard();
      setDashboardData(data);
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error('Error fetching dashboard:', err);
      setError(err?.detail || err?.message || 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDashboard();
  }, []);

  // WebSocket for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const connectWebSocket = () => {
      // Use window.location.hostname to work in different environments
      const wsUrl = getWsUrl(`/ws/dashboard?token=${token}`);

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'dashboard_update') {
            setDashboardData(prev => {
              if (!prev) return prev;
              switch (data.update_type) {
                case 'kpis':
                  return { ...prev, kpis: data.data };
                case 'orders':
                  return { ...prev, orders_summary: data.data };
                case 'shortages':
                  return { ...prev, shortages: data.data };
                case 'activities':
                  return { ...prev, recent_activities: data.data };
                default:
                  return prev;
              }
            });
            setLastRefresh(new Date());
          } else if (data.type === 'error') {
            console.error('WebSocket server error:', data.message);
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            console.log('Attempting to reconnect WebSocket...');
            connectWebSocket();
          }
        }, 5000);
      };
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const translations = {
    en: {
      title: 'Dashboard',
      liveOrders: 'Live Orders',
      shortages: 'Material Shortages',
      rework: 'Rework Alerts',
      onTime: 'Work Orders Completed',
      viewDetails: 'View Details',
      ordersInProgress: 'Orders in Progress',
      criticalShortages: 'Critical Shortages',
      reworkItems: 'Items in Rework',
      deliveryRate: 'For the Day',
      recentActivity: 'Recent Activity',
      askBot: 'Ask the bot for more details'
    },
    hi: {
      title: 'डैशबोर्ड',
      liveOrders: 'लाइव ऑर्डर',
      shortages: 'सामग्री की कमी',
      rework: 'रीवर्क अलर्ट',
      onTime: 'कार्य आदेश पूर्ण',
      viewDetails: 'विवरण देखें',
      ordersInProgress: 'प्रगति में आदेश',
      criticalShortages: 'गंभीर कमी',
      reworkItems: 'रीवर्क में आइटम',
      deliveryRate: 'दिन के लिए',
      recentActivity: 'हाल की गतिविधि',
      askBot: 'अधिक विवरण के लिए बॉट से पूछें'
    },
    kn: {
      title: 'ಡೈಶ್‌बೋರ್ಡ್',
      liveOrders: 'ಸ್ಥಿರ ಆರ್ಡರ್ಸ್',
      shortages: 'ಸಾಮಾನ್‍ಯ ಕೆಲಸ',
      rework: 'ರಿವರ್ಕ್ ಅಲರ್ಟ್',
      onTime: 'ಕಾರ್ಯ ಆದೇಶಗಳು ಪೂರ್ಣಗೊಂಡಿವೆ',
      viewDetails: 'ವಿವರಣೆಗಳನ್ನು ನೋಡಿ',
      ordersInProgress: 'ವಿವರ್ತಿತ ಆರ್ಡರ್ಸ್',
      criticalShortages: 'ಸುರಖ್ಷಿತ ಕೆಲಸ',
      reworkItems: 'ರಿವರ್ಕ್ ಮೀಟ್ಸ್',
      deliveryRate: 'ದಿನಕ್ಕೆ',
      recentActivity: 'ಕ್ರೀಡೆಯ ಕ್ರಿಯೆ',
      askBot: 'ಹೆಚ್ಚು ವಿವರಣೆಗಳನ್ನು ಬೋಟ್ ನಿಂದ ಕೇಳಿ'
    },
    ta: {
      title: 'டைஷ்போர்ட்',
      liveOrders: 'தற்போதைய ஆர்டர்கள்',
      shortages: 'விலக்ஷனம்',
      rework: 'மீட்சம் அலர்ட்கள்',
      onTime: 'வேலை ஆர்டர்கள் முடிந்தது',
      viewDetails: 'விவரங்களை பாருங்கள்',
      ordersInProgress: 'உருவாக்கியில் ஆர்டர்கள்',
      criticalShortages: 'முக்கிய விலக்ஷனம்',
      reworkItems: 'மீட்சம் பொருட்கள்',
      deliveryRate: 'நாளுக்கு',
      recentActivity: 'சமீப கொடுக்கம்',
      askBot: 'மேலும் விவரங்களுக்கு போட்டானின் கேள்வி'
    },
    te: {
      title: 'డైష్‌బోర్డ్',
      liveOrders: 'ప్రతిసాహిత ఆర్డర్స్',
      shortages: 'ప్రయత్నిక కెలసం',
      rework: 'రీవర్క్ అలర్ట్',
      onTime: 'పని ఆర్డర్లు పూర్తయ్యాయి',
      viewDetails: 'వివరణలను చూడండి',
      ordersInProgress: 'ప్రకటిత ఆర్డర్స్',
      criticalShortages: 'సమాచారిక కెలసం',
      reworkItems: 'రీవర్క్ ప్రయత్నికం',
      deliveryRate: 'రోజుకు',
      recentActivity: 'సమీప కార్యకలాపం',
      askBot: 'మేలుమాత్రాల కోసం బోట్ నుండి ప్రశ్న'
    },
    mr: {
      title: 'डॅशबोर्ड',
      liveOrders: 'साकारात्मक आर्डर्स',
      shortages: 'कमी',
      rework: 'रीवर्क अलर्ट',
      onTime: 'कार्य आदेश पूर्ण',
      viewDetails: 'विवरण देखें',
      ordersInProgress: 'प्रगति में आर्डर्स',
      criticalShortages: 'गंभीर कमी',
      reworkItems: 'रीवर्क में आइटम',
      deliveryRate: 'दिन के लिए',
      recentActivity: 'हाल की गतिविधि',
      askBot: 'अधिक विवरण के लिए बॉट से पूछें'
    },
    gu: {
      title: 'ડૈશબોર્ડ',
      liveOrders: 'લાઇવ આર્ડર્સ',
      shortages: 'માટેરિયલ કેલસ',
      rework: 'રીવર્ક અલર્ટ',
      onTime: 'કાર્ય ઓર્ડર્સ પૂર્ણ',
      viewDetails: 'વિવરણો દેખો',
      ordersInProgress: 'પ્રગતિમાં આર્ડર્સ',
      criticalShortages: 'ક્રિટિકલ કેલસ',
      reworkItems: 'રીવર્ક આઇટમ્સ',
      deliveryRate: 'દિવસ માટે',
      recentActivity: 'નિર્ણય કાર્ય',
      askBot: 'અધિક વિવરણ માટે બોટથી પુછો'
    },
    pa: {
      title: 'ਡੈਸ਼ਬੋਰਡ',
      liveOrders: 'ਲਾਈਵ ਆਰਡਰਜ਼',
      shortages: 'ਮਾਟੇਰਿਅਲ ਕੇਲਸ',
      rework: 'ਰੀਵਰਕ ਅਲਾਰਟ',
      onTime: 'ਕੰਮ ਆਰਡਰ ਪੂਰੇ',
      viewDetails: 'ਵਿਸਤਾਰਤ ਵਿਵਰਨਾਵਾਂ ਦੇਖੋ',
      ordersInProgress: 'ਵਿਕਾਸ ਵਿਚ ਆਰਡਰਜ਼',
      criticalShortages: 'ਕ੍ਰਿਟੀਕਲ ਕੇਲਸ',
      reworkItems: 'ਰੀਵਰਕ ਆਇਟਮਜ਼',
      deliveryRate: 'ਦਿਨ ਲਈ',
      recentActivity: 'ਨਿਰਣਤ ਕਾਰਨਾ',
      askBot: 'ਵਿਸਤਾਰਤ ਵਿਵਰਨਾਵਾਂ ਲਈ ਬੋਟ ਤੋਂ ਪੁਛੋ'
    }
  };

  const t = translations[language];

  // Map API data to stats cards
  const getStats = () => {
    if (!dashboardData) return [];

    const kpis = dashboardData.kpis;

    return [
      {
        title: t.liveOrders,
        value: kpis.live_orders.value.toString(),
        subtitle: t.ordersInProgress,
        icon: Package,
        color: 'bg-blue-500',
        trend: `${kpis.live_orders.value} ${kpis.live_orders.unit || 'orders'}`
      },
      {
        title: t.shortages,
        value: kpis.material_shortages.value.toString(),
        subtitle: t.criticalShortages,
        icon: AlertTriangle,
        color: Number(kpis.material_shortages.value) > 0 ? 'bg-red-500' : 'bg-green-500',
        trend: Number(kpis.material_shortages.value) > 0 ? 'Action needed' : 'All good'
      },
      {
        title: t.rework,
        value: kpis.rework_items.value.toString(),
        subtitle: t.reworkItems,
        icon: Clock,
        color: 'bg-yellow-500',
        trend: `${kpis.rework_items.value} ${kpis.rework_items.unit || 'items'}`
      },
      {
        title: t.onTime,
        value: kpis.otd_percentage.value.toString(),
        subtitle: t.deliveryRate,
        icon: TrendingUp,
        color: Number(kpis.otd_percentage.value) > 0 ? 'bg-emerald-500' : 'bg-blue-500',
        trend: 'For the day'
      }
    ];
  };

  const stats = getStats();

  // Format activities from API
  const getActivities = () => {
    if (!dashboardData?.recent_activities) return [];

    return dashboardData.recent_activities.map(activity => {
      const timestamp = new Date(activity.timestamp);
      const now = new Date();
      const diffMs = now.getTime() - timestamp.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      let timeAgo = '';
      if (diffDays > 0) timeAgo = `${diffDays}d ago`;
      else if (diffHours > 0) timeAgo = `${diffHours}h ago`;
      else if (diffMins > 0) timeAgo = `${diffMins}m ago`;
      else timeAgo = 'Just now';

      // Determine type based on activity_type
      let type = 'info';
      if (activity.activity_type.includes('shortage') || activity.activity_type.includes('alert')) {
        type = 'alert';
      } else if (activity.activity_type.includes('warning') || activity.activity_type.includes('low')) {
        type = 'warning';
      }

      return {
        text: activity.description,
        time: timeAgo,
        type: type,
        icon: activity.icon
      };
    });
  };

  const activities = getActivities();

  // Loading state
  if (isLoading && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-zinc-600">
            {language === 'en'
              ? 'Loading dashboard...'
              : language === 'hi'
                ? 'डैशबोर्ड लोड हो रहा है...'
                : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              <h3 className="text-lg font-medium text-red-800">
                {language === 'en'
                  ? 'Failed to load dashboard'
                  : language === 'hi'
                    ? 'डैशबोर्ड लोड करने में विफल'
                    : 'Error loading dashboard'}
              </h3>
            </div>
            <p className="text-red-700 mb-4">{error}</p>
            <Button
              variant="outline"
              onClick={fetchDashboard}
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {language === 'en'
                ? 'Retry'
                : language === 'hi'
                  ? 'पुनः प्रयास करें'
                  : 'Retry'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>{t.title}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">
            {language === 'en' ? 'Last updated' : 'अंतिम अपडेट'}: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboard}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {language === 'en' ? 'Refresh' : 'रीफ्रेश'}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <Card key={idx} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-zinc-600 mb-1">{stat.title}</p>
                <h2 className="mb-1">{stat.value}</h2>
                <p className="text-sm text-zinc-500">{stat.subtitle}</p>
                <p className="text-sm text-zinc-400 mt-2">{stat.trend}</p>
              </div>
              <div className={`${stat.color} text-white p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="mb-4">
          {language === 'en' ? 'Quick Actions' : 'त्वरित क्रियाएं'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="justify-start h-auto py-4"
            onClick={() => onNavigate('bom')}
          >
            <div className="text-left">
              <div>{language === 'en' ? 'Plan Materials' : 'सामग्री योजना'}</div>
              <div className="text-sm text-zinc-500 mt-1">
                {language === 'en' ? 'Create BOMs' : 'BOM बनाएं'}
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-4"
            onClick={() => onNavigate('orders')}
          >
            <div className="text-left">
              <div>{language === 'en' ? 'View Orders' : 'ऑर्डर देखें'}</div>
              <div className="text-sm text-zinc-500 mt-1">
                {language === 'en' ? 'Manage production' : 'उत्पादन प्रबंधित करें'}
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-4"
            onClick={() => onNavigate('wip')}
          >
            <div className="text-left">
              <div>{language === 'en' ? 'WIP Board' : 'WIP बोर्ड'}</div>
              <div className="text-sm text-zinc-500 mt-1">
                {language === 'en' ? 'Track progress' : 'प्रगति ट्रैक करें'}
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-4"
            onClick={() => onNavigate('qc')}
          >
            <div className="text-left">
              <div>{language === 'en' ? 'QC Check' : 'QC जांच'}</div>
              <div className="text-sm text-zinc-500 mt-1">
                {language === 'en' ? 'Quality control' : 'गुणवत्ता नियंत्रण'}
              </div>
            </div>
          </Button>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3>{t.recentActivity}</h3>
          <Button variant="ghost" size="sm">
            {language === 'en' ? 'View All' : 'सभी देखें'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <div className="space-y-3">
          {activities.length > 0 ? (
            activities.map((activity, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                {activity.icon ? (
                  <div className="mt-1">{getIcon(activity.icon)}</div>
                ) : (
                  <div
                    className={`h-2 w-2 rounded-full mt-2 ${activity.type === 'info'
                      ? 'bg-emerald-500'
                      : activity.type === 'warning'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                      }`}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-900">{activity.text}</p>
                  <p className="text-sm text-zinc-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-zinc-500 py-8">
              {language === 'en' ? 'No recent activities' : 'कोई हालिया गतिविधि नहीं'}
            </p>
          )}
        </div>
      </Card>

      {/* AI Assistant Prompt */}
      <Card className="p-6 bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-emerald-600 flex items-center justify-center text-white">
            <Package className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-emerald-900">{t.askBot}</h3>
            <p className="text-emerald-700 mt-1">
              {language === 'en'
                ? 'Try: "Show me shortages" or "Transfer materials to Assembly"'
                : 'प्रयास करें: "मुझे कमी दिखाएं" या "असेंबली में सामग्री स्थानांतरित करें"'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}