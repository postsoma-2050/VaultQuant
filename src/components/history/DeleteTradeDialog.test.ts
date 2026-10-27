import assert from "node:assert/strict";

import { confirmDeleteTrade } from "./deleteTradeDialogFlow";

async function run(): Promise<void> {
    let closeCount = 0;

    assert.equal(
        await confirmDeleteTrade(async () => true, () => {
            closeCount += 1;
        }),
        true
    );
    assert.equal(closeCount, 1, "successful deletion closes once");

    assert.equal(
        await confirmDeleteTrade(async () => false, () => {
            closeCount += 1;
        }),
        false,
        "failed deletion remains open"
    );
    assert.equal(
        await confirmDeleteTrade(async () => {
            throw new Error("Injected 500");
        }, () => {
            closeCount += 1;
        }),
        false,
        "thrown server failure remains open"
    );
    assert.equal(closeCount, 1, "only successful deletion closes the dialog");

    console.log("DeleteTradeDialog result assertions passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
