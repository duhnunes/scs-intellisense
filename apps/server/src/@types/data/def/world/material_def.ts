import type { ClassDef } from '../../../structure'

export const materialDef: ClassDef = {
  className: 'material_def',
  attributes: [
    {
      key: 'path',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.mat',
    },
    {
      key: 'color',
      type: 'float3',
      isArray: false,
      description: '',
    },
    {
      key: 'name',
      type: 'string',
      isArray: false,
      description: '',
    },
  ],
}
