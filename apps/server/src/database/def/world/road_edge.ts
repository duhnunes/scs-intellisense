import type { ClassDef } from '@/src/interfaces/structure'

export const roadEdge: ClassDef = {
  className: 'road_edge',
  description: '',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'Name from road edge',
    },
    {
      key: 'model',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'variant_5',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'variant_15',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'look',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'width',
      type: ['fixed', 'float'],
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
