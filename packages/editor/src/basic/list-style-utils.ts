import { KEYS } from "platejs"

const BULLETED_LIST_STYLES = ["disc", "circle", "square"] as const
// Ordered lists cycle by depth: 1. → a. → i. → (repeat), like word processors.
const ORDERED_LIST_STYLES = ["decimal", "lower-alpha", "lower-roman"] as const

type BulletedListStyle = (typeof BULLETED_LIST_STYLES)[number]
type OrderedListStyle = (typeof ORDERED_LIST_STYLES)[number]

// The list style value ordered lists carry (also the CSS list-style-type).
const ORDERED_LIST_STYLE_TYPE = "decimal"

function styleByIndent<T>(styles: readonly T[], indent?: number): T {
	const normalizedIndent =
		typeof indent === "number" && Number.isFinite(indent) && indent > 0
			? Math.floor(indent)
			: 1
	return styles[(normalizedIndent - 1) % styles.length]
}

export function resolveListStyleTypeByIndent(
	listStyleType: string,
	indent?: number,
) {
	if (listStyleType === KEYS.ul) {
		return resolveBulletedListStyleByIndent(indent)
	}
	if (listStyleType === ORDERED_LIST_STYLE_TYPE) {
		return resolveOrderedListStyleByIndent(indent)
	}
	return listStyleType
}

export function resolveBulletedListStyleByIndent(
	indent?: number,
): BulletedListStyle {
	return styleByIndent(BULLETED_LIST_STYLES, indent)
}

export function resolveOrderedListStyleByIndent(
	indent?: number,
): OrderedListStyle {
	return styleByIndent(ORDERED_LIST_STYLES, indent)
}
