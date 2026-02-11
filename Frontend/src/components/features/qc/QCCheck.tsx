// QC Check Component - Figma Design 2-Column Layout
import React, { useState, useEffect, useRef } from 'react';
import {
  Search, QrCode, Upload, TrendingUp,
  ChevronRight, CheckCircle2, AlertTriangle, XCircle,
  Camera, FileText, Download, Zap, AlertCircle, ShieldAlert, Wrench
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';
import { qcApi, QCInspection } from '@/lib/api/qc';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { wipApi } from '@/lib/api/wip';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

// --- Types ---
interface DefectCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  defects: { name: string; type: 'Rework' | 'Scrap' }[];
}

interface SelectedDefect {
  id: string;
  category: string;
  name: string;
  quantity: number;
  type: 'Rework' | 'Scrap';
}

interface LookupResult {
  id: string;
  number: string;
  product_name: string;
  type: 'PO' | 'WO';
  full_data: any;
}

// --- Constants ---
const DEFECT_LIBRARY: DefectCategory[] = [
  {
    id: 'cracks',
    name: 'Cracks',
    description: 'Structural integrity issues',
    icon: <Zap className="w-5 h-5 text-slate-600" />,
    defects: [
      { name: 'Surface Crack', type: 'Rework' },
      { name: 'Deep Fracture', type: 'Scrap' },
      { name: 'Stress Line', type: 'Rework' }
    ]
  },
  {
    id: 'dimensions',
    name: 'Dimensions',
    description: 'Size and fit tolerances',
    icon: <Wrench className="w-5 h-5 text-slate-600" />,
    defects: [
      { name: 'Oversized', type: 'Rework' },
      { name: 'Undersized', type: 'Scrap' },
      { name: 'Warped', type: 'Scrap' }
    ]
  },
  {
    id: 'scratches',
    name: 'Scratches',
    description: 'Surface finish defects',
    icon: <ShieldAlert className="w-5 h-5 text-slate-600" />,
    defects: [
      { name: 'Micro Scratch', type: 'Rework' },
      { name: 'Deep Gouge', type: 'Scrap' },
      { name: 'Polishing Mark', type: 'Rework' }
    ]
  },
  {
    id: 'color',
    name: 'Color Defects',
    description: 'Visual consistency',
    icon: <AlertCircle className="w-5 h-5 text-slate-600" />,
    defects: [
      { name: 'Shade Mismatch', type: 'Rework' },
      { name: 'Discoloration', type: 'Scrap' },
      { name: 'Staining', type: 'Rework' }
    ]
  },
  {
    id: 'stitching',
    name: 'Stitching Issues',
    description: 'Seam and thread quality',
    icon: <CheckCircle2 className="w-5 h-5 text-slate-600" />,
    defects: [
      { name: 'Loose Thread', type: 'Rework' },
      { name: 'Skipped Stitch', type: 'Rework' },
      { name: 'Seam Rupture', type: 'Scrap' }
    ]
  }
];

export function QCCheck() {
  // --- State ---
  const [openSelect, setOpenSelect] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<LookupResult[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Inputs
  const [qtyToInspect, setQtyToInspect] = useState<number>(0);
  const [passQty, setPassQty] = useState<number>(0);
  const [reworkQty, setReworkQty] = useState<number>(0);
  const [scrapQty, setScrapQty] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [photoEvidence, setPhotoEvidence] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected Category for defect entry
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedDefects, setSelectedDefects] = useState<SelectedDefect[]>([]);

  // Data
  const [recentInspections, setRecentInspections] = useState<QCInspection[]>([]);
  const [yieldTrend, setYieldTrend] = useState<any[]>([]);

  // --- Effects ---
  useEffect(() => {
    fetchOrders();
    fetchHistory();
  }, []);

  const fetchOrders = async () => {
    try {
      // Fetch all orders without status filter to ensure we get data
      const [pos, wos] = await Promise.all([
        purchaseOrdersApi.listOrders({}), // Remove status filter to get all POs
        wipApi.listWorkingOrders({ status: 'In Progress' })
      ]);

      console.log('Fetched Purchase Orders:', pos);
      console.log('Fetched Working Orders:', wos);

      const combined: LookupResult[] = [
        ...pos.map((p: any) => ({ id: p.id, number: p.order_number, product_name: p.product_name, type: 'PO', full_data: p })),
        ...wos.map((w: any) => ({ id: w.id, number: w.work_order_number, product_name: w.product_name || 'Unspecified', type: 'WO', full_data: w }))
      ] as LookupResult[];

      console.log('Combined orders:', combined);
      setAvailableOrders(combined);
    } catch (e) {
      console.error('Error fetching orders:', e);
      toast.error("Failed to load Orders. Please check connection.");
    }
  };

  const fetchHistory = async () => {
    try {
      const [recents, trends] = await Promise.all([
        qcApi.getAll({ page: 1, limit: 5 }),
        qcApi.getTrends()
      ]);
      setRecentInspections(recents);
      setYieldTrend(trends);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load QC History.");
    }
  };

  const handleSelectOrder = (item: LookupResult) => {
    const target = item.full_data.quantity || item.full_data.target_qty || 0;
    const completed = item.full_data.completed_quantity || item.full_data.completed_qty || 0;
    setSelectedOrder({ ...item, target_qty: target, completed_qty: completed });
    setQtyToInspect(target - completed);
    setPassQty(target - completed);
    setReworkQty(0);
    setScrapQty(0);
    setOpenSelect(false);
    toast.success(`Selected ${item.number}`);
  };

  const handleAddDefect = (category: string, name: string, type: 'Rework' | 'Scrap') => {
    setSelectedDefects(prev => {
      const existing = prev.find(d => d.name === name && d.category === category);
      if (existing) {
        return prev.map(d => d.name === name && d.category === category ? { ...d, quantity: d.quantity + 1 } : d);
      }
      return [...prev, { id: Math.random().toString(36).substr(2, 9), category, name, quantity: 1, type }];
    });

    // Auto-increment the corresponding global counter
    if (type === 'Rework') setReworkQty(prev => prev + 1);
    if (type === 'Scrap') setScrapQty(prev => prev + 1);

    // Decrement pass qty if possible to keep total consistent
    setPassQty(prev => Math.max(0, prev - 1));
  };

  const handleRemoveDefect = (id: string) => {
    setSelectedDefects(prev => prev.filter(d => d.id !== id));
  };

  const handleSubmit = async () => {
    if (!selectedOrder) return toast.error("Select an order first");

    try {
      setIsLoading(true);
      const payload = {
        purchase_order_id: selectedOrder.type === 'PO' ? selectedOrder.id : null,
        work_order_id: selectedOrder.type === 'WO' ? selectedOrder.id : null,
        product_id: selectedOrder.full_data.product_id,
        quantity_checked: passQty + reworkQty + scrapQty,
        passed_qty: passQty,
        rework_qty: reworkQty,
        scrap_qty: scrapQty,
        status: 'Completed' as const,
        notes,
        defects: selectedDefects.map(d => ({
          defect_type: d.type,
          reason: d.name,
          quantity: d.quantity
        }))
      };

      await qcApi.create(payload);
      toast.success("QC Record Submitted");

      // Reset
      setPassQty(0);
      setReworkQty(0);
      setScrapQty(0);
      setQtyToInspect(0);
      setSelectedOrder(null);
      setNotes('');
      setPhotoEvidence([]);
      setSelectedDefects([]);
      fetchHistory();
    } catch (e) {
      toast.error("Submission failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Manual File Input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPhotoEvidence(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  // --- Render Helpers ---

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] p-8 gap-8 font-sans text-slate-800 overflow-y-auto w-full">
      {/* Header Section */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">QC Check</h1>
          <p className="text-slate-500 font-medium text-sm mt-1">Quality Control Inspection & Defect Analysis</p>
        </div>

        {/* Filter Bar with Submit Button - All in ONE ROW */}
        <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-2">
          {/* 1. Search Orders */}
          <div className="relative w-[160px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search order number..."
              className="w-full h-12 rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 placeholder:text-slate-300 transition-all"
            />
          </div>

          {/* 2. Select Order Dropdown */}
          <div className="w-[200px]">
            <Popover open={openSelect} onOpenChange={setOpenSelect}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between h-12 rounded-full border-slate-200 bg-white text-slate-600 font-medium px-5 hover:bg-slate-50 hover:border-slate-300 transition-all">
                  {selectedOrder ? (
                    <div className="flex items-center gap-2 truncate">
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider", selectedOrder.type === 'PO' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
                        {selectedOrder.type}
                      </span>
                      <span className="font-bold text-slate-900 truncate">{selectedOrder.number}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400">Select Purchase / Work Order</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 rotate-90" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[340px] p-0 rounded-xl shadow-xl border-slate-100 mt-2" align="start">
                <Command>
                  <CommandInput placeholder="Search orders..." className="h-10 border-0 focus:ring-0" />
                  <CommandList>
                    <CommandEmpty>No results.</CommandEmpty>
                    <CommandGroup>
                      {availableOrders.map((order) => (
                        <CommandItem key={order.id} onSelect={() => handleSelectOrder(order)} className="py-3 px-4 cursor-pointer aria-selected:bg-emerald-50">
                          <div className="flex items-center gap-3 w-full">
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider min-w-[32px] text-center", order.type === 'PO' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
                              {order.type}
                            </span>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-bold text-slate-700 truncate">{order.number}</span>
                              <span className="text-xs text-slate-400 truncate">{order.product_name}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* 3. Work Order (Readonly) */}
          <div className="w-[120px] h-12 rounded-full border border-slate-100 bg-slate-50 px-3 flex items-center gap-1 text-xs">
            <span className="text-slate-400">WO:</span>
            {selectedOrder?.type === 'WO' ? (
              <span className="font-bold text-slate-700 truncate">{selectedOrder.number.slice(-4)}</span>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </div>

          {/* 4. Product (Readonly) */}
          <div className="w-[140px] h-12 rounded-full border border-slate-100 bg-slate-50 px-3 flex items-center gap-1 text-xs truncate">
            <span className="text-slate-400">Prod:</span>
            {selectedOrder ? (
              <span className="font-bold text-slate-700 truncate">{selectedOrder.product_name}</span>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </div>

          {/* 5. Scan QR Button */}
          <Button variant="outline" className="h-12 px-5 rounded-full border-emerald-400 text-emerald-600 bg-white hover:bg-emerald-50 hover:border-emerald-500 font-bold gap-2 shadow-sm">
            <QrCode className="w-4 h-4" />
            Scan QR
          </Button>

          {/* 6. Submit QC Button - INSIDE the header row */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedOrder || isLoading}
            className={cn(
              "h-12 px-6 rounded-full font-bold shadow-md transition-all text-sm",
              !selectedOrder || isLoading
                ? "bg-emerald-500/70 border-2 border-emerald-400/50 text-white cursor-not-allowed"
                : "bg-emerald-600 border-2 border-emerald-600 hover:bg-emerald-700 text-white"
            )}
          >
            {isLoading ? 'Submitting...' : 'Submit QC'}
          </Button>
        </div>
      </div>


      {/* Main Grid Content - 2 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 flex-1">

        {/* Left Column: Defect Library + Inspection Form */}
        <div className="flex flex-col gap-6">

          {/* Defect Library */}
          <div>
            <h3 className="flex items-center gap-2 font-bold text-slate-600 mb-5">
              <AlertTriangle className="w-5 h-5 text-orange-500" /> Defect Library
            </h3>

            <div className="flex flex-col gap-3">{DEFECT_LIBRARY.map((cat) => (
              <div key={cat.id} className="group">
                <button
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  className={cn(
                    "w-full bg-white rounded-xl p-3 flex items-center justify-between border-2 transition-all shadow-sm",
                    activeCategory === cat.id ? "border-emerald-400 ring-2 ring-emerald-500/10" : "border-transparent hover:border-slate-200"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Custom Icons for Library Categories */}
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                      activeCategory === cat.id ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-700"
                    )}>
                      {cat.icon}
                    </div>
                    <span className="font-bold text-slate-700">{cat.name}</span>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 text-slate-300 transition-transform", activeCategory === cat.id ? "rotate-90 text-emerald-500" : "")} />
                </button>

                {/* Expanded List */}
                {activeCategory === cat.id && (
                  <div className="mt-2 ml-4 pl-4 border-l-2 border-slate-100 space-y-2 animate-in slide-in-from-top-2">
                    {cat.defects.map((d, i) => (
                      <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:border-emerald-200 group/item cursor-pointer"
                        onClick={() => handleAddDefect(cat.name, d.name, d.type)}>
                        <span className="text-sm font-semibold text-slate-600">{d.name}</span>
                        <div className={cn("w-2 h-2 rounded-full", d.type === 'Scrap' ? "bg-rose-500" : "bg-amber-400")} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            </div>
          </div>

          {/* Inspection Form */}

          {/* Main Card */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 text-lg mb-8">Inspection Result</h3>

            {/* Quantity Input */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-slate-500 mb-3">Quantity to Inspect</label>
              <input
                type="number"
                value={qtyToInspect}
                onChange={(e) => setQtyToInspect(Number(e.target.value))}
                className="w-full h-12 rounded-full border border-slate-200 bg-white px-6 text-xl font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-left"
              />
            </div>

            {/* 3 Col Inputs: Pass / Rework / Scrap */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {/* Pass - Green */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-emerald-600 pl-2">Pass</label>
                <div className="relative">
                  <input
                    type="number"
                    value={passQty}
                    onChange={(e) => setPassQty(Number(e.target.value))}
                    className="w-full h-14 rounded-full border-2 border-emerald-200 bg-emerald-100 text-emerald-800 font-bold text-xl text-center focus:border-emerald-500 outline-none transition-all placeholder:text-emerald-300"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
              </div>

              {/* Rework - Yellow */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-amber-500 pl-2">Rework</label>
                <div className="relative">
                  <input
                    type="number"
                    value={reworkQty}
                    onChange={(e) => setReworkQty(Number(e.target.value))}
                    className="w-full h-14 rounded-full border-2 border-amber-200 bg-amber-100 text-amber-800 font-bold text-xl text-center focus:border-amber-500 outline-none transition-all placeholder:text-amber-300"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                </div>
              </div>

              {/* Scrap - Red */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-rose-500 pl-2">Scrap</label>
                <div className="relative">
                  <input
                    type="number"
                    value={scrapQty}
                    onChange={(e) => setScrapQty(Number(e.target.value))}
                    className="w-full h-14 rounded-full border-2 border-rose-200 bg-rose-100 text-rose-800 font-bold text-xl text-center focus:border-rose-500 outline-none transition-all placeholder:text-rose-300"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <XCircle className="w-5 h-5 text-rose-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Defects Chips */}
            {selectedDefects.length > 0 && (
              <div className="mb-8 bg-slate-50 rounded-xl p-5 border border-slate-100">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Logged Defects</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedDefects.map((def) => (
                    <div key={def.id} className="flex items-center gap-3 bg-white pl-3 pr-2 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <span className={cn("w-2 h-2 rounded-full", def.type === 'Scrap' ? "bg-rose-500" : "bg-amber-500")} />
                      <div className="flex flex-col leading-none">
                        <span className="text-xs font-bold text-slate-700">{def.name}</span>
                        <span className="text-slate-400 text-[10px] mt-0.5">{def.category}</span>
                      </div>
                      <div className="h-4 w-px bg-slate-100 mx-1" />
                      <span className="text-xs font-bold text-slate-800">x{def.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-rose-50 hover:text-rose-500 ml-1 rounded-md" onClick={() => handleRemoveDefect(def.id)}>
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Photo Evidence Card */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <h3 className="flex items-center gap-2 font-bold text-slate-700 mb-6">
              <Camera className="w-5 h-5 text-[#3b82f6]" /> Photo Evidence
            </h3>

            <div
              className="border-2 border-dashed border-slate-200 rounded-3xl min-h-[140px] flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-600">Drag & drop or click to upload</p>
                <p className="text-xs text-slate-400 font-medium mt-1">PNG, JPG up to 10MB</p>
              </div>
            </div>

            {/* Preview Chips */}
            {photoEvidence.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {photoEvidence.map((f, i) => (
                  <div key={i} className="px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-600 flex items-center gap-2">
                    <FileText className="w-3 h-3" /> {f.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes Card */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4">Notes</h3>
            <textarea
              className="w-full h-28 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-600 resize-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none"
              placeholder="Add inspection notes, defect details, or recommendations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>


        </div>

        {/* Right Column: Analytics */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-slate-700">
              <TrendingUp className="w-5 h-5 text-emerald-500" /> Live Analytics
            </h3>
            <Button variant="outline" size="sm" className="h-8 rounded-full border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50">
              <Download className="w-3 h-3 mr-2" /> Export Report
            </Button>
          </div>

          {/* Inspection Cards */}
          <div className="flex flex-col gap-5">
            {recentInspections.length === 0 && (
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {/* Pass Donut */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-16 h-16">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="#d1fae5" strokeWidth="6" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-base font-bold text-emerald-600">0%</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600">Pass</span>
                  </div>

                  {/* Rework Donut */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-16 h-16">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="#fef3c7" strokeWidth="6" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-base font-bold text-amber-600">0%</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-600">Rework</span>
                  </div>

                  {/* Scrap Donut */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-16 h-16">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="#fee2e2" strokeWidth="6" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-base font-bold text-rose-600">0%</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-rose-600">Scrap</span>
                  </div>
                </div>
                <p className="text-center text-xs text-slate-400 font-medium">No recent inspections</p>
              </div>
            )}

            {recentInspections.slice(0, 3).map((insp, i) => {
              const pass = Number(insp.passed_qty || 0);
              const rework = Number(insp.rework_qty || 0);
              const scrap = Number(insp.scrap_qty || 0);
              const total = pass + rework + scrap;

              return (
                <Card key={i} className="border-0 shadow-sm rounded-[2rem] overflow-hidden bg-white">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h4 className="font-bold text-lg text-slate-800">{insp.purchase_order_number || insp.work_order_number}</h4>
                        <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wide">{insp.product_name}</p>
                      </div>
                      {/* Donut Chart */}
                      <div className="relative w-16 h-16">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                          {total > 0 && (
                            <>
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="6"
                                strokeDasharray={`${(pass / total) * 175.93} 175.93`}
                                strokeLinecap="round"
                              />
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="6"
                                strokeDasharray={`${(rework / total) * 175.93} 175.93`}
                                strokeDashoffset={`-${(pass / total) * 175.93}`}
                                strokeLinecap="round"
                              />
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="6"
                                strokeDasharray={`${(scrap / total) * 175.93} 175.93`}
                                strokeDashoffset={`-${((pass + rework) / total) * 175.93}`}
                                strokeLinecap="round"
                              />
                            </>
                          )}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-slate-700">{total > 0 ? Math.round((pass / total) * 100) : 0}%</span>
                        </div>
                      </div>
                    </div>

                    {/* 3 Colored Boxes */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-emerald-50 rounded-lg p-2 text-center">
                        <div className="text-[9px] font-black text-emerald-600 uppercase mb-0.5">Pass %</div>
                        <div className="text-sm font-bold text-emerald-800">{total > 0 ? Math.round((pass / total) * 100) : 0}%</div>
                      </div>
                      <div className="bg-[#fffbeb] rounded-lg p-2 text-center">
                        <div className="text-[9px] font-black text-amber-500 uppercase mb-0.5">Rework %</div>
                        <div className="text-sm font-bold text-amber-700">{total > 0 ? Math.round((rework / total) * 100) : 0}%</div>
                      </div>
                      <div className="bg-rose-50 rounded-lg p-2 text-center">
                        <div className="text-[9px] font-black text-rose-500 uppercase mb-0.5">Scrap %</div>
                        <div className="text-sm font-bold text-rose-700">{total > 0 ? Math.round((scrap / total) * 100) : 0}%</div>
                      </div>
                    </div>

                    {/* Trend Line (Sparkline Mock) */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">Trend:</span>
                      <div className="h-6 w-24">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={[{ v: 10 }, { v: 15 }, { v: 12 }, { v: 20 }, { v: 18 }, { v: 25 }, { v: 22 }]}>
                            <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} fill="none" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* 7-Day Yield Trend */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex-1 min-h-[220px] flex flex-col">
            <h4 className="font-bold text-slate-700 mb-4 text-sm">7-Day Yield Trend</h4>

            {/* Y-Axis percentage labels */}
            {yieldTrend.length > 0 && (
              <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                {yieldTrend.map((d, i) => (
                  <span key={i}>{d.yield}%</span>
                ))}
              </div>
            )}

            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yieldTrend}>
                  <defs>
                    <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="yield" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorYield)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* X-Axis labels mock */}
            <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-2 uppercase">
              <span>D1</span><span>D2</span><span>D3</span><span>D4</span><span>D5</span><span>D6</span><span>TD</span>
            </div>
          </div>
        </div>

      </div>

      {/* CSS for number inputs */}
      <style dangerouslySetInnerHTML={{
        __html: `
            input[type=number]::-webkit-inner-spin-button, 
            input[type=number]::-webkit-outer-spin-button { 
                 -webkit-appearance: none; 
                 margin: 0; 
            }
        `
      }} />
    </div >
  );
}
