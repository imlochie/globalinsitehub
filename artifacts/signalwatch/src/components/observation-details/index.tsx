import React from 'react';
/**
 * Observation presentation registry.
 *
 * Maps a layer to its bespoke inspector body. Layers without an entry fall
 * back to the generic body, which only uses base observation fields — so a
 * newly registered layer is inspectable before it has bespoke presentation.
 */
import type { BaseObservation } from '@/lib/global-layers';
import {
  isCameraObservation,
  isMaritimeObservation,
  isPublicEventObservation,
} from '@/lib/global-layers';
import { CameraObservationDetails } from './camera-observation-details';
import { PublicEventObservationDetails } from './public-event-observation-details';
import { MaritimeObservationDetails } from './maritime-observation-details';
import { GenericObservationDetails } from './generic-observation-details';

export function ObservationDetails({
  observation,
}: {
  observation: BaseObservation;
}) {
  if (isCameraObservation(observation)) {
    return <CameraObservationDetails observation={observation} />;
  }
  if (isMaritimeObservation(observation)) {
    return <MaritimeObservationDetails observation={observation} />;
  }
  if (isPublicEventObservation(observation)) {
    return <PublicEventObservationDetails observation={observation} />;
  }
  return <GenericObservationDetails observation={observation} />;
}

export { GenericObservationDetails };
