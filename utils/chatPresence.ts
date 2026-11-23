let activeTeamId: number | null = null;
export const setActiveChatTeam = (id: number | null) => { activeTeamId = id; };
export const getActiveChatTeam = () => activeTeamId;