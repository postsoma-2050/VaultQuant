export interface Rule {
    id: string;
    rule: string;
    satisfied: boolean;
    priority: "low" | "medium" | "high";
}

export interface CloseEvent {
    id: string;           // UUID for each close event
    date: string;         // ISO date of this close
    time: string;         // Time of close
    quantitySold?: number; // How many units sold in this event (for scale-outs/closes)
    sellPrice?: number;    // Price per unit at this close
    result?: number;       // P/L for this specific close
    quantityChange?: number; // Quantity change: positive for scale-in/add, negative for scale-out/reduce/close
    price?: number;          // Price per unit at adjustment
    eventType?: "add" | "reduce" | "close"; // Event type classification
    notes?: string;          // Optional notes for this adjustment event
}

