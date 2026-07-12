import { Button } from "@mdit/ui/components/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@mdit/ui/components/select"
import { SettingRow } from "@mdit/ui/components/setting-row"
import { Switch } from "@mdit/ui/components/switch"
import { ArrowLeftIcon } from "lucide-react"
import { useEffect } from "react"
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

export function SettingsPanel({
	settings,
	onChange,
	onClose,
}: {
	settings: WebSettings
	onChange: (s: WebSettings) => void
	onClose: () => void
}) {
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		window.addEventListener("keydown", onKeyDown)
		return () => window.removeEventListener("keydown", onKeyDown)
	}, [onClose])

	return (
		<div className="fixed inset-0 z-50 flex bg-background">
			{/* Left: section list */}
			<div className="flex w-60 shrink-0 flex-col border-border border-r bg-muted/30 p-2">
				<Button
					type="button"
					variant="ghost"
					className="mb-2 justify-start gap-2"
					onClick={onClose}
				>
					<ArrowLeftIcon className="size-4" />
					Back to app
				</Button>
				<div className="rounded-md bg-muted px-2 py-1.5 font-medium text-foreground text-sm">
					Appearance
				</div>
				<div className="rounded-md px-2 py-1.5 font-medium text-muted-foreground text-sm">
					Editor
				</div>
			</div>
			{/* Right: content */}
			<div className="min-w-0 flex-1 overflow-y-auto p-8">
				<h1 className="font-semibold text-foreground text-xl">Appearance</h1>
				<p className="mt-1 text-muted-foreground text-sm">How the app looks.</p>
				<div className="mt-6 max-w-xl divide-y divide-border">
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
							<SelectTrigger className="w-32">
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
				</div>

				<h1 className="mt-10 font-semibold text-foreground text-xl">Editor</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					How the editor saves your work.
				</p>
				<div className="mt-6 max-w-xl divide-y divide-border">
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
								<SelectTrigger className="w-28">
									<SelectValue>
										{(value) => delayLabel(Number(value))}
									</SelectValue>
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
			</div>
		</div>
	)
}
