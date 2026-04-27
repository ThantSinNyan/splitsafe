export type SlipScanCategory =
  | "food"
  | "transport"
  | "hotel"
  | "shopping"
  | "entertainment"
  | "utilities"
  | "travel"
  | "other";

export type SlipPaymentMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "promptpay"
  | "qr_payment"
  | "unknown";

export type SlipScanResult = {
  merchant: string | null;
  title: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null;
  category: SlipScanCategory;
  paymentMethod: SlipPaymentMethod;
  transactionReference: string | null;
  confidence: number;
  notes: string;
};

export type SlipScanResponse =
  | {
      ok: true;
      data: SlipScanResult;
      mode: "gemini";
    }
  | {
      ok: false;
      error: string;
      demoData?: SlipScanResult;
    };

export const demoSlipScanResult: SlipScanResult = {
  merchant: "7-Eleven",
  title: "7-Eleven",
  amount: 245,
  currency: "THB",
  date: null,
  category: "food",
  paymentMethod: "promptpay",
  transactionReference: null,
  confidence: 0.88,
  notes: "Demo extraction result. Review the amount before saving.",
};
