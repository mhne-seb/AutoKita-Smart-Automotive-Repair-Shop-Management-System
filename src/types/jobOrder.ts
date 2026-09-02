// src/types/jobOrder.ts
// Shared types for the AI Diagnostic Assistant job order session.
// Used by:
//   - app/api/chat/admin/job-session/route.ts  (server)
//   - src/controllers/diagnosticAssistantController.ts (client)
//   - src/components/dashboard/MechanicAIAssistant.tsx (client)

export interface JobOrderSummary {
  id: number;
  jo_date: string;
  status: string;
  plate_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
}

export interface JobOrderService {
  service_name: string;
  estimated_amount: number | null;
  actual_amount: number | null;
}

export interface JobOrderPart {
  part_number: string;
  description: string;
  quantity: number;
  unit_price: number | null;
  total: number | null;
}

export interface InspectionNote {
  name: string;
  notes: string | null;
  findings: string | null;
  status: string | null;
}

export interface JobOrderSession {
  id: number;
  status: string;
  jo_date: string;
  vehicle: {
    plate: string;
    make: string;
    model: string;
    year: number | null;
    mileage: number | null;
    vehicle_type: string | null;
  };
  services: JobOrderService[];
  parts: JobOrderPart[];
  inspectionNotes: InspectionNote[];
  /** Pre-built natural language context block injected into the AI system prompt */
  contextString: string;
}
