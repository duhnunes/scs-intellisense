import type { ClassDef } from '../../../structure'

export const modelDef: ClassDef = {
  className: 'model_def',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      description: 'This is the name from your prefab.',
    },
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pmd',
    },
    {
      key: 'vegetation_model',
      type: 'token',
      isArray: false,
      description: '',
    },
    {
      key: 'auto_compound',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'dynamic_lod_desc',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'resource_tie',
      description: '',
    },
    {
      key: 'dynamic_lod_dist',
      type: 'fixed',
      isArray: true,
      arrayElementType: ['fixed', 'float'],
      description: '',
    },
    {
      key: 'static_lod_path',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'resource_tie',
      description: '/path/to/file.pmd',
    },
    {
      key: 'static_lod_name',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'color_variant',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'distance_scale',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'distance_min',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'distance_max',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'category',
      type: 'string',
      isArray: false,
      description: '',
    },
  ],
}
