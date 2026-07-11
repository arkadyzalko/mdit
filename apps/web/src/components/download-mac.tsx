import { Button } from "@mdit/ui/components/button"
import { cn } from "@mdit/ui/lib/utils"
import { AppleIcon, ChevronDownIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchMacReleases, pickMacAsset, type Release } from "../lib/releases"

const archLabel = (arch: "apple-silicon" | "intel") =>
	arch === "apple-silicon" ? "Apple Silicon" : "Intel"

// Bottom-of-sidebar CTA to download the native macOS build, with an
// expandable list of released versions (per-arch .dmg links). Renders nothing
// until at least one macOS release exists, so it stays quiet on a fresh fork.
export function DownloadMac() {
	const [releases, setReleases] = useState<Release[] | null>(null)
	const [expanded, setExpanded] = useState(false)

	useEffect(() => {
		let active = true
		fetchMacReleases().then((r) => {
			if (active) setReleases(r)
		})
		return () => {
			active = false
		}
	}, [])

	// Loading, error, or no releases yet → render nothing.
	if (!releases || releases.length === 0) return null

	const latest = releases[0]
	const latestAsset = pickMacAsset(latest)
	if (!latestAsset) return null

	return (
		<div className="mt-auto border-border border-t p-2">
			<a href={latestAsset.url} download>
				<Button type="button" className="w-full justify-center gap-2">
					<AppleIcon className="size-4" aria-hidden />
					Download for Mac
				</Button>
			</a>
			<p className="mt-1 text-center text-muted-foreground text-xs">
				{latest.version} · {archLabel(latestAsset.arch)}
			</p>

			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				aria-expanded={expanded}
				className="mt-1 flex w-full items-center justify-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
			>
				All versions
				<ChevronDownIcon
					className={cn(
						"size-3 transition-transform",
						expanded && "rotate-180",
					)}
					aria-hidden
				/>
			</button>

			{expanded && (
				<ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
					{releases.map((release) => (
						<li key={release.version}>
							<div className="px-1 py-0.5 text-muted-foreground text-xs">
								{release.version}
							</div>
							<div className="flex flex-col">
								{release.mac.map((asset) => (
									<a
										key={asset.name}
										href={asset.url}
										download
										className="rounded px-2 py-0.5 text-foreground text-xs hover:bg-muted"
									>
										{archLabel(asset.arch)} (.dmg)
									</a>
								))}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
