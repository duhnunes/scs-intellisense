import type { ClassDef } from '../../../structure'

export const prefabCorner: ClassDef = {
  className: 'prefab_corner',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      description: 'This is the name from your prefab corner',
    },
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pmd',
    },
    {
      key: 'prefab_desc',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.ppd',
    },
    {
      key: 'x_uv_slots',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'y_uv_slots',
      type: 'fixed',
      isArray: false,
      description: '/path/to/file.pmd',
    },
    {
      key: 'random_uv',
      type: 'bool',
      isArray: false,
      description: '',
    },
  ],
}
