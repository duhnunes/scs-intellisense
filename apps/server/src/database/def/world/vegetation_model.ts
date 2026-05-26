import type { ClassDef } from '@/src/interfaces/structure'

export const vegetationModel: ClassDef = {
  className: 'vegetation_model',
  description: '',
  attributes: [
    {
      key: 'sprite_model',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'detail_vegetation',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'use_collision',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'colbox_size',
      type: ['fixed3', 'float3'],
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'med_poly_model',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'hi_poly_model',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'generic_model',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'follow_surface',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
