import {
  Eye, Edit, FileText, QrCode, Star, Trash2, Printer, Clock,
  Users, MessageSquare, Send, Calendar, Package,
  Share2, Archive, BarChart3, XCircle, ClipboardList, MoreVertical
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
  | 'cancel' | 'delete' | 'createWorkingOrder';

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-56 max-h-[300px] overflow-y-auto bg-white dark:bg-zinc-950 z-[100] border border-zinc-200 dark:border-zinc-800 shadow-lg" collisionPadding={16}>
        <DropdownMenuItem onClick={() => handleAction('view')}>
          <Eye className="h-4 w-4 mr-2 text-zinc-500" />
          {t.viewDetails}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('edit')}>
          <Edit className="h-4 w-4 mr-2 text-zinc-500" />
          {t.editOrder}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('duplicate')}>
          <FileText className="h-4 w-4 mr-2 text-zinc-500" />
          {t.duplicateOrder}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('print')}>
          <Printer className="h-4 w-4 mr-2 text-zinc-500" />
          {t.printOrder}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleAction('trackProgress')}>
          <Clock className="h-4 w-4 mr-2 text-zinc-500" />
          {t.trackProgress}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('productionPlan')}>
          <Clock className="h-4 w-4 mr-2 text-zinc-500" />
          {t.productionPlan}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('assignTeam')}>
          <Users className="h-4 w-4 mr-2 text-zinc-500" />
          {t.assignTeam}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleAction('createWorkingOrder')}
          className="text-emerald-700 focus:text-emerald-800 focus:bg-emerald-50"
        >
          <ClipboardList className="h-4 w-4 mr-2 text-emerald-600" />
          {t.createWorkingOrder}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('addNotes')}>
          <MessageSquare className="h-4 w-4 mr-2 text-zinc-500" />
          {t.addNotes}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleAction('downloadBOM')}>
          <FileText className="h-4 w-4 mr-2 text-zinc-500" />
          {t.downloadBOM}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('exportExcel')}>
          <Package className="h-4 w-4 mr-2 text-zinc-500" />
          {t.exportExcel}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('generateQR')}>
          <QrCode className="h-4 w-4 mr-2 text-zinc-500" />
          {t.generateQR}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('sendToProduction')}>
          <Send className="h-4 w-4 mr-2 text-zinc-500" />
          {t.sendToProduction}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('requestMaterials')}>
          <Calendar className="h-4 w-4 mr-2 text-zinc-500" />
          {t.requestMaterials}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('reschedule')}>
          <Clock className="h-4 w-4 mr-2 text-zinc-500" />
          {t.reschedule}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('share')}>
          <Share2 className="h-4 w-4 mr-2 text-zinc-500" />
          {t.shareOrder}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('viewHistory')}>
          <BarChart3 className="h-4 w-4 mr-2 text-zinc-500" />
          {t.viewHistory}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction('archive')}>
          <Archive className="h-4 w-4 mr-2 text-zinc-500" />
          {t.archiveOrder}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleAction('priority')}
          className="text-amber-600 focus:text-amber-700 focus:bg-amber-50"
        >
          <Star className="h-4 w-4 mr-2" />
          {t.markPriority}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleAction('cancel')}
          className="text-orange-600 focus:text-orange-700 focus:bg-orange-50"
        >
          <XCircle className="h-4 w-4 mr-2" />
          {t.cancelOrder}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleAction('delete')}
          className="text-red-600 focus:text-red-700 focus:bg-red-50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {t.deleteOrder}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
