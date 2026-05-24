import type { ClassDef } from '../../../structure'

export const terrainColor: ClassDef = {
  className: 'terrain_color',
  attributes: [
    {
      key: 'material',
      type: 'token',
      isArray: false,
      description: '',
    },
    {
      key: 'names',
      type: 'string',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'colors',
      type: 'float3',
      isArray: true,
      arrayElementType: 'float3',
      description: '',
    },
  ],
}
