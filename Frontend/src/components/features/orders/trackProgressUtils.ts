import { PurchaseOrder, StageProgress, SkuProgressSummary, SkuShortageSummary } from '@/lib/api/purchase-orders';
import type { MultiSkuFormItem } from './types';

export type SkuDisplayEntry = {
  key: string;
  label: string;
  required: number;
  completed: number;
  shortage: number;
  unit: string;
  status: 'ready' | 'in_progress' | 'queued';
  assignedTeam?: string;
  lastUpdated?: string;
};

const DEFAULT_STAGE_SEQUENCE = ['Material Planning', 'Cutting', 'Sewing', 'Quality Check', 'Packaging', 'Dispatch'];

export const buildSkuDisplayEntries = (
  order: PurchaseOrder,
  fallbackLines: MultiSkuFormItem[],
  getProductLabel: (productId: string) => string
): { entries: SkuDisplayEntry[]; hasRealtime: boolean } => {
  const skuProgress = Array.isArray(order.sku_progress) ? order.sku_progress : [];

  if (skuProgress.length > 0) {
    const entries = skuProgress.map((progress, idx) => ({
      key: `${progress.product_id}-${idx}`,
      label: progress.product_name || getProductLabel(progress.product_id),
      required: progress.required_qty,
      completed: progress.completed_qty,
      shortage: progress.shortage_qty || 0,
      unit: progress.unit || order.unit || 'pcs',
      status: (progress.status || '').toLowerCase() === 'ready' ? 'ready' : (progress.status || '').toLowerCase() === 'queued' ? 'queued' : 'in_progress',
      assignedTeam: progress.assigned_team,
      lastUpdated: progress.last_updated,
    })) as SkuDisplayEntry[];
    return { entries, hasRealtime: true };
  }

  const entries: SkuDisplayEntry[] = fallbackLines.map((line, idx) => ({
    key: `${line.productId}-${idx}`,
    label: getProductLabel(line.productId),
    required: parseFloat(line.quantity || '0') || 0,
    completed: 0,
    shortage: 0,
    unit: order.unit || 'pcs',
    status: idx === 0 ? 'ready' : idx === 1 ? 'in_progress' : 'queued',
    assignedTeam: undefined,
    lastUpdated: undefined,
  }));

  return { entries, hasRealtime: false };
};

export const resolveStageTimeline = (order: PurchaseOrder, overallProgress?: number): StageProgress[] => {
  if (Array.isArray(order.stage_progress) && order.stage_progress.length > 0) {
    return order.stage_progress;
  }

  const inferredProgress = overallProgress ?? (order as any).progress ?? 0;
  return DEFAULT_STAGE_SEQUENCE.map((stageName, idx): StageProgress => {
    if (idx < 2) {
      return { stage_name: stageName, progress: 100, status: 'complete' };
    }
    if (idx === 2) {
      return { stage_name: stageName, progress: inferredProgress, status: inferredProgress >= 100 ? 'complete' : inferredProgress > 0 ? 'in_progress' : 'pending' };
    }
    return { stage_name: stageName, progress: 0, status: 'pending' };
  });
};

export const getDispatchEta = (stageTimeline: StageProgress[], fallbackDueDate: string) => {
  const dispatchStage = stageTimeline.find((stage) => stage.stage_name.toLowerCase().includes('dispatch'));
  return dispatchStage?.completed_at || dispatchStage?.started_at || fallbackDueDate;
};

export const summarizeCompletedUnits = (skuProgress?: SkuProgressSummary[]) => {
  if (!skuProgress || skuProgress.length === 0) return 0;
  return skuProgress.reduce((sum, entry) => sum + (entry.completed_qty || 0), 0);
};

export type NormalizedShortage = {
  key: string;
  productName: string;
  shortageQty: number;
  unit: string;
  severityLabel: string;
  note?: string;
  etaDate?: string;
};

export const mapPendingShortages = (
  shortages: SkuShortageSummary[] | undefined,
  getProductLabel: (productId: string) => string,
  language: 'en' | 'hi',
  fallbackUnit?: string,
): NormalizedShortage[] => {
  if (!Array.isArray(shortages) || shortages.length === 0) return [];

  return shortages.map((shortage, idx) => ({
    key: `${shortage.product_id}-${idx}`,
    productName: shortage.product_name || getProductLabel(shortage.product_id),
    shortageQty: shortage.shortage_qty,
    unit: shortage.unit || fallbackUnit || 'pcs',
    severityLabel: shortage.severity || (language === 'hi' ? 'कमी' : 'Shortage'),
    note: shortage.note,
    etaDate: shortage.eta_date,
  }));
};

export const getSkuHelperText = (language: string, hasRealtime: boolean) => {
  if (hasRealtime) {
    return language === 'hi'
      ? 'यह डेटा सीधे वर्किंग ऑर्डर प्रगति से जुड़ा है।'
      : 'Live data synced from working-order updates.';
  }
  return language === 'hi'
    ? 'वर्किंग ऑर्डर अपडेट होने पर प्रत्येक SKU लाइन की स्थिति यहीं दिखेगी।'
    : 'Once working orders report progress, each SKU line will surface its status here.';
};

export type StatusMeta = {
  badge: string;
  label: string;
  isComplete: boolean;
};

export const getStatusMeta = (status: string | undefined, progressValue: number | undefined, language: 'en' | 'hi'): StatusMeta => {
  const safeStatus = (status || '').toLowerCase();
  const complete = safeStatus === 'complete' || (progressValue !== undefined && progressValue >= 100);
  const inProgress = safeStatus === 'in_progress' || safeStatus === 'active' || (progressValue !== undefined && progressValue > 0 && progressValue < 100);

  if (complete) {
    return { badge: 'bg-emerald-500', label: language === 'hi' ? 'पूर्ण' : 'Complete', isComplete: true };
  }

  if (inProgress) {
    return { badge: 'bg-blue-500', label: language === 'hi' ? 'प्रगति में' : 'In Progress', isComplete: false };
  }

  return { badge: 'bg-zinc-400', label: language === 'hi' ? 'लंबित' : 'Pending', isComplete: false };
};
