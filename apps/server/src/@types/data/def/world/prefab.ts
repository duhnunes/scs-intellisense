import type { ClassDef } from "../../../structure";

export const prefabModel: ClassDef = {
  className: 'prefab_model',
  attributes: [
    /**
     * `name` - `string`
     * Is a name from your prefab
     */
    { key: 'name', type: 'string', description: "This is the name from your prefab."},
    /** 
     * `model_desc` - `resource_tie`
     * Is path to your prefab model
     */
    { key: 'model_desc', type: 'resource_tie' },
    /**
     * `prefab_desc` - `resource_tie`
     * Is path to your prefab description
     */
    { key: 'prefab_desc', type: 'resource_tie' },
    /**
     * `use_perlin` - `boolean`
     * Active the perlin noise
     */
    { key: 'use_perlin', type: 'bool' },
    { key: 'dynamic_lod_desc', type: ['fixed', 'resource_tie'], isArray: true, arrayElementType: 'fixed' },
    { key: 'dynamic_lod_dist', type: 'fixed', isArray: true, arrayElementType: 'fixed' },
    { key: 'tweak_detail_vegetation', type: 'bool' },
    { key: 'allowed_trailer_length', type: 'fixed' },
    { key: 'category', type: 'string' },
    { key: 'detail_veg_max_distance', type: 'fixed' },
    { key: 'slow_time', type: 'bool' },
    { key: 'use_semaphores', type: 'bool' },
    { key: 'corner0', type: ['token', 'fixed'], isArray: true, arrayElementType: 'string' }, // token??
    { key: 'corner1', type: ['token', 'fixed'], isArray: true, arrayElementType: 'string' }, // token??
    { key: 'corner2', type: ['token', 'fixed'], isArray: true, arrayElementType: 'string' }, // token??
    { key: 'corner3', type: ['token', 'fixed'], isArray: true, arrayElementType: 'string' }, // token??
    { key: 'corner4', type: ['token', 'fixed'], isArray: true, arrayElementType: 'string' }, // token??
    { key: 'corner5', type: ['token', 'fixed'], isArray: true, arrayElementType: 'string' }, // token??
    { key: 'semaphore_profile', type: 'token', isArray: true },
    { key: 'traffic_rules_output', type: 'string', isArray: true },
    { key: 'traffic_rules_input', type: 'string', isArray: true },
    { key: 'gps_avoid', type: 'bool' },
    { key: 'invisible', type: 'bool' },
    { key: 'running_timer', type: 'fixed2' },
    { key: 'disabled_depot', type: 'token' }
  ]
}
