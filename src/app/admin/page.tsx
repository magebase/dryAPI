import { redirect } from "next/navigation"

export const dynamic = "force-static"

export default function AdminPage() {
  redirect("/admin/index.html")
}
