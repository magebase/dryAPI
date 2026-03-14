type NeuralNode = {
  id: string
  x: number
  y: number
}

type NeuralConnection = {
  id: string
  from: NeuralNode
  to: NeuralNode
}

const LAYER_X = [8, 32, 56, 80, 94]
const LAYER_Y: number[][] = [
  [14, 34, 54, 74, 92],
  [18, 38, 56, 76],
  [12, 30, 48, 66, 84],
  [20, 40, 60, 80],
  [18, 36, 54, 72, 90],
]

function buildNodes(): NeuralNode[][] {
  return LAYER_X.map((x, layerIndex) => {
    return LAYER_Y[layerIndex].map((y, nodeIndex) => ({
      id: `layer-${layerIndex}-node-${nodeIndex}`,
      x,
      y,
    }))
  })
}

function buildConnections(layers: NeuralNode[][]): NeuralConnection[] {
  const connections: NeuralConnection[] = []

  for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
    const currentLayer = layers[layerIndex]
    const nextLayer = layers[layerIndex + 1]

    for (const currentNode of currentLayer) {
      const scoredTargets = nextLayer
        .map((candidate) => ({
          candidate,
          distance: Math.abs(candidate.y - currentNode.y),
        }))
        .sort((left, right) => left.distance - right.distance)

      const targets = scoredTargets.slice(0, 2).map((entry) => entry.candidate)

      for (const targetNode of targets) {
        connections.push({
          id: `${currentNode.id}__${targetNode.id}`,
          from: currentNode,
          to: targetNode,
        })
      }
    }
  }

  return connections
}

function toCurvePath(connection: NeuralConnection) {
  const { from, to } = connection
  const control1X = from.x + (to.x - from.x) * 0.35
  const control2X = from.x + (to.x - from.x) * 0.72

  return `M ${from.x} ${from.y} C ${control1X} ${from.y}, ${control2X} ${to.y}, ${to.x} ${to.y}`
}

export function NeuralNetworkPulseBackground({ className }: { className?: string }) {
  const layers = buildNodes()
  const nodes = layers.flat()
  const connections = buildConnections(layers)

  return (
    <div
      aria-hidden
      className={[
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.24),transparent_45%),radial-gradient(circle_at_82%_74%,rgba(255,226,211,0.28),transparent_52%)]" />
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <defs>
          <linearGradient id="nn-link-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.24)" />
            <stop offset="45%" stopColor="rgba(255,244,235,0.5)" />
            <stop offset="100%" stopColor="rgba(255,207,170,0.38)" />
          </linearGradient>
          <linearGradient id="nn-pulse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="40%" stopColor="rgba(255,248,239,0.8)" />
            <stop offset="65%" stopColor="rgba(255,233,211,0.95)" />
            <stop offset="100%" stopColor="rgba(255,190,134,0.14)" />
          </linearGradient>
        </defs>

        {connections.map((connection) => {
          const path = toCurvePath(connection)

          return (
            <path
              className="nn-link"
              d={path}
              key={`base-${connection.id}`}
              stroke="url(#nn-link-gradient)"
            />
          )
        })}

        {connections.map((connection, index) => {
          const path = toCurvePath(connection)

          return (
            <path
              className="nn-pulse-link"
              d={path}
              key={`pulse-${connection.id}`}
              stroke="url(#nn-pulse-gradient)"
              style={{
                animationDelay: `${(index % 10) * 0.22}s`,
                animationDuration: `${2.3 + (index % 6) * 0.33}s`,
              }}
            />
          )
        })}

        {nodes.map((node, index) => (
          <g key={node.id}>
            <circle
              className="nn-node-ring"
              cx={node.x}
              cy={node.y}
              r="0.85"
              style={{
                animationDelay: `${(index % 9) * 0.3}s`,
                animationDuration: `${2.8 + (index % 4) * 0.35}s`,
              }}
            />
            <circle className="nn-node-core" cx={node.x} cy={node.y} r="0.38" />
          </g>
        ))}
      </svg>
    </div>
  )
}
