/**
 * query.ts — TanStack Query-style caching for all data fetching
 *
 * Stale-while-revalidate, deduplication, targeted invalidation.
 */

import { createSignal, onCleanup, onMount } from "solid-js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryOptions<T> {
	queryKey: () => unknown[]
	queryFn: () => Promise<T>
	staleTime?: number
	refetchInterval?: number
	gcTime?: number
	enabled?: () => boolean
}

export interface QueryState<T> {
	data: T | undefined
	isLoading: boolean
	isStale: boolean
	error: Error | null
	lastUpdated: number
}

export interface MutationOptions<T, V> {
	mutationFn: (variables: V) => Promise<T>
	onMutate?: (variables: V) => void
	onSuccess?: (data: T, variables: V) => void
	onError?: (error: Error, variables: V) => void
}

// ---------------------------------------------------------------------------
// Query Cache
// ---------------------------------------------------------------------------

interface CacheEntry<T = unknown> {
	data: T
	timestamp: number
	staleTime: number
	promise?: Promise<T>
}

const cache = new Map<string, CacheEntry>()
const subscribers = new Map<string, Set<() => void>>()

function serializeKey(key: unknown[]): string {
	return JSON.stringify(key)
}

/**
 * Get cached data for a query key.
 */
export function getQueryData<T>(key: unknown[]): T | undefined {
	const entry = cache.get(serializeKey(key))
	return entry?.data as T | undefined
}

/**
 * Set cached data for a query key (for optimistic updates).
 */
export function setQueryData<T>(key: unknown[], updater: T | ((old: T | undefined) => T)) {
	const serialized = serializeKey(key)
	const existing = cache.get(serialized)
	const data =
		typeof updater === "function"
			? (updater as (old: T | undefined) => T)(existing?.data as T | undefined)
			: updater
	cache.set(serialized, {
		data,
		timestamp: Date.now(),
		staleTime: existing?.staleTime ?? 0,
	})
	notifySubscribers(serialized)
}

/**
 * Mark a query as stale, triggering a refetch on next access.
 */
export function invalidateQuery(key: unknown[]) {
	const serialized = serializeKey(key)
	const entry = cache.get(serialized)
	if (entry) {
		entry.timestamp = 0 // Mark as stale
	}
	notifySubscribers(serialized)
}

/**
 * Invalidate all queries matching a prefix.
 */
function invalidateQueriesByPrefix(prefix: string) {
	for (const key of cache.keys()) {
		if (key.startsWith(prefix)) {
			const entry = cache.get(key)
			if (entry) entry.timestamp = 0
			notifySubscribers(key)
		}
	}
}

function notifySubscribers(key: string) {
	const subs = subscribers.get(key)
	if (subs) {
		for (const notify of subs) notify()
	}
}

/**
 * Create a query with caching, stale detection, and refetching.
 * Returns a SolidJS-compatible reactive object.
 */
export function createQuery<T>(options: QueryOptions<T>) {
	const dataSignal = createSignal<T | undefined>(undefined)
	const data = dataSignal[0]
	const setData = dataSignal[1] as (v: T | undefined) => void
	const isLoadingSignal = createSignal(true)
	const isLoading = isLoadingSignal[0]
	const setIsLoading = isLoadingSignal[1]
	const errorSignal = createSignal<Error | null>(null)
	const error = errorSignal[0]
	const setError = errorSignal[1]
	const lastUpdatedSignal = createSignal(0)
	const lastUpdated = lastUpdatedSignal[0]
	const setLastUpdated = lastUpdatedSignal[1]

	const staleTime = options.staleTime ?? 0
	const refetchInterval = options.refetchInterval
	const enabled = options.enabled ?? (() => true)

	async function fetchData(force = false) {
		if (!enabled()) return

		const key = options.queryKey()
		const serialized = serializeKey(key)
		const cached = cache.get(serialized)

		// Stale-while-revalidate: show cached data while fetching
		if (cached && !force) {
			const isStale = Date.now() - cached.timestamp > cached.staleTime
			if (!isStale) {
				setData(cached.data as T)
				setIsLoading(false)
				setLastUpdated(cached.timestamp)
				return
			}
			// Stale but show cached data
			setData(cached.data as T)
			setIsLoading(false)
		}

		// Deduplicate in-flight requests
		if (cached?.promise) {
			try {
				const result = await cached.promise
				setData(result as T)
				setIsLoading(false)
				setLastUpdated(cached.timestamp)
			} catch (err) {
				setError(err as Error)
			}
			return
		}

		setIsLoading(true)
		setError(null)

		const promise = options.queryFn()
		if (cached) {
			cached.promise = promise
		}

		try {
			const result = await promise
			cache.set(serialized, {
				data: result,
				timestamp: Date.now(),
				staleTime,
			})
			setData(result as T)
			setIsLoading(false)
			setLastUpdated(Date.now())
		} catch (err) {
			setError(err as Error)
			setIsLoading(false)
		} finally {
			if (cached) cached.promise = undefined
		}
	}

	// Subscribe to invalidation
	const key = options.queryKey()
	const serialized = serializeKey(key)
	if (!subscribers.has(serialized)) {
		subscribers.set(serialized, new Set())
	}
	const subs = subscribers.get(serialized)!
	const notify = () => void fetchData(true)
	subs.add(notify)

	// Initial fetch
	onMount(() => void fetchData())

	// Refetch interval
	let intervalId: ReturnType<typeof setInterval> | null = null
	if (refetchInterval) {
		intervalId = setInterval(() => void fetchData(), refetchInterval)
	}

	// Cleanup
	onCleanup(() => {
		subs.delete(notify)
		if (intervalId) clearInterval(intervalId)
	})

	return {
		data: () => data() as T,
		isLoading,
		isStale: () => {
			const key = options.queryKey()
			const entry = cache.get(serializeKey(key))
			if (!entry) return true
			return Date.now() - entry.timestamp > staleTime
		},
		error,
		lastUpdated,
		refetch: () => fetchData(true),
	}
}

/**
 * Create a mutation with optimistic update support.
 */
export function createMutation<T, V>(options: MutationOptions<T, V>) {
	const [isLoading, setIsLoading] = createSignal(false)
	const [error, setError] = createSignal<Error | null>(null)

	async function mutate(variables: V): Promise<T | undefined> {
		setIsLoading(true)
		setError(null)

		try {
			options.onMutate?.(variables)
			const result = await options.mutationFn(variables)
			options.onSuccess?.(result, variables)
			return result
		} catch (err) {
			const e = err as Error
			setError(e)
			options.onError?.(e, variables)
			return undefined
		} finally {
			setIsLoading(false)
		}
	}

	return { mutate, isLoading, error }
}

/**
 * Garbage collect queries unused for gcTime (default 5 min).
 */
export function gcQueries(gcTime = 300_000) {
	const now = Date.now()
	for (const [key, entry] of cache) {
		if (now - entry.timestamp > gcTime) {
			cache.delete(key)
			subscribers.delete(key)
		}
	}
}
