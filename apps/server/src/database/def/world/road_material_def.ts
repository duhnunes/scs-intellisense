import type { ClassDef } from '@/src/interfaces/structure'

export const roadMeterialDef: ClassDef = {
  className: 'road_material_def',
  description: '',
  attributes: [
    {
      key: 'path',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.mat',
    },
    {
      key: 'kerb',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.mat',
    },
  ],
}
