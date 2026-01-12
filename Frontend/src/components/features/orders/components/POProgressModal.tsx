import { XCircle, Package, TrendingUp, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { finishedGoodsApi, type POProgress } from '@/lib/api/finished-goods';

interface POProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    poId: string;
    poNumber: string;
    language?: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
}

export function POProgressModal({
    isOpen,
    onClose,
    poId,
    poNumber,
    language = 'en'
}: POProgressModalProps) {
    const [progressData, setProgressData] = useState<POProgress | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const translations = {
        en: {
            title: 'Production Order Progress',
            orderNumber: 'Order Number',
            product: 'Product',
            productCode: 'Product Code',
            orderedQty: 'Ordered Quantity',
            completedQty: 'Completed Quantity',
            pendingQty: 'Pending Quantity',
            inFG: 'In Finished Goods',
            dispatched: 'Dispatched',
            reworked: 'Reworked',
            scrapped: 'Scrapped',
            completionProgress: 'Completion Progress',
            dispatchProgress: 'Dispatch Progress',
            workOrders: 'Work Orders Breakdown',
            woNumber: 'WO Number',
            quantity: 'Quantity',
            completed: 'Completed',
            status: 'Status',
            noWorkOrders: 'No work orders found',
            loading: 'Loading progress data...',
            errorLoading: 'Failed to load progress data',
            retry: 'Retry',
            close: 'Close'
        },
        hi: {
            title: 'उत्पादन आदेश प्रगति',
            orderNumber: 'ऑर्डर नंबर',
            product: 'उत्पाद',
            productCode: 'उत्पाद कोड',
            orderedQty: 'ऑर्डर की गई मात्रा',
            completedQty: 'पूर्ण मात्रा',
            pendingQty: 'लंबित मात्रा',
            inFG: 'तैयार माल में',
            dispatched: 'भेजा गया',
            reworked: 'पुनः कार्य',
            scrapped: 'खराब',
            completionProgress: 'पूर्णता प्रगति',
            dispatchProgress: 'प्रेषण प्रगति',
            workOrders: 'कार्य आदेश विवरण',
            woNumber: 'WO नंबर',
            quantity: 'मात्रा',
            completed: 'पूर्ण',
            status: 'स्थिति',
            noWorkOrders: 'कोई कार्य आदेश नहीं मिला',
            loading: 'प्रगति डेटा लोड हो रहा है...',
            errorLoading: 'प्रगति डेटा लोड करने में विफल',
            retry: 'पुनः प्रयास',
            close: 'बंद करें'
        },
        kn: {
            title: 'ಉತ್ಪಾದನಾ ಆದೇಶ ಪ್ರಗತಿ',
            orderNumber: 'ಆದೇಶ ಸಂಖ್ಯೆ',
            product: 'ಉತ್ಪನ್ನ',
            productCode: 'ಉತ್ಪನ್ನ ಕೋಡ್',
            orderedQty: 'ಆದೇಶಿತ ಪ್ರಮಾಣ',
            completedQty: 'ಪೂರ್ಣಗೊಂಡ ಪ್ರಮಾಣ',
            pendingQty: 'ಬಾಕಿ ಪ್ರಮಾಣ',
            inFG: 'ಸಿದ್ಧ ಸರಕುಗಳಲ್ಲಿ',
            dispatched: 'ರವಾನೆ ಮಾಡಲಾಗಿದೆ',
            reworked: 'ಮರು ಕೆಲಸ',
            scrapped: 'ತಿರಸ್ಕರಿಸಲಾಗಿದೆ',
            completionProgress: 'ಪೂರ್ಣಗೊಳಿಸುವ ಪ್ರಗತಿ',
            dispatchProgress: 'ರವಾನೆ ಪ್ರಗತಿ',
            workOrders: 'ಕೆಲಸದ ಆದೇಶಗಳ ವಿವರಣೆ',
            woNumber: 'WO ಸಂಖ್ಯೆ',
            quantity: 'ಪ್ರಮಾಣ',
            completed: 'ಪೂರ್ಣಗೊಂಡಿದೆ',
            status: 'ಸ್ಥಿತಿ',
            noWorkOrders: 'ಯಾವುದೇ ಕೆಲಸದ ಆದೇಶಗಳು ಕಂಡುಬಂದಿಲ್ಲ',
            loading: 'ಪ್ರಗತಿ ಡೇಟಾ ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
            errorLoading: 'ಪ್ರಗತಿ ಡೇಟಾ ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ',
            retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
            close: 'ಮುಚ್ಚಿ'
        },
        ta: {
            title: 'உற்பத்தி ஆர்டர் முன்னேற்றம்',
            orderNumber: 'ஆர்டர் எண்',
            product: 'தயாரிப்பு',
            productCode: 'தயாரிப்பு குறியீடு',
            orderedQty: 'ஆர்டர் செய்யப்பட்ட அளவு',
            completedQty: 'முடிக்கப்பட்ட அளவு',
            pendingQty: 'நிலுவையில் உள்ள அளவு',
            inFG: 'முடிக்கப்பட்ட பொருட்களில்',
            dispatched: 'அனுப்பப்பட்டது',
            reworked: 'மீண்டும் வேலை',
            scrapped: 'நிராகரிக்கப்பட்டது',
            completionProgress: 'முடிவு முன்னேற்றம்',
            dispatchProgress: 'அனுப்புதல் முன்னேற்றம்',
            workOrders: 'வேலை ஆர்டர்கள் விவரம்',
            woNumber: 'WO எண்',
            quantity: 'அளவு',
            completed: 'முடிந்தது',
            status: 'நிலை',
            noWorkOrders: 'வேலை ஆர்டர்கள் இல்லை',
            loading: 'முன்னேற்ற தரவு ஏற்றப்படுகிறது...',
            errorLoading: 'முன்னேற்ற தரவை ஏற்ற முடியவில்லை',
            retry: 'மீண்டும் முயற்சிக்கவும்',
            close: 'மூடு'
        },
        te: {
            title: 'ఉత్పత్తి ఆర్డర్ పురోగతి',
            orderNumber: 'ఆర్డర్ సంఖ్య',
            product: 'ఉత్పత్తి',
            productCode: 'ఉత్పత్తి కోడ్',
            orderedQty: 'ఆర్డర్ చేసిన పరిమాణం',
            completedQty: 'పూర్తయిన పరిమాణం',
            pendingQty: 'పెండింగ్ పరిమాణం',
            inFG: 'పూర్తయిన వస్తువులలో',
            dispatched: 'పంపబడింది',
            reworked: 'మళ్లీ పని',
            scrapped: 'తిరస్కరించబడింది',
            completionProgress: 'పూర్తి పురోగతి',
            dispatchProgress: 'పంపిణీ పురోగతి',
            workOrders: 'పని ఆర్డర్ల వివరాలు',
            woNumber: 'WO సంఖ్య',
            quantity: 'పరిమాణం',
            completed: 'పూర్తయింది',
            status: 'స్థితి',
            noWorkOrders: 'పని ఆర్డర్లు కనుగొనబడలేదు',
            loading: 'పురోగతి డేటా లోడ్ అవుతోంది...',
            errorLoading: 'పురోగతి డేటా లోడ్ చేయడంలో విఫలమైంది',
            retry: 'మళ్లీ ప్రయత్నించండి',
            close: 'మూసివేయి'
        },
        mr: {
            title: 'उत्पादन ऑर्डर प्रगती',
            orderNumber: 'ऑर्डर क्रमांक',
            product: 'उत्पादन',
            productCode: 'उत्पादन कोड',
            orderedQty: 'ऑर्डर केलेले प्रमाण',
            completedQty: 'पूर्ण केलेले प्रमाण',
            pendingQty: 'प्रलंबित प्रमाण',
            inFG: 'तयार मालामध्ये',
            dispatched: 'पाठवले',
            reworked: 'पुन्हा काम',
            scrapped: 'नाकारले',
            completionProgress: 'पूर्णता प्रगती',
            dispatchProgress: 'पाठवणी प्रगती',
            workOrders: 'कार्य ऑर्डर तपशील',
            woNumber: 'WO क्रमांक',
            quantity: 'प्रमाण',
            completed: 'पूर्ण',
            status: 'स्थिती',
            noWorkOrders: 'कोणतेही कार्य ऑर्डर आढळले नाहीत',
            loading: 'प्रगती डेटा लोड होत आहे...',
            errorLoading: 'प्रगती डेटा लोड करण्यात अयशस्वी',
            retry: 'पुन्हा प्रयत्न करा',
            close: 'बंद करा'
        },
        gu: {
            title: 'ઉત્પાદન ઓર્ડર પ્રગતિ',
            orderNumber: 'ઓર્ડર નંબર',
            product: 'ઉત્પાદન',
            productCode: 'ઉત્પાદન કોડ',
            orderedQty: 'ઓર્ડર કરેલ જથ્થો',
            completedQty: 'પૂર્ણ થયેલ જથ્થો',
            pendingQty: 'બાકી જથ્થો',
            inFG: 'તૈયાર માલમાં',
            dispatched: 'મોકલવામાં આવ્યું',
            reworked: 'ફરીથી કામ',
            scrapped: 'નકારવામાં આવ્યું',
            completionProgress: 'પૂર્ણતા પ્રગતિ',
            dispatchProgress: 'મોકલવાની પ્રગતિ',
            workOrders: 'કાર્ય ઓર્ડર વિગતો',
            woNumber: 'WO નંબર',
            quantity: 'જથ્થો',
            completed: 'પૂર્ણ',
            status: 'સ્થિતિ',
            noWorkOrders: 'કોઈ કાર્ય ઓર્ડર મળ્યા નથી',
            loading: 'પ્રગતિ ડેટા લોડ થઈ રહ્યો છે...',
            errorLoading: 'પ્રગતિ ડેટા લોડ કરવામાં નિષ્ફળ',
            retry: 'ફરી પ્રયાસ કરો',
            close: 'બંધ કરો'
        },
        pa: {
            title: 'ਉਤਪਾਦਨ ਆਰਡਰ ਪ੍ਰਗਤੀ',
            orderNumber: 'ਆਰਡਰ ਨੰਬਰ',
            product: 'ਉਤਪਾਦ',
            productCode: 'ਉਤਪਾਦ ਕੋਡ',
            orderedQty: 'ਆਰਡਰ ਕੀਤੀ ਮਾਤਰਾ',
            completedQty: 'ਪੂਰੀ ਹੋਈ ਮਾਤਰਾ',
            pendingQty: 'ਬਾਕੀ ਮਾਤਰਾ',
            inFG: 'ਤਿਆਰ ਮਾਲ ਵਿੱਚ',
            dispatched: 'ਭੇਜਿਆ ਗਿਆ',
            reworked: 'ਦੁਬਾਰਾ ਕੰਮ',
            scrapped: 'ਰੱਦ ਕੀਤਾ',
            completionProgress: 'ਪੂਰਤੀ ਪ੍ਰਗਤੀ',
            dispatchProgress: 'ਭੇਜਣ ਦੀ ਪ੍ਰਗਤੀ',
            workOrders: 'ਕੰਮ ਆਰਡਰ ਵੇਰਵੇ',
            woNumber: 'WO ਨੰਬਰ',
            quantity: 'ਮਾਤਰਾ',
            completed: 'ਪੂਰਾ',
            status: 'ਸਥਿਤੀ',
            noWorkOrders: 'ਕੋਈ ਕੰਮ ਆਰਡਰ ਨਹੀਂ ਮਿਲੇ',
            loading: 'ਪ੍ਰਗਤੀ ਡੇਟਾ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...',
            errorLoading: 'ਪ੍ਰਗਤੀ ਡੇਟਾ ਲੋਡ ਕਰਨ ਵਿੱਚ ਅਸਫਲ',
            retry: 'ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ',
            close: 'ਬੰਦ ਕਰੋ'
        }
    };

    const t = translations[language] || translations.en;

    useEffect(() => {
        const fetchProgressData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await finishedGoodsApi.getPOProgress(poId);
                setProgressData(data);
            } catch (err: any) {
                setError(err?.detail || err?.message || t.errorLoading);
            } finally {
                setIsLoading(false);
            }
        };

        if (isOpen && poId) {
            fetchProgressData();
        }
    }, [isOpen, poId, t.errorLoading]);

    const handleRetry = () => {
        setIsLoading(true);
        setError(null);
        finishedGoodsApi.getPOProgress(poId)
            .then(data => setProgressData(data))
            .catch((err: any) => setError(err?.detail || err?.message || t.errorLoading))
            .finally(() => setIsLoading(false));
    };

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'planned':
                return <Badge className="bg-blue-500">{status}</Badge>;
            case 'in progress':
                return <Badge className="bg-emerald-500">{status}</Badge>;
            case 'completed':
                return <Badge className="bg-green-600">{status}</Badge>;
            case 'on hold':
                return <Badge className="bg-yellow-500">{status}</Badge>;
            case 'cancelled':
                return <Badge className="bg-red-500">{status}</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    const ProgressBar = ({ percentage, color = 'bg-emerald-500' }: { percentage: number; color?: string }) => (
        <div className="w-full bg-zinc-200 rounded-full h-3 overflow-hidden">
            <div
                className={`h-full ${color} transition-all duration-500 ease-out flex items-center justify-end pr-2`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
            >
                {percentage > 15 && (
                    <span className="text-[10px] font-semibold text-white">{percentage.toFixed(1)}%</span>
                )}
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
            <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="min-h-full flex items-center justify-center p-4">
                    <Card className="w-full max-w-4xl p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="h-6 w-6 text-emerald-600" />
                                <div>
                                    <h2 className="text-2xl font-semibold">{t.title}</h2>
                                    <p className="text-sm text-zinc-600">{poNumber}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={onClose}>
                                <XCircle className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Loading State */}
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="h-12 w-12 text-emerald-600 animate-spin mb-4" />
                                <p className="text-zinc-600">{t.loading}</p>
                            </div>
                        )}

                        {/* Error State */}
                        {error && !isLoading && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                                <p className="text-red-600 mb-4">{error}</p>
                                <Button onClick={handleRetry} variant="outline">
                                    {t.retry}
                                </Button>
                            </div>
                        )}

                        {/* Progress Data */}
                        {progressData && !isLoading && !error && (
                            <div className="space-y-6">
                                {/* Product Information */}
                                <div className="grid grid-cols-3 gap-4 p-4 bg-zinc-50 rounded-lg">
                                    <div className="col-span-2">
                                        <p className="text-sm text-zinc-600 mb-1">{t.product}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {(progressData as any).items && (progressData as any).items.length > 0 ? (
                                                (progressData as any).items.map((item: any, idx: number) => (
                                                    <Badge key={idx} variant="outline" className="bg-white">
                                                        {item.product_name} ({item.product_code}) - {item.quantity} units
                                                    </Badge>
                                                ))
                                            ) : (
                                                <p className="font-medium">{progressData.product_name} ({progressData.product_code})</p>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm text-zinc-600">{t.orderedQty}</p>
                                        <p className="font-medium text-lg">{progressData.ordered_quantity}</p>
                                    </div>
                                </div>

                                {/* Quantity Breakdown */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-4 border border-emerald-200 bg-emerald-50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                            <p className="text-sm text-emerald-700 font-medium">{t.completedQty}</p>
                                        </div>
                                        <p className="text-2xl font-bold text-emerald-700">{progressData.quantity_completed}</p>
                                    </div>

                                    <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="h-5 w-5 text-blue-600" />
                                            <p className="text-sm text-blue-700 font-medium">{t.pendingQty}</p>
                                        </div>
                                        <p className="text-2xl font-bold text-blue-700">{progressData.quantity_pending}</p>
                                    </div>

                                    <div className="p-4 border border-purple-200 bg-purple-50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Package className="h-5 w-5 text-purple-600" />
                                            <p className="text-sm text-purple-700 font-medium">{t.inFG}</p>
                                        </div>
                                        <p className="text-2xl font-bold text-purple-700">{progressData.quantity_in_fg}</p>
                                    </div>

                                    <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp className="h-5 w-5 text-amber-600" />
                                            <p className="text-sm text-amber-700 font-medium">{t.dispatched}</p>
                                        </div>
                                        <p className="text-2xl font-bold text-amber-700">{progressData.quantity_dispatched}</p>
                                    </div>
                                </div>

                                {/* Additional Quantities */}
                                {(progressData.quantity_reworked > 0 || progressData.quantity_scrapped > 0) && (
                                    <div className="grid grid-cols-2 gap-4">
                                        {progressData.quantity_reworked > 0 && (
                                            <div className="p-3 border border-orange-200 bg-orange-50 rounded-lg">
                                                <p className="text-sm text-orange-700 font-medium mb-1">{t.reworked}</p>
                                                <p className="text-xl font-bold text-orange-700">{progressData.quantity_reworked}</p>
                                            </div>
                                        )}
                                        {progressData.quantity_scrapped > 0 && (
                                            <div className="p-3 border border-red-200 bg-red-50 rounded-lg">
                                                <p className="text-sm text-red-700 font-medium mb-1">{t.scrapped}</p>
                                                <p className="text-xl font-bold text-red-700">{progressData.quantity_scrapped}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Progress Bars */}
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-medium text-zinc-700">{t.completionProgress}</p>
                                            <p className="text-sm font-semibold text-emerald-600">
                                                {progressData.completion_percentage.toFixed(1)}%
                                            </p>
                                        </div>
                                        <ProgressBar percentage={progressData.completion_percentage} color="bg-emerald-500" />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-medium text-zinc-700">{t.dispatchProgress}</p>
                                            <p className="text-sm font-semibold text-amber-600">
                                                {progressData.dispatch_percentage.toFixed(1)}%
                                            </p>
                                        </div>
                                        <ProgressBar percentage={progressData.dispatch_percentage} color="bg-amber-500" />
                                    </div>
                                </div>

                                {/* Work Orders Breakdown */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Package className="h-5 w-5 text-zinc-600" />
                                        {t.workOrders}
                                    </h3>

                                    {progressData.work_orders && progressData.work_orders.length > 0 ? (
                                        <div className="space-y-3">
                                            {progressData.work_orders.map((wo) => {
                                                const woProgress = wo.quantity > 0 ? (wo.quantity_completed / wo.quantity) * 100 : 0;
                                                return (
                                                    <div key={wo.id} className="p-4 border border-zinc-200 rounded-lg hover:border-emerald-300 transition-colors">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <p className="font-medium text-zinc-800">{wo.work_order_number}</p>
                                                                {getStatusBadge(wo.status)}
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm text-zinc-600">
                                                                    {wo.quantity_completed} / {wo.quantity}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <ProgressBar percentage={woProgress} color="bg-blue-500" />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-zinc-500">
                                            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                            <p>{t.noWorkOrders}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="mt-6 flex justify-end">
                            <Button onClick={onClose} variant="outline">
                                {t.close}
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </>
    );
}
