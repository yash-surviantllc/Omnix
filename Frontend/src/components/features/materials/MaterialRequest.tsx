import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle, CheckCircle, XCircle, Send, History, Plus, X, Clock } from 'lucide-react';
import { MaterialRequestProcessor, MaterialRequest } from '@/lib/material-request-processor';
import { INVENTORY_STOCK } from '@/lib/apparel-data';

type MaterialRequestProps = {
  language: string;
};

export function MaterialRequest({ language }: MaterialRequestProps) {
  const [requestText, setRequestText] = useState('');
  const [result, setResult] = useState<MaterialRequest | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  
  // Form data state
  const [formData, setFormData] = useState({
    formNumber: '',
    dateOfRequest: '',
    department: '',
    requestedBy: '',
    reviewedBy: '',
    approvedBy: '',
    shiftNumber: 'Shift 1',
    startTime: '',
    endTime: '',
    deliveryInstructions: ''
  });
  
  // Material items state
  const [materialItems, setMaterialItems] = useState([
    {
      itemCode: '',
      materialDescription: '',
      unitOfMeasure: '',
      quantity: '',
      requiredDate: '',
      location: '',
      priority: 'Normal'
    }
  ]);

  // Simulated request history
  const [requestHistory] = useState([
    {
      id: 'MR-1733001',
      department: 'Cutting Floor',
      material: 'Cotton Fabric',
      quantity: '50 kg',
      status: 'completed',
      date: '2025-11-30'
    },
    {
      id: 'MR-1733002',
      department: 'Sewing Floor',
      material: 'Thread (White)',
      quantity: '5000 m',
      status: 'approved',
      date: '2025-11-30'
    },
    {
      id: 'MR-1733003',
      department: 'QC Floor',
      material: 'Chemical',
      quantity: '5 litres',
      status: 'pending',
      date: '2025-12-01'
    }
  ]);

  const translations = {
    en: {
      title: 'Material Request',
      subtitle: 'Create and track material requests across all departments',
      newRequest: 'New Request',
      history: 'Request History',
      quickRequest: 'Quick Request (Natural Language)',
      formalRequest: '+ New Material Requisition Form',
      materialRequisitionForm: 'Material Requisition Form',
      companyName: 'Company Name',
      formNumber: 'Form Number/ID',
      dateOfRequest: 'Date of Request',
      requestedBy: 'Requested By',
      reviewedBy: 'Reviewed By',
      approvedBy: 'Approved By',
      itemCode: 'Item Code',
      materialDescription: 'Material Description',
      unitOfMeasure: 'Unit of Measure',
      requiredDate: 'Required Date',
      location: 'Location',
      priority: 'Priority',
      supplierVendor: 'Supplier / Vendor',
      deliveryInstructions: 'Delivery Instructions',
      addItem: '+ Add Item',
      removeItem: 'Remove',
      submitForm: 'Submit Requisition',
      cancel: 'Cancel',
      shiftNumber: 'Shift Number',
      shift1: 'Shift 1 (6 AM - 2 PM)',
      shift2: 'Shift 2 (2 PM - 10 PM)',
      shift3: 'Shift 3 (10 PM - 6 AM)',
      productionTimeline: 'Production Timeline',
      startTime: 'Start Time',
      endTime: 'End Time',
      urgent: 'Urgent',
      high: 'High',
      normal: 'Normal',
      low: 'Low',
      placeholder: 'E.g., "Request 50 kg Cotton for Cutting" or "Cutting को 20 kg cotton भेज दो"',
      processRequest: 'Process Request',
      examples: 'Examples',
      quickActions: 'Quick Actions',
      requestId: 'Request ID',
      department: 'Department',
      material: 'Material',
      quantity: 'Quantity',
      status: 'Status',
      date: 'Date',
      viewDetails: 'View Details',
      urgency: 'Urgency',
      approvalRequired: 'Approval Required',
      nextSteps: 'Next Steps',
      warnings: 'Warnings',
      noRequests: 'No requests yet',
      createFirst: 'Create your first material request above'
    },
    hi: {
      title: 'सामग्री अनुरोध',
      subtitle: 'सभी विभागों में सामग्री अनुरोध बनाएं और ट्रैक करें',
      newRequest: 'नया अनुरोध',
      history: 'अनुरोध इतिहास',
      quickRequest: 'त्वरित अनुरोध (स्वाभाविक भाषा)',
      formalRequest: '+ नया सामग्री अनुरोध फॉर्म',
      materialRequisitionForm: 'सामग्री अनुरोध फॉर्म',
      companyName: 'कंपनी का नाम',
      formNumber: 'फॉर्म नंबर/आईडी',
      dateOfRequest: 'अनुरोध की तारीख',
      requestedBy: 'अनुरोध किया गया',
      reviewedBy: 'रिव्यू किया गया',
      approvedBy: 'स्वीकार किया गया',
      itemCode: 'आइटम कोड',
      materialDescription: 'सामग्री का विवरण',
      unitOfMeasure: 'मात्रा की इकाई',
      requiredDate: 'अपराधित तारीख',
      location: 'स्थान',
      priority: 'प्राथमिकता',
      supplierVendor: 'वित्रेक्षक / विक्रेता',
      deliveryInstructions: 'वित्रान निर्देश',
      addItem: '+ आइटम जोड़ें',
      removeItem: 'हटाएं',
      submitForm: 'अनुरोध जमा करें',
      cancel: 'रद्द करें',
      shiftNumber: 'शिफ्ट नंबर',
      shift1: 'शिफ्ट 1 (6 अंजीरी - 2 अपराह्न)',
      shift2: 'शिफ्ट 2 (2 अपराह्न - 10 रात्री)',
      shift3: 'शिफ्ट 3 (10 रात्री - 6 अंजीरी)',
      productionTimeline: 'उत्पादन समय रेखा',
      startTime: 'शुरुआत का समय',
      endTime: 'अंतिम समय',
      urgent: 'तत्कालिक',
      high: 'उच्च',
      normal: 'सामान्य',
      low: 'निम्न',
      placeholder: 'उदा., "कटिंग के लिए 50 किलो कपास का अनुरोध करें" या "Cutting को 20 kg cotton भेज दो"',
      processRequest: 'अनुरोध प्रक्रिया',
      examples: 'उदाहरण',
      quickActions: 'त्वरित क्रियाएं',
      requestId: 'अनुरोध ID',
      department: 'विभाग',
      material: 'सामग्री',
      quantity: 'मात्रा',
      status: 'स्थिति',
      date: 'तारीख',
      viewDetails: 'विवरण देखें',
      urgency: 'तात्कालिकता',
      approvalRequired: 'अनुमोदन आवश्यक',
      nextSteps: 'अगले कदम',
      warnings: 'चेतावनी',
      noRequests: 'अभी तक कोई अनुरोध नहीं',
      createFirst: 'ऊपर अपना पहला सामग्री अनुरोध बनाएं'
    }
  };

  const t = translations[language as keyof typeof translations] || translations.en;

  const exampleCommands = [
    { text: 'Request 50 kg Cotton Fabric for Cutting', lang: 'en' },
    { text: 'Cutting को 20 kg cotton भेज दो', lang: 'hi' },
    { text: 'QC needs 5 litres chemical urgent', lang: 'en' },
    { text: 'Stitching को 100 m thread चाहिए PO-1001 के लिए', lang: 'hi' },
    { text: 'Transfer 30 kg Fleece from RM Store A to Sewing', lang: 'en' },
    { text: 'Maintenance को urgent oil चाहिए', lang: 'hi' }
  ];

  const quickActions = [
    { dept: 'Cutting Floor', material: 'Cotton Fabric', qty: '50 kg' },
    { dept: 'Sewing Floor', material: 'Thread (White)', qty: '100 m' },
    { dept: 'QC Floor', material: 'Chemical', qty: '5 litres' },
    { dept: 'Packing Floor', material: 'Poly Bag', qty: '100 pcs' }
  ];

  const handleQuickAction = (dept: string, material: string, qty: string) => {
    const text = `Request ${qty} ${material} for ${dept}`;
    setRequestText(text);
    processRequest(text);
  };

  const processRequest = (text?: string) => {
    const requestText = text || requestText;
    if (!requestText.trim()) return;

    const request = MaterialRequestProcessor.processRequestAdvanced(requestText, language);
    setResult(request);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'validated':
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'partial_stock':
      case 'approved':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'insufficient_stock':
      case 'pending':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pending_clarification':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'validated':
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'partial_stock':
      case 'approved':
        return <AlertTriangle className="w-4 h-4" />;
      case 'insufficient_stock':
      case 'pending':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-zinc-900 mb-2">{t.title}</h1>
        <p className="text-zinc-600">{t.subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200">
        <button
          onClick={() => setShowHistory(false)}
          className={`px-4 py-2 border-b-2 transition-colors ${
            !showHistory
              ? 'border-emerald-600 text-emerald-900'
              : 'border-transparent text-zinc-600 hover:text-zinc-900'
          }`}
        >
          {t.newRequest}
        </button>
        <button
          onClick={() => setShowHistory(true)}
          className={`px-4 py-2 border-b-2 transition-colors ${
            showHistory
              ? 'border-emerald-600 text-emerald-900'
              : 'border-transparent text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            {t.history}
          </div>
        </button>
      </div>

      {!showHistory ? (
        <div className="space-y-6">
          {/* Formal Material Requisition Form Button */}
          <Button
            onClick={() => setShowFormModal(true)}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 text-base"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t.formalRequest}
          </Button>

          {/* Quick Request Form */}
          <Card className="p-6 border-2 border-emerald-200 bg-emerald-50">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-emerald-700" />
              <h2 className="text-emerald-900">{t.quickRequest}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Input
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                  placeholder={t.placeholder}
                  className="w-full text-base"
                  onKeyPress={(e) => e.key === 'Enter' && processRequest()}
                />
              </div>

              <Button
                onClick={() => processRequest()}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!requestText.trim()}
              >
                <Send className="w-4 h-4 mr-2" />
                {t.processRequest}
              </Button>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6">
            <h3 className="text-zinc-900 mb-4">{t.quickActions}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(action.dept, action.material, action.qty)}
                  className="p-4 border-2 border-zinc-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-zinc-900 mb-1">{action.material}</div>
                      <div className="text-sm text-zinc-600">{action.dept}</div>
                      <Badge className="mt-2 bg-zinc-100 text-zinc-900 border-zinc-300">
                        {action.qty}
                      </Badge>
                    </div>
                    <Send className="w-4 h-4 text-zinc-400" />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Examples */}
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="text-blue-900 mb-4">{t.examples}</h3>
            <div className="space-y-2">
              {exampleCommands.map((cmd, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setRequestText(cmd.text);
                    processRequest(cmd.text);
                  }}
                  className="w-full p-3 bg-white border border-blue-200 rounded-lg hover:border-blue-400 transition-colors text-left text-sm"
                >
                  <code className="text-blue-900">{cmd.text}</code>
                </button>
              ))}
            </div>
          </Card>

          {/* Result */}
          {result && (
            <Card className={`p-6 border-2 ${
              result.status === 'validated' ? 'bg-green-50 border-green-300' :
              result.status === 'partial_stock' ? 'bg-yellow-50 border-yellow-300' :
              result.status === 'insufficient_stock' ? 'bg-red-50 border-red-300' :
              'bg-blue-50 border-blue-300'
            }`}>
              <div className="flex items-start gap-3 mb-4">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-zinc-900">
                      {result.status === 'validated' ? '✅ Material Request Created' :
                       result.status === 'partial_stock' ? '⚠️ Partial Stock Available' :
                       result.status === 'insufficient_stock' ? '❌ Insufficient Stock' :
                       '❓ Need More Information'}
                    </h3>
                    {result.urgency === 'urgent' && (
                      <Badge className="bg-red-100 text-red-800 border-red-300">
                        🔴 URGENT
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-3">
                    {/* Request Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white/50 rounded-lg">
                      <div>
                        <div className="text-xs text-zinc-600 mb-1">{t.requestId}</div>
                        <div className="text-zinc-900">{result.request_id}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-600 mb-1">{t.department}</div>
                        <div className="text-zinc-900">{result.requesting_department}</div>
                      </div>
                      {result.materials[0] && (
                        <>
                          <div>
                            <div className="text-xs text-zinc-600 mb-1">{t.material}</div>
                            <div className="text-zinc-900">{result.materials[0].name}</div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-600 mb-1">{t.quantity}</div>
                            <div className="text-zinc-900">
                              {result.materials[0].requested_qty} {result.materials[0].uom}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Stock Status */}
                    {result.materials[0] && result.status !== 'pending_clarification' && (
                      <div className="p-4 bg-white/50 rounded-lg">
                        <div className="text-sm text-zinc-600 mb-2">Stock Status</div>
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-xs text-zinc-600">Available: </span>
                            <span className="text-zinc-900">
                              {result.materials[0].available_qty} {result.materials[0].uom}
                            </span>
                          </div>
                          {result.materials[0].shortage_qty > 0 && (
                            <div>
                              <span className="text-xs text-red-600">Shortage: </span>
                              <span className="text-red-900">
                                {result.materials[0].shortage_qty} {result.materials[0].uom}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {result.validation.warnings && result.validation.warnings.length > 0 && (
                      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="text-sm text-orange-900 mb-2">⚠️ {t.warnings}</div>
                        <ul className="text-sm text-orange-800 space-y-1">
                          {result.validation.warnings.map((warning, i) => (
                            <li key={i}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Missing Info */}
                    {result.validation.missing_info && result.validation.missing_info.length > 0 && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-sm text-blue-900 mb-2">ℹ️ Required Information</div>
                        <ul className="text-sm text-blue-800 space-y-1">
                          {result.validation.missing_info.map((info, i) => (
                            <li key={i}>• {info}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Next Steps */}
                    {result.next_steps && result.next_steps.length > 0 && (
                      <div className="p-4 bg-white/50 rounded-lg">
                        <div className="text-sm text-zinc-600 mb-2">📱 {t.nextSteps}</div>
                        <ul className="text-sm text-zinc-900 space-y-1">
                          {result.next_steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {result.status === 'partial_stock' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Button className="bg-emerald-600 hover:bg-emerald-700">
                          Issue Available Stock
                        </Button>
                        <Button variant="outline" className="border-zinc-300">
                          Transfer from Secondary
                        </Button>
                        <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                          Create Purchase Request
                        </Button>
                      </div>
                    )}

                    {result.status === 'insufficient_stock' && (
                      <Button className="w-full bg-red-600 hover:bg-red-700">
                        Create Purchase Requisition
                      </Button>
                    )}

                    {result.status === 'validated' && (
                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                        Confirm & Issue Materials
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      ) : (
        /* Request History */
        <div className="space-y-4">
          {requestHistory.length > 0 ? (
            requestHistory.map((request) => (
              <Card key={request.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-zinc-900">{request.id}</h3>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-zinc-600">{t.department}</div>
                        <div className="text-zinc-900">{request.department}</div>
                      </div>
                      <div>
                        <div className="text-zinc-600">{t.material}</div>
                        <div className="text-zinc-900">{request.material}</div>
                      </div>
                      <div>
                        <div className="text-zinc-600">{t.quantity}</div>
                        <div className="text-zinc-900">{request.quantity}</div>
                      </div>
                      <div>
                        <div className="text-zinc-600">{t.date}</div>
                        <div className="text-zinc-900">{request.date}</div>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="ml-4">
                    {t.viewDetails}
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <Package className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
              <h3 className="text-zinc-900 mb-2">{t.noRequests}</h3>
              <p className="text-zinc-600">{t.createFirst}</p>
            </Card>
          )}
        </div>
      )}
      
      {/* Material Requisition Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-slate-700 to-slate-800 text-white p-6 flex items-center justify-between">
              <h2 className="text-2xl">{t.materialRequisitionForm}</h2>
              <button
                onClick={() => setShowFormModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6">
              {/* Form Header Section */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 rounded-lg border-2 border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Column 1 */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">
                        {t.formNumber}
                      </label>
                      <input
                        type="text"
                        value={formData.formNumber}
                        onChange={(e) => setFormData({ ...formData, formNumber: e.target.value })}
                        className="w-full p-2.5 border-2 border-slate-300 rounded-md"
                        placeholder="e.g., MR-2025-014"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">
                        {t.dateOfRequest}
                      </label>
                      <input
                        type="date"
                        value={formData.dateOfRequest}
                        onChange={(e) => setFormData({ ...formData, dateOfRequest: e.target.value })}
                        className="w-full p-2.5 border-2 border-slate-300 rounded-md"
                      />
                    </div>
                  </div>

                  {/* Column 2 */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">
                        {t.department}
                      </label>
                      <select
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full p-2.5 border-2 border-slate-300 rounded-md"
                      >
                        <option value="">Select Department</option>
                        <option value="Project Management">Project Management</option>
                        <option value="Cutting Floor">Cutting Floor</option>
                        <option value="Sewing Floor">Sewing Floor</option>
                        <option value="QC Floor">QC Floor</option>
                        <option value="Packaging Floor">Packaging Floor</option>
                        <option value="Maintenance">Maintenance</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">
                        {t.requestedBy}
                      </label>
                      <input
                        type="text"
                        value={formData.requestedBy}
                        onChange={(e) => setFormData({ ...formData, requestedBy: e.target.value })}
                        className="w-full p-2.5 border-2 border-slate-300 rounded-md"
                        placeholder="e.g., Carlos Mendoza - Site Engineer"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">
                        {t.reviewedBy}
                      </label>
                      <input
                        type="text"
                        value={formData.reviewedBy}
                        onChange={(e) => setFormData({ ...formData, reviewedBy: e.target.value })}
                        className="w-full p-2.5 border-2 border-slate-300 rounded-md"
                        placeholder="e.g., Laura Griffith - Inventory Controller"
                      />
                    </div>
                  </div>

                  {/* Column 3 */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">
                        {t.approvedBy}
                      </label>
                      <input
                        type="text"
                        value={formData.approvedBy}
                        onChange={(e) => setFormData({ ...formData, approvedBy: e.target.value })}
                        className="w-full p-2.5 border-2 border-slate-300 rounded-md"
                        placeholder="e.g., William Jones - Project Manager"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">
                        {t.shiftNumber}
                      </label>
                      <select
                        value={formData.shiftNumber}
                        onChange={(e) => setFormData({ ...formData, shiftNumber: e.target.value })}
                        className="w-full p-2.5 border-2 border-slate-300 rounded-md"
                      >
                        <option value="Shift 1">🌅 {t.shift1}</option>
                        <option value="Shift 2">🌤️ {t.shift2}</option>
                        <option value="Shift 3">🌙 {t.shift3}</option>
                      </select>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-lg">
                          {formData.shiftNumber === 'Shift 1' && '🌅'}
                          {formData.shiftNumber === 'Shift 2' && '🌤️'}
                          {formData.shiftNumber === 'Shift 3' && '🌙'}
                        </span>
                        <span className="text-slate-600">
                          {formData.shiftNumber === 'Shift 1' && '6:00 AM - 2:00 PM'}
                          {formData.shiftNumber === 'Shift 2' && '2:00 PM - 10:00 PM'}
                          {formData.shiftNumber === 'Shift 3' && '10:00 PM - 6:00 AM'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Production Timeline Section */}
              <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                <h3 className="font-medium text-blue-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {t.productionTimeline}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-blue-800 mb-1 block">
                      {t.startTime}
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full p-2.5 border-2 border-blue-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-blue-800 mb-1 block">
                      {t.endTime}
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full p-2.5 border-2 border-blue-300 rounded-md"
                    />
                  </div>
                </div>
                {formData.startTime && formData.endTime && (
                  <div className="mt-3 p-3 bg-white border border-blue-300 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-blue-900">
                        {language === 'en' ? 'Duration:' : 'अवधि:'}
                      </span>
                      <span className="text-blue-700">
                        {(() => {
                          const start = new Date(formData.startTime);
                          const end = new Date(formData.endTime);
                          const diffMs = end.getTime() - start.getTime();
                          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                          const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                          return diffHours > 0 ? `${diffHours}h ${diffMins}m` : `${diffMins}m`;
                        })()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Material Items Table */}
              <div className="border-2 border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white p-3">
                  <h3 className="font-medium">Material Items</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-100 border-b-2 border-slate-300">
                      <tr>
                        <th className="p-2 text-left text-xs font-medium text-slate-700">{t.itemCode}</th>
                        <th className="p-2 text-left text-xs font-medium text-slate-700">{t.materialDescription}</th>
                        <th className="p-2 text-left text-xs font-medium text-slate-700">{t.unitOfMeasure}</th>
                        <th className="p-2 text-left text-xs font-medium text-slate-700">{t.quantity}</th>
                        <th className="p-2 text-left text-xs font-medium text-slate-700">{t.requiredDate}</th>
                        <th className="p-2 text-left text-xs font-medium text-slate-700">{t.location}</th>
                        <th className="p-2 text-left text-xs font-medium text-slate-700">{t.priority}</th>
                        <th className="p-2 text-left text-xs font-medium text-slate-700"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialItems.map((item, index) => (
                        <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.itemCode}
                              onChange={(e) => {
                                const newItems = [...materialItems];
                                newItems[index].itemCode = e.target.value;
                                setMaterialItems(newItems);
                              }}
                              className="w-full p-1.5 border border-slate-300 rounded text-sm"
                              placeholder="CEH-001"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.materialDescription}
                              onChange={(e) => {
                                const newItems = [...materialItems];
                                newItems[index].materialDescription = e.target.value;
                                setMaterialItems(newItems);
                              }}
                              className="w-full p-1.5 border border-slate-300 rounded text-sm"
                              placeholder="Portland Cement Type I"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.unitOfMeasure}
                              onChange={(e) => {
                                const newItems = [...materialItems];
                                newItems[index].unitOfMeasure = e.target.value;
                                setMaterialItems(newItems);
                              }}
                              className="w-full p-1.5 border border-slate-300 rounded text-sm"
                              placeholder="Bag (50kg)"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...materialItems];
                                newItems[index].quantity = e.target.value;
                                setMaterialItems(newItems);
                              }}
                              className="w-full p-1.5 border border-slate-300 rounded text-sm"
                              placeholder="120"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="date"
                              value={item.requiredDate}
                              onChange={(e) => {
                                const newItems = [...materialItems];
                                newItems[index].requiredDate = e.target.value;
                                setMaterialItems(newItems);
                              }}
                              className="w-full p-1.5 border border-slate-300 rounded text-sm"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.location}
                              onChange={(e) => {
                                const newItems = [...materialItems];
                                newItems[index].location = e.target.value;
                                setMaterialItems(newItems);
                              }}
                              className="w-full p-1.5 border border-slate-300 rounded text-sm"
                              placeholder="Site A - Foundation"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={item.priority}
                              onChange={(e) => {
                                const newItems = [...materialItems];
                                newItems[index].priority = e.target.value;
                                setMaterialItems(newItems);
                              }}
                              className="w-full p-1.5 border border-slate-300 rounded text-sm"
                            >
                              <option value="Urgent">🔴 {t.urgent}</option>
                              <option value="High">🟡 {t.high}</option>
                              <option value="Normal">⚪ {t.normal}</option>
                              <option value="Low">🔵 {t.low}</option>
                            </select>
                          </td>
                          <td className="p-2">
                            {materialItems.length > 1 && (
                              <button
                                onClick={() => {
                                  const newItems = materialItems.filter((_, i) => i !== index);
                                  setMaterialItems(newItems);
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 bg-slate-50 border-t-2 border-slate-300">
                  <Button
                    onClick={() => setMaterialItems([...materialItems, {
                      itemCode: '',
                      materialDescription: '',
                      unitOfMeasure: '',
                      quantity: '',
                      requiredDate: '',
                      location: '',
                      priority: 'Normal'
                    }])}
                    variant="outline"
                    className="w-full border-slate-400 text-slate-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t.addItem}
                  </Button>
                </div>
              </div>

              {/* Delivery Instructions */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  {t.deliveryInstructions}
                </label>
                <textarea
                  value={formData.deliveryInstructions}
                  onChange={(e) => setFormData({ ...formData, deliveryInstructions: e.target.value })}
                  className="w-full p-3 border-2 border-slate-300 rounded-md min-h-[100px] resize-none"
                  placeholder="Enter any special delivery instructions, notes, or requirements..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t-2 border-slate-200">
                <Button
                  onClick={() => setShowFormModal(false)}
                  variant="outline"
                  className="flex-1 border-slate-400 text-slate-700"
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={() => {
                    alert(`✅ ${language === 'en' ? 'Material Requisition Submitted!' : 'सामग्री अनुरोध जमा किया गया!'}

Form Number: ${formData.formNumber}
Department: ${formData.department}
Items: ${materialItems.length}
Shift: ${formData.shiftNumber}`);
                    setShowFormModal(false);
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {t.submitForm}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}