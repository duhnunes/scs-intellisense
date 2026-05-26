import type { ClassDef } from '@/src/interfaces/structure'

export const moverDesc: ClassDef = {
  className: 'mover_desc',
  description: '',
  attributes: [
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'variants',
      type: undefined,
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'lods',
      type: undefined,
      isArray: true,
      arrayElementType: ['resource_tie', 'string'],
      description: '/path/to/file.pmd',
    },
    {
      key: 'lod_distances',
      type: undefined,
      isArray: true,
      arrayElementType: 'fixed',
      description: '',
    },
    {
      key: 'group_tags',
      type: undefined,
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'model_coll',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmc',
    },
  ],
}
