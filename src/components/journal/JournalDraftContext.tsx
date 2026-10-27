"use client";

import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from "react";

interface JournalDraftContextValue {
    setDraftDirty: (isDirty: boolean) => void;
    confirmNavigation: () => boolean;
}

const JournalDraftContext = createContext<JournalDraftContextValue | null>(null);

export function JournalDraftProvider({ children }: { children: ReactNode }) {
    const isDirtyRef = useRef(false);

    const confirmNavigation = useCallback(() => {
        if (!isDirtyRef.current) return true;

        return window.confirm(
            "This journal entry has unsaved changes. Leave this page?"
        );
    }, []);

    useEffect(() => {
        const handleDocumentClick = (event: MouseEvent) => {
            if (
                !isDirtyRef.current ||
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            const target = event.target;
            if (!(target instanceof Element)) return;

            const anchor = target.closest<HTMLAnchorElement>("a[href]");
            if (
                !anchor ||
                anchor.hasAttribute("download") ||
                (anchor.target && anchor.target !== "_self")
            ) {
                return;
            }

            let destination: URL;
            try {
                destination = new URL(anchor.href, window.location.href);
            } catch {
                return;
            }

            if (
                !["http:", "https:"].includes(destination.protocol) ||
                destination.origin !== window.location.origin
            ) {
                return;
            }

            const current = new URL(window.location.href);
            const normalizePath = (path: string) =>
                path.length > 1 ? path.replace(/\/+$/, "") : path;
            if (
                normalizePath(destination.pathname) ===
                    normalizePath(current.pathname) &&
                destination.search === current.search
            ) {
                return;
            }

            if (!confirmNavigation()) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        document.addEventListener("click", handleDocumentClick, true);
        return () => document.removeEventListener("click", handleDocumentClick, true);
    }, [confirmNavigation]);

    const value = useMemo(
        () => ({
            setDraftDirty: (dirty: boolean) => {
                isDirtyRef.current = dirty;
            },
            confirmNavigation,
        }),
        [confirmNavigation]
    );

    return (
        <JournalDraftContext.Provider value={value}>
            {children}
        </JournalDraftContext.Provider>
    );
}

export function useJournalDraft() {
    const context = useContext(JournalDraftContext);
    if (!context) {
        throw new Error("useJournalDraft must be used inside JournalDraftProvider");
    }
    return context;
}
