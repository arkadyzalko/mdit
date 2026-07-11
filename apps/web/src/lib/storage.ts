// SSR-safe, throw-safe localStorage JSON helpers.
function store(): Storage | null {
	try {
		if (typeof localStorage === "undefined") return null
		return localStorage
	} catch {
		return null
	}
}

export function readJSON<T>(key: string): T | null {
	const s = store()
	if (!s) return null
	try {
		const raw = s.getItem(key)
		return raw === null ? null : (JSON.parse(raw) as T)
	} catch {
		return null
	}
}

export function writeJSON(key: string, value: unknown): void {
	const s = store()
	if (!s) return
	try {
		s.setItem(key, JSON.stringify(value))
	} catch {
		// ignore quota / serialization errors
	}
}
