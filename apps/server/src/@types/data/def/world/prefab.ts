import type { ClassDef } from "../../../structure";

export const prefabModel: ClassDef = {
  className: 'prefab_model',
  attributes: [
    { 
      key: 'name',
      type: 'string',
      description: "This is the name from your prefab."
    },
    {
      key: 'model_desc',
      type: 'resource_tie',
      description: ""
    },
    {
      key: 'prefab_desc',
      type: 'resource_tie',
      description: ""
    },
    {
      key: 'use_perlin',
      type: 'bool',
      description: ""
    },
    {
      key: 'dynamic_lod_desc',
      type: ['fixed', 'resource_tie'],
      isArray: true,
      arrayElementType: 'fixed',
      description: ""
    },
    {
      key: 'dynamic_lod_dist',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'fixed',
      description: ""
    },
    {
      key: 'tweak_detail_vegetation',
      type: 'bool',
      description: ""
    },
    {
      key: 'allowed_trailer_length',
      type: 'fixed',
      description: ""
    },
    {
      key: 'category',
      type: 'string',
      description: ""
    },
    {
      key: 'detail_veg_max_distance',
      type: 'fixed',
      description: ""
    },
    {
      key: 'slow_time',
      type: 'bool',
      description: ""
    },
    {
      key: 'use_semaphores',
      type: 'bool',
      description: ""
    },
    {
      key: 'corner0',
      type: ['token', 'fixed'],
      isArray: true,
      arrayElementType: 'string',
      description: ""
    },
    {
      key: 'corner1',
      type: ['token', 'fixed'],
      isArray: true,
      arrayElementType: 'string',
      description: ""
    },
    {
      key: 'corner2',
      type: ['token', 'fixed'],
      isArray: true,
      arrayElementType: 'string',
      description: ""
    },
    {
      key: 'corner3',
      type: ['token', 'fixed'],
      isArray: true,
      arrayElementType: 'string',
      description: ""
    },
    {
      key: 'corner4',
      type: ['token', 'fixed'],
      isArray: true,
      arrayElementType: 'string',
      description: ""
    },
    {
      key: 'corner5',
      type: ['token', 'fixed'],
      isArray: true,
      arrayElementType: 'string',
      description: ""
    },
    {
      key: 'semaphore_profile',
      type: 'token',
      isArray: true,
      description: ""
    },
    {
      key: 'traffic_rules_output',
      type: 'string',
      isArray: true,
      description: ""
    },
    {
      key: 'traffic_rules_input',
      type: 'string',
      isArray: true,
      description: ""
    },
    {
      key: 'gps_avoid',
      type: 'bool',
      description: ""
    },
    {
      key: 'invisible',
      type: 'bool',
      description: ""
    },
    {
      key: 'running_timer',
      type: 'fixed2',
      description: ""
    },
    {
      key: 'disabled_depot',
      type: 'token',
      description: ""
    }
  ]
}
