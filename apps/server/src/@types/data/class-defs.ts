import type { ClassDef } from '../structure'
import { animatedModel } from './def/world/animated-model'
import { buildingModel } from './def/world/build-models'
import { curveModel } from './def/world/curve-model'
import { detailVegData } from './def/world/detail-vegetation'
import { detailVegDef } from './def/world/detail-vegetation-def'
import { dynamicCargoGrabProp } from './def/world/dynamic-cargo-grab-prop'
import { farModelDef } from './def/world/far-model-def'
import { findDialogNonVisualItem } from './def/world/find-dialog-non-visual-item'
import { gateModel } from './def/world/gate-model'
import { journeyEventsCutscene } from './def/world/journey-cutscene'
import { journeyDetour } from './def/world/journey-detour'
import { journeyEventsDetourData } from './def/world/journey-events-detour-data'
import { journeyEventsRoadEvent } from './def/world/journey-events-road-event'
import { journeyEventsRoadEventData } from './def/world/journey-events-road-event-master'
import { loaderGranMatch } from './def/world/loader-grab-match'
import { prefabModel } from './def/world/prefab'
import { modelDef } from './def/world/model-def'
import { moverModel } from './def/world/mover-model'
import { moverAction } from './def/world/mover-action'
import { moverAnim } from './def/world/mover-anim'
import { moverDesc } from './def/world/mover-desc'
import { overlayDef } from './def/world/overlay-def'
import { railingModel } from './def/world/railing'
import { prefabCorner } from './def/world/prefab-corner'

export const ClassDefinitions: Record<string, ClassDef> = {
  prefab_model: prefabModel,
  animated_model_data: animatedModel,
  building_model: buildingModel,
  curve_model: curveModel,
  detail_vegetation_def: detailVegDef,
  detail_vegetation_data: detailVegData,
  dynamic_cargo_grab_prop: dynamicCargoGrabProp,
  far_model_def: farModelDef,
  find_dialog_non_visual_item: findDialogNonVisualItem,
  gate_model: gateModel,
  journey_events_cutscene: journeyEventsCutscene,
  journey_detour: journeyDetour,
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
  railing_model: railingModel,
  prefab_corner: prefabCorner,
}
