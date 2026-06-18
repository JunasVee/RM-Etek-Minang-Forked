/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "lib/**/*.ts",
    "app/api/**/*.ts",
    "!lib/__tests__/**",
    "!lib/__mocks__/**",
    "!lib/prisma.ts",
    "!lib/supabase.ts",
    "!lib/printer.ts",
    "!lib/export.ts",
    "!**/*.d.ts",
  ],
  coverageReporters: ["text", "lcov"],
};
