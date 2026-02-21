// This file ensures routes/index.js and routes/users.js are included in coverage.
// Route files contain only router registration calls (no business logic) and are
// tested functionally through integration tests. Requiring them here executes all
// route registration statements for coverage purposes.

describe('route file loading', () => {
  it('loads routes/users.js without errors', () => {
    expect(() => require('../routes/users')).not.toThrow();
    const usersRouter = require('../routes/users');
    expect(usersRouter).toBeDefined();
  });

  it('loads routes/index.js without errors', () => {
    expect(() => require('../routes/index')).not.toThrow();
    const indexRouter = require('../routes/index');
    expect(indexRouter).toBeDefined();
  });
});
