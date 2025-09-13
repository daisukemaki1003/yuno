/// <reference types="jest" />

declare global {
  const describe: jest.Describe;
  const it: jest.It;
  const test: jest.It;
  const expect: jest.Expect;
  const beforeEach: jest.HookBase;
  const afterEach: jest.HookBase;
  const beforeAll: jest.HookBase;
  const afterAll: jest.HookBase;
  const jest: typeof import('jest');
}

export {};