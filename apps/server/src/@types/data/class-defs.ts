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
import { loaderGranMatch } from './def/world/loader_grab_match'
import { prefabModel } from './def/world/prefab'

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
}
