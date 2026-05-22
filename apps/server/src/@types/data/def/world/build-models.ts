import type { ClassDef } from '../../../structure'

export const buildingModel: ClassDef = {
  className: 'building_model',
  attributes: [
    {
      key: 'railing_model',
      type: 'bool',
      isArray: false,
      description: 'This is the name from your prefab.',
    },
    {
      key: 'follow_curve_dir',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      description: '',
    },
    {
      key: 'lod_desc',
      type: 'resource_tie',
      isArray: false,
      description: '',
    },
    {
      key: 'lod_dist',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'look_name',
      type: 'token',
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
      key: 'single_part',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'vegetation_model',
      type: 'token',
      isArray: true,
      description: '',
    },
    {
      key: 'width',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'sprite_only',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'min_scale',
      type: 'float',
      isArray: false,
      description: '',
    },
    {
      key: 'max_scale',
      type: 'float',
      isArray: false,
      description: '',
    },
    {
      key: 'rand_rot',
      type: 'fixed',
      isArray: false,
      description: '',
    },
  ],
}
