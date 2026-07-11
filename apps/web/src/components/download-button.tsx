import { Button } from "@mdit/ui/components/button"
import { DownloadIcon } from "lucide-react"

export function DownloadButton({ onClick }: { onClick: () => void }) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label="Download markdown"
			onClick={onClick}
		>
			<DownloadIcon className="size-4" />
		</Button>
	)
}
