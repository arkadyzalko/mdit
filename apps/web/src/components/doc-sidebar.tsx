import { AnimatePresence, motion } from "motion/react"
import type { WebSettings } from "../lib/settings"
import type { Workspace } from "../lib/workspace"
import { DownloadMac } from "./download-mac"
import { SettingsContent } from "./settings-content"
import { WorkspaceTree } from "./workspace-tree"

const RECENTS_WIDTH = 256
const SETTINGS_WIDTH = 420

// Left sidebar as a floating rounded card (matching the mdit desktop look).
// It hosts two modes in the SAME card: the workspace tree and the settings
// form. Opening settings expands the card and cross-fades its content; closing
// reverses it. The card is the animated container.
export function DocSidebar({
	workspace,
	activeNodeId,
	onWorkspaceChange,
	onOpenFile,
	onDeleteNode,
	onCreateChild,
	onCreateRoot,
	showSettings,
	settings,
	onChangeSettings,
	onCloseSettings,
}: {
	workspace: Workspace
	activeNodeId: string | null
	onWorkspaceChange: (ws: Workspace) => void
	onOpenFile: (id: string) => void
	onDeleteNode: (id: string) => void
	onCreateChild: (parentId: string) => void
	onCreateRoot: () => void
	showSettings: boolean
	settings: WebSettings
	onChangeSettings: (s: WebSettings) => void
	onCloseSettings: () => void
}) {
	return (
		<motion.div
			className="flex h-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/40 p-2 shadow-sm"
			animate={{ width: showSettings ? SETTINGS_WIDTH : RECENTS_WIDTH }}
			initial={false}
			transition={{ type: "spring", stiffness: 400, damping: 38 }}
		>
			<AnimatePresence mode="wait" initial={false}>
				{showSettings ? (
					<motion.div
						key="settings"
						className="flex h-full min-h-0 flex-col"
						initial={{ opacity: 0, x: 12 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 12 }}
						transition={{ duration: 0.16, ease: "easeOut" }}
					>
						<SettingsContent
							settings={settings}
							onChange={onChangeSettings}
							onClose={onCloseSettings}
						/>
					</motion.div>
				) : (
					<motion.div
						key="recents"
						className="flex h-full min-h-0 flex-col gap-1"
						initial={{ opacity: 0, x: -12 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -12 }}
						transition={{ duration: 0.16, ease: "easeOut" }}
					>
						<div className="min-h-0 flex-1">
							<WorkspaceTree
								workspace={workspace}
								activeNodeId={activeNodeId}
								onWorkspaceChange={onWorkspaceChange}
								onOpenFile={onOpenFile}
								onDeleteNode={onDeleteNode}
								onCreateChild={onCreateChild}
								onCreateRoot={onCreateRoot}
							/>
						</div>
						<DownloadMac />
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	)
}
