import type { ClassDef } from '../../../structure'

export const gateModel: ClassDef = {
  className: 'gate_model',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      description: 'This is the name from your gate model',
    },
    {
      key: 'category',
      type: 'string',
      isArray: false,
      description: 'Categiry from your gate model',
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
      key: 'state_anim',
      type: 'fixed',
      isArray: true,
      arrayElementType: ['resource_tie', 'string'],
      description: 'When string is /path/to/file.pma',
    },
    {
      key: 'sounds',
      type: 'resource_tie',
      isArray: true,
      arrayElementType: ['resource_tie', 'string'],
      description: 'OY|/path/to/file.soundref',
    },
    {
      key: 'interval_overrides',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'float',
      description: '',
    },
  ],
}
