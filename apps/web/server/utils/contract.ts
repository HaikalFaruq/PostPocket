import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js'
import { parse } from 'yaml'

// Validator skema dari docs/api/openapi.yaml, supaya mock API (dan test) mengikuti kontrak apa
// adanya: kalau kontraknya berubah, mock ikut berubah tanpa disalin ulang.

export type ContractSchemas = (name: string) => ValidateFunction

/** Kompilasi `components.schemas` dari teks openapi.yaml. */
export function compileContract(text: string): ContractSchemas {
  const spec = parse(text) as { components: { schemas: Record<string, unknown> } }
  // Format yang dipakai kontrak. `discriminator` dibiarkan: `kind` sudah dibedakan lewat `const`.
  // `verbose` menyertakan data dan skema di tiap error, dipakai contractDetails().
  const ajv = new Ajv2020({ allErrors: true, strict: false, verbose: true })
  ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  ajv.addFormat('date-time', (value: string) => !Number.isNaN(Date.parse(value)))
  ajv.addFormat('uri', (value: string) => URL.canParse(value))
  ajv.addSchema({ $id: 'openapi', components: { schemas: spec.components.schemas } })
  return (name) => {
    const validate = ajv.getSchema(`openapi#/components/schemas/${name}`)
    if (!validate) throw new Error(`Skema ${name} tidak ada di kontrak`)
    return validate
  }
}

interface KindSchema {
  const?: unknown
  properties?: { kind?: { const?: unknown } }
  allOf?: KindSchema[]
}

/** Error dari cabang `oneOf` untuk `kind` lain, misalnya cabang foto saat elemennya teks. */
function fromOtherKind(error: ErrorObject): boolean {
  const schema = error.parentSchema as KindSchema | undefined
  const onKind = error.instancePath.endsWith('/kind')
  const branch = onKind
    ? schema?.const
    : (schema?.properties?.kind?.const ??
      schema?.allOf?.find((part) => part.properties?.kind)?.properties?.kind?.const)
  if (branch === undefined) return false
  const actual = onKind ? error.data : (error.data as { kind?: unknown } | undefined)?.kind
  return actual !== branch
}

/**
 * Error ajv sebagai `details` di skema `Error`, dengan path seperti `content.elements[2].size`.
 * Field asing ikut disebut namanya. Cabang `oneOf` dengan `kind` lain dilewati.
 */
export function contractDetails(errors: ErrorObject[] | null | undefined) {
  const details = new Map<string, { path: string; message: string }>()
  for (const error of errors ?? []) {
    if (fromOtherKind(error)) continue
    const params = error.params as { additionalProperty?: string; unevaluatedProperty?: string }
    const extra = params.additionalProperty ?? params.unevaluatedProperty
    const parts = [...error.instancePath.split('/').slice(1), ...(extra ? [extra] : [])]
    const path =
      parts
        .map((part, i) => (/^\d+$/.test(part) ? `[${part}]` : `${i ? '.' : ''}${part}`))
        .join('') || '(body)'
    const message = error.message ?? 'tidak sesuai skema'
    details.set(`${path} ${message}`, { path, message })
  }
  return [...details.values()].slice(0, 10)
}

let loaded: Promise<ContractSchemas> | undefined

/** Kontrak untuk mock, dibaca sekali dari server asset `contract:openapi.yaml`. */
export function useContract(): Promise<ContractSchemas> {
  loaded ??= useStorage('assets:contract')
    .getItem<string>('openapi.yaml')
    .then((text) => compileContract(String(text)))
  return loaded
}
