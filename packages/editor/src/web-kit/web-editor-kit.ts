import {
	BasicBlocksKit,
	ListKit,
	ShortcutsKit,
	UtilsKit,
} from "@mdit/editor/basic"
import { CalloutKit } from "@mdit/editor/callout"
import { BasicMarksKit, CodeBlockKit } from "@mdit/editor/code"
import { DateKit } from "@mdit/editor/date"
import { EmojiKit } from "@mdit/editor/emoji"
import { FrontmatterKit } from "@mdit/editor/frontmatter"
import { createLinkKit } from "@mdit/editor/link"
import {
	AutoformatKit,
	MarkdownKit,
	MarkdownKitNoMdx,
} from "@mdit/editor/markdown"
import { MathKit } from "@mdit/editor/math"
import { createMediaKit } from "@mdit/editor/media"
import { CursorOverlayKit, FloatingToolbarKit } from "@mdit/editor/selection"
import { SuggestionKit } from "@mdit/editor/suggestion"
import { TableKit } from "@mdit/editor/table"
import { TagKit } from "@mdit/editor/tag"
import { TocKit } from "@mdit/editor/toc"
import { webLinkServices } from "./web-link-services"
import { webMediaHost } from "./web-media-host"

type CreateWebEditorKitOptions = { mdx?: boolean }

export const createWebEditorKit = ({
	mdx = true,
}: CreateWebEditorKitOptions = {}) => [
	...AutoformatKit,
	...BasicBlocksKit,
	...BasicMarksKit,
	...CalloutKit,
	...CodeBlockKit,
	...CursorOverlayKit,
	...DateKit,
	...EmojiKit,
	...FloatingToolbarKit,
	...FrontmatterKit,
	...createLinkKit({ services: webLinkServices }),
	...ListKit,
	...(mdx ? MarkdownKit : MarkdownKitNoMdx),
	...MathKit,
	...createMediaKit({ host: webMediaHost }),
	...ShortcutsKit,
	...SuggestionKit,
	...TableKit,
	...TagKit,
	...TocKit,
	...UtilsKit,
]
