import { 
  Eye, Edit, FileText, QrCode, Star, Trash2, Printer, Clock, 
  Users, MessageSquare, Send, Calendar, Package, 
  Share2, Archive, BarChart3, XCircle, ClipboardList 
} from 'lucide-react';

type OrderAction = 
  | 'view' | 'edit' | 'duplicate' | 'print' | 'trackProgress' 
  | 'productionPlan' | 'assignTeam' | 'addNotes' | 'downloadBOM' 
  | 'exportExcel' | 'generateQR' | 'sendToProduction' | 'requestMaterials' 
  | 'reschedule' | 'share' | 'viewHistory' | 'archive' | 'priority' 
  | 'cancel' | 'delete' | 'createWorkingOrder';

interface OrderActionsDropdownProps {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: OrderAction, orderId: string) => void;
  translations: {
    viewDetails: string;
    editOrder: string;
    duplicateOrder: string;
    printOrder: string;
    trackProgress: string;
    productionPlan: string;
    assignTeam: string;
    addNotes: string;
    downloadBOM: string;
    exportExcel: string;
    generateQR: string;
    sendToProduction: string;
    requestMaterials: string;
    reschedule: string;
    shareOrder: string;
    viewHistory: string;
    archiveOrder: string;
    markPriority: string;
    cancelOrder: string;
    deleteOrder: string;
    createWorkingOrder: string;
  };
}

export function OrderActionsDropdown({ 
  orderId, 
  isOpen, 
  onClose, 
  onAction, 
  translations: t 
}: OrderActionsDropdownProps) {
  if (!isOpen) return null;

  const handleAction = (action: OrderAction) => {
    onAction(action, orderId);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-40">
        <button
          onClick={() => handleAction('view')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <Eye className="h-4 w-4 text-zinc-500" />
          {t.viewDetails}
        </button>
        
        <button
          onClick={() => handleAction('edit')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <Edit className="h-4 w-4 text-zinc-500" />
          {t.editOrder}
        </button>
        
        <button
          onClick={() => handleAction('duplicate')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <FileText className="h-4 w-4 text-zinc-500" />
          {t.duplicateOrder}
        </button>
        
        <button
          onClick={() => handleAction('print')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <Printer className="h-4 w-4 text-zinc-500" />
          {t.printOrder}
        </button>

        <div className="border-t border-zinc-200 my-1" />
        
        <button
          onClick={() => handleAction('trackProgress')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <Clock className="h-4 w-4 text-zinc-500" />
          {t.trackProgress}
        </button>
        
        <button
          onClick={() => handleAction('productionPlan')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <Clock className="h-4 w-4 text-zinc-500" />
          {t.productionPlan}
        </button>
        
        <button
          onClick={() => handleAction('assignTeam')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <Users className="h-4 w-4 text-zinc-500" />
          {t.assignTeam}
        </button>
        
        <button
          onClick={() => handleAction('createWorkingOrder')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-emerald-50 flex items-center gap-3 text-emerald-700"
        >
          <ClipboardList className="h-4 w-4 text-emerald-600" />
          {t.createWorkingOrder}
        </button>
        
        <button
          onClick={() => handleAction('addNotes')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <MessageSquare className="h-4 w-4 text-zinc-500" />
          {t.addNotes}
        </button>

        <div className="border-t border-zinc-200 my-1" />
        
        <button
          onClick={() => handleAction('downloadBOM')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <FileText className="h-4 w-4 text-zinc-500" />
          {t.downloadBOM}
        </button>
        
        <button
          onClick={() => handleAction('exportExcel')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <Package className="h-4 w-4 text-zinc-500" />
          {t.exportExcel}
        </button>
        
        <button
          onClick={() => handleAction('generateQR')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <QrCode className="h-4 w-4 text-zinc-500" />
          {t.generateQR}
        </button>
        
        <button
          onClick={() => handleAction('sendToProduction')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <Send className="h-4 w-4 text-zinc-500" />
          {t.sendToProduction}
        </button>
        
        <button
          onClick={() => handleAction('requestMaterials')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <Calendar className="h-4 w-4 text-zinc-500" />
          {t.requestMaterials}
        </button>
        
        <button
          onClick={() => handleAction('reschedule')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <Clock className="h-4 w-4 text-zinc-500" />
          {t.reschedule}
        </button>
        
        <button
          onClick={() => handleAction('share')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <Share2 className="h-4 w-4 text-zinc-500" />
          {t.shareOrder}
        </button>
        
        <button
          onClick={() => handleAction('viewHistory')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <BarChart3 className="h-4 w-4 text-zinc-500" />
          {t.viewHistory}
        </button>
        
        <button
          onClick={() => handleAction('archive')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700"
        >
          <Archive className="h-4 w-4 text-zinc-500" />
          {t.archiveOrder}
        </button>

        <div className="border-t border-zinc-200 my-1" />
        
        <button
          onClick={() => handleAction('priority')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-amber-600"
        >
          <Star className="h-4 w-4" />
          {t.markPriority}
        </button>
        
        <button
          onClick={() => handleAction('cancel')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-orange-600"
        >
          <XCircle className="h-4 w-4" />
          {t.cancelOrder}
        </button>
        
        <button
          onClick={() => handleAction('delete')}
          className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-3 text-red-600"
        >
          <Trash2 className="h-4 w-4" />
          {t.deleteOrder}
        </button>
      </div>
    </>
  );
}
