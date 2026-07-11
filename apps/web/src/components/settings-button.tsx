import { Button } from "@mdit/ui/components/button"
import { SettingsIcon } from "lucide-react"

export function SettingsButton({ onClick }: { onClick: () => void }) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label="Settings"
			onClick={onClick}
		>
			<SettingsIcon className="size-4" />
		</Button>
	)
}
