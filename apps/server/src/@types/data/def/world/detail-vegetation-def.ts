import type { ClassDef } from '../../../structure'

export const detailVegDef: ClassDef = {
  className: 'detail_vegetation_def',
  attributes: [
    {
      key: 'texture',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.tobj',
    },
    {
      key: 'model',
      type: 'resource_tie',
      isArray: true,
      arrayElementType: 'resource_tie',
      description: 'path/to/file.pmd',
    },
    {
      key: 'occurrence',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'fixed',
      description: '',
    },
    {
      key: 'density',
      type: 'fixed',
      isArray: false,
      description: 'Value of density',
    },
    {
      key: 'distribution_tex_gen',
      type: 'float2',
      isArray: false,
      description: '',
    },
    {
      key: 'distribution_map_path',
      type: 'resource_tie',
      isArray: false,
      description: 'path/to/file.dmd',
    },
  ],
}
