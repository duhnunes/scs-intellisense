import type { ClassDef } from '../../../structure'

export const moverModel: ClassDef = {
  className: 'mover_model',
  attributes: [
    {
      key: 'mover_name',
      type: 'string',
      isArray: false,
      description: 'This is the name from your mover.',
    },
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pmd',
    },
    {
      key: 'model_anim',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pma',
    },
    {
      key: 'lods',
      type: 'resource_tie',
      isArray: true,
      arrayElementType: ['resource_tie', 'string'],
      description: '/path/to/file.pmd',
    },
    {
      key: 'lod_dist',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'fixed',
      description: '',
    },
    {
      key: 'pedestrian',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'variants',
      type: 'token',
      isArray: false,
      description: '',
    },
  ],
}
