import type { ClassDef } from '../../../structure'

export const buildingScheme: ClassDef = {
  className: 'building_scheme',
  description: '',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'This is the name from building_scheme',
    },
    {
      key: 'models',
      type: undefined,
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'player_limiter',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'color_variant',
      type: undefined,
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'category',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'smooth_surface',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
