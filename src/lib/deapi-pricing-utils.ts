import type { DeapiPricingPermutation, DeapiPricingSnapshot } from "@/types/deapi-pricing"

function normalizeToken(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
}

export function toPricingCategorySlug(category: string): string {
	const normalized = normalizeToken(category)
	return normalized.length > 0 ? normalized : "category"
}

export function toPricingCategoryLabel(category: string): string {
	return category
		.replace(/[-_]+/g, " ")
		.replace(/\b\w/g, (character) => character.toUpperCase())
}

export function listPricingCategories(snapshot: DeapiPricingSnapshot | null | undefined): string[] {
	if (!snapshot) {
		return []
	}

	const declared = snapshot.categories.map((category) => category.trim()).filter((category) => category.length > 0)
	if (declared.length > 0) {
		return [...new Set(declared)].sort((left, right) => left.localeCompare(right))
	}

	const derived = snapshot.permutations
		.map((entry) => entry.category.trim())
		.filter((category) => category.length > 0)

	return [...new Set(derived)].sort((left, right) => left.localeCompare(right))
}

export function findPricingCategoryBySlug(
	categories: string[],
	slug: string
): string | null {
	const normalizedSlug = normalizeToken(slug)
	const bySlug = categories.find((category) => toPricingCategorySlug(category) === normalizedSlug)
	if (bySlug) {
		return bySlug
	}

	return (
		categories.find(
			(category) =>
				normalizeToken(category) === normalizedSlug ||
				normalizeToken(category.replace(/[-_]+/g, " ")) === normalizedSlug
		) ?? null
	)
}

export function toCategorySummaryRows(
	permutations: DeapiPricingPermutation[]
): Array<{
	category: string
	modelCount: number
	rowCount: number
	minPriceUsd: number | null
	medianPriceUsd: number | null
}> {
	const grouped = new Map<string, DeapiPricingPermutation[]>()

	for (const permutation of permutations) {
		const key = permutation.category.trim()
		if (!key) {
			continue
		}

		const existing = grouped.get(key) ?? []
		existing.push(permutation)
		grouped.set(key, existing)
	}

	return [...grouped.entries()]
		.map(([category, rows]) => {
			const priced = rows
				.map((row) => row.priceUsd)
				.filter((value): value is number => value !== null && Number.isFinite(value))
				.sort((left, right) => left - right)

			const median = priced.length > 0 ? priced[Math.floor(priced.length / 2)] : null

			return {
				category,
				modelCount: new Set(rows.map((row) => row.model)).size,
				rowCount: rows.length,
				minPriceUsd: priced[0] ?? null,
				medianPriceUsd: median,
			}
		})
		.sort((left, right) => left.category.localeCompare(right.category))
}
