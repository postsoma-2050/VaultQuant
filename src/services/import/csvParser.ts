import { Trades } from "@/types";
import { RawTransaction } from "./sanitizer";

/**
 * RFC 4180 compliant CSV Parser.
 * Properly handles quotes, escaped quotes (""), commas, and newlines inside field values.
 */
export function parseCSVString(csvText: string): Record<string, string>[] {
    const lines = parseCSVRows(csvText);
    if (lines.length < 2) return [];

    const headers = lines[0].map((h) => h.trim().replace(/^[\uFEFF]/, "").replace(/^"|"$/g, "")); // strip BOM and quotes
    const records: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        if (row.length === 0 || (row.length === 1 && row[0].trim() === "")) {
            continue;
        }

        const record: Record<string, string> = {};
        headers.forEach((header, index) => {
            const val = row[index] !== undefined ? row[index].trim() : "";
            record[header] = val;
        });
        records.push(record);
    }

    return records;
}

/**
 * Split CSV text into rows of columns considering RFC 4180 quoted strings.
 */
function parseCSVRows(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    // Escaped quote ("") inside a quoted field
                    currentField += '"';
                    i++; // skip next quote
                } else {
                    // Closing quote
                    inQuotes = false;
                }
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ",") {
                currentRow.push(currentField);
                currentField = "";
            } else if (char === "\r") {
                if (nextChar === "\n") {
                    i++;
                }
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = "";
            } else if (char === "\n") {
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = "";
            } else {
                currentField += char;
            }
        }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    return rows;
}

/**
 * Convert parsed CSV records into RawTransaction objects for Sanitizer & Campaign Engine.
 * Supports Futu/Moomoo, IBKR, Schwab, Webull, Robinhood, and VaultQuant CSV formats.
 */
export function convertCSVRecordsToRawTransactions(
    records: Record<string, string>[]
): RawTransaction[] {
    const rawTransactions: RawTransaction[] = [];
    let lastSide = "";
    let lastSymbol = "";
    let lastStatus = "";

    for (let i = 0; i < records.length; i++) {
        const record = records[i];

        // 1. Symbol Detection
        let symbol =
            record["Symbol"] ||
            record["symbol"] ||
            record["SymbolName"] ||
            record["symbolName"] ||
            record["Ticker"] ||
            record["ticker"] ||
            record["Asset"] ||
            "";

        // 2. Side / Direction Detection
        let type =
            record["Side"] ||
            record["side"] ||
            record["Type"] ||
            record["type"] ||
            record["Action"] ||
            record["action"] ||
            record["PositionType"] ||
            record["positionType"] ||
            "";

        // 3. Status Detection
        let status = record["Status"] || record["status"] || "";

        // Inherit parent attributes for split execution sub-rows
        if (!symbol && lastSymbol) symbol = lastSymbol;
        if (!type && lastSide) type = lastSide;
        if (!status && lastStatus) status = lastStatus;

        if (record["Symbol"]) lastSymbol = record["Symbol"];
        if (record["Side"]) lastSide = record["Side"];
        if (record["Status"]) lastStatus = record["Status"];

        // 4. Date & Time Detection
        const date =
            record["Fill Time"] ||
            record["fill time"] ||
            record["Order Time"] ||
            record["order time"] ||
            record["Date"] ||
            record["date"] ||
            record["Time"] ||
            record["time"] ||
            "";

        const time =
            record["OpenTime"] ||
            record["openTime"] ||
            "";

        // 5. Quantity Detection (prefer Fill Qty over Order Qty)
        const quantity =
            record["Fill Qty"] ||
            record["fill qty"] ||
            record["Order Qty"] ||
            record["order qty"] ||
            record["Quantity"] ||
            record["quantity"] ||
            record["Shares"] ||
            record["shares"] ||
            record["Qty"] ||
            record["qty"] ||
            "0";

        // 6. Price Detection (prefer Fill Price over Order Price)
        const price =
            record["Fill Price"] ||
            record["fill price"] ||
            record["Order Price"] ||
            record["order price"] ||
            record["Price"] ||
            record["price"] ||
            record["EntryPrice"] ||
            record["entryPrice"] ||
            record["Cost"] ||
            "0";

        const notes =
            record["Name"] ||
            record["name"] ||
            record["Notes"] ||
            record["notes"] ||
            record["Remarks"] ||
            record["remarks"] ||
            record["Comment"] ||
            "";

        const actionType = record["ActionType"] || record["actionType"] || "";

        const cleanQty = parseFloat(String(quantity).replace(/,/g, ""));
        const cleanPrice = parseFloat(String(price).replace(/,/g, ""));

        // Extract total fee breakdown (Commission, Platform Fee, Stamp Duty, Trading Tariff, Levies, Settlement Fee, etc.)
        const commission = parseFloat(String(record["Commission"] || "0").replace(/,/g, "")) || 0;
        const platform = parseFloat(String(record["Platform Fee"] || "0").replace(/,/g, "")) || 0;
        const stamp = parseFloat(String(record["Stamp Duty"] || "0").replace(/,/g, "")) || 0;
        const trading = parseFloat(String(record["Trading Fee"] || "0").replace(/,/g, "")) || 0;
        const sfc = parseFloat(String(record["SFC Levy"] || "0").replace(/,/g, "")) || 0;
        const frc = parseFloat(String(record["FRC Levy"] || "0").replace(/,/g, "")) || 0;
        const settlement = parseFloat(String(record["Settlement Fee"] || "0").replace(/,/g, "")) || 0;
        const explicitFee = parseFloat(String(record["Total"] || record["Fee"] || record["fee"] || "0").replace(/,/g, "")) || 0;

        const calculatedFee = commission + platform + stamp + trading + sfc + frc + settlement;
        const totalFee = explicitFee > 0 ? explicitFee : calculatedFee;

        if (symbol && type && !isNaN(cleanQty) && cleanQty > 0 && !isNaN(cleanPrice) && cleanPrice > 0) {
            rawTransactions.push({
                id: `raw-${i}`,
                symbol,
                type,
                date,
                time,
                quantity: cleanQty,
                price: cleanPrice,
                fee: totalFee,
                notes,
                status,
                actionType,
            });
        }
    }

    return rawTransactions;
}

/**
 * RFC 4180 Export Trades to CSV string (Lossless).
 */
export function exportTradesToCSV(trades: Trades[]): string {
    const headers = [
        "id",
        "symbolName",
        "positionType",
        "openDate",
        "openTime",
        "closeDate",
        "closeTime",
        "entryPrice",
        "quantity",
        "sellPrice",
        "result",
        "isActiveTrade",
        "notes",
        "closeEvents",
        "openOtherDetails",
    ];

    function escapeCSVField(val: unknown): string {
        if (val === undefined || val === null) return "";
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    const rows = [headers.join(",")];

    for (const trade of trades) {
        const row = [
            escapeCSVField(trade.id),
            escapeCSVField(trade.symbolName),
            escapeCSVField(trade.positionType),
            escapeCSVField(trade.openDate),
            escapeCSVField(trade.openTime),
            escapeCSVField(trade.closeDate),
            escapeCSVField(trade.closeTime),
            escapeCSVField(trade.entryPrice),
            escapeCSVField(trade.quantity),
            escapeCSVField(trade.sellPrice),
            escapeCSVField(trade.result),
            escapeCSVField(trade.isActiveTrade),
            escapeCSVField(trade.notes),
            escapeCSVField(trade.closeEvents),
            escapeCSVField(trade.openOtherDetails),
        ];
        rows.push(row.join(","));
    }

    return rows.join("\n");
}
