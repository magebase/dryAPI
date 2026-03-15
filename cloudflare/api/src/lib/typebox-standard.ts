import type { TSchema } from 'typebox'
import { Compile } from 'typebox/compile'

type StandardIssue = {
  message: string
  path?: Array<string | number>
}

type StandardResult<T> =
  | {
    value: T
    issues?: undefined
  }
  | {
    issues: StandardIssue[]
    value?: undefined
  }

type TypeboxCompiledValidator = {
  Type: () => TSchema
  Check: (value: unknown) => boolean
  Errors: (value: unknown) => Iterable<{ message: string; path?: string }>
}

type StandardSchema = TypeboxCompiledValidator & {
  '~standard': {
    version: 1
    vendor: 'typebox'
    validate: (value: unknown) => StandardResult<unknown>
  }
}

function toIssuePath(path: string): Array<string | number> | undefined {
  if (!path || path === '/') {
    return undefined
  }

  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) {
    return undefined
  }

  return parts.map((part) => {
    const parsed = Number.parseInt(part, 10)
    return Number.isNaN(parsed) ? part : parsed
  })
}

function toCompiledValidator(input: TSchema | TypeboxCompiledValidator): TypeboxCompiledValidator {
  if (
    typeof input === 'object'
    && input !== null
    && typeof (input as TypeboxCompiledValidator).Type === 'function'
    && typeof (input as TypeboxCompiledValidator).Check === 'function'
    && typeof (input as TypeboxCompiledValidator).Errors === 'function'
  ) {
    return input as TypeboxCompiledValidator
  }

  return Compile(input as TSchema) as unknown as TypeboxCompiledValidator
}

export function toStandardTypeboxSchema(
  schema: TSchema | TypeboxCompiledValidator,
): StandardSchema {
  const compiled = toCompiledValidator(schema)
  const existing = (compiled as Partial<StandardSchema>)['~standard']
  if (existing) {
    return compiled as StandardSchema
  }

  Object.defineProperty(compiled, '~standard', {
    value: {
      version: 1,
      vendor: 'typebox',
      validate: (value: unknown): StandardResult<unknown> => {
        if (compiled.Check(value)) {
          return { value }
        }

        const issues = Array.from(compiled.Errors(value)).map((error) => ({
          message: error.message,
          path: toIssuePath(error.path ?? ''),
        }))

        return {
          issues: issues.length > 0 ? issues : [{ message: 'Invalid request payload' }],
        }
      },
    },
    enumerable: false,
    configurable: false,
  })

  return compiled as StandardSchema
}
