export default class GameLogging {
  private static instance: GameLogging | null = null;

  private constructor() {
    // setup
  }

  static getCurrentInstance(): GameLogging {
    if (GameLogging.instance === null) {
      GameLogging.instance = new GameLogging();
    }
    return GameLogging.instance;
  }
}
