module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
 testRegex: ".*\\.(spec|e2e-spec)\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  collectCoverageFrom: ["src/**/*.ts"],
};