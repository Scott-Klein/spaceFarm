export interface Ship {
  crewList: Crew[];
  storage: Resource[];
}

export interface Crew {
  id: string;
  name: string;
}

export interface Resource {
  type: 'Ice';
  amount: number;
}

export const createDefaultShip = (): Ship => {
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
  };
};
