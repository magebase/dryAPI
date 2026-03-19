import { describe, expect, it } from 'vitest'

import { reorderLinksByPageViews } from './sort-footer-blog-links-by-page-analytics'

describe('reorderLinksByPageViews', () => {
  it('sorts blog links by descending path views', () => {
    const links = [
      { label: 'A', href: '/blog/a' },
      { label: 'B', href: '/blog/b' },
      { label: 'C', href: '/blog/c' },
    ]

    const ordered = reorderLinksByPageViews(
      links,
      new Map([
        ['/blog/a', 12],
        ['/blog/b', 42],
        ['/blog/c', 7],
      ]),
    )

    expect(ordered.map((entry) => entry.href)).toEqual(['/blog/b', '/blog/a', '/blog/c'])
  })

  it('keeps original order for ties and unknown paths', () => {
    const links = [
      { label: 'First', href: '/blog/first' },
      { label: 'Second', href: '/blog/second' },
      { label: 'Third', href: '/blog/third' },
    ]

    const ordered = reorderLinksByPageViews(
      links,
      new Map([
        ['/blog/first', 10],
        ['/blog/second', 10],
      ]),
    )

    expect(ordered.map((entry) => entry.href)).toEqual(['/blog/first', '/blog/second', '/blog/third'])
  })
})
