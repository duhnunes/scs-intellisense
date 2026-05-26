import type { ClassDef } from '@/src/interfaces/structure'

export const trSemaphoreModel: ClassDef = {
  className: 'tr_semaphore_model',
  description: '',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'Name from semphore model',
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
      key: 'draw_distance',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'state_anim',
      type: 'fixed',
      isArray: true,
      arrayElementType: ['resource_tie', 'string'],
      description: '/path/to/file.pma',
    },
    {
      key: 'sounds',
      type: undefined,
      isArray: true,
      arrayElementType: 'string',
      description: 'ROY|/path/to/sound/file.bank#id',
    },
  ],
}
