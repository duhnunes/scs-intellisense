import type { ClassDef } from '../../../structure'

export const moverDesc: ClassDef = {
  className: 'mover_desc',
  attributes: [
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pmd',
    },
    {
      key: 'variants',
      type: 'token',
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'lods',
      type: 'resource_tie',
      isArray: true,
      arrayElementType: ['resource_tie', 'string'],
      description: '/path/to/file.pmd',
    },
    {
      key: 'lod_distances',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'fixed',
      description: '',
    },
    {
      key: 'group_tags',
      type: 'token',
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'model_coll',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pmc',
    },
  ],
}
