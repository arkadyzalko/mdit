import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@mdit/ui/components/select"
import { SettingRow } from "@mdit/ui/components/setting-row"
import { Switch } from "@mdit/ui/components/switch"
import { cn } from "@mdit/ui/lib/utils"
import { ArrowLeftIcon } from "lucide-react"
import { useState } from "react"
import {
	AUTO_SAVE_DELAYS,
	THEMES,
	type ThemePreference,
	type WebSettings,
} from "../lib/settings"

const delayLabel = (ms: number) => `${ms / 1000}s`

const themeLabel: Record<ThemePreference, string> = {
	light: "Light",
	dark: "Dark",
	system: "System",
}

const SECTIONS = [
	{ id: "appearance", label: "Appearance" },
	{ id: "editor", label: "Editor" },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

// The settings form, sized to live inside the (expanded) sidebar card.
// Two columns: a left section nav + the selected section's content.
// Presentational — settings state is owned by the caller.
export function SettingsContent({
	settings,
	onChange,
	onClose,
}: {
	settings: WebSettings
	onChange: (s: WebSettings) => void
	onClose: () => void
}) {
	const [section, setSection] = useState<SectionId>("appearance")

	return (
		<div className="flex h-full min-h-0 flex-col">
			<button
				type="button"
				onClick={onClose}
				className="mb-2 flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left font-medium text-muted-foreground text-sm transition-colors hover:bg-muted"
			>
				<ArrowLeftIcon className="size-4 shrink-0" />
				Back to app
			</button>

			<div className="flex min-h-0 flex-1 gap-2">
				{/* Left: section nav */}
				<nav className="flex w-28 shrink-0 flex-col gap-0.5">
					{SECTIONS.map((s) => (
						<button
							key={s.id}
							type="button"
							aria-current={s.id === section}
							onClick={() => setSection(s.id)}
							className={cn(
								"flex h-8 items-center rounded-lg px-2 text-left font-medium text-sm transition-colors",
								s.id === section
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:bg-muted",
							)}
						>
							{s.label}
						</button>
					))}
				</nav>

				{/* Right: selected section content */}
				<div className="min-w-0 flex-1 overflow-y-auto pr-1">
					{section === "appearance" ? (
						<AppearanceSection settings={settings} onChange={onChange} />
					) : (
						<EditorSection settings={settings} onChange={onChange} />
					)}
				</div>
			</div>
		</div>
	)
}

function AppearanceSection({
	settings,
	onChange,
}: {
	settings: WebSettings
	onChange: (s: WebSettings) => void
}) {
	return (
		<SettingRow
			title="Theme"
			description="Follow your system or force light or dark."
		>
			<Select
				value={settings.theme}
				onValueChange={(v) =>
					onChange({ ...settings, theme: v as ThemePreference })
				}
			>
				<SelectTrigger className="w-28">
					<SelectValue>
						{(value) => themeLabel[value as ThemePreference]}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{THEMES.map((theme) => (
						<SelectItem key={theme} value={theme}>
							{themeLabel[theme]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</SettingRow>
	)
}

function EditorSection({
	settings,
	onChange,
}: {
	settings: WebSettings
	onChange: (s: WebSettings) => void
}) {
	return (
		<div className="divide-y divide-border">
			<SettingRow
				title="Auto-save"
				description="Persist changes to this browser as you type."
				htmlFor="setting-auto-save"
			>
				<Switch
					id="setting-auto-save"
					checked={settings.autoSave}
					onCheckedChange={(checked) =>
						onChange({ ...settings, autoSave: checked })
					}
				/>
			</SettingRow>
			{settings.autoSave ? (
				<SettingRow
					title="Auto-save delay"
					description="How long to wait after you stop typing."
				>
					<Select
						value={String(settings.autoSaveDelayMs)}
						onValueChange={(v) =>
							onChange({ ...settings, autoSaveDelayMs: Number(v) })
						}
					>
						<SelectTrigger className="w-24">
							<SelectValue>{(value) => delayLabel(Number(value))}</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{AUTO_SAVE_DELAYS.map((ms) => (
								<SelectItem key={ms} value={String(ms)}>
									{delayLabel(ms)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</SettingRow>
			) : null}
		</div>
	)
}
