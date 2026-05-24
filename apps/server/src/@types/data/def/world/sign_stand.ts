import type { ClassDef } from '../../../structure'

export const signStandModel: ClassDef = {
  className: 'sign_stand_model',
  attributes: [
    {
      key: 'stand_name',
      type: 'string',
      isArray: false,
      description: 'Name from sign stand',
    },
    {
      key: 'category',
      type: 'string',
      isArray: false,
      description: '',
    },
    {
      key: 'stand_class',
      type: ['token', 'string'],
      isArray: false,
      description: '',
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
      key: 'variant_name',
      type: ['token', 'string'],
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
      key: 'mass',
      type: ['float', 'fixed'],
      isArray: false,
      description: '',
    },
    {
      key: 'look_name',
      type: ['token', 'string'],
      isArray: false,
      description: '',
    },
  ],
}
