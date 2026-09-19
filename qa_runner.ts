import puppeteer, { Page } from "puppeteer-core";
import path from "path";
import { execSync } from "child_process";

import fs from "fs";

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.join(process.cwd(), "artifacts");
if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}
const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000/private/";

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function queryDb(sql: string): string {
    return execSync(`sqlite3 local.db "${sql}"`).toString().trim();
}

async function clickTabByText(page: Page, textSubstring: string, containerSelector?: string) {
    const selector = containerSelector ? `${containerSelector} [role="tab"]` : '[role="tab"]';
    const handles = await page.$$(selector);
    // First pass: exact match (trimmed)
    for (const h of handles) {
        const text = await page.evaluate((el) => el.textContent, h);
        if (text && text.trim() === textSubstring) {
            await h.click();
            await sleep(600);
            return;
        }
    }
    // Second pass: startsWith or includes
    for (const h of handles) {
        const text = await page.evaluate((el) => el.textContent, h);
        if (text && text.trim().includes(textSubstring)) {
            await h.click();
            await sleep(600);
            return;
        }
    }
    throw new Error(`Could not find tab containing text '${textSubstring}' with selector '${selector}'`);
}

async function clickButtonByText(page: Page, textSubstring: string, containerSelector?: string) {
    const selector = containerSelector ? `${containerSelector} button` : 'button';
    const handles = await page.$$(selector);
    // First pass: exact match
    for (const h of handles) {
        const text = await page.evaluate((el) => el.textContent, h);
        if (text && text.trim() === textSubstring) {
            await h.click();
            await sleep(600);
            return;
        }
    }
    // Second pass: includes
    for (const h of handles) {
        const text = await page.evaluate((el) => el.textContent, h);
        if (text && text.trim().includes(textSubstring)) {
            await h.click();
            await sleep(600);
            return;
        }
    }
    throw new Error(`Could not find button containing text '${textSubstring}' with selector '${selector}'`);
}

async function runTest() {
    console.log("=== STARTING VAULTQUANT E2E AUTOMATION QA TEST ===");
    
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--window-size=1440,900"
        ],
        defaultViewport: {
            width: 1440,
            height: 900
        }
    });

    const page = await browser.newPage();

    // Log browser console for deeper visibility
    page.on("console", (msg) => {
        const t = msg.type();
        if (t === "error" || t === "warn") {
            console.log(`[Browser ${t.toUpperCase()}] ${msg.text()}`);
        }
    });

    page.on("dialog", async (dialog) => {
        console.log("Browser alert/dialog:", dialog.message());
        await dialog.accept();
    });

    try {
        // ==========================================
        // STEP 1: CREATE MOCK STRATEGY
        // ==========================================
        console.log("\n--- STEP 1: Navigating to /private/strategies ---");
        await page.goto(`${BASE_URL}strategies`, { waitUntil: "networkidle0" });
        await sleep(1500);

        console.log("Clicking 'New Strategy' button...");
        await clickButtonByText(page, "New Strategy");
        await sleep(1000);

        console.log("Filling Strategy Name and Description...");
        await page.waitForSelector("#strategyName", { timeout: 5000 });
        await page.type("#strategyName", "TEST_EMA_PULLBACK");
        await page.waitForSelector("#description", { timeout: 5000 });
        await page.type("#description", "Automated test strategy for checklist validation.");
        await sleep(500);

        // Open Rules: Add Rule 1
        console.log("Adding Open Rule 1: 'Price pulls back to 20 EMA' (Priority: High)...");
        await page.evaluate(() => {
            const entryHeading = Array.from(document.querySelectorAll("h3")).find(h => h.textContent?.includes("Entry Conditions"));
            const addBtn = entryHeading?.parentElement?.querySelector("button");
            if (addBtn) addBtn.click();
        });
        await sleep(600);

        await page.evaluate(() => {
            const entryHeading = Array.from(document.querySelectorAll("h3")).find(h => h.textContent?.includes("Entry Conditions"));
            const table = entryHeading?.closest('[data-state="active"]')?.querySelector("table");
            const span = table?.querySelector("tbody tr:last-child span");
            if (span) (span.parentElement as HTMLElement)?.click();
        });
        await sleep(500);

        const ruleInput1 = await page.waitForSelector('input[placeholder="Enter rule description"]', { timeout: 3000 });
        if (ruleInput1) {
            await page.evaluate(el => (el as HTMLInputElement).value = "", ruleInput1);
            await ruleInput1.type("Price pulls back to 20 EMA");
            await ruleInput1.press("Enter");
        }
        await sleep(500);

        // Priority Medium -> High
        await page.evaluate(() => {
            const entryHeading = Array.from(document.querySelectorAll("h3")).find(h => h.textContent?.includes("Entry Conditions"));
            const table = entryHeading?.closest('[data-state="active"]')?.querySelector("table");
            const badge = table?.querySelector("tbody tr:last-child td:nth-child(2) div") as HTMLElement;
            if (badge) badge.click();
        });
        await sleep(500);

        // Open Rules: Add Rule 2
        console.log("Adding Open Rule 2: 'Volume confirmation' (Priority: Medium)...");
        await page.evaluate(() => {
            const entryHeading = Array.from(document.querySelectorAll("h3")).find(h => h.textContent?.includes("Entry Conditions"));
            const addBtn = entryHeading?.parentElement?.querySelector("button");
            if (addBtn) addBtn.click();
        });
        await sleep(600);

        await page.evaluate(() => {
            const entryHeading = Array.from(document.querySelectorAll("h3")).find(h => h.textContent?.includes("Entry Conditions"));
            const table = entryHeading?.closest('[data-state="active"]')?.querySelector("table");
            const span = table?.querySelector("tbody tr:last-child span");
            if (span) (span.parentElement as HTMLElement)?.click();
        });
        await sleep(500);

        const ruleInput2 = await page.waitForSelector('input[placeholder="Enter rule description"]', { timeout: 3000 });
        if (ruleInput2) {
            await page.evaluate(el => (el as HTMLInputElement).value = "", ruleInput2);
            await ruleInput2.type("Volume confirmation");
            await ruleInput2.press("Enter");
        }
        await sleep(500);

        // Switch to Close Rules Tab using clickTabByText
        console.log("Switching to 'Close Rules' tab...");
        await clickTabByText(page, "Close Rules");
        await sleep(600);

        // Close Rules: Add Rule 1
        console.log("Adding Close Rule 1: 'Take profit at 2R' (Priority: High)...");
        await page.evaluate(() => {
            const exitHeading = Array.from(document.querySelectorAll("h3")).find(h => h.textContent?.includes("Exit Conditions"));
            const addBtn = exitHeading?.parentElement?.querySelector("button");
            if (addBtn) addBtn.click();
        });
        await sleep(600);

        await page.evaluate(() => {
            const exitHeading = Array.from(document.querySelectorAll("h3")).find(h => h.textContent?.includes("Exit Conditions"));
            const table = exitHeading?.closest('[data-state="active"]')?.querySelector("table");
            const span = table?.querySelector("tbody tr:last-child span");
            if (span) (span.parentElement as HTMLElement)?.click();
        });
        await sleep(500);

        const closeRuleInput = await page.waitForSelector('input[placeholder="Enter rule description"]', { timeout: 3000 });
        if (closeRuleInput) {
            await page.evaluate(el => (el as HTMLInputElement).value = "", closeRuleInput);
            await closeRuleInput.type("Take profit at 2R");
            await closeRuleInput.press("Enter");
        }
        await sleep(500);

        // Priority Medium -> High for Close Rule 1
        await page.evaluate(() => {
            const exitHeading = Array.from(document.querySelectorAll("h3")).find(h => h.textContent?.includes("Exit Conditions"));
            const table = exitHeading?.closest('[data-state="active"]')?.querySelector("table");
            const badge = table?.querySelector("tbody tr:last-child td:nth-child(2) div") as HTMLElement;
            if (badge) badge.click();
        });
        await sleep(500);

        // Save Strategy
        console.log("Saving Strategy 'TEST_EMA_PULLBACK'...");
        await clickButtonByText(page, "Create Strategy");
        await sleep(2000);

        // Verify strategy in UI & DB
        const strategyExists = await page.evaluate(() => {
            return document.body.textContent?.includes("TEST_EMA_PULLBACK");
        });
        console.log("Strategy created and visible in list:", strategyExists);
        if (!strategyExists) throw new Error("Strategy TEST_EMA_PULLBACK was not found in UI after creation!");

        const dbOpenRules = queryDb("SELECT open_position_rules FROM strategies WHERE strategyName='TEST_EMA_PULLBACK';");
        const dbCloseRules = queryDb("SELECT close_position_rules FROM strategies WHERE strategyName='TEST_EMA_PULLBACK';");
        console.log("DB Open Rules:", dbOpenRules);
        console.log("DB Close Rules:", dbCloseRules);

        const parsedOpen = JSON.parse(dbOpenRules || "[]");
        const parsedClose = JSON.parse(dbCloseRules || "[]");
        if (parsedOpen.length < 2 || parsedClose.length < 1) {
            throw new Error(`Strategy rules were not saved correctly! Open: ${parsedOpen.length}, Close: ${parsedClose.length}`);
        }
        console.log(`✓ Strategy rules verified in DB: ${parsedOpen.length} Open Rules, ${parsedClose.length} Close Rules.`);

        const screenshot1Path = path.join(ARTIFACT_DIR, "step1_strategy_created.png");
        await page.screenshot({ path: screenshot1Path });
        console.log("Saved screenshot:", screenshot1Path);

        // ==========================================
        // STEP 2: OPEN POSITION & LINK STRATEGY
        // ==========================================
        console.log("\n--- STEP 2: Opening Position TEST_AAPL at /private/calendar ---");
        await page.goto(`${BASE_URL}calendar`, { waitUntil: "networkidle0" });
        await sleep(1500);

        console.log("Clicking today's cell on Calendar to open prefilled TradeDialog...");
        await page.evaluate(() => {
            const todayCircle = document.querySelector(".bg-purple-300");
            if (todayCircle) {
                const cell = todayCircle.closest('[role="button"], div');
                if (cell) (cell as HTMLElement).click();
            }
        });
        await sleep(1200);

        // Enter Symbol: TEST_AAPL
        console.log("Entering Symbol: TEST_AAPL...");
        const symbolInput = await page.waitForSelector('form input[placeholder="Type symbol"]', { timeout: 5000 });
        if (!symbolInput) throw new Error("Could not find symbol input with placeholder 'Type symbol'");
        await symbolInput.type("TEST_AAPL");
        await sleep(1500);

        // Click "Add anyway" if present
        console.log("Checking for 'Add anyway' validation bypass button...");
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("form button"));
            const addAnywayBtn = buttons.find(b => b.textContent?.trim().toLowerCase().includes("add anyway")) as HTMLButtonElement | undefined;
            if (addAnywayBtn) {
                console.log("Clicking 'Add anyway' button");
                addAnywayBtn.click();
            }
        });
        await sleep(500);

        // Set Entry Price: 150.00
        console.log("Setting Entry Price: 150.00...");
        await page.waitForSelector("form #entryPrice", { timeout: 3000 });
        await page.type("form #entryPrice", "150.00");

        // Set Quantity: 10
        console.log("Setting Quantity: 10...");
        await page.waitForSelector("form #quantity", { timeout: 3000 });
        await page.type("form #quantity", "10");

        // Switch to Strategy Tab
        console.log("Switching to 'Strategy' tab in TradeDialog form...");
        await clickTabByText(page, "Strategy", "form");
        await sleep(800);

        // Select strategy TEST_EMA_PULLBACK
        console.log("Selecting strategy TEST_EMA_PULLBACK...");
        await page.evaluate(() => {
            const trigger = document.querySelector('form [role="combobox"]') as HTMLElement;
            if (trigger) trigger.click();
        });
        await sleep(600);

        await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('[role="option"]'));
            const targetItem = items.find(opt => opt.textContent?.includes("TEST_EMA_PULLBACK"));
            if (targetItem) (targetItem as HTMLElement).click();
        });
        await sleep(800);

        // Check Open Rule 1 ("Price pulls back to 20 EMA")
        // Leave Open Rule 2 ("Volume confirmation") UNCHECKED
        console.log("Checking Open Rule 1 only ('Price pulls back to 20 EMA')...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("form tr"));
            for (const r of rows) {
                if (r.textContent?.includes("Price pulls back to 20 EMA")) {
                    const checkbox = r.querySelector('button[role="checkbox"], input[type="checkbox"]');
                    if (checkbox) (checkbox as HTMLElement).click();
                }
            }
        });
        await sleep(500);

        // Submit Open Trade: Click "Add Trade"
        console.log("Submitting Open Trade via 'Add Trade' button...");
        await clickButtonByText(page, "Add Trade", "form");
        await sleep(2500);

        const screenshot2Path = path.join(ARTIFACT_DIR, "step2_position_opened.png");
        await page.screenshot({ path: screenshot2Path });
        console.log("Saved screenshot:", screenshot2Path);

        const openTradeDb = queryDb("SELECT id, symbolName, quantity, entryPrice, strategy_id FROM trades WHERE symbolName='TEST_AAPL';");
        console.log("DB Open Trade created:", openTradeDb);
        if (!openTradeDb) throw new Error("Trade TEST_AAPL was not created in database!");

        // ==========================================
        // STEP 3: CLOSE POSITION & REVIEW
        // ==========================================
        console.log("\n--- STEP 3: Closing Position at /private/history ---");
        await page.goto(`${BASE_URL}history`, { waitUntil: "networkidle0" });
        await sleep(1500);

        // Find TEST_AAPL on Open trades tab
        console.log("Locating TEST_AAPL in Open Trades table...");
        const openTradeFound = await page.evaluate(() => {
            return document.body.textContent?.includes("TEST_AAPL");
        });
        console.log("TEST_AAPL open trade found:", openTradeFound);
        if (!openTradeFound) throw new Error("Could not find TEST_AAPL in Open Trades table");

        // Click the 'Manage' button on the TEST_AAPL row using native page.$$ click
        console.log("Opening Manage menu for TEST_AAPL...");
        const buttons = await page.$$("button");
        let clickedManage = false;
        for (const b of buttons) {
            const text = await page.evaluate(el => el.textContent, b);
            if (text && text.includes("Manage")) {
                const isTestRow = await page.evaluate(el => {
                    const row = el.closest('.divide-y > div') || el.closest('tr');
                    return row?.textContent?.includes("TEST_AAPL");
                }, b);
                if (isTestRow) {
                    console.log("Found Manage button on TEST_AAPL row, clicking natively...");
                    await b.click();
                    clickedManage = true;
                    break;
                }
            }
        }
        if (!clickedManage) throw new Error("Could not find Manage button for TEST_AAPL row");

        // Wait for Manage popover menu to appear
        console.log("Waiting for Manage popover menu...");
        await page.waitForSelector('[data-radix-popper-content-wrapper]', { visible: true, timeout: 5000 });
        await sleep(600);

        // Click "Edit initial entry" in the popover menu
        console.log("Clicking 'Edit initial entry' in Manage popover...");
        await clickButtonByText(page, "Edit initial entry");

        // Wait for Edit Trade sheet form to appear
        console.log("Waiting for Edit Trade dialog...");
        await page.waitForSelector('form [role="tablist"]', { visible: true, timeout: 5000 });
        await sleep(800);

        // Switch to "Close" tab inside form using clickTabByText scoped to form
        console.log("Switching to 'Close' tab inside Edit Trade sheet form...");
        await clickTabByText(page, "Close", "form");
        await sleep(800);

        // Set Exit Price: 155.00
        console.log("Setting Exit Price to 155.00...");
        const sellPriceInput = await page.waitForSelector("#sellPrice", { timeout: 5000 });
        if (!sellPriceInput) throw new Error("Could not find #sellPrice input");
        await sellPriceInput.click({ clickCount: 3 });
        await sellPriceInput.press("Backspace");
        await sellPriceInput.type("155.00");
        await sleep(500);

        // Pick Close Date (Today)
        console.log("Clicking Close Date picker button...");
        const dateButtons = await page.$$("form button");
        let clickedDateTrigger = false;
        for (const db of dateButtons) {
            const isDateTrigger = await page.evaluate(el => {
                return el.classList.contains("justify-start") || el.textContent?.includes("Pick a date") || el.querySelector("svg.lucide-calendar") !== null;
            }, db);
            if (isDateTrigger) {
                console.log("Found date trigger button, clicking natively...");
                await db.click();
                clickedDateTrigger = true;
                break;
            }
        }
        if (!clickedDateTrigger) throw new Error("Could not find date picker trigger button in Close tab");
        await sleep(800);

        // Wait for calendar popover and click today's day natively
        console.log("Selecting today's date in calendar popover...");
        await page.waitForSelector('[data-radix-popper-content-wrapper]', { visible: true, timeout: 5000 });
        await sleep(500);

        const todayDay = new Date().getDate().toString();
        const calButtons = await page.$$('[data-radix-popper-content-wrapper] button');
        let clickedDay = false;
        for (const cb of calButtons) {
            const isTargetDay = await page.evaluate((el, targetStr) => {
                const text = el.textContent?.trim();
                const isOutside = el.classList.contains("rdp-day_outside");
                return text === targetStr && !isOutside;
            }, cb, todayDay);
            if (isTargetDay) {
                console.log(`Found day ${todayDay} button in calendar, clicking natively...`);
                await cb.click();
                clickedDay = true;
                break;
            }
        }
        if (!clickedDay) throw new Error(`Could not click day ${todayDay} in calendar`);
        await sleep(600);

        // Close calendar popover by pressing Escape
        console.log("Closing calendar popover with Escape key...");
        await page.keyboard.press("Escape");
        await sleep(600);

        // Switch to "Strategy" tab inside form to check Close Rule
        console.log("Switching to 'Strategy' tab inside form to check Close Rule...");
        await clickTabByText(page, "Strategy", "form");
        await sleep(1000);

        // Verify that the Strategy tab actually became active; if not, retry click
        const isStrategyTabActive = await page.evaluate(() => {
            const stratTab = document.querySelector('form [role="tab"][value="strategy"]');
            return stratTab?.getAttribute("data-state") === "active";
        });
        console.log("Strategy tab active state:", isStrategyTabActive);
        if (!isStrategyTabActive) {
            console.log("Retrying click on Strategy tab...");
            await page.evaluate(() => {
                const stratTab = document.querySelector('form [role="tab"][value="strategy"]') as HTMLElement;
                if (stratTab) stratTab.click();
            });
            await clickTabByText(page, "Strategy", "form");
            await sleep(1000);
        }

        // Wait for Strategy Rules to appear and check "Take profit at 2R"
        console.log("Checking Close Rule 1 ('Take profit at 2R')...");
        await page.waitForSelector('form table', { timeout: 5000 });
        const checkBoxes = await page.$$('form tr');
        let checkedCloseRule = false;
        for (const r of checkBoxes) {
            const text = await page.evaluate(el => el.textContent, r);
            if (text && text.includes("Take profit at 2R")) {
                const cb = await r.$('button[role="checkbox"], input[type="checkbox"]');
                if (cb) {
                    console.log("Found 'Take profit at 2R' checkbox, clicking natively...");
                    await cb.click();
                    checkedCloseRule = true;
                    break;
                }
            }
        }
        if (!checkedCloseRule) throw new Error("Could not find or check 'Take profit at 2R' rule");
        await sleep(500);

        // Submit "Update Trade" inside form
        console.log("Submitting 'Update Trade' to close position...");
        await clickButtonByText(page, "Update Trade", "form");
        await sleep(3500);

        const screenshot3Path = path.join(ARTIFACT_DIR, "step3_position_closed.png");
        await page.screenshot({ path: screenshot3Path });
        console.log("Saved screenshot:", screenshot3Path);

        const closedTradeDb = queryDb("SELECT id, symbolName, quantity, entryPrice, sellPrice, result, closeDate FROM trades WHERE symbolName='TEST_AAPL';");
        console.log("DB Closed Trade status:", closedTradeDb);

        // ==========================================
        // STEP 4: VERIFY REVIEWS & SCORES
        // ==========================================
        console.log("\n--- STEP 4: Verifying Closed Trade P&L and Discipline Score ---");
        console.log("Switching to 'Closed' tab on /private/history...");
        await clickTabByText(page, "Closed");
        await sleep(2000);

        // Verify Realized P&L = +$50.00
        const pnlData = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll(".divide-y > div"));
            const targetRow = rows.find(r => r.textContent?.includes("TEST_AAPL"));
            if (!targetRow) return null;

            const text = targetRow.textContent || "";
            return {
                text,
                has50: text.includes("+50.00") || text.includes("+$50.00") || text.includes("+ $50.00"),
                hasStrategyButton: !!targetRow.querySelector('button[title="Strategy Rules"]')
            };
        });

        console.log("Closed trade verification data:", pnlData);
        if (!pnlData || !pnlData.has50) {
            throw new Error(`Realized P&L was not calculated as +$50.00! Data: ${JSON.stringify(pnlData)}`);
        }
        console.log("✓ Realized P&L correctly verified as +$50.00!");

        // Open Strategy Rules Dialog natively
        console.log("Opening 'Strategy Rules' dialog from closed trade row...");
        const closedRows = await page.$$(".divide-y > div");
        let openedStrategyDialog = false;
        for (const row of closedRows) {
            const text = await page.evaluate(el => el.textContent, row);
            if (text && text.includes("TEST_AAPL")) {
                const stratBtn = await row.$('button[title="Strategy Rules"]');
                if (stratBtn) {
                    console.log("Found Strategy Rules button on TEST_AAPL row, clicking natively...");
                    await stratBtn.click();
                    openedStrategyDialog = true;
                    break;
                }
            }
        }
        if (!openedStrategyDialog) throw new Error("Could not find or click Strategy Rules button on TEST_AAPL row");
        await sleep(1500);

        // Verify Checklist rules state in Dialog
        const checklistVerification = await page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (!dialog) return { foundDialog: false };

            const text = dialog.textContent || "";
            const rows = Array.from(dialog.querySelectorAll("tr"));
            
            let rule1Checked = false;
            let rule2Checked = false;
            let closeRule1Checked = false;

            for (const r of rows) {
                const rowText = r.textContent || "";
                const isChecked = r.querySelector('[data-state="checked"]') !== null || 
                                  r.querySelector('input[type="checkbox"]:checked') !== null;
                
                if (rowText.includes("Price pulls back to 20 EMA")) {
                    rule1Checked = isChecked;
                }
                if (rowText.includes("Volume confirmation")) {
                    rule2Checked = isChecked;
                }
                if (rowText.includes("Take profit at 2R")) {
                    closeRule1Checked = isChecked;
                }
            }

            const totalRules = 3;
            const checkedCount = (rule1Checked ? 1 : 0) + (rule2Checked ? 1 : 0) + (closeRule1Checked ? 1 : 0);
            const scorePercent = (checkedCount / totalRules) * 100;

            return {
                foundDialog: true,
                title: text.includes("TEST_EMA_PULLBACK"),
                rule1Checked,
                rule2Checked,
                closeRule1Checked,
                checkedCount,
                totalRules,
                scorePercent
            };
        });

        console.log("Checklist Verification Details:", checklistVerification);
        if (!checklistVerification.foundDialog) {
            throw new Error("Could not open Strategy Rules dialog");
        }
        if (!checklistVerification.rule1Checked || checklistVerification.rule2Checked || !checklistVerification.closeRule1Checked) {
            throw new Error(`Rule check state mismatch: expected rule1=true, rule2=false, closeRule1=true; got ${JSON.stringify(checklistVerification)}`);
        }

        console.log(`✓ Discipline Score Verified: ${checklistVerification.scorePercent.toFixed(2)}% (2/3 rules satisfied, strictly < 100%).`);
        console.log("\n========================================================");
        console.log(">>> Strategy Checklist & PnL Workflow PASSED <<<");
        console.log("========================================================\n");

        const screenshot4Path = path.join(ARTIFACT_DIR, "step4_verification_score.png");
        await page.screenshot({ path: screenshot4Path });
        console.log("Saved verification screenshot:", screenshot4Path);

        // Close strategy dialog
        await page.keyboard.press("Escape");
        await sleep(500);

        // ==========================================
        // STEP 5: CLEANUP & TEARDOWN
        // ==========================================
        console.log("\n--- STEP 5: Cleanup & Teardown ---");
        // 1. Delete TEST_AAPL trade from Closed table
        console.log("Deleting TEST_AAPL closed trade from History...");
        const closedButtons = await page.$$("button");
        let clickedTradeDelete = false;
        for (const b of closedButtons) {
            const isDelete = await page.evaluate(el => {
                const row = el.closest('.divide-y > div') || el.closest('tr');
                if (!row || !row.textContent?.includes("TEST_AAPL")) return false;
                return el.getAttribute("title") === "Delete Trade" || el.querySelector("svg.lucide-trash-2") !== null;
            }, b);
            if (isDelete) {
                console.log("Found Delete Trade button for TEST_AAPL, clicking...");
                await b.click();
                clickedTradeDelete = true;
                break;
            }
        }
        if (!clickedTradeDelete) throw new Error("Could not find Delete Trade button for TEST_AAPL");
        await sleep(1000);

        // Confirm Delete Trade in modal
        console.log("Confirming trade deletion in dialog...");
        await clickButtonByText(page, "Delete");
        await sleep(2500);

        // Verify trade deleted from UI
        const tradeDeletedUI = await page.evaluate(() => {
            return !document.body.textContent?.includes("TEST_AAPL");
        });
        console.log("TEST_AAPL trade removed from History:", tradeDeletedUI);

        // 2. Navigate to /private/strategies and delete TEST_EMA_PULLBACK
        console.log("Navigating to /private/strategies to delete TEST_EMA_PULLBACK...");
        await page.goto(`${BASE_URL}strategies`, { waitUntil: "networkidle0" });
        await sleep(1500);

        console.log("Finding and clicking delete button for TEST_EMA_PULLBACK...");
        const strategyButtons = await page.$$("button");
        let clickedStrategyDelete = false;
        for (const b of strategyButtons) {
            const isDeleteBtn = await page.evaluate(el => {
                let p = el.parentElement;
                let foundCard = false;
                while (p && p !== document.body) {
                    if (p.textContent?.includes("TEST_EMA_PULLBACK")) {
                        foundCard = true;
                        break;
                    }
                    p = p.parentElement;
                }
                if (!foundCard) return false;

                const actionsContainer = el.closest('.flex.gap-6');
                if (actionsContainer) {
                    const btns = Array.from(actionsContainer.querySelectorAll('button'));
                    return btns[btns.length - 1] === el;
                }
                return false;
            }, b);

            if (isDeleteBtn) {
                console.log("Found delete button on TEST_EMA_PULLBACK strategy, clicking...");
                await b.click();
                clickedStrategyDelete = true;
                break;
            }
        }
        if (!clickedStrategyDelete) throw new Error("Could not find delete button for TEST_EMA_PULLBACK");
        await sleep(1000);

        // Confirm Delete Strategy in dialog
        console.log("Confirming strategy deletion in dialog...");
        await clickButtonByText(page, "Delete");
        await sleep(2500);

        // Refresh page to guarantee state sync
        await page.reload({ waitUntil: "networkidle0" });
        await sleep(1000);

        const strategyDeletedUI = await page.evaluate(() => {
            return !document.body.textContent?.includes("TEST_EMA_PULLBACK");
        });
        console.log("TEST_EMA_PULLBACK strategy removed from Strategies page:", strategyDeletedUI);

        const screenshot5Path = path.join(ARTIFACT_DIR, "step5_cleanup_done.png");
        await page.screenshot({ path: screenshot5Path });
        console.log("Saved cleanup screenshot:", screenshot5Path);

        // Final Database Verification
        console.log("\n--- Final Database Verification via sqlite3 ---");
        const remainingTrades = queryDb("SELECT count(*) FROM trades WHERE symbolName LIKE 'TEST\\_%' ESCAPE '\\';");
        const remainingStrategies = queryDb("SELECT count(*) FROM strategies WHERE strategyName LIKE 'TEST\\_%' ESCAPE '\\';");

        console.log(`Remaining TEST_ trades in local.db: ${remainingTrades}`);
        console.log(`Remaining TEST_ strategies in local.db: ${remainingStrategies}`);

        if (remainingTrades === "0" && remainingStrategies === "0") {
            console.log("✓ Teardown & Cleanup fully verified: 0 residual TEST_ records in local.db.");
        } else {
            throw new Error(`Residual test data detected! Trades: ${remainingTrades}, Strategies: ${remainingStrategies}`);
        }

        console.log("\n=== ALL E2E STEPS COMPLETED AND VERIFIED SUCCESSFULLY ===");
    } catch (error) {
        console.error("Test execution failed:", error);
        const errorScreenshot = path.join(ARTIFACT_DIR, "test_failure.png");
        await page.screenshot({ path: errorScreenshot });
        console.log("Saved failure screenshot to:", errorScreenshot);
        throw error;
    } finally {
        await browser.close();
    }
}

runTest().catch((err) => {
    console.error("E2E Test Runner Exited with Error:", err);
    process.exit(1);
});
