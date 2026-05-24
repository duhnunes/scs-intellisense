import type { ClassDef } from '../../../structure'

export const trSemaphoreModel: ClassDef = {
  className: 'tr_semaphore_model',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      description: 'Name from semphore model',
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
      key: 'draw_distance',
      type: 'fixed',
      isArray: false,
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
      type: 'string',
      isArray: true,
      arrayElementType: 'string',
      description: 'ROY|/path/to/sound/file.bank#id',
    },
  ],
}
