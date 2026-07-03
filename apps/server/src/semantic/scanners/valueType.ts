export function inferTypeFromValueText(raw: string): string {
  const v = raw.trim()
  if (!v) return 'string'
  // string
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  )
    return 'string'

  // boolean
  if (v === 'true' || v === 'false') return 'bool'

  // vector (x, y, z)
  if (v.startsWith('(') && v.endsWith(')')) {
    const inner = v.slice(1, -1).trim()
    const parts = inner
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    const ishexElement = (p: string) =>
      /^&[0-9a-fA-F]{8}$/.test(p) || /^&[0-9a-fA-F]+$/.test(p)
    const allHexOrFloatLike = parts.every(
      (p) => ishexElement(p) || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(p)
    )
    const allFloatLike = parts.every((p) =>
      /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(p)
    )
    const allIntLike = parts.every((p) => /^-?\d+$/.test(p))

    if (allHexOrFloatLike) {
      if (parts.length === 2) return 'float2'
      if (parts.length === 3) return 'float3'
      if (parts.length === 4) return 'float4'
      return 'float'
    }
    if (allFloatLike) {
      if (parts.length === 2) return 'float2'
      if (parts.length === 3) return 'float3'
      if (parts.length === 4) return 'float4'
      return 'float'
    }
    if (allIntLike) {
      if (parts.length === 2) return 'fixed2'
      if (parts.length === 3) return 'fixed3'
      if (parts.length === 4) return 'fixed4'
      return 'fixed'
    }
    if (v.startsWith('(') && v.includes(')(')) {
      return 'placement'
    }
    return 'string'
  }
  // IEEE754 hex float: &3f800000 (common form) or &<hex+>
  if (/^&[0-9a-fA-F]{8}$/.test(v) || /^&[0-9a-fA-F]+$/.test(v)) return 'float'
  // fixed  - decimal float: 1.0
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)) return 'float'
  // owner_ptr (leading dot) and link_ptr/token (withou leading dot)
  // owner_ptr: .some.nameless.unit
  if (/^\.[a-z0-9_.]+$/.test(v)) return 'owner_ptr'
  // link pointer or token: some.named.unit or simple tokenn
  if (/^[a-z0-9_.]+$/.test(v)) {
    // prefer link_ptr when contains a dot (named unit), otherwise token
    if (v.includes('.')) return 'link_ptr'
    return 'token'
  }
  return 'string'
}
