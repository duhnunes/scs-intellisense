import type { ClassDef } from '../../../structure'

export const signStandModel: ClassDef = {
  className: 'sign_stand_model',
  description: '',
  attributes: [
    {
      key: 'stand_name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'Name from sign stand',
    },
    {
      key: 'category',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'stand_class',
      type: ['token', 'string'],
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'model_coll',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmc',
    },
    {
      key: 'variant_name',
      type: ['token', 'string'],
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'dynamic',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'mass',
      type: ['float', 'fixed'],
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'look_name',
      type: ['token', 'string'],
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
