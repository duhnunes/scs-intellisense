import type { ClassDef } from '@/src/interfaces/structure'

export const terrainColor: ClassDef = {
  className: 'terrain_color',
  description: '',
  attributes: [
    {
      key: 'material',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'names',
      type: undefined,
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'colors',
      type: undefined,
      isArray: true,
      arrayElementType: 'float3',
      description: '',
    },
  ],
}
