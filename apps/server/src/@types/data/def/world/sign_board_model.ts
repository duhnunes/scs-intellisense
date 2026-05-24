import type { ClassDef } from '../../../structure'

export const signBoardModel: ClassDef = {
  className: 'sign_board_model',
  description: '',
  attributes: [
    {
      key: 'board_name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'Name from sign board',
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
      key: 'look_name',
      type: ['token', 'string'],
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'variant_name',
      type: ['token', 'string'],
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'category',
      type: 'string',
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
  ],
}
