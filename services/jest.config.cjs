/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: {
        module: "commonjs",
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  resolver: "ts-jest-resolver",
  testMatch: [
    "**/test/**/*.test.ts",
    "**/test/**/*.test.tsx",
  ],
};
