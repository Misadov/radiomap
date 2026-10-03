// Imperative commands for the globe, sent from anywhere in the UI.

export type MapCommand =
  | { type: 'fly-place'; place: number; zoom?: number }
  | { type: 'fly-country'; cc: string }
  | { type: 'fly-to'; lng: number; lat: number; zoom: number }
  | { type: 'reset' }
  | { type: 'tilt' }
  | { type: 'zoom'; delta: number };

type Listener = (cmd: MapCommand) => void;
const listeners = new Set<Listener>();

export const mapBus = {
  send(cmd: MapCommand) {
    listeners.forEach((l) => l(cmd));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
