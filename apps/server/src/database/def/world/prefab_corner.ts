import type { ClassDef } from '@/src/interfaces/structure'

export const prefabCorner: ClassDef = {
  className: 'prefab_corner',
  description: '',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'This is the name from your prefab corner',
    },
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'prefab_desc',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.ppd',
    },
    {
      key: 'x_uv_slots',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'y_uv_slots',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'random_uv',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
