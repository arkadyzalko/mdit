import { Button } from "@mdit/ui/components/button"
import { SparklesIcon } from "lucide-react"

export function AiPanelToggle({
	active,
	onClick,
}: {
	active: boolean
	onClick: () => void
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label="Toggle AI chat"
			aria-pressed={active}
			onClick={onClick}
		>
			<SparklesIcon className="size-4" />
		</Button>
	)
}
