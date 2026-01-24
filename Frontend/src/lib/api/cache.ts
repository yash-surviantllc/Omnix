
interface CacheEntry<T> {
    value: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

class CacheService {
    private cache = new Map<string, CacheEntry<any>>();

    set<T>(key: string, value: T, ttlSeconds: number = 300): void {
        console.log(`[Cache] SET: ${key} (TTL: ${ttlSeconds}s)`);
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl: ttlSeconds * 1000,
        });
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            console.log(`[Cache] MISS: ${key}`);
            return null;
        }

        const isExpired = Date.now() - entry.timestamp > entry.ttl;

        if (isExpired) {
            console.log(`[Cache] EXPIRED: ${key}`);
            this.cache.delete(key);
            return null;
        }

        console.log(`[Cache] HIT: ${key}`);
        return entry.value as T;
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    // Clear cache entries matching a prefix/pattern
    clear(pattern?: string): void {
        if (!pattern) {
            this.cache.clear();
            return;
        }

        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }
}

export const cacheService = new CacheService();
