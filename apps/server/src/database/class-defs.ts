import { animatedModel } from './def/world/animated_model_data'
import { buildingModel } from './def/world/building_model'
import { curveModel } from './def/world/curve_model'
import { detailVegData } from './def/world/detail_vegetation_data'
import { detailVegDef } from './def/world/detail_vegetation_def'
import { dynamicCargoGrabProp } from './def/world/dynamic_cargo_grab_prop'
import { farModelDef } from './def/world/far_model_def'
import { findDialogNonVisualItem } from './def/world/find_dialog_non_visual_item'
import { gateModel } from './def/world/gate_model'
import { journeyEventsCutscene } from './def/world/journey_events_cutscene'
import { journeyEventsDetour } from './def/world/journey_events_detour'
import { journeyEventsDetourData } from './def/world/journey_events_detour_data'
import { journeyEventsRoadEvent } from './def/world/journey_events_road_event'
import { journeyEventsRoadEventData } from './def/world/journey_events_road_event_data'
import { loaderGranMatch } from './def/world/loader_grab_match'
import { prefabModel } from './def/world/prefab_model'
import { modelDef } from './def/world/model_def'
import { moverModel } from './def/world/mover_model'
import { moverAction } from './def/world/mover_action'
import { moverAnim } from './def/world/mover_anim'
import { moverDesc } from './def/world/mover_desc'
import { overlayDef } from './def/world/overlay_def'
import { railingModel } from './def/world/railing_model'
import { prefabCorner } from './def/world/prefab_corner'
import { roadDef } from './def/world/road_def'
import { roadEdge } from './def/world/road_edge'
import { roadLook } from './def/world/road_look'
import { roadMeterialDef } from './def/world/road_material_def'
import { materialDef } from './def/world/material_def'
import { trSemaphoreModel } from './def/world/tr_semaphore_model'
import { trSemaphoreProfile } from './def/world/tr_semaphore_profile'
import { signModel } from './def/world/sign_model'
import { signBoardModel } from './def/world/sign_board_model'
import { signStandModel } from './def/world/sign_stand_model'
import { soundItemData } from './def/world/sound_item_data'
import { soundItemReverb } from './def/world/sound_item_reverb'
import { stampData } from './def/world/stamp_data'
import { terrainColor } from './def/world/terrain_color'
import { terrainEdge } from './def/world/terrain_edge'
import { terrainProfile } from './def/world/terrain_profile'
import { trafficLaneData } from './def/world/traffic_lane_data'
import { trafficRuleData } from './def/world/traffic_rule_data'
import { trajectoryRuleData } from './def/world/trajectory_rule_data'
import { triggerAction } from './def/world/trigger_action'
import { vegetationData } from './def/world/vegetation_data'
import { vegetationModel } from './def/world/vegetation_model'
import { buildingScheme } from './def/world/building_scheme'
import { multimonConfig } from './documents/multimon_config'
import type { ClassDef } from '../interfaces/structure'

export const ClassDefinitions: Record<string, ClassDef> = {
  animated_model_data: animatedModel,
  building_model: buildingModel,
  curve_model: curveModel,
  building_scheme: buildingScheme,
  detail_vegetation_data: detailVegData,
  detail_vegetation_def: detailVegDef,
  dynamic_cargo_grab_prop: dynamicCargoGrabProp,
  far_model_def: farModelDef,
  find_dialog_non_visual_item: findDialogNonVisualItem,
  gate_model: gateModel,
  journey_events_cutscene: journeyEventsCutscene,
  journey_events_detour: journeyEventsDetour,
  journey_events_detour_data: journeyEventsDetourData,
  journey_events_road_event_data: journeyEventsRoadEventData,
  journey_events_road_event: journeyEventsRoadEvent,
  loader_grab_match: loaderGranMatch,
  model_def: modelDef,
  mover_model: moverModel,
  mover_action: moverAction,
  mover_anim: moverAnim,
  mover_desc: moverDesc,
  overlay_def: overlayDef,
  prefab_model: prefabModel,
  prefab_corner: prefabCorner,
  railing_model: railingModel,
  road_def: roadDef,
  road_edge: roadEdge,
  road_look: roadLook,
  road_material_def: roadMeterialDef,
  material_def: materialDef,
  tr_semaphore_model: trSemaphoreModel,
  tr_semaphore_profile: trSemaphoreProfile,
  sign_model: signModel,
  sign_board_model: signBoardModel,
  sign_stand_model: signStandModel,
  sound_item_data: soundItemData,
  sound_item_reverb: soundItemReverb,
  stamp_data: stampData,
  terrain_color: terrainColor,
  terrain_edge: terrainEdge,
  terrain_profile: terrainProfile,
  traffic_lane_data: trafficLaneData,
  traffic_rule_data: trafficRuleData,
  trajectory_rule_data: trajectoryRuleData,
  trigger_action: triggerAction,
  vegetation_data: vegetationData,
  vegetation_model: vegetationModel,
  multimon_config: multimonConfig,
}
