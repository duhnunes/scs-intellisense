import type { ClassDef } from '@/src/interfaces/structure'

export const terrainProfile: ClassDef = {
  className: 'terrain_profile',
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
      key: 'height',
      type: undefined,
      isArray: true,
      arrayElementType: ['fixed', 'float'],
      description: '/path/to/file.pmd',
    },
    {
      key: 'step',
      type: undefined,
      isArray: true,
      arrayElementType: ['fixed', 'float'],
      description: '',
    },
  ],
}
