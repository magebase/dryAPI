import type { AppContext, WorkerBindings } from '../types'

import { computePricingEstimate, resolvePricingPolicy } from './pricing'

function createContext(envOverrides?: Partial<WorkerBindings>): AppContext {
  return {
    env: {
      ...envOverrides,
    },
  } as unknown as AppContext
}

describe('pricing worker type resolution', () => {
  it('resolves active worker type from model override and uses active cost', () => {
    const c = createContext({
      RUNPOD_PRICING_WORKER_TYPE_DEFAULT: 'flex',
      RUNPOD_PRICING_CONFIG_JSON: JSON.stringify({
        defaults: {
          workerType: 'flex',
          gpuCostPerSecondUsd: {
            active: 0.002,
            flex: 0.001,
          },
        },
        models: {
          Llama3_8B_Instruct: {
            workerType: 'active',
          },
        },
      }),
    })

    const policy = resolvePricingPolicy({
      c,
      surface: 'chat',
      endpointId: 'chat-endpoint',
      modelSlug: 'Llama3_8B_Instruct',
    })

    expect(policy.workerType).toBe('active')
    expect(policy.gpuCostPerSecondUsd).toBe(0.002)
    expect(policy.gpuCostPerSecondUsdActive).toBe(0.002)
    expect(policy.gpuCostPerSecondUsdFlex).toBe(0.001)
    expect(policy.priceKey).toBe('chat:Llama3_8B_Instruct:chat-endpoint:active')
  })

  it('falls back to default flex worker type when no override is set', () => {
    const c = createContext({
      RUNPOD_PRICING_WORKER_TYPE_DEFAULT: 'flex',
      RUNPOD_PRICING_CONFIG_JSON: JSON.stringify({
        defaults: {
          gpuCostPerSecondUsd: {
            active: 0.0024,
            flex: 0.0011,
          },
        },
      }),
    })

    const policy = resolvePricingPolicy({
      c,
      surface: 'images',
      endpointId: 'images-endpoint',
      modelSlug: null,
    })

    expect(policy.workerType).toBe('flex')
    expect(policy.gpuCostPerSecondUsd).toBe(0.0011)
    expect(policy.priceKey).toBe('images:*:images-endpoint:flex')
  })

  it('supports explicit workerType override from caller', () => {
    const c = createContext({
      RUNPOD_PRICING_WORKER_TYPE_DEFAULT: 'active',
      RUNPOD_PRICING_CONFIG_JSON: JSON.stringify({
        defaults: {
          workerType: 'active',
          gpuCostPerSecondUsd: {
            active: 0.003,
            flex: 0.0012,
          },
        },
      }),
    })

    const policy = resolvePricingPolicy({
      c,
      surface: 'embeddings',
      endpointId: 'embeddings-endpoint',
      modelSlug: 'Bge_M3_INT8',
      workerType: 'flex',
    })

    expect(policy.workerType).toBe('flex')
    expect(policy.gpuCostPerSecondUsd).toBe(0.0012)
    expect(policy.priceKey).toBe('embeddings:Bge_M3_INT8:embeddings-endpoint:flex')
  })

  it('maintains backward compatibility with scalar gpuCostPerSecondUsd', () => {
    const c = createContext({
      RUNPOD_PRICING_CONFIG_JSON: JSON.stringify({
        defaults: {
          gpuCostPerSecondUsd: 0.00077,
        },
      }),
    })

    const policy = resolvePricingPolicy({
      c,
      surface: 'transcribe',
      endpointId: 'transcribe-endpoint',
      modelSlug: null,
    })

    expect(policy.gpuCostPerSecondUsdActive).toBe(0.00077)
    expect(policy.gpuCostPerSecondUsdFlex).toBe(0.00077)
  })

  it('computes provider cost from selected worker type rate', () => {
    const c = createContext({
      RUNPOD_PRICING_WORKER_TYPE_DEFAULT: 'active',
      RUNPOD_PRICING_CONFIG_JSON: JSON.stringify({
        defaults: {
          workerType: 'active',
          gpuCostPerSecondUsd: {
            active: 0.004,
            flex: 0.001,
          },
          startupSeconds: 0.5,
          idleHoldSeconds: 0.5,
        },
      }),
    })

    const policy = resolvePricingPolicy({
      c,
      surface: 'chat',
      endpointId: 'chat-endpoint',
      modelSlug: null,
    })

    const estimate = computePricingEstimate({
      executionSeconds: 1,
      policy,
    })

    expect(estimate.billedRuntimeSeconds).toBe(2)
    expect(estimate.providerCostUsd).toBe(0.008)
    expect(estimate.recommendedPriceUsd).toBeGreaterThanOrEqual(estimate.minPriceUsd)
  })
})
