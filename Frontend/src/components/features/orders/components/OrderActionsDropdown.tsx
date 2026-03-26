import {
  Eye, Edit, FileText, QrCode, Star, Trash2, Printer, Clock,
  Users, MessageSquare, Send, Calendar, Package,
  Share2, Archive, BarChart3, XCircle, ClipboardList, MoreVertical, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type OrderAction =
  | 'view' | 'edit' | 'duplicate' | 'print' | 'trackProgress'
  | 'productionPlan' | 'assignTeam' | 'addNotes' | 'downloadBOM'
  | 'exportExcel' | 'generateQR' | 'sendToProduction' | 'requestMaterials'
  | 'reschedule' | 'share' | 'viewHistory' | 'archive' | 'priority'
  | 'cancel' | 'delete' | 'createWorkingOrder' | 'markComplete';

interface OrderActionsDropdownProps {
  orderId: string;
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
    markComplete: string;
  };
}

export function OrderActionsDropdown({
  orderId,
  onAction,
  translations: t
}: OrderActionsDropdownProps) {

  const handleAction = (action: OrderAction) => {
    onAction(action, orderId);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 bg-white dark:bg-zinc-950 z-50 border border-zinc-200 dark:border-zinc-800 shadow-xl !max-h-[300px] !overflow-y-auto"
        style={{ maxHeight: '300px', overflowY: 'auto' }}
        collisionPadding={20}
      >
        <DropdownMenuItem onClick={() => handleAction('view')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 transition-colors duration-200 outline-none" style={{ cursor: 'pointer' }}>
          <Eye className="h-4 w-4 mr-2 text-zinc-500" />
          {t.viewDetails}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('edit')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 transition-colors duration-200 outline-none" style={{ cursor: 'pointer' }}>
          <Edit className="h-4 w-4 mr-2 text-zinc-500" />
          {t.editOrder}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('duplicate')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 transition-colors duration-200 outline-none" style={{ cursor: 'pointer' }}>
          <FileText className="h-4 w-4 mr-2 text-zinc-500" />
          {t.duplicateOrder}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('print')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 transition-colors duration-200 outline-none" style={{ cursor: 'pointer' }}>
          <Printer className="h-4 w-4 mr-2 text-zinc-500" />
          {t.printOrder}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleAction('trackProgress')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <Clock className="h-4 w-4 mr-2 text-zinc-500" />
          {t.trackProgress}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('productionPlan')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <Clock className="h-4 w-4 mr-2 text-zinc-500" />
          {t.productionPlan}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('assignTeam')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <Users className="h-4 w-4 mr-2 text-zinc-500" />
          {t.assignTeam}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleAction('createWorkingOrder')}
          className="!cursor-pointer text-emerald-700 hover:!bg-emerald-50 focus:!bg-emerald-50 data-[highlighted]:!bg-emerald-50 focus:text-emerald-800 outline-none"
          style={{ cursor: 'pointer' }}
        >
          <ClipboardList className="h-4 w-4 mr-2 text-emerald-600" />
          {t.createWorkingOrder}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('addNotes')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <MessageSquare className="h-4 w-4 mr-2 text-zinc-500" />
          {t.addNotes}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleAction('downloadBOM')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <FileText className="h-4 w-4 mr-2 text-zinc-500" />
          {t.downloadBOM}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('exportExcel')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <Package className="h-4 w-4 mr-2 text-zinc-500" />
          {t.exportExcel}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('generateQR')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <QrCode className="h-4 w-4 mr-2 text-zinc-500" />
          {t.generateQR}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('sendToProduction')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <Send className="h-4 w-4 mr-2 text-zinc-500" />
          {t.sendToProduction}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('requestMaterials')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <Calendar className="h-4 w-4 mr-2 text-zinc-500" />
          {t.requestMaterials}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('reschedule')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <Clock className="h-4 w-4 mr-2 text-zinc-500" />
          {t.reschedule}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('share')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <Share2 className="h-4 w-4 mr-2 text-zinc-500" />
          {t.shareOrder}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('viewHistory')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <BarChart3 className="h-4 w-4 mr-2 text-zinc-500" />
          {t.viewHistory}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('archive')} className="!cursor-pointer hover:!bg-zinc-100 focus:!bg-zinc-100 data-[highlighted]:!bg-zinc-100 dark:hover:!bg-zinc-800 dark:focus:!bg-zinc-800 dark:data-[highlighted]:!bg-zinc-800 outline-none" style={{ cursor: 'pointer' }}>
          <Archive className="h-4 w-4 mr-2 text-zinc-500" />
          {t.archiveOrder}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleAction('priority')}
          className="!cursor-pointer text-amber-600 hover:!bg-amber-50 focus:!bg-amber-50 data-[highlighted]:!bg-amber-50 focus:text-amber-700 outline-none"
          style={{ cursor: 'pointer' }}
        >
          <Star className="h-4 w-4 mr-2" />
          {t.markPriority}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleAction('markComplete')}
          className="!cursor-pointer text-green-600 hover:!bg-green-50 focus:!bg-green-50 data-[highlighted]:!bg-green-50 focus:text-green-700 outline-none"
          style={{ cursor: 'pointer' }}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          {t.markComplete}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleAction('cancel')}
          className="!cursor-pointer text-orange-600 hover:!bg-orange-50 focus:!bg-orange-50 data-[highlighted]:!bg-orange-50 focus:text-orange-700 outline-none"
          style={{ cursor: 'pointer' }}
        >
          <XCircle className="h-4 w-4 mr-2" />
          {t.cancelOrder}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleAction('delete')}
          className="!cursor-pointer text-red-600 hover:!bg-red-50 focus:!bg-red-50 data-[highlighted]:!bg-red-50 focus:text-red-700 outline-none"
          style={{ cursor: 'pointer' }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {t.deleteOrder}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
