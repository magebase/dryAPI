type PwaIconImageProps = {
  size: number
  includeInsetRing?: boolean
}

export function PwaIconImage({ size, includeInsetRing = false }: PwaIconImageProps) {
  const logoSize = Math.round(size * 0.72)
  const logoInset = Math.round((size - logoSize) / 2)

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        background:
          "radial-gradient(circle at 16% 10%, #ffc170 0%, #ff8b2b 32%, #0f1f31 78%, #09111b 100%)",
        color: "#ffffff",
      }}
    >
      {includeInsetRing ? (
        <div
          style={{
            position: "absolute",
            inset: Math.round(size * 0.08),
            borderRadius: Math.round(size * 0.2),
            border: `${Math.max(8, Math.round(size * 0.04))}px solid rgba(255, 255, 255, 0.16)`,
          }}
        />
      ) : null}
      <div
        style={{
          width: logoSize,
          height: logoSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: Math.round(size * 0.2),
          background: "rgba(11, 20, 32, 0.68)",
          boxShadow: "0 28px 64px rgba(0, 0, 0, 0.38)",
          border: `${Math.max(6, Math.round(size * 0.02))}px solid rgba(255, 255, 255, 0.18)`,
          backdropFilter: "blur(6px)",
          fontFamily: "Arial",
          fontWeight: 800,
          letterSpacing: "0.14em",
          fontSize: Math.round(size * 0.16),
          lineHeight: 1,
          textTransform: "uppercase",
          paddingLeft: Math.round(size * 0.08),
          paddingRight: Math.round(size * 0.08),
          marginTop: logoInset > 0 ? Math.round(size * 0.01) : 0,
        }}
      >
        GFX
      </div>
    </div>
  )
}
