import type { ClassDef } from '../../../structure'

export const signModel: ClassDef = {
  className: 'sign_model',
  attributes: [
    {
      key: 'sign_name',
      type: 'string',
      isArray: false,
      description: 'Name from sign',
    },
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pmd',
    },
    {
      key: 'model_coll',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pmc',
    },
    {
      key: 'look_name',
      type: ['token', 'string'],
      isArray: false,
      description: '',
    },
    {
      key: 'variant_name',
      type: ['token', 'string'],
      isArray: false,
      description: '',
    },
    {
      key: 'category',
      type: 'string',
      isArray: false,
      description: '',
    },
    {
      key: 'dynamic',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'road_model',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'drop_sun_shadows',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'mass',
      type: ['float', 'fixed'],
      isArray: false,
      description: '',
    },
    {
      key: 'dynamic_lod_disc',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'resource_tie',
      description: 'array "[]" = /path/to/file.pmd',
    },
    {
      key: 'dynamic_lod_dist',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'fixed',
      description: '',
    },
    {
      key: 'stand_classes',
      type: 'fixed',
      isArray: true,
      arrayElementType: ['token', 'string'],
      description: '',
    },
    {
      key: 'editable',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'boards',
      type: 'bool',
      isArray: false,
      description: '',
    },
    {
      key: 'traffic_rule',
      type: ['token', 'string'],
      isArray: false,
      description: '',
    },
    {
      key: 'traffic_rule_lane_count',
      type: 'fixed',
      isArray: false,
      description: '',
    },
  ],
}
