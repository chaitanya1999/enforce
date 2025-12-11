/**
 * StorageService.ts
 * A service to store and retrieve data from localStorage or sessionStorage.
 * Uses Singleton and Strategy design patterns.
 */

export enum StorageType {
    Local,
    Session,
}

export class StorageKeys {
    static readonly USER_TOKEN = 'USER_TOKEN';
    static readonly USER_PROFILE = 'USER_PROFILE';
    static readonly RECENT_CODE_CHANGES_USER_FILTER = 'recentCodeChangesUserFilter';
    static readonly ENFORCE_WINDOW_DIALOG_SHOWN = 'enforceWindowDialogShown';
    // Add more keys as needed
}

interface IStorageStrategy {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
}

class LocalStorageStrategy implements IStorageStrategy {
    getItem(key: string): string | null {
        return window.localStorage.getItem(key);
    }
    setItem(key: string, value: string): void {
        window.localStorage.setItem(key, value);
    }
    removeItem(key: string): void {
        window.localStorage.removeItem(key);
    }
    clear(): void {
        window.localStorage.clear();
    }
}

class SessionStorageStrategy implements IStorageStrategy {
    getItem(key: string): string | null {
        return window.sessionStorage.getItem(key);
    }
    setItem(key: string, value: string): void {
        window.sessionStorage.setItem(key, value);
    }
    removeItem(key: string): void {
        window.sessionStorage.removeItem(key);
    }
    clear(): void {
        window.sessionStorage.clear();
    }
}

export class StorageService {
    private static instances: Map<StorageType, StorageService> = new Map();
    private strategy: IStorageStrategy;

    private constructor(type: StorageType) {
        this.strategy = type === StorageType.Local
            ? new LocalStorageStrategy()
            : new SessionStorageStrategy();
    }

    static getInstance(type: StorageType = StorageType.Local): StorageService {
        if (!this.instances.has(type)) {
            this.instances.set(type, new StorageService(type));
        }
        return this.instances.get(type)!;
    }

    set<T>(key: string, value: T): void {
        this.strategy.setItem(key, JSON.stringify(value));
    }

    get<T>(key: string): T | null {
        const item = this.strategy.getItem(key);
        return item ? JSON.parse(item) as T : null;
    }

    remove(key: string): void {
        this.strategy.removeItem(key);
    }

    clear(): void {
        this.strategy.clear();
    }
}