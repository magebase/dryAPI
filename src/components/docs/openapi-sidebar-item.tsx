"use client";

import type { Item as PageTreeItem } from "fumadocs-core/page-tree";
import { usePathname } from "fumadocs-core/framework";
import { SidebarItem, useFolderDepth } from "fumadocs-ui/components/sidebar/base";

const HTTP_METHOD_PATTERN = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(.+)$/i;

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

function isActivePath(href: string, pathname: string) {
  const normalizedHref = normalizePath(href);
  const normalizedPathname = normalizePath(pathname);

  return (
    normalizedHref === normalizedPathname ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
}

function getItemOffset(depth: number) {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

function getMethodBadgeColorClass(method: string) {
  switch (method) {
    case "PUT":
      return "text-yellow-600 dark:text-yellow-400";
    case "PATCH":
      return "text-orange-600 dark:text-orange-400";
    case "DELETE":
      return "text-red-600 dark:text-red-400";
    case "GET":
      return "text-green-600 dark:text-green-400";
    default:
      return "text-blue-600 dark:text-blue-400";
  }
}

function splitMethodPrefix(name: string) {
  const match = HTTP_METHOD_PATTERN.exec(name.trim());
  if (!match) {
    return {
      method: null,
      title: name,
    };
  }

  return {
    method: match[1].toUpperCase(),
    title: match[2],
  };
}

type OpenApiSidebarItemProps = {
  item: PageTreeItem;
};

export function OpenApiSidebarItem({ item }: OpenApiSidebarItemProps) {
  const pathname = usePathname();
  const depth = useFolderDepth();
  const active = isActivePath(item.url, pathname);

  const nameText = typeof item.name === "string" ? item.name : null;
  const parsed = nameText ? splitMethodPrefix(nameText) : null;
  const shouldShowMethodBadge =
    Boolean(parsed?.method) &&
    (item.url.includes("/api/") ||
      item.url.includes("/api-reference/") ||
      item.url.includes("/openapi/"));

  return (
    <SidebarItem
      href={item.url}
      external={item.external}
      active={active}
      icon={item.icon}
      className="relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere [&_svg]:size-4 [&_svg]:shrink-0 transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary data-[active=true]:hover:transition-colors"
      style={{
        paddingInlineStart: getItemOffset(depth),
      }}
    >
      {parsed ? parsed.title : item.name}
      {shouldShowMethodBadge && parsed?.method ? (
        <span
          className={`font-mono font-medium ms-auto text-xs text-nowrap ${getMethodBadgeColorClass(parsed.method)}`}
        >
          {parsed.method}
        </span>
      ) : null}
    </SidebarItem>
  );
}