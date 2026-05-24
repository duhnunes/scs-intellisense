import type { ClassDef } from '../../../structure'

export const terrainProfile: ClassDef = {
  className: 'terrain_profile',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      description: '',
    },
    {
      key: 'height',
      type: ['fixed', 'float'],
      isArray: true,
      arrayElementType: ['fixed', 'float'],
      description: '/path/to/file.pmd',
    },
    {
      key: 'step',
      type: ['fixed', 'float'],
      isArray: true,
      arrayElementType: ['fixed', 'float'],
      description: '',
    },
  ],
}
