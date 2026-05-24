import type { ClassDef } from '../../../structure'

export const moverModel: ClassDef = {
  className: 'mover_model',
  description: '',
  attributes: [
    {
      key: 'mover_name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'This is the name from mover.',
    },
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'model_anim',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pma',
    },
    {
      key: 'lods',
      type: undefined,
      isArray: true,
      arrayElementType: ['resource_tie', 'string'],
      description: '/path/to/file.pmd',
    },
    {
      key: 'lod_dist',
      type: undefined,
      isArray: true,
      arrayElementType: 'fixed',
      description: '',
    },
    {
      key: 'pedestrian',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'variants',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
