import type { ClassDef } from '../../../structure'

export const roadMeterialDef: ClassDef = {
  className: 'road_material_def',
  attributes: [
    {
      key: 'path',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.mat',
    },
    {
      key: 'kerb',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.mat',
    },
  ],
}
