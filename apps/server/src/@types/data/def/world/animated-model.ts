import type { ClassDef } from '../../../structure'

export const animatedModel: ClassDef = {
  className: 'animated_model_data',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      description: 'This is the name from your prefab.',
    },
    {
      key: 'model',
      type: 'resource_tie',
      isArray: false,
      description: '',
    },
    {
      key: 'animations',
      type: 'resource_tie',
      isArray: true,
      description: '',
    },
    {
      key: 'probability_day',
      type: 'float',
      isArray: false,
      description: '',
    },
    {
      key: 'probability_night',
      type: 'float',
      isArray: false,
      description: '',
    },
  ],
}
