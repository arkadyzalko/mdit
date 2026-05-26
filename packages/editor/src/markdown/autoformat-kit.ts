import { toggleList } from "@platejs/list"
import { insertInlineEquation } from "@platejs/math"
import {
	createBlockFenceInputRule,
	createBlockStartInputRule,
	createMarkInputRule,
	createSlatePlugin,
	defineInputRule,
	KEYS,
	type Path,
	type SlateEditor,
	type TextSubstitutionPattern,
} from "platejs"
import { applyPreviousCodeBlockLanguage } from "../code/code-block-language"
import { WIKI_LINK_PLACEHOLDER_TEXT } from "../link/wiki-link-constants"
import { KATEX_ENVIRONMENTS } from "../math/katex"
import { NOTE_TITLE_KEY } from "../title"

const isAutoformatEnabled = ({ editor }: { editor: SlateEditor }) =>
	!editor.api.some({
		match: (node) =>
			node.type === editor.getType(KEYS.codeBlock) ||
			node.type === NOTE_TITLE_KEY,
	})

const createMarkRules = () => [
	createMarkInputRule({
		marks: [KEYS.bold, KEYS.italic],
		start: "**",
		end: "*",
		trigger: "*",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		marks: [KEYS.underline, KEYS.italic],
		start: "__",
		end: "*",
		trigger: "*",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		marks: [KEYS.underline, KEYS.bold],
		start: "__",
		end: "**",
		trigger: "*",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		marks: [KEYS.underline, KEYS.bold, KEYS.italic],
		start: "___",
		end: "***",
		trigger: "*",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		mark: KEYS.bold,
		start: "**",
		end: "*",
		trigger: "*",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		mark: KEYS.underline,
		start: "__",
		end: "_",
		trigger: "_",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		mark: KEYS.italic,
		start: "*",
		trigger: "*",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		mark: KEYS.italic,
		start: "_",
		trigger: "_",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		mark: KEYS.strikethrough,
		start: "~~",
		end: "~",
		trigger: "~",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		mark: KEYS.sup,
		start: "^",
		trigger: "^",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		mark: KEYS.sub,
		start: "~",
		trigger: "~",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		mark: KEYS.highlight,
		start: "==",
		end: "=",
		trigger: "=",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		mark: KEYS.highlight,
		start: "≡",
		trigger: "≡",
		enabled: isAutoformatEnabled,
	}),
	createMarkInputRule({
		mark: KEYS.code,
		start: "`",
		trigger: "`",
		enabled: isAutoformatEnabled,
	}),
]

const createBlockRule = (
	match: string | RegExp,
	trigger: string,
	type: string,
) =>
	createBlockStartInputRule({
		match,
		node: type,
		trigger,
		enabled: isAutoformatEnabled,
	})

const insertCodeBlockAtPath = (editor: SlateEditor, path: Path) => {
	editor.tf.removeNodes({ at: path })
	editor.tf.insertNodes(
		{
			children: [
				{
					children: [{ text: "" }],
					type: editor.getType(KEYS.codeLine),
				},
			],
			type: editor.getType(KEYS.codeBlock),
		},
		{ at: path },
	)

	const start = editor.api.start([...path, 0])
	if (start) editor.tf.select(start)
	applyPreviousCodeBlockLanguage(editor)
}

const createBlockRules = () => [
	createBlockRule("#", " ", KEYS.h1),
	createBlockRule("##", " ", KEYS.h2),
	createBlockRule("###", " ", KEYS.h3),
	createBlockRule("####", " ", KEYS.h4),
	createBlockRule("#####", " ", KEYS.h5),
	createBlockRule("######", " ", KEYS.h6),
	createBlockStartInputRule({
		match: ">",
		mode: "wrap",
		node: KEYS.blockquote,
		trigger: " ",
		enabled: isAutoformatEnabled,
	}),
	createBlockStartInputRule({
		match: /^(--|—)$/,
		trigger: "-",
		enabled: isAutoformatEnabled,
		apply: ({ editor }, match) => {
			editor.tf.delete({ at: match.range })
			editor.tf.setNodes({ type: KEYS.hr })
			editor.tf.insertNodes({
				children: [{ text: "" }],
				type: KEYS.p,
			})
			return true
		},
	}),
	createBlockStartInputRule({
		match: "___",
		trigger: " ",
		enabled: isAutoformatEnabled,
		apply: ({ editor }, match) => {
			editor.tf.delete({ at: match.range })
			editor.tf.setNodes({ type: KEYS.hr })
			editor.tf.insertNodes({
				children: [{ text: "" }],
				type: KEYS.p,
			})
			return true
		},
	}),
	createBlockFenceInputRule({
		fence: "```",
		block: KEYS.p,
		on: "match",
		enabled: isAutoformatEnabled,
		priority: 100,
		apply: ({ editor }, match) => {
			insertCodeBlockAtPath(editor, match.path)
			return true
		},
	}),
]

const autoformatTextPatterns: TextSubstitutionPattern[] = [
	{ format: "→", match: "->" },
	{ format: "←", match: "<-" },
	{ format: "⇒", match: "=>" },
	{ format: "⇐", match: ["<=", "≤="] },
	{ format: "™", match: ["(tm)", "(TM)"] },
	{ format: "®", match: ["(r)", "(R)"] },
	{ format: "©", match: ["(c)", "(C)"] },
	{ format: "™", match: "&trade;" },
	{ format: "®", match: "&reg;" },
	{ format: "©", match: "&copy;" },
	{ format: "§", match: "&sect;" },
	{ format: "—", match: "--" },
	{ format: "…", match: "..." },
	{ format: "»", match: ">>" },
	{ format: "«", match: "<<" },
	{ format: ["“", "”"], match: '"' },
	{ format: ["‘", "’"], match: "'" },
	{ format: "≯", match: "!>" },
	{ format: "≮", match: "!<" },
	{ format: "≥", match: ">=" },
	{ format: "≤", match: "<=" },
	{ format: "≱", match: "!>=" },
	{ format: "≰", match: "!<=" },
	{ format: "≠", match: "!=" },
	{ format: "≡", match: "==" },
	{ format: "≢", match: ["!==", "≠="] },
	{ format: "≈", match: "~=" },
	{ format: "≉", match: "!~=" },
	{ format: "½", match: "1/2" },
	{ format: "⅓", match: "1/3" },
	{ format: "¼", match: "1/4" },
	{ format: "⅕", match: "1/5" },
	{ format: "⅙", match: "1/6" },
	{ format: "⅐", match: "1/7" },
	{ format: "⅛", match: "1/8" },
	{ format: "⅑", match: "1/9" },
	{ format: "⅒", match: "1/10" },
	{ format: "⅔", match: "2/3" },
	{ format: "⅖", match: "2/5" },
	{ format: "¾", match: "3/4" },
	{ format: "⅗", match: "3/5" },
	{ format: "⅜", match: "3/8" },
	{ format: "⅘", match: "4/5" },
	{ format: "⅚", match: "5/6" },
	{ format: "⅝", match: "5/8" },
	{ format: "⅞", match: "7/8" },
	{ format: "±", match: "+-" },
	{ format: "‰", match: "%%" },
	{ format: "‱", match: ["%%%", "‰%"] },
	{ format: "÷", match: "//" },
	{ format: "°", match: "^o" },
	{ format: "⁺", match: "^+" },
	{ format: "⁻", match: "^-" },
	{ format: "₊", match: "~+" },
	{ format: "₋", match: "~-" },
	{ format: "⁰", match: "^0" },
	{ format: "¹", match: "^1" },
	{ format: "²", match: "^2" },
	{ format: "³", match: "^3" },
	{ format: "⁴", match: "^4" },
	{ format: "⁵", match: "^5" },
	{ format: "⁶", match: "^6" },
	{ format: "⁷", match: "^7" },
	{ format: "⁸", match: "^8" },
	{ format: "⁹", match: "^9" },
	{ format: "₀", match: "~0" },
	{ format: "₁", match: "~1" },
	{ format: "₂", match: "~2" },
	{ format: "₃", match: "~3" },
	{ format: "₄", match: "~4" },
	{ format: "₅", match: "~5" },
	{ format: "₆", match: "~6" },
	{ format: "₇", match: "~7" },
	{ format: "₈", match: "~8" },
	{ format: "₉", match: "~9" },
]

const flatAutoformatTextPatterns = autoformatTextPatterns
	.flatMap((pattern) =>
		(Array.isArray(pattern.match) ? pattern.match : [pattern.match]).map(
			(match) => ({ format: pattern.format, match }),
		),
	)
	.sort((a, b) => b.match.length - a.match.length)

const autoformatTextTriggers = Array.from(
	new Set(flatAutoformatTextPatterns.map(({ match }) => match.at(-1) ?? "")),
).filter(Boolean)

const createTextSubstitutionRules = () => [
	defineInputRule({
		target: "insertText",
		trigger: autoformatTextTriggers,
		enabled: isAutoformatEnabled,
		resolve: ({ editor, text }) => {
			if (!editor.selection || !editor.api.isCollapsed()) return

			const blockRange = editor.api.range("start", editor.selection)
			if (!blockRange) return

			const textBefore = editor.api.string(blockRange)

			for (const pattern of flatAutoformatTextPatterns) {
				if (!pattern.match.endsWith(text)) continue

				const candidate = textBefore + text
				if (!candidate.endsWith(pattern.match)) continue

				return pattern
			}
		},
		apply: ({ editor, text }, match) => {
			if (!editor.selection) return false

			if (typeof match.format !== "string") {
				const beforeStart = editor.api.before(editor.selection, {
					matchString: match.match,
					skipInvalid: true,
				})
				if (!beforeStart) return false

				const afterStart = editor.api.before(editor.selection, {
					afterMatch: true,
					matchString: match.match,
					skipInvalid: true,
				})
				if (!afterStart) return false

				editor.tf.insertText(match.format[1])
				editor.tf.delete({ at: { anchor: beforeStart, focus: afterStart } })
				editor.tf.insertText(match.format[0], { at: beforeStart })
				return true
			}

			const previousLength = match.match.length - text.length
			if (previousLength > 0) {
				const start = editor.api.before(editor.selection, {
					distance: previousLength,
					unit: "character",
				})
				if (!start) return false
				editor.tf.delete({
					at: { anchor: start, focus: editor.selection.anchor },
				})
			}

			editor.tf.insertText(match.format)
			return true
		},
	}),
]

const createListRules = () => [
	createBlockStartInputRule({
		match: /^[-*]$/,
		trigger: " ",
		enabled: isAutoformatEnabled,
		apply: ({ editor }, match) => {
			editor.tf.delete({ at: match.range })
			toggleList(editor, { listStyleType: KEYS.ul })
			return true
		},
	}),
	createBlockStartInputRule({
		match: /^(\d+)[.)]$/,
		trigger: " ",
		enabled: isAutoformatEnabled,
		resolveMatch: ({ match }) => ({ listStart: Number(match[1]) || 1 }),
		apply: ({ editor }, match) => {
			editor.tf.delete({ at: match.range })
			toggleList(editor, {
				listRestartPolite: match.listStart,
				listStyleType: KEYS.ol,
			})
			return true
		},
	}),
	createBlockStartInputRule({
		match: "[]",
		trigger: " ",
		enabled: isAutoformatEnabled,
		apply: ({ editor }, match) => {
			editor.tf.delete({ at: match.range })
			toggleList(editor, { listStyleType: KEYS.listTodo })
			editor.tf.setNodes({
				checked: false,
				listStyleType: KEYS.listTodo,
			})
			return true
		},
	}),
	createBlockStartInputRule({
		match: "[x]",
		trigger: " ",
		enabled: isAutoformatEnabled,
		apply: ({ editor }, match) => {
			editor.tf.delete({ at: match.range })
			toggleList(editor, { listStyleType: KEYS.listTodo })
			editor.tf.setNodes({
				checked: true,
				listStyleType: KEYS.listTodo,
			})
			return true
		},
	}),
]

const createMathRules = () => [
	defineInputRule({
		target: "insertText",
		trigger: "$",
		enabled: isAutoformatEnabled,
		resolve: ({ editor, text }) => {
			if (text !== "$" || !editor.selection || !editor.api.isCollapsed()) {
				return
			}

			const before = editor.api.before(editor.selection, { matchString: "$" })
			if (!before) return

			return { range: { anchor: before, focus: editor.selection.anchor } }
		},
		apply: ({ editor }, match) => {
			editor.tf.delete({ at: match.range })
			insertInlineEquation(editor, "", { select: true })
			return true
		},
	}),
	...KATEX_ENVIRONMENTS.map((environment) =>
		createBlockStartInputRule({
			match: `\\begin{${environment}}`,
			trigger: "}",
			node: KEYS.equation,
			enabled: isAutoformatEnabled,
			apply: ({ editor }, match) => {
				editor.tf.delete({ at: match.range })
				editor.tf.setNodes({
					type: KEYS.equation,
					texExpression: "",
					environment,
				})
				return true
			},
		}),
	),
]

const createWikiLinkRules = () => [
	defineInputRule({
		target: "insertText",
		trigger: "[",
		enabled: isAutoformatEnabled,
		resolve: ({ editor, text }) => {
			if (text !== "[" || !editor.selection || !editor.api.isCollapsed()) {
				return
			}

			const before = editor.api.before(editor.selection, { matchString: "[" })
			if (!before) return

			return { range: { anchor: before, focus: editor.selection.anchor } }
		},
		apply: ({ editor }, match) => {
			editor.tf.delete({ at: match.range })
			editor.tf.insertNodes(
				{
					type: KEYS.link,
					url: "",
					wiki: true,
					wikiTarget: "",
					children: [{ text: WIKI_LINK_PLACEHOLDER_TEXT }],
				},
				{ select: true },
			)
			return true
		},
	}),
]

export const AutoformatKit = [
	createSlatePlugin({
		key: "mditAutoformat",
		inputRules: [
			...createBlockRules(),
			...createMarkRules(),
			...createTextSubstitutionRules(),
			...createMathRules(),
			...createWikiLinkRules(),
			...createListRules(),
		],
	}),
]
