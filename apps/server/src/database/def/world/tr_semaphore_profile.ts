import type { ClassDef } from '@/src/interfaces/structure'

export const trSemaphoreProfile: ClassDef = {
  className: 'tr_semaphore_profile',
  description: '',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'Name from semphore profile',
    },
    {
      key: 'inherited',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'model',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'type',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'interval',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'float4',
      description: '(x, y, z, w)',
    },
    {
      key: 'cycle',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'float',
      description: '',
    },
    {
      key: 'id_map',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'fixed',
      description: '',
    },
    {
      key: 'model_offset',
      type: undefined,
      isArray: true,
      arrayElementType: 'fixed3',
      description: '',
    },
    {
      key: 'id_offset',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
