// Fetches the desktop (macOS) releases of the fork from the GitHub API so the
// web app can offer a native download. Pure data layer — no React.

const REPO = "arkadyzalko/mdit"

export type MacAsset = {
	arch: "apple-silicon" | "intel"
	name: string
	url: string
	size: number
}

export type Release = {
	version: string // e.g. "v0.8.4"
	url: string // release page
	publishedAt: string | null
	mac: MacAsset[]
}

type GitHubAsset = {
	name: string
	browser_download_url: string
	size: number
}

type GitHubRelease = {
	tag_name: string
	html_url: string
	published_at: string | null
	draft: boolean
	prerelease: boolean
	assets: GitHubAsset[]
}

function macAssetsFrom(assets: GitHubAsset[]): MacAsset[] {
	const out: MacAsset[] = []
	for (const a of assets) {
		if (!a.name.endsWith(".dmg")) continue
		// tauri names them Mdit_<version>_aarch64.dmg / Mdit_<version>_x64.dmg
		if (/aarch64|arm64/i.test(a.name)) {
			out.push({
				arch: "apple-silicon",
				name: a.name,
				url: a.browser_download_url,
				size: a.size,
			})
		} else if (/x64|x86_64|intel/i.test(a.name)) {
			out.push({
				arch: "intel",
				name: a.name,
				url: a.browser_download_url,
				size: a.size,
			})
		}
	}
	return out
}

// Fetch published (non-draft) releases that have at least one macOS .dmg,
// newest first. Returns [] on any error or when there are no releases yet.
export async function fetchMacReleases(limit = 10): Promise<Release[]> {
	try {
		const res = await fetch(
			`https://api.github.com/repos/${REPO}/releases?per_page=${limit}`,
			{ headers: { Accept: "application/vnd.github+json" } },
		)
		if (!res.ok) return []
		const data = (await res.json()) as GitHubRelease[]
		return data
			.filter((r) => !r.draft)
			.map((r) => ({
				version: r.tag_name,
				url: r.html_url,
				publishedAt: r.published_at,
				mac: macAssetsFrom(r.assets),
			}))
			.filter((r) => r.mac.length > 0)
	} catch {
		return []
	}
}

// Best-effort detection of the user's Mac architecture, to pick the default
// download. Falls back to Apple Silicon (the common case on modern Macs).
export function preferredArch(): MacAsset["arch"] {
	if (typeof navigator === "undefined") return "apple-silicon"
	const ua = navigator.userAgent
	// Intel Macs report "Intel Mac OS X"; Apple Silicon usually does too (for
	// compatibility), so this is a heuristic, not exact. When unsure, default to
	// Apple Silicon — the user can still pick Intel from the list.
	if (/Intel Mac OS X 10_(?:9|1[0-4])/.test(ua)) return "intel"
	return "apple-silicon"
}

export function pickMacAsset(release: Release): MacAsset | undefined {
	const arch = preferredArch()
	return release.mac.find((m) => m.arch === arch) ?? release.mac[0]
}
