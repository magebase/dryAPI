import fs from "node:fs"
import path from "node:path"

const adminDir = path.join(process.cwd(), "public", "admin")
const indexPath = path.join(adminDir, "index.html")
const assetsDir = path.join(adminDir, "assets")

const hasLocalhostDevRefs = (html) =>
  html.includes("http://localhost:4001/@vite/client") ||
  html.includes("http://localhost:4001/src/main.tsx") ||
  html.includes("http://localhost:4001/@react-refresh")

const pickLatestFile = (dirPath, matcher) => {
  const files = fs
    .readdirSync(dirPath)
    .filter((file) => matcher.test(file))
    .map((file) => {
      const fullPath = path.join(dirPath, file)
      const stats = fs.statSync(fullPath)
      return { file, mtimeMs: stats.mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  return files[0]?.file
}

const renderStaticAdminHtml = ({ jsBundle, cssBundle }) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <link rel="icon" type="image/svg+xml" href="/vite.svg">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TinaCMS</title>
    <script type="module" crossorigin src="/admin/assets/${jsBundle}"></script>
    <link rel="stylesheet" href="/admin/assets/${cssBundle}">
  </head>
  <body class="tina-tailwind">
    <div id="root"></div>
    <script>
      function handleLoadError() {
        console.error('Failed to load assets')
        document.getElementById('root').innerHTML =
          '<style type="text/css">\\
        #no-assets-placeholder body {\\
          font-family: sans-serif;\\
          font-size: 16px;\\
          line-height: 1.4;\\
          color: #333;\\
          background-color: #f5f5f5;\\
        }\\
        #no-assets-placeholder {\\
          max-width: 600px;\\
          margin: 0 auto;\\
          padding: 40px;\\
          text-align: center;\\
          background-color: #fff;\\
          box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.1);\\
        }\\
        #no-assets-placeholder h1 {\\
          font-size: 24px;\\
          margin-bottom: 20px;\\
        }\\
        #no-assets-placeholder p {\\
          margin-bottom: 10px;\\
        }\\
        #no-assets-placeholder a {\\
          color: #0077cc;\\
          text-decoration: none;\\
        }\\
        #no-assets-placeholder a:hover {\\
          text-decoration: underline;\\
        }\\
        </style>\\
        <div id=\'no-assets-placeholder\'>\\
          <h1>Failed loading TinaCMS assets</h1>\\
          <p>\\
            Your TinaCMS configuration may be misconfigured, and we could not load\\
            the assets for this page.\\
          </p>\\
          <p>\\
            Please visit <a href="https://tina.io/docs/r/FAQ/#13-how-do-i-resolve-failed-loading-tinacms-assets-error">this doc</a> for help.\\
          </p>\\
        </div>'
      }

      setTimeout(() => {
        if (!document.getElementById('root').children.length) {
          handleLoadError()
        }
      }, 2000)
    </script>
  </body>
</html>
`

const main = () => {
  if (!fs.existsSync(indexPath) || !fs.existsSync(assetsDir)) {
    console.log("[admin:repair] Skipped: admin index or assets directory is missing.")
    return
  }

  const existing = fs.readFileSync(indexPath, "utf8")
  if (!hasLocalhostDevRefs(existing)) {
    console.log("[admin:repair] Skipped: admin index already uses local /admin/assets bundles.")
    return
  }

  const jsBundle = pickLatestFile(assetsDir, /^index-[^.]+\.js$/)
  const cssBundle = pickLatestFile(assetsDir, /^index-[^.]+\.css$/)

  if (!jsBundle || !cssBundle) {
    console.warn("[admin:repair] Could not find index JS/CSS bundles in public/admin/assets.")
    return
  }

  const repairedHtml = renderStaticAdminHtml({ jsBundle, cssBundle })
  fs.writeFileSync(indexPath, repairedHtml, "utf8")

  console.log(`[admin:repair] Repaired admin index to use /admin/assets/${jsBundle} and /admin/assets/${cssBundle}.`)
}

main()
