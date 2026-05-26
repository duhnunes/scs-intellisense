import type { ClassDef } from '@/src/interfaces/structure'

export const farModelDef: ClassDef = {
  className: 'far_model_def',
  description: '',
  attributes: [
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'dynamic_lod_desc',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'resource_tie',
      description: '/path/to/file.pmd',
    },
    {
      key: 'dynamic_lod_dist',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
