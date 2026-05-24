import type { ClassDef } from '../../../structure'

export const vegetationData: ClassDef = {
  className: 'vegetation_data',
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
      key: 'model',
      type: undefined,
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'occurrence',
      type: undefined,
      isArray: true,
      arrayElementType: 'fixed',
      description: '',
    },
    {
      key: 'min_offset',
      type: ['fixed', 'float'],
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'max_offset',
      type: ['fixed', 'float'],
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'density',
      type: ['fixed', 'float'],
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'min_size_perc',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'max_size_perc',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'distribution_map_path',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.{dmd/tga}',
    },
    {
      key: 'distribution_tex_gen',
      type: ['fixed2', 'float2'],
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
