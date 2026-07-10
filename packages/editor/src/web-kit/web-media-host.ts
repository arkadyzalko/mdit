import type { MediaImageHostDeps } from "@mdit/editor/media"

// The browser editor has no workspace/filesystem: images live as inline
// `data:` (or remote `http`) URLs, which resolveImageSrc returns verbatim.
// toFileUrl is never reached for those, so it is an identity fallback.
export const webMediaHost: MediaImageHostDeps = {
	useWorkspaceState: () => ({ tabPath: null, workspacePath: null }),
	toFileUrl: (absolutePath) => absolutePath,
}
