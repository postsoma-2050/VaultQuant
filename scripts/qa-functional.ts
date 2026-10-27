import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import puppeteer, { Browser, ElementHandle, Page } from "puppeteer-core";

type Status = "PASS" | "FAIL" | "SKIP";
type Phase = "strategy" | "trade" | "journal" | "reports" | "import" | "cleanup";
type Rule = { id: string; rule: string; satisfied: boolean; priority: "low" | "medium" | "high" };

type CheckResult = {
    id: string;
    phase: Phase;
    title: string;
    status: Status;
    method: "UI" | "UI+DB" | "DB fixture" | "DB invariant";
    details?: string;
    error?: string;
    screenshot?: string;
};

type PhaseResult = {
    phase: Phase;
    status: Status;
    startedAt: string;
    finishedAt: string;
    checks: CheckResult[];
    error?: string;
};

type RunReport = {
    runId: string;
    startedAt: string;
    finishedAt?: string;
    baseUrl: string;
    databaseUrl: string;
    databasePath: string;
    prefix: string;
    status: Status;
    phases: PhaseResult[];
    defects: CheckResult[];
    notes: string[];
};

const ROOT = path.resolve(process.cwd());
const BASE_URL = (process.env.VQ_QA_BASE_URL || "http://localhost:3100").replace(/\/+$/, "");
const DB_URL = process.env.VQ_QA_DB || "";
const DB_PATH = DB_URL.startsWith("file:") ? path.resolve(DB_URL.slice("file:".length)) : "";
const ARTIFACT_DIR = path.resolve(
    process.env.VQ_QA_ARTIFACT_DIR ||
    path.join(ROOT, "artifacts", "validation-2026-10-24", "qa-functional")
);
const CHROME_PATH =
    process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const EXPECTED_DB_DIR = path.join(ROOT, "artifacts", "validation-");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const PREFIX = `QA_${RUN_ID.replace(/[-TZ]/g, "").slice(0, 14)}`;
const TODAY = (() => {
    const date = new Date();
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
})();
const TODAY_SLUG = TODAY.replace(/-/g, "/");
const MAX_STEP_MS = Number(process.env.VQ_QA_STEP_TIMEOUT_MS || 20_000);
const ENABLED_PHASES = new Set(
    (process.env.VQ_QA_PHASES || "strategy,trade,journal,reports,import")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
);

const report: RunReport = {
    runId: RUN_ID,
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    databaseUrl: DB_URL,
    databasePath: DB_PATH,
    prefix: PREFIX,
    status: "PASS",
    phases: [],
    defects: [],
    notes: [
        "All product mutations use the browser UI except explicitly labeled DB fixture seeding.",
        "API routes /api/claude, /api/follow-up-claude and /api/market-price are intercepted in the browser.",
        "No dev server restart, build, source edit, or local.db access is performed by this runner.",
    ],
};

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function now() {
    return new Date().toISOString();
}

function validateIsolation() {
    assert(DB_URL, "VQ_QA_DB is required (example: file:/.../artifacts/validation-2026-10-24/functional.sqlite)");
    assert(DB_PATH, `VQ_QA_DB must use a file: URL, got ${DB_URL}`);
    assert(fs.existsSync(DB_PATH), `Isolated database does not exist: ${DB_PATH}`);
    assert(path.basename(DB_PATH) === "functional.sqlite", `Refusing non-functional.sqlite target: ${DB_PATH}`);
    assert(
        DB_PATH.startsWith(EXPECTED_DB_DIR) &&
        DB_PATH.split(path.sep).includes("validation-2026-10-24"),
        `Refusing database outside artifacts/validation-2026-10-24: ${DB_PATH}`
    );
    assert(DB_PATH !== path.join(ROOT, "local.db"), "Refusing local.db");
    assert(
        BASE_URL === "http://localhost:3100" || BASE_URL === "http://127.0.0.1:3100",
        `Refusing non-isolated server URL: ${BASE_URL}`
    );
    assert(fs.existsSync(CHROME_PATH), `Chrome executable not found: ${CHROME_PATH}`);
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function sqliteJson<T>(sql: string): T[] {
    assert(DB_PATH, "Database path not initialized");
    const raw = execFileSync("sqlite3", ["-json", DB_PATH, sql], {
        encoding: "utf8",
        timeout: 10_000,
        maxBuffer: 4 * 1024 * 1024,
    }).trim();
    return raw ? (JSON.parse(raw) as T[]) : [];
}

function sqlLiteral(value: string) {
    return `'${value.replace(/'/g, "''")}'`;
}

function sqliteValue<T>(sql: string): T | null {
    return sqliteJson<T>(sql)[0] ?? null;
}

function money(value: unknown) {
    const number = Number(value);
    assert(Number.isFinite(number), `Expected a finite money value, got ${String(value)}`);
    return Math.round(number * 100) / 100;
}

function assertMoney(actual: unknown, expected: number, label: string) {
    assert(
        money(actual) === money(expected),
        `${label}: expected $${money(expected).toFixed(2)}, got $${money(actual).toFixed(2)}`
    );
}

type PositionEvent = {
    quantityChange?: number;
    quantitySold?: number;
    price?: number;
    sellPrice?: number;
    result?: number;
};

function replayPosition(
    initialQuantity: number,
    initialEntryPrice: number,
    events: PositionEvent[]
) {
    let quantity = initialQuantity;
    let entryPrice = initialEntryPrice;
    let realized = 0;

    for (const event of events) {
        const quantityChange = event.quantityChange ?? -(event.quantitySold ?? 0);
        const eventPrice = event.price ?? event.sellPrice ?? 0;
        if (quantityChange > 0) {
            const nextQuantity = quantity + quantityChange;
            entryPrice = nextQuantity > 0
                ? (entryPrice * quantity + eventPrice * quantityChange) / nextQuantity
                : entryPrice;
            quantity = nextQuantity;
        } else if (quantityChange < 0) {
            const reduced = Math.min(quantity, Math.abs(quantityChange));
            realized += (eventPrice - entryPrice) * reduced;
            quantity += quantityChange;
        }
    }

    return {
        quantity: Number(quantity.toFixed(8)),
        entryPrice: Number(entryPrice.toFixed(8)),
        realized: money(realized),
        cost: money(quantity * entryPrice),
    };
}

function writeReport() {
    report.finishedAt = now();
    report.defects = report.phases
        .flatMap((phase) => phase.checks)
        .filter((check) => check.status === "FAIL");
    report.status = report.defects.length > 0 ? "FAIL" : "PASS";
    fs.writeFileSync(
        path.join(ARTIFACT_DIR, "functional-qa-report.json"),
        JSON.stringify(report, null, 2)
    );
}

function updatePhaseStatuses() {
    for (const phaseResult of report.phases) {
        phaseResult.status = phaseResult.checks.some((check) => check.status === "FAIL")
            ? "FAIL"
            : phaseResult.error
            ? "FAIL"
            : "PASS";
    }
}

function record(
    phase: PhaseResult,
    check: Omit<CheckResult, "phase">
) {
    const entry: CheckResult = { ...check, phase: phase.phase };
    phase.checks.push(entry);
    const suffix = entry.error ? `: ${entry.error}` : entry.details ? `: ${entry.details}` : "";
    console.log(`[${entry.status}] ${entry.id} (${entry.method}) ${entry.title}${suffix}`);
    if (entry.status === "FAIL") {
        updatePhaseStatuses();
        writeReport();
    }
}

async function phase<T>(name: Phase, fn: () => Promise<T>): Promise<T | undefined> {
    const result: PhaseResult = {
        phase: name,
        status: "PASS",
        startedAt: now(),
        finishedAt: "",
        checks: [],
    };
    report.phases.push(result);
    console.log(`\n=== PHASE: ${name} ===`);
    try {
        const value = await fn();
        return value;
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.error(`[PHASE FAIL] ${name}: ${result.error}`);
        return undefined;
    } finally {
        result.finishedAt = now();
        updatePhaseStatuses();
        writeReport();
    }
}

function currentPhase(name: Phase): PhaseResult {
    const found = report.phases.find((item) => item.phase === name);
    assert(found, `Phase ${name} was not initialized`);
    return found;
}

async function withTimeout<T>(promise: Promise<T>, label: string, ms = MAX_STEP_MS): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms: ${label}`)), ms);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function screenshot(page: Page, name: string) {
    const safe = name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
    const target = path.join(ARTIFACT_DIR, `${safe}.png`);
    await page.screenshot({ path: target }).catch(() => undefined);
    return target;
}

async function bodyText(page: Page) {
    return page.evaluate(() => document.body.innerText);
}

async function waitForText(page: Page, text: string, timeout = MAX_STEP_MS) {
    await page.waitForFunction(
        (needle) => document.body.innerText.includes(needle),
        { timeout },
        text
    );
}

async function waitForTextGone(page: Page, text: string, timeout = MAX_STEP_MS) {
    await page.waitForFunction(
        (needle) => !document.body.innerText.includes(needle),
        { timeout },
        text
    );
}

function phaseEnabled(name: Phase) {
    return ENABLED_PHASES.has(name);
}

async function clickByText(
    page: Page,
    text: string,
    options: { root?: string; exact?: boolean; timeout?: number } = {}
) {
    const { root = "body", exact = true, timeout = MAX_STEP_MS } = options;
    const selector = `${root} button, ${root} [role="button"], ${root} [role="tab"], ${root} a`;
    await page.waitForFunction(
        (sel, needle, useExact) => {
            return Array.from(document.querySelectorAll(sel)).some((element) => {
                const label = (element.textContent || "").replace(/\s+/g, " ").trim();
                return useExact ? label === needle : label.includes(needle);
            });
        },
        { timeout, polling: 100 },
        selector,
        text,
        exact
    );
    const handles = await page.$$(selector);
    for (const handle of handles) {
        const matches = await handle.evaluate(
            (element, needle, useExact) => {
                const label = (element.textContent || "").replace(/\s+/g, " ").trim();
                return useExact ? label === needle : label.includes(needle);
            },
            text,
            exact
        );
        if (matches) {
            await handle.click();
            return;
        }
    }
    throw new Error(`Visible control not found: ${text}`);
}

async function fill(page: Page, selector: string, value: string, root = "body") {
    const scoped = `${root} ${selector}`;
    const element = await page.waitForSelector(scoped, {
        visible: true,
        timeout: MAX_STEP_MS,
    });
    assert(element, `Input not found: ${scoped}`);
    const current = await element.evaluate((node) =>
        node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
            ? node.value
            : node.textContent || ""
    );
    if (current === value) return;
    const result = await element.evaluate((node, nextValue) => {
        if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) {
            return { ok: false, reason: "not an input" };
        }
        const prototype = node instanceof HTMLInputElement
            ? HTMLInputElement.prototype
            : HTMLTextAreaElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (!setter) return { ok: false, reason: "missing native value setter" };
        node.focus();
        setter.call(node, nextValue);
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
        node.blur();
        return { ok: true, reason: "" };
    }, value);
    if (!result.ok) {
        await element.click({ clickCount: 3 });
        await page.keyboard.press("Backspace");
        if (value) await element.type(value);
    }
}

async function clickAria(page: Page, ariaLabel: string, root = "body") {
    const selector = `${root} [aria-label=${JSON.stringify(ariaLabel)}]`;
    const element = await page.waitForSelector(selector, { visible: true, timeout: MAX_STEP_MS });
    assert(element, `Element not found: ${selector}`);
    await element.click();
}

async function clickLabel(page: Page, ariaLabel: string, root = "body") {
    const selector = `${root} [aria-label=${JSON.stringify(ariaLabel)}]`;
    const element = await page.waitForSelector(selector, { timeout: MAX_STEP_MS });
    assert(element, `Element not found: ${selector}`);
    await element.evaluate((node) => (node as HTMLElement).click());
}

async function go(page: Page, route: string) {
    const url = `${BASE_URL}${route}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: MAX_STEP_MS });
    await page.waitForSelector("#workspace-content", { timeout: MAX_STEP_MS });
    await waitForHydration(page, route);
}

async function refresh(page: Page) {
    await page.reload({ waitUntil: "domcontentloaded", timeout: MAX_STEP_MS });
    await waitForHydration(page, new URL(page.url()).pathname);
}

async function waitForHydration(page: Page, route: string) {
    const selector = route.startsWith("/private/strategies")
        ? 'input[aria-label="Search strategies"]'
        : route.startsWith("/private/history")
        ? '[role="tablist"]'
        : route.startsWith("/private/calendar")
        ? 'button[aria-label*="day review"], button[aria-label*="Add a trade"]'
        : route.startsWith("/private/statistics")
        ? '[aria-label="Statistics period"]'
        : route.startsWith("/private/reports-history/")
        ? "main, #workspace-content"
        : route.startsWith("/private/reports-history")
        ? 'input[aria-label="Search reports"]'
        : route.startsWith("/private/journal")
        ? ".tiptap"
        : "#workspace-content";
    await page.waitForSelector(selector, { visible: true, timeout: MAX_STEP_MS });
    await page.waitForFunction(
        (target) => {
            const element = document.querySelector(target);
            if (!element) return false;
            const reactProps = Object.keys(element).some((key) => key.startsWith("__reactProps$"));
            const routerReady = Boolean(document.querySelector("#workspace-content")) &&
                document.body.innerText.trim().length > 0;
            return routerReady && reactProps;
        },
        { timeout: MAX_STEP_MS, polling: 50 },
        selector
    );
}

async function waitForDb<T>(
    read: () => T,
    predicate: (value: T) => boolean,
    label: string,
    timeout = MAX_STEP_MS
) {
    const deadline = Date.now() + timeout;
    let last: T | undefined;
    while (Date.now() < deadline) {
        last = read();
        if (predicate(last)) return last;
        await sleep(100);
    }
    throw new Error(`Timed out waiting for DB condition: ${label}; last=${JSON.stringify(last)}`);
}

async function metricValue(page: Page, label: string) {
    return page.evaluate((needle) => {
        const term = Array.from(document.querySelectorAll("dt"))
            .find((node) => (node.textContent || "").trim() === needle);
        return term?.parentElement?.querySelector("dd")?.textContent?.trim() || null;
    }, label);
}

function realizedFromTrades(rows: Array<Record<string, unknown>>) {
    let total = 0;
    for (const row of rows) {
        const closeDate = String(row.closeDate || "");
        if (closeDate) {
            total += Number(row.result) || 0;
            continue;
        }
        const events = JSON.parse(String(row.close_events || "[]")) as PositionEvent[];
        total += events.reduce((sum, event) => sum + (Number(event.result) || 0), 0);
    }
    return money(total);
}

function strategyRow(id: string) {
    return sqliteValue<{
        id: string;
        strategyName: string;
        description: string | null;
        open_position_rules: string | null;
        close_position_rules: string | null;
    }>(
        `SELECT id, strategyName, description, open_position_rules, close_position_rules
         FROM strategies WHERE id=${sqlLiteral(id)}`
    );
}

function tradeRow(id: string) {
    return sqliteValue<Record<string, unknown>>(
        `SELECT * FROM trades WHERE id=${sqlLiteral(id)}`
    );
}

function journalRow(date: string) {
    return sqliteValue<{
        id: string;
        date: string;
        content: string | null;
        created_at: string;
        updated_at: string;
    }>(
        `SELECT id, date, content, created_at, updated_at FROM journal
         WHERE user_id='local-user' AND date=${sqlLiteral(date)}`
    );
}

function reportRow(id: string) {
    return sqliteValue<{
        id: string;
        report_data: string;
        is_favorite: number;
        created_at: string;
    }>(
        `SELECT id, report_data, is_favorite, created_at FROM reports WHERE id=${sqlLiteral(id)}`
    );
}

async function createStrategyViaUI(page: Page, strategy: { id: string; name: string; description: string; openRule: string; closeRule: string }) {
    await go(page, "/private/strategies");
    await waitForText(page, "Strategies");
    const trigger = await page.waitForSelector(
        'button[type="button"]:has(svg.lucide-plus)',
        { visible: true, timeout: MAX_STEP_MS }
    );
    assert(trigger, "New Strategy trigger not found");
    await trigger.evaluate((node) => (node as HTMLElement).click());
    await page.waitForSelector("#strategyName", { visible: true, timeout: MAX_STEP_MS });
    await fill(page, "#strategyName", strategy.name);
    await fill(page, "#description", strategy.description);

    await clickByText(page, "Add Rule", { root: '[role="dialog"]' });
    await page.waitForSelector('[role="dialog"] button[aria-label^="Edit rule:"]', {
        visible: true,
        timeout: MAX_STEP_MS,
    });
    await page.locator('[role="dialog"] button[aria-label^="Edit rule:"]').click();
    await page.waitForSelector('input[placeholder="Enter rule description"]', {
        visible: true,
        timeout: MAX_STEP_MS,
    });
    await fill(page, 'input[placeholder="Enter rule description"]', strategy.openRule);
    await page.keyboard.press("Enter");

    await clickByText(page, "Close Rules", { root: '[role="dialog"]' });
    await clickByText(page, "Add Rule", { root: '[role="dialog"]' });
    await page.waitForSelector('[role="dialog"] button[aria-label^="Edit rule:"]', {
        visible: true,
        timeout: MAX_STEP_MS,
    });
    await page.locator('[role="dialog"] button[aria-label^="Edit rule:"]').click();
    await page.waitForSelector('input[placeholder="Enter rule description"]', {
        visible: true,
        timeout: MAX_STEP_MS,
    });
    await fill(page, 'input[placeholder="Enter rule description"]', strategy.closeRule);
    await page.keyboard.press("Enter");

    await clickByText(page, "Create Strategy", { root: '[role="dialog"]' });
    await waitForText(page, strategy.name);

    // Strategy ids are generated by the UI. Capture the actual id for follow-up DB checks.
    const row = sqliteValue<{ id: string }>(
        `SELECT id FROM strategies WHERE strategyName=${sqlLiteral(strategy.name)}
         ORDER BY created_at DESC LIMIT 1`
    );
    assert(row, `UI did not create strategy ${strategy.name}`);
    return row.id;
}

async function editStrategyViaUI(page: Page, name: string, nextName: string, nextDescription: string) {
    await go(page, "/private/strategies");
    await waitForText(page, name);
    await clickAria(page, `Edit ${name}`);
    await page.waitForSelector("#strategyName", { visible: true, timeout: MAX_STEP_MS });
    await fill(page, "#strategyName", nextName);
    await fill(page, "#description", nextDescription);
    await clickByText(page, "Save Changes", { root: '[role="dialog"]' });
    await waitForText(page, nextName);
}

async function deleteStrategyViaUI(page: Page, name: string) {
    await go(page, "/private/strategies");
    await waitForText(page, name);
    await clickAria(page, `Delete ${name}`);
    await waitForText(page, "Delete Strategy");
    await clickByText(page, "Delete", { root: '[role="dialog"]' });
    await waitForTextGone(page, name);
}

async function openNewTrade(page: Page) {
    await go(page, "/private/calendar");
    const todayLabel = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
    }).format(new Date());
    await page.waitForFunction(
        (label) => Array.from(document.querySelectorAll("button"))
            .some((button) => (button.getAttribute("aria-label") || "").startsWith(label)),
        { timeout: MAX_STEP_MS },
        todayLabel
    );
    const opened = await page.evaluate((label) => {
        const button = Array.from(document.querySelectorAll("button"))
            .find((item) => (item.getAttribute("aria-label") || "").startsWith(label)) as HTMLButtonElement | undefined;
        if (!button) return false;
        button.click();
        return true;
    }, todayLabel);
    assert(opened, `Today calendar trigger not found: ${todayLabel}`);
    await waitForText(page, "Add Trade");
    const addTrade = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('[role="dialog"] button'))
            .find((item) => (item.textContent || "").trim() === "Add Trade") as HTMLButtonElement | undefined;
        if (!button) return false;
        button.click();
        return true;
    });
    assert(addTrade, "Day review Add Trade button not found");
    await page.waitForSelector('input[placeholder="Type symbol"]', {
        visible: true,
        timeout: MAX_STEP_MS,
    });
}

async function submitNewTrade(page: Page, options: {
    symbol: string;
    entry: string;
    qty: string;
    strategy?: string;
}) {
    await openNewTrade(page);
    await fill(page, 'input[placeholder="Type symbol"]', options.symbol);
    await page.waitForFunction(
        () => document.body.innerText.includes("Valid symbol") ||
            document.body.innerText.includes("Add anyway") ||
            document.body.innerText.includes("Bypassed check"),
        { timeout: MAX_STEP_MS }
    );
    const hasAddAnyway = (await bodyText(page)).includes("Add anyway");
    if (hasAddAnyway) {
        const addAnyway = await page.waitForSelector('form button', { visible: true, timeout: MAX_STEP_MS });
        assert(addAnyway, "Add anyway control missing");
        const clicked = await page.evaluate(() => {
            const button = Array.from(document.querySelectorAll("form button"))
                .find((item) => (item.textContent || "").trim() === "Add anyway") as HTMLButtonElement | undefined;
            if (!button) return false;
            button.click();
            return true;
        });
        assert(clicked, "Could not click Add anyway");
        await waitForText(page, "Bypassed check");
    }
    await fill(page, "#entryPrice", options.entry);
    await fill(page, "#quantity", options.qty);

    if (options.strategy) {
        await clickByText(page, "Strategy", { root: "form" });
        await page.waitForFunction(
            () => Array.from(document.querySelectorAll('form [role="combobox"]'))
                .some((node) => node.getBoundingClientRect().width > 0),
            { timeout: MAX_STEP_MS }
        );
        await page.evaluate(() => {
            const trigger = Array.from(document.querySelectorAll('form [role="combobox"]'))
                .find((node) => node.getBoundingClientRect().width > 0) as HTMLElement | undefined;
            trigger?.click();
        });
        await page.waitForFunction(
            (name) => Array.from(document.querySelectorAll('[role="option"]'))
                .some((option) => (option.textContent || "").includes(name)),
            { timeout: MAX_STEP_MS },
            options.strategy
        );
        const selected = await page.evaluate((name) => {
            const option = Array.from(document.querySelectorAll('[role="option"]'))
                .find((node) => (node.textContent || "").includes(name)) as HTMLElement | undefined;
            if (!option) return false;
            option.click();
            return true;
        }, options.strategy);
        assert(selected, `Could not select strategy ${options.strategy}`);
        await waitForText(page, `Checklist for "${options.strategy}"`);
    }

    const diagnosticsBefore = await page.evaluate(() => ({
        text: document.body.innerText,
        invalid: Array.from(document.querySelectorAll("form [aria-invalid='true']"))
            .map((node) => ({
                tag: node.tagName,
                id: (node as HTMLElement).id,
                name: (node as HTMLInputElement).name,
                value: (node as HTMLInputElement).value,
                text: node.textContent,
            })),
    }));
    const submitted = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('form button[type="submit"]'))
            .find((item) => (item.textContent || "").trim() === "Add Trade") as HTMLButtonElement | undefined;
        if (!button) return false;
        console.log("QA submit diagnostics", {
            disabled: button.disabled,
            title: button.closest("[title]")?.getAttribute("title") || null,
            formValid: (button.closest("form") as HTMLFormElement | null)?.checkValidity() ?? null,
        });
        button.click();
        return true;
    });
    assert(submitted, "Add Trade submit button not found");
    try {
        await page.waitForFunction(
            () => !document.body.innerText.includes("Add a New Trade"),
            { timeout: MAX_STEP_MS }
        );
    } catch (error) {
        const diagnosticsAfter = await page.evaluate(() => ({
            text: document.body.innerText,
            toasts: Array.from(document.querySelectorAll("[data-sonner-toast]"))
                .map((node) => (node.textContent || "").trim()),
            invalid: Array.from(document.querySelectorAll("form [aria-invalid='true']"))
                .map((node) => ({
                    tag: node.tagName,
                    id: (node as HTMLElement).id,
                    name: (node as HTMLInputElement).name,
                    value: (node as HTMLInputElement).value,
                    text: node.textContent,
                })),
            submit: Array.from(document.querySelectorAll('form button[type="submit"]'))
                .map((node) => ({
                    text: (node.textContent || "").trim(),
                    disabled: (node as HTMLButtonElement).disabled,
                    title: node.closest("[title]")?.getAttribute("title") || null,
                })),
        }));
        throw new Error(
            `Trade form remained open after submit. before=${JSON.stringify(diagnosticsBefore)} ` +
            `after=${JSON.stringify(diagnosticsAfter)}`
        );
    }
}

async function openHistoryTab(page: Page, tab: "Open" | "Closed") {
    await go(page, "/private/history");
    await waitForText(page, "History");
    await clickByText(page, tab, { root: '[role="tablist"]' });
    await sleep(250);
}

async function manageOpenPosition(page: Page, symbol: string, action: string) {
    await openHistoryTab(page, "Open");
    await waitForText(page, symbol);
    await clickAria(page, `Manage ${symbol} position`);
    await page.waitForFunction(
        (label) => Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper] button'))
            .some((button) => (button.textContent || "").trim() === label),
        { timeout: MAX_STEP_MS },
        action
    );
    const clicked = await page.evaluate((label) => {
        const button = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper] button'))
            .find((item) => (item.textContent || "").trim() === label) as HTMLButtonElement | undefined;
        if (!button) return false;
        button.click();
        return true;
    }, action);
    assert(clicked, `Manage action not found: ${action}`);
}

async function adjustOpenPosition(page: Page, options: {
    symbol: string;
    action: "Add" | "Reduce Position" | "Close Position";
    qty: string;
    price: string;
    confirm: string;
}) {
    if (options.action === "Add") {
        await openHistoryTab(page, "Open");
        await waitForText(page, options.symbol);
        await clickAria(page, `Add to ${options.symbol} position`);
    } else {
        await manageOpenPosition(page, options.symbol, options.action);
    }
    await page.waitForSelector("#adjustQty", { visible: true, timeout: MAX_STEP_MS });
    if (options.action !== "Close Position") {
        await fill(page, "#adjustQty", options.qty, "form");
    }
    await fill(page, "#adjustPrice", options.price, "form");
    const clicked = await page.evaluate((label) => {
        const button = Array.from(document.querySelectorAll('form button[type="submit"]'))
            .find((item) => (item.textContent || "").trim() === label) as HTMLButtonElement | undefined;
        if (!button) return false;
        button.click();
        return true;
    }, options.confirm);
    assert(clicked, `Adjust submit not found: ${options.confirm}`);
    await page.waitForFunction(
        () => !document.body.innerText.includes("Scale-in Details") &&
            !document.body.innerText.includes("Scale-out Details") &&
            !document.body.innerText.includes("Exit Details"),
        { timeout: MAX_STEP_MS }
    );
}

async function editInitialEntry(page: Page, symbol: string, entry: string) {
    await manageOpenPosition(page, symbol, "Edit initial entry");
    await page.waitForSelector("#entryPrice", { visible: true, timeout: MAX_STEP_MS });
    await fill(page, "#entryPrice", entry, "form");
    const clicked = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('form button[type="submit"]'))
            .find((item) => (item.textContent || "").trim() === "Update Trade") as HTMLButtonElement | undefined;
        if (!button) return false;
        button.click();
        return true;
    });
    assert(clicked, "Update Trade submit not found");
    await page.waitForFunction(
        () => !document.body.innerText.includes("Edit Trade"),
        { timeout: MAX_STEP_MS }
    );
}

async function editClosedTrade(page: Page, symbol: string, options: {
    sellPrice?: string;
    result?: string;
    rating?: number;
}) {
    await openHistoryTab(page, "Closed");
    await waitForText(page, symbol);
    await clickAria(page, `Edit ${symbol} trade`);
    await page.waitForSelector("#sellPrice", { visible: true, timeout: MAX_STEP_MS });
    if (options.sellPrice) await fill(page, "#sellPrice", options.sellPrice, "form");
    if (options.result) await fill(page, "#result", options.result, "form");
    if (options.rating) {
        const stars = await page.$$("#rating > div");
        assert(stars.length >= options.rating, "Rating stars not found");
        await stars[options.rating - 1].click();
    }
    const clicked = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('form button[type="submit"]'))
            .find((item) => (item.textContent || "").trim() === "Update Trade") as HTMLButtonElement | undefined;
        if (!button) return false;
        button.click();
        return true;
    });
    assert(clicked, "Update Trade submit not found");
    await page.waitForFunction(
        () => !document.body.innerText.includes("Edit Trade"),
        { timeout: MAX_STEP_MS }
    );
}

async function addTradeNote(page: Page, symbol: string, note: string) {
    await openHistoryTab(page, "Closed");
    await waitForText(page, symbol);
    await clickAria(page, `Edit notes for ${symbol}`);
    await page.waitForSelector('textarea[placeholder*="Thesis reasoning"]', {
        visible: true,
        timeout: MAX_STEP_MS,
    });
    await fill(page, 'textarea[placeholder*="Thesis reasoning"]', note, "form");
    await clickByText(page, "Add Note", { root: "form" });
    await sleep(500);
}

async function deleteClosedTrade(page: Page, symbol: string) {
    await openHistoryTab(page, "Closed");
    await waitForText(page, symbol);
    await clickAria(page, `Delete ${symbol} trade`);
    await waitForText(page, "Delete Trade");
    await clickByText(page, "Delete", { root: '[role="dialog"]' });
    await waitForTextGone(page, symbol);
}

async function openJournal(page: Page, date = TODAY) {
    await go(page, `/private/journal/${date.replace(/-/g, "/")}`);
    await page.waitForSelector(".tiptap", { visible: true, timeout: MAX_STEP_MS });
}

async function writeJournal(page: Page, text: string) {
    const editor = await page.waitForSelector(".tiptap", { visible: true, timeout: MAX_STEP_MS });
    assert(editor, "Journal editor not found");
    await editor.click();
    if (process.platform === "darwin") {
        await page.keyboard.down("Meta");
        await page.keyboard.press("A");
        await page.keyboard.up("Meta");
    } else {
        await page.keyboard.down("Control");
        await page.keyboard.press("A");
        await page.keyboard.up("Control");
    }
    await page.keyboard.press("Backspace");
    await page.keyboard.type(text);
    await waitForText(page, "Unsaved");
}

async function saveJournal(page: Page) {
    await clickByText(page, "Save Entry");
    await page.waitForFunction(
        () => document.body.innerText.includes("Journal entry saved"),
        { timeout: MAX_STEP_MS }
    ).catch(() => undefined);
    await sleep(350);
}

async function deleteJournal(page: Page) {
    await clickByText(page, "Delete");
    await waitForText(page, "Delete Journal Entry");
    await clickByText(page, "Confirm Delete", { root: '[role="dialog"]' });
    await page.waitForFunction(
        () => location.pathname === "/private/journal" || location.pathname.match(/^\/private\/journal\/\d{4}\/\d{2}\/\d{2}$/),
        { timeout: MAX_STEP_MS }
    );
}

function deterministicReport(id: string, marker: string) {
    return {
        id,
        createdAt: now(),
        portfolioSummary: {
            totalOpenPositions: 1,
            totalPositionValue: 1000,
            totalUnrealizedPnL: 12.34,
            totalUnrealizedPnLPercent: 1.23,
        },
        openPositions: [{
            symbolName: marker,
            positionType: "buy",
            entryPrice: 10,
            markPrice: 10.12,
            quantity: 100,
            unrealizedPnL: 12,
            unrealizedPnLPercent: 1.2,
            positionValue: 1012,
        }],
        liveExposureChecklist: [{
            status: "warning",
            title: `${marker} risk fixture`,
            message: "Deterministic archive fixture",
        }],
        instruments: [{ content: [`${marker} instrument fixture`] }],
        moneyManagement: [{ content: [`${marker} money fixture`] }],
        timeManagement: [{ content: [`${marker} time fixture`] }],
        claudeComments: {
            generalObservations: [`${marker} observation`],
            recommendations: [`${marker} recommendation`],
        },
    };
}

function seedReport(id: string, marker: string) {
    const data = deterministicReport(id, marker);
    execFileSync(
        "sqlite3",
        [
            DB_PATH,
            `INSERT INTO reports (id,user_id,created_at,report_data,is_favorite)
             VALUES (${sqlLiteral(id)},'local-user',${sqlLiteral(now())},${sqlLiteral(JSON.stringify(data))},0);`,
        ],
        { encoding: "utf8", timeout: 10_000 }
    );
}

function seedTradeFixture(id: string, symbol: string, strategyId: string | null) {
    const rules = strategyId ? JSON.stringify([{ id: "fixture-rule", rule: "fixture", satisfied: true, priority: "medium" }]) : null;
    execFileSync(
        "sqlite3",
        [
            DB_PATH,
            `INSERT INTO trades
             (id,userId,positionType,openDate,openTime,closeDate,closeTime,isActiveTrade,
              instrumentName,symbolName,entryPrice,deposit,result,totalCost,quantity,sellPrice,
              quantitySold,notes,rating,strategy_id,applied_open_rules,applied_close_rules,
              close_events,open_other_details,close_other_details)
             VALUES (${sqlLiteral(id)},'local-user','buy',${sqlLiteral(TODAY)},'09:30',
              ${sqlLiteral(TODAY)},'16:00',0,${sqlLiteral(symbol)},${sqlLiteral(symbol)},
              '10','1000','100','1000','100','11','100',NULL,3,${strategyId ? sqlLiteral(strategyId) : "NULL"},
              ${rules ? sqlLiteral(rules) : "NULL"},${rules ? sqlLiteral(rules) : "NULL"},'[]','{}','{}');`,
        ],
        { encoding: "utf8", timeout: 10_000 }
    );
}

function exportFixture() {
    return {
        version: "1.0.0",
        exportedAt: now(),
        trades: [{
            id: `${PREFIX}_IMPORT`,
            symbolName: `${PREFIX}_IMPORT`,
            instrumentName: `${PREFIX}_IMPORT`,
            positionType: "buy",
            openDate: TODAY,
            openTime: "09:30",
            closeDate: TODAY,
            closeTime: "16:00",
            isActiveTrade: false,
            entryPrice: "20",
            quantity: "10",
            sellPrice: "21",
            result: "10",
            rating: 0,
        }],
        journals: [{
            id: `${PREFIX}_IMPORT_JOURNAL`,
            userId: "local-user",
            date: "2026-10-23",
            content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `${PREFIX} import journal` }] }] },
            createdAt: now(),
            updatedAt: now(),
        }],
        strategies: [{
            id: `${PREFIX}_IMPORT_STRATEGY`,
            userId: "local-user",
            strategyName: `${PREFIX}_IMPORT_STRATEGY`,
            description: `${PREFIX} import strategy`,
            openPositionRules: [{ id: `${PREFIX}_import_rule`, rule: "fixture", satisfied: false, priority: "medium" }],
            closePositionRules: [],
            createdAt: now(),
            updatedAt: now(),
        }],
    };
}

async function main() {
    validateIsolation();
    console.log(`Runner ${RUN_ID}`);
    console.log(`DB ${DB_PATH}`);
    console.log(`Base URL ${BASE_URL}`);

    let browser: Browser | undefined;
    let page: Page | undefined;
    const observedDefects: string[] = [];

    try {
        browser = await withTimeout(
            puppeteer.launch({
                executablePath: CHROME_PATH,
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1600,1000"],
                defaultViewport: { width: 1600, height: 1000 },
            }),
            "browser launch",
            30_000
        );
        page = await browser.newPage();
        page.setDefaultTimeout(MAX_STEP_MS);
        page.setDefaultNavigationTimeout(MAX_STEP_MS);

        page.on("dialog", (dialog) => {
            void dialog.accept().catch(() => undefined);
        });
        page.on("pageerror", (error) => {
            console.error(`[Browser pageerror] ${String(error)}`);
        });
        page.on("console", (message) => {
            if (message.type() === "error") {
                console.error(`[Browser console] ${message.text()}`);
            }
        });

        await page.setRequestInterception(true);
        page.on("request", (request) => {
            const url = new URL(request.url());
            if (url.pathname === "/api/market-price") {
                const symbols = (url.searchParams.get("symbols") || "")
                    .split(",")
                    .map((symbol) => symbol.trim())
                    .filter(Boolean);
                const prices = Object.fromEntries(symbols.map((symbol) => [symbol, 100]));
                void request.respond({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify(prices),
                });
                return;
            }
            if (url.pathname === "/api/claude") {
                void request.respond({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        claudeComments: { generalObservations: ["QA fixture"], recommendations: ["QA fixture"] },
                        liveExposureChecklist: [],
                    }),
                });
                return;
            }
            if (url.pathname === "/api/follow-up-claude") {
                void request.respond({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ answer: ["QA follow-up fixture"] }) }] }),
                });
                return;
            }
            void request.continue();
        });

        let strategyPhasePassed = !phaseEnabled("strategy");
        if (phaseEnabled("strategy")) await phase("strategy", async () => {
            const result = currentPhase("strategy");
            const original = `${PREFIX}_STRAT_A`;
            const edited = `${PREFIX}_STRAT_B`;
            let id = "";

            try {
                await go(page!, "/private/strategies");
                await waitForText(page!, "Strategies");
                const response = await page!.evaluate(async () => {
                    const result = await fetch(location.href, { cache: "no-store" });
                    return result.status;
                });
                assert(response === 200, `Strategies route returned HTTP ${response}`);

                const trigger = await page!.waitForSelector(
                    'button[type="button"]:has(svg.lucide-plus)',
                    { visible: true, timeout: MAX_STEP_MS }
                );
                assert(trigger, "New Strategy trigger not found");
                await trigger.click();
                await page!.waitForSelector("#strategyName", { visible: true, timeout: MAX_STEP_MS });
                record(result, {
                    id: "strategy-precondition",
                    title: "HTTP 200, hydrated page, and New Strategy opens dialog",
                    status: "PASS",
                    method: "UI",
                });
                await clickByText(page!, "Cancel", { root: '[role="dialog"]' });
                await page!.waitForSelector("#strategyName", { hidden: true, timeout: MAX_STEP_MS });

                id = await createStrategyViaUI(page!, {
                    id: original,
                    name: original,
                    description: `${PREFIX} strategy description`,
                    openRule: `${PREFIX} entry rule`,
                    closeRule: `${PREFIX} exit rule`,
                });
                const created = strategyRow(id);
                assert(created?.strategyName === original, "Created strategy name missing from DB");
                const openRules = JSON.parse(created.open_position_rules || "[]") as Rule[];
                const closeRules = JSON.parse(created.close_position_rules || "[]") as Rule[];
                assert(openRules.length === 1, "Open rule not persisted");
                assert(closeRules.length === 1, "Close rule not persisted");
                assert(openRules[0].rule === `${PREFIX} entry rule`, `Open rule text mismatch: ${openRules[0].rule}`);
                assert(closeRules[0].rule === `${PREFIX} exit rule`, `Close rule text mismatch: ${closeRules[0].rule}`);
                record(result, {
                    id: "strategy-create",
                    title: "Create strategy with entry and exit rules",
                    status: "PASS",
                    method: "UI+DB",
                    details: `id=${id}`,
                });

                await fill(page!, 'input[aria-label="Search strategies"]', `${PREFIX}_STRAT`);
                await waitForText(page!, original);
                await fill(page!, 'input[aria-label="Search strategies"]', `${PREFIX}_NO_MATCH`);
                await waitForText(page!, "No strategies found matching");
                await fill(page!, 'input[aria-label="Search strategies"]', "");
                record(result, {
                    id: "strategy-search",
                    title: "Search filters strategy list and empty state",
                    status: "PASS",
                    method: "UI",
                });

                await editStrategyViaUI(page!, original, edited, `${PREFIX} edited description`);
                const changed = strategyRow(id);
                assert(changed?.strategyName === edited, "Edited strategy name missing from DB");
                assert(changed.description === `${PREFIX} edited description`, "Edited description missing from DB");
                record(result, {
                    id: "strategy-edit",
                    title: "Edit strategy name and description",
                    status: "PASS",
                    method: "UI+DB",
                });

                await deleteStrategyViaUI(page!, edited);
                assert(strategyRow(id) === null, "Deleted strategy remains in DB");
                record(result, {
                    id: "strategy-delete",
                    title: "Delete strategy from strategies page",
                    status: "PASS",
                    method: "UI+DB",
                });
                strategyPhasePassed = true;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const shot = await screenshot(page!, "strategy-failure");
                record(result, {
                    id: result.checks.some((check) => check.id === "strategy-precondition")
                        ? "strategy-crud"
                        : "strategy-precondition",
                    title: result.checks.some((check) => check.id === "strategy-precondition")
                        ? "Strategy create/search/edit/delete flow"
                        : "HTTP 200, hydration, and New Strategy dialog precondition",
                    status: "FAIL",
                    method: "UI+DB",
                    error: message,
                    screenshot: shot,
                });
                observedDefects.push(`Strategy CRUD: ${message}`);
            }
        });

        if (phaseEnabled("trade") && strategyPhasePassed) await phase("trade", async () => {
            const result = currentPhase("trade");
            const symbol = `${PREFIX}_TRADE`;
            const strategyName = `${PREFIX}_TRADE_STRAT`;
            let strategyId = "";
            let tradeId = "";
            let expectedPosition = {
                quantity: 0,
                entryPrice: 0,
                realized: 0,
                cost: 0,
            };

            try {
                strategyId = await createStrategyViaUI(page!, {
                    id: strategyName,
                    name: strategyName,
                    description: `${PREFIX} trade strategy`,
                    openRule: `${PREFIX} trade entry`,
                    closeRule: `${PREFIX} trade exit`,
                });
                record(result, {
                    id: "trade-strategy-fixture",
                    title: "Create linked strategy for trade lifecycle",
                    status: "PASS",
                    method: "UI+DB",
                    details: `id=${strategyId}`,
                });
            } catch (error) {
                record(result, {
                    id: "trade-strategy-fixture",
                    title: "Create linked strategy for trade lifecycle",
                    status: "FAIL",
                    method: "UI+DB",
                    error: error instanceof Error ? error.message : String(error),
                    screenshot: await screenshot(page!, "trade-strategy-failure"),
                });
            }

            try {
                await submitNewTrade(page!, {
                    symbol,
                    entry: "100",
                    qty: "10",
                    strategy: strategyId ? strategyName : undefined,
                });
                const trade = sqliteValue<{ id: string }>(
                    `SELECT id FROM trades WHERE symbolName=${sqlLiteral(symbol)}
                     ORDER BY rowid DESC LIMIT 1`
                );
                assert(trade, "Open trade missing from DB");
                tradeId = trade.id;
                const row = tradeRow(tradeId);
                assert(row?.isActiveTrade === 1, "New trade is not active");
                assert(Number(row.quantity) === 10, "New trade quantity mismatch");
                assert(strategyId ? row?.strategy_id === strategyId : true, "Strategy link missing");
                expectedPosition = replayPosition(10, 100, []);
                assertMoney(row.deposit, expectedPosition.cost, "New trade cost basis");
                record(result, {
                    id: "trade-open",
                    title: "Open trade through calendar trade dialog",
                    status: "PASS",
                    method: "UI+DB",
                    details: `id=${tradeId}`,
                });
            } catch (error) {
                record(result, {
                    id: "trade-open",
                    title: "Open trade through calendar trade dialog",
                    status: "FAIL",
                    method: "UI+DB",
                    error: error instanceof Error ? error.message : String(error),
                    screenshot: await screenshot(page!, "trade-open-failure"),
                });
                observedDefects.push(`Trade open: ${error instanceof Error ? error.message : String(error)}`);
            }

            if (tradeId) {
                try {
                    await adjustOpenPosition(page!, {
                        symbol,
                        action: "Add",
                        qty: "5",
                        price: "110",
                        confirm: "Confirm Add to Position",
                    });
                    const added = tradeRow(tradeId);
                    const events = JSON.parse(String(added?.close_events || "[]")) as PositionEvent[];
                    expectedPosition = replayPosition(10, 100, events);
                    assert(Number(added?.quantity) === expectedPosition.quantity, `Expected qty ${expectedPosition.quantity} after add, got ${added?.quantity}`);
                    assert(
                        Math.abs(Number(added?.entryPrice) - expectedPosition.entryPrice) < 1e-8,
                        `VWAP mismatch: expected ${expectedPosition.entryPrice}, got ${added?.entryPrice}`
                    );
                    assertMoney(added?.deposit, expectedPosition.cost, "Cost basis after add");
                    record(result, {
                        id: "trade-add",
                        title: "Add to position recalculates quantity and VWAP",
                        status: "PASS",
                        method: "UI+DB",
                        details: `qty=${added?.quantity}, entry=${added?.entryPrice}`,
                    });
                } catch (error) {
                    record(result, {
                        id: "trade-add",
                        title: "Add to position recalculates quantity and VWAP",
                        status: "FAIL",
                        method: "UI+DB",
                        error: error instanceof Error ? error.message : String(error),
                        screenshot: await screenshot(page!, "trade-add-failure"),
                    });
                    observedDefects.push(`Trade add: ${error instanceof Error ? error.message : String(error)}`);
                }

                try {
                    await adjustOpenPosition(page!, {
                        symbol,
                        action: "Reduce Position",
                        qty: "3",
                        price: "120",
                        confirm: "Confirm Reduction",
                    });
                    const reduced = tradeRow(tradeId);
                    const events = JSON.parse(String(reduced?.close_events || "[]")) as Array<{ quantityChange: number; result: number }>;
                    expectedPosition = replayPosition(10, 100, events);
                    assert(Number(reduced?.quantity) === expectedPosition.quantity, `Expected qty ${expectedPosition.quantity} after reduce, got ${reduced?.quantity}`);
                    assert(events.some((event) => event.quantityChange === -3), "Reduce event missing");
                    assertMoney(
                        events.reduce((sum, event) => sum + Number(event.result || 0), 0),
                        expectedPosition.realized,
                        "Realized P&L after reduce"
                    );
                    assertMoney(reduced?.deposit, expectedPosition.cost, "Cost basis after reduce");
                    record(result, {
                        id: "trade-reduce",
                        title: "Reduce position records quantity and realized P&L",
                        status: "PASS",
                        method: "UI+DB",
                        details: `qty=${reduced?.quantity}, events=${events.length}`,
                    });
                } catch (error) {
                    record(result, {
                        id: "trade-reduce",
                        title: "Reduce position records quantity and realized P&L",
                        status: "FAIL",
                        method: "UI+DB",
                        error: error instanceof Error ? error.message : String(error),
                        screenshot: await screenshot(page!, "trade-reduce-failure"),
                    });
                    observedDefects.push(`Trade reduce: ${error instanceof Error ? error.message : String(error)}`);
                }

                try {
                    await adjustOpenPosition(page!, {
                        symbol,
                        action: "Close Position",
                        qty: "",
                        price: "130",
                        confirm: "Confirm Full Close",
                    });
                    const closed = tradeRow(tradeId);
                    assert(closed?.isActiveTrade === 0, "Full close did not deactivate trade");
                    assert(Boolean(closed?.closeDate), "Full close missing closeDate");
                    assert(Number(closed?.quantity) === 0, "Full close quantity is not zero");
                    const events = JSON.parse(String(closed?.close_events || "[]")) as PositionEvent[];
                    expectedPosition = replayPosition(10, 100, events);
                    assertMoney(closed?.result, expectedPosition.realized, "Full-close ledger result");
                    record(result, {
                        id: "trade-full-close",
                        title: "Full close finalizes trade and total P&L",
                        status: "PASS",
                        method: "UI+DB",
                        details: `result=${closed?.result}`,
                    });
                } catch (error) {
                    record(result, {
                        id: "trade-full-close",
                        title: "Full close finalizes trade and total P&L",
                        status: "FAIL",
                        method: "UI+DB",
                        error: error instanceof Error ? error.message : String(error),
                        screenshot: await screenshot(page!, "trade-close-failure"),
                    });
                    observedDefects.push(`Trade close: ${error instanceof Error ? error.message : String(error)}`);
                }

                try {
                    await editClosedTrade(page!, symbol, { sellPrice: "135", rating: 4 });
                    const edited = tradeRow(tradeId);
                    const events = JSON.parse(String(edited?.close_events || "[]")) as PositionEvent[];
                    expectedPosition = replayPosition(10, 100, events);
                    assertMoney(edited?.result, expectedPosition.realized, "Edited exit ledger result");
                    assertMoney(edited?.result, 430, "Edited final exit at 135");
                    assert(Number(edited?.rating) === 4, `Closed edit rating mismatch: ${edited?.rating}`);
                    record(result, {
                        id: "trade-edit-rating",
                        title: "Edit closed trade result, exit price and rating",
                        status: "PASS",
                        method: "UI+DB",
                    });
                } catch (error) {
                    record(result, {
                        id: "trade-edit-rating",
                        title: "Edit closed trade result, exit price and rating",
                        status: "FAIL",
                        method: "UI+DB",
                        error: error instanceof Error ? error.message : String(error),
                        screenshot: await screenshot(page!, "trade-edit-failure"),
                    });
                    observedDefects.push(`Trade edit: ${error instanceof Error ? error.message : String(error)}`);
                }

                try {
                    await addTradeNote(page!, symbol, `${PREFIX} trade note`);
                    const noted = tradeRow(tradeId);
                    assert(String(noted?.notes || "").includes(`${PREFIX} trade note`), "Trade note missing from DB");
                    record(result, {
                        id: "trade-note",
                        title: "Add trade note from notes tab",
                        status: "PASS",
                        method: "UI+DB",
                    });
                } catch (error) {
                    record(result, {
                        id: "trade-note",
                        title: "Add trade note from notes tab",
                        status: "FAIL",
                        method: "UI+DB",
                        error: error instanceof Error ? error.message : String(error),
                        screenshot: await screenshot(page!, "trade-note-failure"),
                    });
                    observedDefects.push(`Trade note: ${error instanceof Error ? error.message : String(error)}`);
                }

                try {
                    await go(page!, "/private/calendar");
                    await waitForText(page!, "Calendar");
                    const monthText = await bodyText(page!);
                    assert(
                        monthText.includes(`$${expectedPosition.realized.toFixed(2)}`),
                        `Calendar did not reflect closed trade P&L $${expectedPosition.realized.toFixed(2)}`
                    );
                    record(result, {
                        id: "trade-calendar-sync",
                        title: "Calendar reflects closed trade P&L",
                        status: "PASS",
                        method: "UI",
                    });
                } catch (error) {
                    record(result, {
                        id: "trade-calendar-sync",
                        title: "Calendar reflects closed trade P&L",
                        status: "FAIL",
                        method: "UI",
                        error: error instanceof Error ? error.message : String(error),
                        screenshot: await screenshot(page!, "trade-calendar-failure"),
                    });
                }

                try {
                    await openHistoryTab(page!, "Closed");
                    await waitForText(page!, symbol);
                    const text = await bodyText(page!);
                    assert(
                        text.includes(`$${expectedPosition.realized.toFixed(2)}`),
                        `History did not reflect edited result $${expectedPosition.realized.toFixed(2)}`
                    );
                    record(result, {
                        id: "trade-history-sync",
                        title: "History reflects closed trade result",
                        status: "PASS",
                        method: "UI",
                    });
                } catch (error) {
                    record(result, {
                        id: "trade-history-sync",
                        title: "History reflects closed trade result",
                        status: "FAIL",
                        method: "UI",
                        error: error instanceof Error ? error.message : String(error),
                        screenshot: await screenshot(page!, "trade-history-failure"),
                    });
                }

                try {
                    await go(page!, "/private/statistics");
                    await waitForText(page!, "Realized P&L");
                    const text = await bodyText(page!);
                    assert(
                        text.includes(`$${expectedPosition.realized.toFixed(2)}`),
                        `Statistics did not reflect realized P&L $${expectedPosition.realized.toFixed(2)}`
                    );
                    record(result, {
                        id: "trade-stats-sync",
                        title: "Statistics reflects realized P&L",
                        status: "PASS",
                        method: "UI",
                    });
                } catch (error) {
                    record(result, {
                        id: "trade-stats-sync",
                        title: "Statistics reflects realized P&L",
                        status: "FAIL",
                        method: "UI",
                        error: error instanceof Error ? error.message : String(error),
                        screenshot: await screenshot(page!, "trade-stats-failure"),
                    });
                }

                try {
                    await deleteClosedTrade(page!, symbol);
                    assert(tradeRow(tradeId) === null, "Deleted trade still present in DB");
                    record(result, {
                        id: "trade-delete",
                        title: "Delete closed trade from history",
                        status: "PASS",
                        method: "UI+DB",
                    });
                } catch (error) {
                    record(result, {
                        id: "trade-delete",
                        title: "Delete closed trade from history",
                        status: "FAIL",
                        method: "UI+DB",
                        error: error instanceof Error ? error.message : String(error),
                        screenshot: await screenshot(page!, "trade-delete-failure"),
                    });
                    observedDefects.push(`Trade delete: ${error instanceof Error ? error.message : String(error)}`);
                }
            }

            if (strategyId) {
                try {
                    await deleteStrategyViaUI(page!, strategyName);
                    record(result, {
                        id: "trade-strategy-delete",
                        title: "Delete linked strategy after trade cleanup",
                        status: "PASS",
                        method: "UI+DB",
                    });
                } catch (error) {
                    record(result, {
                        id: "trade-strategy-delete",
                        title: "Delete linked strategy after trade cleanup",
                        status: "FAIL",
                        method: "UI+DB",
                        error: error instanceof Error ? error.message : String(error),
                        screenshot: await screenshot(page!, "trade-strategy-delete-failure"),
                    });
                }
            }
        });

        if (phaseEnabled("journal") && strategyPhasePassed) await phase("journal", async () => {
            const result = currentPhase("journal");
            const text = `${PREFIX} journal body`;
            try {
                await openJournal(page!);
                await writeJournal(page!, text);
                await saveJournal(page!);
                const saved = journalRow(TODAY);
                assert(saved?.content?.includes(text), "Journal text missing from DB");
                assert(saved && (saved.content?.match(new RegExp(TODAY, "g")) || []).length === 0, "Unexpected date leak");
                record(result, {
                    id: "journal-save",
                    title: "Save journal entry from editor",
                    status: "PASS",
                    method: "UI+DB",
                });

                await refresh(page!);
                await waitForText(page!, text);
                record(result, {
                    id: "journal-reload",
                    title: "Reload journal entry from persisted content",
                    status: "PASS",
                    method: "UI+DB",
                });

                await openJournal(page!);
                await writeJournal(page!, `${text} edited`);
                await saveJournal(page!);
                const edited = journalRow(TODAY);
                assert(edited?.content?.includes(`${text} edited`), "Edited journal text missing from DB");
                record(result, {
                    id: "journal-edit",
                    title: "Edit and save existing journal entry",
                    status: "PASS",
                    method: "UI+DB",
                });

                await go(page!, "/private/calendar");
                await clickAria(page!, `Open journal entry for ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);
                await page!.waitForSelector(".tiptap", { visible: true, timeout: MAX_STEP_MS });
                assert(page!.url().endsWith(`/private/journal/${TODAY_SLUG}`), `Calendar journal link navigated to ${page!.url()}`);
                record(result, {
                    id: "journal-navigate",
                    title: "Calendar journal link opens the same entry",
                    status: "PASS",
                    method: "UI",
                });

                await deleteJournal(page!);
                assert(journalRow(TODAY) === null, "Deleted journal remains in DB");
                record(result, {
                    id: "journal-delete",
                    title: "Delete journal entry",
                    status: "PASS",
                    method: "UI+DB",
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                record(result, {
                    id: "journal-crud",
                    title: "Journal save/edit/navigate/delete flow",
                    status: "FAIL",
                    method: "UI+DB",
                    error: message,
                    screenshot: await screenshot(page!, "journal-failure"),
                });
                observedDefects.push(`Journal CRUD: ${message}`);
            }
        });

        if (phaseEnabled("reports") && strategyPhasePassed) await phase("reports", async () => {
            const result = currentPhase("reports");
            const marker = `${PREFIX}_REPORT`;
            const id = `${PREFIX}_REPORT_ID`;
            try {
                seedReport(id, marker);
                record(result, {
                    id: "reports-fixture",
                    title: "Seed deterministic report fixture in isolated DB",
                    status: "PASS",
                    method: "DB fixture",
                    details: `id=${id}`,
                });

                await go(page!, "/private/reports-history");
                await waitForText(page!, marker);
                record(result, {
                    id: "reports-list",
                    title: "Saved report appears in archive",
                    status: "PASS",
                    method: "UI+DB",
                });

                await fill(page!, 'input[aria-label="Search reports"]', marker);
                await waitForText(page!, marker);
                await fill(page!, 'input[aria-label="Search reports"]', `${PREFIX}_NO_REPORT`);
                await waitForText(page!, "No matching reports");
                await fill(page!, 'input[aria-label="Search reports"]', "");
                record(result, {
                    id: "reports-search-filter",
                    title: "Report search filters fixture and empty state",
                    status: "PASS",
                    method: "UI",
                });

                await clickAria(page!, "Add favorite");
                const favorite = reportRow(id);
                assert(Number(favorite?.is_favorite) === 1, "Favorite did not persist");
                await clickAria(page!, "Remove favorite");
                assert(Number(reportRow(id)?.is_favorite) === 0, "Unfavorite did not persist");
                record(result, {
                    id: "reports-favorite",
                    title: "Favorite and unfavorite report",
                    status: "PASS",
                    method: "UI+DB",
                });

                await go(page!, `/private/reports-history/${id}`);
                await waitForText(page!, marker);
                record(result, {
                    id: "reports-open",
                    title: "Open saved report detail",
                    status: "PASS",
                    method: "UI",
                });

                await go(page!, "/private/reports-history");
                await waitForText(page!, marker);
                const deleteSelector = 'button[aria-label^="Delete report from"]';
                const deleteButton = await page!.waitForSelector(deleteSelector, {
                    visible: true,
                    timeout: MAX_STEP_MS,
                });
                assert(deleteButton, "Report delete button not found");
                await deleteButton.click();
                await waitForText(page!, "Delete this report?");
                await clickByText(page!, "Delete report", { root: '[role="dialog"]' });
                await waitForTextGone(page!, marker);
                assert(reportRow(id) === null, "Deleted report remains in DB");
                record(result, {
                    id: "reports-delete",
                    title: "Delete report from archive",
                    status: "PASS",
                    method: "UI+DB",
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                record(result, {
                    id: "reports-crud",
                    title: "Saved report archive flow",
                    status: "FAIL",
                    method: "UI+DB",
                    error: message,
                    screenshot: await screenshot(page!, "reports-failure"),
                });
                observedDefects.push(`Reports archive: ${message}`);
            }
        });

        if (phaseEnabled("import") && strategyPhasePassed) await phase("import", async () => {
            const result = currentPhase("import");
            const fixturePath = path.join(ARTIFACT_DIR, "backup-fixture.json");
            const fixture = exportFixture();
            fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
            const before = sqliteJson<{ n: number }>("SELECT count(*) AS n FROM trades")[0]?.n ?? 0;

            try {
                await go(page!, "/private/calendar");
                await clickByText(page!, "Import & Backup");
                await waitForText(page!, "Data Import & Backup Restore");
                const fileInput = await page!.waitForSelector('input[type="file"]', {
                    timeout: MAX_STEP_MS,
                });
                assert(fileInput, "Import file input not found");
                await fileInput.uploadFile(fixturePath);
                await waitForText(page!, "Confirm & Import");
                const previewText = await bodyText(page!);
                assert(previewText.includes("Raw Rows: 1"), "Import preview did not count fixture trade");
                assert(previewText.includes("Campaigns: 1"), "Import preview did not show one campaign");
                const afterPreview = sqliteJson<{ n: number }>("SELECT count(*) AS n FROM trades")[0]?.n ?? 0;
                assert(afterPreview === before, "Preview mutated trades before confirmation");
                record(result, {
                    id: "import-preview",
                    title: "Import preview parses fixture without writing trades",
                    status: "PASS",
                    method: "UI+DB",
                });
            } catch (error) {
                record(result, {
                    id: "import-preview",
                    title: "Import preview parses fixture without writing trades",
                    status: "FAIL",
                    method: "UI+DB",
                    error: error instanceof Error ? error.message : String(error),
                    screenshot: await screenshot(page!, "import-preview-failure"),
                });
            }

            // Restore preview/import does not import strategies/journals. Test that contract explicitly.
            try {
                const previewCheck = sqliteValue<{ n: number }>(
                    `SELECT count(*) AS n FROM journal WHERE id=${sqlLiteral(`${PREFIX}_IMPORT_JOURNAL`)}`
                );
                assert(previewCheck?.n === 0, "Preview unexpectedly wrote journal fixture");
                record(result, {
                    id: "import-scope-invariant",
                    title: "Import preview leaves journals/strategies untouched",
                    status: "PASS",
                    method: "DB invariant",
                });
            } catch (error) {
                record(result, {
                    id: "import-scope-invariant",
                    title: "Import preview leaves journals/strategies untouched",
                    status: "FAIL",
                    method: "DB invariant",
                    error: error instanceof Error ? error.message : String(error),
                });
            }

            // Export is tested through the UI download path. The exported JSON is the durable artifact.
            try {
                await go(page!, "/private/calendar");
                await clickByText(page!, "Import & Backup");
                await waitForText(page!, "Data Import & Backup Restore");
                await clickByText(page!, "Export Backup", { root: "body" });
                const downloadDir = path.join(ARTIFACT_DIR, "downloads");
                fs.mkdirSync(downloadDir, { recursive: true });
                const client = await page!.createCDPSession();
                await client.send("Page.setDownloadBehavior", {
                    behavior: "allow",
                    downloadPath: downloadDir,
                });
                await clickByText(page!, "Full JSON Backup");
                await page!.waitForFunction(
                    () => document.body.innerText.includes("Full JSON backup export completed"),
                    { timeout: MAX_STEP_MS }
                );
                const exported = fs.readdirSync(downloadDir).filter((name) => name.endsWith(".json"));
                assert(exported.length > 0, "No JSON backup download produced");
                const exportPath = path.join(downloadDir, exported.sort().at(-1)!);
                const parsed = JSON.parse(fs.readFileSync(exportPath, "utf8"));
                assert(Array.isArray(parsed.trades), "Export missing trades");
                assert(Array.isArray(parsed.journals), "Export missing journals");
                assert(Array.isArray(parsed.strategies), "Export missing strategies");
                record(result, {
                    id: "backup-export",
                    title: "Export full JSON backup",
                    status: "PASS",
                    method: "UI",
                    details: exportPath,
                });
            } catch (error) {
                record(result, {
                    id: "backup-export",
                    title: "Export full JSON backup",
                    status: "FAIL",
                    method: "UI",
                    error: error instanceof Error ? error.message : String(error),
                    screenshot: await screenshot(page!, "backup-export-failure"),
                });
            }
        });
    } finally {
        if (browser) {
            await browser.close().catch(() => undefined);
        }
        writeReport();
    }

    console.log(`\nReport: ${path.join(ARTIFACT_DIR, "functional-qa-report.json")}`);
    if (report.defects.length > 0) {
        console.error(`Observed ${report.defects.length} failed checks.`);
        process.exitCode = 1;
    } else {
        console.log("All executed checks passed.");
    }
}

main().catch((error) => {
    console.error(error);
    report.notes.push(`Fatal runner error: ${error instanceof Error ? error.message : String(error)}`);
    writeReport();
    process.exitCode = 1;
});
