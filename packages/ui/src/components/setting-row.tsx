import type { ReactNode } from "react"
import { cn } from "../lib/utils"

export function SettingRow({
	title,
	description,
	htmlFor,
	children,
	className,
}: {
	title: string
	description?: string
	htmlFor?: string
	children: ReactNode
	className?: string
}) {
	return (
		<div
			className={cn("flex items-center justify-between gap-4 py-3", className)}
		>
			<div className="min-w-0">
				<label
					htmlFor={htmlFor}
					className="block font-medium text-foreground text-sm"
				>
					{title}
				</label>
				{description ? (
					<p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
				) : null}
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	)
}
