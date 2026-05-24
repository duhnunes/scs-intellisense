import type { ClassDef } from '../../../structure'

export const materialDef: ClassDef = {
  className: 'material_def',
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
      key: 'color',
      type: 'float3',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
