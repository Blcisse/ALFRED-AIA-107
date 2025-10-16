import * as React from 'react';
import { cn } from '@/lib/utils';
import { AVS3D102 } from '@/components/AVS3D102';
import { TrackReference } from '@livekit/components-react';

interface AgentTileProps {
  state: AgentState;
  audioTrack: TrackReference;
  className?: string;
}

export const AgentTile = ({ state, audioTrack, className }: AgentTileProps) => {
  return (
    <div className={cn(className)}>
      <AVS3D102 trackRef={audioTrack} />
    </div>
  );
};