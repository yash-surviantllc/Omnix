// Auth
export { Login } from './auth/Login';

// Dashboard
export { Dashboard } from './dashboard/Dashboard';

// BOM
export { BOMPlanner } from './bom/BOMPlanner';
export { ProductSelector } from './bom/components/ProductSelector';
export { StockCheckSummary } from './bom/components/StockCheckSummary';
export { BOMTableRow } from './bom/components/BOMTableRow';

// Chat
export { ChatBot } from './chat/ChatBot';
export { ChatMessage } from './chat/components/ChatMessage';
export { QuickActions } from './chat/components/QuickActions';
export { ChatInput } from './chat/components/ChatInput';

// Gate
export { GateEntry } from './gate/GateEntry';
export { GateExit } from './gate/GateExit';

// Inventory
export { Inventory } from './inventory/Inventory';

// Materials
export { MaterialRequest } from './materials/MaterialRequest';
export { MaterialTransfer } from './materials/MaterialTransfer';
export { MaterialCard } from './materials/components/MaterialCard';
export { TransferModal } from './materials/components/TransferModal';
export { TransferHistoryTable } from './materials/components/TransferHistoryTable';

// Orders
export { PurchaseOrders } from './orders/PurchaseOrders';
export { WorkingOrder } from './orders/WorkingOrder';
export { WIPBoard } from './orders/WIPBoard';
export { OrderActionsDropdown } from './orders/components/OrderActionsDropdown';
export { NewOrderModal } from './orders/components/NewOrderModal';

// Profile
export { UserProfile } from './profile/UserProfile';
export type { UserData } from './profile/UserProfile';

// QC
export { QCCheck } from './qc/QCCheck';

// Settings
export { Settings } from './settings/Settings';
