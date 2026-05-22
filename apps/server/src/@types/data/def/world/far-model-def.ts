import type { ClassDef } from '../../../structure'

export const farModelDef: ClassDef = {
  className: 'far_model_def',
  attributes: [
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.pmd',
    },
  ],
}
