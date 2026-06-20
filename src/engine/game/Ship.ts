export interface Ship {
  crewList: Crew[];
  storage: Resource[];
  drones: Drone[];
}

export interface Crew {
  id: string;
  name: string;
}

export interface Resource {
  type: 'Ice';
  amount: number;
}

export interface Drone {
  type: 'Mining';
}

export const createDefaultShip = (): Ship => {
  const defaultDrone: Drone = {
    type: 'Mining',
  };

  const defaultResources: Resource = {
    type: 'Ice',
    amount: 100,
  };

  const defaultCrew: Crew = {
    id: '1',
    name: 'Ronny',
  };

  return {
    crewList: [defaultCrew],
    storage: [defaultResources],
    drones: [defaultDrone],
  };
};
