import type { ClassDef } from '../../../structure'

export const trafficRuleData: ClassDef = {
  className: 'traffic_rule_data',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      description: '',
    },
    {
      key: 'rule',
      type: 'string',
      isArray: false,
      description: '',
    },
    {
      key: 'num_params',
      type: ['fixed', 'float'],
      isArray: true,
      arrayElementType: ['fixed', 'float'],
      description: `
        Some anotations from original file:
          - 0.5: block time after reaching 'stop speed'
          - 0.5: block while speed is higher than this [m/s]
          - 0: include vehicle types (default)
          - 0: disallow
          - 0: inclusive
          - 0: disable player access
          - 0: no change to vehicle access
          - 0: no change to trailer access
          - 1: exclude vehicle types
          - 1: allow
          - 1: exclusive
          - 1: set vehicle access
          - 1: set trailer access
          - 1: fixed position
          - 1.5: block time after reaching 'stop speed'
          - 2: context-specific
          - 7.0: block while speed is higher than this [m/s]
          - 24: AI slow-down (without speed limit change)
      `,
    },
    {
      key: 'additional_rules',
      type: 'token',
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'str_params',
      type: 'string',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
  ],
}
