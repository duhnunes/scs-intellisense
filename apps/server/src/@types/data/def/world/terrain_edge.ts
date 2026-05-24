import type { ClassDef } from '../../../structure'

export const terrainEdge: ClassDef = {
  className: 'terrain_edge',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      description: '',
    },
    {
      key: 'model',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pmd',
    },
    {
      key: 'uv_type',
      type: 'float', // ??
      isArray: false,
      description: '',
    },
  ],
}
