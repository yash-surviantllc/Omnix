import { createPortal } from "react-dom";
import { Button } from "./button";
import { AlertTriangle } from "lucide-react";

type DeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Are you sure you want to delete this?",
  description = "This action cannot be undone. This will permanently remove the data.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
}: DeleteConfirmDialogProps) {
  if (!open) return null;

  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm transition-all duration-200"
      style={{ zIndex: 100000 }}
      onClick={() => onOpenChange(false)}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ zIndex: 100001 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10 shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-zinc-900 leading-none tracking-tight">{title}</h2>
              <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-zinc-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-between gap-3 border-t border-zinc-100">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto font-medium"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="w-full sm:w-auto bg-red-600 text-white hover:bg-red-700 focus:ring-4 focus:ring-red-100 font-medium transition-all"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
