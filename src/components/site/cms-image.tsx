import NextImage, { type ImageProps } from "next/image"

import { normalizeSiteImageSrc } from "@/lib/site-image"

type CmsImageProps = Omit<ImageProps, "src"> & {
  src: string
}

export function CmsImage({ src, ...props }: CmsImageProps) {
  return <NextImage {...props} src={normalizeSiteImageSrc(src)} />
}
