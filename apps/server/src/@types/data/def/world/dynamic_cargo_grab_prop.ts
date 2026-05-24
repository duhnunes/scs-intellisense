import type { ClassDef } from '../../../structure'

export const dynamicCargoGrabProp: ClassDef = {
  className: 'dynamic_cargo_grab_prop',
  description: '',
  attributes: [
    {
      key: 'model',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pmd',
    },
    {
      key: 'model_animation',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pma',
    },
    {
      key: 'bone_a',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'model_offset',
      type: 'float3',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'model_rotation',
      type: 'float3',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'radius_time',
      type: undefined,
      isArray: true,
      arrayElementType: 'float2',
      description:
        '(radius, anim_time) pairs - must be sorted according to radius!',
    },
    {
      key: 'bone_offset_a',
      type: 'float3',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
