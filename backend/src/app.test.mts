import { App } from './app.mts';

describe('app', () => {
  beforeEach(() => {
      vitest.clearAllMocks();
  });

  it('should test app', async ({ expect }) => {
    expect(App.locals).toEqual(expect.objectContaining({}));
  });
});
