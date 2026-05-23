import type { ClassDef } from '../../../structure'

export const railingModel: ClassDef = {
  className: 'railing_model',
  attributes: [
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pmd',
    },
    {
      key: 'look_name',
      type: 'token',
      isArray: false,
      description: '',
    },
    {
      key: 'bridge',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'tunnel',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'use_perlin',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'lod_desc',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pmd',
    },
    {
      key: 'lod_dist',
      type: 'float',
      isArray: false,
      description: '',
    },
    {
      key: 'variation_scheme',
      type: 'string',
      isArray: false,
      description: '',
    },
  ],
}
