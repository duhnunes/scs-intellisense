import type { AttributeType } from '../interfaces/structure'

export function snippetForTypes(type: AttributeType | AttributeType[]): string {
  const t = Array.isArray(type) ? type[0] : type

  switch (t) {
    case 'string':
    case 'resource_tie':
      return '"${1:...}"'
    case 'float':
      return '${1:0.0}'
    case 'float2':
      return '(${1:0.0}, ${2:0.0})'
    case 'float3':
      return '(${1:0.0}, ${2:0.0}, ${3:0.0})'
    case 'float4':
      return '(${1:0.0}, ${2:0.0}, ${3:0.0}, ${4:0.0})'
    case 'placement':
      return '(${1:0,0,0})(${2:1;0,0,0})'
    case 'fixed':
      return '${1:0}'
    case 'fixed2':
    case 'int2':
      return '(${1:0}, ${2:0})'
    case 'fixed3':
      return '(${1:0}, ${2:0}, ${3:0})'
    case 'fixed4':
      return '(${1:0}, ${2:0}, ${3:0}, ${4:0})'
    case 'quaternion':
      return '(${1:1.0}, ${2:0.0}, ${3:0.0}, ${4:0.0}'
    case 's16':
    case 's32':
    case 's64':
    case 'u16':
    case 'u32':
    case 'u64':
      return '${1:0}'
    case 'bool':
      return '${1|true,false|}'
    case 'token':
      return '${1:my_token}'
    case 'owner_ptr':
      return '${1:.unit.name}'
    case 'link_ptr':
      return '${1:some.named.unit}'
    default:
      return '${1:...}'
  }
}
