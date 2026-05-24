import type { ClassDef } from '../../../structure'

export const roadEdge: ClassDef = {
  className: 'road_edge',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      description: 'Name from road edge',
    },
    {
      key: 'model',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pmd',
    },
    {
      key: 'variant_5',
      type: 'token',
      isArray: false,
      description: '',
    },
    {
      key: 'variant_15',
      type: 'token',
      isArray: false,
      description: '',
    },
    {
      key: 'look',
      type: 'token',
      isArray: false,
      description: '',
    },
    {
      key: 'width',
      type: ['fixed', 'float'],
      isArray: false,
      description: '',
    },
  ],
}
