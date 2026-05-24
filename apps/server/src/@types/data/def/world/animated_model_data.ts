import type { ClassDef } from '../../../structure'

export const animatedModel: ClassDef = {
  className: 'animated_model_data',
  description: '',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'This is the name from your prefab.',
    },
    {
      key: 'model',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'animations',
      type: undefined,
      isArray: true,
      arrayElementType: 'resource_tie',
      description: '/path/to/file.pma',
    },
    {
      key: 'probability_day',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'probability_night',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
