export type FeatureFlags = {
  logSession: boolean;
};

export function getFeatureFlags(): FeatureFlags {
  return {
    logSession: process.env.FEATURE_LOG_SESSION === "true",
  };
}
