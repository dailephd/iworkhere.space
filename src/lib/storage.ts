export interface StorageAdapter {
    get<T>(key: string): T | null
    set<T>(key: string, value: T): void
    remove(key: string): void
}

function isClient(): boolean {
    return typeof window !== "undefined"
}

function createLocalStorageAdapter(): StorageAdapter {
    return {
        get<T>(key: string): T | null {
            if (!isClient()) return null
            try {
                const raw = localStorage.getItem(key)
                if (raw === null) return null
                return JSON.parse(raw) as T
            } catch {
                return null
            }
        },

        set<T>(key: string, value: T): void {
            if (!isClient()) return
            try {
                localStorage.setItem(key, JSON.stringify(value))
            } catch {
                // Storage full or unavailable
            }
        },

        remove(key: string): void {
            if (!isClient()) return
            try {
                localStorage.removeItem(key)
            } catch {
                // Storage unavailable
            }
        },
    }
}

export const storage: StorageAdapter = createLocalStorageAdapter()
