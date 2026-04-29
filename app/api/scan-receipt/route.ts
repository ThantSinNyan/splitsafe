import {
  demoSlipScanResult,
  type SlipPaymentMethod,
  type SlipScanCategory,
  type SlipScanResult,
} from "@/types/slip-scan";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
};

class ScanReceiptError extends Error {
  constructor(
    message: string,
    public readonly includeDemoData = false,
  ) {
    super(message);
  }
}

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const maxImageBytes = 5 * 1024 * 1024;

const extractionPrompt = `Analyze this image. It may be a receipt, restaurant bill, store receipt, QR payment slip, PromptPay slip, bank transfer slip, or online payment confirmation.

Extract only expense-related information.

Return compact valid JSON only.
Do not include markdown.
Do not include explanations outside JSON.
Keep notes under 120 characters.

Return this exact structure:

{
  "merchant": string | null,
  "title": string | null,
  "amount": number | null,
  "currency": string | null,
  "date": string | null,
  "category": "food" | "transport" | "hotel" | "shopping" | "entertainment" | "utilities" | "travel" | "other",
  "paymentMethod": "cash" | "card" | "bank_transfer" | "promptpay" | "qr_payment" | "unknown",
  "transactionReference": string | null,
  "confidence": number,
  "notes": string
}

Rules:
- Return JSON only.
- If a value is not visible, return null.
- If amount is unclear, return null.
- If currency is unclear but the receipt/slip is from Thailand, use "THB".
- Date should be ISO format YYYY-MM-DD if possible.
- If date is visible but format is unclear, return the best parsed date and explain briefly in notes.
- Category should be estimated from merchant/items if possible.
- Do not invent transaction references.
- Confidence must be between 0 and 1.
- For Thai receipts and bank slips, carefully detect Thai baht amounts.
- If multiple amounts are visible, choose the final paid total, grand total, transfer amount, or net amount.
- Ignore phone numbers unless they are clearly part of transaction reference.
- Do not extract sensitive personal information beyond what is needed for expense tracking.`;

export async function POST(request: Request) {
  const image = await readImageRequest(request);

  if (!image) {
    return Response.json(
      { ok: false, error: "Please upload a receipt or bank slip image." },
      { status: 400 },
    );
  }

  if (image.byteLength > maxImageBytes) {
    return Response.json(
      { ok: false, error: "Image is too large. Please upload an image under 5 MB." },
      { status: 413 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({
      ok: false,
      error: "AI scan needs review. You can enter details manually.",
      demoData: demoSlipScanResult,
    });
  }

  try {
    const result = await scanWithGemini(image.base64, image.mimeType);

    return Response.json({
      ok: true,
      data: result,
      mode: "gemini",
    });
  } catch (caught) {
    const message =
      caught instanceof ScanReceiptError
        ? caught.message
        : "Could not read this image. Please enter manually.";

    return Response.json(
      {
        ok: false,
        error: message,
        demoData:
          caught instanceof ScanReceiptError && caught.includeDemoData
            ? demoSlipScanResult
            : undefined,
      },
      { status: 502 },
    );
  }
}

async function readImageRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) return null;

    const arrayBuffer = await file.arrayBuffer();
    return {
      base64: Buffer.from(arrayBuffer).toString("base64"),
      mimeType: file.type || "image/jpeg",
      byteLength: arrayBuffer.byteLength,
    };
  }

  const body = (await request.json().catch(() => null)) as
    | {
        imageBase64?: string;
        mimeType?: string;
      }
    | null;

  if (!body?.imageBase64) return null;

  const base64 = body.imageBase64.includes(",")
    ? body.imageBase64.split(",").pop() ?? ""
    : body.imageBase64;

  return {
    base64,
    mimeType: body.mimeType ?? "image/jpeg",
    byteLength: Buffer.byteLength(base64, "base64"),
  };
}

async function scanWithGemini(base64: string, mimeType: string) {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: extractionPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const quotaLimited =
      response.status === 429 ||
      errorText.toLowerCase().includes("resource_exhausted") ||
      errorText.toLowerCase().includes("quota");

    throw new ScanReceiptError(
      quotaLimited
        ? "AI scan is temporarily busy. Please review the extracted fields."
        : "Could not read this image. Please enter manually.",
      quotaLimited,
    );
  }

  const data = (await response.json()) as GeminiResponse;
  const finishReason = data.candidates?.[0]?.finishReason;
  const text = extractGeminiText(data);
  if (!text) {
    throw new ScanReceiptError("Gemini did not return a receipt result.", true);
  }
  if (finishReason === "MAX_TOKENS") {
    throw new ScanReceiptError(
      "AI scan needs review. Please check the extracted fields.",
      true,
    );
  }

  try {
    return normalizeScanResult(JSON.parse(cleanJsonText(text)) as Partial<SlipScanResult>);
  } catch {
    throw new ScanReceiptError(
      "AI scan needs review. Please check the extracted fields.",
      true,
    );
  }
}

function extractGeminiText(data: GeminiResponse) {
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join("\n")
    .trim();
}

function cleanJsonText(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
}

function normalizeScanResult(value: Partial<SlipScanResult>): SlipScanResult {
  const category = normalizeCategory(value.category);
  const paymentMethod = normalizePaymentMethod(value.paymentMethod);
  const rawAmount = (value as { amount?: unknown }).amount;
  const confidence = Number(value.confidence ?? 0);
  const numericAmount =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string"
        ? Number(rawAmount.replace(/,/g, "").replace(/[^0-9.-]/g, ""))
        : Number.NaN;
  const amount = Number.isFinite(numericAmount) ? numericAmount : null;

  return {
    merchant: normalizeText(value.merchant),
    title: normalizeText(value.title),
    amount,
    currency: normalizeText(value.currency),
    date: normalizeText(value.date),
    category,
    paymentMethod,
    transactionReference: normalizeText(value.transactionReference),
    confidence: Math.max(0, Math.min(1, confidence)),
    notes: normalizeText(value.notes) ?? "Extracted by SplitSafe Smart Slip Scan.",
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeCategory(value: unknown): SlipScanCategory {
  const allowed: SlipScanCategory[] = [
    "food",
    "transport",
    "hotel",
    "shopping",
    "entertainment",
    "utilities",
    "travel",
    "other",
  ];

  const normalized = typeof value === "string" ? value.toLowerCase() : value;

  return allowed.includes(normalized as SlipScanCategory)
    ? (normalized as SlipScanCategory)
    : "other";
}

function normalizePaymentMethod(value: unknown): SlipPaymentMethod {
  const allowed: SlipPaymentMethod[] = [
    "cash",
    "card",
    "bank_transfer",
    "promptpay",
    "qr_payment",
    "unknown",
  ];

  const normalized = typeof value === "string" ? value.toLowerCase() : value;

  return allowed.includes(normalized as SlipPaymentMethod)
    ? (normalized as SlipPaymentMethod)
    : "unknown";
}
