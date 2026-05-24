import type { ClassDef } from '../../../structure'

export const railingModel: ClassDef = {
  className: 'railing_model',
  description: '',
  attributes: [
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'look_name',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'bridge',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'tunnel',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'use_perlin',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'lod_desc',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'lod_dist',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'variation_scheme',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
