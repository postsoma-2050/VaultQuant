export async function confirmDeleteTrade(
    onConfirm: () => Promise<boolean>,
    close: () => void
): Promise<boolean> {
    try {
        if ((await onConfirm()) !== true) return false;
        close();
        return true;
    } catch {
        return false;
    }
}
