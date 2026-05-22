import type { ClassDef } from '../../../structure'

export const curveModel: ClassDef = {
  className: 'curve_model',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      description: 'This is the name from your cuver_model.',
    },
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      description: '',
    },
    {
      key: 'variation', // ??
      type: 'fixed',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'start_part', // ??
      type: 'fixed',
      isArray: true,
      arrayElementType: ['token', 'string'],
      description: '',
    },
    {
      key: 'end_part', // ??
      type: 'fixed',
      isArray: true,
      arrayElementType: ['token', 'string'],
      description: '',
    },
    {
      key: 'dynamic_lod_desc',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'resource_tie',
      description: '/path/to/file.pmd',
    },
    {
      key: 'dynamic_lod_dist',
      type: 'fixed',
      isArray: true,
      arrayElementType: ['fixed', 'float'],
      description: '',
    },
    {
      key: 'high_tess', // ??
      type: 'fixed',
      isArray: true,
      arrayElementType: ['token', 'string'],
      description: '',
    },
    {
      key: 'smooth_surface',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'color_variant', // ??
      type: 'fixed',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'overlay', // ??
      type: 'fixed',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'vegetation', // ??
      type: 'fixed',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'fixed_inner_start', // ??
      type: 'fixed',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'fixed_inner_end', // ??
      type: 'fixed',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'fixed_step',
      type: ['float', 'fixed'],
      isArray: false,
      description: '',
    },
  ],
}
