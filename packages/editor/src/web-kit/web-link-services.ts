import type {
	LinkNavigationPort,
	LinkServices,
	LinkWorkspacePort,
	LinkWorkspaceState,
} from "@mdit/editor/link"

// The browser editor has no vault/workspace: links are plain external URLs.
// This provides the minimal LinkServices contract createLinkKit requires so
// that `[text](url)` round-trips instead of degrading to plain text.

const emptyWorkspaceState: LinkWorkspaceState = {
	workspacePath: null,
	tab: null,
	entries: [],
}

const workspace: LinkWorkspacePort = {
	useSnapshot: () => emptyWorkspaceState,
	getSnapshot: () => emptyWorkspaceState,
}

const navigation: LinkNavigationPort = {
	openExternal: (href) => {
		window.open(href, "_blank", "noopener,noreferrer")
	},
	// No file navigation on web; internal/path links are no-ops.
	openPath: () => {},
}

export const webLinkServices: LinkServices = {
	workspace,
	navigation,
}
