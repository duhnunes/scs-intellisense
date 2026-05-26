import type { ClassDef } from '@/src/interfaces/structure'

export const gateModel: ClassDef = {
  className: 'gate_model',
  description: '',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'This is the name from gate model',
    },
    {
      key: 'category',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'Categiry from gate model',
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
      key: 'state_anim',
      type: 'fixed',
      isArray: true,
      arrayElementType: ['resource_tie', 'string'],
      description: 'When string is /path/to/file.pma',
    },
    {
      key: 'sounds',
      type: undefined,
      isArray: true,
      arrayElementType: 'string',
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
