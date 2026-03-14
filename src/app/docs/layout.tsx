import type { ReactNode } from "react"
import { Footer, Layout, Navbar } from "nextra-theme-docs"
import { Search } from "nextra/components"
import { getPageMap } from "nextra/page-map"

import "nextra-theme-docs/style.css"

export const dynamic = "force-static"

export default async function DocsLayout({ children }: { children: ReactNode }) {
  const pageMap = await getPageMap()

  return (
    <Layout
      banner={<span>Documentation version: v1 (latest)</span>}
      docsRepositoryBase="https://github.com/deapi-ai/deapi-docs"
      editLink="Edit this page"
      footer={<Footer>deAPI docs mirror</Footer>}
      navbar={
        <Navbar
          logo={
            <span>
              <strong>deAPI Docs</strong> <span style={{ opacity: 0.7 }}>via Nextra</span>
            </span>
          }
          projectLink="https://github.com/deapi-ai"
        />
      }
      pageMap={pageMap}
      search={<Search placeholder="Search deAPI docs..." />}
      sidebar={{ defaultMenuCollapseLevel: 1 }}
    >
      {children}
    </Layout>
  )
}
