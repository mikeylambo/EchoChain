export const createNoopPlatformServices = () => ({
    achievements: { unlock: async () => { } },
    cloudSave: { load: async () => null, save: async () => { } },
    leaderboards: { submit: async () => { } },
    identity: { currentUser: async () => null },
    presence: { setPresence: async () => { } },
    entitlements: { owns: async () => false }
});
