import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { wipApi } from '@/lib/api/wip';
import { TrendingUp, Clock, Activity } from 'lucide-react';

type StageHistoryChartProps = {
  stageName: string;
  days?: number;
  language?: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

type HistoryData = {
  date: string;
  avg_time_minutes: number;
  utilization_percentage: number;
  efficiency_percentage: number;
  orders_processed: number;
  units_processed: number;
};

export function StageHistoryChart({ stageName, days = 7, language = 'en' }: StageHistoryChartProps) {
  const [data, setData] = useState<HistoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const translations = {
    en: {
      title: 'Performance Trend',
      avgTime: 'Avg Time (min)',
      utilization: 'Utilization %',
      efficiency: 'Efficiency %',
      orders: 'Orders',
      units: 'Units',
      loading: 'Loading chart data...',
      noData: 'No historical data available',
      days: 'days'
    },
    hi: {
      title: 'प्रदर्शन रुझान',
      avgTime: 'औसत समय (मिनट)',
      utilization: 'उपयोग %',
      efficiency: 'दक्षता %',
      orders: 'ऑर्डर',
      units: 'यूनिट',
      loading: 'चार्ट डेटा लोड हो रहा है...',
      noData: 'कोई ऐतिहासिक डेटा उपलब्ध नहीं',
      days: 'दिन'
    },
    kn: {
      title: 'ಕಾರ್ಯಕ್ಷಮತೆ ಪ್ರವೃತ್ತಿ',
      avgTime: 'ಸರಾಸರಿ ಸಮಯ (ನಿಮಿಷ)',
      utilization: 'ಬಳಕೆ %',
      efficiency: 'ದಕ್ಷತೆ %',
      orders: 'ಆರ್ಡರ್ಸ್',
      units: 'ಯೂನಿಟ್ಸ್',
      loading: 'ಚಾರ್ಟ್ ಡೇಟಾ ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
      noData: 'ಯಾವುದೇ ಐತಿಹಾಸಿಕ ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ',
      days: 'ದಿನಗಳು'
    },
    ta: {
      title: 'செயல்திறன் போக்கு',
      avgTime: 'சராசரி நேரம் (நிமிடம்)',
      utilization: 'பயன்பாடு %',
      efficiency: 'திறன் %',
      orders: 'ஆர்டர்கள்',
      units: 'யூனிட்கள்',
      loading: 'விளக்கப்பட தரவு ஏற்றப்படுகிறது...',
      noData: 'வரலாற்று தரவு இல்லை',
      days: 'நாட்கள்'
    },
    te: {
      title: 'పనితీరు ధోరణి',
      avgTime: 'సగటు సమయం (నిమిషం)',
      utilization: 'వినియోగం %',
      efficiency: 'సామర్థ్యం %',
      orders: 'ఆర్డర్లు',
      units: 'యూనిట్లు',
      loading: 'చార్ట్ డేటా లోడ్ అవుతోంది...',
      noData: 'చారిత్రక డేటా అందుబాటులో లేదు',
      days: 'రోజులు'
    },
    mr: {
      title: 'कार्यप्रदर्शन ट्रेंड',
      avgTime: 'सरासरी वेळ (मिनिट)',
      utilization: 'वापर %',
      efficiency: 'कार्यक्षमता %',
      orders: 'ऑर्डर',
      units: 'युनिट',
      loading: 'चार्ट डेटा लोड होत आहे...',
      noData: 'कोणताही ऐतिहासिक डेटा उपलब्ध नाही',
      days: 'दिवस'
    },
    gu: {
      title: 'પ્રદર્શન વલણ',
      avgTime: 'સરેરાશ સમય (મિનિટ)',
      utilization: 'ઉપયોગ %',
      efficiency: 'કાર્યક્ષમતા %',
      orders: 'ઓર્ડર',
      units: 'યુનિટ',
      loading: 'ચાર્ટ ડેટા લોડ થઈ રહ્યો છે...',
      noData: 'કોઈ ઐતિહાસિક ડેટા ઉપલબ્ધ નથી',
      days: 'દિવસ'
    },
    pa: {
      title: 'ਪ੍ਰਦਰਸ਼ਨ ਰੁਝਾਨ',
      avgTime: 'ਔਸਤ ਸਮਾਂ (ਮਿੰਟ)',
      utilization: 'ਵਰਤੋਂ %',
      efficiency: 'ਕੁਸ਼ਲਤਾ %',
      orders: 'ਆਰਡਰ',
      units: 'ਯੂਨਿਟ',
      loading: 'ਚਾਰਟ ਡੇਟਾ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...',
      noData: 'ਕੋਈ ਇਤਿਹਾਸਕ ਡੇਟਾ ਉਪਲਬਧ ਨਹੀਂ',
      days: 'ਦਿਨ'
    }
  };

  const t = translations[language];

  useEffect(() => {
    fetchHistoryData();
  }, [stageName, days]);

  const fetchHistoryData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const history = await wipApi.getStageHistory(stageName, days);
      
      // Reverse to show oldest to newest
      const sortedData = history.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      setData(sortedData);
    } catch (err: any) {
      console.error('Error fetching stage history:', err);
      setError(err?.detail || err?.message || 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">{t.loading}</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-red-500">{error}</p>
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">{t.noData}</p>
        </div>
      </Card>
    );
  }

  // Calculate summary stats
  const avgUtilization = data.reduce((sum, d) => sum + d.utilization_percentage, 0) / data.length;
  const avgEfficiency = data.reduce((sum, d) => sum + d.efficiency_percentage, 0) / data.length;
  const totalOrders = data.reduce((sum, d) => sum + d.orders_processed, 0);

  return (
    <Card className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            {t.title} - {stageName} ({days} {t.days})
          </h3>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-zinc-600">{t.utilization}</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {avgUtilization.toFixed(1)}%
            </div>
          </div>

          <div className="p-4 bg-emerald-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-zinc-600">{t.efficiency}</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {avgEfficiency.toFixed(1)}%
            </div>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-zinc-600">{t.orders}</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {totalOrders}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
            labelFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString();
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Line 
            type="monotone" 
            dataKey="avg_time_minutes" 
            stroke="#3b82f6" 
            strokeWidth={2}
            name={t.avgTime}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="utilization_percentage" 
            stroke="#f59e0b" 
            strokeWidth={2}
            name={t.utilization}
            dot={{ fill: '#f59e0b', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="efficiency_percentage" 
            stroke="#10b981" 
            strokeWidth={2}
            name={t.efficiency}
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
