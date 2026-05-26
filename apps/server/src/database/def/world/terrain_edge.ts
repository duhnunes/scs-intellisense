import type { ClassDef } from '@/src/interfaces/structure'

export const terrainEdge: ClassDef = {
  className: 'terrain_edge',
  description: '',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'model',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'uv_type',
      type: 'float', // ??
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
